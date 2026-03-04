import WebSocket from 'ws';
import { VoicePipeline } from './VoicePipeline.js';
import { VoiceStateMachine, VoiceSessionState } from './state/VoiceSessionState.js';
import { SlotExtractor, CLAIM_REPORT_SLOTS } from './state/SlotExtractor.js';
import type { VoiceMessage } from '../../types/voice.js';

interface SessionConfig {
  sessionId: string;
  ws: WebSocket;
  pipeline: VoicePipeline;
}

export class VoiceSession {
  private sessionId: string;
  private ws: WebSocket;
  private pipeline: VoicePipeline;
  private stateMachine: VoiceStateMachine;
  private slotExtractor: SlotExtractor;
  private audioBuffer: Buffer[] = [];
  private isSpeaking = false;
  private currentResponseText = '';

  constructor(config: SessionConfig) {
    this.sessionId = config.sessionId;
    this.ws = config.ws;
    this.pipeline = config.pipeline;
    this.stateMachine = new VoiceStateMachine();
    this.slotExtractor = new SlotExtractor(CLAIM_REPORT_SLOTS);
  }

  async handleMessage(message: VoiceMessage): Promise<void> {
    switch (message.type) {
      case 'audio':
        await this.handleAudioMessage(message.payload);
        break;
      case 'text':
        await this.handleTextMessage(message.payload);
        break;
      case 'control':
        await this.handleControlMessage(message.payload);
        break;
    }
  }

  private async handleAudioMessage(payload: any): Promise<void> {
    const currentState = this.stateMachine.getState();
    
    if (currentState === VoiceSessionState.SPEAKING) {
      return;
    }

    if (payload.data) {
      const audioData = Buffer.from(payload.data, 'base64');
      this.audioBuffer.push(audioData);
    }

    if (payload.isFinal && this.audioBuffer.length > 0) {
      const completeAudio = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      this.stateMachine.transition(VoiceSessionState.PROCESSING);
      
      try {
        await this.pipeline.processAudioChunk(completeAudio);
      } catch (error) {
        console.error('[VoiceSession] Audio processing error:', error);
        this.stateMachine.transition(VoiceSessionState.ERROR);
      }
    }
  }

  private async handleTextMessage(payload: any): Promise<void> {
    if (payload.source === 'stt' && payload.isFinal) {
      this.stateMachine.addToHistory('user', payload.content);
      await this.processUserInput(payload.content);
    }
  }

  private async handleControlMessage(payload: any): Promise<void> {
    switch (payload.action) {
      case 'barge_in':
        await this.handleBargeIn();
        break;
      case 'stop':
        this.cleanup();
        break;
    }
  }

  private async handleBargeIn(): Promise<void> {
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.currentResponseText = '';
      
      this.stateMachine.transition(VoiceSessionState.INTERRUPTED, {
        interruptedContent: this.currentResponseText
      });
      
      this.sendEvent('barge_in_acknowledged', {});
      this.sendText('llm', '好的，您请说。', true);
      
      this.stateMachine.transition(VoiceSessionState.LISTENING);
    }
  }

  private async processUserInput(text: string): Promise<void> {
    const currentState = this.stateMachine.getState();
    
    if (currentState === VoiceSessionState.PROCESSING || 
        currentState === VoiceSessionState.SPEAKING) {
      return;
    }

    this.stateMachine.transition(VoiceSessionState.PROCESSING);

    try {
      // 提取槽位
      const extractedSlots = this.slotExtractor.extractSlots(text);
      
      // 填充槽位
      for (const slot of extractedSlots) {
        this.stateMachine.fillSlot(slot.name, slot.value, false, slot.confidence);
      }

      // 获取未确认的槽位
      const unconfirmedSlots = this.stateMachine.getUnconfirmedSlots();
      
      if (unconfirmedSlots.length > 0) {
        // 询问缺失的槽位
        const missingSlot = unconfirmedSlots[0];
        const slotDef = CLAIM_REPORT_SLOTS.find(s => s.name === missingSlot);
        
        if (slotDef) {
          this.stateMachine.transition(VoiceSessionState.CONFIRMING);
          const question = this.generateSlotQuestion(slotDef);
          await this.sendResponse(question);
          return;
        }
      }

      // 检查是否收集完所有必填槽位
      const missingRequiredSlots = this.stateMachine.getMissingSlots(
        CLAIM_REPORT_SLOTS.filter(s => s.required).map(s => s.name)
      );

      if (missingRequiredSlots.length > 0) {
        // 询问缺失的必填槽位
        const slotDef = CLAIM_REPORT_SLOTS.find(s => s.name === missingRequiredSlots[0]);
        if (slotDef) {
          const question = this.generateSlotQuestion(slotDef);
          await this.sendResponse(question);
          return;
        }
      }

      // 所有槽位收集完成，调用 LLM 处理
      const { response, toolCall } = await this.pipeline.processTranscript(
        text,
        this.stateMachine.getHistory()
      );

      if (toolCall) {
        this.stateMachine.transition(VoiceSessionState.TOOL_CALLING);
        this.sendEvent('tool_call_start', { toolName: toolCall.name });
        
        const toolResult = await this.pipeline.executeTool(toolCall);
        
        this.sendEvent('tool_call_end', { 
          toolName: toolCall.name, 
          result: toolResult 
        });
        
        this.stateMachine.addToHistory('system', 
          `工具调用 ${toolCall.name}: ${JSON.stringify(toolResult)}`
        );

        // 根据工具结果生成回复
        const finalResponse = await this.generateToolResponse(toolCall.name, toolResult);
        await this.sendResponse(finalResponse);
      } else {
        await this.sendResponse(response);
      }

    } catch (error) {
      console.error('[VoiceSession] Processing error:', error);
      this.stateMachine.setError('处理失败');
      await this.sendResponse('抱歉，处理出错，请重试。');
    }
  }

  private async sendResponse(text: string): Promise<void> {
    this.stateMachine.transition(VoiceSessionState.SPEAKING);
    this.isSpeaking = true;
    this.currentResponseText = text;
    
    this.stateMachine.addToHistory('assistant', text);
    this.sendText('llm', text, true);
    
    // 调用 TTS
    try {
      await this.pipeline.synthesizeSpeech(text, (audioChunk) => {
        if (this.isSpeaking) {
          this.sendAudio(audioChunk);
        }
      });
    } catch (error) {
      console.error('[VoiceSession] TTS error:', error);
    }
    
    this.isSpeaking = false;
    this.stateMachine.transition(VoiceSessionState.LISTENING);
  }

  private generateSlotQuestion(slotDef: any): string {
    const questions: Record<string, string> = {
      policyNumber: '请告诉我您的保单号码。',
      reporterName: '请问您贵姓？',
      accidentTime: '事故发生时间是什么时候？',
      accidentLocation: '事故发生地点在哪里？',
      accidentReason: '请描述一下事故原因或病情。',
      incidentType: '这是什么类型的事故？医疗、意外还是其他？',
      hospitalName: '就诊医院名称是什么？',
      claimAmount: '预估理赔金额是多少？'
    };

    return questions[slotDef.name] || `请提供${slotDef.description}。`;
  }

  private async generateToolResponse(toolName: string, toolResult: any): Promise<string> {
    if (!toolResult.success) {
      return `抱歉，${toolResult.error || '操作失败'}。请重试。`;
    }

    switch (toolName) {
      case '查询保单':
        const policy = toolResult.data;
        return `找到您的保单：${policy.productName}，保单号${policy.policyNumber}，状态${policy.status}。现在可以报案了。`;
      
      case '提交报案':
        const claim = toolResult.data;
        const materials = claim.requiredMaterials?.map((m: any) => m.name).join('、');
        return `报案成功！报案号是 ${claim.reportNumber}。请准备以下材料：${materials}。`;
      
      case '查询理赔进度':
        const claims = toolResult.data;
        if (claims.length === 1) {
          const c = claims[0];
          return `案件${c.reportNumber}当前状态是${c.statusLabel}，${c.nextStep}。`;
        } else {
          return `您有${claims.length}个理赔案件。最新案件状态：${claims[0].statusLabel}。`;
        }
      
      default:
        return toolResult.message || '操作已完成。';
    }
  }

  sendText(source: 'stt' | 'llm' | 'system', content: string, isFinal = true): void {
    this.send({
      type: 'text',
      payload: { source, content, isFinal }
    });
  }

  sendAudio(data: Buffer): void {
    this.send({
      type: 'audio',
      payload: { 
        data: data.toString('base64'),
        format: 'pcm',
        seq: Date.now(),
        isFinal: true
      }
    });
  }

  sendEvent(event: 'session_started' | 'session_ended' | 'error' | 'tool_call_start' | 'tool_call_end' | 'thinking' | 'barge_in_acknowledged', data: any): void {
    this.send({
      type: 'event',
      payload: { event, data }
    });
  }

  private send(message: VoiceMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  cleanup(): void {
    this.isSpeaking = false;
    this.audioBuffer = [];
    this.ws.close();
  }
}
