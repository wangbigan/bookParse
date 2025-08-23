import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Eye, Home, FileText, BarChart3, History } from 'lucide-react';

interface NavbarProps {
  progress?: number;
  historyCount?: number;
}

const Navbar: React.FC<NavbarProps> = ({ progress = 0, historyCount = 0 }) => {
  const location = useLocation();

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

          {/* 查看结果按钮和进度指示器 */}
          <div className="flex items-center space-x-4">
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
    </nav>
  );
};

export default Navbar;