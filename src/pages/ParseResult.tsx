import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Book, User, Calendar, Building, Hash, Globe, Scissors, Play, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { apiService } from '../services/api';
import { BookParseSession, ParseResult as ParseResultType, BookInfo, CoverInfo, TableOfContentsItem, ChapterContent, ChapterStats } from '../types/book';

// 使用从book.ts导入的类型，移除本地重复定义
// BookInfo, CoverInfo, TableOfContentsItem 已从 '../types/book' 导入

const ParseResult: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // 从URL参数或location.state中获取文件ID
  const actualFileId = fileId || (location.state as any)?.recordId;
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isSplitCompleted, setIsSplitCompleted] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  
  // 数据状态
  const [session, setSession] = useState<BookParseSession | null>(null);
  const [parseResult, setParseResult] = useState<ParseResultType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从解析结果中提取数据
  const bookInfo = parseResult?.bookInfo || null;
  const tocStructure = parseResult?.tableOfContents || [];
  const coverInfo = parseResult?.coverInfo;
  const chapters = parseResult?.chapters || [];
  const chapterStats = parseResult?.chapterStats;

  /**
   * 处理章节拆分
   */
  const handleSplitChapters = useCallback(async () => {
    console.log('=== 开始章节拆分调试信息 ===');
    console.log('actualFileId:', actualFileId);
    console.log('selectedLevel:', selectedLevel);
    console.log('isSplitting:', isSplitting);
    console.log('tocStructure:', tocStructure);
    console.log('tocStructure.length:', tocStructure?.length);
    console.log('session:', session);
    console.log('parseResult:', parseResult);
    console.log('loading:', loading);
    console.log('error:', error);
    console.log('location.state:', (location.state as any));
    console.log('fileId from params:', fileId);
    console.log('=== 调试信息结束 ===');
    
    if (!actualFileId) {
      console.error('❌ 缺少文件ID');
      alert('缺少文件ID，无法进行章节拆分');
      return;
    }

    if (!tocStructure || tocStructure.length === 0) {
      console.error('❌ 缺少目录结构');
      console.log('tocStructure详情:', {
        tocStructure,
        length: tocStructure?.length,
        type: typeof tocStructure,
        isArray: Array.isArray(tocStructure)
      });
      alert('缺少目录结构，无法进行章节拆分');
      return;
    }

    if (isSplitting) {
      console.warn('⚠️ 正在拆分中，忽略重复点击');
      return;
    }

    console.log('✅ 所有检查通过，开始拆分');
    console.log('设置拆分状态为true');
    setIsSplitting(true);
    
    try {
      console.log('📡 调用API进行章节拆分...');
      console.log('API参数:', { fileId: actualFileId, level: selectedLevel });
      
      const result = await apiService.splitChapters(actualFileId, selectedLevel);
      console.log('✅ 章节拆分API调用成功:', result);
      
      const { session: updatedSession } = result;
      setSession(updatedSession);
      
      if (updatedSession.parseResult) {
        console.log('📝 更新解析结果');
        setParseResult(updatedSession.parseResult);
      }
      
      // 设置拆分完成状态
      setIsSplitCompleted(true);
      
      console.log('🎉 章节拆分完成');
      alert(`拆分完成！已按照${selectedLevel}级目录完成章节拆分，现在可以进行章节分析。`);
    } catch (error) {
      console.error('❌ 章节拆分失败:', error);
      console.error('错误详情:', {
        message: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
        error,
        actualFileId,
        selectedLevel,
        tocStructure: tocStructure?.length
      });
      
      const errorMessage = error instanceof Error ? error.message : '章节拆分失败，请重试';
      alert(`章节拆分失败: ${errorMessage}`);
    } finally {
      console.log('🔄 设置拆分状态为false');
      setIsSplitting(false);
    }
  }, [actualFileId, selectedLevel, isSplitting, tocStructure, session, parseResult, loading, error, location.state, fileId]);

  /**
   * 跳转到分析报告页面
   */
  const handleGoToAnalysis = useCallback(() => {
    if (!actualFileId) {
      alert('缺少文件ID，无法跳转到分析页面');
      return;
    }
    
    // 跳转到分析报告页面，传递文件ID
    navigate(`/analysis-report?fileId=${actualFileId}`);
  }, [actualFileId, navigate]);

  /**
   * 重新拆分章节
   */
  const handleReSplit = useCallback(() => {
    // 重置拆分完成状态，允许用户重新选择层级并拆分
    setIsSplitCompleted(false);
    
    // 清空当前章节数据
    if (parseResult) {
      setParseResult({
        ...parseResult,
        chapters: [],
        chapterStats: undefined
      });
    }
    
    console.log('重置拆分状态，用户可以重新选择层级进行拆分');
  }, [parseResult]);

  /**
   * 加载解析会话数据
   */
  const loadSessionData = async () => {
    if (!actualFileId) {
      setError('缺少文件ID参数');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { session: sessionData } = await apiService.getSession(actualFileId);
      setSession(sessionData);
      
      if (sessionData.parseResult) {
        setParseResult(sessionData.parseResult);
        
        // 如果已经有章节数据，说明拆分已完成
        if (sessionData.parseResult.chapters && sessionData.parseResult.chapters.length > 0) {
          setIsSplitCompleted(true);
        }
      } else {
        setError('解析结果不存在，请重新解析');
      }
    } catch (err) {
      console.error('加载会话数据失败:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    console.log('🔄 useEffect触发，actualFileId:', actualFileId);
    loadSessionData();
  }, [actualFileId]);

  // 调试用：监听关键状态变化
  useEffect(() => {
    console.log('📊 状态变化监听:', {
      actualFileId,
      loading,
      error,
      isSplitting,
      tocStructureLength: tocStructure?.length,
      sessionExists: !!session,
      parseResultExists: !!parseResult
    });
  }, [actualFileId, loading, error, isSplitting, tocStructure, session, parseResult]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  /**
   * 切换章节内容的展开/折叠状态
   */
  const toggleChapterExpanded = (chapterIndex: number) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterIndex)) {
      newExpanded.delete(chapterIndex);
    } else {
      newExpanded.add(chapterIndex);
    }
    setExpandedChapters(newExpanded);
  };



  const renderTocItem = (item: TableOfContentsItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const levelColors = {
      1: 'text-blue-700 bg-blue-50 border-blue-200',
      2: 'text-green-700 bg-green-50 border-green-200',
      3: 'text-purple-700 bg-purple-50 border-purple-200'
    };

    return (
      <div key={item.id} className="">
        <div
          className={`
            flex items-center space-x-2 p-3 rounded-lg border cursor-pointer
            hover:shadow-sm transition-all duration-200
            ${levelColors[item.level as keyof typeof levelColors] || 'text-gray-700 bg-gray-50 border-gray-200'}
          `}
          onClick={() => hasChildren && toggleExpanded(item.id)}
        >
          {/* 层级缩进 */}
          <div style={{ marginLeft: `${(item.level - 1) * 20}px` }} className="flex items-center space-x-2">
            {/* 展开/折叠图标 */}
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}

            {/* 类型图标 */}
            <div className="flex-shrink-0">
              {item.level === 1 ? '📄' : item.level === 2 ? '📝' : '📋'}
            </div>

            {/* 标题 */}
            <span className="font-medium">{item.title}</span>
          </div>

          {/* 层级标签 */}
          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-white bg-opacity-70">
            {item.level}级
          </span>
        </div>

        {/* 子项 */}
        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-2">
            {item.children!.map(child => renderTocItem(child))}
          </div>
        )}
      </div>
    );
  };

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">加载中...</h2>
          <p className="text-gray-600">正在获取解析结果</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadSessionData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* 页面标题 */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              📊 解析结果
            </h1>
            <p className="text-lg text-gray-600">
              电子书解析完成，查看书籍信息和目录结构
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 书籍信息展示 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <Book className="h-5 w-5 text-blue-600" />
                <span>书籍信息</span>
              </h2>

              {/* 封面图片展示区 */}
              <div className="mb-6">
                {(coverInfo?.url || (coverInfo as any)?.cover_image) ? (
                  <img
                    src={coverInfo?.url || (coverInfo as any)?.cover_image}
                    alt="书籍封面"
                    className="w-32 h-48 object-cover rounded-lg shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-48 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    📚
                    <br />
                    无封面
                  </div>
                )}
              </div>

              {/* 信息列表 */}
              <div className="space-y-4">
                {bookInfo ? (
                  <>
                    <div className="flex items-start space-x-3">
                      <Book className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-500">书名</div>
                        <div className="font-medium text-gray-900">{bookInfo.title}</div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <User className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-500">作者</div>
                        <div className="font-medium text-gray-900">{bookInfo.author}</div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-500">出版社</div>
                        <div className="font-medium text-gray-900">{bookInfo.publisher}</div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Hash className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-500">ISBN</div>
                        <div className="font-medium text-gray-900">{bookInfo.isbn}</div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-500">出版日期</div>
                        <div className="font-medium text-gray-900">{bookInfo.publishDate}</div>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-500">语言</div>
                        <div className="font-medium text-gray-900">{bookInfo.language}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">📚</div>
                    <p className="text-gray-500">暂无书籍信息</p>
                    <p className="text-sm text-gray-400">请先上传并解析电子书</p>
                  </div>
                )}
              </div>
            </div>

            {/* 目录结构展示 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <div className="text-blue-600">📋</div>
                <span>目录结构</span>
                <span className="text-sm text-gray-500 font-normal">({tocStructure.length}个章节)</span>
              </h2>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {tocStructure.length > 0 ? (
                  tocStructure.map(item => renderTocItem(item))
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">📋</div>
                    <p className="text-gray-500">暂无目录结构</p>
                    <p className="text-sm text-gray-400">请先上传并解析电子书</p>
                  </div>
                )}
              </div>
            </div>
          </div>



          {/* 章节拆分控制 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
              <Scissors className="h-5 w-5 text-blue-600" />
              <span>章节拆分</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 层级选择器 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  选择目录层级
                </label>
                <div className="space-y-2">
                  {[1, 2, 3].map(level => (
                    <label key={level} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="level"
                        value={level}
                        checked={selectedLevel === level}
                        onChange={(e) => setSelectedLevel(Number(e.target.value))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="text-sm text-gray-700">
                        {level}级目录 - 按照{level === 1 ? '章' : level === 2 ? '节' : '小节'}进行拆分
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-end">
                {!isSplitCompleted ? (
                  <button
                    onClick={handleSplitChapters}
                    disabled={isSplitting || !actualFileId || !tocStructure || tocStructure.length === 0}
                    className="
                      flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg
                      hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                      transition-colors font-medium w-full justify-center
                    "
                  >
                    {isSplitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>拆分中...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        <span>开始章节拆分</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex space-x-3 w-full">
                    <button
                      onClick={handleReSplit}
                      className="
                        flex items-center space-x-2 px-4 py-3 bg-gray-600 text-white rounded-lg
                        hover:bg-gray-700 transition-colors font-medium flex-1 justify-center
                      "
                    >
                      <Scissors className="h-5 w-5" />
                      <span>重新拆分</span>
                    </button>
                    <button
                      onClick={handleGoToAnalysis}
                      className="
                        flex items-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg
                        hover:bg-green-700 transition-colors font-medium flex-1 justify-center
                      "
                    >
                      <ArrowRight className="h-5 w-5" />
                      <span>下一步：章节分析</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 拆分说明和状态 */}
            <div className="mt-4 space-y-4">
              {/* 状态提示 */}
              {isSplitCompleted && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-2">
                    <div className="text-green-600">✅</div>
                    <h4 className="font-medium text-green-900">拆分完成</h4>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    章节拆分已完成，共生成 {chapters.length} 个章节。现在可以进行下一步章节分析。
                  </p>
                </div>
              )}
              
              {/* 拆分说明 */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">拆分说明</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 1级目录：按照主要章节进行拆分，适合快速概览</li>
                  <li>• 2级目录：按照章节小节进行拆分，平衡详细度和可读性</li>
                  <li>• 3级目录：按照最细粒度进行拆分，获得最详细的内容</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 章节拆分结果 */}
          {chapters.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
                <div className="text-green-600">📚</div>
                <span>章节拆分结果</span>
                <span className="text-sm text-gray-500 font-normal">({chapters.length}个章节)</span>
              </h2>

              {/* 章节统计信息 */}
              {chapterStats && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">📊 统计信息</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{chapterStats.totalChapters}</div>
                      <div className="text-sm text-gray-500">总章节数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{chapterStats.totalWords.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">总字数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{chapterStats.averageWords}</div>
                      <div className="text-sm text-gray-500">平均字数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{chapterStats.longestChapter.wordCount}</div>
                      <div className="text-sm text-gray-500">最长章节</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 章节列表 */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {chapters.map((chapter, index) => {
                  const isExpanded = expandedChapters.has(index);
                  const previewContent = chapter.content.length > 200 
                    ? chapter.content.substring(0, 200) + '...' 
                    : chapter.content;
                  
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      {/* 章节标题和信息 */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-medium text-gray-900 mb-1">
                            {chapter.title}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>第 {chapter.index + 1} 章</span>
                            <span>{chapter.level} 级目录</span>
                            <span>{chapter.wordCount} 字</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleChapterExpanded(index)}
                          className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              <span>收起</span>
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4" />
                              <span>展开</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* 章节内容 */}
                      <div className="text-gray-700 text-sm leading-relaxed">
                        {isExpanded ? (
                          <div className="whitespace-pre-wrap">{chapter.content}</div>
                        ) : (
                          <div>{previewContent}</div>
                        )}
                      </div>

                      {/* 展开提示 */}
                      {!isExpanded && chapter.content.length > 200 && (
                        <div className="mt-2 text-xs text-gray-400">
                          点击"展开"查看完整内容
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParseResult;