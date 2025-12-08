# 构建阶段
FROM node:20-alpine as builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建应用
# 如果需要指定子路径，可以在 build 时传入环境变量，例如 --build-arg BASE_PATH=/my-app
ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN npm run build

# 运行阶段
FROM node:20-alpine

WORKDIR /app

# 复制 package.json 用于安装生产依赖
COPY package*.json ./

# 只安装生产依赖 (express 等)
RUN npm install --only=production

# 复制构建产物和服务器脚本
COPY --from=builder /app/dist ./dist
COPY server.js .

# 暴露端口 (默认 3000，运行时可覆盖)
EXPOSE 3000

# 设置环境变量默认值
ENV PORT=3000
ENV NODE_ENV=production

# 启动命令
CMD ["node", "server.js"]
