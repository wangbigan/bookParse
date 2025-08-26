import React, { useState, useEffect } from 'react';
import { X, Settings, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { configService, AIProvider, AIConfig } from '../services/configService';
import { apiService } from '../services/api';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [currentProvider, setCurrentProvider] = useState<AIProvider>('deepseek');
  const [configs, setConfigs] = useState<Partial<Record<AIProvider, AIConfig>>>({});
  const [showApiKey, setShowApiKey] = useState<Partial<Record<AIProvider, boolean>>>({});
  const [testingConnection, setTestingConnection] = useState<AIProvider | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Partial<Record<AIProvider, boolean | null>>>({});

  // 提供商信息
  const providerInfo = {
    deepseek: {
      name: 'DeepSeek',
      description: '深度求索AI，专业的代码和文本分析',
      website: 'https://platform.deepseek.com'
    },
    kimi: {
      name: 'Kimi',
      description: '月之暗面AI，支持长文本处理',
      website: 'https://platform.moonshot.cn'
    },
    openai: {
      name: 'OpenAI',
      description: 'OpenAI GPT模型，通用AI助手',
      website: 'https://platform.openai.com'
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  /**
   * 加载配置
   */
  const loadConfigs = () => {
    const current = configService.getCurrentProvider();
    setCurrentProvider(current);
    
    const allConfigs = {
      deepseek: configService.getConfig('deepseek'),
      kimi: configService.getConfig('kimi'),
      openai: configService.getConfig('openai')
    };
    setConfigs(allConfigs);
  };

  /**
   * 更新配置
   */
  const updateConfig = (provider: AIProvider, field: keyof AIConfig, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }));
  };

  /**
   * 保存配置
   */
  const saveConfig = (provider: AIProvider) => {
    const config = configs[provider];
    configService.saveConfig(provider, config);
    
    // 如果保存的是当前提供商，更新当前提供商
    if (provider === currentProvider) {
      configService.setCurrentProvider(provider);
    }
    
    onConfigSaved?.();
  };

  /**
   * 测试连接
   */
  const testConnection = async (provider: AIProvider) => {
    setTestingConnection(provider);
    setConnectionStatus(prev => ({ ...prev, [provider]: null }));
    
    try {
      const config = configs[provider];
      
      // 验证配置完整性
      if (!config.apiKey || !config.baseURL || !config.model) {
        throw new Error('配置信息不完整');
      }
      
      // 调用API测试连接
      const { default: apiService } = await import('../services/api');
      const isConnected = await apiService.testAIConnection(config);
      
      setConnectionStatus(prev => ({ ...prev, [provider]: isConnected }));
    } catch (error) {
      console.error('连接测试失败:', error);
      setConnectionStatus(prev => ({ ...prev, [provider]: false }));
    } finally {
      setTestingConnection(null);
    }
  };

  /**
   * 切换API密钥显示
   */
  const toggleApiKeyVisibility = (provider: AIProvider) => {
    setShowApiKey(prev => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Settings className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">AI模型配置</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* 当前提供商选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              当前使用的AI提供商
            </label>
            <div className="grid grid-cols-3 gap-4">
              {(Object.keys(providerInfo) as AIProvider[]).map((provider) => {
                const info = providerInfo[provider];
                const isSelected = currentProvider === provider;
                const isConfigured = configService.isConfigValid(provider);
                
                return (
                  <button
                    key={provider}
                    onClick={() => setCurrentProvider(provider)}
                    className={`
                      p-4 border-2 rounded-lg text-left transition-all
                      ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{info.name}</h3>
                      {isConfigured && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{info.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 配置表单 */}
          {(Object.keys(providerInfo) as AIProvider[]).map((provider) => {
            const config = configs[provider];
            const info = providerInfo[provider];
            const isVisible = currentProvider === provider;
            
            if (!isVisible || !config) return null;
            
            return (
              <div key={provider} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">
                    {info.name} 配置
                  </h3>
                  <div className="flex items-center space-x-2">
                    {connectionStatus[provider] !== null && (
                      <span className={`
                        text-sm px-2 py-1 rounded
                        ${
                          connectionStatus[provider]
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }
                      `}>
                        {connectionStatus[provider] ? '连接成功' : '连接失败'}
                      </span>
                    )}
                    <button
                      onClick={() => testConnection(provider)}
                      disabled={testingConnection === provider}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {testingConnection === provider ? '测试中...' : '测试连接'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* API密钥 */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API密钥 *
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey[provider] ? 'text' : 'password'}
                        value={config.apiKey}
                        onChange={(e) => updateConfig(provider, 'apiKey', e.target.value)}
                        placeholder="请输入API密钥"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleApiKeyVisibility(provider)}
                        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      >
                        {showApiKey[provider] ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* API地址 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API地址
                    </label>
                    <input
                      type="text"
                      value={config.baseURL}
                      onChange={(e) => updateConfig(provider, 'baseURL', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 模型名称 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      模型名称
                    </label>
                    <input
                      type="text"
                      value={config.model}
                      onChange={(e) => updateConfig(provider, 'model', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 最大Token数 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      最大Token数
                    </label>
                    <input
                      type="number"
                      value={config.maxTokens}
                      onChange={(e) => updateConfig(provider, 'maxTokens', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 温度参数 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      温度参数 (0-1)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={config.temperature}
                      onChange={(e) => updateConfig(provider, 'temperature', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 最大重试次数 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      最大重试次数
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.maxRetries}
                      onChange={(e) => updateConfig(provider, 'maxRetries', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  {/* 重试延迟(分钟) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      重试延迟(分钟)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="60"
                      value={config.retryDelay}
                      onChange={(e) => updateConfig(provider, 'retryDelay', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* 获取API密钥提示 */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-800">
                        如需获取 {info.name} API密钥，请访问：
                        <a
                          href={info.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 underline hover:text-blue-900"
                        >
                          {info.website}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={() => configService.resetConfig(currentProvider)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            重置为默认
          </button>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                saveConfig(currentProvider);
                configService.setCurrentProvider(currentProvider);
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfigModal;