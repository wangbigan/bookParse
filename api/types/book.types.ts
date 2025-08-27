// 书籍解析相关的TypeScript类型定义

// 书籍基本信息
export interface BookInfo {
  title: string;
  author: string;
  translator?: string;
  publisher: string;
  isbn: string;
  publication_date: string;
  language: string;
  description?: string;
}

// 封面信息
export interface CoverInfo {
  cover_image: string; // base64编码
  cover_alt_text: string;
}

// 目录项
export interface TocItem {
  id: string;
  title: string;
  level: number;
  href: string;
  parent_id: string | null;
}

// 章节分析结果（新格式，符合JSON模板）
export interface Chapter {
  chapter_title: string;
  chapter_viewpoint: string;
  chapter_keywords: string[];
  arguments: Argument[];
}

// 论据信息（新格式，符合JSON模板）
export interface Argument {
  statement: string;
  positive_case: string[];
  negative_case: string[];
  citations: Citation[];
}

// 引用信息（新格式，符合JSON模板）
export interface Citation {
  cited_source: string;
  cited_type: '书籍' | '文章' | '故事' | '权威观点';
  viewpoint: string;
}

// 章节分析原始响应接口（用于AI返回的原始数据）
export interface ChapterAnalysisRawResponse {
  chapter_title: string;
  chapter_viewpoint: string;
  chapter_keywords: string[];
  arguments: {
    statement: string;
    positive_case: string[];
    negative_case: string[];
    citations: {
      cited_source: string;
      cited_type: string;
      viewpoint: string;
    }[];
  }[];
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

// 解析结果
export interface ParseResult {
  bookInfo: BookInfo;
  coverInfo?: CoverInfo;
  tableOfContents: TocItem[];
  chapters?: ChapterContent[];
  chapterStats?: ChapterStats;
  chapterAnalysis?: ChapterAnalysisResult[];
  bookSummary?: BookSummary;
  success?: boolean;
  error?: string;
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

// 章节内容
export interface ChapterContent {
  index: number;
  title: string;
  content: string;
  wordCount: number;
  level: number;
}

// 书籍解析会话
export interface BookParseSession {
  id: string;
  filename: string;
  filepath: string;
  status: 'uploading' | 'uploaded' | 'parsing' | 'parsed' | 'splitting' | 'split' | 'analyzing' | 'completed' | 'error';
  createdAt: Date;
  updatedAt: Date;
  progress: number;
  parseResult?: ParseResult;
  error?: string;
}

// 操作日志
export interface OperationLog {
  id: string;
  fileId: string;
  timestamp: Date;
  operation: string;
  status: 'pending' | 'in_progress' | 'processing' | 'completed' | 'error';
  message: string;
  duration?: number;
  details?: any;
}

// 进度状态
export interface ProgressStatus {
  fileId: string;
  overall: number; // 整体进度百分比
  modules: {
    upload: boolean;
    parse: boolean;
    split: boolean;
    analyze: boolean;
    summary: boolean;
  };
  currentStep: string;
  estimatedTime?: number;
}