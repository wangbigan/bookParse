// 文件存储管理器
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { BookParseSession, OperationLog } from '../types/book.types';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

export interface StorageConfig {
  uploadDir: string;
  sessionDir: string;
  maxFileSize: number; // 最大文件大小（字节）
  allowedExtensions: string[];
  cleanupInterval: number; // 清理间隔（毫秒）
  maxAge: number; // 文件最大保存时间（毫秒）
}

export class FileManager {
  private config: StorageConfig;
  private sessions: Map<string, BookParseSession> = new Map();
  private logs: Map<string, OperationLog[]> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      uploadDir: path.join(process.cwd(), 'uploads'),
      sessionDir: path.join(process.cwd(), 'sessions'),
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedExtensions: ['.epub'],
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '3600000'), // 默认1小时（毫秒）
      maxAge: parseInt(process.env.MAX_FILE_AGE || '86400000'), // 默认24小时（毫秒）
      ...config
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // 创建必要的目录
      await this.ensureDirectoryExists(this.config.uploadDir);
      await this.ensureDirectoryExists(this.config.sessionDir);
      
      // 加载现有会话
      await this.loadSessions();
      
      // 启动清理定时器
      this.startCleanupTimer();
      
      console.log('文件管理器初始化完成');
    } catch (error) {
      console.error('文件管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 保存上传的文件
   */
  async saveUploadedFile(buffer: Buffer, originalName: string): Promise<{
    fileId: string;
    filePath: string;
    session: BookParseSession;
  }> {
    try {
      // 验证文件
      this.validateFile(buffer, originalName);
      
      // 生成文件ID和路径
      const fileId = uuidv4();
      const ext = path.extname(originalName);
      const fileName = `${fileId}${ext}`;
      const filePath = path.join(this.config.uploadDir, fileName);
      
      // 保存文件
      await writeFile(filePath, buffer);
      
      // 创建会话
      const session: BookParseSession = {
        id: fileId,
        filename: originalName,
        filepath: filePath,
        status: 'uploading',
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0
      };
      
      // 保存会话
      await this.saveSession(session);
      
      // 记录日志
      await this.addLog(fileId, {
        id: uuidv4(),
        fileId,
        timestamp: new Date(),
        operation: '文件上传',
        status: 'completed',
        message: `文件上传成功: ${originalName}`,
        details: {
          originalName,
          fileSize: buffer.length,
          filePath
        }
      });
      
      return { fileId, filePath, session };
    } catch (error) {
      throw new Error(`文件保存失败: ${error.message}`);
    }
  }

  /**
   * 获取会话
   */
  getSession(fileId: string): BookParseSession | null {
    return this.sessions.get(fileId) || null;
  }

  /**
   * 更新会话
   */
  async updateSession(fileId: string, updates: Partial<BookParseSession>): Promise<void> {
    const session = this.sessions.get(fileId);
    if (!session) {
      throw new Error(`会话不存在: ${fileId}`);
    }

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    };

    this.sessions.set(fileId, updatedSession);
    await this.saveSession(updatedSession);
  }

  /**
   * 删除会话和相关文件
   */
  async deleteSession(fileId: string): Promise<void> {
    const session = this.sessions.get(fileId);
    if (!session) {
      return;
    }

    try {
      // 删除文件
      if (fs.existsSync(session.filepath)) {
        await unlink(session.filepath);
      }
      
      // 删除会话文件
      const sessionPath = path.join(this.config.sessionDir, `${fileId}.json`);
      if (fs.existsSync(sessionPath)) {
        await unlink(sessionPath);
      }
      
      // 从内存中移除
      this.sessions.delete(fileId);
      this.logs.delete(fileId);
      
      console.log(`会话已删除: ${fileId}`);
    } catch (error) {
      console.error(`删除会话失败 [${fileId}]:`, error);
      throw error;
    }
  }

  /**
   * 添加操作日志
   */
  async addLog(fileId: string, log: OperationLog): Promise<void> {
    if (!this.logs.has(fileId)) {
      this.logs.set(fileId, []);
    }
    
    this.logs.get(fileId)!.push(log);
    
    // 限制日志数量
    const logs = this.logs.get(fileId)!;
    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }
  }

  /**
   * 获取操作日志
   */
  getLogs(fileId: string): OperationLog[] {
    return this.logs.get(fileId) || [];
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): BookParseSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    totalSessions: number;
    totalFiles: number;
    totalSize: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    const sessions = Array.from(this.sessions.values());
    let totalSize = 0;
    
    for (const session of sessions) {
      try {
        if (fs.existsSync(session.filepath)) {
          const stats = await stat(session.filepath);
          totalSize += stats.size;
        }
      } catch (error) {
        // 忽略文件不存在的错误
      }
    }
    
    const dates = sessions.map(s => s.createdAt).sort();
    
    return {
      totalSessions: sessions.length,
      totalFiles: sessions.length,
      totalSize,
      oldestSession: dates.length > 0 ? dates[0] : null,
      newestSession: dates.length > 0 ? dates[dates.length - 1] : null
    };
  }

  private validateFile(buffer: Buffer, originalName: string): void {
    // 检查文件大小
    if (buffer.length > this.config.maxFileSize) {
      throw new Error(`文件过大，最大允许 ${this.config.maxFileSize / 1024 / 1024}MB`);
    }
    
    // 检查文件扩展名
    const ext = path.extname(originalName).toLowerCase();
    if (!this.config.allowedExtensions.includes(ext)) {
      throw new Error(`不支持的文件格式，仅支持: ${this.config.allowedExtensions.join(', ')}`);
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async saveSession(session: BookParseSession): Promise<void> {
    const sessionPath = path.join(this.config.sessionDir, `${session.id}.json`);
    await writeFile(sessionPath, JSON.stringify(session, null, 2));
    this.sessions.set(session.id, session);
  }

  private async loadSessions(): Promise<void> {
    try {
      const files = await readdir(this.config.sessionDir);
      
      for (const file of files) {
        if (path.extname(file) === '.json') {
          try {
            const sessionPath = path.join(this.config.sessionDir, file);
            const content = await readFile(sessionPath, 'utf-8');
            const session: BookParseSession = JSON.parse(content);
            
            // 转换日期字符串为Date对象
            session.createdAt = new Date(session.createdAt);
            session.updatedAt = new Date(session.updatedAt);
            
            this.sessions.set(session.id, session);
          } catch (error) {
            console.error(`加载会话失败 [${file}]:`, error);
          }
        }
      }
      
      console.log(`已加载 ${this.sessions.size} 个会话`);
    } catch (error) {
      console.error('加载会话失败:', error);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        console.error('清理任务失败:', error);
      });
    }, this.config.cleanupInterval);
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [fileId, session] of this.sessions) {
      const age = now - session.createdAt.getTime();
      if (age > this.config.maxAge) {
        expiredSessions.push(fileId);
      }
    }
    
    for (const fileId of expiredSessions) {
      try {
        await this.deleteSession(fileId);
        console.log(`已清理过期会话: ${fileId}`);
      } catch (error) {
        console.error(`清理会话失败 [${fileId}]:`, error);
      }
    }
    
    if (expiredSessions.length > 0) {
      console.log(`清理完成，删除了 ${expiredSessions.length} 个过期会话`);
    }
  }

  /**
   * 停止文件管理器
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    console.log('文件管理器已停止');
  }
}