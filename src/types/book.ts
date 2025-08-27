// 前端书籍相关类型定义

// 书籍基本信息
export interface BookInfo {
  title: string;
  author: string;
  publisher?: string;
  publishDate?: string;
  isbn?: string;
  language?: string;
  description?: string;
  pageCount?: number;
  wordCount?: number;
}

// 封面信息
export interface CoverInfo {
  url?: string;
  format?: string;
  width?: number;
  height?: number;
}

// 目录项
export interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
  href?: string;
  children?: TableOfContentsItem[];
}

// 章节内容
export interface ChapterContent {
  index: number;
  title: string;
  content: string;
  wordCount: number;
  level: number;
}

// 论据信息
export interface ArgumentInfo {
  point: string;
  evidence: string;
  strength: 'strong' | 'medium' | 'weak';
}

// 引用信息
export interface QuoteInfo {
  text: string;
  context: string;
  significance: string;
}

// 章节分析结果
export interface ChapterAnalysisResult {
  chapterIndex: number;
  chapterTitle: string;
  summary: string;
  keyPoints: string[];
  arguments: ArgumentInfo[];
  quotes: QuoteInfo[];
  themes: string[];
  emotions: string[];
  characters: string[];
  locations: string[];
  wordCount: number;
  analysisDate: Date;
}

// 书籍总结（匹配json_template.txt中的book_summary结构）
export interface BookSummary {
  book_intro: string; // 书籍整体概述，300字左右
  author_intro: string; // 作者简介
  structure: string; // 书籍结构分析
  core_problem: string; // 这本书作者想要解决的核心问题
  keyInsights: string[]; // 作者在书中提出的核心洞察或独特观点，list类型
  core_keywords: { [key: string]: string }; // 关键词列表，作者在书中提出的或者引用的核心概念或者关键词及其含义；dict类型
  tags: string[]; // 给这本书贴10个最合适的标签，list类型
  generatedDate: Date; // 生成日期
  
  // 保留原有字段以兼容现有代码
  overview?: string;
  mainThemes?: string[];
  writingStyle?: string;
  targetAudience?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendation?: string;
  rating?: number;
}

// 章节统计信息
export interface ChapterStats {
  totalChapters: number;
  totalWords: number;
  averageWords: number;
  longestChapter: {
    index: number;
    title: string;
    wordCount: number;
  };
  shortestChapter: {
    index: number;
    title: string;
    wordCount: number;
  };
}

// 解析结果
export interface ParseResult {
  bookInfo: BookInfo;
  coverInfo?: CoverInfo;
  tableOfContents: TableOfContentsItem[];
  chapters?: ChapterContent[];
  chapterStats?: ChapterStats;
  chapterAnalysis?: ChapterAnalysisResult[];
  bookSummary?: BookSummary;
}

// 操作日志
export interface OperationLog {
  id: string;
  fileId: string;
  timestamp: Date;
  operation: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message: string;
  details?: any;
}

// 进度状态
export interface ProgressStatus {
  current: number;
  total: number;
  percentage: number;
  stage: string;
  message: string;
}

// 书籍解析会话
export interface BookParseSession {
  id: string;
  filename: string;
  filepath: string;
  status: 'uploaded' | 'parsed' | 'split' | 'analyzed' | 'completed';
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  parseResult?: ParseResult;
  error?: string;
}

// 历史记录项
export interface HistoryRecord {
  id: string;
  bookTitle: string;
  author: string;
  filename: string;
  status: BookParseSession['status'];
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  fileSize?: number;
  chaptersCount?: number;
  analysisComplete?: boolean;
}

// 状态筛选选项
export interface StatusFilter {
  value: string;
  label: string;
  count?: number;
}

// 搜索筛选参数
export interface SearchFilters {
  status?: string;
  keyword?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: 'createdAt' | 'updatedAt' | 'filename' | 'progress';
  sortOrder?: 'asc' | 'desc';
}

// 批量操作类型
export type BatchOperation = 'delete' | 'export' | 'reanalyze';

// 导出格式
export type ExportFormat = 'json' | 'csv' | 'pdf' | 'markdown';

// 分析类型
export type AnalysisType = 'basic' | 'detailed' | 'full';

// 解析配置
export interface ParseConfig {
  chapterLevel: number;
  analysisType: AnalysisType;
  includeImages: boolean;
  extractQuotes: boolean;
  generateSummary: boolean;
}

// 用户偏好设置
export interface UserPreferences {
  defaultAnalysisType: AnalysisType;
  autoSave: boolean;
  maxHistoryItems: number;
  theme: 'light' | 'dark' | 'auto';
  language: 'zh' | 'en';
}

// API响应包装类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  timestamp?: string;
}

// 分页信息
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
}

// 存储统计
export interface StorageStats {
  totalSessions: number;
  totalFiles: number;
  totalSize: number;
  oldestSession: Date | null;
  newestSession: Date | null;
}

// 错误信息
export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// 通知类型
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// 通知消息
export interface NotificationMessage {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  actions?: {
    label: string;
    action: () => void;
  }[];
}