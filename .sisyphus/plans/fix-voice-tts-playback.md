# 工作计划：修复语音报案的语音回答（TTS）功能

## 问题概述

**现状**：语音报案功能只能显示文字回答，无法播放语音。

**根本原因**：前端使用了错误的音频解码方法。
- 后端阿里云 TTS 服务正确发送 PCM 格式音频（16kHz, 16-bit）
- 前端 `hooks/useVoiceSession.ts` 使用浏览器原生的 `decodeAudioData()` 解码
- `decodeAudioData()` **不支持 PCM 格式**，导致音频播放失败

**参考实现**：`smartclaim-ai-agent/App.tsx` 中已有正确的 PCM 解码函数（第 73-90 行）

---

## 修改范围

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `hooks/useVoiceSession.ts` | 修改 | 添加 PCM 解码函数，修复音频播放 |
| `components/voice/VoiceClient.tsx` | 可选增强 | 添加语音播放状态指示器 |

---

## 任务清单

### 任务 1：添加 PCM 解码工具函数

**文件**：`hooks/useVoiceSession.ts`

**位置**：在文件末尾的 utility functions 区域（第 274 行之后）

**添加代码**：

```typescript
/**
 * 解码 PCM 音频数据为 AudioBuffer
 * 阿里云 TTS 返回的是 PCM 格式（16kHz, 16-bit, 单声道）
 * 浏览器原生 decodeAudioData 不支持 PCM，需要手动转换
 * 
 * 注意：使用 Uint8Array 保持与 smartclaim-ai-agent/App.tsx 参考实现一致
 */
function decodePCMToAudioBuffer(
  pcmData: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 16000,
  numChannels: number = 1
): AudioBuffer {
  // 使用 Int16Array 直接处理，与参考实现一致
  const dataInt16 = new Int16Array(pcmData.buffer);
  const frameCount = dataInt16.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // 将 16-bit 有符号整数转换为 -1.0 到 1.0 的浮点数
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }

  return audioBuffer;
}
```

**QA 验证**：
- 函数编译无错误
- 参数类型正确：Uint8Array, AudioContext, number, number
- 返回值类型：AudioBuffer
- 与 `smartclaim-ai-agent/App.tsx:73-90` 参考实现保持一致

---

### 任务 2：修复音频消息处理逻辑

**文件**：`hooks/useVoiceSession.ts`

**位置**：`handleAudioMessage` 函数（第 192-206 行）

**当前代码**：
```typescript
const handleAudioMessage = useCallback(
  async (payload: AudioPayload) => {
    if (!audioContextRef.current) return;

    const audioData = base64ToArrayBuffer(payload.data);
    const audioBuffer =
      await audioContextRef.current.decodeAudioData(audioData);  // ❌ 错误：不支持 PCM
    audioQueueRef.current.push(audioBuffer);

    if (!state.isSpeaking) {
      playAudioQueue();
    }
  },
  [state.isSpeaking],
);
```

**修改后的代码**：
```typescript
const handleAudioMessage = useCallback(
  async (payload: AudioPayload) => {
    if (!audioContextRef.current) return;

    // 检查空数据
    if (!payload.data || payload.data.length === 0) {
      console.warn('[useVoiceSession] Empty audio data received');
      return;
    }

    try {
      const audioData = base64ToArrayBuffer(payload.data);
      // 转换为 Uint8Array 保持与参考实现一致
      const uint8Array = new Uint8Array(audioData);
      
      // 使用自定义 PCM 解码替代原生 decodeAudioData
      const audioBuffer = decodePCMToAudioBuffer(
        uint8Array,
        audioContextRef.current,
        16000,  // 阿里云 TTS 默认采样率
        1       // 单声道
      );

      // 确保 AudioContext 处于运行状态
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      audioQueueRef.current.push(audioBuffer);

      if (!state.isSpeaking) {
        playAudioQueue();
      }
    } catch (error) {
      console.error('[useVoiceSession] Failed to decode audio:', error);
    }
  },
  [state.isSpeaking, playAudioQueue],
);
```

**QA 验证**：
- 使用正确的解码函数 `decodePCMToAudioBuffer`
- 采样率参数 16000 匹配阿里云 TTS 配置
- 添加空数据检查
- 添加 AudioContext 状态检查（确保未暂停）
- 添加 try-catch 错误处理
- 更新依赖数组包含 `playAudioQueue`
- 保留原有队列播放逻辑

---

### 任务 3：（可选）添加语音播放状态指示

**文件**：`components/voice/VoiceClient.tsx`

**目的**：让用户知道系统正在播放语音回答

**检查当前组件**：确认是否有 `isSpeaking` 状态显示

**如果缺失，添加以下元素**：

```tsx
// 在语音对话界面中添加播放状态指示
{isSpeaking && (
  <div className="flex items-center gap-2 text-blue-600">
    <div className="flex gap-1">
      <span className="w-1 h-4 bg-blue-600 rounded animate-pulse" style={{ animationDelay: '0ms' }}></span>
      <span className="w-1 h-4 bg-blue-600 rounded animate-pulse" style={{ animationDelay: '150ms' }}></span>
      <span className="w-1 h-4 bg-blue-600 rounded animate-pulse" style={{ animationDelay: '300ms' }}></span>
    </div>
    <span className="text-sm">正在播放...</span>
  </div>
)}
```

**QA 验证**：
- 动画效果正常显示
- 状态与 `isSpeaking` 同步
- 不影响其他 UI 元素

---

### 任务 4：环境配置检查

**确认以下环境变量已配置**：

```bash
# .env.local 文件
ALIYUN_ACCESS_KEY_ID=your_key_id
ALIYUN_ACCESS_KEY_SECRET=your_key_secret
ALIYUN_TTS_APP_KEY=your_app_key
```

**检查位置**：
- `server/voice/services/AliyunTTS.ts` 使用这些配置
- `server/voice/services/AliyunTokenManager.ts` 管理 Token

**QA 验证**：
- 所有阿里云语音服务环境变量已设置
- Token 能正常获取

---

## 验证步骤

### 步骤 1：编译检查
```bash
npm run build
```
- 无 TypeScript 错误
- 无构建错误

### 步骤 2：功能测试
1. 启动开发服务器：`npm run dev`
2. 访问语音报案页面
3. 点击"开始语音对话"
4. 说出测试内容（如"我要报案"）
5. **验证**：能听到 AI 的语音回答，不只是看到文字

### 步骤 3：测试场景
| 场景 | 预期结果 |
|------|----------|
| 用户说"你好" | 听到 AI 问候语音 |
| 用户说"我要报案" | 听到 AI 询问保单号码的语音 |
| 打断播放（抢话） | 语音停止，开始收听用户 |
| 网络异常 | 优雅降级，显示错误信息 |

---

## 技术细节

### PCM 音频格式
- **采样率**：16000 Hz（阿里云 TTS 默认）
- **位深度**：16-bit
- **声道数**：单声道（Mono）
- **字节序**：小端序（Little Endian）

### 解码原理
1. 将 base64 字符串转换为 ArrayBuffer
2. 使用 DataView 读取 16-bit 整数
3. 除以 32768（2^15）转换为 -1.0 ~ 1.0 浮点数
4. 填充到 AudioBuffer

### 与 SmartClaim AI 的对比
SmartClaim AI 使用 Gemini Live API（`connectLive`），它直接返回音频流，不需要手动 PCM 解码。

语音报案功能使用独立的阿里云 TTS 服务，需要手动处理 PCM 解码。

---

## 回滚计划

如果修改导致问题：

1. 恢复 `hooks/useVoiceSession.ts` 到修改前版本
2. 重新部署
3. 通知用户语音功能暂时不可用（文字回答仍可用）

---

## 相关文件参考

| 文件 | 说明 |
|------|------|
| `smartclaim-ai-agent/App.tsx:73-90` | 正确的 PCM 解码参考实现 |
| `server/voice/services/AliyunTTS.ts` | 阿里云 TTS 服务配置 |
| `server/voice/VoiceSession.ts:310-331` | 后端发送响应和音频 |
| `types/voice.ts` | 语音消息类型定义 |

---

## 预计工作量

| 任务 | 预计时间 |
|------|----------|
| 添加 PCM 解码函数 | 10 分钟 |
| 修复音频处理逻辑 | 10 分钟 |
| 添加播放状态指示 | 15 分钟 |
| 测试验证 | 15 分钟 |
| **总计** | **约 50 分钟** |

---

## 审查报告摘要

**审查时间**: 2026-03-06  
**审查结果**: ✅ 计划已根据审查建议更新

### 发现的主要问题及修复

| 问题 | 严重度 | 修复状态 |
|------|--------|----------|
| 参数类型与参考实现不一致（ArrayBuffer vs Uint8Array） | 高 | ✅ 已修复 |
| 缺少空数据检查 | 中 | ✅ 已修复 |
| 缺少 AudioContext 状态检查 | 中 | ✅ 已修复 |
| 依赖数组缺少 `playAudioQueue` | 低 | ✅ 已修复 |

### 技术决策说明

**为什么选择 Uint8Array 而非 ArrayBuffer？**
- 保持与 `smartclaim-ai-agent/App.tsx` 的参考实现一致
- 使用 `Int16Array` 直接处理更符合 PCM 数据特性
- 减少 `DataView` 的开销

**为什么需要 AudioContext 状态检查？**
- 浏览器策略可能自动暂停 AudioContext（如页面失去焦点）
- 调用 `resume()` 确保音频上下文处于运行状态

---

**计划生成时间**: 2026-03-06  
**优先级**: 高  
**状态**: 已审查，准备执行
