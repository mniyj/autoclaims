// 智能理赔微信小程序 - 类型定义
// 从 smartclaim-ai-agent/types.ts 迁移并适配

/**
 * 理赔状态枚举
 */
export enum ClaimStatus {
  REPORTING = 'REPORTING',
  DOCUMENTING = 'DOCUMENTING',
  REVIEWING = 'REVIEWING',
  SETTLED = 'SETTLED',
  PAYING = 'PAYING',
  PAID = 'PAID',
  REJECTED = 'REJECTED'
}

/**
 * 保单信息
 */
export interface Policy {
  id: string;
  insuredName: string;
  type: string;
  validUntil: string;
  validFrom: string;
}

/**
 * 理赔事件
 */
export interface ClaimEvent {
  date: string;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
}

/**
 * 理赔评估结果
 */
export interface ClaimAssessment {
  isLiable: boolean;
  reasoning: string;
  clauseReference?: string;
  items?: { name: string; claimed: number; approved: number; deduction: string }[];
  totalApproved?: number;
  deductible?: number;
  finalAmount?: number;
}

/**
 * 历史理赔记录
 */
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

/**
 * 附件（消息附件）
 */
export interface Attachment {
  base64?: string;
  url?: string;
  ossKey?: string;
  type: string;
  name: string;
  analysis?: DocumentAnalysis;
}

/**
 * 消息反应（点赞/点踩）
 */
export interface MessageReactions {
  liked?: boolean;    // 当前用户是否点赞
  disliked?: boolean; // 当前用户是否点踩
}

/**
 * 消息类型
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'human'; // 增加human类型（理赔员）
  content: string;
  timestamp: number;
  attachments?: Attachment[]; // 支持多个文件
  analysisResults?: Attachment[]; // 结构化分析结果
  claimsList?: HistoricalClaim[];
  reportingChoice?: boolean;
  policySelection?: boolean;
  intentChoice?: boolean;
  policies?: Policy[];
  groundingLinks?: { uri: string; title: string }[];
  reactions?: MessageReactions; // 点赞/点踩状态
}

/**
 * 医疗发票数据
 */
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

  insurancePayment: {
    governmentFundPayment?: number; // 统筹基金支付
    personalPayment?: number; // 个人支付（总计）
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

/**
 * 出院小结数据
 */
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

/**
 * 文档分析结果
 */
export interface DocumentAnalysis {
  category: string;
  isRelevant: boolean;
  relevanceReasoning: string;
  clarityScore: number;
  completenessScore: number;
  summary: string;
  missingFields: string[];
  ocr?: OCRData;
  medicalData?: MedicalInvoiceData;
  dischargeSummaryData?: DischargeSummaryData;
}

/**
 * OCR识别数据
 */
export interface OCRData {
  date?: string;
  amount?: number;
  merchant?: string;
  idNumber?: string;
  name?: string;
  description?: string;
  invoiceNumber?: string;
}

/**
 * 理赔文档
 */
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

/**
 * 支付信息
 */
export interface PaymentInfo {
  status: 'pending' | 'processing' | 'success' | 'failed';
  transactionId?: string;
  bankName?: string;
  accountNumber?: string;
  timestamp?: number;
}

/**
 * 保单条款
 */
export interface PolicyTerm {
  id: string;
  title: string;
  content: string;
  category: string;
}

/**
 * 理赔状态（完整）
 */
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

/**
 * 用户信息（小程序端）
 */
export interface UserInfo {
  openid: string;
  sessionKey?: string;
  unionid?: string;
  nickname?: string;
  avatarUrl?: string;
  gender?: number;
  city?: string;
  province?: string;
  country?: string;
  language?: string;
}
