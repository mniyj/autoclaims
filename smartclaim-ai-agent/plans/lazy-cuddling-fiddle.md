# 实时语音对话重构方案

## Context

用户反馈：`smartclaim-ai-agent` 的实时语音对话"一直出问题"。近期已陆续修复若干局部 bug（Aliyun NLS 的 `TaskFailed` Promise 悬挂、TTS 之前启动 NLS 导致 IDLE_TIMEOUT、`pauseVoiceInputRef` 卡住、浏览器中继在中国网络下不可用、NLS 双初始化竞争导致 NLS-A 的 `TaskFailed` 反过来把 NLS-B 关掉等），但每次都是头痛医头。根本原因是**轮次状态（turn state）是隐式的**，且 **NLS 连接每次静音都推倒重建**——协议层没给"现在轮到谁说话"一个权威表达，8 个散落的布尔/计数器（`isSpeaking`、`isNLSStreamInitialized`、`nlsStreamGeneration`、`nlsWasEverInitialized`、`cancelled`、`audioBuffer`、`silenceTimer`、`ongoingOperation`）+ 客户端 20 多个 voice ref 互相依赖、时序不稳。

目标：把"轮次状态机 + 持久 NLS + AudioWorklet + 主动 barge-in"四件事一次落齐，得到一套**可以真正对话**的实时语音系统。意图识别层（`IntentRecognizer`/`IntentHandlerRegistry`/`VoiceSessionContext`/`VoiceReplyBuilder`/`tools/*`）工作良好，不动。

## 目标架构

### 轮次状态机（Turn State Machine）

一套命名、在客户端与服务端**共享同一定义**的状态：

```
IDLE → LISTENING → THINKING → SPEAKING → LISTENING
                       ↑                    ↓ (barge_in)
                       └────── LISTENING ───┘
```

- **IDLE** — 会话刚创建或已结束
- **LISTENING** — NLS 已就绪，麦克风工作，VAD 运行
- **THINKING** — 终稿转录已到，意图管线在跑，麦克风暂停
- **SPEAKING** — TTS 在合成/播放，VAD 仅用于识别 barge-in

**权威方在服务端。** 客户端镜像状态。所有转换由服务端通过 `event: turn_state` 广播；客户端只通过两条消息 *反向* 通知服务端：`playback_ended` 与 `barge_in`。

每个 turn 带唯一 `turnId`。客户端收到 `audio` 帧时先校验 `turnId` 是否等于当前 SPEAKING 轮次，不符则丢弃——这直接替代当前 `nlsStreamGeneration` 的作用，作为协议级不变量。

### WebSocket 协议变化

**新增（服务端→客户端）：**
- `event: turn_state` — `{ state, turnId, reason? }` — 每次转换必发
- `event: speech_start` / `speech_end` — 服务端 TTS 流开始/结束（非客户端播放结束）
- `event: nls_reconnecting` / `nls_ready` — 暴露 NLS 重连状态

**新增（客户端→服务端）：**
- `control: playback_ended` — `{ turnId }` — 客户端音频**真实播放完成**
- `control: barge_in` — `{ turnId }` — 客户端 VAD 在 SPEAKING 中检测到用户声音
- `control: client_vad` — `{ state: "speech"|"silence", turnId }` — 用于自适应调整端点检测

**保留：** `audio`（双向）、`text`、`control: start/stop/pause/resume`、`event: session_started/session_ended/error/tool_call_start/tool_call_end/thinking`

**移除：** `event: barge_in_acknowledged`（由 `turn_state → LISTENING, reason: barge_in` 替代）、客户端"从消息到达推断轮次"的所有隐式逻辑。

### 服务端模块重组

**新建（`server/voice/` 下）：**
- `turn/TurnStateMachine.ts` — 纯状态机：枚举、转移表、事件发射，无 I/O，拒绝非法转移
- `turn/TurnCoordinator.ts` — 粘合层：拥有 `turnId` 生成；替代 `VoiceSession` 里散落的 `isSpeaking` / `isNLSStreamInitialized` / `nlsWasEverInitialized` / `nlsStreamGeneration` 等逻辑
- `turn/UtteranceSegmenter.ts` — 决定"一句话说完了"：`SentenceEnd` 为主、`client_vad` 静音 ≥700ms 为辅
- `audio/NLSStreamManager.ts` — 持久 NLS 流的生命周期（连接、静默保活、有界缓冲、指数退避、跨 utterance 复用）
- `audio/TTSStreamController.ts` — 每轮一次 TTS 合成，支持 `AbortSignal` + 60s 超时

**改造：**
- `VoiceSession.ts` — 瘦身到 ~200 行，只负责 WebSocket 入站路由、把事件分发给 TurnCoordinator，并在 THINKING 态调用既有意图管线
- `VoicePipeline.ts` — NLS/TTS 相关逻辑迁出，保留 `getServiceStatus()`；若进一步无用可删除

**保留不动：** `intents/*`、`state/VoiceSessionContext.ts`、`responders/voiceReplyBuilder.ts`、`tools/*`、`services/AliyunNLS.ts`（其内部 Promise 处理已在此前修复到位）、`services/AliyunTTS.ts`、`services/AliyunTokenManager.ts`

### 客户端 VoiceController（一次替换）

**新建：** `/hooks/useVoiceController.ts`（与现有 `/hooks/useVoiceSession.ts` 并列；admin 端的 `components/voice/VoiceClient.tsx` 先继续用旧 hook，smartclaim 先用新 hook；稳定后统一）

内部结构：
- `turnState` + `turnId`：单一事实源，镜像自服务端 `turn_state` 事件
- `WebSocketTransport`：封装连接、重连、心跳
- `MicCapture`：阶段 1 先保留 `ScriptProcessorNode`；阶段 3 切 AudioWorklet（接口不变）
- `TTSPlayer`：当前 `voicePlaybackChainRef` 的 Promise 链抽离成独立模块，暴露确定性的 `onEnded` 事件，触发 `playback_ended` 发送
- `VADDetector`（阶段 3 引入）
- 单一 reducer：事件 `WS_CONNECTED | TURN_STATE | TTS_CHUNK | PLAYBACK_ENDED | VAD_SPEECH | WS_DISCONNECTED`

**替换的 ref（阶段 4 清理后全部消失）：** `pauseVoiceInputRef`、`voicePlaybackChainRef`、`voicePlaybackPendingChunksRef`、`shouldResumeVoiceRecognitionRef`、`voiceGreetingShownRef`、`isVoiceModeRef`、`browserVoiceRelayRef`、`voiceNetworkRetryCountRef`、`audioProcessCountRef`、`voiceTtsFallbackTimerRef` — 全部变成 controller 内部状态或衍生值。

**`setVoiceStatusText` 只剩一个调用点：** 一个 `useEffect(() => mapTurnStateToText(turnState))`。

### NLS 持久化策略

**单会话一条长期 NLS 流 + 静默帧保活。**

- 会话启动（问候语播完后）开 NLS，不再随每次 utterance 关闭重建
- **保活：** LISTENING 中若客户端 200ms 内没发真实音频，服务端自己补一帧 200ms 静音 PCM（3200 samples @ 16kHz）→ Aliyun IDLE_TIMEOUT ~10s，50× 余量
- **utterance 边界：** Aliyun `SentenceEnd` 主信号；若 speech 之后 2s 内没拿到 `SentenceEnd`，再用 `client_vad` 静音 700ms 作为兜底
- **utterance 之间：** NLS 不关，`SpeechTranscriber` 协议上天然接受连续多句
- **SPEAKING 期间：** 不转发麦克风音频给 NLS（省带宽 + 避免回声），但保活帧继续发。切回 LISTENING 时无需 re-init
- **何时重连 NLS：** 仅在 (a) WebSocket 硬断 (b) `TaskFailed` (c) 客户端持续发非静音音频但 30s 无 STT 事件。三种情况之一发生时指数退避：1s, 2s, 4s, 8s, 16s, 30s（上限），任何一次成功 STT 事件立刻重置退避

直接删除 `VoiceSession.handleSilenceDetected()` 的整个 100ms re-init 流程。

### 主动 barge-in

**客户端：**
- `VADDetector` 全程运行（阶段 3 才引入；阶段 1 先只支持 UI 按钮触发）
- LISTENING 期间：VAD 结果作为 `client_vad` 提示发给服务端（供 `UtteranceSegmenter` 参考）
- SPEAKING 期间：VAD 连续判定 "speech" ≥ 300ms → 发一次 `control: barge_in { turnId }`，同时客户端**乐观**立即停播 + 清 TTS 队列 + 把本地 `turnState` 切到 LISTENING；等服务端 `turn_state` 确认

**服务端收到 `barge_in`：**
1. 校验 `turnId` 匹配当前 SPEAKING；不匹配直接忽略（过期）
2. `TTSStreamController.abort()` — 取消 Aliyun TTS WebSocket，停止向客户端转发剩余 chunk
3. `ongoingOperation.abort()`（若 THINKING → SPEAKING 途中还在生成回复）
4. `TurnStateMachine.dispatch("BARGE_IN")` → LISTENING
5. `sendEvent("turn_state", { state: "LISTENING", turnId, reason: "barge_in" })`
6. NLS 流不动

**切断边界：** 正在合成/排队的 TTS chunk → 丢；正在跑的意图 handler → abort；若已产出回复文本 → 丢弃，不做历史写入；会话上下文、NLS 流保留。

### 失败与边界处理

- **NLS 重连退避：** 1s / 2s / 4s / 8s / 16s / 30s cap；5 次连败 → `event: error` 给客户端（"语音识别暂不可用，请刷新"）
- **audioBuffer 有界：** 5 秒环形 buffer（@ 16kHz × 2B = 160 000 bytes），溢出丢最旧 + `warn` 日志
- **TTS 60s 超时：** `Promise.race`，超时 → 取消 + `error` 事件 + 切回 LISTENING
- **客户端 WebSocket 重连：** 1s / 2s / 4s cap 10s，5 次上限；重连时发 `control: resume { lastTurnId }`，服务端决定续跑还是 `session_expired`。重连期 UI 显示"连接中断，正在重连..."

## 分阶段落地

用户已选择"全部 1–4"，顺序如下。每一阶段独立可验证；未完成下一阶段前保持可回滚。

### 阶段 1 — 轮次协议 + 服务端重组

**目标：** 彻底消灭"问候语后无转录"和"麦克风卡死"两类 bug。协议层先把 turn_state 立起来。

**修改文件：**
- `/types/voice.ts` — 增 `turn_state`、`playback_ended`、`speech_start/end`、`nls_reconnecting/ready`、`barge_in`、`client_vad`，所有相关 payload 增 `turnId`
- `/server/voice/VoiceSession.ts` — 去掉 `isSpeaking` / `isNLSStreamInitialized` / `nlsStreamGeneration` / `nlsWasEverInitialized` / `silenceTimer` / `audioBuffer`，委托给 TurnCoordinator 与 NLSStreamManager
- `/server/voice/VoicePipeline.ts` — 拆薄；NLS/TTS 逻辑迁出
- `/smartclaim-ai-agent/App.tsx` — 接入 `useVoiceController`；新协议事件处理；删除浏览器中继死代码

**新建文件：**
- `/server/voice/turn/TurnStateMachine.ts`
- `/server/voice/turn/TurnCoordinator.ts`
- `/server/voice/audio/NLSStreamManager.ts`（阶段 1 版本：每 utterance 内复用但未接保活，暂保留旧的 re-init-on-error 作安全网）
- `/server/voice/audio/TTSStreamController.ts`（带 abort + 60s 超时）
- `/hooks/useVoiceController.ts`
- `/smartclaim-ai-agent/voice/ttsPlayer.ts`（抽离播放链，暴露确定性 `onEnded`）

**验收（手动）：**
1. 开语音。问候语播完后 500ms 内，客户端+服务端 console 同时出现 `turn_state: LISTENING`；UI 状态条显示"正在聆听..."
2. 说"查询进度"。服务端日志依次出现 `turn.transition ... THINKING → SPEAKING`，播放结束客户端发 `playback_ended`，服务端转回 LISTENING
3. 连续 10 轮。任何一轮 turn state 都不会卡死；无 "stuck mic" 现象
4. 重现此前"问候语后无转录"场景。**不再复现。**

### 阶段 2 — 持久 NLS + 保活

**目标：** 消灭 Aliyun IDLE_TIMEOUT 引发的反复 re-init 竞争。

**修改文件：**
- `/server/voice/audio/NLSStreamManager.ts` — 加静默帧保活 timer；废弃每 utterance 关流；以 `SentenceEnd` 为主边界
- `/server/voice/services/AliyunNLS.ts` — 无改动（验证其 `sendAudio` 接受零帧 PCM，当前实现直接 `ws.send(buffer)` 已满足）

**新建文件：**
- `/server/voice/turn/UtteranceSegmenter.ts`

**验收：**
1. 开语音、静默 60 秒。服务端日志无任何 `nls.lifecycle event=reconnect_attempt`；仅一条 `connect` + 一条 `ready`
2. 日志定期出现 `[NLSStreamManager] keepalive tick`（采样后每秒约 1 条）
3. 连续 5 句，每句间隔 2s。每个 `SentenceEnd` 推进到 THINKING；两句之间无 NLS re-init
4. 端到端"说完→THINKING"延迟 < 400ms（目前约 800ms）

### 阶段 3 — AudioWorklet + 客户端 VAD + 自动 barge-in

**目标：** 从"半双工机器人"升到"真人对话体验"。

**修改文件：**
- `/smartclaim-ai-agent/App.tsx` — 无代码级改动，只切换 controller 配置到 worklet backend
- `/hooks/useVoiceController.ts` — `MicCapture` 切换实现；加 `VADDetector` 管线

**新建文件：**
- `/smartclaim-ai-agent/public/voice/audio-capture-worklet.js` — PCM16 下采样 + 环形 buffer，postMessage 每 40ms 一帧
- `/smartclaim-ai-agent/voice/micCapture.ts` — AudioWorklet 封装，对外接口与当前 ScriptProcessor 方案同
- `/smartclaim-ai-agent/voice/vadDetector.ts` — RMS 基线；阈值 0.015；hangover 250ms（后续可换 WebRTC-VAD）

**验收：**
1. Chrome DevTools Performance：语音期间主线程无 `onaudioprocess` 回调；worker 线程可见 `audio-capture-worklet.js` 活动
2. 长问候语中打断测试：TTS 播到 2s 时用户说话 → 400ms 内 TTS 停、服务端出现 `barge_in` + `turn_state: LISTENING, reason: barge_in`，麦克风切回 hot
3. 误触测试：扬声器外放 TTS（非耳机）期间保持 LISTENING 无人说话。记录 `vad.speech` 误报次数；目标 < 5 次/分钟，不达标则调阈值

### 阶段 4 — 清理

**目标：** 移除过渡期的遗留 ref / 死代码，架构收口。

**修改文件：**
- `/smartclaim-ai-agent/App.tsx` — 删除所有已迁移的 voice ref；删除浏览器中继残留；清理过时中文注释
- `/server/voice/VoiceSession.ts` — 清除过渡期兼容代码
- `/server/voice/VoicePipeline.ts` — 若完全无用则删除
- `/server/voice/services/AliyunNLS.ts` — 收紧日志（取消逐帧字节数打印；加 `taskId` tag）

**验收：**
1. `grep -n "Ref" smartclaim-ai-agent/App.tsx` 结果中不再有 `pauseVoiceInput*` / `voicePlayback*` / `shouldResumeVoice*` / `browserVoiceRelay*` / `voiceNetworkRetry*` / `audioProcessCount*` / `voiceTtsFallback*`
2. 阶段 1–3 所有验收场景仍通过
3. 20 分钟 soak 测试（50+ 轮对话）：零 stuck state；`performance.memory` 与服务端堆内存平稳

## 关键复用资产

- `server/voice/services/AliyunNLS.ts` — Promise 处理已修，内部协议解析稳定，**不动**
- `server/voice/services/AliyunTTS.ts`、`AliyunTokenManager.ts` — 稳定，**不动**
- `server/voice/intents/*`、`state/VoiceSessionContext.ts`、`responders/voiceReplyBuilder.ts`、`tools/*` — 全部保留
- 现有播放链（`voicePlaybackChainRef` 的 Promise 串行化思路） — 逻辑正确，阶段 1 抽到 `ttsPlayer.ts` 里保留
- 现有 Chrome 自动播放策略变通（"AudioContext created after async await may start suspended" → 显式 `resume()`） — 阶段 1 `MicCapture` / `TTSPlayer` 各自保留这一步
- 现有"`window.speechSynthesis.speaking` 直接检查而非依赖 `utterance.onend`"的变通 — 在阶段 4 清理时由服务端 `turn_state` 接管，届时可一并删除

## 观测 / 日志规范

所有日志打成 JSON 行，带 `sessionId` + `turnId`：
- `turn.transition { from, to, reason, latencyMs }`
- `nls.lifecycle { event: connect|ready|error|reconnect_attempt|closed, attempt?, errorCode? }`
- `nls.keepalive.tick`（1/100 采样）
- `tts.synth { turnId, textLen, durationMs, chunkCount, aborted }`
- `vad.barge_in { turnId, latencyFromTTSStartMs, rms }`
- `ws.reconnect { attempt, backoffMs }`
- `intent.handled { intentType, latencyMs, success }` — 已部分存在，统一字段名

## 关键文件一览（绝对路径）

**修改：**
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/server/voice/VoiceSession.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/server/voice/VoicePipeline.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/types/voice.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/smartclaim-ai-agent/App.tsx`

**新建：**
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/server/voice/turn/TurnStateMachine.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/server/voice/turn/TurnCoordinator.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/server/voice/turn/UtteranceSegmenter.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/server/voice/audio/NLSStreamManager.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/server/voice/audio/TTSStreamController.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/hooks/useVoiceController.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/smartclaim-ai-agent/voice/ttsPlayer.ts`
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/smartclaim-ai-agent/voice/micCapture.ts`（阶段 3）
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/smartclaim-ai-agent/voice/vadDetector.ts`（阶段 3）
- `/Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔/smartclaim-ai-agent/public/voice/audio-capture-worklet.js`（阶段 3）

## 执行流程

每阶段完成后：
1. `cd /Users/pegasus/Documents/trae_projects/保险产品配置页面-理赔 && npm run build:server`
2. `node --watch` 自动重启 voice 服务
3. 对照对应阶段"验收"项逐条复测
4. 发现问题先修同阶段，不提前动下阶段
5. 阶段全部过后再进入下一阶段

单 PR 粒度：每个阶段一个 PR；阶段 1 预计 ~800 行改动；阶段 2 ~300 行；阶段 3 ~500 行；阶段 4 ~400 行删除为主。

## 待决问题

- `hooks/` 在项目根；smartclaim-ai-agent 内目前没有 `hooks/` 目录。新 `useVoiceController` 放根 `/hooks/` 对齐既有约定；若 smartclaim 希望自己独立一套，可后续拆分。
- 阶段 1 完成后，admin 侧 `components/voice/VoiceClient.tsx` 仍会用旧 `useVoiceSession.ts`。是否同时迁移 admin 侧到新协议，留待阶段 1 结束再决定（本方案不纳入）。
- 客户端 VAD 选型：阶段 3 先用 RMS，阈值 0.015。若误触过高，备选 `@ricky0123/vad-web`（基于 Silero，体积约 1MB）。
