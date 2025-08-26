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
- **多AI提供商支持**：支持DeepSeek、Kimi、OpenAI等多种AI模型
- **前端配置管理**：可视化AI配置界面，无需修改服务器配置
- **动态模型切换**：实时切换不同AI提供商，无需重启服务
- **连接测试功能**：一键测试AI配置的有效性
- **智能重试机制**：可配置重试次数和延迟时间
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
- AI API密钥（支持DeepSeek、Kimi、OpenAI等，用于AI分析功能）

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

编辑 `.env` 文件，配置服务器环境变量：
```env
# 服务器配置
PORT=3001
FRONTEND_URL=http://localhost:5173

# 文件存储配置
UPLOAD_DIR=uploads
SESSION_DIR=sessions
MAX_FILE_SIZE=52428800
MAX_FILE_AGE=86400000
```

**注意**：AI配置现在通过前端界面管理，无需在.env文件中配置API密钥。

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

6. **配置AI模型**
- 点击导航栏的"配置AI"按钮
- 选择AI提供商（DeepSeek、Kimi、OpenAI）
- 输入相应的API密钥和配置参数
- 测试连接确保配置正确
- 保存配置，开始使用AI分析功能

## 📁 项目结构

```
bookParse/
├── src/                    # 前端源码
│   ├── components/         # React组件
│   │   ├── AIConfigModal.tsx  # AI配置管理组件
│   │   ├── Navbar.tsx      # 导航栏组件
│   │   └── ...            # 其他组件
│   ├── pages/             # 页面组件
│   ├── services/          # API服务
│   │   ├── api.ts         # API调用服务
│   │   └── configService.ts # AI配置管理服务
│   ├── types/             # TypeScript类型定义
│   └── utils/             # 工具函数
├── api/                   # 后端源码
│   ├── ai/                # AI服务提供者
│   │   ├── deepseek-provider.ts    # DeepSeek提供者
│   │   ├── universal-provider.ts   # 通用AI提供者
│   │   └── providers/     # 其他AI提供者
│   ├── core/              # 核心解析器
│   │   ├── analyzers/     # 章节分析器
│   │   └── parsers/       # 文件解析器
│   ├── routes/            # API路由
│   │   ├── ai.ts          # AI相关路由
│   │   ├── books.ts       # 书籍处理路由
│   │   └── auth.ts        # 认证路由
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

1. **配置AI模型**：首次使用需要配置AI提供商和API密钥
2. **上传文件**：选择EPUB格式的电子书文件
3. **基础解析**：提取书籍基本信息和目录结构
4. **章节拆分**：按指定层级拆分章节内容
5. **AI分析**：使用配置的AI模型对章节进行深度分析
6. **查看结果**：浏览分析报告和总结
7. **历史管理**：查看和管理解析历史

## 🔧 AI配置管理

### 支持的AI提供商
- **DeepSeek**：深度求索AI，专业的代码和文本分析
- **Kimi**：月之暗面AI，支持长文本处理
- **OpenAI**：OpenAI GPT模型，通用AI助手

### 配置参数
- **API密钥**：各AI提供商的访问密钥
- **API地址**：API服务端点URL
- **模型名称**：使用的具体模型
- **最大Token数**：单次请求的最大token限制
- **温度参数**：控制输出的随机性（0-1）
- **最大重试次数**：请求失败时的重试次数（1-10次）
- **重试延迟**：重试间隔时间（0.1-60分钟）

### 配置存储
- 配置信息安全存储在浏览器localStorage中
- 支持多个AI提供商的配置同时保存
- 可以随时切换不同的AI提供商
- 支持配置的导入导出功能

## 🔑 获取AI API密钥

### DeepSeek
1. 注册DeepSeek账号：https://platform.deepseek.com
2. 获取API密钥
3. 在前端配置界面中输入密钥

### Kimi (月之暗面)
1. 注册Kimi账号：https://platform.moonshot.cn
2. 获取API密钥
3. 在前端配置界面中输入密钥

### OpenAI
1. 注册OpenAI账号：https://platform.openai.com
2. 获取API密钥
3. 在前端配置界面中输入密钥

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