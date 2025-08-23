import React, { useState } from 'react';
import { Brain, BookOpen, Download, Copy, Play, CheckCircle, Clock, Tag } from 'lucide-react';

// 数据类型定义
interface Chapter {
  id: string;
  chapter_title: string;
  chapter_viewpoint: string;
  chapter_keywords: string[];
  arguments: Argument[];
  analyzed: boolean;
}

interface Argument {
  statement: string;
  positive_case: string[];
  negative_case: string[];
  citations: Citation[];
}

interface Citation {
  cited_source: string;
  cited_type: '书籍' | '文章' | '故事' | '权威观点';
  viewpoint: string;
}

interface BookSummary {
  book_intro: string;
  author_intro: string;
  core_problem: string;
  core_keywords: string[];
  generated: boolean;
}

const AnalysisReport: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [analyzingChapter, setAnalyzingChapter] = useState<string | null>(null);
  // TODO: 从后端API获取真实的章节数据
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // TODO: 从后端API获取真实的书籍总结数据
  const [bookSummary, setBookSummary] = useState<BookSummary>({
    book_intro: '',
    author_intro: '',
    core_problem: '',
    core_keywords: [],
    generated: false
  });

  const handleAnalyzeChapters = async () => {
    setIsAnalyzing(true);
    
    try {
      // TODO: 调用后端API进行章节分析
      // const analysisResults = await apiService.analyzeChapters(fileId);
      // setChapters(analysisResults);
      alert('章节分析功能需要连接后端API');
    } catch (error) {
      alert('章节分析失败，请重试');
    } finally {
      setAnalyzingChapter(null);
      setIsAnalyzing(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    
    try {
      // TODO: 调用后端API生成书籍总结
      // const summary = await apiService.generateBookSummary(fileId);
      // setBookSummary({ ...summary, generated: true });
      alert('书籍总结功能需要连接后端API');
    } catch (error) {
      alert('生成书籍总结失败，请重试');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const generateFinalJSON = () => {
    // TODO: 从后端API获取完整的解析结果数据
    return {
      book_info: null, // 需要从API获取
      cover_info: null, // 需要从API获取
      book_summary: bookSummary.generated ? bookSummary : null,
      table_of_contents: [], // 需要从API获取
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
              
              <button
                onClick={handleAnalyzeChapters}
                disabled={isAnalyzing || analyzedCount === totalChapters}
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
                    <span>开始章节分析</span>
                  </>
                )}
              </button>
            </div>

            {/* 章节列表 */}
            <div className="space-y-4">
              {chapters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无章节数据，请先进行EPUB解析</p>
                </div>
              ) : (
                chapters.map((chapter) => (
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
                      {analyzingChapter === chapter.id && (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <span className="text-sm">分析中</span>
                        </div>
                      )}
                      {chapter.analyzed && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {!chapter.analyzed && analyzingChapter !== chapter.id && (
                        <Clock className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {chapter.analyzed && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">核心观点</h4>
                        <p className="text-sm text-gray-600">{chapter.chapter_viewpoint}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">关键词</h4>
                        <div className="flex flex-wrap gap-2">
                          {chapter.chapter_keywords.map((keyword, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              <Tag className="h-3 w-3 mr-1" />
                              {keyword}
                            </span>
                          ))}
                        </div>
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
                  <h3 className="font-medium text-green-900 mb-2">书籍简介</h3>
                  <p className="text-sm text-green-800">{bookSummary.book_intro}</p>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">作者简介</h3>
                  <p className="text-sm text-blue-800">{bookSummary.author_intro}</p>
                </div>
                
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h3 className="font-medium text-purple-900 mb-2">核心问题</h3>
                  <p className="text-sm text-purple-800">{bookSummary.core_problem}</p>
                </div>
                
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="font-medium text-yellow-900 mb-2">核心关键词</h3>
                  <div className="flex flex-wrap gap-2">
                    {bookSummary.core_keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-200 text-yellow-800"
                      >
                        {keyword}
                      </span>
                    ))}
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