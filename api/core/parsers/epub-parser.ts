// EPUB解析器实现
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { parseStringPromise } from 'xml2js';
import JSZip from 'jszip';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { BaseParser, ParseConfig } from './base-parser';
import { ParseResult, BookInfo, CoverInfo, TocItem } from '../../types/book.types';

const readFile = promisify(fs.readFile);

export class EPUBParser extends BaseParser {
  constructor(config?: Partial<ParseConfig>) {
    super(config);
  }

  getSupportedFormats(): string[] {
    return ['.epub'];
  }

  /**
   * 验证EPUB文件的有效性
   * @param filePath 文件路径
   * @returns 验证结果
   */
  async validate(filePath: string): Promise<boolean> {
    try {
      // 1. 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.warn(`EPUB验证失败: 文件不存在 - ${filePath}`);
        return false;
      }

      // 2. 检查文件扩展名
      const ext = path.extname(filePath).toLowerCase();
      if (!this.getSupportedFormats().includes(ext)) {
        console.warn(`EPUB验证失败: 不支持的文件格式 - ${ext}`);
        return false;
      }

      // 3. 检查文件大小（避免空文件或过大文件）
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        console.warn(`EPUB验证失败: 文件为空 - ${filePath}`);
        return false;
      }
      if (stats.size > 100 * 1024 * 1024) { // 100MB限制
        console.warn(`EPUB验证失败: 文件过大 (${Math.round(stats.size / 1024 / 1024)}MB) - ${filePath}`);
        return false;
      }

      // 4. 检查是否为有效的ZIP文件
      const buffer = await readFile(filePath);
      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(buffer);
      } catch (zipError) {
        console.warn(`EPUB验证失败: 无效的ZIP文件 - ${filePath}`, zipError);
        return false;
      }
      
      // 5. 检查EPUB必需的mimetype文件
      const mimetypeFile = zip.file('mimetype');
      if (!mimetypeFile) {
        console.warn(`EPUB验证失败: 缺少mimetype文件 - ${filePath}`);
        return false;
      }

      // 6. 验证mimetype内容
      const mimetype = await mimetypeFile.async('text');
      if (mimetype.trim() !== 'application/epub+zip') {
        console.warn(`EPUB验证失败: 无效的mimetype (${mimetype.trim()}) - ${filePath}`);
        return false;
      }

      // 7. 检查META-INF/container.xml文件
      const containerFile = zip.file('META-INF/container.xml');
      if (!containerFile) {
        console.warn(`EPUB验证失败: 缺少META-INF/container.xml文件 - ${filePath}`);
        return false;
      }

      // 8. 验证container.xml内容
      try {
        const containerXml = await containerFile.async('text');
        const containerData = await parseStringPromise(containerXml);
        if (!containerData.container?.rootfiles?.[0]?.rootfile?.[0]?.['$']?.['full-path']) {
          console.warn(`EPUB验证失败: container.xml格式无效 - ${filePath}`);
          return false;
        }
      } catch (xmlError) {
        console.warn(`EPUB验证失败: container.xml解析错误 - ${filePath}`, xmlError);
        return false;
      }

      console.log(`EPUB验证成功: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`EPUB验证异常: ${filePath}`, error);
      return false;
    }
  }

  /**
   * 解析EPUB文件
   * @param filePath 文件路径
   * @returns 解析结果
   */
  async parse(filePath: string): Promise<ParseResult> {
    console.log(`开始解析EPUB文件: ${filePath}`);
    
    try {
      // 验证文件
      console.log('步骤1: 验证EPUB文件格式...');
      const isValid = await this.validate(filePath);
      if (!isValid) {
        console.error('EPUB文件验证失败');
        return this.createError('无效的EPUB文件');
      }
      console.log('EPUB文件验证通过');

      // 读取文件并加载ZIP
      console.log('步骤2: 加载EPUB文件内容...');
      const buffer = await readFile(filePath);
      const zip = await JSZip.loadAsync(buffer);
      console.log(`成功加载ZIP文件，包含 ${Object.keys(zip.files).length} 个文件`);

      // 解析容器文件
      console.log('步骤3: 解析容器文件...');
      const containerXml = await this.getFileContent(zip, 'META-INF/container.xml');
      const containerData = await parseStringPromise(containerXml);
      const opfPath = containerData.container.rootfiles[0].rootfile[0]['$']['full-path'];
      console.log(`找到OPF文件路径: ${opfPath}`);

      // 解析OPF文件
      console.log('步骤4: 解析OPF文件...');
      const opfContent = await this.getFileContent(zip, opfPath);
      const opfData = await parseStringPromise(opfContent);
      const opfDir = path.dirname(opfPath);
      console.log(`OPF目录: ${opfDir}`);

      // 提取书籍信息
      console.log('步骤5: 提取书籍基本信息...');
      const bookInfo = await this.extractBookInfo(opfData);
      console.log(`书籍信息: ${bookInfo.title} - ${bookInfo.author}`);
      
      // 提取封面信息
      console.log('步骤6: 提取封面信息...');
      const coverInfo = await this.extractCoverInfo(zip, opfData, opfDir);
      console.log(`封面提取${coverInfo?.cover_image ? '成功' : '失败'}`);
      
      // 提取目录结构
      console.log('步骤7: 提取目录结构...');
      const tableOfContents = await this.extractTableOfContents(zip, opfData, opfDir);
      console.log(`提取到 ${tableOfContents.length} 个目录项`);

      console.log('EPUB解析完成');
      return this.createSuccess({
        bookInfo,
        coverInfo,
        tableOfContents
      });
    } catch (error) {
      console.error('EPUB解析错误:', error);
      console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
      return this.createError(`解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  private async getFileContent(zip: JSZip, filePath: string): Promise<string> {
    const file = zip.file(filePath);
    if (!file) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    return await file.async('text');
  }

  private async extractBookInfo(opfData: any): Promise<BookInfo> {
    const metadata = opfData.package.metadata[0];
    
    // 提取基本信息
    const title = this.getMetadataValue(metadata, 'dc:title') || '未知标题';
    const author = this.getMetadataValue(metadata, 'dc:creator') || '未知作者';
    const publisher = this.getMetadataValue(metadata, 'dc:publisher') || '未知出版社';
    const language = this.getMetadataValue(metadata, 'dc:language') || 'zh';
    const isbn = this.getMetadataValue(metadata, 'dc:identifier') || '';
    const date = this.getMetadataValue(metadata, 'dc:date') || '';
    
    // 查找译者信息
    let translator = '';
    if (metadata['dc:contributor']) {
      const contributors = Array.isArray(metadata['dc:contributor']) 
        ? metadata['dc:contributor'] 
        : [metadata['dc:contributor']];
      
      for (const contributor of contributors) {
        const role = contributor.$?.role || contributor.$?.['opf:role'];
        if (role === 'trl' || role === 'translator') {
          translator = typeof contributor === 'string' ? contributor : contributor._;
          break;
        }
      }
    }

    return {
      title,
      author,
      translator,
      publisher,
      isbn,
      publication_date: date,
      language
    };
  }

  private getMetadataValue(metadata: any, key: string): string {
    const value = metadata[key];
    if (!value) return '';
    
    if (Array.isArray(value)) {
      return typeof value[0] === 'string' ? value[0] : value[0]._ || '';
    }
    
    return typeof value === 'string' ? value : value._ || '';
  }

  /**
   * 提取封面信息
   * @param zip EPUB文件的ZIP对象
   * @param opfData OPF文件数据
   * @param opfDir OPF文件所在目录
   * @returns 封面信息对象
   */
  private async extractCoverInfo(zip: JSZip, opfData: any, opfDir: string): Promise<CoverInfo | undefined> {
    if (!this.config.extractCover) {
      console.log('封面提取已禁用');
      return undefined;
    }

    try {
      console.log('开始提取封面信息...');
      const manifest = opfData.package.manifest[0].item;
      const metadata = opfData.package.metadata[0];
      let coverImageId = null;
      let coverImagePath = '';
      
      console.log(`清单中包含 ${manifest.length} 个文件`);
      
      // 调试：显示ZIP文件中的所有文件路径
      console.log('ZIP文件中的所有文件:');
      zip.forEach((relativePath, file) => {
        if (!file.dir) {
          console.log(`  - ${relativePath}`);
        }
      });
      
      // 方法1: 查找metadata中的cover属性
      console.log('方法1: 查找metadata中的cover属性...');
      if (metadata && metadata.cover) {
        coverImageId = metadata.cover;
        console.log(`在metadata中找到cover属性: ${coverImageId}`);
        const coverItem = manifest.find((item: any) => item.$?.id === coverImageId);
        if (coverItem) {
          coverImagePath = coverItem.$?.href;
          console.log(`通过metadata.cover找到封面图片: ${coverImagePath}`);
        }
      }
      
      // 方法2: 查找cover-image属性
      if (!coverImagePath) {
        console.log('方法2: 查找cover-image属性...');
        for (const item of manifest) {
          if (item.$?.properties === 'cover-image' || item.$?.id === 'cover-image') {
            coverImagePath = item.$?.href;
            coverImageId = item.$?.id;
            console.log(`找到cover-image属性: ${coverImagePath}`);
            break;
          }
        }
      }
      
      // 方法3: 查找meta标签中的cover
      if (!coverImagePath && metadata.meta) {
        console.log('方法3: 查找meta标签中的cover...');
        const metaTags = Array.isArray(metadata.meta) ? metadata.meta : [metadata.meta];
        
        console.log(`找到 ${metaTags.length} 个meta标签`);
        for (const meta of metaTags) {
          if (meta.$?.name === 'cover' && meta.$?.content) {
            const coverId = meta.$?.content;
            console.log(`找到cover meta标签，ID: ${coverId}`);
            const coverItem = manifest.find((item: any) => item.$?.id === coverId);
            if (coverItem) {
              coverImagePath = coverItem.$?.href;
              coverImageId = coverId;
              console.log(`通过meta标签找到封面图片: ${coverImagePath}`);
              break;
            }
          }
        }
      }
      
      // 方法4: 在manifest中查找cover相关的图片
      if (!coverImagePath) {
        console.log('方法4: 在manifest中查找cover相关的图片...');
        for (const item of manifest) {
          const mediaType = item.$?.['media-type'] || '';
          const itemId = item.$?.id || '';
          const itemHref = item.$?.href || '';
          
          if (mediaType.startsWith('image/')) {
            if (itemId.toLowerCase().includes('cover') || 
                itemHref.toLowerCase().includes('cover')) {
              coverImagePath = itemHref;
              coverImageId = itemId;
              console.log(`在manifest中找到cover相关图片: ${coverImagePath}`);
              break;
            }
          }
        }
      }
      
      // 方法5: 查找常见的封面文件名
      if (!coverImagePath) {
        console.log('方法5: 查找常见的封面文件名...');
        const commonCoverNames = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.gif', 'cover.webp'];
        for (const name of commonCoverNames) {
          const fullPath = opfDir ? `${opfDir}/${name}` : name;
          console.log(`检查文件: ${fullPath}`);
          if (zip.file(fullPath)) {
            coverImagePath = name;
            console.log(`找到常见封面文件: ${coverImagePath}`);
            break;
          }
        }
      }
      
      // 方法6: 使用第一个图片作为封面
      if (!coverImagePath) {
        console.log('方法6: 使用第一个图片作为封面...');
        for (const item of manifest) {
          const mediaType = item.$?.['media-type'] || '';
          if (mediaType.startsWith('image/')) {
            coverImagePath = item.$?.href;
            coverImageId = item.$?.id;
            console.log(`使用第一个图片文件作为封面: ${coverImagePath}`);
            break;
          }
        }
      }

      // 如果没有找到封面图片，返回空结果
      if (!coverImagePath) {
        console.warn('未找到任何封面图片');
        return {
          cover_image: '',
          cover_alt_text: '无封面图片'
        };
      }

      // 读取封面图片文件
      console.log(`准备读取封面图片: ${coverImagePath}`);
      
      // 尝试多种路径策略来查找封面文件
      const pathsToTry = [];
      
      // 策略1: 直接使用原始路径
      pathsToTry.push(coverImagePath);
      
      // 策略2: 如果opfDir不为空且不为".",则添加opfDir前缀
      if (opfDir && opfDir !== '.') {
        pathsToTry.push(`${opfDir}/${coverImagePath}`);
      }
      
      // 策略3: 如果路径以"./"开头，去掉前缀
      if (coverImagePath.startsWith('./')) {
        pathsToTry.push(coverImagePath.substring(2));
      }
      
      // 策略4: 如果路径不以"./"开头，添加"./"前缀
      if (!coverImagePath.startsWith('./')) {
        pathsToTry.push(`./${coverImagePath}`);
      }
      
      // 策略5: 尝试在常见目录中查找
      const commonDirs = ['', 'OEBPS', 'content', 'images', 'img'];
      for (const dir of commonDirs) {
        if (dir) {
          pathsToTry.push(`${dir}/${coverImagePath}`);
          // 如果coverImagePath已经包含目录，也尝试只用文件名
          const fileName = coverImagePath.split('/').pop();
          if (fileName && fileName !== coverImagePath) {
            pathsToTry.push(`${dir}/${fileName}`);
          }
        }
      }
      
      console.log(`尝试以下路径查找封面文件:`);
      pathsToTry.forEach(path => console.log(`  - ${path}`));
      
      let coverFile = null;
      let actualPath = '';
      
      // 逐一尝试每个路径
      for (const path of pathsToTry) {
        coverFile = zip.file(path);
        if (coverFile) {
          actualPath = path;
          console.log(`成功找到封面文件: ${actualPath}`);
          break;
        }
      }
      
      if (!coverFile) {
        console.warn(`所有路径都无法找到封面图片文件`);
        console.warn(`尝试的路径: ${pathsToTry.join(', ')}`);
        return {
          cover_image: '',
          cover_alt_text: '封面图片文件不存在'
        };
      }

      // 获取图片数据
      const imageBuffer = await coverFile.async('nodebuffer');
      
      if (!imageBuffer || imageBuffer.length === 0) {
        console.warn('封面图片数据为空');
        return {
          cover_image: '',
          cover_alt_text: '封面图片数据为空'
        };
      }

      // 使用sharp处理图片，保持现有的图片处理逻辑
      console.log('开始处理封面图片...');
      const processedImage = await sharp(imageBuffer)
        .resize(this.config.maxCoverSize, this.config.maxCoverSize, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: this.config.imageQuality })
        .toBuffer();

      // 转换为base64格式
      const base64Image = `data:image/jpeg;base64,${processedImage.toString('base64')}`;
      
      console.log('封面图片处理完成');
      return {
        cover_image: base64Image,
        cover_alt_text: '书籍封面'
      };
    } catch (error) {
      console.warn('封面提取过程中发生错误:', error);
      // 改进错误处理，不抛出异常，而是返回空结果
      return {
        cover_image: '',
        cover_alt_text: '封面提取失败'
      };
    }
  }

  private async extractTableOfContents(zip: JSZip, opfData: any, opfDir: string): Promise<TocItem[]> {
    if (!this.config.extractToc) {
      console.log('目录提取已禁用');
      return [];
    }

    try {
      console.log('开始提取目录结构...');
      const manifest = opfData.package.manifest[0].item;
      
      // 方法1: 查找nav.xhtml文件（EPUB3标准）
      console.log('方法1: 查找nav.xhtml导航文件...');
      const navTocItems = await this.extractTocFromNavFile(zip, manifest, opfDir);
      if (navTocItems.length > 0) {
        console.log(`从nav.xhtml文件提取到 ${navTocItems.length} 个目录项`);
        return navTocItems;
      }
      
      // 方法2: 查找NCX文件（EPUB2标准）
      console.log('方法2: 查找NCX文件...');
      const ncxTocItems = await this.extractTocFromNcxFile(zip, manifest, opfDir);
      if (ncxTocItems.length > 0) {
        console.log(`从NCX文件提取到 ${ncxTocItems.length} 个目录项`);
        return ncxTocItems;
      }
      
      // 方法3: 从HTML/XHTML文件中提取div结构目录
      console.log('方法3: 从HTML/XHTML文件提取目录...');
      const htmlTocItems = await this.extractTocFromHtmlFiles(zip, manifest, opfDir);
      if (htmlTocItems.length > 0) {
        console.log(`从HTML文件提取到 ${htmlTocItems.length} 个目录项`);
        return htmlTocItems;
      }
      
      // 方法4: 使用spine提取目录（最后的备用方案）
      console.log('方法4: 使用spine提取目录...');
      return this.extractTocFromSpine(opfData);
    } catch (error) {
      console.error('目录提取错误:', error);
      console.log('回退到spine提取目录');
      return this.extractTocFromSpine(opfData);
    }
  }

  /**
   * 从nav.xhtml文件提取目录结构
   * @param zip EPUB文件的ZIP对象
   * @param manifest 清单项目列表
   * @param opfDir OPF文件所在目录
   * @returns 目录项数组
   */
  private async extractTocFromNavFile(zip: JSZip, manifest: any[], opfDir: string): Promise<TocItem[]> {
    try {
      // 查找nav文件
      let navPath = '';
      for (const item of manifest) {
        const properties = item.$?.properties || '';
        const href = item.$?.href || '';
        if (properties.includes('nav') || href.toLowerCase().includes('nav.xhtml')) {
          navPath = href;
          console.log(`找到导航文件: ${navPath}`);
          break;
        }
      }
      
      if (!navPath) {
        console.log('未找到nav.xhtml文件');
        return [];
      }
      
      // 尝试多种路径策略读取nav文件
      const pathsToTry = [
        navPath,
        opfDir && opfDir !== '.' ? `${opfDir}/${navPath}` : navPath
      ];
      
      let navFile = null;
      for (const path of pathsToTry) {
        navFile = zip.file(path);
        if (navFile) {
          console.log(`成功找到nav文件: ${path}`);
          break;
        }
      }
      
      if (!navFile) {
        console.log(`无法读取nav文件: ${pathsToTry.join(', ')}`);
        return [];
      }
      
      const navContent = await navFile.async('text');
      
      // 解析nav.xhtml中的目录结构
      const tocItems = this.parseNavXhtmlContent(navContent);
      return tocItems;
    } catch (error) {
      console.error('从nav文件提取目录失败:', error);
      return [];
    }
  }
  
  /**
   * 从NCX文件提取目录结构
   * @param zip EPUB文件的ZIP对象
   * @param manifest 清单项目列表
   * @param opfDir OPF文件所在目录
   * @returns 目录项数组
   */
  private async extractTocFromNcxFile(zip: JSZip, manifest: any[], opfDir: string): Promise<TocItem[]> {
    try {
      let ncxPath = '';
      
      // 在清单中查找NCX文件
      for (const item of manifest) {
        if (item.$?.['media-type'] === 'application/x-dtbncx+xml') {
          ncxPath = item.$?.href;
          console.log(`在清单中找到NCX文件: ${ncxPath}`);
          break;
        }
      }
      
      if (!ncxPath) {
        // 尝试查找常见的NCX文件名
        const commonNcxPaths = [
          'toc.ncx',
          opfDir ? `${opfDir}/toc.ncx` : 'toc.ncx',
          'OEBPS/toc.ncx',
          'content/toc.ncx'
        ];
        
        for (const path of commonNcxPaths) {
          if (zip.file(path)) {
            ncxPath = path;
            console.log(`找到NCX文件: ${ncxPath}`);
            break;
          }
        }
      }
      
      if (!ncxPath) {
        console.log('未找到NCX文件');
        return [];
      }
      
      // 尝试多种路径策略读取NCX文件
      const pathsToTry = [
        ncxPath,
        opfDir && opfDir !== '.' ? `${opfDir}/${ncxPath}` : ncxPath
      ];
      
      let ncxFile = null;
      for (const path of pathsToTry) {
        ncxFile = zip.file(path);
        if (ncxFile) {
          console.log(`成功找到NCX文件: ${path}`);
          break;
        }
      }
      
      if (!ncxFile) {
        console.log(`无法读取NCX文件: ${pathsToTry.join(', ')}`);
        return [];
      }
      
      const ncxContent = await ncxFile.async('text');
      const ncxData = await parseStringPromise(ncxContent);
      
      if (!ncxData.ncx?.navMap?.[0]?.navPoint) {
        console.log('NCX文件格式无效');
        return [];
      }
      
      const tocItems = this.parseNcxNavMap(ncxData.ncx.navMap[0].navPoint);
      return tocItems;
    } catch (error) {
      console.error('从NCX文件提取目录失败:', error);
      return [];
    }
  }
  
  /**
   * 从HTML/XHTML文件中提取div结构目录
   * @param zip EPUB文件的ZIP对象
   * @param manifest 清单项目列表
   * @param opfDir OPF文件所在目录
   * @returns 目录项数组
   */
  private async extractTocFromHtmlFiles(zip: JSZip, manifest: any[], opfDir: string): Promise<TocItem[]> {
    try {
      const tocItems: TocItem[] = [];
      
      // 查找可能包含目录的HTML/XHTML文件
      for (const item of manifest) {
        const href = item.$?.href || '';
        const mediaType = item.$?.['media-type'] || '';
        
        if (mediaType.includes('html') || 
            href.toLowerCase().includes('toc') || 
            href.toLowerCase().includes('contents') || 
            href.toLowerCase().includes('index')) {
          
          const pathsToTry = [
            href,
            opfDir && opfDir !== '.' ? `${opfDir}/${href}` : href
          ];
          
          let htmlFile = null;
          for (const path of pathsToTry) {
            htmlFile = zip.file(path);
            if (htmlFile) break;
          }
          
          if (htmlFile) {
            const htmlContent = await htmlFile.async('text');
            const extractedItems = this.parseHtmlTocContent(htmlContent);
            if (extractedItems.length > 0) {
              console.log(`从 ${href} 提取到 ${extractedItems.length} 个目录项`);
              tocItems.push(...extractedItems);
              break; // 找到一个有效的目录文件就停止
            }
          }
        }
      }
      
      return tocItems;
    } catch (error) {
      console.error('从HTML文件提取目录失败:', error);
      return [];
    }
  }
  
  /**
   * 解析nav.xhtml文件内容
   * @param navContent nav.xhtml文件内容
   * @returns 目录项数组
   */
  private parseNavXhtmlContent(navContent: string): TocItem[] {
    try {
      const tocItems: TocItem[] = [];
      
      // 使用正则表达式提取<li><a>结构
      const liPattern = /<li[^>]*>\s*<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>\s*<\/li>/gi;
      let match;
      let index = 1;
      
      while ((match = liPattern.exec(navContent)) !== null) {
        const href = match[1];
        const title = match[2].trim();
        
        if (title && href) {
          tocItems.push({
            id: uuidv4(),
            title,
            level: 1,
            href,
            parent_id: null
          });
        }
        index++;
      }
      
      console.log(`从nav.xhtml解析到 ${tocItems.length} 个目录项`);
      return tocItems;
    } catch (error) {
      console.error('解析nav.xhtml内容失败:', error);
      return [];
    }
  }
  
  /**
   * 解析HTML文件中的目录内容
   * @param htmlContent HTML文件内容
   * @returns 目录项数组
   */
  private parseHtmlTocContent(htmlContent: string): TocItem[] {
    try {
      const tocItems: TocItem[] = [];
      
      // 检查是否包含目录相关的内容
      const tocKeywords = ['目录', 'contents', 'toc', '章', 'chapter', '第.*章', '第.*节'];
      const hasTableOfContents = tocKeywords.some(keyword => 
        htmlContent.toLowerCase().includes(keyword.toLowerCase()) ||
        new RegExp(keyword, 'i').test(htmlContent)
      );
      
      if (!hasTableOfContents) {
        return [];
      }
      
      // 提取div中的链接结构
      const divPattern = /<div[^>]*>([\s\S]*?)<\/div>/gi;
      const linkPattern = /<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      
      let divMatch;
      while ((divMatch = divPattern.exec(htmlContent)) !== null) {
        const divContent = divMatch[1];
        let linkMatch;
        
        while ((linkMatch = linkPattern.exec(divContent)) !== null) {
          const href = linkMatch[1];
          const title = linkMatch[2].trim();
          
          // 过滤掉明显不是章节的链接
          if (title && href && 
              (title.includes('章') || title.includes('Chapter') || 
               title.includes('第') || /\d+/.test(title))) {
            tocItems.push({
              id: uuidv4(),
              title,
              level: 1,
              href,
              parent_id: null
            });
          }
        }
      }
      
      return tocItems;
    } catch (error) {
      console.error('解析HTML目录内容失败:', error);
      return [];
    }
  }

  private parseNcxNavMap(navPoints: any[], level: number = 1, parentId: string | null = null): TocItem[] {
    const tocItems: TocItem[] = [];
    
    if (!Array.isArray(navPoints)) {
      navPoints = [navPoints];
    }

    for (const navPoint of navPoints) {
      const id = uuidv4();
      const title = navPoint.navLabel[0].text[0];
      const href = navPoint.content[0].$?.src || '';
      
      const tocItem: TocItem = {
        id,
        title,
        level,
        href,
        parent_id: parentId
      };
      
      tocItems.push(tocItem);
      
      // 递归处理子项
      if (navPoint.navPoint) {
        const children = this.parseNcxNavMap(navPoint.navPoint, level + 1, id);
        tocItems.push(...children);
      }
    }
    
    return tocItems;
  }

  private extractTocFromSpine(opfData: any): TocItem[] {
    try {
      console.log('从spine提取目录结构...');
      const spine = opfData.package.spine[0].itemref;
      const manifest = opfData.package.manifest[0].item;
      const tocItems: TocItem[] = [];
      
      if (!Array.isArray(spine)) {
        console.log('spine不是数组格式');
        return [];
      }

      console.log(`spine包含 ${spine.length} 个项目`);
      for (let i = 0; i < spine.length; i++) {
        const itemref = spine[i];
        const idref = itemref.$?.idref;
        
        if (!idref) {
          console.log(`spine项目 ${i} 缺少idref`);
          continue;
        }
        
        const manifestItem = manifest.find((item: any) => item.$?.id === idref);
        if (!manifestItem) {
          console.log(`未找到ID为 ${idref} 的清单项`);
          continue;
        }
        
        const href = manifestItem.$?.href;
        const title = `第${i + 1}章`;
        
        tocItems.push({
          id: uuidv4(),
          title,
          level: 1,
          href,
          parent_id: null
        });
      }
      
      console.log(`从spine提取到 ${tocItems.length} 个目录项`);
      return tocItems;
    } catch (error) {
      console.error('从spine提取目录错误:', error);
      return [];
    }
  }
}