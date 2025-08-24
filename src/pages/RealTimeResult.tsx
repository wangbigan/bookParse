import React, { useState, useEffect } from 'react';
import { Eye, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight, Copy, RefreshCw } from 'lucide-react';

// 数据类型定义
interface ProgressStatus {
  fileId: string;
  overall: number;
  modules: {
    upload: boolean;
    parse: boolean;
    split: boolean;
    analyze: boolean;
    summary: boolean;
  };
  currentStep: string;
  estimatedTime?: number;
}

interface RealTimeResult {
  fileId: string;
  bookInfo?: any;
  coverInfo?: any;
  tableOfContents?: any[];
  chapters?: any[];
  bookSummary?: any;
  progress: ProgressStatus;
  lastUpdated: Date;
}

const RealTimeResult: React.FC = () => {
  const [result, setResult] = useState<RealTimeResult>({
    fileId: '',
    progress: {
      fileId: '',
      overall: 0,
      modules: {
        upload: false,
        parse: false,
        split: false,
        analyze: false,
        summary: false
      },
      currentStep: '等待开始',
      estimatedTime: 0
    },
    lastUpdated: new Date()
  });

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['progress', 'bookInfo']));
  const [autoRefresh, setAutoRefresh] = useState(true);

  // TODO: 实时数据更新 - 从后端API获取真实进度数据
  useEffect(() => {
    if (!autoRefresh || !result.fileId) return;

    const interval = setInterval(async () => {
      try {
        // TODO: 调用后端API获取实时进度
        // const progressData = await apiService.getProgress(result.fileId);
        // setResult(prev => ({ ...prev, ...progressData, lastUpdated: new Date() }));
      } catch (error) {
        console.error('获取进度数据失败:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, result.fileId]);

  // 获取当前JSON结果数据
  const generateCurrentJSON = () => {
    const baseResult: any = {
      book_info: result.progress.modules.parse ? (result.bookInfo || "解析中...") : "待处理",
      cover_info: result.progress.modules.parse ? (result.coverInfo || "解析中...") : "待处理",
      table_of_contents: result.progress.modules.parse ? (result.tableOfContents || "解析中...") : "待处理",
      chapters: result.progress.modules.analyze ? (result.chapters || "分析中...") : result.progress.modules.split ? "已拆分，待分析" : "待处理",
      book_summary: result.progress.modules.summary ? (result.bookSummary || "生成中...") : "待处理"
    };

    return baseResult;
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleCopyJSON = () => {
    const jsonData = JSON.stringify(generateCurrentJSON(), null, 2);
    navigator.clipboard.writeText(jsonData);
    alert('当前JSON数据已复制到剪贴板！');
  };

  const getModuleStatus = (moduleKey: keyof ProgressStatus['modules']) => {
    if (result.progress.modules[moduleKey]) {
      return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' };
    } else {
      return { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' };
    }
  };

  const getFieldCompleteness = () => {
    const fields = [
      { name: '书籍信息', completed: result.progress.modules.parse },
      { name: '封面信息', completed: result.progress.modules.parse },
      { name: '目录结构', completed: result.progress.modules.parse },
      { name: '章节内容', completed: result.progress.modules.split },
      { name: '章节分析', completed: result.progress.modules.analyze },
      { name: '书籍总结', completed: result.progress.modules.summary }
    ];
    
    const completedCount = fields.filter(f => f.completed).length;
    return { fields, completedCount, total: fields.length };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completeness = getFieldCompleteness();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 页面标题 */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              👁️ 实时结果
            </h1>
            <p className="text-lg text-gray-600">
              实时查看解析进度和当前JSON结果数据
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 进度状态栏 */}
            <div className="lg:col-span-1 space-y-6">
              {/* 整体进度 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">整体进度</h2>
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`
                      p-2 rounded-lg transition-colors
                      ${autoRefresh ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}
                    `}
                  >
                    <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                {/* 环形进度图 */}
                <div className="flex items-center justify-center mb-4">
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="#3b82f6"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - result.progress.overall / 100)}`}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-gray-900">
                        {Math.round(result.progress.overall)}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-600">{result.progress.currentStep}</p>
                  {result.progress.estimatedTime && (
                    <p className="text-xs text-gray-500">
                      预计剩余时间: {formatTime(result.progress.estimatedTime)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    最后更新: {result.lastUpdated.toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* 模块完成状态 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">模块状态</h3>
                <div className="space-y-3">
                  {[
                    { key: 'upload' as const, label: '文件上传' },
                    { key: 'parse' as const, label: '文件解析' },
                    { key: 'split' as const, label: '章节拆分' },
                    { key: 'analyze' as const, label: '章节分析' },
                    { key: 'summary' as const, label: '书籍总结' }
                  ].map(({ key, label }) => {
                    const status = getModuleStatus(key);
                    const Icon = status.icon;
                    return (
                      <div
                        key={key}
                        className={`
                          flex items-center space-x-3 p-3 rounded-lg border
                          ${status.bg} ${status.border}
                        `}
                      >
                        <Icon className={`h-5 w-5 ${status.color}`} />
                        <span className="text-sm font-medium text-gray-900">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 数据完整性检查 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">数据完整性</h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>字段完成度</span>
                    <span>{completeness.completedCount}/{completeness.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(completeness.completedCount / completeness.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {completeness.fields.map((field, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{field.name}</span>
                      {field.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* JSON预览区 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* 头部 */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <Eye className="h-5 w-5 text-blue-600" />
                    <span>JSON预览</span>
                  </h2>
                  <button
                    onClick={handleCopyJSON}
                    className="
                      flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                      hover:bg-blue-700 transition-colors text-sm
                    "
                  >
                    <Copy className="h-4 w-4" />
                    <span>复制JSON</span>
                  </button>
                </div>

                {/* JSON内容 */}
                <div className="p-6">
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto">
                    <pre className="text-green-400 text-sm">
                      <code>{JSON.stringify(generateCurrentJSON(), null, 2)}</code>
                    </pre>
                  </div>
                </div>

                {/* 展开/折叠的详细信息 */}
                <div className="border-t border-gray-200">
                  {[
                    { key: 'progress', label: '进度信息', data: result.progress },
                    { key: 'bookInfo', label: '书籍信息', data: generateCurrentJSON().book_info },
                    { key: 'chapters', label: '章节数据', data: generateCurrentJSON().chapters }
                  ].map(({ key, label, data }) => (
                    <div key={key} className="border-b border-gray-200 last:border-b-0">
                      <button
                        onClick={() => toggleSection(key)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-gray-900">{label}</span>
                        {expandedSections.has(key) ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      
                      {expandedSections.has(key) && (
                        <div className="px-4 pb-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                              {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeResult;