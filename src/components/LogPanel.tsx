import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string;
  duration?: number;
  details?: any;
}

interface LogPanelProps {
  logs: LogEntry[];
  className?: string;
}

const LogPanel: React.FC<LogPanelProps> = ({ logs, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getStatusIcon = (status: LogEntry['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: LogEntry['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'processing':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* 面板头部 */}
      <div
        className="flex items-center justify-between p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-medium text-gray-900">操作日志</h3>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            {logs.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* 日志内容 */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>暂无操作记录</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {logs.map((log, index) => (
                <div
                  key={log.id}
                  className={`relative border rounded-lg p-3 ${getStatusColor(log.status)}`}
                >
                  {/* 时间轴连接线 */}
                  {index < logs.length - 1 && (
                    <div className="absolute left-6 top-10 w-px h-6 bg-gray-300"></div>
                  )}

                  <div className="flex items-start space-x-3">
                    {/* 状态图标 */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(log.status)}
                    </div>

                    {/* 日志内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-900">
                          {log.operation}
                        </h4>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>{formatTime(log.timestamp)}</span>
                          {log.duration && (
                            <span className="bg-gray-200 px-1.5 py-0.5 rounded">
                              {formatDuration(log.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{log.message}</p>
                      
                      {/* 详细信息 */}
                      {log.details && (
                        <div className="mt-2 p-2 bg-white bg-opacity-50 rounded text-xs text-gray-500">
                          <pre className="whitespace-pre-wrap">
                            {typeof log.details === 'string' 
                              ? log.details 
                              : JSON.stringify(log.details, null, 2)
                            }
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LogPanel;