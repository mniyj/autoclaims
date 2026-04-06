#!/bin/bash

SERVER_IP=${1:-"121.43.159.216"}
SERVER_USER=${2:-"root"}
SSH_KEY_PATH=${3:-"/Users/pegasus/Downloads/aliyun.pem"}
TARGET_PORT=${4:-"3006"}

REMOTE_DIR="/var/www/smartclaim-ai-agent"
APP_NAME="smartclaim-ai-agent-$TARGET_PORT"

if [ -z "$SERVER_IP" ]; then
  echo "❌ 错误: 请提供服务器 IP 地址"
  echo "用法: ./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH] [PORT]"
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "$SSH_KEY_PATH" ]; then
  if [ ! -f "$SSH_KEY_PATH" ]; then
    echo "❌ 错误: 找不到密钥文件: $SSH_KEY_PATH"
    exit 1
  fi
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY_PATH"
  echo "🔑 使用密钥: $SSH_KEY_PATH"
fi

echo "🚀 开始部署 smartclaim-ai-agent 到 $SERVER_USER@$SERVER_IP (端口: $TARGET_PORT, 应用: $APP_NAME) ..."

echo "📦 正在构建 smartclaim-ai-agent..."
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run build

if [ $? -ne 0 ]; then
  echo "❌ 构建失败，终止部署"
  exit 1
fi

echo "🗜️  正在打包部署文件..."
export COPYFILE_DISABLE=1
tar --no-xattrs --exclude='._*' -czf deploy.tar.gz dist package.json package-lock.json server.js ecosystem.config.cjs

echo "📤 正在准备远程目录..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR"

echo "📤 正在上传文件到服务器..."
scp $SSH_OPTS deploy.tar.gz "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

if [ $? -ne 0 ]; then
  echo "❌ 上传失败。请检查 SSH 连接或权限。"
  rm deploy.tar.gz
  exit 1
fi

echo "⚙️  正在服务器上执行配置..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" << EOF
  set -e
  cd $REMOTE_DIR

  echo "   解压文件..."
  tar -xzf deploy.tar.gz
  rm deploy.tar.gz

  if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js"
    exit 1
  fi

  if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
  fi

  # 该前端生产服务器仅依赖 Node 内置模块，默认跳过 npm install，
  # 避免在小规格 ECS 上因为内存不足导致安装进程被系统杀掉。
  if [ ! -d node_modules ]; then
    mkdir -p node_modules
  fi

  if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
    echo "🔥 检测到 firewalld 正在运行，正在开放端口 $TARGET_PORT..."
    if ! firewall-cmd --list-ports | grep -q "$TARGET_PORT/tcp"; then
      firewall-cmd --zone=public --add-port=$TARGET_PORT/tcp --permanent
      firewall-cmd --reload
    fi
  fi

  pm2 delete $APP_NAME 2>/dev/null || true
  pm2 start ecosystem.config.cjs --only $APP_NAME
  sleep 3

  if pm2 list | grep "$APP_NAME" | grep -q "online"; then
    echo "✅ 应用启动成功 (Status: online)"
  else
    echo "❌ 应用启动失败"
    pm2 logs $APP_NAME --lines 50 --nostream || true
    exit 1
  fi

  pm2 save
  echo "✅ 部署完成!"
EOF

rm deploy.tar.gz

echo "🎉 部署成功! 访问地址: http://$SERVER_IP:$TARGET_PORT"
