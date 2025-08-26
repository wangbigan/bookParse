// 书籍解析API路由
import express, { Request } from 'express';
import multer from 'multer';

// 扩展Request类型以包含file属性
interface MulterRequest extends Request {
  file?: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  };
}
import { v4 as uuidv4 } from 'uuid';
import { FileManager } from '../storage/file-manager';
import { ParserFactory } from '../core/parsers/parser-factory';
import { ChapterSplitter } from '../core/analyzers/chapter-splitter';
import { DeepSeekProvider } from '../ai/deepseek-provider';
import { UniversalAIProvider, AIConfig } from '../ai/universal-provider';
import { BookParseSession, OperationLog, ParseResult, ChapterAnalysisResult, BookSummary } from '../types/book.types';

const router = express.Router();

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/epub+zip' || file.originalname.endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('只支持EPUB格式的文件'));
    }
  }
});

// 初始化服务
const fileManager = new FileManager();
const parserFactory = new ParserFactory();
// 创建DeepSeek提供者实例（向后兼容）
const deepSeekProvider = new DeepSeekProvider();

/**
 * 从请求头中提取AI配置
 */
function extractAIConfig(req: express.Request): AIConfig | null {
  return UniversalAIProvider.parseConfigFromHeaders(req.headers);
}

/**
 * 获取AI提供者实例
 */
function getAIProvider(req: express.Request): UniversalAIProvider | DeepSeekProvider {
  const aiConfig = extractAIConfig(req);
  
  if (aiConfig) {
    console.log(`使用动态AI配置: ${aiConfig.provider}`);
    return UniversalAIProvider.create(aiConfig);
  } else {
    console.log('使用默认DeepSeek配置');
    return deepSeekProvider;
  }
}

/**
 * POST /api/books/upload
 * 上传电子书文件
 */
router.post('/upload', upload.single('file'), async (req: MulterRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    // 保存文件并创建会话
    const { fileId, filePath, session } = await fileManager.saveUploadedFile(
      req.file.buffer,
      req.file.originalname
    );

    // 更新会话状态
    await fileManager.updateSession(fileId, {
      status: 'uploaded',
      progress: 10
    });

    res.json({
      success: true,
      data: {
        fileId,
        session
      },
      message: '文件上传成功'
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '文件上传失败'
    });
  }
});

/**
 * POST /api/books/:fileId/parse
 * 解析电子书基本信息
 */
router.post('/:fileId/parse', async (req, res) => {
  try {
    const { fileId } = req.params;
    const session = fileManager.getSession(fileId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }

    // 更新状态
    await fileManager.updateSession(fileId, {
      status: 'parsing',
      progress: 20
    });

    // 添加日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '开始解析',
      status: 'in_progress',
      message: '正在解析电子书基本信息...'
    });

    // 创建解析器
    const parser = ParserFactory.createParser(session.filepath);
    if (!parser) {
      throw new Error('不支持的文件格式');
    }

    // 解析基本信息
    const parseResult = await parser.parse(session.filepath);
    
    // 更新会话
    await fileManager.updateSession(fileId, {
      status: 'parsed',
      progress: 50,
      parseResult
    });

    // 添加成功日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '解析完成',
      status: 'completed',
      message: '电子书基本信息解析完成',
      details: {
        title: parseResult.bookInfo.title,
        author: parseResult.bookInfo.author,
        chaptersCount: parseResult.tableOfContents.length
      }
    });

    res.json({
      success: true,
      data: {
        session: fileManager.getSession(fileId),
        parseResult
      },
      message: '解析完成'
    });
  } catch (error) {
    console.error('解析失败:', error);
    
    // 更新失败状态
    await fileManager.updateSession(req.params.fileId, {
      status: 'error',
      error: error.message
    });

    // 添加错误日志
    await fileManager.addLog(req.params.fileId, {
      id: uuidv4(),
      fileId: req.params.fileId,
      timestamp: new Date(),
      operation: '解析失败',
      status: 'error',
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message || '解析失败'
    });
  }
});

/**
 * POST /api/books/:fileId/split
 * 拆分章节
 */
router.post('/:fileId/split', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { level = 1 } = req.body;
    const session = fileManager.getSession(fileId);
    
    if (!session || !session.parseResult) {
      return res.status(404).json({
        success: false,
        message: '请先解析电子书基本信息'
      });
    }

    // 更新状态
    await fileManager.updateSession(fileId, {
      status: 'splitting',
      progress: 60
    });

    // 添加日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '章节拆分',
      status: 'in_progress',
      message: `正在按第${level}级目录拆分章节...`
    });

    // 检查是否有目录结构
    if (!session.parseResult.tableOfContents || session.parseResult.tableOfContents.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少目录结构，无法进行章节拆分'
      });
    }

    // 创建章节拆分器
    const splitter = new ChapterSplitter();
    await splitter.initialize(session.filepath);
    
    // 拆分章节 - 使用正确的方法和参数
    const chapters = await splitter.splitChapters(session.parseResult.tableOfContents, { level });
    const stats = splitter.getChapterStats(chapters);
    
    // 更新解析结果
    const updatedParseResult = {
      ...session.parseResult,
      chapters,
      chapterStats: stats
    };

    // 更新会话
    await fileManager.updateSession(fileId, {
      status: 'split',
      progress: 70,
      parseResult: updatedParseResult
    });

    // 添加成功日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '章节拆分完成',
      status: 'completed',
      message: `成功拆分为${chapters.length}个章节`,
      details: {
          chaptersCount: chapters.length,
          totalWords: stats.totalWords,
          averageWords: stats.averageWords
        }
    });

    // 清理资源
    await splitter.cleanup();

    res.json({
      success: true,
      data: {
        session: fileManager.getSession(fileId),
        chapters,
        stats
      },
      message: '章节拆分完成'
    });
  } catch (error) {
    console.error('章节拆分失败:', error);
    
    // 更新失败状态
    await fileManager.updateSession(req.params.fileId, {
      status: 'error',
      error: error.message
    });

    // 添加错误日志
    await fileManager.addLog(req.params.fileId, {
      id: uuidv4(),
      fileId: req.params.fileId,
      timestamp: new Date(),
      operation: '章节拆分失败',
      status: 'error',
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message || '章节拆分失败'
    });
  }
});

/**
 * POST /api/books/:fileId/analyze
 * AI分析章节
 */
router.post('/:fileId/analyze', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { chapterIndexes, analysisType = 'full' } = req.body;
    
    // 获取AI配置
    const aiConfig = extractAIConfig(req);
    const aiProvider = getAIProvider(req);
    
    // 检查AI配置
    if (aiConfig && aiProvider instanceof UniversalAIProvider && !aiProvider.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'AI配置不完整，请检查API密钥等配置信息'
      });
    }
    
    const session = fileManager.getSession(fileId);
    
    if (!session || !session.parseResult?.chapters) {
      return res.status(404).json({
        success: false,
        message: '请先拆分章节'
      });
    }

    // 更新状态
    await fileManager.updateSession(fileId, {
      status: 'analyzing',
      progress: 80
    });

    // 添加日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: 'AI分析',
      status: 'in_progress',
      message: `正在进行AI章节分析...${aiConfig ? ` - 使用: ${aiConfig.provider}` : ''}`
    });

    const chapters = session.parseResult.chapters;
    console.log(`[DEBUG] 总章节数: ${chapters.length}, 请求分析章节索引:`, chapterIndexes);
    
    const targetChapters = chapterIndexes 
      ? chapterIndexes.map((index: number) => {
          if (index >= 0 && index < chapters.length) {
            console.log(`[DEBUG] 选择章节 ${index}: ${chapters[index].title}`);
            return chapters[index];
          }
          console.warn(`[DEBUG] 无效章节索引: ${index}`);
          return null;
        }).filter(Boolean)
      : chapters;

    console.log(`[DEBUG] 实际分析章节数: ${targetChapters.length}`);
    
    // 批量分析章节
    let analysisResults;
    if (aiProvider instanceof UniversalAIProvider) {
      // 使用通用AI提供者
      analysisResults = [];
      for (const chapter of targetChapters) {
        const result = await aiProvider.analyzeChapter(chapter, analysisType);
        analysisResults.push(result);
      }
    } else {
      // 使用DeepSeek提供者
      analysisResults = await aiProvider.analyzeChaptersBatch(
        targetChapters,
        analysisType
      );
    }
    
    console.log(`[DEBUG] 分析结果数量: ${analysisResults.length}`);
    
    // 如果是单章节分析，需要将结果映射回正确的位置并保留现有数据
    let finalAnalysisResults = analysisResults;
    if (chapterIndexes && chapterIndexes.length > 0) {
      // 获取现有的章节分析结果，如果没有则创建新数组
      const existingAnalysis = session.parseResult?.chapterAnalysis || new Array(chapters.length).fill(null);
      finalAnalysisResults = [...existingAnalysis]; // 复制现有结果
      
      // 将新的分析结果更新到正确的位置
      chapterIndexes.forEach((originalIndex, resultIndex) => {
        if (resultIndex < analysisResults.length && originalIndex >= 0 && originalIndex < chapters.length) {
          finalAnalysisResults[originalIndex] = analysisResults[resultIndex];
          console.log(`[DEBUG] 更新章节分析结果: 索引 ${originalIndex} <- 结果 ${resultIndex}`);
        }
      });
      
      console.log(`[DEBUG] 单章节分析 - 保留现有结果并更新指定章节`);
    }

    // 移除自动生成书籍总结的逻辑，改为由前端用户主动触发
    // 章节分析完成后不再自动生成书籍总结
    let bookSummary = null;
    console.log(`[DEBUG] 章节分析完成，跳过自动书籍总结生成 - 等待用户主动触发`);

    // 更新解析结果（不包含自动生成的书籍总结）
    const updatedParseResult = {
      ...session.parseResult,
      chapterAnalysis: finalAnalysisResults,
      bookSummary: session.parseResult?.bookSummary || null // 保留现有的书籍总结（如果有的话）
    };
    
    console.log(`[DEBUG] 准备保存分析结果到会话 - 章节数量: ${finalAnalysisResults.length}`);
    console.log(`[DEBUG] 已分析章节索引:`, finalAnalysisResults.map((result, index) => result ? index : null).filter(i => i !== null));

    // 更新会话
    await fileManager.updateSession(fileId, {
      status: 'completed',
      progress: 100,
      parseResult: updatedParseResult
    });
    
    console.log(`[DEBUG] 分析结果已保存到会话数据`);

    // 添加成功日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: 'AI分析完成',
      status: 'completed',
      message: `成功分析${analysisResults.length}个章节`,
      details: {
        analyzedChapters: analysisResults.length,
        totalArguments: analysisResults.reduce((sum, result) => sum + result.arguments.length, 0),
        totalQuotes: analysisResults.reduce((sum, result) => sum + result.quotes.length, 0),
        requestedIndexes: chapterIndexes || 'all',
        aiProvider: aiConfig?.provider || 'deepseek'
      }
    });

    console.log(`[DEBUG] 返回分析结果数量: ${finalAnalysisResults.length}`);

    res.json({
      success: true,
      data: {
        session: fileManager.getSession(fileId),
        analysisResults: finalAnalysisResults,
        bookSummary
      },
      message: 'AI分析完成'
    });
  } catch (error) {
    console.error('AI分析失败:', error);
    
    // 更新失败状态
    await fileManager.updateSession(req.params.fileId, {
      status: 'error',
      error: error.message
    });

    // 添加错误日志
    await fileManager.addLog(req.params.fileId, {
      id: uuidv4(),
      fileId: req.params.fileId,
      timestamp: new Date(),
      operation: 'AI分析失败',
      status: 'error',
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message || 'AI分析失败'
    });
  }
});

/**
 * GET /api/books/:fileId
 * 获取解析会话信息
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const session = fileManager.getSession(fileId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }

    res.json({
      success: true,
      data: {
        session,
        logs: fileManager.getLogs(fileId)
      }
    });
  } catch (error) {
    console.error('获取会话失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取会话失败'
    });
  }
});

/**
 * GET /api/books/:fileId/logs
 * 获取操作日志
 */
router.get('/:fileId/logs', async (req, res) => {
  try {
    const { fileId } = req.params;
    const logs = fileManager.getLogs(fileId);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取日志失败'
    });
  }
});

/**
 * GET /api/books
 * 获取所有会话（历史记录）
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let sessions = fileManager.getAllSessions();
    
    // 状态筛选
    if (status && status !== 'all') {
      sessions = sessions.filter(session => session.status === status);
    }
    
    // 排序（最新的在前）
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    // 分页
    const total = sessions.length;
    const paginatedSessions = sessions.slice(
      Number(offset),
      Number(offset) + Number(limit)
    );
    
    res.json({
      success: true,
      data: {
        sessions: paginatedSessions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total
        }
      }
    });
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取历史记录失败'
    });
  }
});

/**
 * DELETE /api/books/:fileId
 * 删除会话
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    await fileManager.deleteSession(fileId);
    
    res.json({
      success: true,
      message: '会话删除成功'
    });
  } catch (error) {
    console.error('删除会话失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除会话失败'
    });
  }
});

/**
 * POST /api/books/:fileId/generate-summary
 * 生成书籍总结
 */
router.post('/:fileId/generate-summary', async (req, res) => {
  try {
    const { fileId } = req.params;
    const session = fileManager.getSession(fileId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }

    if (!session.parseResult) {
      return res.status(400).json({
        success: false,
        message: '解析结果不存在，请先进行EPUB解析'
      });
    }

    if (!session.parseResult.chapterAnalysis || session.parseResult.chapterAnalysis.length === 0) {
      return res.status(400).json({
        success: false,
        message: '章节分析结果不存在，请先进行章节分析'
      });
    }

    // 检查是否有足够的章节分析数据
    const validAnalysis = session.parseResult.chapterAnalysis.filter(analysis => analysis !== null);
    if (validAnalysis.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有有效的章节分析数据，请先完成章节分析'
      });
    }

    // 添加日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '开始生成书籍总结',
      status: 'in_progress',
      message: `基于${validAnalysis.length}个章节分析生成书籍总结`
    });

    console.log(`[DEBUG] 开始生成书籍总结 - 文件ID: ${fileId}, 有效章节分析数: ${validAnalysis.length}`);

    // 调用DeepSeek生成书籍总结
    const bookSummary = await deepSeekProvider.generateBookSummary(
      session.parseResult.bookInfo,
      validAnalysis
    );

    console.log(`[DEBUG] 书籍总结生成完成`);

    // 更新解析结果
    const updatedParseResult = {
      ...session.parseResult,
      bookSummary
    };

    // 更新会话
    await fileManager.updateSession(fileId, {
      parseResult: updatedParseResult
    });

    // 添加成功日志
    await fileManager.addLog(fileId, {
      id: uuidv4(),
      fileId,
      timestamp: new Date(),
      operation: '书籍总结生成完成',
      status: 'completed',
      message: '成功生成书籍总结',
      details: {
        themes: bookSummary.mainThemes.length,
        insights: bookSummary.keyInsights.length,
        rating: bookSummary.rating
      }
    });

    console.log(`[DEBUG] 书籍总结已保存到会话数据`);

    res.json({
      success: true,
      data: {
        session: fileManager.getSession(fileId),
        bookSummary
      },
      message: '书籍总结生成完成'
    });
  } catch (error) {
    console.error('生成书籍总结失败:', error);
    
    // 添加错误日志
    await fileManager.addLog(req.params.fileId, {
      id: uuidv4(),
      fileId: req.params.fileId,
      timestamp: new Date(),
      operation: '书籍总结生成失败',
      status: 'error',
      message: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message || '生成书籍总结失败'
    });
  }
});

/**
 * GET /api/books/stats
 * 获取存储统计信息
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await fileManager.getStorageStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取统计信息失败'
    });
  }
});

export default router;