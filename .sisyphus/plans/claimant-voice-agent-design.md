# 索赔人端实时语音对话智能体系统设计方案

## 1. 系统概述

### 1.1 设计目标
构建面向索赔人的**双向实时流式语音对话系统**，支持H5 Web端，通过自然语言交互完成报案、查询进度、材料补充和理赔咨询等全流程服务。

### 1.2 技术路线（已确定）
| 组件 | 技术选型 | 理由 |
|------|----------|------|
| 音频传输 | WebSocket + Web Audio API | H5浏览器兼容性好 |
| STT | 阿里云NLS实时语音识别 | 中文优化，保险专业词汇支持 |
| LLM | Google Gemini 2.5 Flash | 与现有系统一致，工具调用能力强 |
| TTS | 阿里云语音合成 | 中文自然，流式输出 |
| VAD | 阿里云NLS内置 + 前端辅助 | 高准确率，低延迟 |

### 1.3 架构概览

```
┌──────────────────────────────────────────────────────────────────────┐
│                           H5 浏览器                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────────┐ │
│  │  音频采集      │  │  VAD检测      │  │    UI界面               │ │
│  │  Web Audio    │  │  (Web Audio)  │  │  - 语音按钮              │ │
│  │               │  │               │  │  - 对话展示              │ │
│  └───────┬───────┘  └───────┬───────┘  │  - 保单卡片              │ │
│          │                  │          └──────────────────────────┘ │
│          └──────────────────┘                    │                   │
│                         │                        │                   │
│                    ┌────┴────────────────────────┴────┐              │
│                    │      WebSocket Client             │              │
│                    └──────────────┬────────────────────┘              │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │ WebSocket (WSS)
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Express.js WebSocket Server                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Voice Session Manager                      │   │
│  │  - 连接管理  - 会话状态  - 心跳保活  - 错误恢复              │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                              │                                       │
│  ┌───────────────────────────┴──────────────────────────────────┐   │
│  │                 Voice Pipeline Orchestrator                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │   NLS STT    │  │   Gemini     │  │   Aliyun TTS │       │   │
│  │  │  (流式识别)  │  │   LLM推理    │  │  (流式合成)  │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                              │                                       │
│  ┌───────────────────────────┴──────────────────────────────────┐   │
│  │                    Tool Execution Layer                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │ 查询保单     │  │ 提交报案     │  │ 查询进度     │       │   │
│  │  │ checkPolicy  │  │ submitClaim  │  │ getProgress  │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Existing Backend Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Claims API │  │   Policy API │  │  LangGraph   │              │
│  │   (api.ts)   │  │   (api.ts)   │  │   Agent      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心交互流程设计

### 2.1 报案场景完整对话流程

```
[用户点击"开始语音对话"]
       │
       ▼
[AI] "您好，我是智能理赔助手。请问有什么可以帮您？"
       │
       ▼
[用户] "我要报案"
       │
       ▼
[AI] "好的，我来帮您报案。首先请确认您的身份。
      请告诉我您的姓名和保单号码。"
       │
       ▼
[用户] "我叫张三，保单号是 ZA123456"
       │
       ▼
[AI 调用 checkPolicyTool] → 查询保单信息
       │
       ▼
[AI] "确认身份：张三先生，众安百万医疗险（保单号 ZA123456）。
      请问事故发生时间是什么时候？"
       │
       ▼
[用户] "昨天，3月3号"
       │
       ▼
[AI] "好的，2024年3月3日。请问是什么类型的事故？"
       │
       ▼
[用户] "我住院做了手术，急性阑尾炎"
       │
       ▼
[AI] "明白了，您因急性阑尾炎住院手术。
      请问在哪家医院？"
       │
       ▼
[用户] "北京协和医院"
       │
       ▼
[AI 计算材料清单] → 根据保单类型和事故类型
       │
       ▼
[AI] "好的，已记录北京协和医院。
      
      我为您总结一下报案信息：
      - 被保险人：张三
      - 保单号：ZA123456
      - 事故时间：2024年3月3日
      - 事故类型：急性阑尾炎住院手术
      - 就诊医院：北京协和医院
      
      确认无误吗？"
       │
       ▼
[用户] "对的"
       │
       ▼
[AI 调用 submitClaimTool] → 创建理赔案件
       │
       ▼
[AI] "报案成功！您的报案号是 CLM202403030001。
      
      根据您的保单，需要准备以下材料：
      1. 被保险人身份证正反面
      2. 医疗发票原件
      3. 出院小结或诊断证明
      4. 费用明细清单
      
      材料清单已发送到您的微信，您可以在小程序中上传。
      预计审核时间为3个工作日。还有什么可以帮您？"
```

### 2.2 查进度场景对话流程

```
[用户] "查一下我的理赔进度"
       │
       ▼
[AI] "好的，我来帮您查询。请提供报案号或保单号。"
       │
       ▼
[用户] "保单号是 ZA123456"
       │
       ▼
[AI 调用 getClaimProgressTool] → 查询案件列表
       │
       ▼
[AI] "查到您名下有2个理赔案件：
      
      案件1：报案号 CLM202403030001
      - 状态：审核中
      - 事故类型：急性阑尾炎
      - 提交时间：2024年3月3日
      - 预计完成：3月6日
      
      案件2：报案号 CLM202401150001
      - 状态：已结案-给付
      - 事故类型：门诊医疗
      - 赔付金额：¥2,580
      - 到账时间：2024年1月20日
      
      需要查看哪个案件的详细信息？"
```

### 2.3 打断处理机制

```
[AI 正在说话] "根据您的保单条款，医疗险理赔需要..."
       │
       ▼ (用户打断)
[用户] "等一下"
       │
       ▼ (前端VAD检测到语音)
[前端] 发送 "barge-in" 信令
       │
       ▼
[后端] 1. 停止TTS合成
       2. 缓存未说完的内容
       3. 发送确认响应
       │
       ▼
[AI] "好的，您请说。"
       │
       ▼
[用户] "我说的是急诊，不是住院"
       │
       ▼
[AI] "明白了，您是在急诊就诊，不是住院。
      那需要补充的信息是..."
       │
       ▼
[AI 继续之前的流程或调整后的流程]
```

---

## 3. 系统模块设计

### 3.1 模块划分

| 模块 | 职责 | 技术栈 |
|------|------|--------|
| **voice-client** | H5前端音频采集、WebSocket连接、UI渲染 | React + Web Audio API |
| **voice-gateway** | WebSocket服务、会话管理、协议转换 | Express + ws |
| **voice-pipeline** | 音频流处理、STT/TTS调用、LLM编排 | Node.js + 阿里云SDK |
| **voice-tools** | 理赔相关工具函数 | TypeScript |
| **voice-session** | 会话状态管理、上下文持久化 | Redis + LangGraph |

### 3.2 关键数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                          音频数据流                                  │
└─────────────────────────────────────────────────────────────────────┘

用户语音输入:
  麦克风 → Web Audio API (PCM 16kHz) → VAD检测 → WebSocket → 
  → 阿里云NLS (流式识别) → 文本结果

AI语音输出:
  LLM生成文本 → 阿里云TTS (流式合成) → PCM音频 → WebSocket → 
  → Web Audio API播放

实时控制信令:
  barge-in (打断) / pause (暂停) / resume (恢复) / end (结束)
```

---

## 4. 详细技术规格

### 4.1 音频规格

```typescript
// 音频配置
interface AudioConfig {
  // 输入配置
  input: {
    sampleRate: 16000;        // 16kHz (NLS推荐)
    channelCount: 1;          // 单声道
    sampleSize: 16;           // 16bit
    bufferSize: 4096;         // 缓冲区大小
  };
  
  // 输出配置
  output: {
    sampleRate: 16000;
    channelCount: 1;
    sampleSize: 16;
  };
  
  // VAD配置
  vad: {
    frameDuration: 30;        // 30ms每帧
    silenceThreshold: 500;    // 静默500ms判定为说完
    minSpeechDuration: 300;   // 最少300ms才认为是有效语音
  };
}
```

### 4.2 WebSocket协议设计

```typescript
// 消息类型定义
interface VoiceMessage {
  type: 'audio' | 'text' | 'control' | 'event';
  direction: 'client_to_server' | 'server_to_client';
  timestamp: number;
  payload: AudioPayload | TextPayload | ControlPayload | EventPayload;
}

// 音频消息 (双向)
interface AudioPayload {
  format: 'pcm' | 'opus';
  data: string;               // base64编码
  seq: number;                // 序列号，用于排序和丢包检测
  isFinal: boolean;           // 是否为最后一片
}

// 文本消息 (STT结果 / TTS文本)
interface TextPayload {
  source: 'stt' | 'llm' | 'system';
  content: string;
  isFinal: boolean;           // STT中间结果或最终结果
  confidence?: number;        // 置信度
}

// 控制消息
interface ControlPayload {
  action: 'start' | 'stop' | 'barge_in' | 'pause' | 'resume';
  metadata?: Record<string, any>;
}

// 事件消息
interface EventPayload {
  event: 'session_started' | 'session_ended' | 'error' | 
         'tool_call_start' | 'tool_call_end' | 'thinking';
  data: any;
}
```

### 4.3 API接口设计

```typescript
// ============ 前端 API ============

// 启动语音会话
POST /api/voice/session/start
Request: {
  userId: string;
  initialIntent?: 'report_claim' | 'check_progress' | 'general';
}
Response: {
  sessionId: string;
  wsUrl: string;              // wss://host/voice/ws/{sessionId}
  expiresAt: string;
}

// 结束语音会话
POST /api/voice/session/:sessionId/end
Response: {
  summary: VoiceSessionSummary;
  duration: number;
}

// 获取会话历史
GET /api/voice/session/:sessionId/history
Response: {
  messages: VoiceMessage[];
  toolsCalled: ToolCall[];
}

// ============ WebSocket 事件 ============

// 客户端发送
{
  type: 'audio',
  payload: { data: 'base64EncodedPcmAudio', seq: 1 }
}

{
  type: 'control',
  payload: { action: 'barge_in' }
}

// 服务端发送
{
  type: 'text',
  payload: { 
    source: 'stt', 
    content: '我要报案',
    isFinal: true,
    confidence: 0.95
  }
}

{
  type: 'text',
  payload: { 
    source: 'llm', 
    content: '好的，我来帮您报案。首先请确认您的身份...'
  }
}

{
  type: 'audio',
  payload: { data: 'base64EncodedTtsAudio', seq: 1 }
}

{
  type: 'event',
  payload: { 
    event: 'tool_call_start',
    data: { toolName: 'checkPolicy', params: { policyNumber: 'ZA123456' } }
  }
}
```

---

## 5. 核心组件实现

### 5.1 前端 VoiceClient 组件

```typescript
// components/voice/VoiceClient.tsx
interface VoiceClientProps {
  sessionId: string;
  wsUrl: string;
  onSessionEnd?: (summary: SessionSummary) => void;
}

export const VoiceClient: React.FC<VoiceClientProps> = ({
  sessionId,
  wsUrl,
  onSessionEnd
}) => {
  // 状态管理
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [transcript, setTranscript] = useState('');
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<VADProcessor | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  
  // 初始化连接
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);
  
  const connect = async () => {
    // 1. 初始化 AudioContext
    audioContextRef.current = new AudioContext({
      sampleRate: 16000
    });
    
    // 2. 获取麦克风权限
    mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });
    
    // 3. 初始化 VAD
    vadRef.current = new VADProcessor({
      onSpeechStart: handleSpeechStart,
      onSpeechEnd: handleSpeechEnd,
      silenceThreshold: 500
    });
    
    // 4. 连接 WebSocket
    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.binaryType = 'arraybuffer';
    
    wsRef.current.onopen = () => setIsConnected(true);
    wsRef.current.onmessage = handleServerMessage;
    wsRef.current.onerror = handleError;
    wsRef.current.onclose = () => setIsConnected(false);
    
    // 5. 开始音频处理
    startAudioProcessing();
  };
  
  const startAudioProcessing = () => {
    const ctx = audioContextRef.current!;
    const stream = mediaStreamRef.current!;
    
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (!isListening) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = floatTo16BitPCM(inputData);
      
      // VAD处理
      const vadResult = vadRef.current!.process(pcmData);
      
      // 发送音频数据
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          payload: {
            data: arrayBufferToBase64(pcmData),
            seq: Date.now(),
            isFinal: vadResult.isFinal
          }
        }));
      }
    };
    
    source.connect(processor);
    processor.connect(ctx.destination);
  };
  
  const handleServerMessage = (event: MessageEvent) => {
    const message: VoiceMessage = JSON.parse(event.data);
    
    switch (message.type) {
      case 'text':
        handleTextMessage(message.payload as TextPayload);
        break;
      case 'audio':
        handleAudioMessage(message.payload as AudioPayload);
        break;
      case 'event':
        handleEventMessage(message.payload as EventPayload);
        break;
    }
  };
  
  const handleTextMessage = (payload: TextPayload) => {
    if (payload.source === 'stt') {
      setTranscript(payload.content);
    } else if (payload.source === 'llm') {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: payload.content,
        timestamp: Date.now()
      }]);
    }
  };
  
  const handleAudioMessage = async (payload: AudioPayload) => {
    const ctx = audioContextRef.current!;
    const audioData = base64ToArrayBuffer(payload.data);
    const audioBuffer = await ctx.decodeAudioData(audioData);
    
    audioQueueRef.current.push(audioBuffer);
    
    if (!isSpeaking) {
      playAudioQueue();
    }
  };
  
  const playAudioQueue = async () => {
    setIsSpeaking(true);
    
    while (audioQueueRef.current.length > 0) {
      const buffer = audioQueueRef.current.shift()!;
      await playAudioBuffer(buffer);
    }
    
    setIsSpeaking(false);
  };
  
  // 打断处理
  const handleBargeIn = () => {
    // 1. 清空音频队列
    audioQueueRef.current = [];
    
    // 2. 停止当前播放
    setIsSpeaking(false);
    
    // 3. 发送打断信令
    wsRef.current?.send(JSON.stringify({
      type: 'control',
      payload: { action: 'barge_in' }
    }));
  };
  
  return (
    <div className="voice-client">
      <VoiceVisualizer isListening={isListening} isSpeaking={isSpeaking} />
      <TranscriptDisplay text={transcript} />
      <MessageList messages={messages} />
      <VoiceControls 
        isListening={isListening}
        onToggleListening={() => setIsListening(!isListening)}
        onBargeIn={handleBargeIn}
      />
    </div>
  );
};
```

### 5.2 后端 Voice Gateway

```typescript
// server/voice/VoiceGateway.ts
import { WebSocketServer, WebSocket } from 'ws';
import { VoicePipeline } from './VoicePipeline';
import { SessionManager } from './SessionManager';

export class VoiceGateway {
  private wss: WebSocketServer;
  private pipeline: VoicePipeline;
  private sessionManager: SessionManager;
  
  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/voice/ws'
    });
    
    this.pipeline = new VoicePipeline();
    this.sessionManager = new SessionManager();
    
    this.wss.on('connection', this.handleConnection);
  }
  
  private handleConnection = async (ws: WebSocket, req: Request) => {
    const sessionId = this.extractSessionId(req);
    
    // 验证会话
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      ws.close(4001, 'Invalid session');
      return;
    }
    
    // 创建语音会话处理器
    const voiceSession = new VoiceSession({
      sessionId,
      userId: session.userId,
      ws,
      pipeline: this.pipeline
    });
    
    // WebSocket事件处理
    ws.on('message', (data) => voiceSession.handleMessage(data));
    ws.on('close', () => voiceSession.cleanup());
    ws.on('error', (err) => voiceSession.handleError(err));
    
    // 发送会话开始事件
    voiceSession.sendEvent('session_started', {
      sessionId,
      welcomeMessage: '您好，我是智能理赔助手。请问有什么可以帮您？'
    });
    
    // 播放欢迎语
    await voiceSession.speak('您好，我是智能理赔助手。请问有什么可以帮您？');
  };
}

// VoiceSession 类
class VoiceSession {
  private sttStream: NLSSTTStream;
  private ttsQueue: TTSRequest[] = [];
  private isSpeaking = false;
  private conversationContext: ConversationContext;
  
  constructor(config: VoiceSessionConfig) {
    // 初始化NLS STT流
    this.sttStream = new NLSSTTStream({
      appKey: process.env.ALIYUN_NLS_APP_KEY,
      accessToken: process.env.ALIYUN_NLS_TOKEN,
      onResult: this.handleSTTResult,
      onError: this.handleSTTError
    });
    
    // 初始化对话上下文
    this.conversationContext = new ConversationContext({
      sessionId: config.sessionId,
      userId: config.userId,
      systemPrompt: this.buildSystemPrompt()
    });
  }
  
  async handleMessage(data: WebSocket.Data) {
    const message: VoiceMessage = JSON.parse(data.toString());
    
    switch (message.type) {
      case 'audio':
        await this.handleAudioMessage(message.payload);
        break;
      case 'control':
        await this.handleControlMessage(message.payload);
        break;
    }
  }
  
  private async handleAudioMessage(payload: AudioPayload) {
    // 将音频数据发送到NLS STT
    const audioBuffer = base64ToBuffer(payload.data);
    this.sttStream.write(audioBuffer);
  }
  
  private async handleSTTResult(result: STTResult) {
    if (!result.isFinal) {
      // 发送中间结果到前端（用于实时展示）
      this.sendText('stt', result.text, false, result.confidence);
      return;
    }
    
    // 最终结果
    this.sendText('stt', result.text, true, result.confidence);
    
    // 发送到LLM处理
    await this.processUserInput(result.text);
  }
  
  private async processUserInput(text: string) {
    // 1. 更新对话上下文
    this.conversationContext.addUserMessage(text);
    
    // 2. 调用Gemini进行理解和推理
    const response = await this.callGemini(this.conversationContext);
    
    // 3. 处理工具调用
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        this.sendEvent('tool_call_start', {
          toolName: toolCall.name,
          params: toolCall.arguments
        });
        
        const toolResult = await this.executeTool(toolCall);
        
        this.sendEvent('tool_call_end', {
          toolName: toolCall.name,
          result: toolResult
        });
        
        // 将工具结果添加到上下文
        this.conversationContext.addToolResult(toolCall.id, toolResult);
      }
      
      // 重新调用LLM获取最终回复
      const finalResponse = await this.callGemini(this.conversationContext);
      await this.handleLLMResponse(finalResponse);
    } else {
      await this.handleLLMResponse(response);
    }
  }
  
  private async handleLLMResponse(response: LLMResponse) {
    // 1. 更新对话上下文
    this.conversationContext.addAssistantMessage(response.text);
    
    // 2. 发送文本到前端
    this.sendText('llm', response.text);
    
    // 3. 转换为语音并播放
    await this.speak(response.text);
  }
  
  private async speak(text: string) {
    // 调用阿里云TTS
    const ttsStream = await aliYunTTS.synthesize({
      text,
      voice: 'xiaoyun',           // 中文女声
      format: 'pcm',
      sampleRate: 16000,
      onData: (audioChunk) => {
        // 流式发送音频到前端
        this.sendAudio(audioChunk);
      }
    });
    
    await ttsStream.complete;
  }
  
  private async handleControlMessage(payload: ControlPayload) {
    switch (payload.action) {
      case 'barge_in':
        // 处理打断
        await this.handleBargeIn();
        break;
      case 'stop':
        await this.cleanup();
        break;
    }
  }
  
  private async handleBargeIn() {
    // 1. 停止当前TTS合成
    this.ttsQueue = [];
    
    // 2. 发送打断确认
    this.sendEvent('barge_in_acknowledged', {});
    
    // 3. 继续监听用户输入
    this.sttStream.resume();
  }
  
  private async executeTool(toolCall: ToolCall): Promise<any> {
    switch (toolCall.name) {
      case 'checkPolicy':
        return await checkPolicyTool.invoke(toolCall.arguments);
      case 'submitClaim':
        return await submitClaimTool.invoke(toolCall.arguments);
      case 'getClaimProgress':
        return await getClaimProgressTool.invoke(toolCall.arguments);
      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }
  }
  
    // 发送方法
  private sendText(source: string, content: string, isFinal = true, confidence?: number) {
    this.send({
      type: 'text',
      payload: { source, content, isFinal, confidence }
    });
  }
  
  private sendAudio(data: Buffer) {
    this.send({
      type: 'audio',
      payload: {
        data: bufferToBase64(data),
        format: 'pcm'
      }
    });
  }
  
  private sendEvent(event: string, data: any) {
    this.send({
      type: 'event',
      payload: { event, data }
    });
  }
  
  private send(message: VoiceMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
```

---

## 6. 工具设计 (Voice-First Tools)

### 6.1 工具定义

```typescript
// server/voice/tools/index.ts
import { z } from 'zod';

// 查询保单工具
export const checkPolicyTool = {
  name: '查询保单',
  description: '根据保单号或身份证号查询保单信息',
  parameters: z.object({
    policyNumber: z.string().optional()
      .describe('保单号码，如ZA123456'),
    idNumber: z.string().optional()
      .describe('被保险人身份证号'),
    phone: z.string().optional()
      .describe('预留手机号')
  }),
  required: [],
  handler: async (params) => {
    // 调用现有API
    const policies = await api.policies.list();
    const matched = policies.find(p => 
      p.policyNumber === params.policyNumber ||
      p.policyholder?.idNumber === params.idNumber
    );
    
    if (!matched) {
      return {
        success: false,
        message: '未找到匹配的保单，请确认保单号或身份信息'
      };
    }
    
    return {
      success: true,
      data: {
        policyNumber: matched.policyNumber,
        productName: matched.productName,
        policyholderName: matched.policyholder?.name,
        insuredName: matched.insureds?.[0]?.name,
        effectiveDate: matched.effectiveDate,
        expiryDate: matched.expiryDate,
        status: matched.status
      }
    };
  }
};

// 提交报案工具
export const submitClaimTool = {
  name: '提交报案',
  description: '根据收集的信息创建理赔案件',
  parameters: z.object({
    policyNumber: z.string()
      .describe('保单号码'),
    reporter: z.string()
      .describe('报案人姓名'),
    accidentTime: z.string()
      .describe('事故发生时间，格式：YYYY-MM-DD'),
    accidentReason: z.string()
      .describe('事故原因描述'),
    accidentLocation: z.string().optional()
      .describe('事故发生地点'),
    claimAmount: z.number().optional()
      .describe('预估理赔金额'),
    incidentType: z.enum(['medical', 'accident', 'vehicle', 'property', 'death'])
      .describe('事故类型')
  }),
  required: ['policyNumber', 'reporter', 'accidentTime', 'accidentReason'],
  handler: async (params) => {
    // 生成报案号
    const reportNumber = generateReportNumber();
    
    // 创建案件
    const claimCase = await api.claimCases.add({
      reportNumber,
      reporter: params.reporter,
      reportTime: new Date().toISOString(),
      accidentTime: params.accidentTime,
      accidentReason: params.accidentReason,
      accidentLocation: params.accidentLocation,
      claimAmount: params.claimAmount || 0,
      productCode: params.policyNumber,
      status: ClaimStatus.REPORTED,
      operator: 'system'
    });
    
    // 计算所需材料
    const requiredMaterials = calculateRequiredMaterials({
      incidentType: params.incidentType,
      productCode: params.policyNumber
    });
    
    return {
      success: true,
      data: {
        claimId: claimCase.id,
        reportNumber,
        status: ClaimStatus.REPORTED,
        requiredMaterials,
        estimatedProcessTime: '3个工作日'
      }
    };
  }
};

// 查询进度工具
export const getClaimProgressTool = {
  name: '查询理赔进度',
  description: '查询理赔案件的处理进度',
  parameters: z.object({
    reportNumber: z.string().optional()
      .describe('报案号'),
    policyNumber: z.string().optional()
      .describe('保单号码'),
    phone: z.string().optional()
      .describe('预留手机号')
  }),
  required: [],
  handler: async (params) => {
    const claims = await api.claimCases.list();
    
    const matched = claims.filter(c => 
      c.reportNumber === params.reportNumber ||
      c.policyNumber === params.policyNumber
    );
    
    if (matched.length === 0) {
      return {
        success: false,
        message: '未找到相关理赔案件'
      };
    }
    
    return {
      success: true,
      data: matched.map(c => ({
        claimId: c.id,
        reportNumber: c.reportNumber,
        status: c.status,
        statusLabel: getStatusLabel(c.status),
        accidentReason: c.accidentReason,
        claimAmount: c.claimAmount,
        approvedAmount: c.approvedAmount,
        submitTime: c.reportTime,
        lastUpdate: c.updatedAt,
        nextStep: getNextStep(c.status)
      }))
    };
  }
};

// 所有可用工具
export const voiceTools = [
  checkPolicyTool,
  submitClaimTool,
  getClaimProgressTool
];
```

### 6.2 工具调用确认机制

```typescript
// server/voice/tools/ToolConfirmation.ts
export class ToolConfirmationHandler {
  // 需要确认的工具列表（涉及敏感操作）
  private requireConfirmation = [
    'submitClaim',
    'updateClaim',
    'cancelClaim'
  ];
  
  // 检查是否需要确认
  needsConfirmation(toolName: string, params: any): boolean {
    if (!this.requireConfirmation.includes(toolName)) {
      return false;
    }
    
    // 根据参数判断
    if (toolName === 'submitClaim') {
      // 所有报案都需要确认
      return true;
    }
    
    return false;
  }
  
  // 生成确认提示
  generateConfirmationPrompt(toolName: string, params: any): string {
    switch (toolName) {
      case 'submitClaim':
        return `我将为您提交理赔申请：
                保单号：${params.policyNumber}
                事故时间：${params.accidentTime}
                事故原因：${params.accidentReason}
                
                确认提交吗？`;
      default:
        return `确认执行${toolName}操作吗？`;
    }
  }
  
  // 解析用户确认响应
  parseConfirmationResponse(text: string): 'yes' | 'no' | 'unclear' {
    const affirmative = ['是的', '对的', '没错', '好', '可以', '确认', '提交'];
    const negative = ['不是', '不对', '错了', '取消', '不要', '再等等'];
    
    if (affirmative.some(word => text.includes(word))) {
      return 'yes';
    }
    if (negative.some(word => text.includes(word))) {
      return 'no';
    }
    return 'unclear';
  }
}
```

---

## 7. 对话状态管理

### 7.1 会话状态机

```typescript
// server/voice/state/VoiceSessionState.ts

enum VoiceSessionState {
  IDLE = 'idle',                    // 空闲等待
  LISTENING = 'listening',          // 监听用户输入
  PROCESSING = 'processing',        // 处理中（STT/LLM）
  SPEAKING = 'speaking',            // AI说话中
  CONFIRMING = 'confirming',        // 等待用户确认
  TOOL_CALLING = 'tool_calling',    // 执行工具调用
  INTERRUPTED = 'interrupted',      // 被打断
  ENDED = 'ended'                   // 会话结束
}

interface VoiceSessionContext {
  state: VoiceSessionState;
  currentIntent: string | null;
  slots: Map<string, SlotValue>;
  pendingToolCall: ToolCall | null;
  conversationHistory: Message[];
  interruptedContent: string | null;
}

class VoiceStateMachine {
  private context: VoiceSessionContext;
  private transitions: Map<VoiceSessionState, VoiceSessionState[]>;
  
  constructor() {
    this.context = {
      state: VoiceSessionState.IDLE,
      currentIntent: null,
      slots: new Map(),
      pendingToolCall: null,
      conversationHistory: [],
      interruptedContent: null
    };
    
    // 定义状态转移规则
    this.transitions = new Map([
      [VoiceSessionState.IDLE, [VoiceSessionState.LISTENING]],
      [VoiceSessionState.LISTENING, [VoiceSessionState.PROCESSING, VoiceSessionState.ENDED]],
      [VoiceSessionState.PROCESSING, [VoiceSessionState.SPEAKING, VoiceSessionState.TOOL_CALLING, VoiceSessionState.CONFIRMING]],
      [VoiceSessionState.SPEAKING, [VoiceSessionState.LISTENING, VoiceSessionState.INTERRUPTED]],
      [VoiceSessionState.INTERRUPTED, [VoiceSessionState.LISTENING, VoiceSessionState.SPEAKING]],
      [VoiceSessionState.TOOL_CALLING, [VoiceSessionState.SPEAKING]],
      [VoiceSessionState.CONFIRMING, [VoiceSessionState.TOOL_CALLING, VoiceSessionState.LISTENING]]
    ]);
  }
  
  canTransition(toState: VoiceSessionState): boolean {
    const allowed = this.transitions.get(this.context.state) || [];
    return allowed.includes(toState);
  }
  
  transition(toState: VoiceSessionState, data?: any) {
    if (!this.canTransition(toState)) {
      throw new Error(`Invalid transition: ${this.context.state} -> ${toState}`);
    }
    
    // 执行退出当前状态的清理
    this.onExitState(this.context.state);
    
    // 更新状态
    this.context.state = toState;
    
    // 执行进入新状态的初始化
    this.onEnterState(toState, data);
  }
  
  private onExitState(state: VoiceSessionState) {
    switch (state) {
      case VoiceSessionState.SPEAKING:
        // 保存未说完的内容
        if (this.isSpeaking()) {
          this.context.interruptedContent = this.getCurrentSpeakingContent();
        }
        break;
    }
  }
  
  private onEnterState(state: VoiceSessionState, data?: any) {
    switch (state) {
      case VoiceSessionState.INTERRUPTED:
        // 发送确认
        this.emit('interrupted', { savedContent: this.context.interruptedContent });
        break;
      case VoiceSessionState.SPEAKING:
        // 恢复之前被打断的内容（如果有）
        if (this.context.interruptedContent && data?.resume) {
          this.speak(this.context.interruptedContent);
          this.context.interruptedContent = null;
        }
        break;
    }
  }
  
  // 填充槽位
  fillSlot(name: string, value: any, confirmed = false) {
    this.context.slots.set(name, { value, confirmed });
  }
  
  // 获取未确认的槽位
  getUnconfirmedSlots(): string[] {
    return Array.from(this.context.slots.entries())
      .filter(([_, slot]) => !slot.confirmed)
      .map(([name, _]) => name);
  }
  
  // 获取缺失的槽位
  getMissingSlots(required: string[]): string[] {
    return required.filter(name => !this.context.slots.has(name));
  }
}
```

### 7.2 槽位提取策略

```typescript
// server/voice/state/SlotExtractor.ts

interface SlotDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'enum';
  required: boolean;
  description: string;
  enumValues?: string[];
  validation?: (value: any) => boolean;
}

class SlotExtractor {
  private slots: Map<string, SlotDefinition>;
  private llm: LLMService;
  
  constructor(llm: LLMService) {
    this.llm = llm;
    this.slots = new Map();
  }
  
  defineSlot(def: SlotDefinition) {
    this.slots.set(def.name, def);
  }
  
  // 从用户输入中提取槽位
  async extractSlots(userInput: string, context: ConversationContext): Promise<ExtractedSlots> {
    const prompt = `
从用户的输入中提取以下信息：

用户输入："${userInput}"

需要提取的字段：
${Array.from(this.slots.values()).map(s => 
  `- ${s.name}: ${s.description} (${s.type}${s.required ? ', 必填' : ''})`
).join('\n')}

对话历史：
${context.getRecentHistory(3)}

请以JSON格式返回提取结果：
{
  "extracted": {
    "字段名": "提取的值"
  },
  "missing": ["未提取到的必填字段"],
  "uncertain": ["不确定的提取结果"]
}
`;
    
    const response = await this.llm.complete(prompt);
    return JSON.parse(response.text);
  }
  
  // 验证槽位值
  validateSlot(name: string, value: any): { valid: boolean; error?: string } {
    const def = this.slots.get(name);
    if (!def) return { valid: false, error: 'Unknown slot' };
    
    // 类型检查
    switch (def.type) {
      case 'date':
        if (!isValidDate(value)) {
          return { valid: false, error: 'Invalid date format' };
        }
        break;
      case 'enum':
        if (def.enumValues && !def.enumValues.includes(value)) {
          return { valid: false, error: `Must be one of: ${def.enumValues.join(', ')}` };
        }
        break;
      case 'number':
        if (isNaN(Number(value))) {
          return { valid: false, error: 'Must be a number' };
        }
        break;
    }
    
    // 自定义验证
    if (def.validation && !def.validation(value)) {
      return { valid: false, error: 'Custom validation failed' };
    }
    
    return { valid: true };
  }
}

// 报案场景槽位定义
export const claimReportSlots: SlotDefinition[] = [
  {
    name: 'policyNumber',
    type: 'string',
    required: true,
    description: '保单号码，通常是10-20位字母数字组合',
    validation: (v) => /^[A-Z0-9]{10,20}$/i.test(v)
  },
  {
    name: 'accidentTime',
    type: 'date',
    required: true,
    description: '事故发生日期，格式：YYYY-MM-DD',
    validation: (v) => {
      const date = new Date(v);
      const now = new Date();
      return date <= now && date > new Date('2000-01-01');
    }
  },
  {
    name: 'accidentLocation',
    type: 'string',
    required: false,
    description: '事故发生地点，如医院名称、道路名称等'
  },
  {
    name: 'accidentReason',
    type: 'string',
    required: true,
    description: '事故原因描述，如疾病名称、事故类型等'
  },
  {
    name: 'claimAmount',
    type: 'number',
    required: false,
    description: '预估理赔金额（元）'
  },
  {
    name: 'incidentType',
    type: 'enum',
    required: true,
    description: '事故类型',
    enumValues: ['medical', 'accident', 'vehicle', 'property', 'death']
  }
];
```

---

## 8. 与现有系统集成

### 8.1 集成架构

```
新语音系统                    现有系统
┌──────────────┐            ┌──────────────┐
│ Voice Agent  │ ───HTTP───▶│   api.ts     │
└──────────────┘            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Claims   │  │ Policies │  │ LangGraph│
              │ API      │  │ API      │  │ Agent    │
              └──────────┘  └──────────┘  └──────────┘
```

### 8.2 复用现有组件

| 现有组件 | 复用方式 | 说明 |
|---------|----------|------|
| `api.ts` | 直接调用 | 所有数据操作通过现有API |
| `types.ts` | 直接引用 | ClaimCase, ClaimStatus等类型 |
| LangGraph Agent | 扩展工具 | 复用checkEligibility等工具 |
| IntakeConfig | 读取配置 | 获取字段定义和材料清单规则 |
| `smartclaim-ai-agent` | UI参考 | 借鉴界面设计和交互模式 |

### 8.3 新增模块位置

```
project-root/
├── components/voice/           # 新增：语音UI组件
│   ├── VoiceClient.tsx
│   ├── VoiceVisualizer.tsx
│   ├── TranscriptDisplay.tsx
│   └── VoiceControls.tsx
├── server/voice/               # 新增：后端语音服务
│   ├── VoiceGateway.ts
│   ├── VoiceSession.ts
│   ├── VoicePipeline.ts
│   ├── tools/                  # 语音专用工具
│   │   ├── index.ts
│   │   ├── checkPolicy.ts
│   │   ├── submitClaim.ts
│   │   └── getProgress.ts
│   └── state/                  # 状态管理
│       ├── VoiceSessionState.ts
│       └── SlotExtractor.ts
├── hooks/useVoiceSession.ts    # 新增：前端Hook
└── pages/VoiceClaimPage.tsx    # 新增：语音报案页面
```

---

## 9. 性能优化策略

### 9.1 延迟优化

| 优化点 | 策略 | 预期效果 |
|--------|------|----------|
| STT延迟 | 阿里云NLS流式识别 + 增量返回 | < 300ms |
| LLM延迟 | Gemini 2.5 Flash + 流式输出 | < 500ms |
| TTS延迟 | 阿里云TTS流式合成 | < 200ms |
| 网络延迟 | WebSocket长连接 + 心跳保活 | < 50ms |
| **总计** | | **< 1s** |

### 9.2 连接管理

```typescript
// 连接池配置
interface ConnectionConfig {
  maxSessions: 1000;           // 最大并发会话
  sessionTimeout: 600000;      // 会话超时：10分钟
  heartbeatInterval: 30000;    // 心跳间隔：30秒
  reconnectAttempts: 3;        // 重连次数
  reconnectDelay: 1000;        // 重连延迟：1秒
}

// 会话生命周期
Session Lifecycle:
  创建 → 活跃(10分钟) → 空闲检测 → 续期/关闭
            ↓
      心跳保活(每30秒)
            ↓
      异常断线 → 自动重连(3次) → 失败则结束
```

### 9.3 错误处理

```typescript
// 错误类型和处理策略
enum VoiceErrorType {
  NETWORK_ERROR = 'network_error',      // 网络异常 → 重连
  STT_ERROR = 'stt_error',              // 识别失败 → 提示重说
  TTS_ERROR = 'tts_error',              // 合成失败 → 文字回复
  LLM_ERROR = 'llm_error',              // 推理失败 → 转人工
  SESSION_ERROR = 'session_error',      // 会话异常 → 重新建立
  PERMISSION_ERROR = 'permission_error' // 权限拒绝 → 引导设置
}

const errorHandlers: Record<VoiceErrorType, ErrorHandler> = {
  [VoiceErrorType.NETWORK_ERROR]: async (error, session) => {
    if (session.reconnectCount < 3) {
      await session.reconnect();
    } else {
      await session.speak('网络连接不稳定，建议您稍后再试或联系客服。');
      await session.end();
    }
  },
  
  [VoiceErrorType.STT_ERROR]: async (error, session) => {
    await session.speak('抱歉，我没有听清楚。请您再说一遍。');
    session.resumeListening();
  },
  
  [VoiceErrorType.LLM_ERROR]: async (error, session) => {
    await session.speak('抱歉，系统暂时无法处理。正在为您转接人工客服。');
    await session.transferToHuman();
  }
};
```

---

## 10. 安全与合规

### 10.1 身份验证

```typescript
// 会话启动时验证
async function validateSession(req: Request): Promise<boolean> {
  const token = req.headers.authorization;
  const sessionId = req.params.sessionId;
  
  // 1. 验证JWT Token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // 2. 验证会话归属
  const session = await sessionStore.get(sessionId);
  if (session.userId !== decoded.userId) {
    return false;
  }
  
  // 3. 验证保单权限（如果是查询特定保单）
  if (session.policyNumber) {
    const hasPermission = await checkPolicyPermission(
      decoded.userId, 
      session.policyNumber
    );
    if (!hasPermission) return false;
  }
  
  return true;
}
```

### 10.2 数据保护

- **录音存储**: 可选择是否保存对话录音（需用户授权）
- **数据加密**: WebSocket使用WSS，敏感数据加密存储
- **会话隔离**: 每个会话独立，数据不共享
- **日志脱敏**: 身份证号、保单号等敏感信息脱敏记录

### 10.3 合规要求

- **明示告知**: 开始时告知用户正在录音/AI服务
- **人工接管**: 随时可转人工客服
- **记录保存**: 对话日志保存5年（保险行业要求）

---

## 11. 部署与运维

### 11.1 环境配置

```bash
# .env.local 新增配置
# 阿里云NLS
ALIYUN_NLS_APP_KEY=your_app_key
ALIYUN_NLS_ACCESS_KEY_ID=your_key_id
ALIYUN_NLS_ACCESS_KEY_SECRET=your_key_secret
ALIYUN_NLS_TOKEN=your_token

# 阿里云TTS
ALIYUN_TTS_APP_KEY=your_app_key

# WebSocket配置
WS_MAX_CONNECTIONS=1000
WS_HEARTBEAT_INTERVAL=30000
WS_SESSION_TIMEOUT=600000
```

### 11.2 依赖安装

```bash
# 新增依赖
npm install ws @alicloud/nls-2019-02-28 @alicloud/pop-core
npm install -D @types/ws
```

### 11.3 监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| 并发会话数 | 当前活跃语音会话 | > 800 |
| 平均响应时间 | 用户说完到AI回复 | > 1.5s |
| STT准确率 | 语音识别正确率 | < 90% |
| 会话完成率 | 成功完成的会话比例 | < 70% |
| 转人工率 | 需要转人工的比例 | > 20% |

---

## 12. 实施计划

### 12.1 阶段划分

**第一阶段（MVP - 2周）**
- [ ] 基础WebSocket连接和音频传输
- [ ] 阿里云NLS STT集成
- [ ] 阿里云TTS集成
- [ ] 简单对话（报案信息收集）
- [ ] 基础UI界面

**第二阶段（功能完善 - 2周）**
- [ ] 工具调用（查询保单、提交报案）
- [ ] 槽位提取和确认机制
- [ ] 打断处理
- [ ] 对话状态管理

**第三阶段（优化上线 - 2周）**
- [ ] 性能优化（延迟优化）
- [ ] 错误处理和恢复
- [ ] 安全加固
- [ ] 监控和日志
- [ ] 生产部署

### 12.2 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 阿里云NLS稳定性 | 高 | 准备备选STT方案 |
| WebSocket兼容性 | 中 | 提供降级到文字聊天 |
| 语音识别准确率 | 中 | 增加确认机制，允许重说 |
| 并发性能瓶颈 | 中 | 水平扩展，负载均衡 |

---

## 13. 总结

### 13.1 核心设计决策

1. **技术栈**: WebSocket + 阿里云NLS + Gemini + 阿里云TTS
2. **架构**: 自建语音网关，与现有系统松耦合集成
3. **交互**: 双向实时流式，支持打断，带确认机制
4. **功能**: 报案、查进度、材料、咨询全流程覆盖

### 13.2 关键优势

- **快速响应**: 端到端延迟 < 1秒
- **准确理解**: 中文优化STT，专业词汇支持
- **流畅体验**: 支持打断，自然对话
- **可扩展**: 模块化设计，易于添加新功能

### 13.3 与现有系统关系

- 复用现有API和数据模型
- 扩展而非替换
- 可独立部署或与现有系统集成

---

*方案版本: 1.0*
*最后更新: 2026-03-04*
*作者: AI架构设计助手*
```

