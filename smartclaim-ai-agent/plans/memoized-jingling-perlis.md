# 语音管家界面重设计 + 功能修复

## Context

用户反映两个问题：
1. 语音管家弹出的界面背景是白色，没有设计感
2. 系统念完"您好，我是智能理赔助手"后没动静——TTS 结束后麦克风状态不明确，且输入 AudioContext 可能被暂停

## 关键文件

- `smartclaim-ai-agent/App.tsx` — 唯一需要修改的文件

  | 位置 | 内容 |
  |------|------|
  | 第 3704-3762 行 | `playServerVoiceAudio` — TTS 播放 + finally 回调 |
  | 第 7584-7610 行 | 语音模式 UI overlay |

---

## 修改 1：功能修复 — TTS 结束后恢复聆听状态

**问题根因**：`playServerVoiceAudio` 的 `.finally()` 回调中：
1. 只设了 `pauseVoiceInputRef.current = false`，但**没有 resume 输入 AudioContext**。TTS 播放期间输入 AudioContext 可能被浏览器挂起，导致 `onaudioprocess` 停止触发，麦克风采集中断。
2. 状态文字变为 `"请直接描述您的事故情况"`，而非 `"正在聆听..."`，用户不清楚麦克风是否激活。

**修改位置**：第 3757-3759 行 `finally` 块

```diff
- if (voicePlaybackPendingChunksRef.current === 0) {
-   pauseVoiceInputRef.current = false;
-   setVoiceStatusText("请直接描述您的事故情况");
- }
+ if (voicePlaybackPendingChunksRef.current === 0) {
+   pauseVoiceInputRef.current = false;
+   voiceAudioContextRef.current?.resume().catch(() => null);
+   setVoiceStatusText("正在聆听...");
+ }
```

---

## 修改 2：UI 重设计 — 科技蓝渐变语音界面

**目标风格**：深色沉浸式，蓝紫渐变背景，多层光圈脉冲，白色文字

**修改位置**：第 7584-7610 行整个 `{isVoiceMode && (...)}` 块

### 新 UI 结构

```
背景：bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950
│
├── 顶部：频道徽章（颜色适配深色）
│
├── 中心：三层光圈 + 麦克风圆形
│   ├── 外圈：animate-ping，慢速，大 opacity 低
│   ├── 中圈：animate-ping，延迟，中等 opacity
│   └── 内核：蓝紫渐变圆，麦克风图标
│
├── 状态文字（白色）：voiceStatusText / "正在处理..."
├── 识别文字（蓝色浅色）：voiceTranscript
│
└── 底部：声波动画条（5根柱子，动态高度）+ 挂断按钮
```

### 声波动画

在 5 个竖柱上通过 CSS animate-bounce 错开延迟模拟声波：
- 聆听中：柱子高度变化（animate-bounce with different delays）
- 播报中 / 处理中：柱子变为静止低柱

### 徽章颜色适配

原有 `getVoiceOutputBadge` 返回的浅色 className 在深色背景下不可读，需要把 badge 换成深色背景友好的版本：
- 阿里云：`bg-blue-500/20 text-blue-300 border border-blue-500/30`
- 浏览器：`bg-amber-500/20 text-amber-300 border border-amber-500/30`
- 降级：`bg-rose-500/20 text-rose-300 border border-rose-500/30`
- 连接中：`bg-slate-500/20 text-slate-300 border border-slate-500/30`

---

## 验证方式

1. 打开 http://localhost:8081，登录后点击"语音管家"按钮
2. **UI 验证**：界面背景应为深色蓝紫渐变，麦克风圆心周围有多层光圈脉冲，底部有声波柱动画
3. **功能验证**：系统念完欢迎词后，状态文字变为"正在聆听..."（不再是"请直接描述您的事故情况"），此时对麦克风说话，系统应能识别并回复
