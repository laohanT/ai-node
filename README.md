# Node-Study

## 项目概述

Node-Study 是一个基于 Node.js 和 Express 框架构建的企业级 Web 应用程序。该项目集成了人工智能聊天功能、检索增强生成 (RAG) 系统以及任务管理 (TODO) 功能（测试功能），旨在提供高效的 AI 交互和数据处理服务。

## 功能特性

- **AI 聊天**: 支持实时 AI 对话和流式响应
- **RAG 系统**: 基于检索增强生成的文档处理和问答功能
- **任务管理**: 提供 TODO 列表的增删改查操作
- **文件处理**: 支持 PDF 文档解析和 CSV 数据转换
- **RESTful API**: 提供标准化的 API 接口

## 技术栈

- **后端框架**: Node.js, Express.js
- **AI 集成**: LangChain Text Splitters, PDF 解析
- **数据处理**: Axios, Multer (文件上传)
- **其他工具**: CORS, Dotenv, Nodemon

## 安装与运行

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装步骤

1. 克隆项目到本地：
   ```bash
   git clone https://github.com/laohanT/ai-node.git
   cd node-study
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 配置环境变量：
   创建 `.env` 文件并配置必要的环境变量（如 API 密钥等）
   **端口**
    PORT=3001
    **AI大模型key**
    AI_SK_KEY
    **问题回答**
    AI_URL
    **向量生成**
    EMBEDDING_URL
    **高德地图key**
    GD_KEY
    **高德调用天气URL**
    WEATHER_URL

4. 启动应用：
   ```bash
   npm start
   ```

   应用将在 `http://localhost:3000` 上运行。

### 开发模式

使用 Nodemon 进行开发：
```bash
npx nodemon app.js
```

## 项目结构

```
node-study/
├── app.js                 # 应用入口文件
├── package.json           # 项目配置和依赖
├── README.md              # 项目文档
├── ai-node/               # AI 相关模块
├── constant/              # 常量文件
│   └── area.json          # 区域数据
├── controllers/           # 控制器层
│   ├── aiChatController.js    # AI 聊天控制器
│   ├── aiController.js        # AI 控制器
│   ├── ragController.js       # RAG 控制器
│   └── todoController.js      # TODO 控制器
├── public/                # 静态资源
│   ├── index.html         # 主页面
│   └── styles.css         # 样式文件
├── routes/                # 路由层
│   ├── aiChatRoute.js     # AI 聊天路由
│   ├── aiRoute.js         # AI 路由
│   ├── ragRoute.js        # RAG 路由
│   └── todoRoute.js       # TODO 路由
├── services/              # 服务层
│   ├── ragServices.js     # RAG 服务
│   └── toolService.js     # 工具服务
└── utils/                 # 工具函数
    ├── config.js          # 配置文件
    ├── data.csv           # 示例数据
    └── output.json        # 输出数据
```

## API 文档

### AI 聊天 API

- `POST /chat` - 发送聊天消息
- `POST /chat/stream` - 流式聊天响应
- `POST /chatMessage` - 聊天消息管理

### RAG API

- `POST /rag` - RAG 查询和文档处理

### TODO API

- `GET /todos` - 获取所有任务
- `POST /todos` - 创建新任务
- `PUT /todos/:id` - 更新任务
- `DELETE /todos/:id` - 删除任务

详细的 API 文档请参考各控制器的实现代码。

## 开发指南

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 Node.js 最佳实践
- 使用 async/await 处理异步操作

### 测试

当前项目暂无自动化测试。建议添加单元测试和集成测试。

### 部署

1. 确保生产环境配置正确
2. 使用 PM2 或 Docker 进行部署
3. 配置反向代理（如 Nginx）
4. 目前使用railway + GitHub 自动化部署

## 贡献

欢迎提交 Issue 和 Pull Request。请确保：

1. 代码符合项目规范
2. 添加必要的测试
3. 更新相关文档

## 许可证

ISC License

## 联系方式

如有问题或建议，请通过以下方式联系：

- 项目维护者: [您的姓名]
- 邮箱: [您的邮箱]

---

*最后更新: 2024年4月17日*