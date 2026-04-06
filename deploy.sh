#!/bin/bash

# 部署配置
# 使用方法: ./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH] [PORT]
# 示例: ./deploy.sh 121.43.159.216 root ~/.ssh/aliyun.pem 3008

SERVER_IP=${1:-"121.43.159.216"}
SERVER_USER=${2:-"root"}
SSH_KEY_PATH=${3:-"/Users/pegasus/Downloads/aliyun.pem"}
TARGET_PORT=${4:-"3009"}

REMOTE_DIR="/var/www/insurance-config"
REMOTE_PORT=$TARGET_PORT

# 根据端口确定应用名称
APP_NAME="insurance-config-page"
if [ "$TARGET_PORT" != "3005" ]; then
    APP_NAME="insurance-config-page-$TARGET_PORT"
fi

# 检查是否提供了 IP
if [ -z "$SERVER_IP" ]; then
  echo "❌ 错误: 请提供服务器 IP 地址"
  echo "用法: ./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH] [PORT]"
  exit 1
fi

# 构建 SSH 选项
SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "$SSH_KEY_PATH" ]; then
  if [ ! -f "$SSH_KEY_PATH" ]; then
     echo "❌ 错误: 找不到密钥文件: $SSH_KEY_PATH"
     exit 1
  fi
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY_PATH"
  echo "🔑 使用密钥: $SSH_KEY_PATH"
fi

echo "🚀 开始部署到 $SERVER_USER@$SERVER_IP (端口: $REMOTE_PORT, 应用: $APP_NAME) ..."

# 1. 本地构建
echo "📦 正在构建项目..."
# 确保安装了依赖
if [ ! -d "node_modules" ]; then
    npm install
fi
# 构建
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败，终止部署"
    exit 1
fi

# 2. 打包文件
echo "🗜️  正在打包部署文件..."
export COPYFILE_DISABLE=1
tar --no-xattrs --exclude='._*' -czf deploy.tar.gz dist server.js server/ jsonlist/ package.json package-lock.json ecosystem.config.cjs

# 3. 上传到服务器
echo "📤 正在准备远程目录..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR"

echo "📤 正在上传文件到服务器..."
scp $SSH_OPTS deploy.tar.gz "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

if [ $? -ne 0 ]; then
    echo "❌ 上传失败。请检查 SSH 连接或权限。"
    rm deploy.tar.gz
    exit 1
fi

# 4. 远程执行部署命令
echo "⚙️  正在服务器上执行配置..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" << EOF
  set -e
  cd $REMOTE_DIR
  
  # 解压
  echo "   解压文件..."
  tar -xzf deploy.tar.gz
  rm deploy.tar.gz

  # 确保 jsonlist 目录存在且可写（用于 JSON 数据持久化）
  mkdir -p jsonlist
  chmod 755 jsonlist
  
  # 检查 Node.js 环境 (略去详细安装步骤，假设已安装或使用之前脚本已安装)
  if ! command -v node &> /dev/null; then
      echo "❌ 未检测到 Node.js，请先安装 Node.js"
      exit 1
  fi
  
  # 检查 PM2
  if ! command -v pm2 &> /dev/null; then
      npm install -g pm2
  fi

  # 安装生产依赖
  # echo "   安装依赖..."
  # npm install --production --registry=https://registry.npmmirror.com

  # 检查并配置防火墙
  if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
      echo "🔥 检测到 firewalld 正在运行，正在开放端口 $REMOTE_PORT..."
      if ! firewall-cmd --list-ports | grep -q "$REMOTE_PORT/tcp"; then
          firewall-cmd --zone=public --add-port=$REMOTE_PORT/tcp --permanent
          firewall-cmd --reload
          echo "✅ 端口 $REMOTE_PORT 已开放"
      else
          echo "✅ 端口 $REMOTE_PORT 已开放，无需重复操作"
      fi
  fi
  
  # 启动/重载服务
  echo "   启动服务 ($APP_NAME, 端口: $REMOTE_PORT)..."
  
  # 确保 PM2 守护进程正常
  # pm2 kill
  # pm2 resurrect || true
  
  # 删除旧进程并重新启动特定应用
  pm2 delete $APP_NAME 2>/dev/null || true
  pm2 start ecosystem.config.cjs --only $APP_NAME
  
  # 等待几秒让应用启动
  sleep 3
  
  # 验证启动状态
  if pm2 list | grep -q "$APP_NAME"; then
     if pm2 list | grep "$APP_NAME" | grep -q "online"; then
        echo "✅ 应用启动成功 (Status: online)"
     else
        echo "⚠️ 应用已注册但未在线"
        pm2 logs $APP_NAME --lines 20 --nostream
     fi
  else
     echo "❌ 应用启动失败：PM2 列表中未找到应用"
     exit 1
  fi
  
  pm2 save
  echo "✅ 部署完成!"
EOF

# 清理本地压缩包
rm deploy.tar.gz

echo "🎉 部署成功! 访问地址: http://$SERVER_IP:$REMOTE_PORT"
