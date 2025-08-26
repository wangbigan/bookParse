/**
 * 通用AI提供者
 * 支持DeepSeek、Kimi、OpenAI等多种AI模型的统一接口
 * 支持动态配置，无需重启服务
 */
import axios, { AxiosInstance } from 'axios';
import { BookInfo, ChapterContent, ChapterAnalysisResult, BookSummary } from '../types/book.types';

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
    retryDelay: 1000
  },
  kimi: {
    provider: 'kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    maxTokens: 4000,
    temperature: 0.7,
    maxRetries: 3,
    retryDelay: 1000
  },
  openai: {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    maxTokens: 4000,
    temperature: 0.7,
    maxRetries: 3,
    retryDelay: 1000
  }
};

export class UniversalAIProvider {
  private config: AIConfig;
  private client: AxiosInstance;

  /**
   * 构造函数
   * @param config AI配置
   */
  constructor(config: AIConfig) {
    this.config = config;
    this.initializeClient();
  }

  /**
   * 初始化HTTP客户端
   */
  private initializeClient(): void {
    this.client = axios.create({
      baseURL: this.config.baseURL,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3分钟超时
    });
  }

  /**
   * 创建AI提供者实例
   * @param config AI配置
   * @returns AI提供者实例
   */
  static create(config: AIConfig): UniversalAIProvider {
    return new UniversalAIProvider(config);
  }

  /**
   * 从请求头解析AI配置
   * @param headers 请求头
   * @returns AI配置或null
   */
  static parseConfigFromHeaders(headers: any): AIConfig | null {
    try {
      const configHeader = headers['x-ai-config'];
      if (!configHeader) {
        return null;
      }

      const config = JSON.parse(Buffer.from(configHeader, 'base64').toString('utf-8'));
      
      // 验证配置完整性
      if (!config.provider || !config.apiKey || !config.baseURL || !config.model) {
        console.warn('AI配置不完整:', config);
        return null;
      }

      return config;
    } catch (error) {
      console.error('解析AI配置失败:', error);
      return null;
    }
  }

  /**
   * 获取默认配置
   * @param provider AI提供商
   * @returns 默认配置
   */
  static getDefaultConfig(provider: AIProvider): Omit<AIConfig, 'apiKey'> {
    return DEFAULT_CONFIGS[provider];
  }

  /**
   * 测试API连接
   * @returns 连接是否成功
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        throw new Error('API密钥未配置');
      }

      const endpoint = this.getEndpoint();
      const testPayload = this.buildTestPayload();

      const response = await this.client.post(endpoint, testPayload);
      return response.status === 200;
    } catch (error) {
      console.error(`${this.config.provider} API连接测试失败:`, error);
      return false;
    }
  }

  /**
   * 分析单个章节
   * @param chapter 章节内容
   * @param analysisType 分析类型
   * @returns 章节分析结果
   */
  async analyzeChapter(
    chapter: ChapterContent,
    analysisType: 'basic' | 'detailed' | 'full' = 'full'
  ): Promise<ChapterAnalysisResult> {
    try {
      if (!this.config.apiKey) {
        throw new Error(`${this.config.provider} API密钥未配置`);
      }

      const prompt = this.buildChapterAnalysisPrompt(chapter, analysisType);
      const response = await this.makeRequest(prompt);
      
      return this.parseChapterAnalysisResponse(response, chapter);
    } catch (error) {
      console.error(`章节分析失败 [${chapter.title}]:`, error);
      throw new Error(`章节分析失败: ${error.message}`);
    }
  }

  /**
   * 生成书籍总结
   * @param bookInfo 书籍信息
   * @param chapterAnalysis 章节分析结果
   * @returns 书籍总结
   */
  async generateBookSummary(
    bookInfo: BookInfo,
    chapterAnalysis: ChapterAnalysisResult[]
  ): Promise<BookSummary> {
    try {
      if (!this.config.apiKey) {
        throw new Error(`${this.config.provider} API密钥未配置`);
      }

      const prompt = this.buildBookSummaryPrompt(bookInfo, chapterAnalysis);
      const response = await this.makeRequest(prompt);
      
      return this.parseBookSummaryResponse(response, bookInfo);
    } catch (error) {
      console.error('书籍总结生成失败:', error);
      throw new Error(`书籍总结生成失败: ${error.message}`);
    }
  }

  /**
   * 获取API端点
   * @returns API端点路径
   */
  private getEndpoint(): string {
    switch (this.config.provider) {
      case 'deepseek':
        return '/chat/completions';
      case 'kimi':
        return '/chat/completions';
      case 'openai':
        return '/chat/completions';
      default:
        return '/chat/completions';
    }
  }

  /**
   * 构建测试请求载荷
   * @returns 测试请求载荷
   */
  private buildTestPayload(): any {
    return {
      model: this.config.model,
      messages: [{
        role: 'user',
        content: '测试连接，请回复"连接成功"'
      }],
      max_tokens: 10,
      temperature: 0
    };
  }

  /**
   * 构建章节分析提示词
   * @param chapter 章节内容
   * @param analysisType 分析类型
   * @returns 提示词
   */
  private buildChapterAnalysisPrompt(chapter: ChapterContent, analysisType: string): string {
    const basePrompt = `
请分析以下章节内容，并按照JSON格式返回分析结果：

章节标题：${chapter.title}
章节内容：
${chapter.content}

请返回以下JSON格式的分析结果：
{
  "chapter_title": "${chapter.title}",
  "chapter_viewpoint": "<章节核心观点总结，100-200字>",
  "chapter_keywords": ["关键词1", "关键词2", "关键词3"],
  "arguments": [
    {
      "point": "<论点描述>",
      "evidence": "<支持证据>",
      "strength": "strong|medium|weak",
      "positive_case": [
        {
          "description": "<正面案例描述>",
          "source": "<案例来源>",
          "impact": "<案例影响>"
        }
      ],
      "negative_case": [
        {
          "description": "<反面案例描述>",
          "source": "<案例来源>",
          "lesson": "<经验教训>"
        }
      ],
      "citations": [
        {
          "source": "<引用来源，如书籍、文章、研究等>",
          "viewpoint": "<简要概述所引用的书籍、文章、故事的内容，并总结其所要传达的观点>"
        }
      ]
    }
  ]
}

注意事项：
1. 必须返回有效的JSON格式
2. chapter_keywords应包含作者在本章中提出或引用的重要概念
3. arguments包含作者针对本章核心观点提出的主要论据
4. positive_case和negative_case可以为空数组，但必须存在
5. citations如果没有外部引用可以为空数组
6. 所有字符串值都要用双引号包围
7. 不要在JSON中使用注释或其他非标准格式
`;

    if (analysisType === 'basic') {
      return basePrompt + '\n注意：请提供基础分析，重点关注摘要和关键要点。';
    } else if (analysisType === 'detailed') {
      return basePrompt + '\n注意：请提供详细分析，包含完整的论点和引用。';
    } else {
      return basePrompt + '\n注意：请提供全面深入的分析，包含所有要求的元素。';
    }
  }

  /**
   * 构建书籍总结提示词
   * @param bookInfo 书籍信息
   * @param chapterAnalysis 章节分析结果
   * @returns 提示词
   */
  private buildBookSummaryPrompt(bookInfo: BookInfo, chapterAnalysis: ChapterAnalysisResult[]): string {
    const chaptersInfo = chapterAnalysis.map(analysis => 
      `章节：${analysis.chapterTitle}\n摘要：${analysis.summary}\n关键点：${analysis.keyPoints.join(', ')}`
    ).join('\n\n');

    return `
请基于以下书籍信息和章节分析，生成完整的书籍总结：

书籍信息：
标题：${bookInfo.title}
作者：${bookInfo.author}
出版社：${bookInfo.publisher || '未知'}

章节分析：
${chaptersInfo}

请返回以下JSON格式的书籍总结：
{
  "title": "${bookInfo.title}",
  "author": "${bookInfo.author}",
  "overallTheme": "<书籍整体主题，50-100字>",
  "coreMessage": "<核心信息，100-200字>",
  "keyInsights": ["洞察1", "洞察2", "洞察3"],
  "practicalApplications": ["应用1", "应用2", "应用3"],
  "targetAudience": "<目标读者群体>",
  "readingValue": "<阅读价值评估>",
  "recommendationReason": "<推荐理由>"
}

注意：请确保返回有效的JSON格式，所有字符串值用双引号包围。
`;
  }

  /**
   * 发送API请求
   * @param prompt 提示词
   * @returns API响应内容
   */
  private async makeRequest(prompt: string): Promise<string> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    let lastError: Error;
    
    console.log(`\n🚀 [${requestId}] ${this.config.provider} API 请求开始`);
    console.log(`📝 [${requestId}] 请求参数:`, {
      provider: this.config.provider,
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      prompt_length: prompt.length,
      timestamp: new Date().toISOString()
    });
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        console.log(`🔄 [${requestId}] 第 ${attempt} 次尝试开始`);
        
        const endpoint = this.getEndpoint();
        const requestPayload = {
          model: this.config.model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        };
        
        const response = await this.client.post(endpoint, requestPayload);
        const attemptDuration = Date.now() - attemptStartTime;
        
        console.log(`📊 [${requestId}] API响应状态:`, {
          status: response.status,
          statusText: response.statusText,
          attempt: attempt,
          duration_ms: attemptDuration
        });
        
        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw new Error('API返回内容为空');
        }
        
        const totalDuration = Date.now() - startTime;
        
        console.log(`✅ [${requestId}] API请求成功完成`);
        console.log(`📈 [${requestId}] 响应统计:`, {
          response_length: content.length,
          total_duration_ms: totalDuration,
          attempts_used: attempt,
          tokens_used: response.data.usage?.total_tokens || 'unknown',
          prompt_tokens: response.data.usage?.prompt_tokens || 'unknown',
          completion_tokens: response.data.usage?.completion_tokens || 'unknown'
        });
        
        return content;
      } catch (error) {
        lastError = error;
        const attemptDuration = Date.now() - attemptStartTime;
        
        console.error(`❌ [${requestId}] API请求失败 (尝试 ${attempt}/${this.config.maxRetries}):`);
        console.error(`🔍 [${requestId}] 错误详情:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          attempt: attempt,
          duration_ms: attemptDuration
        });
        
        if (attempt < this.config.maxRetries) {
          console.log(`⏳ [${requestId}] 等待 ${this.config.retryDelay}ms 后重试...`);
          await this.delay(this.config.retryDelay);
        }
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.error(`💥 [${requestId}] 所有重试均失败，总耗时: ${totalDuration}ms`);
    throw lastError;
  }

  /**
   * 生成请求ID
   * @returns 请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 解析章节分析响应
   * @param response API响应
   * @param chapter 章节内容
   * @returns 章节分析结果
   */
  private parseChapterAnalysisResponse(
    response: string,
    chapter: ChapterContent
  ): ChapterAnalysisResult {
    try {
      // 提取JSON内容
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('响应中未找到有效的JSON格式，原始响应:', response);
        throw new Error('响应中未找到有效的JSON格式');
      }
      
      let jsonString = jsonMatch[0];
      console.log('提取的JSON字符串:', jsonString);
      
      // JSON字符串清理和修复
      jsonString = this.cleanJsonString(jsonString);
      
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('标准JSON解析失败，尝试备用解析策略:', parseError.message);
        parsed = this.fallbackJsonParse(jsonString);
      }
      
      // 解析新的JSON结构
      return {
        chapterIndex: chapter.index,
        chapterTitle: parsed.chapter_title || chapter.title,
        summary: parsed.chapter_viewpoint || '无章节观点总结',
        keyPoints: Array.isArray(parsed.chapter_keywords) ? parsed.chapter_keywords : [],
        arguments: this.parseNewArguments(parsed.arguments),
        quotes: [], // 新格式中引用信息在arguments的citations中
        themes: [],
        emotions: [],
        characters: [],
        locations: [],
        wordCount: chapter.wordCount || 0,
        analysisDate: new Date()
      };
    } catch (error) {
      console.error('解析章节分析响应失败:', error);
      
      // 返回基础结构，避免程序崩溃
      return {
        chapterIndex: chapter.index,
        chapterTitle: chapter.title,
        summary: '解析失败，无法生成摘要',
        keyPoints: [],
        arguments: [],
        quotes: [],
        themes: [],
        emotions: [],
        characters: [],
        locations: [],
        wordCount: chapter.wordCount || 0,
        analysisDate: new Date()
      };
    }
  }

  /**
   * 解析书籍总结响应
   * @param response API响应
   * @param bookInfo 书籍信息
   * @returns 书籍总结
   */
  private parseBookSummaryResponse(response: string, bookInfo: BookInfo): BookSummary {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        overview: parsed.coreMessage || '无核心信息',
        mainThemes: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        keyInsights: Array.isArray(parsed.practicalApplications) ? parsed.practicalApplications : [],
        structure: '未分析',
        writingStyle: '未分析',
        targetAudience: parsed.targetAudience || '未知',
        strengths: [],
        weaknesses: [],
        recommendation: parsed.recommendationReason || '无推荐理由',
        rating: 0,
        tags: [],
        generatedDate: new Date()
      };
    } catch (error) {
      console.error('解析书籍总结响应失败:', error);
      
      return {
        overview: '解析失败，无法生成核心信息',
        mainThemes: [],
        keyInsights: [],
        structure: '未分析',
        writingStyle: '未分析',
        targetAudience: '未知',
        strengths: [],
        weaknesses: [],
        recommendation: '解析失败',
        rating: 0,
        tags: [],
        generatedDate: new Date()
      };
    }
  }

  /**
   * 清理JSON字符串
   * @param jsonString 原始JSON字符串
   * @returns 清理后的JSON字符串
   */
  private cleanJsonString(jsonString: string): string {
    return jsonString
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '"')
      .replace(/'/g, "'");
  }

  /**
   * 备用JSON解析
   * @param jsonString JSON字符串
   * @returns 解析结果
   */
  private fallbackJsonParse(jsonString: string): any {
    try {
      // 尝试修复常见的JSON格式问题
      let fixedJson = jsonString
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      
      return JSON.parse(fixedJson);
    } catch (error) {
      console.error('备用JSON解析也失败:', error);
      throw new Error('JSON解析完全失败');
    }
  }

  /**
   * 解析新格式的论据
   * @param argumentsArray 论据数组
   * @returns 解析后的论据
   */
  private parseNewArguments(argumentsArray: any[]): any[] {
    if (!Array.isArray(argumentsArray)) return [];
    
    return argumentsArray.map(arg => ({
      point: arg.point || '无论点',
      evidence: arg.evidence || '无证据',
      strength: arg.strength || 'medium',
      positiveCase: Array.isArray(arg.positive_case) ? arg.positive_case : [],
      negativeCase: Array.isArray(arg.negative_case) ? arg.negative_case : [],
      citations: Array.isArray(arg.citations) ? arg.citations : []
    }));
  }

  /**
   * 延迟函数
   * @param ms 延迟毫秒数
   * @returns Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取配置信息
   * @returns AI配置
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * 检查API密钥是否已配置
   * @returns 是否已配置
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }
}

export default UniversalAIProvider;