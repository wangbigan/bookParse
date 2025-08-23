# 📚 电子书解析AI工具

一个智能化的电子书内容分析平台，支持EPUB格式电子书的解析、章节拆分和AI深度分析。

## ✨ 功能特性

### 📖 电子书解析
- **EPUB格式支持**：完整解析EPUB文件结构
- **书籍信息提取**：自动提取标题、作者、出版社等元数据
- **封面图片处理**：提取并优化封面图片
- **目录结构分析**：智能识别章节层级关系

### 🔍 章节拆分
- **多层级拆分**：支持按不同目录层级拆分章节
- **内容清理**：自动移除HTML标签，保留纯文本
- **统计分析**：提供字数统计、章节数量等信息

### 🤖 AI智能分析
- **DeepSeek集成**：使用DeepSeek API进行深度内容分析
- **章节摘要**：自动生成每章节的核心要点
- **论据提取**：识别并分析文中的论点和证据
- **引用分析**：提取重要引用和上下文
- **主题识别**：自动识别书籍主题和情感色彩
- **书籍总结**：生成完整的书籍分析报告

### 📊 数据管理
- **历史记录**：本地存储解析历史，支持断点续传
- **进度跟踪**：实时显示解析进度和状态
- **操作日志**：详细记录每个操作步骤
- **批量管理**：支持批量删除和导出功能

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 pnpm
- DeepSeek API密钥（用于AI分析功能）

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd bookParse
```

2. **安装依赖**
```bash
npm install
# 或
pnpm install
```

3. **环境配置**
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：
```env
# DeepSeek API配置
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# 服务器配置
PORT=3001
FRONTEND_URL=http://localhost:5173
```

4. **启动服务**
```bash
# 启动完整服务（前端+后端）
npm run dev

# 或分别启动
npm run client:dev  # 前端开发服务器
npm run server:dev  # 后端API服务器
```

5. **访问应用**
- 前端界面：http://localhost:5173
- 后端API：http://localhost:3001
- API文档：http://localhost:3001/api/health

## 📁 项目结构

```
bookParse/
├── src/                    # 前端源码
│   ├── components/         # React组件
│   ├── pages/             # 页面组件
│   ├── services/          # API服务
│   ├── types/             # TypeScript类型定义
│   └── utils/             # 工具函数
├── api/                   # 后端源码
│   ├── ai/                # AI服务提供者
│   ├── core/              # 核心解析器
│   │   ├── analyzers/     # 章节分析器
│   │   └── parsers/       # 文件解析器
│   ├── routes/            # API路由
│   ├── storage/           # 存储管理
│   └── types/             # 后端类型定义
├── uploads/               # 文件上传目录
├── sessions/              # 会话存储目录
└── supabase/              # 数据库迁移文件
```

## 🔧 API接口

### 文件上传
```http
POST /api/books/upload
Content-Type: multipart/form-data

参数：
- file: EPUB文件
```

### 解析电子书
```http
POST /api/books/:fileId/parse
```

### 拆分章节
```http
POST /api/books/:fileId/split
Content-Type: application/json

{
  "level": 1  // 目录层级
}
```

### AI分析
```http
POST /api/books/:fileId/analyze
Content-Type: application/json

{
  "chapterIndexes": [0, 1, 2],  // 可选，指定章节
  "analysisType": "full"        // basic | detailed | full
}
```

### 历史记录
```http
GET /api/books?status=all&limit=50&offset=0
```

## 🎯 使用流程

1. **上传文件**：选择EPUB格式的电子书文件
2. **基础解析**：提取书籍基本信息和目录结构
3. **章节拆分**：按指定层级拆分章节内容
4. **AI分析**：使用AI对章节进行深度分析
5. **查看结果**：浏览分析报告和总结
6. **历史管理**：查看和管理解析历史

## 🔑 DeepSeek API配置

本项目使用DeepSeek API进行AI分析，需要：

1. 注册DeepSeek账号：https://platform.deepseek.com
2. 获取API密钥
3. 在 `.env` 文件中配置 `DEEPSEEK_API_KEY`

## 📊 数据格式

### 解析结果JSON格式
```json
{
  "bookInfo": {
    "title": "书籍标题",
    "author": "作者",
    "publisher": "出版社",
    "isbn": "ISBN号码",
    "language": "语言"
  },
  "tableOfContents": [
    {
      "id": "章节ID",
      "title": "章节标题",
      "level": 1,
      "href": "链接地址"
    }
  ],
  "chapterAnalysis": [
    {
      "chapterTitle": "章节标题",
      "summary": "章节摘要",
      "keyPoints": ["要点1", "要点2"],
      "arguments": [
        {
          "point": "论点",
          "evidence": "证据",
          "strength": "strong"
        }
      ],
      "quotes": [
        {
          "text": "引用文本",
          "context": "上下文",
          "significance": "重要性"
        }
      ]
    }
  ],
  "bookSummary": {