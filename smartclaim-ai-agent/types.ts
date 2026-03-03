
export enum ClaimStatus {
  REPORTING = 'REPORTING',
  DOCUMENTING = 'DOCUMENTING',
  REVIEWING = 'REVIEWING',
  SETTLED = 'SETTLED',
  PAYING = 'PAYING',
  PAID = 'PAID',
  REJECTED = 'REJECTED'
}

export interface Policy {
  id: string;
  insuredName: string;
  type: string;
  validUntil: string;
  validFrom: string;
  productCode?: string;
}

// --- Intake Config Types (mirrored from parent project) ---
export type IntakeFieldType =
  | 'text'
  | 'date'
  | 'time'
  | 'number'
  | 'textarea'
  | 'enum'
  | 'enum_with_other'
  | 'multi_select'
  | 'text_with_search'
  | 'boolean';

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
    materialOverrides?: Record<string, { selected: boolean; required: boolean }>;
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
  status: 'completed' | 'active' | 'pending';
}

export interface ClaimAssessment {
  isLiable: boolean;
  reasoning: string;
  clauseReference?: string;
  items?: { name: string; claimed: number; approved: number; deduction: string }[];
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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
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
  documentType?: 'summary_invoice' | 'detail_list' | 'single_invoice';
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
    governmentFundPayment?: number;  // 统筹基金支付
    personalPayment?: number;        // 个人支付（总）
    personalSelfPayment?: number;    // 个人自付（医保目录范围内由个人承担）
    personalSelfExpense?: number;    // 个人自费（医保目录范围外全额自费）
    otherPayment?: number;           // 其他支付
    personalAccountPayment?: number; // 个人账户支付
    personalCashPayment?: number;    // 个人现金支付
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
  status: 'pending' | 'verified' | 'rejected';
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
  status: 'pending' | 'processing' | 'success' | 'failed';
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
  incidentType?: string;
  selectedPolicyId?: string;
  reportInfo: {
    time?: string;
    location?: string;
    description?: string;
    policyNumber?: string;
    [key: string]: any;
  };
  requiredDocs: { name: string; description: string; example?: string; received: boolean; notes?: string }[];
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
  /** 查询理赔进度 */
  QUERY_PROGRESS = 'QUERY_PROGRESS',
  /** 查询理赔材料清单 */
  QUERY_MATERIALS_LIST = 'QUERY_MATERIALS_LIST',
  /** 查询缺失材料 */
  QUERY_MISSING_MATERIALS = 'QUERY_MISSING_MATERIALS',
  /** 查询保费影响 */
  QUERY_PREMIUM_IMPACT = 'QUERY_PREMIUM_IMPACT',
  /** 普通对话 */
  GENERAL_CHAT = 'GENERAL_CHAT'
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
  /** 其他参数 */
  [key: string]: any;
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
}

/** UI组件类型 */
export enum UIComponentType {
  /** 理赔进度卡片 */
  CLAIM_PROGRESS = 'CLAIM_PROGRESS',
  /** 材料清单 */
  MATERIALS_LIST = 'MATERIALS_LIST',
  /** 缺失材料提醒 */
  MISSING_MATERIALS = 'MISSING_MATERIALS',
  /** 保费影响说明 */
  PREMIUM_IMPACT = 'PREMIUM_IMPACT'
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
  uploaded: boolean;
  documentId?: string;
}

/** 缺失材料信息 */
export interface MissingMaterialsInfo {
  claimId: string;
  missingItems: MaterialItem[];
  deadline?: string;
  urgency: 'low' | 'medium' | 'high';
}

/** 保费影响信息 */
export interface PremiumImpactInfo {
  currentNCD: number;
  nextYearNCD: number;
  premiumChange: {
    amount: number;
    percentage: number;
    direction: 'increase' | 'decrease' | 'no_change';
  };
  explanation: string;
  suggestions: string[];
}
