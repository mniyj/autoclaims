/**
 * 消息同步服务 - 统一消息格式和路由
 *
 * 功能：
 * 1. 处理小程序消息
 * 2. 处理理赔员消息
 * 3. 处理AI消息
 * 4. 消息持久化
 * 5. 钉钉通知
 */

import { sendToDingTalk } from './dingtalkBot';

// 模拟数据库（实际项目应使用PostgreSQL/MySQL）
const messageDatabase: any[] = [];

/**
 * 统一消息格式
 */
export interface UnifiedMessage {
  id: string;
  conversationId: string;
  sender: {
    id: string;
    type: 'user' | 'ai' | 'human';
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: number;
  metadata?: {
    attachments?: any[];
    aiGenerated?: boolean;
    readBy?: string[];
  };
}

/**
 * 处理收到的聊天消息
 */
export async function handleMessage(chatPayload: any): Promise<UnifiedMessage> {
  const message: UnifiedMessage = {
    id: generateId(),
    conversationId: chatPayload.conversationId,
    sender: {
      id: chatPayload.senderId,
      type: chatPayload.senderType,
      name: chatPayload.senderName,
    },
    content: chatPayload.content,
    timestamp: chatPayload.timestamp || Date.now(),
    metadata: {
      attachments: chatPayload.attachments,
      aiGenerated: chatPayload.senderType === 'ai',
      readBy: [],
    },
  };

  // 保存消息到数据库
  await saveMessage(message);

  // 如果是用户消息，检查是否需要AI回复
  if (chatPayload.senderType === 'user') {
    await checkAIReply(chatPayload);
  }

  // 如果是理赔员消息，通知小程序用户
  if (chatPayload.senderType === 'human') {
    // 通知小程序用户（通过WebSocket）
    // sendToUser(chatPayload.senderId, {...});
  }

  return message;
}

/**
 * 保存消息到数据库
 */
async function saveMessage(message: UnifiedMessage): Promise<void> {
  // 模拟数据库保存
  messageDatabase.push(message);
  console.log(`消息已保存: ${message.id} - ${message.sender.name}: ${message.content.substring(0, 50)}...`);

  // TODO: 实际数据库实现
  // await db.query(
  //   'INSERT INTO messages (id, conversation_id, sender_type, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  //   [message.id, message.conversationId, message.sender.type, message.sender.id, message.content, new Date(message.timestamp)]
  // );
}

/**
 * 检查是否需要AI自动回复
 */
async function checkAIReply(chatPayload: any): Promise<void> {
  // TODO: 调用AI服务生成回复
  // const aiService = await import('../wechat-miniprogram/src/services/geminiService');
  // const response = await aiService.generateResponse(chatPayload.content, chatPayload.conversationId);

  // 暂时使用模拟响应
  const aiResponse: UnifiedMessage = {
    id: generateId(),
    conversationId: chatPayload.conversationId,
    sender: {
      id: 'ai-assistant',
      type: 'ai',
      name: 'AI助手',
    },
    content: '这是一条AI模拟回复。实际项目中应调用geminiService.ts生成响应。',
    timestamp: Date.now(),
    metadata: {
      aiGenerated: true,
      readBy: [],
    },
  };

  await saveMessage(aiResponse);

  // 广播AI回复
  // broadcastToConversation(chatPayload.conversationId, aiResponse);
}

/**
 * 消息同步到钉钉
 */
export async function syncToDingTalk(message: UnifiedMessage, adjusterId: string): Promise<void> {
  const dingTalkMessage = {
    msgtype: 'markdown',
    markdown: {
      title: '新理赔消息',
      text: formatDingTalkMessage(message),
    },
    at: {
      atUserIds: [adjusterId],
      isAtAll: false,
    },
  };

  await sendToDingTalk(dingTalkMessage);
}

/**
 * 格式化钉钉消息
 */
function formatDingTalkMessage(message: UnifiedMessage): string {
  const senderTypeMap: Record<string, string> = {
    user: '用户',
    ai: 'AI助手',
    human: '理赔员',
  };

  return `### ${senderTypeMap[message.sender.type]} - ${message.sender.name}

**消息内容:**
${message.content}

**时间:** ${new Date(message.timestamp).toLocaleString('zh-CN')}
`;
}

/**
 * 获取会话历史消息
 */
export async function getConversationMessages(conversationId: string): Promise<UnifiedMessage[]> {
  // TODO: 从数据库查询
  // const messages = await db.query(
  //   'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
  //   [conversationId]
  // );

  // 暂时返回模拟数据
  return messageDatabase.filter(m => m.conversationId === conversationId);
}

/**
 * 标记消息为已读
 */
export async function markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
  // TODO: 更新数据库
  // await db.query(
  //   'UPDATE messages SET read_by = array_append(read_by, ?) WHERE conversation_id = ?',
  //   [conversationId]
  // );

  console.log(`用户 ${userId} 已读会话 ${conversationId} 的消息`);
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取未读消息数
 */
export async function getUnreadCount(userId: string): Promise<number> {
  // TODO: 从数据库查询
  // const result = await db.query(
  //   'SELECT COUNT(*) as count FROM messages WHERE sender_type != ? AND ? = ALL(read_by)',
  //   ['user', userId]
  // );

  // 暂时返回模拟数据
  return 0;
}
