import type {
  Intent,
  IntentType,
  IntentHandlerResult,
  NormalizedQuery,
  VoicePolicyInfo,
  VoiceClaimInfo,
} from './IntentTypes.js';
import { VoiceSessionContext } from '../state/VoiceSessionContext.js';
import { buildAcknowledgedFacts } from '../responders/voiceReplyBuilder.js';

export type IntentHandler = (
  intent: Intent,
  context: VoiceSessionContext
) => Promise<IntentHandlerResult>;

function normalizeMissingField(fieldId: string): string {
  const labels: Record<string, string> = {
    accident_date: '出险时间',
    accident_time: '具体时间',
    accident_reason: '出险原因',
    hospital_name: '就诊医院',
    accident_location: '出险地点',
    claim_amount: '大概金额',
    treatment_type: '治疗方式',
    discharge_date: '出院日期',
  };
  return labels[fieldId] || '关键信息';
}

export class IntentHandlerRegistry {
  private handlers: Map<IntentType, IntentHandler> = new Map();
  private defaultHandler: IntentHandler;

  constructor() {
    this.defaultHandler = async () => ({
      success: true,
      response: '抱歉，我刚才没听清。',
      responseData: {
        scene: 'clarify',
        summary: '抱歉，我刚才没听清。您可以换个说法，或者直接说您是想报案还是查进度。',
      },
    });
  }

  register(intentType: IntentType, handler: IntentHandler): void {
    this.handlers.set(intentType, handler);
  }

  async handle(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const handler = this.handlers.get(intent.type);

    if (!handler) {
      console.warn(`[IntentHandlerRegistry] No handler for intent: ${intent.type}`);
      return this.defaultHandler(intent, context);
    }

    try {
      return await handler(intent, context);
    } catch (error) {
      console.error(`[IntentHandlerRegistry] Handler error for ${intent.type}:`, error);
      return {
        success: false,
        response: '处理出错了，请重试。',
        responseData: {
          scene: 'error',
          summary: '这一步出了点问题，您再说一遍，我继续帮您处理。',
        },
      };
    }
  }

  initializeHandlers(): void {
    this.register('cancel' as IntentType, this.handleCancel.bind(this));
    this.register('confirm' as IntentType, this.handleConfirm.bind(this));
    this.register('reject' as IntentType, this.handleReject.bind(this));
    this.register('select_policy' as IntentType, this.handleSelectPolicy.bind(this));
    this.register('select_claim' as IntentType, this.handleSelectClaim.bind(this));
    this.register('provide_info' as IntentType, this.handleProvideInfo.bind(this));
    this.register('modify_info' as IntentType, this.handleModifyInfo.bind(this));
    this.register('repeat' as IntentType, this.handleRepeat.bind(this));
    this.register('start_claim' as IntentType, this.handleStartClaim.bind(this));
    this.register('query_progress' as IntentType, this.handleQueryProgress.bind(this));
    this.register('query_materials' as IntentType, this.handleQueryMaterials.bind(this));
    this.register('query_missing_materials' as IntentType, this.handleQueryMissingMaterials.bind(this));
    this.register('query_coverage' as IntentType, this.handleQueryCoverage.bind(this));
    this.register('query_settlement' as IntentType, this.handleQuerySettlement.bind(this));
    this.register('ask_help' as IntentType, this.handleAskHelp.bind(this));
  }

  private buildClaimSelectionResult(
    context: VoiceSessionContext,
    options: {
      actionType: string;
      answerType: string;
      responsePrefix: string;
      payload?: Record<string, any>;
    },
  ): IntentHandlerResult {
    context.setPendingClaimQuery({
      actionType: options.actionType,
      responsePrefix: options.responsePrefix,
      payload: options.payload,
    });

    return {
      success: true,
      response: options.responsePrefix,
      newState: 'LOADING_CLAIMS',
      actions: [{
        type: 'LOAD_CLAIMS',
        payload: {}
      }],
      responseData: {
        scene: 'query_with_claim_resolution',
        answerType: options.answerType,
        summary: options.responsePrefix,
      },
    };
  }

  private buildPolicySelectionResult(
    context: VoiceSessionContext,
    options: {
      actionType: string;
      answerType: string;
      responsePrefix: string;
      payload?: Record<string, any>;
    },
  ): IntentHandlerResult {
    context.setPendingClaimQuery({
      actionType: options.actionType,
      responsePrefix: options.responsePrefix,
      payload: options.payload,
    });

    return {
      success: true,
      response: options.responsePrefix,
      newState: 'LOADING_POLICIES',
      actions: [{
        type: 'LOAD_POLICIES',
        payload: {}
      }],
      responseData: {
        scene: 'query_with_policy_resolution',
        answerType: options.answerType,
        summary: options.responsePrefix,
      },
    };
  }

  private getNormalizedQuery(intent: Intent): NormalizedQuery | null {
    return (intent.entities?.normalizedQuery as NormalizedQuery | undefined) || null;
  }

  private buildContextualQueryResult(
    context: VoiceSessionContext,
    options: {
      actionType: string;
      answerType: string;
      responsePrefix: string;
      includeClaimId?: boolean;
    },
  ): IntentHandlerResult {
    const selectedClaim = context.getSelectedClaim();
    const selectedPolicy = context.getSelectedPolicy();

    if (!selectedClaim && !selectedPolicy) {
      return this.buildClaimSelectionResult(context, {
        actionType: options.actionType,
        answerType: options.answerType,
        responsePrefix: options.responsePrefix,
      });
    }

    return {
      success: true,
      response: options.responsePrefix,
      actions: [{
        type: options.actionType,
        payload: {
          ...(options.includeClaimId && selectedClaim ? { claimId: selectedClaim.claimId } : {}),
          claimType: selectedClaim?.claimType || selectedPolicy?.productName,
          productCode: selectedClaim?.productCode || selectedPolicy?.productCode,
        }
      }],
      responseData: {
        scene: 'query_answer',
        answerType: options.answerType,
        summary: options.responsePrefix,
      },
    };
  }

  private async handleCancel(_intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const currentState = context.getCurrentState();
    const needConfirmStates = ['COLLECTING_FIELDS', 'CONFIRMING_SUBMISSION'];

    if (currentState === 'CONFIRMING_CANCEL') {
      context.clearAll();
      return {
        success: true,
        response: '好的，已取消报案。',
        shouldTerminate: true,
        newState: 'ENDED',
        responseData: {
          scene: 'cancelled',
          summary: '好的，这次报案我先帮您取消了。后面您想继续，随时再叫我。',
        },
      };
    }

    if (needConfirmStates.includes(currentState) && !context.isCancelPending()) {
      context.setCancelPending(true);
      return {
        success: true,
        response: '确定要取消报案吗？',
        newState: 'CONFIRMING_CANCEL',
        responseData: {
          scene: 'confirm_cancel',
          summary: '这次报案还没提交。如果您确定取消，就说确定取消；如果继续，就直接说继续。',
        },
      };
    }

    if (context.isCancelPending()) {
      context.clearAll();
      return {
        success: true,
        response: '好的，已取消报案。',
        shouldTerminate: true,
        newState: 'ENDED',
      };
    }

    return {
      success: true,
      response: '好的。',
      responseData: {
        scene: 'idle_redirect',
        summary: '好的。您现在可以直接说我要报案，或者说查询进度。',
      },
    };
  }

  private async handleConfirm(_intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const currentState = context.getCurrentState();

    switch (currentState) {
      case 'CONFIRMING_CANCEL':
        context.setCancelPending(false);
        return {
          success: true,
          response: '好的，继续办理。',
          newState: 'COLLECTING_FIELDS',
          responseData: {
            scene: 'continue_after_cancel',
            summary: '好的，我们继续。您接着说下还没补充的事故信息。',
          },
        };

      case 'CONFIRMING_SUBMISSION':
        return {
          success: true,
          response: '正在提交报案。',
          newState: 'SUBMITTING',
          actions: [{
            type: 'SUBMIT_CLAIM',
            payload: context.formatForSubmission()
          }],
          responseData: {
            scene: 'submit_claim',
            answerType: 'submit_claim',
            summary: context.getConfirmedSubmissionSnapshot() || this.buildSummary(context),
          },
        };

      default:
        return {
          success: true,
          response: '好的。',
          responseData: {
            scene: 'acknowledge',
            summary: '好的，我继续帮您处理。',
          },
        };
    }
  }

  private async handleReject(_intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const currentState = context.getCurrentState();

    switch (currentState) {
      case 'CONFIRMING_SUBMISSION':
        return {
          success: true,
          response: '好的，您说下要改哪里。',
          newState: 'COLLECTING_FIELDS',
          responseData: {
            scene: 'modify_after_reject',
            summary: '没问题，您直接说要改哪一项，比如时间、医院或者原因。',
          },
        };

      case 'CONFIRMING_CANCEL':
        context.setCancelPending(false);
        return {
          success: true,
          response: '好的，继续办理。',
          newState: 'COLLECTING_FIELDS',
        };

      default:
        return {
          success: true,
          response: '好的。',
          responseData: {
            scene: 'acknowledge',
            summary: '好的，您接着说。',
          },
        };
    }
  }

  private async handleSelectPolicy(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const index = intent.entities?.index;
    const policies = context.getAvailablePolicies();

    if (!index || index < 1 || index > policies.length) {
      return {
        success: false,
        response: '保单序号不对。',
        responseData: {
          scene: 'select_policy_error',
          summary: `我这边一共查到${policies.length}张保单。您说第几张就行。`,
        },
      };
    }

    const selectedPolicy = policies[index - 1];
    context.setSelectedPolicy(selectedPolicy);
    context.setConversationPhase('claim_collection');
    const pendingQuery = context.getPendingClaimQuery();

    if (pendingQuery) {
      context.setPendingClaimQuery(null);
      return {
        success: true,
        response: pendingQuery.responsePrefix || `已为您定位到${selectedPolicy.productName}`,
        newState: 'IDLE',
        actions: [{
          type: pendingQuery.actionType,
          payload: {
            ...(pendingQuery.payload || {}),
            productCode: selectedPolicy.productCode,
            claimType: selectedPolicy.productName,
          }
        }],
        responseData: {
          scene: 'policy_selected_for_query',
          answerType: pendingQuery.actionType,
          summary: pendingQuery.responsePrefix || `已为您定位到${selectedPolicy.productName}`,
        },
      };
    }

    return {
      success: true,
      response: `已选择${selectedPolicy.productName}`,
      newState: 'COLLECTING_FIELDS',
      actions: [{
        type: 'LOAD_INTAKE_CONFIG',
        payload: { productCode: selectedPolicy.productCode }
      }],
      responseData: {
        scene: 'policy_selected',
        summary: `已为您选好${selectedPolicy.productName}`,
      },
    };
  }

  private async handleSelectClaim(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const index = intent.entities?.index;
    const claims = context.getAvailableClaims();

    if (!index || index < 1 || index > claims.length) {
      return {
        success: false,
        response: '案件序号不对。',
        responseData: {
          scene: 'select_claim_error',
          summary: `我这边一共查到${claims.length}个案件。您说第几个就行。`,
        },
      };
    }

    const selectedClaim = claims[index - 1];
    context.setSelectedClaim(selectedClaim);

    const pendingClaimQuery = context.getPendingClaimQuery();
    context.setPendingClaimQuery(null);

    if (pendingClaimQuery) {
      return {
        success: true,
        response: pendingClaimQuery.responsePrefix || `已定位到案件${selectedClaim.claimId}`,
        newState: 'IDLE',
        actions: [{
          type: pendingClaimQuery.actionType,
          payload: {
            ...(pendingClaimQuery.payload || {}),
            claimId: selectedClaim.claimId,
            claimType: selectedClaim.claimType,
            productCode: selectedClaim.productCode,
          }
        }],
        responseData: {
          scene: 'claim_selected_for_query',
          answerType: pendingClaimQuery.actionType,
          summary: pendingClaimQuery.responsePrefix,
        },
      };
    }

    return {
      success: true,
      response: `已选案件${selectedClaim.claimId}`,
      newState: 'IDLE',
      responseData: {
        scene: 'claim_selected',
        summary: `好，我已经定位到案件${selectedClaim.claimId}。您接着问我进度、材料或者赔付都可以。`,
      },
    };
  }

  private async handleProvideInfo(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const entities = intent.entities || {};
    const currentState = context.getCurrentState();

    if (currentState !== 'COLLECTING_FIELDS' && currentState !== 'MODIFYING_FIELD') {
      const hasPolicies = context.getAvailablePolicies().length > 0;
      return {
        success: true,
        response: '请先选保单。',
        responseData: {
          scene: 'need_policy',
          summary: hasPolicies
            ? '咱们先把保单定下来，您再描述事故，我这边才能继续帮您报案。'
            : '抱歉，我暂时没有查到您的保单记录。您也可以直接说我要报案、查询进度，或者需要什么材料。',
        },
      };
    }

    const updatedEntries = Object.entries(entities).filter(([, value]) => value !== null && value !== undefined && value !== '');
    updatedEntries.forEach(([fieldId, value]) => context.updateField(fieldId, value));

    const acknowledgedFacts = buildAcknowledgedFacts(context.getAllFields());
    const nextField = context.getNextMissingField();

    if (nextField) {
      return {
        success: true,
        response: `还差${nextField.label}`,
        newState: 'COLLECTING_FIELDS',
        responseData: {
          scene: 'collecting_fields',
          acknowledgedFacts,
          missingFields: [nextField.fieldId],
          askedField: nextField.fieldId,
          nextStep: `您接着说一下${normalizeMissingField(nextField.fieldId)}。`,
        },
      };
    }

    const summary = this.buildSummary(context);
    context.setConfirmedSubmissionSnapshot(summary);
    return {
      success: true,
      response: summary,
      newState: 'CONFIRMING_SUBMISSION',
      responseData: {
        scene: 'confirm_submission',
        summary,
        acknowledgedFacts,
      },
    };
  }

  private async handleModifyInfo(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const entities = intent.entities || {};
    const field = entities.field;
    const value = entities.value;

    if (field && value) {
      context.updateField(field, value);
      const nextField = context.getNextMissingField();
      const summary = this.buildSummary(context);
      if (!nextField) {
        context.setConfirmedSubmissionSnapshot(summary);
      }
      return {
        success: true,
        response: `已更新${field}`,
        newState: nextField ? 'COLLECTING_FIELDS' : 'CONFIRMING_SUBMISSION',
        responseData: {
          scene: 'modify_info',
          summary: nextField
            ? `我已经帮您更新了。现在还差${normalizeMissingField(nextField.fieldId)}。`
            : `我已经改好了。现在的信息是：${summary}。如果没问题，您说确认提交就行。`,
          missingFields: nextField ? [nextField.fieldId] : [],
        },
      };
    }

    context.setState('MODIFYING_FIELD');
    return {
      success: true,
      response: '您说下要改哪里。',
      responseData: {
        scene: 'modify_info_prompt',
        summary: '您直接说要改哪一项和改成什么，比如医院改成瑞金医院。',
      },
    };
  }

  private async handleRepeat(_intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const currentState = context.getCurrentState();

    if (currentState === 'SELECTING_POLICY') {
      const policies = context.getAvailablePolicies();
      return {
        success: true,
        response: '我再报一遍保单。',
        responseData: {
          scene: 'repeat_last',
          summary: `我查到${policies.length}张保单。${policies.slice(0, 3).map((p: VoicePolicyInfo) => `第${p.index}张是${p.productName}`).join('，')}。您说第几张就行。`,
        },
      };
    }

    if (currentState === 'SELECTING_CLAIM') {
      const claims = context.getAvailableClaims();
      return {
        success: true,
        response: '我再报一遍案件。',
        responseData: {
          scene: 'repeat_last',
          summary: `我查到${claims.length}个案件。${claims.slice(0, 3).map((c: VoiceClaimInfo) => `第${c.index}个是案件${c.claimId}`).join('，')}。您说第几个就行。`,
        },
      };
    }

    return {
      success: true,
      response: context.getLastSummary() || context.getLastAssistantQuestion() || '您可以继续说。',
      responseData: {
        scene: 'repeat_last',
        summary: context.getLastSummary() || context.getLastAssistantQuestion() || '您可以继续说。',
      },
    };
  }

  private async handleStartClaim(_intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    context.setConversationPhase('policy_resolution');
    return {
      success: true,
      response: '开始报案',
      newState: 'LOADING_POLICIES',
      actions: [{
        type: 'LOAD_POLICIES',
        payload: {}
      }],
      responseData: {
        scene: 'start_claim',
        summary: '好，我先帮您把可用保单找出来。',
      },
    };
  }

  private async handleQueryProgress(_intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const normalizedQuery = this.getNormalizedQuery(_intent);
    if (normalizedQuery?.needsClaimSelection) {
      return this.buildClaimSelectionResult(context, {
        actionType: 'ANNOUNCE_CLAIM_PROGRESS',
        answerType: 'progress',
        responsePrefix: '我先帮您定位一下要查询的案件。',
      });
    }

    if (normalizedQuery?.claimId) {
      return {
        success: true,
        response: `查询案件${normalizedQuery.claimId}`,
        actions: [{
          type: 'ANNOUNCE_CLAIM_PROGRESS',
          payload: {
            claimId: normalizedQuery.claimId,
            claimType: normalizedQuery.claimType,
            productCode: normalizedQuery.productCode,
          }
        }],
        responseData: {
          scene: 'query_answer',
          answerType: 'progress',
        },
      };
    }

    const selectedClaim = context.getSelectedClaim();
    if (selectedClaim) {
      return {
        success: true,
        response: `查询案件${selectedClaim.claimId}`,
        actions: [{
          type: 'ANNOUNCE_CLAIM_PROGRESS',
          payload: {
            claimId: selectedClaim.claimId,
            claimType: selectedClaim.claimType,
            productCode: selectedClaim.productCode,
          }
        }],
        responseData: {
          scene: 'query_answer',
          answerType: 'progress',
        },
      };
    }

    return this.buildClaimSelectionResult(context, {
      actionType: 'ANNOUNCE_CLAIM_PROGRESS',
      answerType: 'progress',
      responsePrefix: '我先帮您定位一下要查询的案件。',
    });
  }

  private async handleQueryMaterials(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const normalizedQuery = this.getNormalizedQuery(intent);
    if (normalizedQuery?.needsPolicySelection) {
      return this.buildPolicySelectionResult(context, {
        actionType: 'LOAD_CLAIM_MATERIALS',
        answerType: 'materials',
        responsePrefix: '我先帮您确认一下是哪个保单或产品。',
      });
    }

    if (normalizedQuery?.productCode || normalizedQuery?.claimType) {
      return {
        success: true,
        response: '我来帮您看一下理赔材料。',
        actions: [{
          type: 'LOAD_CLAIM_MATERIALS',
          payload: {
            productCode: normalizedQuery.productCode,
            claimType: normalizedQuery.claimType,
            subFocus: normalizedQuery.subFocus,
          }
        }],
        responseData: {
          scene: 'query_answer',
          answerType: 'materials',
          summary: '我来帮您看一下理赔材料。',
        },
      };
    }

    return this.buildContextualQueryResult(context, {
      actionType: 'LOAD_CLAIM_MATERIALS',
      answerType: 'materials',
      responsePrefix: '我来帮您看一下理赔材料。',
    });
  }

  private async handleQueryMissingMaterials(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const normalizedQuery = this.getNormalizedQuery(intent);
    if (normalizedQuery?.needsClaimSelection) {
      return this.buildClaimSelectionResult(context, {
        actionType: 'LOAD_MISSING_CLAIM_MATERIALS',
        answerType: 'missing_materials',
        responsePrefix: '我先帮您定位一下案件，再看还缺什么。',
      });
    }

    if (normalizedQuery?.claimId) {
      return {
        success: true,
        response: '检查缺失材料',
        actions: [{
          type: 'LOAD_MISSING_CLAIM_MATERIALS',
          payload: {
            claimId: normalizedQuery.claimId,
            claimType: normalizedQuery.claimType,
            productCode: normalizedQuery.productCode,
          }
        }],
        responseData: {
          scene: 'query_answer',
          answerType: 'missing_materials',
        },
      };
    }

    const selectedClaim = context.getSelectedClaim();
    if (!selectedClaim) {
      return this.buildClaimSelectionResult(context, {
        actionType: 'LOAD_MISSING_CLAIM_MATERIALS',
        answerType: 'missing_materials',
        responsePrefix: '我先帮您定位一下案件，再看还缺什么。',
      });
    }

    return {
      success: true,
      response: '检查缺失材料',
      actions: [{
        type: 'LOAD_MISSING_CLAIM_MATERIALS',
        payload: {
          claimId: selectedClaim.claimId,
          claimType: selectedClaim.claimType,
          productCode: selectedClaim.productCode,
        }
      }],
      responseData: {
        scene: 'query_answer',
        answerType: 'missing_materials',
      },
    };
  }

  private async handleQueryCoverage(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const normalizedQuery = this.getNormalizedQuery(intent);
    if (normalizedQuery?.needsPolicySelection) {
      return this.buildPolicySelectionResult(context, {
        actionType: 'LOAD_COVERAGE_INFO',
        answerType: 'coverage',
        responsePrefix: '我先帮您确认一下是哪个保单或险种。',
      });
    }

    if (normalizedQuery?.productCode || normalizedQuery?.claimType) {
      return {
        success: true,
        response: '我来帮您看一下保障范围。',
        actions: [{
          type: 'LOAD_COVERAGE_INFO',
          payload: {
            productCode: normalizedQuery.productCode,
            claimType: normalizedQuery.claimType,
            subFocus: normalizedQuery.subFocus,
          }
        }],
        responseData: {
          scene: 'query_answer',
          answerType: 'coverage',
          summary: '我来帮您看一下保障范围。',
        },
      };
    }

    return this.buildContextualQueryResult(context, {
      actionType: 'LOAD_COVERAGE_INFO',
      answerType: 'coverage',
      responsePrefix: '我来帮您看一下保障范围。',
    });
  }

  private async handleQuerySettlement(intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const normalizedQuery = this.getNormalizedQuery(intent);
    if (normalizedQuery?.needsClaimSelection) {
      return this.buildClaimSelectionResult(context, {
        actionType: 'LOAD_SETTLEMENT_ESTIMATE',
        answerType: 'settlement',
        responsePrefix: '我先帮您定位一下要查询赔付的案件。',
      });
    }

    if (normalizedQuery?.needsPolicySelection) {
      return this.buildPolicySelectionResult(context, {
        actionType: 'LOAD_SETTLEMENT_ESTIMATE',
        answerType: 'settlement',
        responsePrefix: '我先帮您确认一下是哪个保单或产品。',
      });
    }

    if (
      normalizedQuery?.claimId ||
      normalizedQuery?.productCode ||
      normalizedQuery?.claimType
    ) {
      return {
        success: true,
        response: '我来帮您估一下赔付金额。',
        actions: [{
          type: 'LOAD_SETTLEMENT_ESTIMATE',
          payload: {
            claimId: normalizedQuery.claimId,
            productCode: normalizedQuery.productCode,
            claimType: normalizedQuery.claimType,
            subFocus: normalizedQuery.subFocus,
          }
        }],
        responseData: {
          scene: 'query_answer',
          answerType: 'settlement',
          summary: '我来帮您估一下赔付金额。',
        },
      };
    }

    return this.buildContextualQueryResult(context, {
      actionType: 'LOAD_SETTLEMENT_ESTIMATE',
      answerType: 'settlement',
      responsePrefix: '我来帮您估一下赔付金额。',
      includeClaimId: true,
    });
  }

  private async handleAskHelp(_intent: Intent, context: VoiceSessionContext): Promise<IntentHandlerResult> {
    const currentState = context.getCurrentState();

    if (currentState === 'SELECTING_POLICY') {
      return {
        success: true,
        response: '您可以说第几张。',
        responseData: {
          scene: 'help',
          summary: '您直接说第1张、第2张就行。如果记不清，我也可以再给您报一遍。',
        },
      };
    }

    if (currentState === 'COLLECTING_FIELDS') {
      return {
        success: true,
        response: '您可以自然描述。',
        responseData: {
          scene: 'help',
          summary: '您就按平时说话的方式描述，比如昨天住院了，在瑞金医院，阑尾炎做了手术。我会边听边记。',
        },
      };
    }

    return {
      success: true,
      response: '您可以说我要报案或者查询进度。',
      responseData: {
        scene: 'help',
        summary: '您可以直接说我要报案，也可以说查询进度、还缺什么材料、能赔多少。',
      },
    };
  }

  private buildSummary(context: VoiceSessionContext): string {
    const fields = context.getAllFields();
    const parts: string[] = [];

    if (fields.accident_date) parts.push(`出险时间是${fields.accident_date}`);
    if (fields.accident_reason) parts.push(`原因是${fields.accident_reason}`);
    if (fields.hospital_name) parts.push(`就诊医院是${fields.hospital_name}`);
    if (fields.accident_location) parts.push(`地点是${fields.accident_location}`);
    if (fields.claim_amount) parts.push(`金额大概是${fields.claim_amount}元`);

    return parts.join('，');
  }
}
