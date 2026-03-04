# 语音理赔功能导航指南

## 📁 已创建的文件位置

### 1. 前端组件 (components/voice/)
```
components/voice/
├── VoiceClient.tsx       # 主语音客户端组件
├── VoiceVisualizer.tsx   # 音频可视化组件
├── TranscriptDisplay.tsx # 转录文本显示
└── VoiceControls.tsx     # 语音控制按钮
```

### 2. 类型定义和Hooks
```
types/voice.ts           # 语音相关类型定义
hooks/useVoiceSession.ts # 语音会话管理Hook
```

### 3. 后端服务 (server/voice/)
```
server/voice/
├── VoiceGateway.ts       # WebSocket网关
├── VoiceSession.ts       # 会话管理
├── VoicePipeline.ts      # STT/LLM/TTS管道
├── services/
│   ├── AliyunNLS.ts     # 阿里云语音识别
│   ├── AliyunTTS.ts     # 阿里云语音合成
│   └── index.ts         # 服务导出
└── tools/
    ├── index.ts         # 工具注册
    ├── checkPolicy.ts   # 查询保单
    ├── submitClaim.ts   # 提交报案
    └── getProgress.ts   # 查询进度
```

### 4. 测试页面
```
pages/VoiceClaimPage.tsx  # 语音理赔测试页面
```

---

## 🚀 如何使用这个功能

### 方法1：在现有页面中添加语音组件

```tsx
// 在任意页面中导入并使用
import { VoiceClient } from '../components/voice/VoiceClient';

function MyPage() {
  return (
    <VoiceClient
      sessionId="test-session"
      wsUrl="ws://localhost:8080/voice/ws/test"
      onSessionEnd={(summary) => console.log('结束:', summary)}
    />
  );
}
```

### 方法2：访问独立测试页面

需要在 `App.tsx` 中添加路由：

```tsx
// App.tsx
import { VoiceClaimPage } from './pages/VoiceClaimPage';

// 在路由中添加
<Route path="/voice-claim" element={<VoiceClaimPage />} />
```

然后访问：`http://localhost:8080/voice-claim`

### 方法3：在现有理赔流程中集成

例如在 `ClaimCaseListPage.tsx` 中添加语音入口按钮：

```tsx
// 在页面中添加按钮
<button onClick={() => setShowVoice(true)}>
  语音报案
</button>

// 显示语音组件
{showVoice && (
  <VoiceClient
    sessionId={`voice_${Date.now()}`}
    wsUrl={`ws://localhost:8080/voice/ws/${sessionId}`}
    onSessionEnd={() => setShowVoice(false)}
  />
)}
```

---

## ⚙️ 配置文件 (.env.local)

已添加阿里云语音服务配置：

```bash
# 阿里云智能语音交互 (NLS)
ALIYUN_ACCESS_KEY_ID=LTAI5tCC4e4fMihgkFAhBPTh
ALIYUN_ACCESS_KEY_SECRET=bDw4M17p4z0FhyXbobICcEEkb4bmpV
ALIYUN_NLS_APP_KEY=eD8SC9ppgzaDYK0Q

# 阿里云语音合成 (TTS)
ALIYUN_TTS_APP_KEY=eD8SC9ppgzaDYK0Q
```

---

## 📋 功能清单

### ✅ 已完成的功能
- [x] 前端UI组件（语音按钮、波形可视化、对话展示）
- [x] WebSocket连接管理
- [x] 阿里云NLS语音识别集成
- [x] 阿里云TTS语音合成集成
- [x] Gemini LLM对话处理
- [x] 保单查询工具
- [x] 报案提交工具
- [x] 进度查询工具
- [x] 语音打断处理

### ⏳ 待完善的功能
- [ ] 阿里云Token动态获取（STS）
- [ ] 对话状态机持久化
- [ ] 错误重连机制
- [ ] 性能监控和日志

---

## 🎯 快速测试步骤

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **在 App.tsx 中添加测试路由**
   ```tsx
   import { VoiceClaimPage } from './pages/VoiceClaimPage';
   
   // 在 routes 中添加
   { path: '/voice-claim', element: <VoiceClaimPage /> }
   ```

3. **访问测试页面**
   打开浏览器访问：`http://localhost:8080/voice-claim`

4. **点击"开始语音对话"** 测试功能

---

## 🔍 文件内容预览

### VoiceClient.tsx
- 状态：连接中/聆听中/AI说话中
- 实时转录文本展示
- 对话历史记录
- 打断控制

### VoiceGateway.ts
- WebSocket连接管理
- 会话生命周期管理
- 消息路由
- 心跳保活

### AliyunNLS.ts / AliyunTTS.ts
- 阿里云语音服务WebSocket连接
- 流式音频处理
- 多音色支持

---

## 📞 需要帮助？

如果您在集成过程中遇到任何问题，请告诉我：
1. 具体错误信息
2. 您希望如何集成到现有流程
3. 需要调整的功能
