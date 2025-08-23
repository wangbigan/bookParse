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

// 章节分析结果
export interface Chapter {
  chapter_title: string;
  chapter_viewpoint: string;
  chapter_keywords: string[];
  arguments: Argument[];
}

// 论据信息
export interface Argument {
  statement: string;
  positive_case: string[];
  negative_case: string[];
  citations: Citation[];
}

// 引用信息
export interface Citation {
  cited_source: string;
  cited_type: '书籍' | '文章' | '故事' | '权威观点';
  viewpoint: string;
}

// 书籍总结
export interface BookSummary {
  overview: string;
  mainThemes: string[];
  keyInsights: string[];
  structure: string;
  writingStyle: string;
  targetAudience: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  rating: number;
  tags: string[];
  generatedDate: Date;
  book_intro?: string;
  author_intro?: string;
  core_problem?: string;
  core_keywords?: string[];
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