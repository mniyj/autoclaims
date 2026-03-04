// 理赔员工作台 - 类型定义

/**
 * 理赔员信息
 */
export interface Adjuster {
  id: string;
  name: string;
  employeeId?: string;
  dingtalkId: string;
  dingtalkMobile: string;
  feishuId?: string;
  feishuEmail?: string;
  department: string;
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  lastLoginAt?: string;
  permissions: string[];
}

/**
 * 对话会话
 */
export interface Conversation {
  id: string;
  claimId: string;
  userName: string;
  userAvatar?: string;
  status: "active" | "paused" | "closed";
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: Date;
  assignedAdjusterId?: string;
  assignedAt?: Date;
}

/**
 * 消息（小程序↔工作台）
 */
export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: "user" | "ai" | "human";
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  attachments?: ChatAttachment[];
}

/**
 * 消息附件
 */
export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  type: "image" | "file" | "video";
  size?: number;
}

/**
 * AI授权配置
 */
export interface AIAuthorizationConfig {
  id: string;
  enabled: boolean;
  autoReplyLevel: "full" | "partial" | "disabled";
  maxConfidence?: number;
  allowedTopics?: string[];
  blockedKeywords?: string[];
  escalationRules: EscalationRule[];
  updatedBy: string;
  updatedAt: string;
}

/**
 * 升级规则
 */
export interface EscalationRule {
  id: string;
  condition:
    | "confidence_low"
    | "manual_request"
    | "complex_question"
    | "emotion_abnormal"
    | "keyword_match";
  threshold?: number | null;
  action: "human_intervention" | "pause_ai" | "notify_adjuster";
  priority?: "high" | "medium" | "low";
}

/**
 * 对话统计
 */
export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  averageResponseTime?: number;
  messagesByAdjuster: {
    [adjusterId: string]: {
      conversations: number;
      messages: number;
    };
  };
}
