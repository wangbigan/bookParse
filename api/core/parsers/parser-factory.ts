// 解析器工厂
import * as path from 'path';
import { IBaseParser, ParseConfig } from './base-parser';
import { EPUBParser } from './epub-parser';

// 解析策略配置
export interface ParseStrategy {
  name: string;
  priority: number;
  matcher: (filePath: string) => boolean;
  createParser: (config?: Partial<ParseConfig>) => IBaseParser;
}

// 解析器工厂类
export class ParserFactory {
  private static strategies: Map<string, ParseStrategy> = new Map();

  static {
    // 注册EPUB解析策略
    ParserFactory.registerStrategy({
      name: 'epub',
      priority: 100,
      matcher: (filePath: string) => {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.epub';
      },
      createParser: (config?: Partial<ParseConfig>) => new EPUBParser(config)
    });
  }

  /**
   * 注册解析策略
   */
  static registerStrategy(strategy: ParseStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * 创建解析器
   */
  static createParser(filePath: string, config?: Partial<ParseConfig>): IBaseParser {
    // 根据优先级排序策略
    const strategies = Array.from(this.strategies.values())
      .sort((a, b) => b.priority - a.priority);

    // 查找匹配的策略
    for (const strategy of strategies) {
      if (strategy.matcher(filePath)) {
        return strategy.createParser(config);
      }
    }

    throw new Error(`不支持的文件格式: ${path.extname(filePath)}`);
  }

  /**
   * 获取支持的文件格式
   */
  static getSupportedFormats(): string[] {
    const formats = new Set<string>();
    
    for (const strategy of this.strategies.values()) {
      const parser = strategy.createParser();
      parser.getSupportedFormats().forEach(format => formats.add(format));
    }
    
    return Array.from(formats);
  }

  /**
   * 检查文件是否支持
   */
  static isSupported(filePath: string): boolean {
    try {
      this.createParser(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取所有注册的策略
   */
  static getStrategies(): ParseStrategy[] {
    return Array.from(this.strategies.values());
  }
}