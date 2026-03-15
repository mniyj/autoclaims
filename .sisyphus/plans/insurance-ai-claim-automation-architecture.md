# 保险理赔AI自动化系统架构方案

## 文档信息

| 项目 | 内容 |
|------|------|
| **方案名称** | 保险理赔AI自动化系统 |
| **目标** | 降本增效，提升理赔处理效率 |
| **技术策略** | 混合方案（核心业务自建 + 腾讯云IM） |
| **适用场景** | 车险、医疗险、意外险等多险种理赔 |

---

## 1. 方案概述

### 1.1 业务背景与痛点

腾讯不允许个人微信被AI托管，导致保险公司理赔案件处理效率低下：
- 理赔员需要人工与索赔人沟通
- 人工指导上传材料、审核材料
- 重复性工作多，人工成本高

### 1.2 核心设计思想

**"群聊"模式 + 双向同步**

借鉴微信群的体验，让AI和人工理赔员在同一个"虚拟群聊"中协作服务用户：
- 用户、AI理赔助手、人工理赔员同时在线
- 用户@AI则AI回答，@人工则人工介入
- 所有对话实时双向同步到企业微信

### 1.3 用户体验流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: 用户进入小程序                                             │
│  Step 2: AI理赔助手自动问候并了解案情                               │
│  Step 3: AI指导用户上传材料、预审材料                               │
│  Step 4: 复杂问题AI提示"需要人工协助"                               │
│  Step 5: 用户@人工或等待AI判断转人工                                │
│  Step 6: 系统通知理赔员（企业微信+短信）                            │
│  Step 7: 理赔员在企业微信查看完整对话，直接回复                     │
│  Step 8: 回复实时同步到小程序，用户收到微信服务通知                 │
│  Step 9: 案件处理完成，AI生成结案报告                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 系统架构设计

### 2.1 整体架构图

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              腾讯生态系统                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │  WeChat Mini        │  │  Enterprise WeChat  │  │  WeChat Pay /               │  │
│  │  Program (小程序)   │  │  (企业微信)         │  │  Notifications              │  │
│  │  - Taro Framework   │  │  - 消息接收         │  │  - 支付                     │  │
│  │  - Chat UI          │  │  - 快捷回复         │  │  - 服务通知                 │  │
│  └──────────┬──────────┘  └──────────┬──────────┘  └─────────────┬───────────────┘  │
│             │                        │                            │                 │
│             │  WebSocket             │  Webhook / API             │                 │
│             │                        │                            │                 │
└─────────────┼────────────────────────┼────────────────────────────┼─────────────────┘
              │                        │                            │
              ▼                        ▼                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              业务服务层 (自建)                                        │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         API Gateway (Express.js)                               │  │
│  │  - JWT Authentication  │  - WeChat OAuth  │  - Rate Limiting  │  - Logging   │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                           │                                          │
│     ┌─────────────────────────────────────┼─────────────────────────────────────┐   │
│     │                                     │                                     │   │
│     ▼                                     ▼                                     ▼   │
│ ┌───────────────┐               ┌───────────────┐               ┌───────────────┐   │
│ │  WebSocket    │               │  REST API     │               │  AI Agent     │   │
│ │  Server       │               │  Services     │               │  (LangGraph)  │   │
│ │  (Port 3007)  │               │               │               │               │   │
│ │               │               │ - Claims API  │               │ - Eligibility │   │
│ │ - Connection  │               │ - Users API   │               │ - Calculation │   │
│ │   Management  │               │ - Files API   │               │ - Medical DB  │   │
│ │ - Message     │               │ - OCR API     │               │ - Hospital DB │   │
│ │   Broadcast   │               │               │               │               │   │
│ └───────┬───────┘               └───────┬───────┘               └───────┬───────┘   │
│         │                               │                               │           │
└─────────┼───────────────────────────────┼───────────────────────────────┼───────────┘
          │                               │                               │
          ▼                               ▼                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              腾讯云IM层 (第三方服务)                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Tencent Cloud IM (即时通信)                            │  │
│  │                                                                                │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │  │
│  │  │  Group Chat   │  │  Message      │  │  Push         │  │  History      │  │  │
│  │  │  Management   │  │  Routing      │  │  Notification │  │  Storage      │  │  │
│  │  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘  │  │
│  │                                                                                │  │
│  │  - 消息持久化              - 多端同步              - 离线推送                  │  │
│  │  - 群组管理                - 消息撤回              - 已读回执                  │  │
│  │  - 成员管理                - 消息搜索              - 消息漫游                  │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
          │                               │                               │
          ▼                               ▼                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              数据持久化层                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  PostgreSQL      │  │  Redis           │  │  OSS / MinIO     │                    │
│  │  (Primary DB)    │  │  (Cache/Queue)   │  │  (File Storage)  │                    │
│  │                  │  │                  │  │                  │                    │
│  │ - Claims         │  │ - Session        │  │ - Documents      │                    │
│  │ - Users          │  │ - Message Queue  │  │ - Images         │                    │
│  │ - Messages       │  │ - Rate Limiting  │  │ - Audio          │                    │
│  │ - Conversations  │  │ - Cache          │  │                  │                    │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件说明

| 组件 | 技术选型 | 作用 |
|------|----------|------|
| **小程序端** | Taro 4.x + React 19 | 用户对话界面、AI交互、文件上传 |
| **企业微信端** | 企业微信JS-SDK + Webhook | 理赔员接收通知、查看对话、快捷回复 |
| **腾讯云IM** | Tencent Cloud IM SDK | 消息路由、群组管理、多端同步、离线推送 |
| **WebSocket服务** | Node.js + ws | 实时消息传输、连接管理 |
| **AI Agent** | LangGraph + Gemini | 理赔审核、金额计算、材料预审 |
| **业务API** | Express.js | RESTful API服务 |
| **数据库** | PostgreSQL 15+ | 主数据库，支持JSON字段存储动态数据 |
| **缓存** | Redis 7+ | 会话管理、消息队列、限流 |
| **文件存储** | 阿里云OSS / MinIO | 理赔材料存储 |

---

## 3. 核心功能设计

### 3.1 "群聊"模式设计

#### 3.1.1 群组结构

每个理赔案件对应一个IM群组：

```typescript
interface ClaimConversation {
  id: string;                      // 群组ID
  claimId: string;                 // 关联案件ID
  claimNumber: string;             // 报案号
  
  // 群组成员
  members: {
    userId: string;                // 用户ID（车主/患者）
    userType: 'customer';          // 用户类型
    nickname: string;
    avatar: string;
  } | {
    userId: string;                // 理赔员ID
    userType: 'adjuster';          // 理赔员
    nickname: string;
    avatar: string;
    enterpriseWechatId: string;    // 企业微信UserID
  } | {
    userId: 'ai_assistant';        // AI助手
    userType: 'ai';
    nickname: 'AI理赔助手';
    avatar: '/ai-avatar.png';
  }[];
  
  // 状态
  status: 'active' | 'paused' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}
```

#### 3.1.2 @触发逻辑

```typescript
// 消息处理流程
async function processMessage(message: Message) {
  // 1. 解析@提及
  const mentions = parseMentions(message.content);
  
  // 2. 路由逻辑
  if (mentions.includes('@AI') || mentions.length === 0) {
    // 路由到AI处理
    const aiResponse = await aiAgent.process({
      conversationId: message.conversationId,
      message: message.content,
      context: await getConversationContext(message.conversationId),
      claimData: await getClaimData(message.claimId)
    });
    
    // AI回复发送到群组
    await sendMessageToGroup({
      conversationId: message.conversationId,
      sender: { userId: 'ai_assistant', userType: 'ai' },
      content: aiResponse.text,
      attachments: aiResponse.attachments
    });
  }
  
  if (mentions.includes('@人工') || mentions.includes('@理赔员')) {
    // 通知理赔员
    await notifyAdjuster({
      conversationId: message.conversationId,
      claimId: message.claimId,
      message: message.content,
      urgency: 'normal' // 可基于案情判断紧急程度
    });
    
    // AI提示用户等待
    await sendMessageToGroup({
      conversationId: message.conversationId,
      sender: { userId: 'ai_assistant', userType: 'ai' },
      content: '已为您通知理赔员，预计15分钟内回呼。您可离开小程序，收到回复时会通过微信通知您。'
    });
  }
  
  // 3. 保存消息到数据库
  await saveMessage(message);
}
```

### 3.2 双向同步机制

#### 3.2.1 数据流图

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    双向同步架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   小程序端                    腾讯云IM                    业务服务层              企业微信│
│                                                                                         │
│   ┌─────────────┐            ┌─────────────┐            ┌─────────────┐          ┌─────┐│
│   │ 用户发送消息 │──────────▶│  IM Server  │──────────▶│  Webhook    │─────────▶│通知 ││
│   └─────────────┘            └─────────────┘            └─────────────┘          └─────┘│
│        │                          │                          │                        ││
│        │                          │                          │                        ││
│        │                          │                          │                        ││
│        │                    ┌─────┴─────┐                    │                        ││
│        │                    │ 消息队列   │                    │                        ││
│        │                    └─────┬─────┘                    │                        ││
│        │                          │                          │                        ││
│        │                          ▼                          ▼                        ││
│   ┌────┴────┐              ┌─────────────┐            ┌─────────────┐          ┌─────┐│
│   │ 显示消息 │◀─────────────│ 多端推送    │◀───────────│ 企业微信API │◀─────────│回复 ││
│   └─────────┘              └─────────────┘            └─────────────┘          └─────┘│
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 同步逻辑

```typescript
// 企业微信消息接收
app.post('/webhook/enterprise-wechat', async (req, res) => {
  const { message, sender, conversationId } = req.body;
  
  // 1. 验证发送者身份
  const adjuster = await verifyAdjuster(sender.userId);
  
  // 2. 保存消息
  await saveMessage({
    conversationId,
    sender: {
      userId: adjuster.id,
      userType: 'adjuster',
      nickname: adjuster.name
    },
    content: message.content,
    source: 'enterprise_wechat',
    createdAt: new Date()
  });
  
  // 3. 推送到腾讯云IM
  await timServer.sendGroupMessage({
    groupId: conversationId,
    fromAccount: adjuster.id,
    messageBody: message.content
  });
  
  // 4. 推送到小程序WebSocket（如果用户在线）
  await websocketServer.broadcast(conversationId, {
    type: 'new_message',
    data: {
      sender: { userId: adjuster.id, userType: 'adjuster' },
      content: message.content,
      timestamp: Date.now()
    }
  });
  
  // 5. 发送微信服务通知（如果用户离线）
  const userOnline = await isUserOnline(conversationId);
  if (!userOnline) {
    await sendWechatNotification({
      touser: await getCustomerOpenId(conversationId),
      templateId: 'CLAIM_REPLY_NOTIFICATION',
      data: {
        claimNumber: await getClaimNumber(conversationId),
        adjusterName: adjuster.name,
        replyPreview: message.content.substring(0, 50) + '...'
      }
    });
  }
  
  res.json({ success: true });
});
```

### 3.3 预约回呼机制

#### 3.3.1 流程设计

```typescript
interface CallbackAppointment {
  id: string;
  conversationId: string;
  claimId: string;
  
  // 用户信息
  customerId: string;
  customerPhone: string;
  customerOpenId: string;
  
  // 问题描述
  questionSummary: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  
  // 预约状态
  status: 'pending' | 'assigned' | 'contacted' | 'resolved' | 'expired';
  
  // 时间安排
  requestedTime?: Date;          // 用户期望的回呼时间
  promisedTimeWindow: {          // 承诺的时间窗口
    start: Date;
    end: Date;
  };
  
  // 处理人
  assignedAdjusterId?: string;
  assignedAt?: Date;
  
  // 提醒机制
  reminderSent: boolean;
  notificationLog: {
    channel: 'sms' | 'enterprise_wechat' | 'app_push';
    sentAt: Date;
    status: 'sent' | 'delivered' | 'failed';
  }[];
  
  createdAt: Date;
  updatedAt: Date;
}

// 预约回呼API
async function createCallbackAppointment(params: CreateAppointmentDTO) {
  // 1. 创建预约记录
  const appointment = await db.callbackAppointments.create({
    conversationId: params.conversationId,
    claimId: params.claimId,
    customerId: params.customerId,
    questionSummary: params.questionSummary,
    urgency: params.urgency,
    promisedTimeWindow: calculateTimeWindow(params.urgency), // 基于紧急程度计算
    status: 'pending'
  });
  
  // 2. 通知理赔员
  await notifyAvailableAdjusters({
    type: 'callback_request',
    appointmentId: appointment.id,
    claimNumber: params.claimNumber,
    questionSummary: params.questionSummary,
    urgency: params.urgency,
    promisedTimeWindow: appointment.promisedTimeWindow
  });
  
  // 3. 设置提醒定时任务
  await scheduleReminder(appointment.id, appointment.promisedTimeWindow.end);
  
  // 4. 给用户确认
  await sendMessageToGroup({
    conversationId: params.conversationId,
    sender: { userId: 'ai_assistant', userType: 'ai' },
    content: `已为您预约人工回呼。\n\n📋 问题摘要：${params.questionSummary}\n⏰ 承诺时间：${formatTimeWindow(appointment.promisedTimeWindow)}\n\n理赔员将在承诺时间内与您联系，请保持手机畅通。您现在可以离开小程序，收到回复时会通过微信通知您。`
  });
  
  return appointment;
}
```

#### 3.3.2 通知机制

| 场景 | 通知渠道 | 内容 |
|------|----------|------|
| 新预约创建 | 企业微信 + 短信 | 案件号、问题摘要、承诺时间 |
| 临近承诺时间 | 企业微信 + 电话 | 提醒理赔员尽快处理 |
| 理赔员回复 | 微信服务通知 | "理赔员XXX回复了您的消息" |
| 超时未处理 | 短信 + 上级通知 | 升级给主管处理 |

---

## 4. 数据库设计

### 4.1 核心表结构

```sql
-- 会话表（对应IM群组）
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id),
    claim_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'paused', 'closed')),
    im_group_id VARCHAR(100),  -- 腾讯云IM群组ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 群组成员表
CREATE TABLE conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    user_id VARCHAR(100) NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'adjuster', 'ai')),
    nickname VARCHAR(100),
    avatar_url TEXT,
    enterprise_wechat_id VARCHAR(100),  -- 理赔员的企业微信ID
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(conversation_id, user_id)
);

-- 消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender_id VARCHAR(100) NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'adjuster', 'ai', 'system')),
    
    -- 消息内容
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('text', 'image', 'file', 'voice', 'location')),
    content TEXT NOT NULL,
    
    -- 附件
    attachments JSONB DEFAULT '[]',  -- [{url, type, name, size}]
    
    -- @提及
    mentions JSONB DEFAULT '[]',  -- [{userId, userType, nickname}]
    
    -- 元数据
    metadata JSONB DEFAULT '{}',  -- {ocrResult, aiIntent, sentiment}
    
    -- 发送来源
    source VARCHAR(20) NOT NULL CHECK (source IN ('mini_program', 'enterprise_wechat', 'system')),
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 索引
    INDEX idx_messages_conversation_created (conversation_id, created_at DESC),
    INDEX idx_messages_sender (sender_id, created_at DESC)
);

-- 预约回呼表
CREATE TABLE callback_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    claim_id UUID NOT NULL REFERENCES claims(id),
    
    customer_id VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20),
    customer_open_id VARCHAR(100),
    
    question_summary TEXT NOT NULL,
    urgency VARCHAR(10) NOT NULL CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
    
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'assigned', 'contacted', 'resolved', 'expired')),
    
    requested_time TIMESTAMP WITH TIME ZONE,
    promised_time_start TIMESTAMP WITH TIME ZONE NOT NULL,
    promised_time_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    assigned_adjuster_id VARCHAR(100),
    assigned_at TIMESTAMP WITH TIME ZONE,
    
    reminder_sent BOOLEAN DEFAULT FALSE,
    notification_log JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI对话上下文表（用于LangGraph状态持久化）
CREATE TABLE ai_conversation_states (
    conversation_id UUID PRIMARY KEY REFERENCES conversations(id),
    thread_id VARCHAR(100) NOT NULL,  -- LangGraph thread ID
    checkpoint JSONB NOT NULL,  -- LangGraph checkpoint
    claim_data JSONB,  -- 案件相关数据缓存
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4.2 索引策略

| 表 | 索引 | 用途 |
|----|------|------|
| messages | (conversation_id, created_at DESC) | 查询会话消息历史 |
| messages | (sender_id, created_at DESC) | 查询用户发送的消息 |
| callback_appointments | (status, promised_time_end) | 查询待处理的预约 |
| callback_appointments | (assigned_adjuster_id, status) | 查询理赔员的预约 |
| conversation_members | (conversation_id, user_type) | 查询会话中的特定类型成员 |

---

## 5. 技术实现细节

### 5.1 腾讯云IM集成

#### 5.1.1 SDK选择

```typescript
// 服务端：使用腾讯云IM服务端API
import { TIMServer } from 'tim-node-sdk';

const timServer = new TIMServer({
  sdkAppId: process.env.TIM_SDK_APP_ID,
  secretKey: process.env.TIM_SECRET_KEY,
  identifier: 'administrator'
});

// 小程序端：使用腾讯云IM小程序SDK
import TIM from 'tim-wx-sdk';

const tim = TIM.create({
  SDKAppID: process.env.TIM_SDK_APP_ID
});
```

#### 5.1.2 群组管理

```typescript
// 创建理赔会话群组
async function createClaimGroup(claimId: string, members: Member[]) {
  const groupId = `claim_${claimId}_${Date.now()}`;
  
  // 1. 创建群组
  await timServer.createGroup({
    Type: 'ChatRoom',  // 聊天室类型，支持大量成员
    Name: `理赔案件-${claimId}`,
    GroupId: groupId,
    Introduction: `理赔案件${claimId}的沟通群组`,
    Notification: '欢迎使用AI理赔助手，@AI可直接向AI提问，@人工可联系理赔员',
    FaceUrl: 'https://example.com/claim-icon.png'
  });
  
  // 2. 添加成员
  const memberList = members.map(m => ({
    Member_Account: m.userId,
    Role: m.userType === 'adjuster' ? 'Admin' : 'Member'
  }));
  
  await timServer.addGroupMember({
    GroupId: groupId,
    MemberList: memberList
  });
  
  // 3. 添加AI助手（作为系统账号）
  await timServer.addGroupMember({
    GroupId: groupId,
    MemberList: [{
      Member_Account: 'ai_assistant',
      Role: 'Member'
    }]
  });
  
  return groupId;
}
```

#### 5.1.3 消息监听与路由

```typescript
// 监听群组消息
app.post('/tim/callback', async (req, res) => {
  const { CallbackCommand, GroupId, From_Account, MsgBody } = req.body;
  
  if (CallbackCommand === 'Group.CallbackBeforeSendMsg') {
    // 消息发送前回调
    const message = parseTimMessage(MsgBody);
    
    // 保存到数据库
    await saveMessage({
      conversationId: GroupId,
      senderId: From_Account,
      content: message.content,
      contentType: message.type,
      source: 'mini_program'
    });
    
    // 路由到AI或人工
    if (message.mentions.includes('ai_assistant') || message.mentions.length === 0) {
      // 异步触发AI处理
      await aiMessageQueue.add('process-ai-message', {
        conversationId: GroupId,
        messageId: message.id,
        content: message.content
      });
    }
    
    res.json({ ActionStatus: 'OK', ErrorInfo: '', ErrorCode: 0 });
  }
});
```

### 5.2 企业微信集成

#### 5.2.1 配置

```typescript
// 企业微信配置
const wechatWorkConfig = {
  corpId: process.env.WECHAT_WORK_CORP_ID,
  corpSecret: process.env.WECHAT_WORK_CORP_SECRET,
  agentId: process.env.WECHAT_WORK_AGENT_ID
};

// 获取access_token
async function getAccessToken() {
  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${wechatWorkConfig.corpId}&corpsecret=${wechatWorkConfig.corpSecret}`
  );
  const data = await response.json();
  return data.access_token;
}
```

#### 5.2.2 消息推送

```typescript
// 发送企业微信消息
async function sendEnterpriseWechatMessage(params: {
  userId: string;
  message: string;
  claimNumber: string;
  conversationId: string;
}) {
  const accessToken = await getAccessToken();
  
  // 构建卡片消息
  const cardMessage = {
    touser: params.userId,
    msgtype: 'template_card',
    agentid: wechatWorkConfig.agentId,
    template_card: {
      card_type: 'text_notice',
      source: {
        desc: '企业微信',
        desc_color: 0
      },
      main_title: {
        title: '新理赔案件消息',
        desc: `案件号：${params.claimNumber}`
      },
      emphasis_content: {
        title: params.message.substring(0, 30) + '...',
        desc: '用户消息'
      },
      jump_list: [
        {
          type: 1,
          url: `${process.env.ADJUSTER_APP_URL}/conversation/${params.conversationId}`,
          title: '查看完整对话'
        }
      ],
      card_action: {
        type: 1,
        url: `${process.env.ADJUSTER_APP_URL}/conversation/${params.conversationId}`
      }
    }
  };
  
  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardMessage)
    }
  );
  
  return response.json();
}
```

#### 5.2.3 接收企业微信消息

```typescript
// 企业微信消息回调验证
app.get('/webhook/enterprise-wechat', (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  
  // 验证签名
  const signature = generateSignature({
    token: process.env.WECHAT_WORK_TOKEN,
    timestamp,
    nonce,
    echostr
  });
  
  if (signature === msg_signature) {
    // 解密并返回echostr
    const decrypted = decrypt(echostr, process.env.WECHAT_WORK_ENCODING_AES_KEY);
    res.send(decrypted);
  } else {
    res.status(403).send('Invalid signature');
  }
});

// 处理企业微信消息
app.post('/webhook/enterprise-wechat', async (req, res) => {
  const message = await parseWechatWorkMessage(req.body);
  
  if (message.msgType === 'text') {
    // 查找对应的会话
    const conversation = await findConversationByAdjuster(message.fromUserId);
    
    if (conversation) {
      // 保存消息
      await saveMessage({
        conversationId: conversation.id,
        senderId: message.fromUserId,
        senderType: 'adjuster',
        content: message.content,
        contentType: 'text',
        source: 'enterprise_wechat'
      });
      
      // 推送到腾讯云IM
      await timServer.sendGroupMessage({
        groupId: conversation.imGroupId,
        fromAccount: message.fromUserId,
        messageBody: message.content
      });
      
      // 推送到小程序WebSocket
      await websocketServer.broadcast(conversation.id, {
        type: 'new_message',
        data: {
          sender: { userId: message.fromUserId, userType: 'adjuster' },
          content: message.content,
          timestamp: Date.now()
        }
      });
    }
  }
  
  res.send('success');
});
```

### 5.3 AI Agent集成

#### 5.3.1 LangGraph工作流

```typescript
import { StateGraph, END } from '@langchain/langgraph';

// 定义状态
interface ClaimAgentState {
  messages: Message[];
  claimId: string;
  claimData: ClaimData;
  intent: string;
  requiresHuman: boolean;
  response: string;
}

// 构建工作流
const workflow = new StateGraph<ClaimAgentState>({
  channels: {
    messages: { value: (x, y) => x.concat(y), default: () => [] },
    claimId: { value: (x, y) => y ?? x },
    claimData: { value: (x, y) => y ?? x },
    intent: { value: (x, y) => y ?? x },
    requiresHuman: { value: (x, y) => y ?? x },
    response: { value: (x, y) => y ?? x }
  }
});

// 节点1: 意图识别
workflow.addNode('intent_analysis', async (state) => {
  const intent = await classifyIntent(state.messages);
  return { intent };
});

// 节点2: 处理简单询问
workflow.addNode('handle_inquiry', async (state) => {
  const response = await generateResponse(state);
  return { response };
});

// 节点3: 材料预审
workflow.addNode('document_review', async (state) => {
  const review = await reviewDocuments(state.claimId);
  return { response: formatReviewResult(review) };
});

// 节点4: 转人工
workflow.addNode('escalate_to_human', async (state) => {
  await createCallbackAppointment({
    conversationId: state.claimId,
    questionSummary: summarizeQuestion(state.messages),
    urgency: determineUrgency(state)
  });
  return { 
    response: '已为您预约人工回呼，理赔员将在15分钟内与您联系。',
    requiresHuman: true
  };
});

// 节点5: 生成回复
workflow.addNode('generate_response', async (state) => {
  return { response: state.response };
});

// 边和条件
workflow.addEdge('intent_analysis', (state) => {
  if (state.intent === 'simple_inquiry') return 'handle_inquiry';
  if (state.intent === 'document_review') return 'document_review';
  if (state.intent === 'requires_human') return 'escalate_to_human';
  return 'handle_inquiry';
});

workflow.addEdge('handle_inquiry', 'generate_response');
workflow.addEdge('document_review', 'generate_response');
workflow.addEdge('escalate_to_human', END);
workflow.addEdge('generate_response', END);

workflow.setEntryPoint('intent_analysis');

const agent = workflow.compile();
```

#### 5.3.2 AI消息处理队列

```typescript
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// 创建队列
const aiMessageQueue = new Queue('ai-message-processing', {
  connection: new Redis(process.env.REDIS_URL)
});

// 处理器
aiMessageQueue.process(async (job) => {
  const { conversationId, messageId, content } = job.data;
  
  // 获取会话上下文
  const state = await getConversationState(conversationId);
  
  // 运行AI Agent
  const result = await agent.invoke({
    messages: [...state.messages, { role: 'user', content }],
    claimId: state.claimId,
    claimData: state.claimData
  });
  
  // 保存AI回复
  await saveMessage({
    conversationId,
    senderId: 'ai_assistant',
    senderType: 'ai',
    content: result.response,
    contentType: 'text',
    source: 'system'
  });
  
  // 推送到腾讯云IM
  await timServer.sendGroupMessage({
    groupId: state.imGroupId,
    fromAccount: 'ai_assistant',
    messageBody: result.response
  });
  
  // 如果需要人工，创建预约
  if (result.requiresHuman) {
    await createCallbackAppointment({
      conversationId,
      claimId: state.claimId,
      questionSummary: content
    });
  }
});
```

---

## 6. 安全与合规

### 6.1 数据安全

| 层面 | 措施 |
|------|------|
| **传输安全** | 全站HTTPS，WSS加密WebSocket |
| **数据加密** | 敏感字段（手机号、身份证号）AES-256加密存储 |
| **访问控制** | JWT认证 + RBAC权限模型 |
| **审计日志** | 所有操作记录审计日志，保留3年 |

### 6.2 保险合规

| 要求 | 实现 |
|------|------|
| **数据保留** | 理赔数据保存至少10年 |
| **隐私保护** | 用户敏感信息脱敏展示 |
| **操作可追溯** | 每笔理赔操作记录操作人、时间、内容 |
| **AI决策解释** | AI做出的关键决策需记录推理过程 |

### 6.3 企业微信安全

- 企业微信回调验证使用Token + EncodingAESKey双重验证
- 企业微信消息加密传输
- 定期轮换access_token

---

## 7. 部署架构

### 7.1 生产环境架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CDN Layer                                      │
│                    (Static Assets, Mini Program Resources)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Load Balancer (Nginx)                             │
│                    - SSL Termination  - Rate Limiting                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   API Server 1      │  │   API Server 2      │  │   API Server N      │
│   (Node.js/PM2)     │  │   (Node.js/PM2)     │  │   (Node.js/PM2)     │
│                     │  │                     │  │                     │
│ - REST API          │  │ - REST API          │  │ - REST API          │
│ - WebSocket         │  │ - WebSocket         │  │ - WebSocket         │
│ - Webhook Handler   │  │ - Webhook Handler   │  │ - Webhook Handler   │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
              │                        │                        │
              └────────────────────────┼────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Layer                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  PostgreSQL      │  │  Redis Cluster   │  │  OSS / MinIO     │          │
│  │  (Primary +      │  │  (Session +      │  │  (File Storage)  │          │
│  │   Replica)       │  │   Queue)         │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      External Services                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Tencent Cloud   │  │  WeChat Work     │  │  Gemini API      │          │
│  │  IM              │  │  API             │  │  (Google AI)     │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 技术栈总结

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端（小程序）** | Taro + React | 4.x / 19.x |
| **后端API** | Node.js + Express | 20.x / 5.x |
| **AI Agent** | LangGraph + Gemini | Latest |
| **即时通信** | Tencent Cloud IM | Latest SDK |
| **数据库** | PostgreSQL | 15+ |
| **缓存** | Redis | 7+ |
| **消息队列** | BullMQ | Latest |
| **文件存储** | 阿里云OSS / MinIO | - |
| **部署** | Docker + PM2 | - |

---

## 8. 实施路线图

### 8.1 阶段划分

#### Phase 1: 基础设施 (4周)
**目标**: 搭建基础架构，实现核心功能

| 任务 | 负责人 | 工期 | 产出 |
|------|--------|------|------|
| 腾讯云IM集成 | 后端 | 1周 | IM群组创建、消息收发 |
| PostgreSQL数据库搭建 | DBA | 1周 | 表结构、索引、备份策略 |
| 企业微信应用配置 | 后端 | 1周 | 回调验证、消息推送 |
| WebSocket服务优化 | 后端 | 1周 | 连接管理、消息广播 |

#### Phase 2: 核心功能 (6周)
**目标**: 实现群聊模式、双向同步

| 任务 | 负责人 | 工期 | 产出 |
|------|--------|------|------|
| 小程序IM界面开发 | 前端 | 2周 | 聊天界面、@提及、文件上传 |
| 消息路由逻辑 | 后端 | 2周 | @触发、AI路由、人工路由 |
| 双向同步机制 | 后端 | 2周 | 小程序↔企业微信实时同步 |
| 预约回呼功能 | 后端 | 1周 | 预约创建、通知、提醒 |
| 企业微信卡片消息 | 后端 | 1周 | 消息卡片、快捷回复 |

#### Phase 3: AI增强 (4周)
**目标**: 集成AI Agent，实现智能理赔

| 任务 | 负责人 | 工期 | 产出 |
|------|--------|------|------|
| LangGraph工作流集成 | AI工程师 | 2周 | 意图识别、材料预审 |
| AI对话上下文管理 | 后端 | 1周 | 状态持久化、多轮对话 |
| OCR发票识别 | AI工程师 | 1周 | 发票上传、自动识别 |

#### Phase 4: 优化与上线 (2周)
**目标**: 性能优化、安全加固、生产上线

| 任务 | 负责人 | 工期 | 产出 |
|------|--------|------|------|
| 性能优化 | 全团队 | 1周 | 缓存优化、查询优化 |
| 安全审计 | 安全团队 | 1周 | 渗透测试、合规检查 |
| 生产部署 | 运维 | 1周 | 上线、监控、应急预案 |

### 8.2 总工期

**预计总工期**: 16周（约4个月）

```
Week:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
       │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
Phase1:████
Phase2:      ██████
Phase3:                  ████
Phase4:                              ██
```

---

## 9. 风险评估与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| **腾讯云IM限制** | 中 | 高 | 准备备用方案（自建WebSocket集群） |
| **企业微信审核** | 中 | 高 | 提前准备资质材料，预留审核时间 |
| **AI准确率不足** | 中 | 中 | 设置人工审核环节，逐步调优模型 |
| **数据迁移问题** | 低 | 高 | 制定详细迁移计划，分批次迁移 |
| **用户接受度** | 中 | 中 | 初期保留人工入口，逐步引导使用AI |

---

## 10. 成功指标

| 指标 | 当前值 | 目标值 | 测量方式 |
|------|--------|--------|----------|
| **平均处理时长** | 10-30分钟 | <15分钟 | 案件处理时间统计 |
| **AI解决率** | 0% | >60% | AI独立完成的案件比例 |
| **用户满意度** | - | >4.5/5 | 结案后用户评分 |
| **理赔员人效** | X案件/人/天 | 1.5X案件/人/天 | 人均处理案件数 |
| **平均等待时间** | - | <5分钟 | 用户发起咨询到首次回复 |

---

## 11. 附录

### 11.1 关键决策记录

| 决策 | 方案 | 原因 |
|------|------|------|
| **群聊模式** | 用户+AI+人工在同一群组 | 体验自然，无需显式切换 |
| **@触发** | 用户@AI或@人工 | 灵活可控，用户有选择权 |
| **双向同步** | 小程序↔企业微信实时同步 | 理赔员可直接在企业微信回复 |
| **腾讯云IM** | 使用腾讯云IM而非自建 | 节省开发时间，可靠性高 |
| **预约回呼** | 用户无需等待，预约后离开 | 提升用户体验 |

### 11.2 参考资源

- [腾讯云IM文档](https://cloud.tencent.com/document/product/269)
- [企业微信开发者文档](https://developer.work.weixin.qq.com/document/path/90664)
- [LangGraph文档](https://langchain-ai.github.io/langgraph/)

---

**文档版本**: v1.0  
**创建日期**: 2026-03-07  
**最后更新**: 2026-03-07  

*本方案基于对现有代码库的深度探索和用户访谈生成，充分考虑了现有基础设施的复用。*
