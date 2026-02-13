# Polyglot Scholar Deployment Skill Guide

本文档基于 `Universal_extractor` 生产实践，针对本项目（React + Express All-in-One）进行了适配。

## 1. 核心架构 (Architecture)

我们采用 **"All-in-One Container"** 策略，简化运维复杂度。
- **镜像**：单镜像包含前端静态资源与后端 API 代理。
- **Registry**：使用 GitHub Container Registry (GHCR)。
- **部署**：GitHub Actions 自动构建并 SSH 触发服务器更新。

## 2. 容器化标准 (Dockerization)

参考 `SCAFFOLD_GUIDE.md`，我们实施以下优化：
- **多阶段构建**：分离构建环境与运行环境。
- **非 Root 用户**：创建 `appuser` 运行服务，提升安全性。
- **精简镜像**：使用 `node:20-alpine`。

## 3. 自动化部署流程 (CI/CD)

### 3.1 触发机制
- `push to main`: 触发构建 -> 推送镜像 -> 部署到生产服务器。

### 3.2 环境变量 (Secrets)
需要在 GitHub Repository Settings -> Secrets and variables -> Actions 中配置：
- `SERVER_HOST`: 服务器 IP
- `SERVER_USER`: SSH 用户名 (e.g., root)
- `SSH_PRIVATE_KEY`: SSH 私钥内容
- `SERVER_PORT`: (可选) SSH 端口，默认 22

### 3.3 服务器端准备
首次部署前，请在服务器执行：
```bash
# 1. 登录 GHCR (使用 GitHub PAT)
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin

# 2. 准备目录
mkdir -p ~/apps/polyglot-scholar
```

## 4. 运维操作 (Operations)

### 手动更新
如果 CI/CD 失败，可手动在服务器执行：
```bash
cd ~/apps/polyglot-scholar
./deploy.sh ghcr.io/your-username/polyglot-scholar latest
```

### 查看日志
```bash
docker logs -f polyglot-scholar
```
