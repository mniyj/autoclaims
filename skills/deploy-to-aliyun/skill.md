# 阿里云部署 Skill

自动生成部署到阿里云（或其他云服务器）所需的脚本和配置文件。

## 触发关键词

- "部署到阿里云"
- "deploy to aliyun"
- "服务器部署"
- "生产环境部署"
- "生成部署脚本"

## 功能

1. **自动检测项目类型**: Vite/React, Next.js, Node.js API, 静态站点等
2. **生成部署脚本**: `deploy.sh` - 一键部署到服务器
3. **生成 PM2 配置**: `ecosystem.config.cjs` - 进程管理配置
4. **生成服务器脚本**: `server.js` - Express 静态服务器（如需要）
5. **生成初始化脚本**: `init-server.sh` - 首次部署服务器初始化
6. **端口冲突检测**: 部署前检查目标端口是否被占用

## 使用方式

调用此 skill 后，会询问以下信息：

1. **服务器IP地址**: 默认读取已有配置或提示输入
2. **部署端口**: 默认 3000，会检测冲突
3. **SSH密钥路径**: 默认 ~/.ssh/id_rsa 或指定路径
4. **服务器用户**: 默认 root
5. **部署目录**: 默认 /var/www/项目名

## 生成的文件

```
project-root/
├── deploy.sh              # 部署脚本（可执行）
├── ecosystem.config.cjs   # PM2 配置
├── server.js              # Express 服务器（如需要）
├── init-server.sh         # 服务器初始化脚本（首次使用）
└── .env.example           # 环境变量示例
```

## 部署流程

### 首次部署（服务器初始化）

```bash
# 1. 在服务器上运行初始化脚本
ssh root@your-server "bash -s" < init-server.sh

# 2. 本地执行部署
chmod +x deploy.sh
./deploy.sh your-server-ip
```

### 日常部署

```bash
./deploy.sh your-server-ip [user] [ssh-key-path] [port]
```

## 技术细节

### 支持的项目类型

| 类型 | 检测方式 | 构建命令 | 静态目录 |
|------|----------|----------|----------|
| Vite | vite.config.* | npm run build | dist/ |
| Next.js | next.config.* | npm run build | .next/ |
| Create React App | package.json (react-scripts) | npm run build | build/ |
| Vue CLI | vue.config.js | npm run build | dist/ |
| 静态站点 | index.html 存在 | 无 | ./ |
| Node.js API | 无 build 脚本 | 无 | - |

### deploy.sh 功能

1. **端口冲突检测**: 部署前检查 PM2 占用情况
2. **本地构建**: npm run build（如需要）
3. **文件打包**: tar.gz 格式
4. **SSH 上传**: 使用密钥认证
5. **远程执行**:
   - 解压文件
   - 安装生产依赖
   - 配置防火墙
   - PM2 进程管理

### init-server.sh 功能

- 检测/安装 Node.js (LTS)
- 全局安装 PM2
- 配置防火墙 (firewalld/ufw)
- 创建部署目录

## 注意事项

1. 确保 SSH 密钥有正确的权限 (600)
2. 首次部署需要在服务器上运行 init-server.sh
3. 端口冲突时会提示用户确认
4. 支持防火墙自动配置 (firewalld/ufw)

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| SSH 连接失败 | 检查密钥路径和权限 |
| 端口被占用 | 使用不同端口或停止旧应用 |
| 构建失败 | 检查本地环境依赖 |
| PM2 启动失败 | 查看日志: pm2 logs app-name |
