#!/bin/bash

# 部署配置
# 使用方法: ./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH]
# 示例: ./deploy.sh 47.1.1.1 root /path/to/your/key.pem

SERVER_IP=${1:-"121.43.159.216"}
SERVER_USER=${2:-"root"}
SSH_KEY_PATH=${3:-"/Users/pegasus/Downloads/aliyun.pem"}
REMOTE_DIR="/var/www/insurance-config"
REMOTE_PORT=3005

# 检查是否提供了 IP
if [ -z "$SERVER_IP" ]; then
  echo "❌ 错误: 请提供服务器 IP 地址"
  echo "用法: ./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH]"
  echo "示例: ./deploy.sh 121.43.159.216 root ~/.ssh/aliyun.pem"
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

echo "🚀 开始部署到 $SERVER_USER@$SERVER_IP ..."

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
# 排除不必要的文件，只包含运行所需
# 同时排除 Mac 下的隐藏文件和扩展属性，避免 tar 警告
export COPYFILE_DISABLE=1
tar --no-xattrs --exclude='._*' -czf deploy.tar.gz dist server.js package.json package-lock.json ecosystem.config.cjs

# 3. 上传到服务器
echo "📤 正在准备远程目录..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR"

echo "📤 正在上传文件到服务器..."
scp $SSH_OPTS deploy.tar.gz "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

if [ $? -ne 0 ]; then
    echo "❌ 上传失败。请检查 SSH 连接或权限。"
    echo "提示：如果服务器只允许密钥登录，请提供密钥路径作为第三个参数。"
    rm deploy.tar.gz
    exit 1
fi

# 4. 远程执行部署命令
echo "⚙️  正在服务器上执行配置..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" << EOF
  set -e # 遇到错误立即退出
  cd $REMOTE_DIR
  
  # 解压
  echo "   解压文件..."
  tar -xzf deploy.tar.gz
  rm deploy.tar.gz
  
  # 检查 Node.js 环境
  if ! command -v node &> /dev/null; then
      echo "❌ 未检测到 Node.js，正在尝试通过二进制包安装 (避免低内存服务器 OOM)..."
      
      NODE_VERSION="v22.12.0"
      NODE_DIST="node-\$NODE_VERSION-linux-x64"
      
      echo "   下载 Node.js \$NODE_VERSION..."
      # 尝试使用 wget 下载
      if command -v wget &> /dev/null; then
          wget -q https://nodejs.org/dist/\$NODE_VERSION/\$NODE_DIST.tar.xz
      elif command -v curl &> /dev/null; then
          curl -O https://nodejs.org/dist/\$NODE_VERSION/\$NODE_DIST.tar.xz
      else
          echo "❌ 未找到 wget 或 curl，无法下载 Node.js"
          exit 1
      fi

      if [ ! -f "\$NODE_DIST.tar.xz" ]; then
           echo "❌ 下载失败"
           exit 1
      fi
      
      echo "   解压安装..."
      tar -xf \$NODE_DIST.tar.xz
      
      # 复制到 /usr/local (需要 root 权限，这里假设是 root 登录)
      # 如果是非 root，这里可能需要 sudo，但脚本假设是 root 或有权限
      cp -r \$NODE_DIST/{bin,include,lib,share} /usr/local/
      
      # 清理
      rm -rf \$NODE_DIST \$NODE_DIST.tar.xz
  fi
  
  # 再次检查 Node.js 是否安装成功
  if ! command -v node &> /dev/null; then
      echo "❌ Node.js 安装失败，请登录服务器手动排查。"
      exit 1
  fi
  
  echo "✅ Node.js 版本: \$(node -v)"

  
  # 检查 PM2
  if ! command -v pm2 &> /dev/null; then
      echo "   安装 PM2..."
      npm install -g pm2
  fi

  # 安装生产依赖
  echo "   安装依赖..."
  npm install --production --registry=https://registry.npmmirror.com

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
  echo "   启动服务 (端口: $REMOTE_PORT)..."
  
  # 确保 PM2 守护进程正常
  pm2 kill
  pm2 resurrect || true
  
  # 强制删除旧进程并重新启动，确保配置更新
  pm2 delete insurance-config-page 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  
  # 等待几秒让应用启动
  sleep 3
  
  # 验证启动状态
  if pm2 list | grep -q "insurance-config-page"; then
     if pm2 list | grep "insurance-config-page" | grep -q "online"; then
        echo "✅ 应用启动成功 (Status: online)"
     else
        echo "⚠️ 应用已注册但未在线，可能是启动中或崩溃"
        pm2 logs insurance-config-page --lines 20 --nostream
     fi
  else
     echo "❌ 应用启动失败：PM2 列表中未找到应用"
     echo "尝试直接运行排查错误..."
     node server.js &
     PID=\$!
     sleep 5
     if ps -p \$PID > /dev/null; then
        echo "✅ 直接运行测试成功，请检查 PM2 配置"
        kill \$PID
     else
        echo "❌ 直接运行失败，以下是错误日志："
        # 由于是后台运行，日志可能直接输出了，这里再次尝试前台运行一小会儿
        node server.js &
        PID=\$!
        sleep 2
        kill \$PID
     fi
     exit 1
  fi
  
  pm2 save
  echo "✅ 部署完成!"
EOF

# 清理本地压缩包
rm deploy.tar.gz

echo "🎉 部署成功! 访问地址: http://$SERVER_IP:$REMOTE_PORT"
