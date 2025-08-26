import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Eye, Home, FileText, BarChart3, History, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import AIConfigModal from './AIConfigModal';
import { configService } from '../services/configService';

interface NavbarProps {
  progress?: number;
  historyCount?: number;
}

const Navbar: React.FC<NavbarProps> = ({ progress = 0, historyCount = 0 }) => {
  const location = useLocation();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isAIConfigured, setIsAIConfigured] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('deepseek');

  // 检查AI配置状态
  useEffect(() => {
    const checkAIConfig = () => {
      setIsAIConfigured(configService.isConfigValid());
      setCurrentProvider(configService.getCurrentProvider());
    };

    checkAIConfig();

    // 监听配置变更
    const unsubscribe = configService.onConfigChange(checkAIConfig);
    return unsubscribe;
  }, []);



  const navItems = [
    { path: '/', label: '首页', icon: Home },
    { path: '/history', label: '历史记录', icon: History, badge: historyCount },
    { path: '/parse-result', label: '解析结果', icon: FileText },
    { path: '/analysis-report', label: '分析报告', icon: BarChart3 },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo区域 */}
          <div className="flex items-center space-x-2">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">电子书解析AI</span>
          </div>

          {/* 页面切换标签 */}
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive(item.path)
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* AI配置、查看结果按钮和进度指示器 */}
          <div className="flex items-center space-x-4">
            {/* AI配置按钮 */}
            <button
              onClick={() => setShowConfigModal(true)}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${
                  isAIConfigured
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                }
              `}
              title={isAIConfigured ? `已配置 ${currentProvider.toUpperCase()}` : '请配置AI模型'}
            >
              <Settings className="h-4 w-4" />
              <span>{isAIConfigured ? '已配置AI' : '配置AI'}</span>
            </button>
            {/* 进度指示器 */}
            {progress > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600">{progress}%</span>
              </div>
            )}

            {/* 查看结果按钮 */}
            <Link
              to="/real-time-result"
              className="
                flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                hover:bg-blue-700 transition-colors text-sm font-medium
              "
            >
              <Eye className="h-4 w-4" />
              <span>查看结果</span>
            </Link>
          </div>
        </div>
      </div>
      
      {/* AI配置模态框 */}
      <AIConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfigSaved={() => {
          // 配置保存后的回调
          console.log('AI配置已保存');
        }}
      />
    </nav>
  );
};

export default Navbar;