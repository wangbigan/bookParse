// EPUB解析器基础接口
import { ParseResult } from '../../types/book.types';

// 基础解析器接口
export interface IBaseParser {
  parse(filePath: string): Promise<ParseResult>;
  validate(filePath: string): Promise<boolean>;
  getSupportedFormats(): string[];
}

// 解析器类型
export enum ParserType {
  EPUB = 'epub',
  PDF = 'pdf',
  TXT = 'txt'
}

// 解析配置
export interface ParseConfig {
  extractCover: boolean;
  extractToc: boolean;
  extractMetadata: boolean;
  maxCoverSize: number; // 最大封面尺寸
  imageQuality: number; // 图片质量 0-100
}

// 默认解析配置
export const DEFAULT_PARSE_CONFIG: ParseConfig = {
  extractCover: true,
  extractToc: true,
  extractMetadata: true,
  maxCoverSize: 300,
  imageQuality: 80
};

// 抽象基础解析器类
export abstract class BaseParser implements IBaseParser {
  protected config: ParseConfig;

  constructor(config: Partial<ParseConfig> = {}) {
    this.config = { ...DEFAULT_PARSE_CONFIG, ...config };
  }

  abstract parse(filePath: string): Promise<ParseResult>;
  abstract validate(filePath: string): Promise<boolean>;
  abstract getSupportedFormats(): string[];

  /**
   * 创建错误解析结果
   * @param message 错误消息
   * @returns 包含错误信息的解析结果
   */
  protected createError(message: string): ParseResult {
    return {
      bookInfo: {
        title: '',
        author: '',
        publisher: '',
        isbn: '',
        publication_date: '',
        language: ''
      },
      tableOfContents: [],
      error: message,
      success: false
    };
  }

  /**
   * 创建成功解析结果
   * @param data 解析数据
   * @returns 包含成功标识的解析结果
   */
  protected createSuccess(data: Partial<ParseResult>): ParseResult {
    return {
      bookInfo: data.bookInfo || {
        title: '',
        author: '',
        publisher: '',
        isbn: '',
        publication_date: '',
        language: ''
      },
      tableOfContents: data.tableOfContents || [],
      success: true,
      ...data
    };
  }
}