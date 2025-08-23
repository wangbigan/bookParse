// 章节拆分器
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { parseStringPromise } from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { TocItem, ChapterContent } from '../../types/book.types';

const readFile = promisify(fs.readFile);

export interface SplitOptions {
  level: number; // 拆分层级 (1-3)
  maxChapterLength?: number; // 最大章节长度
  removeHtml?: boolean; // 是否移除HTML标签
}

export class ChapterSplitter {
  private zip: JSZip | null = null;
  private opfDir: string = '';

  async initialize(filePath: string): Promise<void> {
    try {
      const buffer = await readFile(filePath);
      this.zip = await JSZip.loadAsync(buffer);
      
      // 获取OPF文件路径
      const containerXml = await this.getFileContent('META-INF/container.xml');
      const containerData = await parseStringPromise(containerXml);
      const opfPath = containerData.container.rootfiles[0].rootfile[0]['$']['full-path'];
      this.opfDir = path.dirname(opfPath);
    } catch (error) {
      throw new Error(`初始化章节拆分器失败: ${error.message}`);
    }
  }

  async splitChapters(tableOfContents: TocItem[], options: SplitOptions): Promise<ChapterContent[]> {
    if (!this.zip) {
      throw new Error('章节拆分器未初始化');
    }

    try {
      // 根据层级筛选目录项
      const targetTocItems = this.filterTocByLevel(tableOfContents, options.level);
      
      const chapters: ChapterContent[] = [];
      
      for (const tocItem of targetTocItems) {
        try {
          const content = await this.extractChapterContent(tocItem, options);
          if (content) {
            chapters.push(content);
          }
        } catch (error) {
          console.error(`提取章节内容失败 [${tocItem.title}]:`, error);
          // 继续处理其他章节
        }
      }
      
      return chapters;
    } catch (error) {
      throw new Error(`章节拆分失败: ${error.message}`);
    }
  }

  private filterTocByLevel(tableOfContents: TocItem[], targetLevel: number): TocItem[] {
    return tableOfContents.filter(item => item.level === targetLevel);
  }

  private async extractChapterContent(tocItem: TocItem, options: SplitOptions): Promise<ChapterContent | null> {
    try {
      if (!tocItem.href) {
        return null;
      }

      // 处理href，移除锚点
      const href = tocItem.href.split('#')[0];
      
      // 构建完整路径，正确处理opfDir
      let fullPath: string;
      if (!this.opfDir || this.opfDir === '.' || this.opfDir === '') {
        fullPath = href;
      } else {
        fullPath = `${this.opfDir}/${href}`;
      }
      
      console.log(`[ChapterSplitter] 提取章节: ${tocItem.title}`);
      console.log(`[ChapterSplitter] 原始href: ${tocItem.href}`);
      console.log(`[ChapterSplitter] 处理后href: ${href}`);
      console.log(`[ChapterSplitter] opfDir: "${this.opfDir}"`);
      console.log(`[ChapterSplitter] 最终路径: ${fullPath}`);
      
      // 读取HTML文件
      const htmlContent = await this.getFileContent(fullPath);
      
      // 提取文本内容
      let textContent = this.extractTextFromHtml(htmlContent);
      
      // 清理和格式化文本
      textContent = this.cleanText(textContent);
      
      // 检查章节长度限制
      if (options.maxChapterLength && textContent.length > options.maxChapterLength) {
        textContent = textContent.substring(0, options.maxChapterLength) + '...';
      }
      
      return {
        index: 0, // 临时值，实际应该根据顺序设置
        title: tocItem.title,
        content: textContent,
        wordCount: this.countWords(textContent),
        level: tocItem.level
      };
    } catch (error) {
      console.error(`提取章节内容错误 [${tocItem.title}]:`, error);
      return null;
    }
  }

  private extractTextFromHtml(html: string): string {
    try {
      // 移除HTML标签，保留文本内容
      let text = html
        // 移除script和style标签及其内容
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // 将块级元素转换为换行
        .replace(/<\/(div|p|h[1-6]|li|section|article)>/gi, '\n')
        .replace(/<(br|hr)\s*\/?>/gi, '\n')
        // 移除所有HTML标签
        .replace(/<[^>]+>/g, '')
        // 解码HTML实体
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&hellip;/g, '...')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–');
      
      return text;
    } catch (error) {
      console.error('HTML文本提取错误:', error);
      return '';
    }
  }

  private cleanText(text: string): string {
    return text
      // 移除多余的空白字符
      .replace(/\s+/g, ' ')
      // 移除多余的换行
      .replace(/\n\s*\n/g, '\n')
      // 移除首尾空白
      .trim()
      // 确保段落间有适当的分隔
      .replace(/\n/g, '\n\n');
  }

  private async getFileContent(filePath: string): Promise<string> {
    if (!this.zip) {
      throw new Error('ZIP文件未加载');
    }
    
    const file = this.zip.file(filePath);
    if (!file) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    return await file.async('text');
  }

  /**
   * 获取章节统计信息
   */
  getChapterStats(chapters: ChapterContent[]): {
    totalChapters: number;
    totalWords: number;
    averageWords: number;
    longestChapter: { index: number; title: string; wordCount: number };
    shortestChapter: { index: number; title: string; wordCount: number };
  } {
    if (chapters.length === 0) {
      return {
        totalChapters: 0,
        totalWords: 0,
        averageWords: 0,
        longestChapter: { index: 0, title: '', wordCount: 0 },
        shortestChapter: { index: 0, title: '', wordCount: 0 }
      };
    }

    const wordCounts = chapters.map((chapter, index) => ({
      index,
      title: chapter.title,
      wordCount: this.countWords(chapter.content)
    }));

    const totalWords = wordCounts.reduce((sum, item) => sum + item.wordCount, 0);
    const longestChapter = wordCounts.reduce((max, item) => item.wordCount > max.wordCount ? item : max);
    const shortestChapter = wordCounts.reduce((min, item) => item.wordCount < min.wordCount ? item : min);

    return {
      totalChapters: chapters.length,
      totalWords,
      averageWords: Math.round(totalWords / chapters.length),
      longestChapter,
      shortestChapter
    };
  }

  private countWords(text: string): number {
    // 简单的中英文字数统计
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/\b[a-zA-Z]+\b/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 获取统计信息（别名方法）
   */
  getStatistics(chapters: ChapterContent[]) {
    return this.getChapterStats(chapters);
  }

  /**
   * 按层级拆分章节（别名方法）
   */
  async splitByLevel(level: number): Promise<ChapterContent[]> {
    // 这个方法需要先获取目录信息，暂时返回空数组
    // 实际使用时应该通过其他方式获取目录
    return [];
  }

  /**
   * 获取统计信息（无参数版本）
   */
  getStats() {
    return {
      totalChapters: 0,
      totalWords: 0,
      averageWords: 0,
      longestChapter: { index: 0, title: '', wordCount: 0 },
      shortestChapter: { index: 0, title: '', wordCount: 0 }
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.dispose();
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.zip = null;
    this.opfDir = '';
  }
}