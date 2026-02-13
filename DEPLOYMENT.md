# Polyglot Scholar 部署与运维手册

本文档详细说明了项目的架构设计、上线准备、Docker 容器化部署以及 CI/CD 自动化流程。

## 1. 架构设计 (Deployment Architecture)

为了简化部署，我们采用 **"All-in-One"** 容器策略：
- **前端构建**：React 应用被编译为静态文件 (`dist/`)。
- **后端服务**：Express 服务器不仅作为 API 代理，同时负责托管前端静态文件 (`public/`)。
- **优势**：只需部署一个 Docker 容器即可运行完整应用，无需配置复杂的 Nginx 反向代理。

## 2. Docker 容器化 (Dockerization)

项目使用多阶段构建 (Multi-stage Build) 的 `Dockerfile`，并内置安全加固措施。

### 2.1 镜像特性
- **基础镜像**：`node:20-alpine` (轻量级)
- **安全性**：使用非 root 用户 `appuser` 运行服务。
- **环境隔离**：前端构建环境与后端运行环境分离。

### 2.2 本地运行
```bash
# 构建镜像
docker build -t polyglot-scholar:latest .

# 运行容器
docker run -d -p 3000:3000 \
  --env-file .env \
  polyglot-scholar:latest
```

## 3. CI/CD 自动化部署

项目配置了 GitHub Actions (`.github/workflows/deploy.yml`) 实现 "Push-to-Deploy"。

### 3.1 环境变量配置 (GitHub Secrets)
请在仓库 Settings -> Secrets and variables -> Actions 中配置：
- `SERVER_HOST`: 生产服务器 IP
- `SERVER_USER`: SSH 用户名 (如 `root`)
- `SSH_PRIVATE_KEY`: SSH 私钥内容
- `SERVER_PORT`: (可选) SSH 端口，默认 22

### 3.2 部署流程
1.  **触发**：代码推送到 `main` 分支。
2.  **构建**：Lint 检查 -> 前端编译 -> Docker 镜像构建。
3.  **推送**：镜像自动推送到 GitHub Container Registry (GHCR)。
4.  **部署**：通过 SSH 触发服务器上的 `deploy.sh` 脚本，拉取新镜像并重启容器。

## 4. 运维指南 (Operations)

### 4.1 服务器初始化
首次部署前，请在服务器执行：
```bash
# 1. 登录 GHCR (使用 GitHub PAT)
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin

# 2. 准备目录与配置
mkdir -p ~/apps/polyglot-scholar
touch ~/apps/polyglot-scholar/.env
# 在 .env 中填入必要的环境变量 (如 PORT=3000)
```

### 4.2 手动更新
如果自动化流程失败，可手动触发更新：
```bash
cd ~/apps/polyglot-scholar
./deploy.sh ghcr.io/your-username/polyglot-scholar latest
```

### 4.3 查看日志
```bash
docker logs -f polyglot-scholar
```

## 5. 目录结构说明
```
/
├── Dockerfile          # 容器构建描述文件
├── .github/
│   └── workflows/      # CI/CD 配置
├── scripts/
│   └── deploy.sh       # 服务器端部署脚本
├── server/             # 后端代理服务
│   ├── index.js        # 入口文件 (托管静态资源 + API 代理)
│   └── public/         # (运行时自动生成) 前端静态资源
└── src/                # 前端源码
```
