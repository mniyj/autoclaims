/**
 * WebSocket服务器 - 处理实时消息同步
 *
 * 功能：
 * 1. 小程序用户连接
 * 2. 理赔员连接
 * 3. 消息路由和广播
 * 4. 会话管理
 */

import { Server } from 'ws';
import { createServer } from 'http';
import { handleMessage } from './messageSyncService';

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3007;
const httpServer = createServer();

const wss = new Server({ server: httpServer });

// 存储活跃连接
// userId -> WebSocket 映射
const connections = new Map<string, any>();

// conversationId -> userId[] 映射（用于消息广播）
const conversationParticipants = new Map<string, Set<string>>();

interface WSMessage {
  type: 'auth' | 'chat' | 'typing' | 'read' | 'disconnect';
  payload: any;
}

interface AuthPayload {
  userId: string;
  userType: 'user' | 'adjuster' | 'ai';
  token?: string;
}

interface ChatPayload {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'ai' | 'human';
  content: string;
  attachments?: any[];
  timestamp: number;
}

console.log(`WebSocket服务器启动在端口 ${PORT}...`);

wss.on('connection', (ws, req) => {
  console.log(`新的WebSocket连接: ${req.socket.remoteAddress}`);
  let userId: string | null = null;
  let userType: string | null = null;

  // 处理消息
  ws.on('message', async (data: string) => {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'auth':
          // 认证消息
          const authPayload = message.payload as AuthPayload;
          userId = authPayload.userId;
          userType = authPayload.userType;

          if (userId) {
            connections.set(userId, ws);
            console.log(`用户认证成功: ${userId} (${userType})`);

            // 发送认证成功响应
            ws.send(JSON.stringify({
              type: 'auth',
              success: true,
              userId,
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'auth',
              success: false,
              error: '缺少用户ID',
            }));
          }
          break;

        case 'chat':
          // 聊天消息
          if (!userId) {
            ws.send(JSON.stringify({
              type: 'error',
              error: '未认证',
            }));
            return;
          }

          const chatPayload = message.payload as ChatPayload;

          // 保存消息到数据库（待实现）
          await handleMessage(chatPayload);

          // 广播消息给会话中的所有参与者
          const participants = conversationParticipants.get(chatPayload.conversationId);
          if (participants) {
            const messageToSend = JSON.stringify({
              type: 'chat',
              payload: chatPayload,
            });

            participants.forEach((participantId) => {
              const participantWs = connections.get(participantId);
              if (participantWs && participantWs.readyState === 1) { // OPEN = 1
                participantWs.send(messageToSend);
              }
            });
          }

          // 发送到钉钉机器人（待实现）
          break;

        case 'typing':
          // 正在输入状态
          if (!userId) return;

          const typingPayload = message.payload;
          broadcastToConversation(
            typingPayload.conversationId,
            {
              type: 'typing',
              payload: {
                userId,
                userName: typingPayload.userName,
                isTyping: true,
              },
            },
            userId // 排除自己
          );
          break;

        case 'read':
          // 消息已读
          if (!userId) return;

          const readPayload = message.payload;
          broadcastToConversation(
            readPayload.conversationId,
            {
              type: 'read',
              payload: {
                messageId: readPayload.messageId,
                userId,
              },
            },
            userId // 排除自己
          );
          break;

        default:
          console.warn(`未知消息类型: ${message.type}`);
      }
    } catch (error) {
      console.error('处理WebSocket消息错误:', error);
    }
  });

  // 处理连接关闭
  ws.on('close', () => {
    if (userId) {
      console.log(`用户断开连接: ${userId} (${userType})`);
      connections.delete(userId);

      // 从所有会话中移除该用户
      conversationParticipants.forEach((participants, conversationId) => {
        participants.delete(userId);
        if (participants.size === 0) {
          conversationParticipants.delete(conversationId);
        }
      });

      // 通知会话中的其他用户
      conversationParticipants.forEach((participants, conversationId) => {
        if (participants.has(userId)) {
          broadcastToConversation(conversationId, {
            type: 'disconnect',
            payload: {
              userId,
              userName: '', // 需要从数据库获取
            },
          });
        }
      });
    }
  });

  // 处理错误
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

/**
 * 广播消息到指定会话的所有参与者
 */
function broadcastToConversation(
  conversationId: string,
  message: any,
  excludeUserId?: string
) {
  const participants = conversationParticipants.get(conversationId);
  if (!participants) return;

  const messageStr = JSON.stringify(message);
  participants.forEach((participantId) => {
    // 排除发送者
    if (excludeUserId && participantId === excludeUserId) return;

    const ws = connections.get(participantId);
    if (ws && ws.readyState === 1) {
      ws.send(messageStr);
    }
  });
}

/**
 * 添加用户到会话
 */
export function addUserToConversation(userId: string, conversationId: string) {
  if (!conversationParticipants.has(conversationId)) {
    conversationParticipants.set(conversationId, new Set());
  }
  conversationParticipants.get(conversationId)!.add(userId);
  console.log(`用户 ${userId} 加入会话 ${conversationId}`);
}

/**
 * 从会话中移除用户
 */
export function removeUserFromConversation(userId: string, conversationId: string) {
  const participants = conversationParticipants.get(conversationId);
  if (participants) {
    participants.delete(userId);
    console.log(`用户 ${userId} 离开会话 ${conversationId}`);
  }
}

/**
 * 发送消息给指定用户
 */
export function sendToUser(userId: string, message: any) {
  const ws = connections.get(userId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn(`用户 ${userId} 未连接或连接已关闭`);
  }
}

/**
 * 获取当前连接统计
 */
export function getConnectionStats() {
  return {
    totalConnections: connections.size,
    activeConversations: conversationParticipants.size,
    users: Array.from(connections.keys()),
  };
}

httpServer.listen(PORT, () => {
  console.log(`WebSocket服务器运行在 ws://localhost:${PORT}`);
});

export default wss;
