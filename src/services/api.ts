// 前端API服务
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { BookParseSession, OperationLog, ParseResult, ChapterAnalysisResult, BookSummary } from '../types/book';

// API响应类型
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

// 分页响应类型
interface PaginatedResponse<T> {
  sessions: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// 存储统计类型
interface StorageStats {
  totalSessions: number;
  totalFiles: number;
  totalSize: number;
  oldestSession: string | null;
  newestSession: string | null;
}

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 60000, // 60秒超时
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API请求: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API请求错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        console.log(`API响应: ${response.config.url} - ${response.data.success ? '成功' : '失败'}`);
        return response;
      },
      (error) => {
        console.error('API响应错误:', error);
        const message = error.response?.data?.message || error.message || '网络错误';
        return Promise.reject(new Error(message));
      }
    );
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get<ApiResponse>('/api/health');
      return response.data.success;
    } catch (error) {
      console.error('健康检查失败:', error);
      return false;
    }
  }

  /**
   * 上传电子书文件
   */
  async uploadBook(file: File): Promise<{ fileId: string; session: BookParseSession }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await this.client.post<ApiResponse<{ fileId: string; session: BookParseSession }>>(
        '/api/books/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '上传失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 解析电子书基本信息
   */
  async parseBook(fileId: string): Promise<{ session: BookParseSession; parseResult: ParseResult }> {
    try {
      const response = await this.client.post<ApiResponse<{ session: BookParseSession; parseResult: ParseResult }>>(
        `/api/books/${fileId}/parse`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '解析失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('书籍解析失败:', error);
      throw error;
    }
  }

  /**
   * 拆分章节
   */
  async splitChapters(
    fileId: string,
    level: number = 1
  ): Promise<{ session: BookParseSession; chapters: any[]; stats: any }> {
    try {
      const response = await this.client.post<ApiResponse<{ session: BookParseSession; chapters: any[]; stats: any }>>(
        `/api/books/${fileId}/split`,
        { level }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '章节拆分失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('章节拆分失败:', error);
      throw error;
    }
  }

  /**
   * AI分析章节
   */
  async analyzeChapters(
    fileId: string,
    chapterIndexes?: number[],
    analysisType: 'basic' | 'detailed' | 'full' = 'full'
  ): Promise<{ session: BookParseSession; analysisResults: ChapterAnalysisResult[]; bookSummary: BookSummary }> {
    try {
      const response = await this.client.post<ApiResponse<{ 
        session: BookParseSession; 
        analysisResults: ChapterAnalysisResult[]; 
        bookSummary: BookSummary 
      }>>(
        `/api/books/${fileId}/analyze`,
        { chapterIndexes, analysisType }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || 'AI分析失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('AI分析失败:', error);
      throw error;
    }
  }

  /**
   * 获取解析会话信息
   */
  async getSession(fileId: string): Promise<{ session: BookParseSession; logs: OperationLog[] }> {
    try {
      const response = await this.client.get<ApiResponse<{ session: BookParseSession; logs: OperationLog[] }>>(
        `/api/books/${fileId}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '获取会话失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('获取会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取操作日志
   */
  async getLogs(fileId: string): Promise<OperationLog[]> {
    try {
      const response = await this.client.get<ApiResponse<OperationLog[]>>(
        `/api/books/${fileId}/logs`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '获取日志失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('获取日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取历史记录
   */
  async getHistory(
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<BookParseSession>> {
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await this.client.get<ApiResponse<PaginatedResponse<BookParseSession>>>(
        `/api/books?${params.toString()}`
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '获取历史记录失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('获取历史记录失败:', error);
      throw error;
    }
  }

  /**
   * 删除会话
   */
  async deleteSession(fileId: string): Promise<void> {
    try {
      const response = await this.client.delete<ApiResponse>(
        `/api/books/${fileId}`
      );

      if (!response.data.success) {
        throw new Error(response.data.message || '删除会话失败');
      }
    } catch (error) {
      console.error('删除会话失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const response = await this.client.get<ApiResponse<StorageStats>>(
        '/api/books/stats'
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '获取统计信息失败');
      }

      return response.data.data;
    } catch (error) {
      console.error('获取统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 轮询会话状态
   */
  async pollSessionStatus(
    fileId: string,
    onUpdate: (session: BookParseSession) => void,
    interval: number = 2000
  ): Promise<() => void> {
    let isPolling = true;
    
    const poll = async () => {
      while (isPolling) {
        try {
          const { session } = await this.getSession(fileId);
          onUpdate(session);
          
          // 如果任务完成或出错，停止轮询
          if (session.status === 'completed' || session.status === 'error') {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, interval));
        } catch (error) {
          console.error('轮询会话状态失败:', error);
          break;
        }
      }
    };
    
    poll();
    
    // 返回停止轮询的函数
    return () => {
      isPolling = false;
    };
  }

  /**
   * 获取基础URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }
}

// 创建单例实例
const apiService = new ApiService();

export default apiService;
export { ApiService, apiService };