export enum ClaimStatus {
  REPORTING = "REPORTING",
  DOCUMENTING = "DOCUMENTING",
  REVIEWING = "REVIEWING",
  SETTLED = "SETTLED",
  PAYING = "PAYING",
  PAID = "PAID",
  REJECTED = "REJECTED",
}

export interface Policy {
  id: string;
  policyholderName: string; // 投保人姓名
  insuredName: string; // 被保险人姓名
  type: string;
  validUntil: string;
  validFrom: string;
  productCode?: string;
}

// --- Intake Config Types (mirrored from parent project) ---
export type IntakeFieldType =
  | "text"
  | "date"
  | "time"
  | "number"
  | "textarea"
  | "enum"
  | "enum_with_other"
  | "multi_select"
  | "text_with_search"
  | "boolean";

export interface IntakeField {
  field_id: string;
  label: string;
  type: IntakeFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: { rule: string; error_msg: string };
  follow_up?: { condition: string; extra_fields: string[] };
  data_source?: string;
}

export interface IntakeConfig {
  fields: IntakeField[];
  voice_input: { enabled: boolean; mode: string; slot_filling_prompt?: string };
  claimMaterials?: {
    extraMaterialIds: string[];
    materialOverrides?: Record<
      string,
      { selected: boolean; required: boolean }
    >;
    // 动态材料清单计算配置
    enableDynamicCalculation?: boolean;
    claimItemFieldId?: string;
    accidentCauseFieldId?: string;
  };
}

export interface ClaimEvent {
  date: string;
  label: string;
  description: string;
  status: "completed" | "active" | "pending";
}

export interface ClaimAssessment {
  isLiable: boolean;
  reasoning: string;
  clauseReference?: string;
  items?: {
    name: string;
    claimed: number;
    approved: number;
    deduction: string;
  }[];
  totalApproved?: number;
  deductible?: number;
  finalAmount?: number;
}

export interface HistoricalClaim {
  id: string;
  date: string;
  type: string;
  status: ClaimStatus;
  amount?: number;
  incidentReason?: string;
  insuredName?: string;
  documents?: ClaimDocument[];
  requiredMaterials?: ClaimRequiredMaterial[];
  fileCategories?: ClaimFileCategory[];
  materialUploads?: ClaimMaterialUpload[];
  timeline?: ClaimEvent[];
  assessment?: ClaimAssessment;
}

export interface Attachment {
  base64?: string;
  url?: string;
  ossKey?: string;
  type: string;
  name: string;
  analysis?: DocumentAnalysis;
}

export interface CalculatedMaterial {
  materialId: string;
  materialName: string;
  materialDescription?: string;
  sampleUrl?: string;
  ossKey?: string;
  required: boolean;
  source: string;
  sourceDetails: string;
}

export interface ClaimRequiredMaterial extends CalculatedMaterial {
  uploaded?: boolean;
}

export interface ClaimFileCategory {
  name: string;
  files: {
    name: string;
    url: string;
    ossKey?: string;
  }[];
}

export interface ClaimMaterialUpload {
  materialId: string;
  materialName: string;
  files: {
    name: string;
    url: string;
    ossKey?: string;
  }[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: Attachment[]; // Support multiple files
  analysisResults?: Attachment[]; // Structured analysis results
  claimsList?: HistoricalClaim[];
  reportingChoice?: boolean;
  policySelection?: boolean;
  intentChoice?: boolean;
  policies?: Policy[];
  groundingLinks?: { uri: string; title: string }[];
  calculatedMaterials?: CalculatedMaterial[];
  reportSuccess?: {
    caseNumber: string;
  };
  /** 意图识别结果 */
  intentResult?: {
    intent: IntentType;
    confidence: number;
  };
  /** 工具执行返回的UI组件类型 */
  uiComponent?: UIComponentType;
  /** UI组件所需数据 */
  uiData?: any;
}

export interface MedicalInvoiceData {
  /** 文档类型：summary_invoice=汇总发票, detail_list=明细清单, single_invoice=单张完整发票 */
  documentType?: "summary_invoice" | "detail_list" | "single_invoice";
  basicInfo: {
    admissionDate?: string;
    age: string;
    bedCode?: string;
    department?: string;
    dischargeDate?: string;
    dischargeDiagnosis?: string;
    gender?: string;
    hospitalizationNumber?: string;
    name: string;
    otherInfo?: string;
  };
  chargeItems: {
    itemName: string;
    quantity: number;
    specifications?: string;
    totalPrice: number;
    unitPrice: number;
  }[];
  totalAmount?: number;
  insurancePayment?: {
    governmentFundPayment?: number; // 统筹基金支付
    personalPayment?: number; // 个人支付（总）
    personalSelfPayment?: number; // 个人自付（医保目录范围内由个人承担）
    personalSelfExpense?: number; // 个人自费（医保目录范围外全额自费）
    otherPayment?: number; // 其他支付
    personalAccountPayment?: number; // 个人账户支付
    personalCashPayment?: number; // 个人现金支付
  };
  invoiceInfo?: {
    invoiceCode?: string;
    invoiceNumber?: string;
    verificationCode?: string;
    issueDate?: string;
    hospitalName?: string;
    hospitalType?: string;
  };
  medicalInsurance?: {
    insuranceType?: string;
    insuranceNumber?: string;
    outpatientNumber?: string;
    visitDate?: string;
    businessSerialNumber?: string;
  };
}

export interface DischargeSummaryData {
  document_type: string;
  document_id?: string;
  hospital_info: {
    hospital_name: string;
    department: string;
  };
  patient_info: {
    name: string;
    gender?: string;
    age?: number;
    date_of_birth?: string;
    nationality?: string;
    patient_id?: string;
  };
  admission_details: {
    admission_date: string;
    main_symptoms_on_admission: string;
    admission_condition_summary: string;
    past_medical_history_relevant?: string;
  };
  discharge_details: {
    discharge_date: string;
    hospital_stay_days: number;
    discharge_status: string;
    discharge_destination?: string;
  };
  diagnoses: {
    diagnosis_type: string;
    diagnosis_name: string;
    icd10_code?: string;
    notes?: string;
  }[];
  hospitalization_course_summary: string;
  main_treatments_during_hospitalization?: {
    treatment_name?: string;
    description?: string;
  }[];
  condition_at_discharge: string;
  discharge_instructions: {
    medications?: {
      med_name?: string;
      dosage?: string;
      frequency?: string;
      route?: string;
      duration?: string;
      notes?: string;
    }[];
    lifestyle_recommendations?: string[];
    follow_up_appointments?: {
      date_or_interval?: string;
      department?: string;
      notes?: string;
    }[];
    rehabilitation_advice?: string[];
    precautions_and_warnings?: string[];
    other_instructions?: string[];
  };
  physician_info?: {
    attending_physician?: string;
    resident_physician?: string;
    summary_completion_date?: string;
  };
  notes?: string;
}

export interface DocumentAnalysis {
  category: string;
  isRelevant: boolean;
  relevanceReasoning: string;
  clarityScore: number;
  completenessScore: number;
  summary: string;
  missingFields: string[];
  ocr: OCRData;
  medicalData?: MedicalInvoiceData;
  dischargeSummaryData?: DischargeSummaryData;
}

export interface OCRData {
  date?: string;
  amount?: number;
  merchant?: string;
  idNumber?: string;
  name?: string;
  description?: string;
  invoiceNumber?: string;
}

export interface ClaimDocument {
  id: string;
  name: string;
  type: string;
  status: "pending" | "verified" | "rejected";
  base64?: string;
  url?: string;
  ossKey?: string;
  category?: string;
  ocrData?: OCRData;
  medicalData?: MedicalInvoiceData;
  dischargeSummaryData?: DischargeSummaryData;
  missingFields?: string[];
  analysis?: DocumentAnalysis;
}

export interface PaymentInfo {
  status: "pending" | "processing" | "success" | "failed";
  transactionId?: string;
  bankName?: string;
  accountNumber?: string;
  timestamp?: number;
}

export interface PolicyTerm {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface ClaimState {
  status: ClaimStatus;
  claimant?: {
    userId?: string;
    username?: string;
    companyCode?: string;
  };
  claimOrchestrator?: {
    state: string;
    claimant: {
      userId?: string;
      username?: string;
      companyCode?: string;
    };
    availablePolicies: Policy[];
    selectedPolicy: Policy | null;
    intakeConfig: IntakeConfig | null;
    collectedFields: Record<string, unknown>;
    pendingFieldId: string | null;
    lastResponse?: string;
  };
  incidentType?: string;
  selectedPolicyId?: string;
  reportInfo: {
    time?: string;
    location?: string;
    description?: string;
    policyNumber?: string;
    [key: string]: any;
  };
  requiredDocs: {
    name: string;
    description: string;
    example?: string;
    received: boolean;
    notes?: string;
  }[];
  documents: ClaimDocument[];
  assessment?: ClaimAssessment;
  payment?: PaymentInfo;
  policyTerms?: PolicyTerm[];
  historicalClaims?: HistoricalClaim[];
}

// ============================================================================
// 意图识别相关类型
// ============================================================================

/** 用户意图类型 */
export enum IntentType {
  // ---- 报案类 ----
  /** 新报案 */
  REPORT_NEW_CLAIM = "REPORT_NEW_CLAIM",
  /** 续填报案 */
  RESUME_CLAIM_REPORT = "RESUME_CLAIM_REPORT",
  /** 修改报案信息 */
  MODIFY_CLAIM_REPORT = "MODIFY_CLAIM_REPORT",
  /** 撤销报案 */
  CANCEL_CLAIM = "CANCEL_CLAIM",

  // ---- 材料上传类 ----
  /** 上传理赔材料 */
  UPLOAD_DOCUMENT = "UPLOAD_DOCUMENT",
  /** 补充材料 */
  SUPPLEMENT_DOCUMENT = "SUPPLEMENT_DOCUMENT",
  /** 查看已上传材料 */
  VIEW_UPLOADED_DOCUMENTS = "VIEW_UPLOADED_DOCUMENTS",
  /** 删除/替换材料 */
  REPLACE_DOCUMENT = "REPLACE_DOCUMENT",

  // ---- 查询类 ----
  /** 查询理赔进度 */
  QUERY_PROGRESS = "QUERY_PROGRESS",
  /** 查询理赔材料清单 */
  QUERY_MATERIALS_LIST = "QUERY_MATERIALS_LIST",
  /** 查询缺失材料 */
  QUERY_MISSING_MATERIALS = "QUERY_MISSING_MATERIALS",
  /** 查询保费影响 */
  QUERY_PREMIUM_IMPACT = "QUERY_PREMIUM_IMPACT",
  /** 查询赔付金额 */
  QUERY_SETTLEMENT_AMOUNT = "QUERY_SETTLEMENT_AMOUNT",
  /** 查询赔付明细 */
  QUERY_SETTLEMENT_DETAIL = "QUERY_SETTLEMENT_DETAIL",
  /** 查询保单信息 */
  QUERY_POLICY_INFO = "QUERY_POLICY_INFO",
  /** 查询历史案件 */
  QUERY_CLAIM_HISTORY = "QUERY_CLAIM_HISTORY",
  /** 查询打款状态 */
  QUERY_PAYMENT_STATUS = "QUERY_PAYMENT_STATUS",

  // ---- 协助类 ----
  /** 理赔流程指引 */
  GUIDE_CLAIM_PROCESS = "GUIDE_CLAIM_PROCESS",
  /** 材料拍摄指导 */
  GUIDE_DOCUMENT_PHOTO = "GUIDE_DOCUMENT_PHOTO",
  /** 理赔时效说明 */
  QUERY_CLAIM_TIMELINE = "QUERY_CLAIM_TIMELINE",
  /** 责任范围咨询 */
  QUERY_COVERAGE = "QUERY_COVERAGE",
  /** 常见问题 */
  QUERY_FAQ = "QUERY_FAQ",

  // ---- 沟通类 ----
  /** 转人工客服 */
  TRANSFER_TO_AGENT = "TRANSFER_TO_AGENT",
  /** 投诉/申诉 */
  FILE_COMPLAINT = "FILE_COMPLAINT",
  /** 催办/加急 */
  EXPEDITE_CLAIM = "EXPEDITE_CLAIM",
  /** 留言/备注 */
  LEAVE_MESSAGE = "LEAVE_MESSAGE",

  // ---- 操作类 ----
  /** 修改收款信息 */
  UPDATE_BANK_INFO = "UPDATE_BANK_INFO",
  /** 确认赔付方案 */
  CONFIRM_SETTLEMENT = "CONFIRM_SETTLEMENT",
  /** 拒绝赔付方案 */
  REJECT_SETTLEMENT = "REJECT_SETTLEMENT",
  /** 签署协议/授权 */
  SIGN_AGREEMENT = "SIGN_AGREEMENT",

  // ---- 兜底类 ----
  /** 普通对话 */
  GENERAL_CHAT = "GENERAL_CHAT",
  /** 意图不明 */
  UNCLEAR_INTENT = "UNCLEAR_INTENT",
  /** 超出能力范围 */
  OUT_OF_SCOPE = "OUT_OF_SCOPE",
}

/** 意图识别结果 */
export interface IntentRecognitionResult {
  /** 识别的意图类型 */
  intent: IntentType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 提取的实体参数 */
  entities: IntentEntities;
  /** 原始用户输入 */
  originalText: string;
}

/** 意图实体参数 */
export interface IntentEntities {
  /** 案件ID */
  claimId?: string;
  /** 保单ID */
  policyId?: string;
  /** 理赔类型 */
  claimType?: string;
  /** 产品代码 */
  productCode?: string;
  /** 材料类型 */
  documentType?: string;
  /** 金额 */
  amount?: number;
  /** 银行信息 */
  bankInfo?: { bankName?: string; accountNumber?: string; accountName?: string };
  /** 原因/描述 */
  reason?: string;
  /** 紧急程度 */
  urgency?: string;
  /** 其他参数 */
  [key: string]: any;
}

/** 下一步动作引导 */
export interface NextAction {
  type: 'navigate' | 'form' | 'confirm' | 'upload' | 'none';
  target?: string;
  label: string;
  data?: any;
}

/** 工具调用结果 */
export interface ToolResponse {
  /** 是否执行成功 */
  success: boolean;
  /** 返回数据 */
  data: any;
  /** 给用户的自然语言回复 */
  message: string;
  /** 需要渲染的UI组件类型 */
  uiComponent?: UIComponentType;
  /** UI组件所需数据 */
  uiData?: any;
  /** 引导用户的下一步操作 */
  nextAction?: NextAction;
}

/** UI组件类型 */
export enum UIComponentType {
  // 已有
  /** 理赔进度卡片 */
  CLAIM_PROGRESS = "CLAIM_PROGRESS",
  /** 材料清单 */
  MATERIALS_LIST = "MATERIALS_LIST",
  /** 缺失材料提醒 */
  MISSING_MATERIALS = "MISSING_MATERIALS",
  /** 保费影响说明 */
  PREMIUM_IMPACT = "PREMIUM_IMPACT",

  // 报案类
  /** 报案表单 */
  CLAIM_REPORT_FORM = "CLAIM_REPORT_FORM",

  // 材料类
  /** 材料上传器 */
  DOCUMENT_UPLOADER = "DOCUMENT_UPLOADER",
  /** 已上传材料列表 */
  UPLOADED_DOCUMENTS = "UPLOADED_DOCUMENTS",

  // 查询类扩展
  /** 案件选择 */
  CLAIM_SELECTION = "CLAIM_SELECTION",
  /** 赔付预估 */
  SETTLEMENT_ESTIMATE = "SETTLEMENT_ESTIMATE",
  /** 赔付明细 */
  SETTLEMENT_DETAIL = "SETTLEMENT_DETAIL",
  /** 保单信息 */
  POLICY_INFO = "POLICY_INFO",
  /** 历史理赔 */
  CLAIM_HISTORY = "CLAIM_HISTORY",
  /** 打款状态 */
  PAYMENT_STATUS = "PAYMENT_STATUS",

  // 协助类
  /** 理赔流程指引 */
  PROCESS_GUIDE = "PROCESS_GUIDE",
  /** 材料拍摄指导 */
  PHOTO_GUIDE = "PHOTO_GUIDE",
  /** 时效说明 */
  TIMELINE_INFO = "TIMELINE_INFO",
  /** 保障范围 */
  COVERAGE_INFO = "COVERAGE_INFO",
  /** 常见问题 */
  FAQ_LIST = "FAQ_LIST",

  // 操作类
  /** 银行信息表单 */
  BANK_INFO_FORM = "BANK_INFO_FORM",
  /** 赔付方案确认 */
  SETTLEMENT_CONFIRMATION = "SETTLEMENT_CONFIRMATION",
  /** 投诉/申诉表单 */
  COMPLAINT_FORM = "COMPLAINT_FORM",
  /** 协议签署 */
  AGREEMENT_SIGN = "AGREEMENT_SIGN",

  // 兜底类
  /** 意图澄清 */
  CLARIFICATION = "CLARIFICATION",
}

/** 理赔进度信息 */
export interface ClaimProgressInfo {
  claimId: string;
  status: ClaimStatus;
  statusLabel: string;
  progress: number;
  currentStage: string;
  estimatedCompletion?: string;
  timeline: ClaimEvent[];
}

/** 材料清单信息 */
export interface MaterialsListInfo {
  claimType: string;
  materials: MaterialItem[];
}

/** 单个材料项 */
export interface MaterialItem {
  id: string;
  name: string;
  description: string;
  required: boolean;
  sampleUrl?: string;
  ossKey?: string;
  uploaded: boolean;
  documentId?: string;
}

/** 缺失材料信息 */
export interface MissingMaterialsInfo {
  claimId: string;
  missingItems: MaterialItem[];
  deadline?: string;
  urgency: "low" | "medium" | "high";
}

/** 保费影响信息 */
export interface PremiumImpactInfo {
  currentNCD: number;
  nextYearNCD: number;
  premiumChange: {
    amount: number;
    percentage: number;
    direction: "increase" | "decrease" | "no_change";
  };
  explanation: string;
  suggestions: string[];
}

// ============================================================================
// 新增意图相关数据类型
// ============================================================================

/** 赔付预估信息 */
export interface SettlementEstimateInfo {
  claimId: string;
  claimType: string;
  estimatedAmount: number;
  breakdown: { item: string; amount: number; note?: string }[];
  deductible: number;
  disclaimer: string;
}

/** 赔付明细信息 */
export interface SettlementDetailInfo {
  claimId: string;
  items: { name: string; claimed: number; approved: number; deduction: string }[];
  totalClaimed: number;
  totalApproved: number;
  deductible: number;
  finalAmount: number;
  settledDate?: string;
}

/** 保单信息 */
export interface PolicyInfoData {
  policyId: string;
  policyholderName: string;
  insuredName: string;
  productName: string;
  validFrom: string;
  validUntil: string;
  coverages: { name: string; limit: number; deductible?: number }[];
  status: string;
}

/** 历史理赔记录 */
export interface ClaimHistoryInfo {
  claims: {
    id: string;
    date: string;
    type: string;
    status: ClaimStatus;
    amount?: number;
    statusLabel: string;
  }[];
  totalCount: number;
  totalAmount: number;
}

/** 打款状态信息 */
export interface PaymentStatusInfo {
  claimId: string;
  paymentStatus: "pending" | "processing" | "success" | "failed";
  amount?: number;
  bankName?: string;
  accountTail?: string;
  estimatedDate?: string;
  transactionId?: string;
  completedDate?: string;
}

/** 理赔流程指引 */
export interface ClaimProcessGuideInfo {
  steps: { order: number; title: string; description: string; tips?: string }[];
  currentStep?: number;
}

/** 拍摄指导信息 */
export interface PhotoGuideInfo {
  documentType: string;
  requirements: string[];
  tips: string[];
  sampleImageUrl?: string;
}

/** 理赔时效信息 */
export interface ClaimTimelineInfo {
  stages: { name: string; estimatedDays: string; description: string }[];
  totalEstimatedDays: string;
  note: string;
}

/** 保障范围信息 */
export interface CoverageInfo {
  isInScope: boolean | null;
  coverageItems: { name: string; covered: boolean; limit?: number; note?: string }[];
  exclusions: string[];
  deductible?: number;
  explanation: string;
}

/** FAQ项 */
export interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

/** 已上传材料信息 */
export interface UploadedDocumentsInfo {
  claimId: string;
  documents: {
    id: string;
    name: string;
    category: string;
    uploadDate: string;
    status: "pending" | "verified" | "rejected";
    rejectReason?: string;
  }[];
  totalCount: number;
}
