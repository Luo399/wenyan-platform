# ============ 构建阶段（Docker 化部署重构）============
# 与 package.json engines（^20.19.0 || >=22.12.0）对齐，使用 Node 22 LTS
# 编译 sqlite3 等原生模块所需的 gcc/python3/make
FROM node:22-slim AS builder

WORKDIR /build

# 安装编译依赖
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# 复制 package.json + lock，充分利用 Docker 层缓存并做确定性安装
COPY backend/package.json backend/package-lock.json ./
# 用锁文件安装（当前 backend/package-lock.json 与 package.json 的依赖声明一致）。
# 若未来 lock 不同步导致 npm ci 报 "lock file does not satisfy"，改用：
#   RUN npm install --omit=dev --no-audit --no-fund
# 原因见 .trae/rules/project-workflow.md：后端 lock 历史上曾与 package.json 不同步。
RUN npm ci --omit=dev --no-audit --no-fund

# ============ 运行阶段 ============
FROM node:22-slim

WORKDIR /app

# 安装运行时依赖（ca-certificates 用于 HTTPS 请求）
RUN apt-get update && apt-get install -y \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制已编译的 node_modules
COPY --from=builder /build/node_modules ./node_modules

# 复制后端代码
COPY backend/ .

# 创建数据持久化目录（通过 docker-compose 卷挂载覆盖），并归属非 root 运行用户
RUN mkdir -p /app/database /app/data /app/logs \
  && chown -R node:node /app/database /app/data /app/logs

# 生产运行时环境
ENV NODE_ENV=production

# 暴露端口（实际端口由环境变量 PORT 控制）
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 安全：非 root 用户运行
USER node

CMD ["node", "server.js"]
