import type {
  Intent,
  IntentType,
  IntentRecognitionResult,
  SessionState
} from './IntentTypes.js';
import { VoiceSessionContext } from '../state/VoiceSessionContext.js';
import { buildIntentRecognitionPrompt } from '../prompts/intentRecognition.js';
import { invokeAICapability } from '../../services/aiRuntime.js';

export class IntentRecognizer {
  constructor() {}

  async recognize(text: string, context: VoiceSessionContext): Promise<Intent> {
    const strongRuleIntent = this.recognizeByRules(text, context);
    if (strongRuleIntent && strongRuleIntent.confidence >= 0.9) {
      return strongRuleIntent;
    }

    try {
      const currentState = context.getCurrentState();
      const prompt = this.buildPrompt(text, currentState, context);

      const { response: result } = await invokeAICapability({
        capabilityId: 'voice.intent',
        request: {
          contents: { parts: [{ text: prompt }] },
          config: {
            temperature: 0.1,
          },
        },
        meta: {
          sourceApp: 'voice',
          module: 'voice.IntentRecognizer',
          operation: 'recognize_intent',
          context: {
            userText: text,
            currentState,
          },
        },
      });

      const responseText = result.text || '';
      const parsed = this.parseResponse(responseText);

      return {
        type: parsed.intent,
        confidence: parsed.confidence,
        entities: parsed.entities || {},
        originalText: text,
        conversationGoal: parsed.conversationGoal,
        replyStrategy: parsed.replyStrategy,
        missingCriticalFields: parsed.missingCriticalFields,
      };
    } catch (error) {
      console.error('[IntentRecognizer] Recognition error:', error);
      return strongRuleIntent || this.fallbackRecognize(text, context);
    }
  }

  private recognizeByRules(text: string, context: VoiceSessionContext): Intent | null {
    const normalizedText = text.trim();
    const currentState = context.getCurrentState();

    if (/^(?:没事了|不用了|先这样|先不用|不需要了|不用报了|不用查了|取消|结束|停止|算了|挂了|拜拜|再见)[。！!，,\s]*$/.test(normalizedText)) {
      return {
        type: 'cancel' as IntentType,
        confidence: 0.98,
        originalText: text,
        conversationGoal: 'clarify',
        replyStrategy: 'handoff',
      };
    }

    if (/(?:我要报案|我想报案|帮我报案|我要理赔|我要申请理赔|出险了|发生事故了|撞车了|住院了)/.test(normalizedText)) {
      return {
        type: 'start_claim' as IntentType,
        confidence: 0.98,
        originalText: text,
        conversationGoal: 'collect',
        replyStrategy: 'ack_then_ask',
      };
    }

    if (/(?:查询|看看|了解).*(?:进度|状态|进展)|(?:理赔|案件).*(?:到哪|进度|状态)/.test(normalizedText)) {
      return {
        type: 'query_progress' as IntentType,
        confidence: 0.96,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:材料清单|需要什么材料|要交什么|准备什么材料)/.test(normalizedText)) {
      return {
        type: 'query_materials' as IntentType,
        confidence: 0.96,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:还缺|还差|缺什么|少什么).*(?:材料)?|没交齐/.test(normalizedText)) {
      return {
        type: 'query_missing_materials' as IntentType,
        confidence: 0.96,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:赔不赔|保不保|保障范围|能不能赔|保什么)/.test(normalizedText)) {
      return {
        type: 'query_coverage' as IntentType,
        confidence: 0.94,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:赔多少|赔多少钱|能赔多少|预估赔付|赔付金额)/.test(normalizedText)) {
      return {
        type: 'query_settlement' as IntentType,
        confidence: 0.94,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/^(?:怎么说|怎么弄|怎么用|举个例子|什么意思|帮助|帮忙)[？?。！!\s]*$/.test(normalizedText)) {
      return {
        type: 'ask_help' as IntentType,
        confidence: 0.95,
        originalText: text,
        conversationGoal: 'clarify',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/^(?:再说一遍|重复一下|没听清|请再说一遍)[。！!\s]*$/.test(normalizedText)) {
      return {
        type: 'repeat' as IntentType,
        confidence: 0.95,
        originalText: text,
        conversationGoal: 'clarify',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/^(?:第|选|要)([一二三四五12345])/.test(normalizedText) && (currentState === 'SELECTING_POLICY' || currentState === 'SELECTING_CLAIM')) {
      return this.fallbackRecognize(text, context);
    }

    return null;
  }

  private buildPrompt(text: string, state: SessionState, context: VoiceSessionContext): string {
    const snapshot = context.getPlanningSnapshot();
    return buildIntentRecognitionPrompt({
      currentState: state,
      userText: text,
      selectedPolicy: snapshot.selectedPolicy,
      selectedClaim: snapshot.selectedClaim,
      collectedFields: snapshot.collectedFields,
      missingRequiredFields: snapshot.missingRequiredFields,
      recentHistory: snapshot.recentHistory,
      lastUserGoal: snapshot.lastUserGoal,
      conversationPhase: snapshot.conversationPhase,
    });
  }

  private parseResponse(response: string): IntentRecognitionResult {
    try {
      const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        intent: parsed.intent as IntentType,
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        response: parsed.response,
        conversationGoal: parsed.conversationGoal,
        replyStrategy: parsed.replyStrategy,
        missingCriticalFields: parsed.missingCriticalFields,
      };
    } catch (error) {
      console.error('[IntentRecognizer] Parse error:', error);
      return {
        intent: 'unknown' as IntentType,
        confidence: 0,
        entities: {},
        conversationGoal: 'clarify',
        replyStrategy: 'ack_then_ask',
      };
    }
  }

  private fallbackRecognize(text: string, context: VoiceSessionContext): Intent {
    const normalizedText = text.toLowerCase().trim();
    const currentState = context.getCurrentState();

    if (/^(?:取消|退出|结束|停止|不报了|不弄了|算了|拜拜|再见|没事了|不用了|先这样|不需要了)/.test(normalizedText)) {
      return {
        type: 'cancel' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: 'clarify',
        replyStrategy: 'handoff',
      };
    }

    if (/^(?:对|是的|没错|正确|确认|好|好的|行|可以|嗯|恩|是$)/.test(normalizedText)) {
      return {
        type: 'confirm' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: currentState === 'CONFIRMING_SUBMISSION' ? 'confirm' : 'clarify',
        replyStrategy: currentState === 'CONFIRMING_SUBMISSION' ? 'confirm_then_submit' : 'ack_then_answer',
      };
    }

    if (/^(?:不对|不是|错误|错了|否|no)/.test(normalizedText)) {
      return {
        type: 'reject' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: 'clarify',
        replyStrategy: 'ack_then_ask',
      };
    }

    const policyMatch = normalizedText.match(/(?:第|选|要)([一二三四五12345])/);
    if (policyMatch) {
      const numMap: Record<string, number> = {
        '一': 1, '1': 1,
        '二': 2, '2': 2,
        '三': 3, '3': 3,
        '四': 4, '4': 4,
        '五': 5, '5': 5,
      };
      return {
        type: currentState === 'SELECTING_CLAIM' ? 'select_claim' as IntentType : 'select_policy' as IntentType,
        confidence: 0.95,
        entities: { index: numMap[policyMatch[1]] },
        originalText: text,
        conversationGoal: 'collect',
        replyStrategy: 'ack_then_ask',
      };
    }

    if (/(?:查询|看看|了解).*(?:进度|状态|进展)|(?:理赔|案件).*(?:到哪|进度|状态)/.test(normalizedText)) {
      return {
        type: 'query_progress' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:需要什么|哪些|什么).*(?:材料)|材料清单|要交什么/.test(normalizedText)) {
      return {
        type: 'query_materials' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:还缺|还差|缺什么|少什么).*(?:材料)?|没交齐/.test(normalizedText)) {
      return {
        type: 'query_missing_materials' as IntentType,
        confidence: 0.92,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:赔不赔|保障范围|能不能赔|保什么|保障什么)/.test(normalizedText)) {
      return {
        type: 'query_coverage' as IntentType,
        confidence: 0.88,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/(?:赔多少|赔多少钱|能赔多少|预估赔付|赔付金额)/.test(normalizedText)) {
      return {
        type: 'query_settlement' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: 'answer',
        replyStrategy: 'ack_then_answer',
      };
    }

    if (/^(?:我要|我想|帮我|需要).*(?:报案|理赔|申请)/.test(normalizedText) ||
        /^(?:报案|理赔)/.test(normalizedText)) {
      return {
        type: 'start_claim' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: 'collect',
        replyStrategy: 'ack_then_ask',
      };
    }

    if (/(?:改一下|修改|换成|改为|改成|错了).+/.test(normalizedText)) {
      return {
        type: 'modify_info' as IntentType,
        confidence: 0.85,
        originalText: text,
        conversationGoal: 'collect',
        replyStrategy: 'ack_then_ask',
      };
    }

    if (/^(?:重复|再说|没听清|请再说|重复一遍)/.test(normalizedText)) {
      return {
        type: 'repeat' as IntentType,
        confidence: 0.9,
        originalText: text,
        conversationGoal: 'clarify',
        replyStrategy: 'ack_then_answer',
      };
    }

    return {
      type: 'provide_info' as IntentType,
      confidence: 0.7,
      originalText: text,
      conversationGoal: currentState === 'COLLECTING_FIELDS' ? 'collect' : 'clarify',
      replyStrategy: currentState === 'COLLECTING_FIELDS' ? 'ack_then_ask' : 'ack_then_answer',
      missingCriticalFields: context.getMissingRequiredFields().map((field) => field.fieldId).slice(0, 2),
    };
  }
}
