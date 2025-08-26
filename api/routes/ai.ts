/**
 * AI相关路由
 * 处理AI配置测试、连接验证等功能
 */
import { Router, Request, Response } from 'express';
import { UniversalAIProvider, AIConfig } from '../ai/universal-provider';

const router = Router();

/**
 * 测试AI连接
 * POST /api/ai/test-connection
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const config: AIConfig = req.body;
    
    // 验证配置完整性
    if (!config.provider || !config.apiKey || !config.baseURL || !config.model) {
      return res.status(400).json({
        success: false,
        message: 'AI配置不完整，请检查必填字段'
      });
    }

    console.log(`🔍 测试 ${config.provider} AI连接...`);
    
    // 创建AI提供者实例并测试连接
    const aiProvider = UniversalAIProvider.create(config);
    const isConnected = await aiProvider.testConnection();
    
    if (isConnected) {
      console.log(`✅ ${config.provider} AI连接测试成功`);
      res.json({
        success: true,
        message: `${config.provider} AI连接测试成功`,
        data: {
          provider: config.provider,
          model: config.model,
          connected: true
        }
      });
    } else {
      console.log(`❌ ${config.provider} AI连接测试失败`);
      res.status(400).json({
        success: false,
        message: `${config.provider} AI连接测试失败，请检查配置信息`,
        data: {
          provider: config.provider,
          model: config.model,
          connected: false
        }
      });
    }
  } catch (error) {
    console.error('AI连接测试错误:', error);
    res.status(500).json({
      success: false,
      message: `AI连接测试失败: ${error.message}`
    });
  }
});

/**
 * 获取AI提供商默认配置
 * GET /api/ai/default-config/:provider
 */
router.get('/default-config/:provider', (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    
    if (!['deepseek', 'kimi', 'openai'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: '不支持的AI提供商'
      });
    }
    
    const defaultConfig = UniversalAIProvider.getDefaultConfig(provider as any);
    
    res.json({
      success: true,
      message: '获取默认配置成功',
      data: defaultConfig
    });
  } catch (error) {
    console.error('获取默认配置错误:', error);
    res.status(500).json({
      success: false,
      message: `获取默认配置失败: ${error.message}`
    });
  }
});

/**
 * 验证AI配置格式
 * POST /api/ai/validate-config
 */
router.post('/validate-config', (req: Request, res: Response) => {
  try {
    const config = req.body;
    
    // 基础字段验证
    const requiredFields = ['provider', 'apiKey', 'baseURL', 'model'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `缺少必填字段: ${missingFields.join(', ')}`,
        data: {
          valid: false,
          missingFields
        }
      });
    }
    
    // 提供商验证
    if (!['deepseek', 'kimi', 'openai'].includes(config.provider)) {
      return res.status(400).json({
        success: false,
        message: '不支持的AI提供商',
        data: {
          valid: false,
          error: 'invalid_provider'
        }
      });
    }
    
    // URL格式验证
    try {
      new URL(config.baseURL);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'API地址格式不正确',
        data: {
          valid: false,
          error: 'invalid_url'
        }
      });
    }
    
    // 数值范围验证
    if (config.maxTokens && (config.maxTokens < 1 || config.maxTokens > 32000)) {
      return res.status(400).json({
        success: false,
        message: 'maxTokens应在1-32000之间',
        data: {
          valid: false,
          error: 'invalid_max_tokens'
        }
      });
    }
    
    if (config.temperature && (config.temperature < 0 || config.temperature > 1)) {
      return res.status(400).json({
        success: false,
        message: 'temperature应在0-1之间',
        data: {
          valid: false,
          error: 'invalid_temperature'
        }
      });
    }
    
    res.json({
      success: true,
      message: '配置验证通过',
      data: {
        valid: true,
        provider: config.provider,
        model: config.model
      }
    });
  } catch (error) {
    console.error('配置验证错误:', error);
    res.status(500).json({
      success: false,
      message: `配置验证失败: ${error.message}`
    });
  }
});

export default router;