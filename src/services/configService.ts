/**
 * AI配置管理服务
 * 负责管理DeepSeek、Kimi、OpenAI等AI模型的配置信息
 * 配置信息保存在浏览器localStorage中
 */

// AI提供商类型
export type AIProvider = 'deepseek' | 'kimi' | 'openai';

// AI配置接口
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  retryDelay: number;
}

// 预设配置
const DEFAULT_CONFIGS: Record<AIProvider, Omit<AIConfig, 'apiKey'>> = {
  deepseek: {
    provider: 'deepseek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    maxTokens: 4000,
    temperature: 0.7,
    maxRetries: 3,
    retryDelay: 5
  },
  kimi: {
    provider: 'kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    maxTokens: 4000,
    temperature: 0.7,
    maxRetries: 3,
    retryDelay: 5
  },
  openai: {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    maxTokens: 4000,
    temperature: 0.7,
    maxRetries: 3,
    retryDelay: 5
  }
};

class ConfigService {
  private readonly STORAGE_KEY = 'ai_config';
  private readonly CURRENT_PROVIDER_KEY = 'current_ai_provider';

  /**
   * 获取当前使用的AI提供商
   */
  getCurrentProvider(): AIProvider {
    const saved = localStorage.getItem(this.CURRENT_PROVIDER_KEY);
    return (saved as AIProvider) || 'deepseek';
  }

  /**
   * 设置当前使用的AI提供商
   */
  setCurrentProvider(provider: AIProvider): void {
    localStorage.setItem(this.CURRENT_PROVIDER_KEY, provider);
    this.notifyConfigChange();
  }

  /**
   * 获取指定提供商的配置
   */
  getConfig(provider: AIProvider): AIConfig {
    const savedConfigs = this.getAllConfigs();
    const savedConfig = savedConfigs[provider];
    
    if (savedConfig && savedConfig.apiKey) {
      return savedConfig;
    }
    
    // 返回默认配置（不包含API密钥）
    return {
      ...DEFAULT_CONFIGS[provider],
      apiKey: ''
    };
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): AIConfig {
    const currentProvider = this.getCurrentProvider();
    return this.getConfig(currentProvider);
  }

  /**
   * 保存配置
   */
  saveConfig(provider: AIProvider, config: Partial<AIConfig>): void {
    const savedConfigs = this.getAllConfigs();
    const currentConfig = this.getConfig(provider);
    
    savedConfigs[provider] = {
      ...currentConfig,
      ...config,
      provider
    };
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(savedConfigs));
    this.notifyConfigChange();
  }

  /**
   * 获取所有配置
   */
  private getAllConfigs(): Partial<Record<AIProvider, AIConfig>> {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('解析配置失败:', error);
      return {};
    }
  }

  /**
   * 检查配置是否完整
   */
  isConfigValid(provider?: AIProvider): boolean {
    const targetProvider = provider || this.getCurrentProvider();
    const config = this.getConfig(targetProvider);
    return !!(config.apiKey && config.baseURL && config.model);
  }

  /**
   * 获取所有提供商的配置状态
   */
  getConfigStatus(): Record<AIProvider, boolean> {
    return {
      deepseek: this.isConfigValid('deepseek'),
      kimi: this.isConfigValid('kimi'),
      openai: this.isConfigValid('openai')
    };
  }

  /**
   * 重置配置到默认值
   */
  resetConfig(provider: AIProvider): void {
    const savedConfigs = this.getAllConfigs();
    delete savedConfigs[provider];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(savedConfigs));
    this.notifyConfigChange();
  }

  /**
   * 清除所有配置
   */
  clearAllConfigs(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_PROVIDER_KEY);
    this.notifyConfigChange();
  }

  /**
   * 导出配置
   */
  exportConfigs(): string {
    const configs = this.getAllConfigs();
    const currentProvider = this.getCurrentProvider();
    
    // 移除敏感信息（API密钥）
    const exportData = {
      currentProvider,
      configs: Object.fromEntries(
        Object.entries(configs).map(([provider, config]) => [
          provider,
          { ...config, apiKey: '' }
        ])
      )
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入配置
   */
  importConfigs(configJson: string): void {
    try {
      const importData = JSON.parse(configJson);
      
      if (importData.configs) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(importData.configs));
      }
      
      if (importData.currentProvider) {
        this.setCurrentProvider(importData.currentProvider);
      }
      
      this.notifyConfigChange();
    } catch (error) {
      throw new Error('配置文件格式错误');
    }
  }

  /**
   * 通知配置变更
   */
  private notifyConfigChange(): void {
    window.dispatchEvent(new CustomEvent('aiConfigChanged'));
  }

  /**
   * 监听配置变更
   */
  onConfigChange(callback: () => void): () => void {
    const handler = () => callback();
    window.addEventListener('aiConfigChanged', handler);
    
    return () => {
      window.removeEventListener('aiConfigChanged', handler);
    };
  }
}

// 创建单例实例
export const configService = new ConfigService();
export default configService;