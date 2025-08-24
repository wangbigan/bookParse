import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Brain, BookOpen, Download, Copy, Play, CheckCircle, Clock, Tag, RotateCcw, Zap } from 'lucide-react';
import apiService from '../services/api';
import { BookParseSession, ChapterAnalysisResult, BookSummary, ArgumentInfo } from '../types/book';
import { historyManager } from '../utils/historyManager';

// 本地章节数据类型（用于UI显示）
interface Chapter {
  id: string;
  chapter_title: string;
  chapter_viewpoint: string;
  chapter_keywords: string[];
  arguments: ArgumentInfo[];
  analyzed: boolean;
}

// 本地书籍总结类型（扩展原有类型）
interface LocalBookSummary extends BookSummary {
  generated: boolean;
}

const AnalysisReport: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // 获取文件ID，优先使用URL参数，其次使用最近的记录
  const getFileId = (): string | null => {
    const urlFileId = searchParams.get('fileId');
    if (urlFileId) return urlFileId;
    
    // 尝试获取最近的记录ID
    const latestRecord = historyManager.getLatestRecord();
    if (latestRecord) {
      console.log('分析报告页面使用最近的文件记录:', latestRecord.id, latestRecord.bookTitle);
      return latestRecord.id;
    }
    
    return null;
  };
  
  const fileId = getFileId();
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [analyzingChapter, setAnalyzingChapter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 单章节分析状态管理
  const [singleAnalyzing, setSingleAnalyzing] = useState<Set<string>>(new Set());
  const [singleAnalysisErrors, setSingleAnalysisErrors] = useState<Map<string, string>>(new Map());
  const [session, setSession] = useState<BookParseSession | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  
  // 添加书籍基础信息状态管理
  const [bookInfo, setBookInfo] = useState<any>(null);
  const [coverInfo, setCoverInfo] = useState<any>(null);
  const [tableOfContents, setTableOfContents] = useState<any[]>([]);

  const [bookSummary, setBookSummary] = useState<LocalBookSummary>({
    overview: '',
    mainThemes: [],
    keyInsights: [],
    structure: '',
    writingStyle: '',
    targetAudience: '',
    strengths: [],
    weaknesses: [],
    recommendation: '',
    rating: 0,
    tags: [],
    generatedDate: new Date(),
    generated: false
  });

  /**
   * 从API获取会话数据和章节数据
   */
  useEffect(() => {
    const fetchSessionData = async () => {
      if (!fileId) {
        setError('缺少文件ID参数');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // 获取会话信息
        const { session: sessionData } = await apiService.getSession(fileId);
        setSession(sessionData);
        
        // 从解析结果中获取基础信息
        if (sessionData.parseResult) {
          // 设置书籍基础信息
          if (sessionData.parseResult.bookInfo) {
            setBookInfo(sessionData.parseResult.bookInfo);
            console.log('[DEBUG] 从后端恢复书籍信息:', sessionData.parseResult.bookInfo);
          }
          
          if (sessionData.parseResult.coverInfo) {
            setCoverInfo(sessionData.parseResult.coverInfo);
            console.log('[DEBUG] 从后端恢复封面信息:', sessionData.parseResult.coverInfo);
          }
          
          if (sessionData.parseResult.tableOfContents) {
            setTableOfContents(sessionData.parseResult.tableOfContents);
            console.log('[DEBUG] 从后端恢复目录信息，条目数:', sessionData.parseResult.tableOfContents.length);
          }
        }
        
        // 如果会话状态为已拆分，获取章节数据
          if (sessionData.status === 'split' || sessionData.status === 'analyzing' || sessionData.status === 'completed') {
           // 从会话的解析结果中获取章节数据
           if (sessionData.parseResult?.chapters && sessionData.parseResult.chapters.length > 0) {
             const analysisData = sessionData.parseResult?.chapterAnalysis || [];
             
             // 一次性合并章节数据和分析结果
             const chaptersData = sessionData.parseResult.chapters.map((chapter, index: number) => {
               const analysis = analysisData[index];
               return {
                 id: chapter.index?.toString() || `chapter-${index}`,
                 chapter_title: chapter.title || `第${index + 1}章`,
                 chapter_viewpoint: analysis?.summary || '',
                 chapter_keywords: analysis?.keyPoints || [],
                 arguments: analysis?.arguments || [],
                 analyzed: analysis ? true : false
               };
             });
             
             setChapters(chaptersData);
             console.log(`[DEBUG] 从后端恢复章节数据，总数: ${chaptersData.length}, 已分析: ${chaptersData.filter(ch => ch.analyzed).length}`);
           }
         }
      } catch (error) {
        console.error('获取会话数据失败:', error);
        setError(error instanceof Error ? error.message : '获取数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionData();
  }, [fileId]);

  /**
   * 重置章节分析状态
   */
  const handleResetAnalysis = () => {
    // 如果有已分析的章节，显示确认对话框
    if (analyzedCount > 0) {
      const confirmed = window.confirm(
        `确定要重置所有章节分析状态吗？\n\n这将清除已分析的 ${analyzedCount} 个章节的所有数据，包括：\n• 核心观点\n• 关键词\n• 论证信息\n• 书籍总结\n\n此操作无法撤销。`
      );
      if (!confirmed) {
        return;
      }
    }
    
    // 重置所有章节的分析状态
    const resetChapters = chapters.map(chapter => ({
      ...chapter,
      chapter_viewpoint: '',
      chapter_keywords: [],
      arguments: [],
      analyzed: false
    }));
    setChapters(resetChapters);
    
    // 重置书籍总结状态
    setBookSummary({
      overview: '',
      mainThemes: [],
      keyInsights: [],
      structure: '',
      writingStyle: '',
      targetAudience: '',
      strengths: [],
      weaknesses: [],
      recommendation: '',
      rating: 0,
      tags: [],
      generatedDate: new Date(),
      generated: false
    });
    
    // 清除错误状态和分析状态
    setError(null);
    setAnalyzingChapter(null);
    setIsAnalyzing(false);
    setIsGeneratingSummary(false);
    
    // 清除单章节分析状态
    setSingleAnalyzing(new Set());
    setSingleAnalysisErrors(new Map());
    
    console.log('章节分析状态已重置');
  };

  /**
   * 处理单章节分析
   */
  const handleAnalyzeSingleChapter = async (chapterId: string) => {
    if (!fileId) {
      alert('缺少文件ID，无法进行分析');
      return;
    }

    // 找到对应的章节
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (!chapter) {
      alert('章节不存在');
      return;
    }

    // 更新单章节分析状态
    setSingleAnalyzing(prev => {
      const newSet = new Set([...prev, chapterId]);
      console.log(`[DEBUG] 更新singleAnalyzing状态，添加章节ID: ${chapterId}，当前状态:`, Array.from(newSet));
      return newSet;
    });
    setSingleAnalysisErrors(prev => {
      const newMap = new Map(prev);
      newMap.delete(chapterId);
      return newMap;
    });
    
    try {
      // 获取章节索引
      let chapterIndex: number;
      if (/^\d+$/.test(chapter.id)) {
        // 如果章节ID是纯数字字符串（如"0", "1", "2"）
        chapterIndex = parseInt(chapter.id);
      } else if (chapter.id.startsWith('chapter-')) {
        // 如果章节ID是chapter-格式（如"chapter-0", "chapter-1"）
        chapterIndex = parseInt(chapter.id.replace('chapter-', ''));
      } else {
        // 其他情况，使用findIndex作为fallback
        chapterIndex = chapters.findIndex(ch => ch.id === chapterId);
      }
      
      console.log(`[DEBUG] 单章节分析 - 章节ID: ${chapterId}, 索引: ${chapterIndex}`);
      console.log(`[DEBUG] 开始单章节分析，章节ID: ${chapterId}, 章节索引: ${chapterIndex}`);
      
      // 调用后端API进行单章节分析
      const { analysisResults } = await apiService.analyzeChapters(fileId, [chapterIndex], 'full');
      
      console.log(`[DEBUG] 单章节分析结果:`, analysisResults);
      
      // 更新该章节的分析结果
      if (analysisResults && analysisResults.length > 0) {
        // 单章节分析时，后端返回的数组长度等于总章节数，分析结果在对应的索引位置
        const analysisResult = analysisResults[chapterIndex];
        
        console.log(`[DEBUG] 单章节分析结果 (章节索引 ${chapterIndex}):`, analysisResult);
        console.log(`[DEBUG] 分析结果数组长度: ${analysisResults.length}, 查找索引: ${chapterIndex}`);
        
        if (analysisResult && analysisResult !== null) {
          // 更新本地状态
          setChapters(prev => prev.map(ch => {
            if (ch.id === chapterId) {
              console.log(`[DEBUG] 更新章节 ${chapterId} 的分析结果`);
              return {
                ...ch,
                chapter_viewpoint: analysisResult.summary || ch.chapter_viewpoint,
                chapter_keywords: analysisResult.keyPoints || ch.chapter_keywords,
                arguments: analysisResult.arguments || ch.arguments,
                analyzed: true
              };
            }
            return ch;
          }));
          
          // 同步数据到后端 - 单章节分析已经通过analyzeChapters API调用自动保存到后端
          console.log(`[DEBUG] 单章节分析结果已自动保存到后端会话数据`);
        } else {
          console.warn(`[DEBUG] 单章节分析没有返回有效结果，索引 ${chapterIndex} 处的结果为:`, analysisResult);
          throw new Error('单章节分析没有返回有效结果');
        }
      } else {
        console.warn(`[DEBUG] 单章节分析没有返回分析结果`);
        throw new Error('单章节分析没有返回分析结果');
      }
      
    } catch (error) {
      console.error(`单章节分析失败 [${chapter.chapter_title}]:`, error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setSingleAnalysisErrors(prev => {
        const newMap = new Map(prev);
        newMap.set(chapterId, `分析失败: ${errorMessage}`);
        console.log(`[DEBUG] 单章节分析错误，章节ID: ${chapterId}，错误信息:`, errorMessage);
        return newMap;
      });
    } finally {
      // 清除该章节的分析中状态
      setSingleAnalyzing(prev => {
        const newSet = new Set(prev);
        newSet.delete(chapterId);
        console.log(`[DEBUG] 单章节分析完成，移除章节ID: ${chapterId}，当前状态:`, Array.from(newSet));
        return newSet;
      });
    }
  };

  /**
   * 处理章节分析
   */
  const handleAnalyzeChapters = async () => {
    if (!fileId) {
      alert('缺少文件ID，无法进行分析');
      return;
    }

    setIsAnalyzing(true);
    setError(null); // 清除之前的错误
    
    try {
      // 调用后端API进行章节分析
      const { session: updatedSession, analysisResults, bookSummary: summary } = await apiService.analyzeChapters(fileId);
      
      // 更新会话状态
      setSession(updatedSession);
      
      // 更新章节分析结果
       if (analysisResults && analysisResults.length > 0) {
         const updatedChapters = chapters.map((chapter, index) => {
           const analysisResult = analysisResults[index];
           if (analysisResult) {
             return {
               ...chapter,
               chapter_viewpoint: analysisResult.summary || chapter.chapter_viewpoint,
               chapter_keywords: analysisResult.keyPoints || chapter.chapter_keywords,
               arguments: analysisResult.arguments || chapter.arguments,
               analyzed: true
             };
           }
           return chapter;
         });
         setChapters(updatedChapters);
       }
       
       // 更新书籍总结
       if (summary) {
         setBookSummary({ ...summary, generated: true });
       }
      
    } catch (error) {
      console.error('章节分析失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setError(`章节分析失败: ${errorMessage}`);
    } finally {
      setAnalyzingChapter(null);
      setIsAnalyzing(false);
    }
  };

  /**
   * 处理生成书籍总结
   */
  const handleGenerateSummary = async () => {
    if (!fileId) {
      alert('缺少文件ID，无法生成书籍总结');
      return;
    }

    setIsGeneratingSummary(true);
    
    try {
      console.log('[DEBUG] 开始生成书籍总结...');
      
      // 调用后端API生成书籍总结
      const { session: updatedSession, bookSummary: generatedSummary } = await apiService.generateBookSummary(fileId);
      
      console.log('[DEBUG] 书籍总结生成成功:', generatedSummary);
      
      // 更新本地状态
      setBookSummary({
        ...generatedSummary,
        generated: true
      });
      
      // 更新会话状态
      setSession(updatedSession);
      
      console.log('[DEBUG] 前端状态已更新');
      
    } catch (error) {
      console.error('[ERROR] 生成书籍总结失败:', error);
      const errorMessage = error instanceof Error ? error.message : '生成书籍总结失败，请重试';
      alert(errorMessage);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  /**
   * 生成最终的JSON结果数据
   * @returns 包含完整解析和分析结果的JSON对象
   */
  const generateFinalJSON = () => {
    return {
      book_info: bookInfo,
      cover_info: coverInfo,
      book_summary: bookSummary.generated ? bookSummary : null,
      table_of_contents: tableOfContents,
      chapters: chapters
    };
  };

  const handleCopyJSON = () => {
    const jsonData = JSON.stringify(generateFinalJSON(), null, 2);
    navigator.clipboard.writeText(jsonData);
    alert('JSON数据已复制到剪贴板！');
  };

  const handleDownloadJSON = () => {
    const jsonData = JSON.stringify(generateFinalJSON(), null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'book_analysis_result.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const analyzedCount = chapters.filter(ch => ch.analyzed).length;
  const totalChapters = chapters.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 页面标题 */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              🧠 分析报告
            </h1>
            <p className="text-lg text-gray-600">
              AI深度分析章节内容，生成结构化的书籍分析报告
            </p>
          </div>

          {/* 章节分析模块 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <Brain className="h-5 w-5 text-blue-600" />
                <span>章节分析</span>
                <span className="text-sm text-gray-500 font-normal">
                  ({analyzedCount}/{totalChapters})
                </span>
              </h2>
              
              <div className="flex items-center space-x-3">
                {/* 重新开始按钮 */}
                {(analyzedCount > 0 || error) && (
                  <button
                    onClick={handleResetAnalysis}
                    disabled={isAnalyzing}
                    className="
                      flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg
                      hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                      transition-colors font-medium
                    "
                    title="重置所有章节分析状态，重新开始分析"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>重新开始</span>
                  </button>
                )}
                
                {/* 开始/继续分析按钮 */}
                <button
                  onClick={handleAnalyzeChapters}
                  disabled={isAnalyzing || analyzedCount === totalChapters || isLoading || chapters.length === 0}
                  className="
                    flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg
                    hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                    transition-colors font-medium
                  "
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>分析中...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5" />
                      <span>{analyzedCount > 0 ? '继续分析' : '开始章节分析'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 错误信息显示 */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800 mb-1">章节分析出现问题</h3>
                    <p className="text-red-700 text-sm mb-3">{error}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleResetAnalysis}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        重新开始分析
                      </button>
                      <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 transition-colors"
                      >
                        刷新页面
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 章节列表 */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p>正在加载章节数据...</p>
                </div>
              ) : chapters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>
                    {!fileId 
                      ? '没有找到可用的文件记录，请先上传并解析电子书文件。' 
                      : session?.status === 'parsed' 
                      ? '请先进行章节拆分' 
                      : '暂无章节数据，请先进行EPUB解析和章节拆分'
                    }
                  </p>
                  {!fileId && (
                    <button
                      onClick={() => navigate('/')}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      返回首页
                    </button>
                  )}
                </div>
              ) : (
                chapters.map((chapter, index) => (
                  <div
                    key={chapter.id}
                    className={`
                      border rounded-lg p-4 transition-all duration-200
                      ${
                        analyzingChapter === chapter.id
                          ? 'border-blue-300 bg-blue-50'
                          : chapter.analyzed
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }
                    `}
                  >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{chapter.chapter_title}</h3>
                    <div className="flex items-center space-x-2">
                      {/* 单章节分析按钮 */}
                      {!chapter.analyzed && !singleAnalyzing.has(chapter.id) && analyzingChapter !== chapter.id && !isAnalyzing && (
                        <button
                          onClick={() => {
                            console.log(`[DEBUG] 点击分析按钮，章节ID: ${chapter.id}, 索引: ${index}`);
                            handleAnalyzeSingleChapter(chapter.id);
                          }}
                          className="
                            flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-xs
                            hover:bg-blue-700 transition-colors font-medium
                          "
                          title="分析此章节"
                        >
                          <Zap className="h-3 w-3" />
                          <span>分析</span>
                        </button>
                      )}
                      
                      {/* 状态图标 */}
                      {(analyzingChapter === chapter.id || singleAnalyzing.has(chapter.id)) && (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm">
                            {singleAnalyzing.has(chapter.id) ? '单独分析中' : '分析中'}
                          </span>
                        </div>
                      )}
                      {chapter.analyzed && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {!chapter.analyzed && analyzingChapter !== chapter.id && !singleAnalyzing.has(chapter.id) && (
                        <Clock className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* 单章节分析错误信息 */}
                  {singleAnalysisErrors.has(chapter.id) && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <svg className="h-4 w-4 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm text-red-600">{singleAnalysisErrors.get(chapter.id)}</p>
                          <button
                             onClick={() => {
                               console.log(`[DEBUG] 重新分析按钮，章节ID: ${chapter.id}, 索引: ${index}`);
                               handleAnalyzeSingleChapter(chapter.id);
                             }}
                            className="mt-1 text-xs text-red-700 hover:text-red-900 underline"
                          >
                            重新分析
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {chapter.analyzed && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">核心观点</h4>
                        {chapter.chapter_viewpoint ? (
                          <p className="text-sm text-gray-600">{chapter.chapter_viewpoint}</p>
                        ) : (
                          <div className="flex items-center space-x-2 text-amber-600">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm">解析失败，无法获取摘要</span>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">关键词</h4>
                        {chapter.chapter_keywords.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {chapter.chapter_keywords.map((keyword, index) => (
                              <span
                                key={`${chapter.id}-keyword-${index}`}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                              >
                                <Tag className="h-3 w-3 mr-1" />
                                {keyword}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 text-amber-600">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm">解析失败，无法获取关键词</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 书籍总结模块 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <span>书籍总结</span>
              </h2>
              
              <button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary || !bookSummary.generated && analyzedCount < totalChapters}
                className="
                  flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg
                  hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                  transition-colors font-medium
                "
              >
                {isGeneratingSummary ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <Brain className="h-5 w-5" />
                    <span>生成总结</span>
                  </>
                )}
              </button>
            </div>

            {bookSummary.generated ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-2">书籍概述</h3>
                  <p className="text-sm text-green-800">{bookSummary.overview}</p>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">主要主题</h3>
                  <div className="flex flex-wrap gap-2">
                    {bookSummary.mainThemes.map((theme, index) => (
                      <span
                        key={`theme-${index}`}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h3 className="font-medium text-purple-900 mb-2">关键洞察</h3>
                  <div className="space-y-2">
                    {bookSummary.keyInsights.map((insight, index) => (
                      <p key={`insight-${index}`} className="text-sm text-purple-800">• {insight}</p>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-medium text-yellow-900 mb-2">推荐理由</h3>
                  <p className="text-sm text-yellow-800">{bookSummary.recommendation}</p>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="text-sm text-yellow-700">评分:</span>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <span key={`star-${i}`} className={`text-lg ${i < bookSummary.rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>请先完成章节分析，然后生成书籍总结</p>
              </div>
            )}
          </div>

          {/* 结果导出模块 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
              <Download className="h-5 w-5 text-blue-600" />
              <span>结果导出</span>
            </h2>

            <div className="space-y-4">
              {/* JSON预览 */}
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 text-sm">
                  <code>{JSON.stringify(generateFinalJSON(), null, 2)}</code>
                </pre>
              </div>

              {/* 导出按钮 */}
              <div className="flex space-x-4">
                <button
                  onClick={handleCopyJSON}
                  className="
                    flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg
                    hover:bg-gray-700 transition-colors
                  "
                >
                  <Copy className="h-4 w-4" />
                  <span>复制JSON</span>
                </button>
                
                <button
                  onClick={handleDownloadJSON}
                  className="
                    flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                    hover:bg-blue-700 transition-colors
                  "
                >
                  <Download className="h-4 w-4" />
                  <span>下载JSON文件</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisReport;