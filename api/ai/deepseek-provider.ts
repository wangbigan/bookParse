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
      maxRetries: parseInt(process.env.MAX_RETRIES || '1'),
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
      timeout: 180000 // 3分钟超时
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
请分析以下章节内容，并严格按照指定的JSON格式返回分析结果：

章节标题：${chapter.title}
章节内容：
${chapter.content}

请提取以下信息并严格按照以下JSON格式返回（必须是有效的JSON格式，不要添加任何其他文字）：
{
  "chapter_title": <本章标题>,
  "chapter_viewpoint": <本章内容总结，核心观点概述>,
  "chapter_keywords": <本章核心关键词列表,作者在本章中提出或者引用的重要概念或者关键词，list类型>
  "arguments": <针对本章内容和核心观点，作者提出的主要论据信息，可能有多个>
  [
    {
      "statement": <论据概述，string类型>,
      "positive_case": <支撑该论据的正面案例，list类型，可能是一个或者多个，也可能没有>,
      "negative_case": <支撑该论据的反面案例，list类型，可能是一个或者多个，也可能没有>,
      "citations": <围绕该论据，作者提到的重要的外部引用，可以是书籍、文章，也可以是权威人士的观点。如果没有可以为空>
      [
        {
          "cited_source": <引用来源：书籍名、文章名或者权威人士姓名>,
          "cited_type": <引用类型：书籍/文章/故事/权威观点>,
          "viewpoint": <简要概述所引用的书籍、文章、故事的内容，并总结其所要传达的观点>
        }
      ]
    }
  ]
}

注意事项：
1. 必须返回有效的JSON格式，json字段值内容如有双引号，需要用反斜杠转义
2. chapter_keywords应包含作者在本章中提出或引用的重要概念
3. arguments包含作者针对本章核心观点提出的主要论据、案例以及引用
4. positive_case和negative_case可以为空数组，但必须存在
5. citations如果没有外部引用可以为空数组
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
   */
  private buildBookSummaryPrompt(
    bookInfo: BookInfo,
    chapterAnalysis: ChapterAnalysisResult[]
  ): string {
    const analysisOverview = chapterAnalysis.map(analysis => 
      `章节：${analysis.chapterTitle}\n摘要：${analysis.summary}`
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

请以JSON格式返回书籍总结（严格按照json_template.txt中book_summary的结构）：
{
  "book_intro": "书籍整体概述，300字左右，string类型",
  "author_intro": "作者简介，string类型",
  "structure": "书籍结构分析，string类型",
  "core_problem": "这本书作者想要解决的核心问题，string类型",
  "keyInsights": ["核心洞察1", "核心洞察2", "核心洞察3"],
  "core_keywords": {
    "关键词1": "含义解释1",
    "关键词2": "含义解释2",
    "关键词3": "含义解释3"
  },
  "tags": ["标签1", "标签2", "标签3", "标签4", "标签5", "标签6", "标签7", "标签8", "标签9", "标签10"]
}

注意事项：
1. 必须返回有效的JSON格式，json字段值内容如有双引号，需要用反斜杠转义
2. keyInsights是作者在书中提出的核心洞察或独特观点的数组
3. core_keywords是关键词字典，包含作者在书中提出的核心概念及其含义
4. tags是给这本书贴的10个最合适的标签
5. book_intro应该是300字左右的书籍整体概述
`;
  }

  /**
   * 发送API请求
   */
  private async makeRequest(prompt: string): Promise<string> {
    // 生成请求ID用于追踪
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    let lastError: Error;
    
    // 记录请求开始日志
    console.log(`\n🚀 [${requestId}] DeepSeek API 请求开始`);
    console.log(`📝 [${requestId}] 请求参数:`, {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      prompt_length: prompt.length,
      timestamp: new Date().toISOString()
    });
    console.log(`📄 [${requestId}] 输入内容 (前500字符):`, prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''));
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        console.log(`🔄 [${requestId}] 第 ${attempt} 次尝试开始`);
        
        const requestPayload = {
          model: this.config.model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        };
        
        const response = await this.client.post('/chat/completions', requestPayload);
        const attemptDuration = Date.now() - attemptStartTime;
        
        // 记录响应信息
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
        
        // 记录成功响应日志
        console.log(`✅ [${requestId}] API请求成功完成`);
        console.log(`📈 [${requestId}] 响应统计:`, {
          response_length: content.length,
          total_duration_ms: totalDuration,
          attempts_used: attempt,
          tokens_used: response.data.usage?.total_tokens || 'unknown',
          prompt_tokens: response.data.usage?.prompt_tokens || 'unknown',
          completion_tokens: response.data.usage?.completion_tokens || 'unknown'
        });
        console.log(`📄 [${requestId}] 响应内容 :`, content.substring);
        
        return content;
      } catch (error) {
        lastError = error;
        const attemptDuration = Date.now() - attemptStartTime;
        
        // 记录错误日志
        console.error(`❌ [${requestId}] API请求失败 (尝试 ${attempt}/${this.config.maxRetries}):`);
        console.error(`🔍 [${requestId}] 错误详情:`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          attempt: attempt,
          duration_ms: attemptDuration,
          error_type: error.constructor.name
        });
        
        if (error.response?.data) {
          console.error(`📋 [${requestId}] API错误响应:`, error.response.data);
        }
        
        // 不进行重试，直接跳出循环
        break;
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.error(`💥 [${requestId}] 所有重试尝试均失败，总耗时: ${totalDuration}ms`);
    
    throw lastError;
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        console.error('响应中未找到有效的JSON格式，原始响应:', response);
        throw new Error('响应中未找到有效的JSON格式');
      }
      
      let jsonString = jsonMatch[0];
      console.log('提取的JSON字符串:', jsonString);
      
      // JSON字符串清理和修复
      jsonString = this.cleanJsonString(jsonString);
      
      let parsed;
      try {
        // 尝试标准JSON解析
        parsed = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('标准JSON解析失败，尝试备用解析策略:', parseError.message);
        console.error('问题JSON字符串:', jsonString);
        
        // 备用解析策略
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
        themes: [], // 保持兼容性，但新格式中不直接包含
        emotions: [], // 保持兼容性，但新格式中不直接包含
        characters: [], // 保持兼容性，但新格式中不直接包含
        locations: [], // 保持兼容性，但新格式中不直接包含
        wordCount: chapter.wordCount,
        analysisDate: new Date()
      };
    } catch (error) {
      console.error('解析章节分析响应失败:', error);
      console.error('章节信息:', { index: chapter.index, title: chapter.title });
      console.error('原始响应:', response);
      return this.createErrorAnalysisResult(chapter, `解析响应失败: ${error.message}`);
    }
  }

  /**
   * 清理JSON字符串，修复常见的格式问题
   */
  private cleanJsonString(jsonString: string): string {
    // 移除可能的BOM标记
    if (jsonString.charCodeAt(0) === 0xFEFF) {
      jsonString = jsonString.slice(1);
    }
    
    // 移除可能的前后空白字符
    jsonString = jsonString.trim();
    
    // 确保字符串以{开头，以}结尾
    if (!jsonString.startsWith('{')) {
      const startIndex = jsonString.indexOf('{');
      if (startIndex > 0) {
        jsonString = jsonString.substring(startIndex);
      }
    }
    
    if (!jsonString.endsWith('}')) {
      const endIndex = jsonString.lastIndexOf('}');
      if (endIndex > 0) {
        jsonString = jsonString.substring(0, endIndex + 1);
      }
    }
    
    // 修复常见的JSON格式问题
    jsonString = jsonString
      // 修复尾随逗号
      .replace(/,\s*([}\]])/g, '$1')
      // 修复多余的逗号
      .replace(/,,+/g, ',')
      // 处理换行符 - 不要转义，而是直接移除或替换为空格
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      // 清理多余的空格
      .replace(/\s+/g, ' ');
    
    console.log('清理后的JSON字符串:', jsonString.substring(0, 200) + '...');
    return jsonString;
  }

  /**
   * 备用JSON解析策略
   */
  private fallbackJsonParse(jsonString: string): any {
    try {
      // 尝试使用eval（仅在受控环境下）
      // 注意：这是最后的备用方案，存在安全风险
      const sanitized = jsonString
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/:\s*([^"\[\{][^,}\]]*)/g, (match, value) => {
          const trimmed = value.trim();
          if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null' || /^\d+(\.\d+)?$/.test(trimmed)) {
            return ': ' + trimmed;
          }
          return ': "' + trimmed.replace(/"/g, '\\"') + '"';
        });
      
      return JSON.parse(sanitized);
    } catch (error) {
      console.error('备用解析策略也失败了:', error.message);
      // 返回基本的默认结构
      return {
        summary: '解析失败，无法获取摘要',
        keyPoints: [],
        arguments: [],
        quotes: [],
        themes: [],
        emotions: [],
        characters: [],
        locations: []
      };
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
      console.log('开始解析书籍总结响应...');
      console.log('原始响应长度:', response.length);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }
      
      console.log('提取的JSON字符串长度:', jsonMatch[0].length);
      console.log('提取的JSON字符串前200字符:', jsonMatch[0].substring(0, 200));
      
      // 使用cleanJsonString方法清理JSON格式
      const cleanedJson = this.cleanJsonString(jsonMatch[0]);
      console.log('清理后的JSON字符串前200字符:', cleanedJson.substring(0, 200));
      
      let parsed;
      try {
        // 首先尝试直接解析清理后的JSON
        parsed = JSON.parse(cleanedJson);
        console.log('JSON解析成功');
      } catch (parseError) {
        console.warn('直接解析失败，尝试备用解析策略:', parseError.message);
        // 使用备用解析策略
        parsed = this.fallbackJsonParse(cleanedJson);
        console.log('备用解析策略完成');
      }
      
      console.log('解析结果字段:', Object.keys(parsed));
      
      const bookSummary = {
        // 新的book_summary结构字段
        book_intro: parsed.book_intro || parsed.overview || '无书籍概述',
        author_intro: parsed.author_intro || '无作者简介',
        structure: parsed.structure || '无结构分析',
        core_problem: parsed.core_problem || '无核心问题',
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        core_keywords: (typeof parsed.core_keywords === 'object' && parsed.core_keywords !== null) ? parsed.core_keywords : {},
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        generatedDate: new Date(),
        
        // 保留原有字段以兼容现有代码
        overview: parsed.book_intro || parsed.overview || '无概述',
        mainThemes: Array.isArray(parsed.mainThemes) ? parsed.mainThemes : [],
        writingStyle: parsed.writingStyle || '无风格描述',
        targetAudience: parsed.targetAudience || '无目标读者描述',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendation: parsed.recommendation || '无推荐',
        rating: typeof parsed.rating === 'number' ? parsed.rating : 0
      };
      
      console.log('书籍总结解析完成，主题数量:', bookSummary.mainThemes.length);
      console.log('书籍总结解析完成，洞察数量:', bookSummary.keyInsights.length);
      
      return bookSummary;
    } catch (error) {
      console.error('解析书籍总结响应失败:', error);
      console.error('错误堆栈:', error.stack);
      
      // 返回默认的书籍总结结构
      return {
        // 新的book_summary结构字段
        book_intro: '总结生成失败: ' + error.message,
        author_intro: '无作者简介',
        structure: '无结构分析',
        core_problem: '无核心问题',
        keyInsights: [],
        core_keywords: {},
        tags: [],
        generatedDate: new Date(),
        
        // 保留原有字段以兼容现有代码
        overview: '总结生成失败: ' + error.message,
        mainThemes: [],
        writingStyle: '无',
        targetAudience: '无',
        strengths: [],
        weaknesses: [],
        recommendation: '无',
        rating: 0
      };
    }
  }

  /**
   * 解析新格式的论据信息
   */
  private parseNewArguments(argumentsData: any[]): ArgumentInfo[] {
    if (!Array.isArray(argumentsData)) return [];
    
    return argumentsData.map(arg => {
      // 将新格式转换为旧格式以保持兼容性
      const positiveCases = Array.isArray(arg.positive_case) ? arg.positive_case.join('; ') : '';
      const negativeCases = Array.isArray(arg.negative_case) ? arg.negative_case.join('; ') : '';
      const citations = Array.isArray(arg.citations) ? 
        arg.citations.map(citation => 
          `${citation.cited_source || ''}(${citation.cited_type || ''}): ${citation.viewpoint || ''}`
        ).join('; ') : '';
      
      let evidence = '';
      if (positiveCases) evidence += `正面案例: ${positiveCases}`;
      if (negativeCases) {
        if (evidence) evidence += '; ';
        evidence += `反面案例: ${negativeCases}`;
      }
      if (citations) {
        if (evidence) evidence += '; ';
        evidence += `引用: ${citations}`;
      }
      
      return {
        point: arg.statement || '无论据',
        evidence: evidence || '无证据',
        strength: 'medium' as const // 新格式中没有strength字段，默认为medium
      };
    });
  }

  /**
   * 解析论据信息（保留旧方法以兼容）
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