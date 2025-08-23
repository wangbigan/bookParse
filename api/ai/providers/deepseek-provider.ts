// DeepSeek API提供者
import axios, { AxiosInstance } from 'axios';
import { Chapter, BookSummary, BookInfo, ChapterContent } from '../../types/book.types';

export interface DeepSeekConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AnalysisResult {
  success: boolean;
  data?: any;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class DeepSeekProvider {
  private client: AxiosInstance;
  private config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = {
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      maxTokens: 4000,
      temperature: 0.7,
      ...config
    };

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
   * 分析单个章节
   */
  async analyzeChapter(chapterContent: ChapterContent): Promise<AnalysisResult> {
    try {
      const prompt = this.buildChapterAnalysisPrompt(chapterContent);
      
      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的图书内容分析师，擅长深度分析书籍章节内容，提取核心观点、关键词和论据。请严格按照JSON格式返回分析结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' }
      });

      const result = response.data.choices[0].message.content;
      const parsedResult = JSON.parse(result);

      return {
        success: true,
        data: parsedResult,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('章节分析错误:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * 批量分析章节
   */
  async analyzeChapters(chapters: ChapterContent[]): Promise<Chapter[]> {
    const results: Chapter[] = [];
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      console.log(`正在分析第 ${i + 1}/${chapters.length} 章: ${chapter.title}`);
      
      try {
        const analysisResult = await this.analyzeChapter(chapter);
        
        if (analysisResult.success && analysisResult.data) {
          results.push({
            chapter_title: chapter.title,
            chapter_viewpoint: analysisResult.data.chapter_viewpoint || '',
            chapter_keywords: analysisResult.data.chapter_keywords || [],
            arguments: analysisResult.data.arguments || []
          });
        } else {
          // 分析失败时添加默认结果
          results.push({
            chapter_title: chapter.title,
            chapter_viewpoint: '分析失败，请重试',
            chapter_keywords: [],
            arguments: []
          });
        }
        
        // 添加延迟避免API限流
        if (i < chapters.length - 1) {
          await this.delay(1000); // 1秒延迟
        }
      } catch (error) {
        console.error(`章节分析失败 [${chapter.title}]:`, error);
        results.push({
          chapter_title: chapter.title,
          chapter_viewpoint: '分析失败，请重试',
          chapter_keywords: [],
          arguments: []
        });
      }
    }
    
    return results;
  }

  /**
   * 生成书籍总结
   */
  async generateBookSummary(bookInfo: BookInfo, chapters: Chapter[]): Promise<AnalysisResult> {
    try {
      const prompt = this.buildBookSummaryPrompt(bookInfo, chapters);
      
      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的图书评论家和内容总结专家，擅长从整体角度分析书籍，提炼核心思想和关键概念。请严格按照JSON格式返回总结结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' }
      });

      const result = response.data.choices[0].message.content;
      const parsedResult = JSON.parse(result);

      return {
        success: true,
        data: parsedResult,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('书籍总结错误:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  private buildChapterAnalysisPrompt(chapterContent: ChapterContent): string {
    return `请分析以下章节内容，并按照指定的JSON格式返回分析结果：

章节标题：${chapterContent.title}

章节内容：
${chapterContent.content.substring(0, 3000)}${chapterContent.content.length > 3000 ? '...' : ''}

请返回以下JSON格式的分析结果：
{
  "chapter_viewpoint": "本章内容总结，核心观点概述，要求全面深入，表达简单深刻，文笔生动有趣，能调动起读者的情绪和兴趣",
  "chapter_keywords": ["关键词1", "关键词2", "关键词3"],
  "arguments": [
    {
      "statement": "论据概述",
      "positive_case": ["正面案例1", "正面案例2"],
      "negative_case": ["反面案例1", "反面案例2"],
      "citations": [
        {
          "cited_source": "引用来源",
          "cited_type": "书籍",
          "viewpoint": "引用观点概述"
        }
      ]
    }
  ]
}

注意：
1. chapter_viewpoint要求内容丰富，分析深入，文笔生动
2. chapter_keywords提取3-5个核心关键词
3. arguments包含作者在本章提出的主要论据
4. cited_type只能是：书籍、文章、故事、权威观点之一
5. 如果没有相关内容，对应字段可以为空数组或空字符串`;
  }

  private buildBookSummaryPrompt(bookInfo: BookInfo, chapters: Chapter[]): string {
    const chaptersText = chapters.map(ch => 
      `章节：${ch.chapter_title}\n观点：${ch.chapter_viewpoint}\n关键词：${ch.chapter_keywords.join(', ')}`
    ).join('\n\n');

    return `请基于以下书籍信息和章节分析，生成书籍总结：

书籍信息：
标题：${bookInfo.title}
作者：${bookInfo.author}
出版社：${bookInfo.publisher}

章节分析：
${chaptersText}

请返回以下JSON格式的总结结果：
{
  "book_intro": "书籍简介，要求全面介绍书籍主要内容和价值",
  "author_intro": "作者简介，包括背景、专业领域、主要成就等",
  "core_problem": "这本书作者想要解决的核心问题",
  "core_keywords": ["核心关键词1", "核心关键词2", "核心关键词3"]
}

注意：
1. book_intro要求内容丰富，突出书籍的独特价值和主要观点
2. author_intro如果信息不足，可以基于书籍内容推测作者的专业背景
3. core_problem要准确概括作者写作此书的核心目的
4. core_keywords提取5-8个最重要的概念或关键词`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: '请回复"连接成功"'
          }
        ],
        max_tokens: 10
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('API连接测试失败:', error);
      return false;
    }
  }
}