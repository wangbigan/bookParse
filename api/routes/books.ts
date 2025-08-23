// 书籍解析API路由
import express, { Request } from 'express';
import multer from 'multer';

// 扩展Request类型以包含file属性
interface MulterRequest extends Request {
  file?: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
}
import { v4 as uuidv4 } from 'uuid';
import { FileManager } from '../storage/file-manager';
import { ParserFactory } from '../core/parsers/parser-factory';
import { ChapterSplitter } from '../core/analyzers/chapter-splitter';
import { DeepSeekProvider } from '../ai/deepseek-provider';
import { BookParseSession, OperationLog, ParseResult } from '../types/book.types';

const router = express.Router();

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/epub+zip' || file.originalname.endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('只支持EPUB格式的文件'));
    }
  }
});

// 初始化服务
const fileManager = new FileManager();
const parserFactory = new ParserFactory();
const deepSeekProvider = new DeepSeekProvider();

/**
 * POST /api/books/upload
 * 上传电子书文件
 */
router.post('/upload', upload.single('file'), async (req: MulterRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    // 保存文件并创建会话
    const { fileId, filePath, session } = await fileManager.saveUploadedFile(
      req.file.buffer,
      req.file.originalname
    );

    // 更新会话状态
    await fileManager.updateSession(fileId, {
      status: 'uploaded',
      progress: 10
    });

    res.json({
      success: true,
      data: {
        fileId,
        session
      },
      message: '文件上传成功'
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '文件上传失败'
    });
  }
});

/**
 * POST /api/books/:fileId/parse
 * 解析电子书基本信息
 */
router.post('/:fileId/parse', async (req, res) => {
  try {
    const { fileId } = req.params;
    const session = fileManager.getSession(fileId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }

    // 更新状态
    await fileManager.updateSession(fileId, {
      status: 'parsing',
      progress: 20
    });

    // 添加日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '开始解析',
      status: 'in_progress',
      message: '正在解析电子书基本信息...'
    });

    // 创建解析器
    const parser = ParserFactory.createParser(session.filepath);
    if (!parser) {
      throw new Error('不支持的文件格式');
    }

    // 解析基本信息
    const parseResult = await parser.parse(session.filepath);
    
    // 更新会话
    await fileManager.updateSession(fileId, {
      status: 'parsed',
      progress: 50,
      parseResult
    });

    // 添加成功日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '解析完成',
      status: 'completed',
      message: '电子书基本信息解析完成',
      details: {
        title: parseResult.bookInfo.title,
        author: parseResult.bookInfo.author,
        chaptersCount: parseResult.tableOfContents.length
      }
    });

    res.json({
      success: true,
      data: {
        session: fileManager.getSession(fileId),
        parseResult
      },
      message: '解析完成'
    });
  } catch (error) {
    console.error('解析失败:', error);
    
    // 更新失败状态
    await fileManager.updateSession(req.params.fileId, {
      status: 'error',
      error: error.message
    });

    // 添加错误日志
    await fileManager.addLog(req.params.fileId, {
      id: uuidv4(),
      fileId: req.params.fileId,
      timestamp: new Date(),
      operation: '解析失败',
      status: 'error',
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message || '解析失败'
    });
  }
});

/**
 * POST /api/books/:fileId/split
 * 拆分章节
 */
router.post('/:fileId/split', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { level = 1 } = req.body;
    const session = fileManager.getSession(fileId);
    
    if (!session || !session.parseResult) {
      return res.status(404).json({
        success: false,
        message: '请先解析电子书基本信息'
      });
    }

    // 更新状态
    await fileManager.updateSession(fileId, {
      status: 'splitting',
      progress: 60
    });

    // 添加日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '章节拆分',
      status: 'in_progress',
      message: `正在按第${level}级目录拆分章节...`
    });

    // 检查是否有目录结构
    if (!session.parseResult.tableOfContents || session.parseResult.tableOfContents.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少目录结构，无法进行章节拆分'
      });
    }

    // 创建章节拆分器
    const splitter = new ChapterSplitter();
    await splitter.initialize(session.filepath);
    
    // 拆分章节 - 使用正确的方法和参数
    const chapters = await splitter.splitChapters(session.parseResult.tableOfContents, { level });
    const stats = splitter.getChapterStats(chapters);
    
    // 更新解析结果
    const updatedParseResult = {
      ...session.parseResult,
      chapters,
      chapterStats: stats
    };

    // 更新会话
    await fileManager.updateSession(fileId, {
      status: 'split',
      progress: 70,
      parseResult: updatedParseResult
    });

    // 添加成功日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '章节拆分完成',
      status: 'completed',
      message: `成功拆分为${chapters.length}个章节`,
      details: {
          chaptersCount: chapters.length,
          totalWords: stats.totalWords,
          averageWords: stats.averageWords
        }
    });

    // 清理资源
    await splitter.cleanup();

    res.json({
      success: true,
      data: {
        session: fileManager.getSession(fileId),
        chapters,
        stats
      },
      message: '章节拆分完成'
    });
  } catch (error) {
    console.error('章节拆分失败:', error);
    
    // 更新失败状态
    await fileManager.updateSession(req.params.fileId, {
      status: 'error',
      error: error.message
    });

    // 添加错误日志
    await fileManager.addLog(req.params.fileId, {
      id: uuidv4(),
      fileId: req.params.fileId,
      timestamp: new Date(),
      operation: '章节拆分失败',
      status: 'error',
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message || '章节拆分失败'
    });
  }
});

/**
 * POST /api/books/:fileId/analyze
 * AI分析章节
 */
router.post('/:fileId/analyze', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { chapterIndexes, analysisType = 'full' } = req.body;
    const session = fileManager.getSession(fileId);
    
    if (!session || !session.parseResult?.chapters) {
      return res.status(404).json({
        success: false,
        message: '请先拆分章节'
      });
    }

    // 更新状态
    await fileManager.updateSession(fileId, {
      status: 'analyzing',
      progress: 80
    });

    // 添加日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: 'AI分析',
      status: 'in_progress',
      message: '正在进行AI章节分析...'
    });

    const chapters = session.parseResult.chapters;
    console.log(`[DEBUG] 总章节数: ${chapters.length}, 请求分析章节索引:`, chapterIndexes);
    
    const targetChapters = chapterIndexes 
      ? chapterIndexes.map((index: number) => {
          if (index >= 0 && index < chapters.length) {
            console.log(`[DEBUG] 选择章节 ${index}: ${chapters[index].title}`);
            return chapters[index];
          }
          console.warn(`[DEBUG] 无效章节索引: ${index}`);
          return null;
        }).filter(Boolean)
      : chapters;

    console.log(`[DEBUG] 实际分析章节数: ${targetChapters.length}`);

    // 批量分析章节
    const analysisResults = await deepSeekProvider.analyzeChaptersBatch(
      targetChapters,
      analysisType
    );
    
    console.log(`[DEBUG] 分析结果数量: ${analysisResults.length}`);
    
    // 如果是单章节分析，需要将结果映射回正确的位置并保留现有数据
    let finalAnalysisResults = analysisResults;
    if (chapterIndexes && chapterIndexes.length > 0) {
      // 获取现有的章节分析结果，如果没有则创建新数组
      const existingAnalysis = session.parseResult?.chapterAnalysis || new Array(chapters.length).fill(null);
      finalAnalysisResults = [...existingAnalysis]; // 复制现有结果
      
      // 将新的分析结果更新到正确的位置
      chapterIndexes.forEach((originalIndex, resultIndex) => {
        if (resultIndex < analysisResults.length && originalIndex >= 0 && originalIndex < chapters.length) {
          finalAnalysisResults[originalIndex] = analysisResults[resultIndex];
          console.log(`[DEBUG] 更新章节分析结果: 索引 ${originalIndex} <- 结果 ${resultIndex}`);
        }
      });
      
      console.log(`[DEBUG] 单章节分析 - 保留现有结果并更新指定章节`);
    }

    // 只有在批量分析（分析所有章节或大部分章节）时才生成书籍总结
    let bookSummary = null;
    const totalChapters = chapters.length;
    const analyzedChapters = chapterIndexes ? chapterIndexes.length : totalChapters;
    
    // 如果分析的章节数量超过总章节数的一半，或者没有指定章节索引（分析所有章节），则生成书籍总结
    if (!chapterIndexes || analyzedChapters >= Math.ceil(totalChapters / 2)) {
      console.log(`[DEBUG] 生成书籍总结 - 分析章节数: ${analyzedChapters}, 总章节数: ${totalChapters}`);
      bookSummary = await deepSeekProvider.generateBookSummary(
        session.parseResult.bookInfo,
        analysisResults
      );
    } else {
      console.log(`[DEBUG] 跳过书籍总结生成 - 单章节分析，章节索引: ${chapterIndexes}`);
    }

    // 更新解析结果
    const updatedParseResult = {
      ...session.parseResult,
      chapterAnalysis: finalAnalysisResults,
      bookSummary
    };
    
    console.log(`[DEBUG] 准备保存分析结果到会话 - 章节数量: ${finalAnalysisResults.length}`);
    console.log(`[DEBUG] 已分析章节索引:`, finalAnalysisResults.map((result, index) => result ? index : null).filter(i => i !== null));

    // 更新会话
    await fileManager.updateSession(fileId, {
      status: 'completed',
      progress: 100,
      parseResult: updatedParseResult
    });
    
    console.log(`[DEBUG] 分析结果已保存到会话数据`);

    // 添加成功日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: 'AI分析完成',
      status: 'completed',
      message: `成功分析${analysisResults.length}个章节`,
      details: {
        analyzedChapters: analysisResults.length,
        totalArguments: analysisResults.reduce((sum, result) => sum + result.arguments.length, 0),
        totalQuotes: analysisResults.reduce((sum, result) => sum + result.quotes.length, 0),
        requestedIndexes: chapterIndexes || 'all'
      }
    });

    console.log(`[DEBUG] 返回分析结果数量: ${finalAnalysisResults.length}`);

    res.json({
      success: true,
      data: {
        session: fileManager.getSession(fileId),
        analysisResults: finalAnalysisResults,
        bookSummary
      },
      message: 'AI分析完成'
    });
  } catch (error) {
    console.error('AI分析失败:', error);
    
    // 更新失败状态
    await fileManager.updateSession(req.params.fileId, {
      status: 'error',
      error: error.message
    });

    // 添加错误日志
    await fileManager.addLog(req.params.fileId, {
      id: uuidv4(),
      fileId: req.params.fileId,
      timestamp: new Date(),
      operation: 'AI分析失败',
      status: 'error',
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message || 'AI分析失败'
    });
  }
});

/**
 * GET /api/books/:fileId
 * 获取解析会话信息
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const session = fileManager.getSession(fileId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }

    res.json({
      success: true,
      data: {
        session,
        logs: fileManager.getLogs(fileId)
      }
    });
  } catch (error) {
    console.error('获取会话失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取会话失败'
    });
  }
});

/**
 * GET /api/books/:fileId/logs
 * 获取操作日志
 */
router.get('/:fileId/logs', async (req, res) => {
  try {
    const { fileId } = req.params;
    const logs = fileManager.getLogs(fileId);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取日志失败'
    });
  }
});

/**
 * GET /api/books
 * 获取所有会话（历史记录）
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let sessions = fileManager.getAllSessions();
    
    // 状态筛选
    if (status && status !== 'all') {
      sessions = sessions.filter(session => session.status === status);
    }
    
    // 排序（最新的在前）
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    // 分页
    const total = sessions.length;
    const paginatedSessions = sessions.slice(
      Number(offset),
      Number(offset) + Number(limit)
    );
    
    res.json({
      success: true,
      data: {
        sessions: paginatedSessions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total
        }
      }
    });
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取历史记录失败'
    });
  }
});

/**
 * DELETE /api/books/:fileId
 * 删除会话
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    await fileManager.deleteSession(fileId);
    
    res.json({
      success: true,
      message: '会话删除成功'
    });
  } catch (error) {
    console.error('删除会话失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除会话失败'
    });
  }
});

/**
 * GET /api/books/stats
 * 获取存储统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await fileManager.getStorageStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取统计信息失败'
    });
  }
});

export default router;