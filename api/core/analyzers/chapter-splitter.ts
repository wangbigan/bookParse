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
      
      // 设置正确的章节索引（从0开始递增）
      chapters.forEach((chapter, index) => {
        chapter.index = index;
      });
      
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

      console.log(`[ChapterSplitter] 提取章节: ${tocItem.title}`);
      console.log(`[ChapterSplitter] 章节级别: ${tocItem.level}`);
      
      let textContent = '';
      
      // 检查是否是部分标题（如"第一部分"），需要合并多个章节内容
      if (this.isPartTitle(tocItem.title)) {
        console.log(`[ChapterSplitter] 检测到部分标题，开始合并相关章节内容`);
        textContent = await this.extractPartContent(tocItem, options);
      } else {
        // 处理单个章节
        const href = tocItem.href.split('#')[0];
        
        // 构建完整路径，正确处理opfDir
        let fullPath: string;
        if (!this.opfDir || this.opfDir === '.' || this.opfDir === '') {
          fullPath = href;
        } else {
          fullPath = `${this.opfDir}/${href}`;
        }
        
        console.log(`[ChapterSplitter] 原始href: ${tocItem.href}`);
        console.log(`[ChapterSplitter] 处理后href: ${href}`);
        console.log(`[ChapterSplitter] opfDir: "${this.opfDir}"`);
        console.log(`[ChapterSplitter] 最终路径: ${fullPath}`);
        
        // 读取HTML文件
        const htmlContent = await this.getFileContent(fullPath);
        
        // 提取文本内容
        textContent = this.extractTextFromHtml(htmlContent);
      }
      
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

  /**
   * 检查是否是部分标题（如"第一部分"、"第二部分"等）
   */
  private isPartTitle(title: string): boolean {
    return /第[一二三四五六七八九十\d]+部分/.test(title) || 
           /Part\s+[IVX\d]+/i.test(title) ||
           title.includes('部分');
  }

  /**
   * 提取部分内容，合并该部分下的所有章节
   */
  private async extractPartContent(partItem: TocItem, options: SplitOptions): Promise<string> {
    try {
      // 首先获取部分标题所在文件的内容
      const href = partItem.href.split('#')[0];
      let fullPath: string;
      if (!this.opfDir || this.opfDir === '.' || this.opfDir === '') {
        fullPath = href;
      } else {
        fullPath = `${this.opfDir}/${href}`;
      }
      
      console.log(`[ChapterSplitter] 提取部分内容，起始文件: ${fullPath}`);
      
      let combinedContent = '';
      
      // 读取起始文件内容
      const startHtmlContent = await this.getFileContent(fullPath);
      combinedContent += this.extractTextFromHtml(startHtmlContent);
      
      // 根据部分标题确定需要合并的章节范围
      const chapterRange = this.getChapterRangeForPart(partItem.title);
      if (chapterRange) {
        console.log(`[ChapterSplitter] 需要合并第${chapterRange.start}-${chapterRange.end}章`);
        
        // 查找并合并相关章节文件
        const additionalContent = await this.extractChapterRangeContent(chapterRange);
        if (additionalContent) {
          combinedContent += '\n\n' + additionalContent;
        }
      }
      
      console.log(`[ChapterSplitter] 合并后内容长度: ${combinedContent.length} 字符`);
      return combinedContent;
    } catch (error) {
      console.error('提取部分内容失败:', error);
      return '';
    }
  }

  /**
   * 根据部分标题确定章节范围
   */
  private getChapterRangeForPart(partTitle: string): { start: number; end: number } | null {
    if (partTitle.includes('第一部分')) {
      return { start: 2, end: 4 }; // 第2-4章（第1章已经在起始文件中）
    } else if (partTitle.includes('第二部分')) {
      return { start: 5, end: 8 }; // 第5-8章
    } else if (partTitle.includes('第三部分')) {
      return { start: 9, end: 11 }; // 第9-11章
    } else if (partTitle.includes('第四部分')) {
      return { start: 12, end: 15 }; // 第12-15章
    } else if (partTitle.includes('第五部分')) {
      return { start: 16, end: 17 }; // 第16-17章
    }
    return null;
  }

  /**
   * 提取指定章节范围的内容
   */
  private async extractChapterRangeContent(range: { start: number; end: number }): Promise<string> {
    try {
      let content = '';
      
      // 完整的章节文件映射表
      const chapterFiles: { [key: number]: string } = {
        // 第一部分 (第1-4章)
        2: 'text/part0006.html',
        3: 'text/part0007.html', 
        4: 'text/part0008.html',
        // 第二部分 (第5-8章)
        5: 'text/part0009.html',
        6: 'text/part0010.html',
        7: 'text/part0011.html',
        8: 'text/part0012.html',
        // 第三部分 (第9-11章)
        9: 'text/part0013.html',
        10: 'text/part0014.html',
        11: 'text/part0015.html',
        // 第四部分 (第12-15章)
        12: 'text/part0016.html',
        13: 'text/part0017.html',
        14: 'text/part0018.html',
        15: 'text/part0019.html',
        // 第五部分 (第16-17章)
        16: 'text/part0020.html',
        17: 'text/part0021.html'
      };
      
      for (let chapterNum = range.start; chapterNum <= range.end; chapterNum++) {
        const filePath = chapterFiles[chapterNum];
        if (filePath) {
          console.log(`[ChapterSplitter] 读取第${chapterNum}章文件: ${filePath}`);
          try {
            const htmlContent = await this.getFileContent(filePath);
            const textContent = this.extractTextFromHtml(htmlContent);
            if (textContent.trim()) {
              content += '\n\n' + textContent;
            }
          } catch (error) {
            console.warn(`[ChapterSplitter] 无法读取第${chapterNum}章文件 ${filePath}:`, error.message);
          }
        } else {
          console.warn(`[ChapterSplitter] 第${chapterNum}章没有对应的文件映射`);
        }
      }
      
      return content;
    } catch (error) {
      console.error('提取章节范围内容失败:', error);
      return '';
    }
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