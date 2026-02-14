# 阿里云部署指南

本文档介绍如何使用生成的部署脚本将项目部署到阿里云（或其他云服务器）。

## 目录

- [前置要求](#前置要求)
- [首次部署](#首次部署)
- [日常部署](#日常部署)
- [SSH 密钥配置](#ssh-密钥配置)
- [环境变量配置](#环境变量配置)
- [常见问题排查](#常见问题排查)

## 前置要求

### 本地环境
- Node.js (v16+)
- npm 或 yarn
- SSH 客户端

### 服务器环境
- CentOS 7+ / Ubuntu 18.04+ / Debian 9+
- 至少 1GB 内存
- 至少 10GB 磁盘空间
- root 或 sudo 权限

## 首次部署

### 步骤 1: 配置 SSH 密钥

生成 SSH 密钥对（如果没有）:

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/your-server-key
```

将公钥复制到服务器:

```bash
ssh-copy-id -i ~/.ssh/your-server-key.pub root@your-server-ip
```

或手动复制:

```bash
cat ~/.ssh/your-server-key.pub | ssh root@your-server-ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 步骤 2: 初始化服务器

在**本地**将初始化脚本传输到服务器并执行:

```bash
scp -i ~/.ssh/your-server-key init-server.sh root@your-server-ip:/root/
ssh -i ~/.ssh/your-server-key root@your-server-ip "chmod +x /root/init-server.sh && /root/init-server.sh"
```

初始化脚本会自动:
- 安装 Node.js (LTS)
- 安装 PM2
- 配置防火墙
- 创建部署目录

### 步骤 3: 执行部署

```bash
chmod +x deploy.sh
./deploy.sh your-server-ip root ~/.ssh/your-server-key 3005
```

参数说明:
- `your-server-ip`: 服务器 IP 地址
- `root`: SSH 用户名（可选，默认 root）
- `~/.ssh/your-server-key`: SSH 密钥路径（可选）
- `3005`: 部署端口（可选，默认在脚本中配置）

## 日常部署

### 标准部署

```bash
./deploy.sh your-server-ip
```

### 指定端口部署

```bash
./deploy.sh your-server-ip root ~/.ssh/your-server-key 3008
```

### 多实例部署

```bash
# 部署到端口 3005
./deploy.sh your-server-ip root ~/.ssh/your-server-key 3005

# 部署到端口 3008
./deploy.sh your-server-ip root ~/.ssh/your-server-key 3008
```

## SSH 密钥配置

### 生成新密钥

```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

### 设置密钥权限

```bash
chmod 600 ~/.ssh/your-server-key
chmod 644 ~/.ssh/your-server-key.pub
```

### 测试 SSH 连接

```bash
ssh -i ~/.ssh/your-server-key root@your-server-ip "echo 'Connection successful!'"
```

## 环境变量配置

### 创建 .env 文件

在项目根目录创建 `.env` 文件:

```bash
# 生产环境变量
NODE_ENV=production
PORT=3005
BASE_PATH=/

# API 密钥（如果有）
API_KEY=your-api-key

# 数据库连接（如果有）
DATABASE_URL=your-database-url
```

### 更新 ecosystem.config.cjs

在 `env` 部分添加环境变量:

```javascript
env: {
  NODE_ENV: "production",
  PORT: 3005,
  BASE_PATH: "/",
  API_KEY: "your-api-key"
}
```

## 常见问题排查

### 问题 1: SSH 连接失败

**症状**: `Permission denied (publickey)`

**解决方案**:
1. 检查密钥路径是否正确
2. 检查密钥权限是否为 600
3. 确认公钥已添加到服务器 `~/.ssh/authorized_keys`

### 问题 2: 端口被占用

**症状**: 部署时提示端口已被占用

**解决方案**:
1. 使用不同端口: `./deploy.sh your-ip root ~/.ssh/key 3006`
2. 停止旧应用: `ssh server "pm2 stop app-name && pm2 delete app-name"`
3. 查看占用端口的进程: `ssh server "pm2 list"`

### 问题 3: 构建失败

**症状**: `npm run build` 执行失败

**解决方案**:
1. 清理本地缓存: `rm -rf node_modules && npm install`
2. 检查 Node.js 版本: `node -v` (建议 v16+)
3. 检查构建错误日志

### 问题 4: PM2 启动失败

**症状**: 应用启动后状态不是 `online`

**解决方案**:
1. 查看日志: `ssh server "pm2 logs app-name --lines 50"`
2. 检查端口是否被占用: `ssh server "netstat -tlnp | grep PORT"`
3. 检查 Node.js 是否安装: `ssh server "node -v"`

### 问题 5: 防火墙阻止访问

**症状**: 部署成功但无法访问网站

**解决方案**:
1. 检查防火墙状态: `ssh server "systemctl status firewalld"` (CentOS) 或 `ssh server "ufw status"` (Ubuntu)
2. 开放端口: `ssh server "firewall-cmd --zone=public --add-port=3005/tcp --permanent && firewall-cmd --reload"`
3. 检查安全组规则（阿里云控制台）

### 问题 6: 内存不足

**症状**: 应用频繁重启

**解决方案**:
1. 检查服务器内存: `ssh server "free -h"`
2. 调整 PM2 内存限制: 编辑 `ecosystem.config.cjs` 中的 `max_memory_restart`
3. 增加服务器 swap 空间: `ssh server "dd if=/dev/zero of=/swapfile bs=1M count=1024 && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"`

## 有用的 PM2 命令

```bash
# 查看所有应用状态
pm2 list

# 查看应用详情
pm2 show app-name

# 查看实时日志
pm2 logs app-name

# 重启应用
pm2 restart app-name

# 停止应用
pm2 stop app-name

# 删除应用
pm2 delete app-name

# 保存当前进程列表
pm2 save

# 恢复保存的进程列表
pm2 resurrect

# 清空日志
pm2 flush

# 监控面板
pm2 monit
```

## 服务器维护

### 查看 PM2 日志

```bash
ssh root@your-server "pm2 logs app-name --lines 100"
```

### 重启所有应用

```bash
ssh root@your-server "pm2 restart all"
```

### 更新 Node.js 版本

```bash
# 使用 nvm
ssh root@your-server "source ~/.nvm/nvm.sh && nvm install --lts && nvm alias default lts/*"

# 或重新安装
curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -
yum install -y nodejs
```

### 备份数据

```bash
# 备份应用文件
ssh root@your-server "cd /var/www && tar -czf app-backup-$(date +%Y%m%d).tar.gz your-app"

# 下载备份到本地
scp root@your-server:/var/www/app-backup-*.tar.gz ./backups/
```
