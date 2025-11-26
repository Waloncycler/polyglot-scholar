# Polyglot Scholar —— 智能文献翻译平台

Polyglot Scholar 是一个面向中文学术内容的翻译与润色工具，支持粘贴文本或上传 `.txt`/`.docx` 文件，基于多种主流大模型（GPT‑4o、DeepSeek‑Chat、Claude‑3‑Sonnet）实现高质量英文翻译。前端使用 React + TypeScript + Vite，后端提供基于 Express 的 API 代理与限流，内置 Swagger 文档。

## 文档与架构
详细的架构设计、模块说明及核心流程请参考 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 主要特性
- **多模型支持**：无缝切换 `GPT-4o`、`DeepSeek-Chat`、`Claude-3-Sonnet`。
- **智能长文本处理**：自动分段、断点续翻、上下文保持，解决长文献翻译中断问题。
- **格式支持**：支持直接粘贴文本或上传 `.txt`/`.docx`（自动提取纯文本）。
- **专业定制**：内置学术/油气行业/科技论文等多套预设提示词，支持自定义术语表。
- **隐私安全**：API 密钥仅存储在本地浏览器，后端仅做透明转发。

## 技术栈
- **前端**：React 19, TypeScript, Vite, Ant Design
- **后端**：Node.js, Express (作为 API 网关与限流代理)
- **工具**：Mammoth (.docx 解析), Swagger (API 文档)

## 快速开始
### 环境准备
- `Node.js >= 18`
- 使用 `npm`（或 `pnpm`/`yarn` 亦可，根据自己习惯）

### 安装依赖
- 根目录安装前端依赖：
  ```bash
  npm install
  ```
- 后端代理（`server/` 目录）安装依赖：
  ```bash
  cd server
  npm install
  ```

### 开发运行
- 启动后端代理（默认端口 `3001`）：
  ```bash
  cd server
  npm run dev
  ```
- 另开一个终端启动前端：
  ```bash
  npm run dev
  ```
- 访问前端：`http://localhost:5173`
- API 文档（Swagger）：`http://localhost:3001/api-docs`

> 开发环境下，`vite.config.ts` 已将 `/api` 代理到 `http://localhost:3001`，前端调用统一走 `/api/*`。

### 生产构建与预览
- 前端构建与预览：
  ```bash
  npm run build
  npm run preview
  ```
- 后端启动（生产）：
  ```bash
  cd server
  npm run start
  ```

## 使用说明
1. 在页面点击“显示配置”，输入对应模型的 `API 密钥`。
   > **注意**：系统当前仅存储一个 API Key。若切换不同厂商的模型（如从 GPT-4o 切换到 DeepSeek），请务必在配置面板更新对应的 Key。
2. 选择模型（顶部下拉）。
3. 在左侧输入框粘贴中文文本，或上传 `.txt` / `.docx` 文件。
4. 点击“翻译”，右侧区域显示翻译结果、用时与已完成段数。
5. 可在“自定义提示词/术语表”中添加领域术语或风格偏好。

## 代理与安全
- 前端通过 `/api` 访问后端，后端再代理到各模型官方接口：
  - OpenAI：`/api/openai/chat/completions`
  - DeepSeek：`/api/deepseek/chat/completions`
  - Anthropic：`/api/anthropic/messages`
- 客户端请求头会附带 `apikey`（小写），后端从 `req.headers.apikey` 读取并转发到第三方服务。
- 后端默认限流：每 IP 15 分钟内最多 100 次请求。
- 密钥只保存在浏览器本地存储，不会被服务端持久化。

## 目录结构（简要）
- `src/components/`：输入区（`TextInputArea`）、输出区（`OutputArea`）、配置面板（`ConfigPanel`）
- `src/services/translationService.ts`：分段策略、重试机制、统一请求/解析逻辑
- `src/utils/modelConfig.ts`：模型列表、提示词构造、本地存储键名
- `server/index.js`：Express 代理、限流、中转至 OpenAI/DeepSeek/Anthropic，Swagger 文档
- `scripts/extract-docx.cjs`：命令行抽取 `.docx` 的纯文本

## 文档抽取脚本
- 从 `.docx` 提取纯文本：
  ```bash
  node scripts/extract-docx.cjs <input.docx> [output.txt]
  # 未指定 output.txt 时，默认输出到同目录的同名 .txt
  ```

## 注意事项
- 需自备各模型的 `API 密钥`，并确保账户有调用额度。
- 长文本会自动分段并带上下文标记；如出现某段翻译失败，结果中会提示错误位置。
- 如需自定义端口，后端可设置环境变量 `PORT`（默认 `3001`）。

欢迎提交 Issue/PR 以完善功能与体验。
