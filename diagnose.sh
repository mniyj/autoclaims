#!/bin/bash

# 诊断脚本
# 使用方法: ./diagnose.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH]

SERVER_IP=${1:-""}
SERVER_USER=${2:-"root"}
SSH_KEY_PATH=${3:-""}

if [ -z "$SERVER_IP" ]; then
  echo "用法: ./diagnose.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH]"
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "$SSH_KEY_PATH" ]; then
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY_PATH"
fi

echo "🔍 开始诊断服务器 $SERVER_IP ..."

ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" << EOF
  echo "=== 1. PM2 进程状态 ==="
  pm2 list
  
  echo -e "\n=== 2. 端口监听状态 (3005) ==="
  if command -v netstat &> /dev/null; then
      netstat -tulpn | grep 3005
  elif command -v ss &> /dev/null; then
      ss -tulpn | grep 3005
  else
      echo "❌ 未找到 netstat 或 ss 命令"
  fi
  
  echo -e "\n=== 3. 本地访问测试 ==="
  curl -v http://localhost:3005 2>&1 | head -n 10
  
  echo -e "\n=== 4. 系统防火墙状态 ==="
  if command -v systemctl &> /dev/null; then
      if systemctl is-active firewalld &> /dev/null; then
          echo "🔥 firewalld: 运行中 (可能阻止了端口)"
          echo "   开放端口列表:"
          firewall-cmd --list-ports
      else
          echo "✅ firewalld: 未运行"
      fi
      
      if systemctl is-active ufw &> /dev/null; then
          echo "🔥 ufw: 运行中"
          ufw status
      else
          echo "✅ ufw: 未运行"
      fi
  fi
  
  echo -e "\n=== 5. 应用错误日志 (最近 50 行) ==="
  pm2 logs insurance-config-page --err --lines 50 --nostream
EOF
