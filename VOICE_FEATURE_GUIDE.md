# 语音理赔功能导航指南

## ✅ 功能状态：已修复并可用

语音报案功能的所有问题已修复，功能现已完全可用。

**修复内容**:
- ✅ 后端 TypeScript 编译配置
- ✅ WebSocket 路径匹配问题（支持动态 sessionId）
- ✅ 服务器 upgrade 事件处理

---

## 🚀 快速启动（必读）

### 步骤 1: 编译后端代码

**首次使用或后端代码更新后必须执行**：

```bash
npm run build:server
```

这会将 `server/` 目录下的 TypeScript 文件编译到 `dist-server/server/` 目录。

### 步骤 2: 启动服务器

```bash
npm start
```

服务器启动后，你应该看到：
```
[VoiceGateway] WebSocket server initialized on path: /voice/ws
[Server] 语音 WebSocket 服务已初始化
Voice WebSocket: ws://localhost:3000/voice/ws/:sessionId
```

### 步骤 3: 访问功能

1. 浏览器访问：http://localhost:3000
2. 登录系统（admin/234567）
3. 导航到：**理赔管理 → 语音报案**
4. 点击"开始语音对话"
5. 点击"开始对话"按钮连接 WebSocket
6. 允许浏览器麦克风权限
7. 点击"开始聆听"开始语音识别

---

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

## 🐛 故障排查

### 问题 1: WebSocket 连接失败

**症状**: 点击"开始语音对话"后显示"连接失败，请检查麦克风权限"

**原因**: 后端 WebSocket 服务未启动

**解决方案**:
```bash
# 1. 编译后端代码
npm run build:server

# 2. 重启服务器
npm start

# 3. 确认看到以下日志
# [VoiceGateway] WebSocket server initialized on path: /voice/ws
# [Server] 语音 WebSocket 服务已初始化
```

### 问题 2: 编译错误

**症状**: `npm run build:server` 失败

**解决方案**:
```bash
# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 重新编译
npm run build:server
```

### 问题 3: 麦克风权限被拒绝

**症状**: 浏览器提示麦克风权限被拒绝

**解决方案**:
1. 检查浏览器设置 → 隐私和安全 → 网站设置 → 麦克风
2. 确保 localhost 或当前域名有麦克风权限
3. 刷新页面并重新授权

### 问题 4: 阿里云服务连接失败

**症状**: 语音识别或合成不工作

**解决方案**:
1. 检查 `.env.local` 中的阿里云凭证是否正确
2. 确认网络可以访问阿里云服务
3. 检查服务器日志中的错误信息

### 问题 5: 前后端端口不匹配

**症状**: 开发环境下 WebSocket 连接到错误的端口

**解决方案**:
- 前端开发: `npm run dev` (端口 8080)
- 后端服务: `npm start` (端口 3000)
- 前端需要连接到后端的 WebSocket: `ws://localhost:3000/voice/ws/:sessionId`

---

## 📞 需要帮助？

如果您在集成过程中遇到任何问题，请告诉我：
1. 具体错误信息
2. 您希望如何集成到现有流程
3. 需要调整的功能
