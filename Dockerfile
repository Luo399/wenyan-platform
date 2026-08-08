# ============ 构建阶段（Docker 化部署重构）============
# 编译 sqlite3 等原生模块所需的 gcc/python3/make
FROM node:18-slim AS builder

WORKDIR /build

# 安装编译依赖
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# 只复制 package.json，充分利用 Docker 层缓存
COPY backend/package.json ./
RUN npm install --production

# ============ 运行阶段 ============
FROM node:18-slim

WORKDIR /app

# 安装运行时依赖（ca-certificates 用于 HTTPS 请求）
RUN apt-get update && apt-get install -y \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制已编译的 node_modules
COPY --from=builder /build/node_modules ./node_modules

# 复制后端代码
COPY backend/ .

# 创建数据持久化目录（通过 docker-compose 卷挂载覆盖）
RUN mkdir -p /app/database /app/data /app/logs

# 暴露端口（实际端口由环境变量 PORT 控制）
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 安全：非 root 用户运行
USER node

CMD ["node", "server.js"]