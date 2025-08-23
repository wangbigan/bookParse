// DeepSeek API提供者
import axios, { AxiosInstance } from 'axios';
import { BookInfo, ChapterContent, ChapterAnalysisResult, BookSummary, ArgumentInfo, QuoteInfo } from '../types/book.types';

export interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  retryDelay: number;
}

export class DeepSeekProvider {
  private config: DeepSeekConfig;
  private client: AxiosInstance;

  constructor(config: Partial<DeepSeekConfig> = {}) {
    this.config = {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      maxTokens: parseInt(process.env.MAX_TOKENS || '4000'),
      temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
      ...config
    };

    if (!this.config.apiKey) {
      console.warn('DeepSeek API密钥未配置，AI分析功能将不可用');
    }

    this.client = axios.create({
      baseURL: this.config.baseURL,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60秒超时
    });
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        throw new Error('API密钥未配置');
      }

      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: [{
          role: 'user',
          content: '测试连接，请回复"连接成功"'
        }],
        max_tokens: 10,
        temperature: 0
      });

      return response.status === 200;
    } catch (error) {
      console.error('DeepSeek API连接测试失败:', error);
      return false;
    }
  }

  /**
   * 分析单个章节
   */
  async analyzeChapter(
    chapter: ChapterContent,
    analysisType: 'basic' | 'detailed' | 'full' = 'full'
  ): Promise<ChapterAnalysisResult> {
    try {
      if (!this.config.apiKey) {
        throw new Error('DeepSeek API密钥未配置');
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
   * 批量分析章节
   */
  async analyzeChaptersBatch(
    chapters: ChapterContent[],
    analysisType: 'basic' | 'detailed' | 'full' = 'full'
  ): Promise<ChapterAnalysisResult[]> {
    const results: ChapterAnalysisResult[] = [];
    const batchSize = 3; // 每批处理3个章节
    
    for (let i = 0; i < chapters.length; i += batchSize) {
      const batch = chapters.slice(i, i + batchSize);
      const batchPromises = batch.map(chapter => 
        this.analyzeChapter(chapter, analysisType)
          .catch(error => {
            console.error(`章节分析失败 [${chapter.title}]:`, error);
            return this.createErrorAnalysisResult(chapter, error.message);
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 批次间延迟，避免API限流
      if (i + batchSize < chapters.length) {
        await this.delay(this.config.retryDelay);
      }
    }
    
    return results;
  }

  /**
   * 生成书籍总结
   */
  async generateBookSummary(
    bookInfo: BookInfo,
    chapterAnalysis: ChapterAnalysisResult[]
  ): Promise<BookSummary> {
    try {
      if (!this.config.apiKey) {
        throw new Error('DeepSeek API密钥未配置');
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
   * 构建章节分析提示词
   */
  private buildChapterAnalysisPrompt(
    chapter: ChapterContent,
    analysisType: 'basic' | 'detailed' | 'full'
  ): string {
    const basePrompt = `
请分析以下章节内容，并按照JSON格式返回分析结果：

章节标题：${chapter.title}
章节内容：
${chapter.content.substring(0, 3000)}${chapter.content.length > 3000 ? '...' : ''}

请提取以下信息并以JSON格式返回：
{
  "summary": "章节摘要（200字以内）",
  "keyPoints": ["关键要点1", "关键要点2", "关键要点3"],
  "arguments": [
    {
      "point": "论点描述",
      "evidence": "支撑证据",
      "strength": "strong|medium|weak"
    }
  ],
  "quotes": [
    {
      "text": "引用文本",
      "context": "引用上下文",
      "significance": "重要性说明"
    }
  ],
  "themes": ["主题1", "主题2"],
  "emotions": ["情感1", "情感2"],
  "characters": ["人物1", "人物2"],
  "locations": ["地点1", "地点2"]
}
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
   */
  private buildBookSummaryPrompt(
    bookInfo: BookInfo,
    chapterAnalysis: ChapterAnalysisResult[]
  ): string {
    const analysisOverview = chapterAnalysis.map(analysis => 
      `章节：${analysis.chapterTitle}\n摘要：${analysis.summary}\n主题：${analysis.themes.join(', ')}`
    ).join('\n\n');

    return `
请基于以下书籍信息和章节分析，生成完整的书籍总结：

书籍信息：
标题：${bookInfo.title}
作者：${bookInfo.author}
出版社：${bookInfo.publisher || '未知'}
简介：${bookInfo.description || '无'}

章节分析概览：
${analysisOverview}

请以JSON格式返回书籍总结：
{
  "overview": "书籍整体概述（300字以内）",
  "mainThemes": ["主要主题1", "主要主题2", "主要主题3"],
  "keyInsights": ["核心洞察1", "核心洞察2", "核心洞察3"],
  "structure": "书籍结构分析",
  "writingStyle": "写作风格描述",
  "targetAudience": "目标读者群体",
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["不足1", "不足2"],
  "recommendation": "推荐理由和建议",
  "rating": 8.5,
  "tags": ["标签1", "标签2", "标签3"]
}
`;
  }

  /**
   * 发送API请求
   */
  private async makeRequest(prompt: string): Promise<string> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.post('/chat/completions', {
          model: this.config.model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        });

        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw new Error('API返回内容为空');
        }

        return content;
      } catch (error) {
        lastError = error;
        console.error(`API请求失败 (尝试 ${attempt}/${this.config.maxRetries}):`, error.message);
        
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 解析章节分析响应
   */
  private parseChapterAnalysisResponse(
    response: string,
    chapter: ChapterContent
  ): ChapterAnalysisResult {
    try {
      // 提取JSON内容
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        chapterIndex: chapter.index,
        chapterTitle: chapter.title,
        summary: parsed.summary || '无摘要',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        arguments: this.parseArguments(parsed.arguments),
        quotes: this.parseQuotes(parsed.quotes),
        themes: Array.isArray(parsed.themes) ? parsed.themes : [],
        emotions: Array.isArray(parsed.emotions) ? parsed.emotions : [],
        characters: Array.isArray(parsed.characters) ? parsed.characters : [],
        locations: Array.isArray(parsed.locations) ? parsed.locations : [],
        wordCount: chapter.wordCount,
        analysisDate: new Date()
      };
    } catch (error) {
      console.error('解析章节分析响应失败:', error);
      return this.createErrorAnalysisResult(chapter, '解析响应失败');
    }
  }

  /**
   * 解析书籍总结响应
   */
  private parseBookSummaryResponse(
    response: string,
    bookInfo: BookInfo
  ): BookSummary {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        overview: parsed.overview || '无概述',
        mainThemes: Array.isArray(parsed.mainThemes) ? parsed.mainThemes : [],
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        structure: parsed.structure || '无结构分析',
        writingStyle: parsed.writingStyle || '无风格描述',
        targetAudience: parsed.targetAudience || '无目标读者描述',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendation: parsed.recommendation || '无推荐',
        rating: typeof parsed.rating === 'number' ? parsed.rating : 0,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        generatedDate: new Date()
      };
    } catch (error) {
      console.error('解析书籍总结响应失败:', error);
      return {
        overview: '总结生成失败',
        mainThemes: [],
        keyInsights: [],
        structure: '无',
        writingStyle: '无',
        targetAudience: '无',
        strengths: [],
        weaknesses: [],
        recommendation: '无',
        rating: 0,
        tags: [],
        generatedDate: new Date()
      };
    }
  }

  /**
   * 解析论据信息
   */
  private parseArguments(argumentsData: any[]): ArgumentInfo[] {
    if (!Array.isArray(argumentsData)) return [];
    
    return argumentsData.map(arg => ({
      point: arg.point || '无论点',
      evidence: arg.evidence || '无证据',
      strength: ['strong', 'medium', 'weak'].includes(arg.strength) ? arg.strength : 'medium'
    }));
  }

  /**
   * 解析引用信息
   */
  private parseQuotes(quotes: any[]): QuoteInfo[] {
    if (!Array.isArray(quotes)) return [];
    
    return quotes.map(quote => ({
      text: quote.text || '无引用文本',
      context: quote.context || '无上下文',
      significance: quote.significance || '无重要性说明'
    }));
  }

  /**
   * 创建错误分析结果
   */
  private createErrorAnalysisResult(
    chapter: ChapterContent,
    errorMessage: string
  ): ChapterAnalysisResult {
    return {
      chapterIndex: chapter.index,
      chapterTitle: chapter.title,
      summary: `分析失败: ${errorMessage}`,
      keyPoints: [],
      arguments: [],
      quotes: [],
      themes: [],
      emotions: [],
      characters: [],
      locations: [],
      wordCount: chapter.wordCount,
      analysisDate: new Date()
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取配置信息
   */
  getConfig(): DeepSeekConfig {
    return { ...this.config };
  }

  /**
   * 检查API密钥是否已配置
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }
}