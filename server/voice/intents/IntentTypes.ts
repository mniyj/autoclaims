/**
 * 意图类型定义
 * Voice Claim System - Intent Types
 */

export enum IntentType {
  // 流程控制意图
  START_CLAIM = 'start_claim',           // 开始报案
  CANCEL = 'cancel',                     // 取消/退出
  CONFIRM = 'confirm',                   // 确认
  REJECT = 'reject',                     // 拒绝/不对
  REPEAT = 'repeat',                     // 重复/再说一遍
  
  // 保单选择意图
  SELECT_POLICY = 'select_policy',       // 选择保单
  SELECT_CLAIM = 'select_claim',         // 选择案件
  QUERY_POLICIES = 'query_policies',     // 查询保单列表
  QUERY_PROGRESS = 'query_progress',     // 查询理赔进度
  QUERY_MATERIALS = 'query_materials',   // 查询材料清单
  QUERY_MISSING_MATERIALS = 'query_missing_materials', // 查询缺失材料
  QUERY_COVERAGE = 'query_coverage',     // 查询保障范围
  QUERY_SETTLEMENT = 'query_settlement', // 查询赔付预估
  
  // 信息提供意图
  PROVIDE_INFO = 'provide_info',           // 提供信息（通用）
  PROVIDE_DATE = 'provide_date',         // 提供日期
  PROVIDE_AMOUNT = 'provide_amount',     // 提供金额
  PROVIDE_HOSPITAL = 'provide_hospital', // 提供医院
  
  // 信息修改意图
  MODIFY_INFO = 'modify_info',           // 修改已提供的信息
  
  // 询问意图
  ASK_HELP = 'ask_help',                 // 寻求帮助
  ASK_EXAMPLE = 'ask_example',           // 询问示例
  
  // 其他
  UNKNOWN = 'unknown',                   // 未知意图
  GREETING = 'greeting',                 // 问候
  SMALL_TALK = 'small_talk',             // 闲聊
}

/**
 * 意图结构
 */
export interface Intent {
  type: IntentType;
  confidence: number;
  entities?: Record<string, any>;  // 提取的实体
  originalText: string;
  conversationGoal?: "collect" | "answer" | "clarify" | "confirm" | "switch_task";
  replyStrategy?: "ack_then_ask" | "ack_then_answer" | "confirm_then_submit" | "handoff";
  missingCriticalFields?: string[];
}

/**
 * 意图识别结果
 */
export interface IntentRecognitionResult {
  intent: IntentType;
  confidence: number;
  entities: Record<string, any>;
  response?: string;
  conversationGoal?: "collect" | "answer" | "clarify" | "confirm" | "switch_task";
  replyStrategy?: "ack_then_ask" | "ack_then_answer" | "confirm_then_submit" | "handoff";
  missingCriticalFields?: string[];
}

/**
 * 意图处理结果
 */
export interface IntentHandlerResult {
  success: boolean;
  response: string;
  shouldTerminate?: boolean;  // 是否终止流程
  newState?: string;          // 新状态
  actions?: Array<{
    type: string;
    payload: any;
  }>;
  responseData?: {
    scene?: string;
    summary?: string;
    askedField?: string;
    answerType?: string;
    acknowledgedFacts?: string[];
    missingFields?: string[];
    nextStep?: string;
  };
}

/**
 * 会话状态类型
 */
export type SessionState = 
  | 'IDLE'
  | 'LOADING_POLICIES'
  | 'LOADING_CLAIMS'
  | 'SELECTING_POLICY'
  | 'SELECTING_CLAIM'
  | 'CONFIRMING_POLICY'
  | 'CONFIRMING_CANCEL'
  | 'LOADING_CONFIG'
  | 'COLLECTING_FIELDS'
  | 'MODIFYING_FIELD'
  | 'CONFIRMING_SUBMISSION'
  | 'SUBMITTING'
  | 'ENDED'
  | 'ERROR';

/**
 * 保单信息结构（用于语音播报）
 */
export interface VoicePolicyInfo {
  index: number;                    // 序号
  policyNumber: string;              // 保单号
  productCode: string;              // 产品代码
  productName: string;              // 产品名称
  companyName: string;              // 保险公司
  policyholderName: string;         // 投保人
  insuredName: string;              // 被保险人
  effectiveDate: string;            // 生效日期
  expiryDate: string;               // 到期日期
  status: string;                  // 状态
}

export interface VoiceClaimInfo {
  index: number;
  claimId: string;
  reportNumber?: string;
  productCode?: string;
  claimType?: string;
  status: string;
  statusLabel: string;
  accidentReason?: string;
  claimAmount?: number;
  submitTime?: string;
  nextStep?: string;
}

/**
 * 报案字段信息
 */
export interface IntakeFieldInfo {
  fieldId: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}
