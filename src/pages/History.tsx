import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, Trash2, Play, Eye, Search, Filter } from 'lucide-react';
import { historyManager, HistoryRecord } from '../utils/historyManager';

interface HistoryProps {
  onHistoryUpdate?: () => void;
}



const statusConfig = {
  uploaded: { label: '已上传', color: 'bg-blue-100 text-blue-800', icon: '📁' },
  parsed: { label: '已解析', color: 'bg-green-100 text-green-800', icon: '📖' },
  split: { label: '已拆分', color: 'bg-purple-100 text-purple-800', icon: '📄' },
  analyzing: { label: '分析中', color: 'bg-orange-100 text-orange-800', icon: '🤖' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: '✅' },
  error: { label: '失败', color: 'bg-red-100 text-red-800', icon: '❌' },
  default: { label: '未知', color: 'bg-gray-100 text-gray-800', icon: '❓' }
} as const;

// 获取状态配置的安全函数
const getStatusConfig = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig] || statusConfig.default;
};

const History: React.FC<HistoryProps> = ({ onHistoryUpdate }) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRecords = records.filter(record => {
    const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
    const matchesKeyword = searchKeyword === '' || 
      record.filename.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      record.bookTitle?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      record.author?.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchesStatus && matchesKeyword;
  });

  // 加载历史记录
  const loadRecords = () => {
    const allRecords = historyManager.getRecords();
    setRecords(allRecords);
    onHistoryUpdate?.();
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleDeleteRecord = (id: string) => {
    if (historyManager.deleteRecord(id)) {
      loadRecords();
      setSelectedRecords(selectedRecords.filter(recordId => recordId !== id));
      
      // 触发全局更新
      window.dispatchEvent(new Event('historyUpdated'));
    }
  };

  const handleBatchDelete = () => {
    const deletedCount = historyManager.deleteRecords(selectedRecords);
    if (deletedCount > 0) {
      loadRecords();
      setSelectedRecords([]);
      
      // 触发全局更新
      window.dispatchEvent(new Event('historyUpdated'));
    }
  };

  const handleViewResult = (record: HistoryRecord) => {
    if (record.status === 'completed') {
      navigate('/real-time-result', { state: { recordId: record.id } });
    }
  };

  const handleContinueParsing = (record: HistoryRecord) => {
    if (['analyzing', 'parsed', 'uploaded'].includes(record.status)) {
      navigate('/parse-result', { state: { recordId: record.id } });
    }
  };

  const handleRetryParsing = (record: HistoryRecord) => {
    if (record.status === 'error') {
      // 更新状态为已上传，准备重新解析
      historyManager.updateRecord(record.id, { 
        status: 'uploaded', 
        progress: 0,
        errorMessage: undefined 
      });
      loadRecords();
      navigate('/parse-result', { state: { recordId: record.id } });
    }
  };

  const handleSelectRecord = (id: string) => {
    setSelectedRecords(prev => 
      prev.includes(id) 
        ? prev.filter(recordId => recordId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedRecords.length === filteredRecords.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredRecords.map(record => record.id));
    }
  };

  const statusCounts = {
    all: records.length,
    uploaded: records.filter(r => r.status === 'uploaded').length,
    parsed: records.filter(r => r.status === 'parsed').length,
    split: records.filter(r => r.status === 'split').length,
    analyzing: records.filter(r => r.status === 'analyzing').length,
    completed: records.filter(r => r.status === 'completed').length,
    error: records.filter(r => r.status === 'error').length
  } as const;

  // 获取状态计数的安全函数
  const getStatusCount = (status: string): number => {
    return statusCounts[status as keyof typeof statusCounts] || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📚 历史记录</h1>
          <p className="text-gray-600">管理您的电子书解析记录，查看解析结果或继续未完成的项目</p>
        </div>

        {/* 筛选和搜索栏 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* 状态筛选标签 */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部 ({statusCounts.all})
              </button>
              {Object.entries(statusConfig)
                .filter(([status]) => status !== 'default')
                .map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {config.icon} {config.label} ({getStatusCount(status)})
                </button>
              ))}
            </div>

            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索书名、作者或文件名..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80"
              />
            </div>
          </div>

          {/* 批量操作 */}
          {selectedRecords.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  已选择 {selectedRecords.length} 项
                </span>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  批量删除
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 记录列表 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* 表头 */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={selectedRecords.length === filteredRecords.length && filteredRecords.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">全选</span>
            </div>
          </div>

          {/* 记录列表 */}
          <div className="divide-y divide-gray-200">
            {filteredRecords.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无记录</h3>
                <p className="text-gray-600">没有找到符合条件的解析记录</p>
              </div>
            ) : (
              filteredRecords.map((record) => {
                const statusInfo = getStatusConfig(record.status);
                return (
                  <div key={record.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* 选择框 */}
                      <input
                        type="checkbox"
                        checked={selectedRecords.includes(record.id)}
                        onChange={() => handleSelectRecord(record.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />

                      {/* 封面缩略图 */}
                      <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        {record.coverThumbnail ? (
                          <img
                            src={record.coverThumbnail}
                            alt="封面"
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      {/* 书籍信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {record.bookTitle || record.filename}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.icon} {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>📝 {record.author || '未知作者'}</span>
                          <span>📁 {record.filename}</span>
                          <span>💾 {formatFileSize(record.fileSize)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(record.uploadTime)}
                          </span>
                        </div>
                        {record.status === 'uploaded' && record.progress && record.progress < 100 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${record.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-600">{record.progress}%</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(record.status === 'completed' || record.status === 'parsed') && (
                          <button 
                            onClick={() => handleViewResult(record)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            查看结果
                          </button>
                        )}
                        {record.status === 'parsed' && (
                          <button 
                            onClick={() => handleContinueParsing(record)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            继续拆分
                          </button>
                        )}
                        {record.status === 'uploaded' && (
                          <button 
                            onClick={() => handleContinueParsing(record)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            继续解析
                          </button>
                        )}
                        {record.status === 'error' && (
                          <button 
                            onClick={() => handleRetryParsing(record)}
                            className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            重新解析
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="mt-6 text-center text-sm text-gray-600">
          共 {records.length} 条记录，显示 {filteredRecords.length} 条
        </div>
      </div>
    </div>
  );
};

export default History;