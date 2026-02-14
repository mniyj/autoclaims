
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
  type: string;
  name: string;
  analysis?: DocumentAnalysis;
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
}

export interface MedicalInvoiceData {
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
    governmentFundPayment?: number;
    personalPayment?: number;
    personalSelfPayment?: number;
    otherPayment?: number;
    personalAccountPayment?: number;
    personalCashPayment?: number;
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
