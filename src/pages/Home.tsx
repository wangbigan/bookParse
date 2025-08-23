import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Loader, History } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import LogPanel from '../components/LogPanel';
import { historyManager } from '../utils/historyManager';
import apiService from '../services/api';

interface LogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string;
  duration?: number;
  details?: any;
}

interface HomeProps {
  onHistoryUpdate?: () => void;
}

const Home: React.FC<HomeProps> = ({ onHistoryUpdate }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [historyCount, setHistoryCount] = useState(0);

  const addLog = (operation: string, status: LogEntry['status'], message: string, details?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      operation,
      status,
      message,
      details
    };
    setLogs(prev => [newLog, ...prev]);
    return newLog.id;
  };

  // 更新历史记录数量
  const updateHistoryCount = () => {
    const stats = historyManager.getStats();
    setHistoryCount(stats.total);
  };

  useEffect(() => {
    updateHistoryCount();
  }, []);

  const updateLog = (id: string, status: LogEntry['status'], message?: string, duration?: number) => {
    setLogs(prev => prev.map(log => 
      log.id === id 
        ? { ...log, status, message: message || log.message, duration }
        : log
    ));
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    addLog('文件选择', 'completed', `已选择文件: ${file.name}`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: 'EPUB'
    });
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    setIsUploading(true);
    const logId = addLog('文件上传', 'processing', '正在上传文件...');
    const startTime = Date.now();

    try {
      // 模拟上传进度
      for (let i = 0; i <= 90; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 调用后端API上传文件
      const { fileId, session } = await apiService.uploadBook(selectedFile);
      
      setUploadProgress(100);
      const duration = Date.now() - startTime;
      updateLog(logId, 'completed', '文件上传完成', duration);
      
      // 保存到历史记录
      historyManager.addRecord({
        id: fileId,
        bookTitle: selectedFile.name.replace('.epub', ''),
        author: '未知',
        filename: selectedFile.name,
        status: 'uploaded',
        progress: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        fileSize: selectedFile.size
      });
      
      updateHistoryCount();
      onHistoryUpdate?.();
      
      return fileId;
    } catch (error) {
      const duration = Date.now() - startTime;
      updateLog(logId, 'error', `上传失败: ${error.message}`, duration);
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const navigate = useNavigate();

  const handleStartParsing = async () => {
    if (!selectedFile) {
      addLog('解析启动', 'error', '请先选择要解析的文件');
      return;
    }

    // 先上传文件
    const fileId = await uploadFile();
    if (!fileId) {
      return;
    }

    // 开始解析
    setIsParsing(true);
    const logId = addLog('EPUB解析', 'processing', '正在解析电子书结构...');
    const startTime = Date.now();

    try {
      // 调用后端API解析电子书
      const { session, parseResult } = await apiService.parseBook(fileId);
      
      const duration = Date.now() - startTime;
      updateLog(logId, 'completed', '解析完成，已提取书籍信息、封面和目录结构', duration);
      
      // 更新历史记录
      historyManager.updateRecord(fileId, {
        bookTitle: parseResult.bookInfo.title || selectedFile.name.replace('.epub', ''),
        author: parseResult.bookInfo.author || '未知',
        status: 'parsed',
        progress: 50,
        updatedAt: new Date()
      });
      
      updateHistoryCount();
      onHistoryUpdate?.();
      
      // 添加成功提示
      addLog('解析完成', 'completed', `成功解析《${parseResult.bookInfo.title}》，共${parseResult.tableOfContents.length}个章节`);
      
      // 跳转到解析结果页面
      setTimeout(() => {
        navigate(`/results/${fileId}`);
      }, 1500);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      updateLog(logId, 'error', `解析失败: ${error.message}`, duration);
      
      // 更新历史记录状态
      historyManager.updateRecord(fileId, {
        status: 'error',
        updatedAt: new Date()
      });
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 主要内容区域 */}
          <div className="lg:col-span-2 space-y-8">
            {/* 页面标题 */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                📚 电子书解析AI工具
              </h1>
              <p className="text-lg text-gray-600">
                智能化的电子书内容分析平台，快速提取结构化信息并生成深度分析报告
              </p>
            </div>

            {/* 文件上传区域 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                📁 文件上传
              </h2>
              <FileUpload
                onFileSelect={handleFileSelect}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
              />
            </div>

            {/* 解析控制区域 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                🚀 解析控制
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <h3 className="font-medium text-blue-900">开始解析</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      解析电子书基本信息、封面图片和目录结构
                    </p>
                  </div>
                  <button
                    onClick={handleStartParsing}
                    disabled={!selectedFile || isUploading || isParsing}
                    className="
                      flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg
                      hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                      transition-colors font-medium
                    "
                  >
                    {isParsing ? (
                      <>
                        <Loader className="h-5 w-5 animate-spin" />
                        <span>解析中...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        <span>开始解析</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 历史记录按钮 */}
                <div className="flex gap-4">
                  <Link 
                    to="/history"
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <History className="w-5 h-5" />
                    历史记录
                    {historyCount > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full ml-1">
                        {historyCount > 99 ? '99+' : historyCount}
                      </span>
                    )}
                  </Link>
                </div>

                {/* 状态提示 */}
                {!selectedFile && (
                  <div className="text-sm text-gray-500 text-center py-2">
                    请先上传EPUB格式的电子书文件
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 操作日志面板 */}
          <div className="lg:col-span-1">
            <LogPanel logs={logs} className="sticky top-8" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;