# 实时语音对话智能体 - 研究与发现草案

## 1. 现有系统架构分析

### 1.1 AI Agent 架构
- **核心框架**: LangGraph (状态机) + LangChain
- **模型**: Google Gemini 2.5 Flash
- **文件位置**: `server/ai/`
  - `agent.js` - 旧版 LangChain Agent
  - `graph.js` - LangGraph 状态图 (推荐)
  - `graph-with-checkpointer.js` - 带状态持久化
  - `state.js` - 状态定义
  - `tools/` - 4个工具
    - `checkEligibilityTool` - 责任判断
    - `calculateAmountTool` - 金额计算
    - `queryMedicalCatalogTool` - 医保目录查询
    - `queryHospitalInfoTool` - 医院信息查询

### 1.2 Claims 数据结构
- **ClaimCase** (types.ts:516-553)
  - id, reportNumber, reporter, reportTime
  - accidentTime, accidentReason, accidentLocation
  - claimAmount, approvedAmount, status
  - policyholder, insured, policyNumber, policyPeriod
  - requiredMaterials[] - 动态材料清单
  - intakeFormData - 报案表单数据

### 1.3 报案配置系统
- **IntakeConfig** (types.ts:654-684)
  - fields[] - 报案字段配置
  - voice_input - 语音输入配置
  - claimMaterials - 材料清单配置
  - claimItems - 索赔项目列表
  - accidentCauses - 事故原因配置

### 1.4 现有语音能力
- **smartclaim-ai-agent/** - 独立AI理赔助手应用
  - `geminiService.ts:transcribeAudio()` - 语音转文本 (非实时)
  - 使用 Gemini 文件上传方式处理音频
  - 支持文本聊天、文档上传、意图识别

### 1.5 API 架构
- RESTful API via `/api/*`
- 主要 Claims 端点 (server/apiHandler.js)
  - `GET /api/claim-cases` - 案件列表
  - `POST /api/claim-cases` - 创建案件
  - `GET /api/claim-cases/:id` - 案件详情
  - `POST /api/ai/smart-review` - AI智能审核

---

## 2. 实时语音技术方案研究

### 2.1 架构选择

#### 方案A: WebSocket 双向流式 (推荐)
- **STT**: 阿里云 NLS (实时语音识别)
  - 中文优化，保险专业词汇支持
  - 流式识别，延迟 < 300ms
  - 支持语音活性检测 (VAD)
  
- **LLM**: Google Gemini 2.5 Flash
  - 原生支持工具调用
  - 低延迟 (500-1000ms)
  
- **TTS**: 阿里云语音合成
  - 流式合成
  - 多种中文音色
  - 支持 SSML

#### 方案B: 原生语音LLM (OpenAI Realtime API / Gemini Live API)
- **优点**: 端到端延迟极低 (200-400ms)
- **缺点**: 
  - 工具调用支持有限
  - 中文质量不如专业TTS
  - 成本较高

#### 方案C: 混合方案 (备选)
- VAD + WebSocket + 分段处理
- 前端VAD检测语音段落
- 分段发送到STT
- 降低API调用成本

### 2.2 关键技术组件

| 组件 | 技术选型 | 延迟 | 成本 | 备注 |
|------|----------|------|------|------|
| STT | 阿里云 NLS | <300ms | 低 | 中文优化 |
| LLM | Gemini 2.5 Flash | 500-1000ms | 中 | 工具调用 |
| TTS | 阿里云语音合成 | 100-200ms | 低 | 流式输出 |
| VAD | 阿里云 NLS内置 | - | - | 无需单独部署 |
| 信令 | WebSocket | <50ms | - | 双向实时 |

### 2.3 技术挑战与解决方案

| 挑战 | 解决方案 |
|------|----------|
| 打断处理 (Barge-in) | 前端VAD检测 + WebSocket控制信令 |
| 槽位提取 | 意图识别 + 动态字段填充 |
| 确认机制 | "您说的是XX，对吗？" 二次确认 |
| 错误恢复 | 优雅降级到文本界面 |
| 并发连接 | WebSocket连接池 + 心跳保活 |

---

## 3. 语音对话流程设计

### 3.1 报案场景对话流程

```
[用户] 喂，我要报案
[AI] 您好，我是智能理赔助手。请问您是保单持有人本人吗？
[用户] 是的
[AI] 好的，正在为您查询保单信息...
[AI] 查到您名下有2张有效保单：
      1. 众安百万医疗险，保单号ZA123456
      2. 平安意外险，保单号PA789012
      请问您要为哪张保单报案？
[用户] 第一个
[AI] 好的，为众安百万医疗险报案。请描述一下事故经过。
[用户] 我在医院做了阑尾手术
[AI] 明白了，您因急性阑尾炎住院手术。请问事故发生时间是？
[用户] 昨天
[AI] 好的，2024年3月3日。请问在哪家医院？
[用户] 北京协和医院
[AI] 收到，北京协和医院。根据您的保单，此次医疗险报案
      需要提供以下材料：
      1. 身份证正反面
      2. 医疗发票原件
      3. 出院小结
      4. 费用清单
      材料清单已发送到您的微信，请注意查看。
      您可以在小程序中上传材料，有任何问题随时问我。
```

### 3.2 槽位提取与确认机制

- **必录字段**: 保单选择、事故时间、事故原因、医院名称
- **选录字段**: 事故地点、预估金额、联系人
- **确认模式**: 每个关键字段二次确认
- **容错处理**: 语音识别错误时主动澄清

---

## 4. 待澄清问题

### 4.1 目标平台
- [ ] 主要平台是 H5 Web、微信小程序、还是原生APP？
- [ ] 是否需要同时支持多端？

### 4.2 实时性要求
- [ ] "实时对话"是指双向流式语音，还是语音输入+AI语音回复？
- [ ] 可接受的端到端延迟是多少？（500ms / 1s / 2s）

### 4.3 功能边界
- [ ] 是否只需支持报案，还是包括查进度、材料补充等其他意图？
- [ ] 是否需要集成到现有 smartclaim-ai-agent，还是独立功能？

### 4.4 技术约束
- [ ] 预期并发用户数？
- [ ] 是否有特定的云服务提供商限制？
- [ ] 是否需要在私有化环境部署？

### 4.5 用户体验
- [ ] 是否支持打断AI说话？
- [ ] 是否需要在语音识别失败时自动重试？
- [ ] 是否保留对话历史供后续查看？

---

## 5. 参考文件

### 5.1 核心代码文件
- `server/ai/agent.js` - AI Agent 实现
- `server/ai/graph.js` - LangGraph 状态图
- `server/ai/tools/index.js` - 工具定义
- `types.ts` - 类型定义
- `smartclaim-ai-agent/App.tsx` - 现有AI聊天界面
- `smartclaim-ai-agent/geminiService.ts` - AI服务

### 5.2 报案相关
- `wechat-miniprogram/src/pages/report/index.tsx` - 小程序报案页
- `wechat-miniprogram/src/pages/chat/index.tsx` - 小程序聊天页
- `components/ClaimIntakeConfigPage.tsx` - 报案配置管理

---

*最后更新: 2026-03-04*
