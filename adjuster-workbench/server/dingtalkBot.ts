/**
 * 钉钉机器人集成 - 实时通知理赔员
 *
 * 功能：
 * 1. 发送文本消息
 * 2. 发送Markdown消息
 * 3. 发送卡片消息
 * 4. @指定理赔员
 */

// 钉钉Webhook URL（需要在环境变量中配置）
const DINGTALK_WEBHOOK_URL = process.env.DINGTALK_WEBHOOK_URL || '';
const DINGTALK_SECRET = process.env.DINGTALK_SECRET || '';

/**
 * 钉钉消息类型
 */
export interface DingTalkMessage {
  msgtype: 'text' | 'markdown' | 'actionCard' | 'feedCard';
  text?: {
    content: string;
  };
  markdown?: {
    title: string;
    text: string;
  };
  actionCard?: {
    title: string;
    text: string;
    singleTitle?: string;
    singleURL?: string;
    btnOrientation?: '0' | '1';
  };
  at?: {
    atUserIds?: string[];
    atMobiles?: string[];
    isAtAll?: boolean;
  };
}

/**
 * 发送钉钉消息
 */
export async function sendToDingTalk(message: DingTalkMessage): Promise<boolean> {
  if (!DINGTALK_WEBHOOK_URL) {
    console.error('钉钉Webhook URL未配置');
    return false;
  }

  try {
    const response = await fetch(DINGTALK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();

    if (data.errcode === 0) {
      console.log('钉钉消息发送成功');
      return true;
    } else {
      console.error('钉钉消息发送失败:', data.errmsg);
      return false;
    }
  } catch (error) {
    console.error('发送钉钉消息错误:', error);
    return false;
  }
}

/**
 * 发送新对话通知
 */
export async function notifyNewConversation(conversationId: string, userName: string, claimType: string, adjusterId: string): Promise<boolean> {
  const message: DingTalkMessage = {
    msgtype: 'markdown',
    markdown: {
      title: '新理赔对话',
      text: `## 新理赔对话

**用户:** ${userName}
**理赔类型:** ${claimType}
**对话ID:** ${conversationId}

[查看对话](https://your-domain.com/adjuster?conversation=${conversationId})`,
    },
    at: {
      atUserIds: [adjusterId],
      isAtAll: false,
    },
  };

  return await sendToDingTalk(message);
}

/**
 * 发送新消息通知
 */
export async function notifyNewMessage(
  conversationId: string,
  userName: string,
  content: string,
  adjusterId: string
): Promise<boolean> {
  const message: DingTalkMessage = {
    msgtype: 'markdown',
    markdown: {
      title: '新理赔消息',
      text: `## 新消息

**对话ID:** ${conversationId}
**用户:** ${userName}
**内容:** ${content}

[快速回复](https://your-domain.com/adjuster?conversation=${conversationId})`,
    },
    at: {
      atUserIds: [adjusterId],
      isAtAll: false,
    },
  };

  return await sendToDingTalk(message);
}

/**
 * 发送AI介入请求通知
 */
export async function notifyHumanIntervention(
  conversationId: string,
  userName: string,
  reason: string,
  priority: 'high' | 'medium' | 'low',
  adjusterId: string
): Promise<boolean> {
  const priorityColor = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  const message: DingTalkMessage = {
    msgtype: 'actionCard',
    actionCard: {
      title: `${priorityColor[priority]} AI介入请求`,
      text: `## 需要人工介入

**对话ID:** ${conversationId}
**用户:** ${userName}
**介入原因:** ${reason}
**优先级:** ${priority}`,
      singleTitle: '查看对话',
      singleURL: `https://your-domain.com/adjuster?conversation=${conversationId}`,
      btnOrientation: '0',
    },
    at: {
      atUserIds: [adjusterId],
      isAtAll: false,
    },
  };

  return await sendToDingTalk(message);
}

/**
 * 发送材料审核完成通知
 */
export async function notifyMaterialApproved(
  conversationId: string,
  userName: string,
  materials: any[],
  adjusterId: string
): Promise<boolean> {
  const materialsText = materials.map((m, i) => `${i + 1}. ${m.name} - ${m.status}`).join('\n');

  const message: DingTalkMessage = {
    msgtype: 'markdown',
    markdown: {
      title: '材料审核完成',
      text: `## 材料审核完成

**用户:** ${userName}
**对话ID:** ${conversationId}

**审核结果:**
${materialsText}

[查看详情](https://your-domain.com/adjuster?conversation=${conversationId})`,
    },
    at: {
      atUserIds: [adjusterId],
      isAtAll: false,
    },
  };

  return await sendToDingTalk(message);
}

/**
 * 发送理赔完成通知
 */
export async function notifyClaimCompleted(
  conversationId: string,
  userName: string,
  amount: number,
  adjusterId: string
): Promise<boolean> {
  const message: DingTalkMessage = {
    msgtype: 'markdown',
    markdown: {
      title: '理赔完成',
      text: `## 理赔已完成

**用户:** ${userName}
**对话ID:** ${conversationId}
**赔付金额:** ¥${amount.toLocaleString()}

理赔已成功处理完成。

[查看详情](https://your-domain.com/adjuster?conversation=${conversationId})`,
    },
    at: {
      atUserIds: [adjusterId],
      isAtAll: false,
    },
  };

  return await sendToDingTalk(message);
}

/**
 * 发送系统通知（批量操作等）
 */
export async function notifySystemNotification(
  title: string,
  content: string,
  atAll: boolean = false
): Promise<boolean> {
  const message: DingTalkMessage = {
    msgtype: 'markdown',
    markdown: {
      title,
      text: `## ${title}

${content}`,
    },
    at: {
      isAtAll: atAll,
    },
  };

  return await sendToDingTalk(message);
}

/**
 * 测试钉钉连接
 */
export async function testDingTalkConnection(): Promise<boolean> {
  const message: DingTalkMessage = {
    msgtype: 'text',
    text: {
      content: '🤖 智能理赔系统测试消息\n\n钉钉机器人连接正常！',
    },
  };

  console.log('测试钉钉机器人连接...');
  const result = await sendToDingTalk(message);
  console.log(result ? '✅ 钉钉机器人连接成功' : '❌ 钉钉机器人连接失败');

  return result;
}
