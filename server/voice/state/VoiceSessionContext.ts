/**
 * 会话上下文管理
 * Voice Session Context - 管理语音报案会话的状态和数据
 */

import type { 
  SessionState, 
  VoicePolicyInfo, 
  IntakeFieldInfo,
  VoiceClaimInfo,
} from '../intents/IntentTypes.js';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface PendingClaimQuery {
  actionType: string;
  responsePrefix?: string;
  payload?: Record<string, any>;
}

export class VoiceSessionContext {
  private currentState: SessionState = 'IDLE';
  private userId: string = '';
  
  // 保单相关
  private availablePolicies: VoicePolicyInfo[] = [];
  private selectedPolicy: VoicePolicyInfo | null = null;
  private availableClaims: VoiceClaimInfo[] = [];
  private selectedClaim: VoiceClaimInfo | null = null;
  private pendingClaimQuery: PendingClaimQuery | null = null;
  
  // 产品配置
  private productIntakeConfig: {
    productName: string;
    fields: IntakeFieldInfo[];
    accidentCauses?: any[];
    claimMaterials?: any;
  } | null = null;
  
  // 收集的数据
  private collectedFields: Record<string, any> = {};
  private fieldModificationPending: string | null = null;
  
  // 取消确认状态
  private cancelPending: boolean = false;
  
  // 对话历史
  private conversationHistory: ConversationMessage[] = [];
  private lastUserGoal: string | null = null;
  private lastAssistantQuestion: string | null = null;
  private conversationPhase: string = 'idle';
  private lastSummary: string | null = null;
  private confirmedSubmissionSnapshot: string | null = null;
  
  // 当前正在询问的字段索引
  private currentFieldIndex: number = 0;
  
  constructor(userId: string = '') {
    this.userId = userId;
  }
  
  // ========== 状态管理 ==========
  
  setState(state: SessionState): void {
    console.log(`[VoiceSessionContext] State: ${this.currentState} -> ${state}`);
    this.currentState = state;
  }
  
  getCurrentState(): SessionState {
    return this.currentState;
  }
  
  // ========== 用户ID ==========
  
  setUserId(userId: string): void {
    this.userId = userId;
  }
  
  getUserId(): string {
    return this.userId;
  }
  
  // ========== 保单管理 ==========
  
  setAvailablePolicies(policies: VoicePolicyInfo[]): void {
    this.availablePolicies = policies;
  }
  
  getAvailablePolicies(): VoicePolicyInfo[] {
    return this.availablePolicies;
  }
  
  setSelectedPolicy(policy: VoicePolicyInfo): void {
    this.selectedPolicy = policy;
  }
  
  getSelectedPolicy(): VoicePolicyInfo | null {
    return this.selectedPolicy;
  }

  setAvailableClaims(claims: VoiceClaimInfo[]): void {
    this.availableClaims = claims;
  }

  getAvailableClaims(): VoiceClaimInfo[] {
    return this.availableClaims;
  }

  setSelectedClaim(claim: VoiceClaimInfo | null): void {
    this.selectedClaim = claim;
  }

  getSelectedClaim(): VoiceClaimInfo | null {
    return this.selectedClaim;
  }

  setPendingClaimQuery(query: PendingClaimQuery | null): void {
    this.pendingClaimQuery = query;
  }

  getPendingClaimQuery(): PendingClaimQuery | null {
    return this.pendingClaimQuery;
  }
  
  // ========== 报案配置 ==========
  
  setIntakeConfig(config: {
    productName: string;
    fields: IntakeFieldInfo[];
    accidentCauses?: any[];
    claimMaterials?: any;
  }): void {
    this.productIntakeConfig = config;
    this.currentFieldIndex = 0;
  }
  
  getIntakeConfig() {
    return this.productIntakeConfig;
  }
  
  // ========== 字段收集 ==========
  
  updateField(fieldId: string, value: any): void {
    this.collectedFields[fieldId] = value;
    console.log(`[VoiceSessionContext] Field updated: ${fieldId} = ${value}`);
  }
  
  getField(fieldId: string): any {
    return this.collectedFields[fieldId];
  }
  
  getAllFields(): Record<string, any> {
    return { ...this.collectedFields };
  }
  
  getMissingRequiredFields(): IntakeFieldInfo[] {
    if (!this.productIntakeConfig) return [];
    
    return this.productIntakeConfig.fields.filter(
      field => field.required && !(field.fieldId in this.collectedFields)
    );
  }
  
  getNextMissingField(): IntakeFieldInfo | null {
    const missing = this.getMissingRequiredFields();
    return missing.length > 0 ? missing[0] : null;
  }
  
  isAllRequiredFieldsFilled(): boolean {
    return this.getMissingRequiredFields().length === 0;
  }
  
  // ========== 字段修改 ==========
  
  markFieldForModification(fieldId: string): void {
    this.fieldModificationPending = fieldId;
  }
  
  getFieldModificationPending(): string | null {
    return this.fieldModificationPending;
  }
  
  clearFieldModificationPending(): void {
    this.fieldModificationPending = null;
  }
  
  // ========== 取消确认 ==========
  
  setCancelPending(pending: boolean): void {
    this.cancelPending = pending;
  }
  
  isCancelPending(): boolean {
    return this.cancelPending;
  }
  
  // ========== 对话历史 ==========
  
  addToHistory(role: ConversationMessage['role'], content: string): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: Date.now()
    });
  }
  
  getHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  getRecentHistory(limit = 6): ConversationMessage[] {
    return this.conversationHistory.slice(-limit);
  }

  setLastUserGoal(goal: string | null): void {
    this.lastUserGoal = goal;
  }

  getLastUserGoal(): string | null {
    return this.lastUserGoal;
  }

  setLastAssistantQuestion(question: string | null): void {
    this.lastAssistantQuestion = question;
  }

  getLastAssistantQuestion(): string | null {
    return this.lastAssistantQuestion;
  }

  setConversationPhase(phase: string): void {
    this.conversationPhase = phase;
  }

  getConversationPhase(): string {
    return this.conversationPhase;
  }

  setLastSummary(summary: string | null): void {
    this.lastSummary = summary;
  }

  getLastSummary(): string | null {
    return this.lastSummary;
  }

  setConfirmedSubmissionSnapshot(snapshot: string | null): void {
    this.confirmedSubmissionSnapshot = snapshot;
  }

  getConfirmedSubmissionSnapshot(): string | null {
    return this.confirmedSubmissionSnapshot;
  }
  
  // ========== 字段索引 ==========
  
  getCurrentFieldIndex(): number {
    return this.currentFieldIndex;
  }
  
  setCurrentFieldIndex(index: number): void {
    this.currentFieldIndex = index;
  }
  
  incrementFieldIndex(): void {
    this.currentFieldIndex++;
  }
  
  // ========== 清理 ==========
  
  clearAll(): void {
    this.currentState = 'IDLE';
    this.availablePolicies = [];
    this.selectedPolicy = null;
    this.availableClaims = [];
    this.selectedClaim = null;
    this.pendingClaimQuery = null;
    this.productIntakeConfig = null;
    this.collectedFields = {};
    this.fieldModificationPending = null;
    this.cancelPending = false;
    this.conversationHistory = [];
    this.lastUserGoal = null;
    this.lastAssistantQuestion = null;
    this.conversationPhase = 'idle';
    this.lastSummary = null;
    this.confirmedSubmissionSnapshot = null;
    this.currentFieldIndex = 0;
    console.log('[VoiceSessionContext] All data cleared');
  }
  
  // ========== 格式化数据（用于提交） ==========
  
  formatForSubmission(): {
    policyNumber: string;
    productCode: string;
    fieldData: Record<string, any>;
  } {
    if (!this.selectedPolicy) {
      throw new Error('No policy selected');
    }
    
    return {
      policyNumber: this.selectedPolicy.policyNumber,
      productCode: this.selectedPolicy.productCode,
      fieldData: this.collectedFields
    };
  }

  getPlanningSnapshot(): Record<string, any> {
    return {
      state: this.currentState,
      selectedPolicy: this.selectedPolicy
        ? {
            policyNumber: this.selectedPolicy.policyNumber,
            productCode: this.selectedPolicy.productCode,
            productName: this.selectedPolicy.productName,
            insuredName: this.selectedPolicy.insuredName,
          }
        : null,
      selectedClaim: this.selectedClaim
        ? {
            claimId: this.selectedClaim.claimId,
            claimType: this.selectedClaim.claimType,
            statusLabel: this.selectedClaim.statusLabel,
            nextStep: this.selectedClaim.nextStep,
          }
        : null,
      collectedFields: this.getAllFields(),
      missingRequiredFields: this.getMissingRequiredFields().map((field) => ({
        fieldId: field.fieldId,
        label: field.label,
        type: field.type,
      })),
      conversationPhase: this.conversationPhase,
      lastUserGoal: this.lastUserGoal,
      lastAssistantQuestion: this.lastAssistantQuestion,
      lastSummary: this.lastSummary,
      confirmedSubmissionSnapshot: this.confirmedSubmissionSnapshot,
      recentHistory: this.getRecentHistory(),
    };
  }
}
