import type { MaterialCategory } from "./types/material-review";

export enum ProductStatus {
  DRAFT = "草稿",
  ACTIVE = "生效",
  INACTIVE = "失效",
}

export enum PrimaryCategory {
  HEALTH = "医疗保险",
  ACCIDENT = "意外保险",
  CRITICAL_ILLNESS = "重大疾病保险",
  TERM_LIFE = "定期寿险",
  WHOLE_LIFE = "终身寿险",
  ANNUITY = "年金保险",
  CAR_INSURANCE = "车险",
  LIABILITY = "责任保险",
}

export enum ClauseType {
  MAIN = "主险",
  RIDER = "附加险",
}

export interface CoverageItem {
  id: string;
  name: string;
  amount: string;
  details: string;
  mandatory?: boolean;
}

export interface ValueAddedServiceItem {
  id: string;
  name: string;
  description: string;
}

export interface HealthCoverageDetailSpec {
  limit: number;
  deductible: number;
  reimbursement_ratio: number;
  hospital_requirements: string;
  coverage_scope: string;
}

export interface HealthCoverageDetailItem {
  item_code: string;
  item_name: string;
  description: string;
  details: HealthCoverageDetailSpec;
  mandatory?: boolean;
}

export interface CoveragePlanHealth {
  planType: string;
  annualLimit?: number;
  guaranteedRenewalYears?: number;
  coverageDetails: HealthCoverageDetailItem[];
}

export interface CoveragePlanSimple {
  planType: string;
  coverageDetails: CoverageItem[];
}

export type CoveragePlan = CoveragePlanHealth | CoveragePlanSimple;

export interface BaseProduct {
  productCode: string;
  regulatoryName: string;
  marketingName: string;
  companyName: string;
  version: string;
  salesRegions: string;
  effectiveDate: string;
  discontinuationDate: string;
  status: ProductStatus;

  // Legacy Categories (kept for backward compatibility with form logic)
  primaryCategory: PrimaryCategory;
  secondaryCategory: string;

  // New 3-Level Classification (renamed)
  primaryCategoryCode?: string;
  secondaryCategoryCode?: string;
  racewayId?: string;
  racewayName?: string;

  // Alternative 3-Level Classification field names (used by some JSON-stored products)
  categoryLevel3Code?: string;
  categoryLevel3Name?: string;

  salesUrl?: string;
  coverageDetails?: CoverageItem[];
  underwritingAge: string;
  coveragePeriod: string;
  waitingPeriod: string;
  productCardImage?: string;
  productHeroImage?: string;
  productLongImage?: string[];
  productAttachments?: string[];
  productSummary?: string;
  productIntroduction?: string;
  productAdvantages?: string;
  precautions?: string;
  crowd?: string;
  generalComment?: string;
  clausesCode?: string[];
  operator?: string;
  clauseType: ClauseType;

  // New fields for enhanced product card display
  tags?: string[];
  tagStyles?: Record<string, "gold" | "green" | "red" | "gray">;
  promoTag?: string;
  cardMetric1Label?: string;
  cardMetric1Value?: string;
  cardMetric2Label?: string;
  cardMetric2Value?: string;
  cardMetric3Label?: string;
  cardMetric3Value?: string;
  supportsOnlineClaim: boolean;
  isOnline?: boolean;
  intakeConfig?: IntakeConfig;
  intakeConfigUpdatedAt?: string;
  intakeConfigOperator?: string;

  // New file upload fields
  clauseTextFile?: string;
  rateTableFile?: string;
  productDescriptionFile?: string;
  cashValueTableFile?: string;
  basicSumInsuredTableFile?: string;

  // Responsibilities associated with this clause/product
  selectedResponsibilities?: ResponsibilityItem[];
}

export interface HealthAccidentCriticalIllnessProduct extends BaseProduct {
  primaryCategory:
    | PrimaryCategory.HEALTH
    | PrimaryCategory.ACCIDENT
    | PrimaryCategory.CRITICAL_ILLNESS;
  coverageArea: string;
  hospitalScope: string;
  claimScope: string;
  occupationScope: string;
  hesitationPeriod: string;
  policyEffectiveDate: string;
  purchaseLimit: number;
  annualPremium: number;
  valueAddedServices: ValueAddedServiceItem[];
  deductible?: string;
  renewalWarranty?: string;
  outHospitalMedicine?: string;
  healthConditionNotice?: string;
  coveragePlans?: CoveragePlan[];
}

export interface TermLifeProduct extends BaseProduct {
  primaryCategory: PrimaryCategory.TERM_LIFE;
  basicSumAssured: number;
  paymentPeriod: string;
  underwritingOccupation: string;
  coveragePlans?: CoveragePlan[];
}

export interface WholeLifeProduct extends BaseProduct {
  primaryCategory: PrimaryCategory.WHOLE_LIFE;
  paymentFrequency: string;
  paymentPeriod: string;
  paymentMethod?: string;
  coveragePlans?: CoveragePlan[];
}

export interface AnnuityProduct extends BaseProduct {
  primaryCategory: PrimaryCategory.ANNUITY;
  paymentMethod: string;
  paymentPeriod: string;
  payoutFrequency: string;
  payoutStartAge: number;
  underwritingOccupation: string;
  coveragePlans?: CoveragePlan[];
}

export interface CarInsuranceProduct extends BaseProduct {
  primaryCategory: PrimaryCategory.CAR_INSURANCE;
  coveragePlans?: CoveragePlan[];
}

export type InsuranceProduct =
  | HealthAccidentCriticalIllnessProduct
  | TermLifeProduct
  | WholeLifeProduct
  | AnnuityProduct
  | CarInsuranceProduct;

// Type for the clause data fetched from the "database"
export type Clause =
  | Omit<HealthAccidentCriticalIllnessProduct, "marketingName" | "salesUrl">
  | Omit<TermLifeProduct, "marketingName" | "salesUrl">
  | Omit<WholeLifeProduct, "marketingName" | "salesUrl">
  | Omit<AnnuityProduct, "marketingName" | "salesUrl">
  | Omit<CarInsuranceProduct, "marketingName" | "salesUrl">;

// --- START: Types for Strategy Management ---
export interface DecisionRule {
  id: number;
  ageOperator?: string;
  ageValue?: string;
  genderOperator?: string;
  genderValue?: string;
  riskTypeOperator?: string;
  riskTypeValue?: string;
  prodCodeList?: string;
  riskRate?: string;
  cityCodeOperator?: string;
  cityCodeValue?: string;
  rehabilitationCost?: string;
  // Fields for "众民保" table
  isNewPolicy?: string;
  paymentFrequency?: string;
  coverage?: string;
  sumAssured?: string;
  premium?: string;
  criticalIllnessMonths?: string;
  criticalIllnessBaseCost?: string;
  accidentMonths?: string;
}

export interface DecisionTable {
  code: string;
  category: string;
  scene: string;
  name: string;
  primaryKey: string;
  metricLibrary: string;
  deployed: boolean;
  rules: DecisionRule[];
}
// --- END: Types for Strategy Management ---

// --- START: Types for Company Management ---
export interface CompanyBasicInfo {
  companyName: string;
  companyType: string[];
  registeredCapital: {
    value: number;
    unit: "万" | "亿";
  };
  address: string;
  website: string;
}

export interface CompanySolvency {
  rating: string;
  dividendRealizationRate?: string;
  financialInvestmentYield?: {
    annual: number | null;
    recentThreeYears: number;
  };
  comprehensiveInvestmentYield?: {
    annual: number | null;
    recentThreeYears: number;
  };
  comprehensiveSolvencyRatio: number;
  coreSolvencyRatio: number;
  riskRating: string;
  sarmraScore?: number;
  totalAssets: {
    value: number;
    unit: "亿元";
  };
  reportDate: string;
}

export interface CompanyServiceCapability {
  qualityIndex: number;
  complaintsPer10kPolicies: number;
  complaintsPer100mPremium: number;
  complaintsPer10kCustomers: number;
  ratingDate: string;
  complaintDataUpdateDate: string;
}

export interface CompanyBranchDistribution {
  provinces: string[];
}

export interface CompanyShareholder {
  name: string;
  stakePercentage: number;
  type: string;
}

export interface CompanyShareholders {
  note?: string;
  list: CompanyShareholder[];
}

export interface InsuranceCompanyProfile {
  code: string;
  shortName: string;
  hotline: string;
  basicInfo: CompanyBasicInfo;
  solvency: CompanySolvency;
  serviceCapability: CompanyServiceCapability;
  branchDistribution: CompanyBranchDistribution;
  shareholders: CompanyShareholders;
}

export interface CompanyListItem {
  code: string;
  fullName: string;
  shortName: string;
  hotline: string;
  website: string;
  registeredCapital: string;
  status: "生效" | "失效";
}
// --- END: Types for Company Management ---

export interface ResponsibilityItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
}

// --- START: Types for Industry Data Management ---
export interface IndustryData {
  id: string;
  code: string;
  name: string;
  deployed: boolean;
  operator: string;
  operationTime: string;
}

export interface CitySalaryData {
  provinceName: string;
  cityName: string;
  provinceGbCode: string;
  cityGbCode: string;
  avgAnnualSalary: string;
  avgMonthlySalary: string;
  monthlyNursingCost: string;
}

export interface CriticalIllnessRateData {
  age: number;
  gender: string;
  rate: string;
}

export interface AccidentRateData {
  age: number;
  gender: string;
  rate: string;
}

export interface DeathRateData {
  age: number;
  rate: string;
}

export interface HospitalizationRateData {
  age: number;
  gender: string;
  rate: string;
  treatmentCost: string;
  maxCost: string;
  roundingRule: string;
}

export interface OutpatientRateData {
  age: number;
  rate: string;
  avgAnnualVisits: number;
  avgCostPerVisit: number;
  avgAnnualCost: number;
  suggestedSumAssured: number;
}
// --- END: Types for Industry Data Management ---

// --- START: Types for Insurance Type Management ---
export interface InsuranceCategoryMapping {
  antLevel3Code: string;
  antLevel1Name: string;
  antLevel2Name: string;
  antLevel3Name: string;
  regLevel1Code?: string;
  regLevel1Name?: string;
  regLevel2Code?: string;
  regLevel2Name?: string;
  functionCategory: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  isFocus: boolean;
}

export interface CategoryDefinition {
  code: string;
  name: string;
  definition: string;
  features: string;
  function: string;
  audience: string;
  selectionPoints: string;
  coreMetrics: string;
  antLevel1Name?: string;
  // Regulatory & Function Category (Now at Level 2)
  regLevel1Code?: string;
  regLevel1Name?: string;
  regLevel2Code?: string;
  regLevel2Name?: string;
  functionCategory?: string;
  faqList?: FAQItem[];
}

export interface TreeNode {
  key: string;
  title: string;
  level: 1 | 2 | 3;
  children?: TreeNode[];
  data: Partial<CategoryDefinition & InsuranceCategoryMapping>;
  parentKey?: string;
}
// --- END: Types for Insurance Type Management ---

// --- START: Types for End User Data (System Management) ---
// --- START: Types for Claims Management ---
export interface MaterialTypeCatalogItem {
  type_code: string;
  type_name: string;
  category: string;
  description: string;
  default_processing_strategy: ProcessingStrategy;
  default_confidence_threshold: number;
  recommended_facts: string[];
  status: "ACTIVE" | "DRAFT" | "DISABLED";
  _source_material_id?: string;
}

export type SchemaFieldBindingStatus = "bound" | "display_only";

export interface ClaimsMaterialSchemaField {
  field_key: string;
  field_label: string;
  data_type: "STRING" | "NUMBER" | "BOOLEAN" | "DATE" | "ARRAY" | "OBJECT";
  required?: boolean;
  description?: string;
  fact_id?: string;
  binding_status?: SchemaFieldBindingStatus;
  children?: ClaimsMaterialSchemaField[];
  item_fields?: ClaimsMaterialSchemaField[];
}

export interface ClaimsMaterial {
  id: string;
  name: string;
  description: string;
  type_code?: string;
  sampleUrl?: string;
  ossKey?: string; // OSS object key for generating fresh signed URLs
  jsonSchema: string; // JSON string representing the schema to extract
  aiAuditPrompt?: string;
  confidenceThreshold?: number; // 转人工置信度阈值 [0, 1]，低于此值需人工复核，默认 0.9
  category?: MaterialCategory;
  processingStrategy?: ProcessingStrategy;
  extractionConfig?: ExtractionConfig;
  schemaFields?: ClaimsMaterialSchemaField[];
}

export type MaterialValidationOperator =
  | "EQ"
  | "NE"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "PERCENT_DIFF_LTE"
  | "DATE_BEFORE_NOW";
export type MaterialValidationFailureAction =
  | "WARNING"
  | "MANUAL_REVIEW"
  | "BLOCK";

export interface MaterialFieldRef {
  material_id: string;
  material_name?: string;
  fact_id: string;
  field_key: string;
  field_label?: string;
}

export interface MaterialValidationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  category:
    | "identity"
    | "amount_consistency"
    | "date_consistency"
    | "timeline"
    | "custom";
  left: MaterialFieldRef;
  operator: MaterialValidationOperator;
  right: MaterialFieldRef;
  failure_action: MaterialValidationFailureAction;
  severity: "info" | "warning" | "error";
  reason_code: string;
  message_template: string;
  output_fact_id?: string;
  /** 操作符参数，如 PERCENT_DIFF_LTE 的阈值 */
  params?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Processing and extraction related types for claims materials
export type ProcessingStrategy =
  | "invoice"
  | "structured_doc"
  | "general_doc"
  | "image_only";

export interface ExtractionConfig {
  jsonSchema: Record<string, any>;
  aiAuditPrompt: string;
  validationRules?: ValidationRule[];
}

export interface ClassificationResult {
  materialId?: string;
  name?: string;
  category?: MaterialCategory;
  confidence?: number;
}

export interface AiClassification {
  results?: ClassificationResult[];
  overallConfidence?: number;
  details?: string;
}

export interface MaterialAuditConclusion {
  checklist?: AuditChecklistItem[];
  issues?: AuditIssue[];
  classification?: AiClassification;
  timestamp?: string;
  summary?: string;
}

export interface AuditChecklistItem {
  id?: string;
  text: string;
  passed?: boolean;
  details?: string;
}

export interface AuditIssue {
  id?: string;
  code?: string;
  description: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  relatedItemId?: string;
}

export interface ClaimItem {
  id: string;
  name: string;
  description: string;
  materialIds: string[]; // IDs of ClaimsMaterial associated with this claim item
  materialRequiredMap?: Record<string, boolean>; // per-context required override: materialId → isRequired
  responsibilityIds?: string[];
}

export interface ProductClaimConfig {
  productCode: string;
  responsibilityConfigs: ResponsibilityClaimConfig[];
}

export interface ResponsibilityClaimConfig {
  responsibilityId: string;
  claimItemIds: string[]; // IDs of ClaimItem associated with this responsibility
}

// 险种通用索赔材料配置
export interface CategoryMaterialConfig {
  categoryCode: string; // 三级险种代码，如 'C0101' (成人综合意外)
  categoryName: string; // 三级险种名称，如 '成人综合意外'
  materialIds: string[]; // 通用索赔材料ID列表
  materialRequiredMap?: Record<string, boolean>; // per-context required override: materialId → isRequired
  updatedAt?: string;
  updatedBy?: string;
}

// 事故原因及索赔材料关联配置
export interface AccidentCauseMaterialConfig {
  id: string; // 唯一ID，如 'cause-1'
  name: string; // 事故原因名称，如 '交通事故'
  description?: string; // 可选说明
  materialIds: string[]; // 关联的索赔材料ID列表
  materialRequiredMap?: Record<string, boolean>; // materialId → isRequired
  updatedAt?: string;
}

export enum ClaimStatus {
  REPORTED = "已报案",
  PROCESSING = "处理中",
  PENDING_INFO = "待补传",
  APPROVED = "已结案-给付",
  REJECTED = "已结案-拒赔",
  CANCELLED = "已撤案",
}

export interface ClaimCalculationItem {
  id: string;
  type: string;
  fileName: string;
  date: string;
  item: string;
  amount: number;
  claimAmount: number;
  basis: string;
}

export interface ClaimFileCategory {
  name: string;
  files: { name: string; url: string; ossKey?: string }[];
}

export interface ClaimRiskIndicator {
  type: "danger" | "warning";
  title: string;
  description: string;
}

export interface ClaimCase {
  id: string;
  reportNumber: string;
  reporter: string;
  reportTime: string;
  accidentTime: string;
  accidentReason: string;
  accidentLocation?: string;
  claimAmount: number;
  approvedAmount?: number;
  productCode: string;
  productName: string;
  status: ClaimStatus;
  operator: string;

  // Detailed fields
  policyholder?: string;
  insured?: string;
  policyPeriod?: string;
  policyNumber?: string;
  calculationItems?: ClaimCalculationItem[];
  fileCategories?: ClaimFileCategory[];
  risks?: ClaimRiskIndicator[];

  // 动态材料清单相关字段
  selectedClaimItems?: string[]; // 用户选择的索赔项目IDs
  selectedAccidentCauseId?: string; // 用户选择的事故原因ID（可能是预设或自定义）
  requiredMaterials?: Array<{
    materialId: string;
    materialName: string;
    materialDescription?: string;
    required: boolean;
    source: string; // 'category' | 'claim_item' | 'accident_cause' | 'extra'
    sourceDetails: string;
    uploaded?: boolean; // 是否已上传
  }>;
  intakeFormData?: Record<string, any>; // 报案表单原始数据

  // 文件解析结果存储（键：分类名-文件名，值：解析结果）
  fileParseResults?: Record<
    string,
    {
      extractedData: Record<string, any>;
      auditConclusion?: string;
      confidence?: number;
      materialName: string;
      materialId?: string;
      parsedAt: string;
    }
  >;
  acceptedAt?: string;
  acceptedBy?: "system" | "manual";
  parsedAt?: string;
  parsedBy?: "system" | "manual";
  liabilityCompletedAt?: string;
  liabilityCompletedBy?: "system" | "manual";
  liabilityDecision?: string;
  assessmentCompletedAt?: string;
  assessmentCompletedBy?: "system" | "manual";
  assessmentDecision?: string;
  latestReviewSnapshot?: {
    updatedAt: string;
    decision?: "APPROVE" | "REJECT" | "MANUAL_REVIEW";
    amount?: number | null;
    payableAmount?: number | null;
    intakeDecision?: string;
    liabilityDecision?: string;
    assessmentDecision?: string;
    settlementDecision?: string;
    missingMaterials?: string[];
    preExistingAssessment?: {
      result: "YES" | "NO" | "UNCERTAIN" | "SKIPPED";
      confidence?: number | null;
      reasoning?: string;
      uncertainResolution?: {
        action?: "MANUAL_REVIEW" | "ASSUME_FALSE" | null;
        matchedRule?: {
          when?: {
            product_line?: string;
            claim_scenario?: string;
            max_claim_amount?: number | null;
          };
          action?: "MANUAL_REVIEW" | "ASSUME_FALSE" | null;
        } | null;
        productLine?: string | null;
        claimScenario?: string | null;
        claimAmount?: number | null;
      } | null;
    };
    coverageResults?: Array<{
      coverageCode: string;
      claimedAmount: number;
      approvedAmount: number;
      reimbursementRatio?: number | null;
      sumInsured?: number | null;
      status?: string;
    }>;
  };
}
// --- END: Types for Claims Management ---

// --- START: Types for Offline Material Import ---
export interface ProcessedFile {
  documentId: string;
  fileName: string;
  fileType: string;
  ossUrl?: string;
  ossKey?: string;
  extractedText?: string;
  structuredData?: Record<string, unknown>;
  classification: {
    materialId: string;
    materialName: string;
    confidence: number;
    source?: "ai" | "manual";
    errorMessage?: string;
    matchStrategy?: "rule" | "ai" | "fallback";
  };
  status: "processing" | "completed" | "failed";
  errorMessage?: string;
}

export interface CompletenessResult {
  isComplete: boolean;
  score: number;
  requiredMaterials: string[];
  providedMaterials: string[];
  missingMaterials: string[];
  warnings: string[];
}

export interface OfflineMaterialImportResult {
  success: boolean;
  importedFiles: ProcessedFile[];
  completeness: CompletenessResult;
  warnings: string[];
  summary?: string;
}
// Batch operation types for batch OSS upload and classification
export interface BatchOSSUploadRequest {
  batchId?: string;
  claimCaseId?: string;
  ossKeys: string[];
  productCode?: string;
  importedAt?: string;
}

export interface BatchOSSUploadResponse {
  batchId: string;
  uploadedCount: number;
  failedCount?: number;
  errors?: { ossKey: string; reason?: string }[];
  timestamp?: string;
}

export interface BatchClassifyRequest {
  batchId: string;
  materialIds?: string[];
  strategy?: "fast" | "accurate";
}

export interface BatchClassifyResponse {
  batchId: string;
  results: Array<{
    materialId: string;
    materialName?: string;
    category?: string;
    confidence?: number;
  }>;
  completedAt?: string;
  errors?: { materialId?: string; error: string }[];
}

// Core: Batch Material Import Task V2
export interface MaterialImportTaskV2 {
  id: string;
  claimCaseId?: string;
  batchId: string;
  ossKeys: string[];
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: string;
  updatedAt?: string;
  summary?: string;
  processedCount?: number;
  errors?: string[];
}

// --- END: Types for Offline Material Import ---

// --- START: Types for Unified Claim Materials ---
/**
 * 材料来源类型
 * - claim_report: 报案端上传（客户报案时提交）
 * - direct_upload: 管理员手动上传（后台案件信息页）
 * - batch_import: 批量导入（材料审核页）
 * - api_sync: API 同步导入
 */
export type ClaimMaterialSource =
  | "claim_report"
  | "direct_upload"
  | "batch_import"
  | "api_sync";

/**
 * 材料状态
 */
export type ClaimMaterialStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/**
 * 统一的理赔材料记录
 * 合并 fileCategories 和 claim-documents 的数据结构
 */
export interface ClaimMaterial {
  // 核心标识
  id: string;
  claimCaseId: string;

  // 文件信息
  fileName: string;
  fileType: string;
  fileSize?: number;
  url: string;
  ossKey?: string;
  ossUrlExpiresAt?: string;

  // 分类信息
  category?: string;
  materialId?: string;
  materialName?: string;
  classificationError?: string;

  // AI 解析结果
  extractedData?: Record<string, any>;
  auditConclusion?: string;
  confidence?: number;
  documentSummary?: AnyDocumentSummary;
  fieldCorrections?: FieldCorrection[];

  // 来源追踪
  source: ClaimMaterialSource;
  sourceDetail?: {
    importId?: string;
    importedAt?: string;
    taskId?: string;
  };

  // 状态
  status: ClaimMaterialStatus;
  uploadedAt: string;
  processedAt?: string;

  // 元数据
  metadata?: {
    duplicateWarning?: { message: string; similarity: number };
    parseVersion?: string;
    ocrEngine?: string;
  };
}

/**
 * ClaimMaterials API 响应
 */
export interface ClaimMaterialsResponse {
  claimCaseId: string;
  materials: ClaimMaterial[];
  total: number;
  bySource: Record<ClaimMaterialSource, number>;
}
// --- END: Types for Unified Claim Materials ---

export interface EndUser {
  id: string;
  name: string;
  age: number;
  city: string;
  monthlyIncome: number;
  familyMembers: string; // e.g., "配偶, 子女(2)"
  familyMemberCount: number; // for stats
  gaps: {
    accident: number;
    medical: number;
    criticalIllness: number;
    termLife: number;
    annuity: number;
    education: number;
  };
  submissionTime: string;
  channel: string;
}
// --- END: Types for End User Data ---

// --- START: Types for Claim Intake Configuration ---
export interface IntakeValidation {
  rule: string;
  error_msg: string;
}

export interface IntakeFollowUp {
  condition: string;
  extra_fields: string[];
}

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
  validation?: IntakeValidation;
  follow_up?: IntakeFollowUp;
  data_source?: string;
  voice_slot_enabled?: boolean;
}

export interface IntakeVoiceInput {
  enabled: boolean;
  mode: "realtime_or_record";
  slot_filling_prompt?: string;
}

export interface IntakeConfig {
  product_type?: string;
  config_version?: string;
  fields: IntakeField[];
  voice_input: IntakeVoiceInput;
  claimMaterials?: {
    extraMaterialIds: string[]; // Legacy: selected material IDs for backward compat
    materialOverrides?: Record<
      string,
      { selected: boolean; required: boolean }
    >; // Per-material selection and required flag
    // 动态材料清单计算配置
    enableDynamicCalculation?: boolean; // 是否启用动态计算
    claimItemFieldId?: string; // 索赔项目字段ID，默认 'claim_item'
    accidentCauseFieldId?: string; // 事故原因字段ID，默认 'accident_reason'
  };
  // 事故原因配置：报案时可选的事故原因列表
  accidentCauses?: Array<{
    id: string; // 预设原因使用 AccidentCauseMaterialConfig.id，自定义原因使用 'custom-' 前缀
    name: string;
    isCustom?: boolean; // true = 用户手动添加，非预设
  }>;
  // 索赔项目列表：该产品关联的所有条款下关联的所有责任下关联的所有索赔项目
  claimItems?: Array<{
    id: string; // 索赔项目ID
    name: string; // 索赔项目名称
    responsibilityId: string; // 所属责任ID
    responsibilityName: string; // 所属责任名称
    selected: boolean; // 是否启用
  }>;
}
// --- END: Types for Claim Intake Configuration ---

// --- START: Types for Ruleset Management ---
export enum RulesetProductLine {
  ACCIDENT = "ACCIDENT",
  HEALTH = "HEALTH",
  CRITICAL_ILLNESS = "CRITICAL_ILLNESS",
  TERM_LIFE = "TERM_LIFE",
  WHOLE_LIFE = "WHOLE_LIFE",
  ANNUITY = "ANNUITY",
  AUTO = "AUTO",
  LIABILITY = "LIABILITY",
}

export enum ExecutionDomain {
  ELIGIBILITY = "ELIGIBILITY",
  ASSESSMENT = "ASSESSMENT",
  POST_PROCESS = "POST_PROCESS",
}

export enum RuleStatus {
  EFFECTIVE = "EFFECTIVE",
  DISABLED = "DISABLED",
  DRAFT = "DRAFT",
}

export enum RuleActionType {
  APPROVE_CLAIM = "APPROVE_CLAIM",
  REJECT_CLAIM = "REJECT_CLAIM",
  SET_CLAIM_RATIO = "SET_CLAIM_RATIO",
  ROUTE_CLAIM_MANUAL = "ROUTE_CLAIM_MANUAL",
  FLAG_FRAUD = "FLAG_FRAUD",
  TERMINATE_CONTRACT = "TERMINATE_CONTRACT",
  APPROVE_ITEM = "APPROVE_ITEM",
  REJECT_ITEM = "REJECT_ITEM",
  ADJUST_ITEM_AMOUNT = "ADJUST_ITEM_AMOUNT",
  SET_ITEM_RATIO = "SET_ITEM_RATIO",
  FLAG_ITEM = "FLAG_ITEM",
  APPLY_FORMULA = "APPLY_FORMULA",
  APPLY_CAP = "APPLY_CAP",
  APPLY_DEDUCTIBLE = "APPLY_DEDUCTIBLE",
  SUM_COVERAGES = "SUM_COVERAGES",
  DEDUCT_PRIOR_BENEFIT = "DEDUCT_PRIOR_BENEFIT",
  ADD_REMARK = "ADD_REMARK",
}

export enum RuleCategory {
  COVERAGE_SCOPE = "COVERAGE_SCOPE",
  EXCLUSION = "EXCLUSION",
  WAITING_PERIOD = "WAITING_PERIOD",
  CLAIM_TIMELINE = "CLAIM_TIMELINE",
  COVERAGE_PERIOD = "COVERAGE_PERIOD",
  POLICY_STATUS = "POLICY_STATUS",
  ITEM_CLASSIFICATION = "ITEM_CLASSIFICATION",
  PRICING_REASONABILITY = "PRICING_REASONABILITY",
  DISABILITY_ASSESSMENT = "DISABILITY_ASSESSMENT",
  DEPRECIATION = "DEPRECIATION",
  PROPORTIONAL_LIABILITY = "PROPORTIONAL_LIABILITY",
  DEDUCTIBLE = "DEDUCTIBLE",
  SUB_LIMIT = "SUB_LIMIT",
  SOCIAL_INSURANCE = "SOCIAL_INSURANCE",
  BENEFIT_OFFSET = "BENEFIT_OFFSET",
  AGGREGATE_CAP = "AGGREGATE_CAP",
  POST_ADJUSTMENT = "POST_ADJUSTMENT",
}

export enum RuleKind {
  GATE = "GATE",
  TRIGGER = "TRIGGER",
  EXCLUSION = "EXCLUSION",
  ADJUSTMENT = "ADJUSTMENT",
  BENEFIT = "BENEFIT",
  ITEM_ELIGIBILITY = "ITEM_ELIGIBILITY",
  ITEM_RATIO = "ITEM_RATIO",
  ITEM_PRICING = "ITEM_PRICING",
  ITEM_CAP = "ITEM_CAP",
  ITEM_FLAG = "ITEM_FLAG",
  POST_PROCESS = "POST_PROCESS",
}

export enum ConditionOperator {
  EQ = "EQ",
  NE = "NE",
  GT = "GT",
  GTE = "GTE",
  LT = "LT",
  LTE = "LTE",
  IN = "IN",
  NOT_IN = "NOT_IN",
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
  STARTS_WITH = "STARTS_WITH",
  BETWEEN = "BETWEEN",
  IS_NULL = "IS_NULL",
  IS_NOT_NULL = "IS_NOT_NULL",
  IS_TRUE = "IS_TRUE",
  IS_FALSE = "IS_FALSE",
  MATCHES_REGEX = "MATCHES_REGEX",
}

export enum ConditionLogic {
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  ALWAYS_TRUE = "ALWAYS_TRUE",
}

export interface LeafCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[] | null;
  value_unit?: string;
}

export interface GroupCondition {
  logic: "AND" | "OR" | "NOT";
  expressions: (LeafCondition | GroupCondition)[];
}

export interface RuleConditions {
  logic: ConditionLogic;
  expressions: (LeafCondition | GroupCondition)[];
}

export interface RuleActionParams {
  reject_reason_code?: string;
  payout_ratio?: number;
  fraud_risk_score?: number;
  route_reason?: string;
  reduction_ratio?: number;
  pricing_reference?: {
    source: string;
    tolerance_percent: number;
  };
  formula?: {
    expression: string;
    output_field: string;
  };
  cap_field?: string;
  cap_amount?: number;
  deductible_amount?: number;
  remark_template?: string;
  social_insurance_ratio?: number;
  non_social_insurance_ratio?: number;
  disability_grade_table?: { grade: number; payout_ratio: number }[];
  depreciation_table?: {
    age_from_months: number;
    age_to_months: number;
    monthly_rate_percent: number;
  }[];
}

export interface RuleExecution {
  domain: ExecutionDomain;
  loop_over: string | null;
  item_alias: string | null;
  item_action_on_reject: "ZERO_AMOUNT" | "SKIP_ITEM" | "FLAG_ITEM" | null;
}

export interface RuleSource {
  source_type: "CLAUSE" | "POLICY" | "REGULATION" | "AI_GENERATED" | "MANUAL";
  source_ref: string;
  clause_code: string | null;
  source_text: string;
}

export interface RulePriority {
  level: 1 | 2 | 3 | 4;
  rank: number;
}

export interface RuleAction {
  action_type: RuleActionType;
  params: RuleActionParams;
}

export interface ParsingConfidence {
  overall: number;
  condition_confidence: number;
  action_confidence: number;
  needs_human_review: boolean;
  review_hints?: string[];
}

export interface RulesetRule {
  rule_id: string;
  rule_name: string;
  description?: string;
  category: string;
  rule_kind?: RuleKind;
  applies_to?: {
    coverage_codes?: string[];
  };
  tags?: string[];
  status: RuleStatus;
  execution: RuleExecution;
  source: RuleSource;
  priority: RulePriority;
  conditions: RuleConditions;
  action: RuleAction;
  parsing_confidence?: ParsingConfidence;
}

export interface DomainConfig {
  domain: string;
  label: string;
  execution_mode: string;
  input_granularity?: string;
  loop_collection?: string;
  short_circuit_on?: string[];
  semantic_sequence?: string[];
  category_sequence: string[];
}

export interface ExecutionPipeline {
  domains: DomainConfig[];
}

export interface OverrideChain {
  chain_id: string;
  topic: string;
  conflict_type: string;
  affected_domain?: string;
  effective_rule_id: string;
  chain: {
    rule_id: string;
    priority_level: number;
    summary: string;
    status: string;
  }[];
}

export interface FieldDefinition {
  label: string;
  data_type: string;
  scope: string;
  source: string;
  applicable_domains: string[];
  enum_values?: { code: string; label: string }[];
  source_type?: "material" | "derived" | "system" | "manual";
  source_refs?: string[];
  derivation?: string;
  required_evidence?: boolean;
}

export interface FactMappingDefinition {
  id: string;
  fact_field: string;
  source_type: "material" | "derived" | "system" | "manual";
  material_id?: string;
  material_name?: string;
  schema_path?: string;
  source_label?: string;
  transform?: string;
  notes?: string;
}

export interface FactCatalogField extends FieldDefinition {
  fact_id: string;
  description?: string;
  status?: "ACTIVE" | "DRAFT" | "DISABLED";
  system_source?: string;
  allowed_material_ids?: string[];
  allowed_material_categories?: string[];
}

export interface RulesetPolicyInfo {
  policy_no: string;
  product_code: string;
  product_name: string;
  insurer: string;
  effective_date: string;
  expiry_date: string;
  coverages: {
    coverage_code: string;
    coverage_name: string;
    sum_insured: number;
    deductible: number;
    co_pay_ratio: number;
  }[];
}

export interface RulesetMetadata {
  schema_version: string;
  version: string;
  generated_at: string;
  generated_by: "AI_PARSING" | "MANUAL_ENTRY" | "HYBRID";
  ai_model?: string;
  total_rules: number;
  rules_by_domain?: {
    eligibility: number;
    assessment: number;
    post_process: number;
  };
  low_confidence_rules?: number;
  unresolved_conflicts?: number;
  published_at?: string;
  published_by?: string;
  latest_validation?: {
    status: "passed" | "warning" | "error";
    validated_at: string;
    issue_count: number;
    summary?: string;
  };
  audit_trail?: {
    timestamp: string;
    user_id: string;
    action: string;
    details?: string;
  }[];
}

export interface RulesetBinding {
  product_codes: string[];
  category_match: {
    primary: string[];
    secondary: string[];
  };
  keywords: string[];
  match_priority: number;
}

export interface CoverageInferenceRule {
  coverage_code: string;
  label: string;
  condition: RuleConditions;
}

export interface CoverageInference {
  rules: CoverageInferenceRule[];
  default_coverage_code: string | null;
  default_label: string | null;
}

export type PreProcessorType =
  | "PRE_EXISTING_CONDITION"
  | "FIELD_CASCADE"
  | "COVERAGE_ALIAS_RESOLVE";

export type PreExistingConditionUncertainAction =
  | "MANUAL_REVIEW"
  | "ASSUME_FALSE";

export interface PreExistingConditionUncertainRule {
  when?: {
    product_line?: string;
    claim_scenario?: string;
    max_claim_amount?: number | null;
  };
  action: PreExistingConditionUncertainAction;
}

export interface PreExistingConditionProcessorConfig {
  skip_when?: {
    field?: string;
    operator?: string;
    value?: unknown;
  };
  output_field?: string;
  on_yes?: boolean | null;
  on_no?: boolean | null;
  on_uncertain?: boolean | null;
  uncertain_resolution?: {
    default?: PreExistingConditionUncertainAction;
    rules?: PreExistingConditionUncertainRule[];
  };
}

export interface PreProcessorConfig {
  processor_id: string;
  type: PreProcessorType;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface InsuranceRuleset {
  ruleset_id: string;
  product_line: RulesetProductLine;
  policy_info: RulesetPolicyInfo;
  rules: RulesetRule[];
  execution_pipeline: ExecutionPipeline;
  override_chains: OverrideChain[];
  field_dictionary: Record<string, FieldDefinition>;
  field_mappings?: FactMappingDefinition[];
  metadata: RulesetMetadata;
  binding?: RulesetBinding;
  coverage_inference?: CoverageInference;
  pre_processors?: PreProcessorConfig[];
}
// --- END: Types for Ruleset Management ---

// --- START: Types for Medical Invoice Audit & Insurance Catalog ---
// Import MedicalInvoiceData from smartclaim-ai-agent
import type { MedicalInvoiceData } from "./smartclaim-ai-agent/types";

// 医保目录相关类型
export interface MedicalInsuranceCatalogItem {
  id: string;
  province: string; // 省份代码，如 "beijing", "shanghai", "national"（国家目录）
  category: "drug" | "treatment" | "material"; // 药品/诊疗项目/耗材
  code: string; // 医保编码
  name: string; // 标准名称（通用名）
  type: "A" | "B" | "C" | "excluded"; // 甲乙丙类或不在目录
  reimbursementRatio?: number; // 报销比例（0-100）
  restrictions?: string; // 使用限制说明
  effectiveDate: string; // 生效日期
  expiryDate?: string; // 失效日期

  // 名称兼容化字段 - 用于处理发票名称与目录名称不一致
  aliases?: string[]; // 别名列表（商品名、曾用名、常见缩写等）
  genericName?: string; // 药品通用名（国际非专利药名对应的中文名）
  specifications?: string; // 规格型号
  dosageForm?: string; // 剂型
  manufacturer?: string; // 生产厂家
}

// 医院等级数据
export interface HospitalInfo {
  id: string;
  name: string; // 医院名称
  province: string;
  city: string;
  level:
    | "三级甲等"
    | "三级乙等"
    | "二级甲等"
    | "二级乙等"
    | "一级"
    | "未定级"
    | "民营";
  type: "公立" | "民营";
  address?: string;
  qualifiedForInsurance: boolean; // 是否符合保险理赔要求（公立二级及以上）
}

// 增加 AI 交互日志类型定义
export interface AIInteractionLog {
  model: string;
  provider?: string;
  capabilityId?: string;
  group?: string;
  promptTemplateId?: string;
  promptSourceType?: string;
  prompt: string;
  response: string;
  duration: number;
  timestamp: string;
  usageMetadata?: any;
  pricingRuleId?: string | null;
  estimatedCost?: number | null;
  request?: {
    raw?: any;
    summary?: {
      systemInstruction?: string | null;
      promptText?: string | null;
      attachmentSummary?: Array<Record<string, any>>;
      tools?: any;
      toolConfig?: any;
      generationConfig?: any;
    } | null;
  };
  rawResponse?: {
    raw?: any;
    text?: string | null;
    finishReason?: string | null;
    toolCalls?: any;
    grounding?: any;
  } | null;
  context?: Record<string, any>;
  tokenUsage?: AIUsageRecord & {
    rawUsageMetadata?: any;
    unavailableReason?: string | null;
  };
  fallbackInfo?: {
    from: string;
    reason: string;
  } | null;
  timing?: {
    ocrDuration?: number; // OCR 识别耗时 (ms)
    parsingDuration?: number; // 大模型格式化耗时 (ms)
    totalDuration?: number; // 总耗时 (ms)
  };
  errorMessage?: string; // 错误信息（如果失败）
  statusCode?: number; // HTTP 状态码
}

export interface AIProviderCatalogItem {
  id: string;
  name: string;
  type: string;
  runtime: string;
  defaultModel: string;
  availableModels?: string[];
  supportsCustomModel: boolean;
  envKeys?: string[];
  description?: string;
  available?: boolean;
  missingEnvKeys?: string[];
  status?: "active" | "degraded" | "offline";
  healthCheckMode?: string;
  billingMode?: "token" | "request" | "page" | "second";
  rateLimitRpm?: number;
  defaultTimeout?: number;
  retryStrategy?: {
    maxRetries: number;
    backoffMs: number;
  };
  lastHealthCheck?: {
    timestamp: string;
    latencyMs: number;
    success: boolean;
  };
}

export interface AIPromptSourceInfo {
  type: string;
  promptTemplateId?: string | null;
  secondaryPromptTemplateId?: string | null;
  editable: boolean;
}

export interface AIPromptVariable {
  name: string;
  type: "string" | "number" | "object" | "array" | "boolean";
  description: string;
  example: string;
  required: boolean;
  source: "claim_case" | "policy" | "document" | "system";
}

export interface CapabilityVariableContext {
  templateId: string;
  variables: AIPromptVariable[];
}

export interface AIPromptTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  templateEngine?: "plain" | "jinja2";
  variables?: AIPromptVariable[];
  /** @deprecated use variables instead */
  requiredVariables?: string[];
}

export interface AICapabilityBinding {
  provider: string;
  model: string;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
}

export interface AICapabilityFallbackBinding {
  provider: string;
  model?: string;
}

export interface AICapabilityDefinition {
  id: string;
  name: string;
  group: string;
  description?: string;
  binding: AICapabilityBinding;
  currentProvider?: string;
  currentModel?: string;
  supportedProviders: string[];
  promptSourceType: string;
  promptTemplateId?: string | null;
  secondaryPromptTemplateId?: string | null;
  editable?: boolean;
  lockReason?: string;
  codeLocations?: string[];
  owner?: string;
  fallbackBindings?: AICapabilityFallbackBinding[];
  supportMatrix?: Array<{
    providerId: string;
    providerName: string;
    available: boolean;
    missingEnvKeys?: string[];
    supportsCustomModel?: boolean;
    defaultModel?: string | null;
  }>;
  promptSource?: AIPromptSourceInfo;
  providerAvailable?: boolean;
  providerMissingEnvKeys?: string[];
}

export interface AISettingsSnapshot {
  version: number;
  providers: AIProviderCatalogItem[];
  capabilities: AICapabilityDefinition[];
  promptTemplates: AIPromptTemplate[];
  metadata: {
    updatedAt: string;
    updatedBy: string;
    version: number;
  };
}

export interface AIPricingRule {
  id: string;
  providerId: string;
  modelId: string;
  billingMode: "token" | "request" | "page" | "second";
  currency: string;
  inputPer1M?: number;
  outputPer1M?: number;
  perRequestFee?: number;
  ocrPerPage?: number;
  audioPerMinute?: number;
  effectiveDate: string;
}

export interface AIModelCatalogItem {
  modelId: string;
  providerId: string;
  displayName: string;
  type: "text" | "vision" | "ocr" | "embedding" | "audio";
  contextLength: number;
  supportsImages: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  deprecated: boolean;
}

export interface AIProviderHealth {
  providerId: string;
  configStatus: "configured" | "missing_env" | "invalid";
  runtimeStatus: "healthy" | "degraded" | "offline" | "unknown";
  probeStatus: "idle" | "healthy" | "degraded" | "offline";
  lastCheckedAt?: string;
  lastLatencyMs?: number;
  successRate1h?: number;
  successRate24h?: number;
  avgLatencyMs?: number;
  recentError?: string | null;
}

export interface AICapabilityBindingVersion {
  id: string;
  capabilityId: string;
  version: number;
  binding: { provider: string; model: string };
  promptTemplateId?: string;
  generationConfig?: Record<string, any>;
  publishedAt: string;
  publishedBy: string;
  reason: string;
  rollbackFrom?: number;
  status: "active" | "superseded" | "rolled_back";
}

export interface AIPromptTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  variables: string[];
  applicableCapabilities: string[];
  publishedAt: string;
  publishedBy: string;
  reason?: string;
  status: "active" | "superseded";
}

export interface AIUsageRecord {
  usageType: "token" | "ocr_page" | "audio_second" | "request";
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  imageCount?: number | null;
  ocrPages?: number | null;
  audioSeconds?: number | null;
  pricingRuleId?: string | null;
  estimatedCost?: number | null;
}

export interface AIBudgetConfig {
  id: string;
  scopeType:
    | "GLOBAL"
    | "GROUP"
    | "CAPABILITY"
    | "MODULE"
    | "COMPANY"
    | "PROVIDER"
    | "MODEL";
  scopeId?: string;
  periodType: "daily" | "monthly";
  budgetAmount: number;
  currency: string;
  alertThresholds: number[];
  actionType: "notify_only" | "soft_block" | "hard_block";
  status: "active" | "paused";
}

export interface AIBusinessLineStats {
  key: string;
  label: string;
  totalCalls: number;
  successRate: number;
  totalCost: number;
  avgLatencyMs: number;
}

export interface AIModelRuntimeComparison {
  capabilityId: string;
  dateRange: { start: string; end: string };
  models: Array<{
    provider: string;
    model: string;
    totalCalls: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    avgTokensPerCall: number;
    totalCost: number;
    costPerCall: number;
    fallbackCount: number;
  }>;
}

export interface AIIncident {
  id: string;
  ruleId: string;
  triggeredAt: string;
  resolvedAt?: string;
  severity: "warning" | "critical";
  summary: string;
  affectedTraceIds: string[];
  status: "open" | "acknowledged" | "resolved";
}

export interface AIAlertRule {
  id: string;
  name: string;
  type: "error_rate" | "latency_spike" | "cost_surge" | "provider_timeout";
  scope: "global" | "capability" | "provider";
  scopeId?: string;
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
}

export interface AIDashboardOverview {
  period: { start: string; end: string };
  totalCalls: number;
  successRate: number;
  totalCost: number;
  activeModels: number;
  topCapabilities: Array<{
    id: string;
    name: string;
    calls: number;
    cost: number;
  }>;
  topModels: Array<{
    model: string;
    calls: number;
    cost: number;
    avgLatencyMs: number;
  }>;
  topModules: Array<{ module: string; calls: number; cost: number }>;
  topCompanies: Array<{
    companyId: string;
    companyName: string;
    calls: number;
    cost: number;
  }>;
  recentConfigChanges: Array<{
    capabilityId: string;
    changedAt: string;
    changedBy: string;
  }>;
  openIncidents: AIIncident[];
  trends: {
    calls: Array<{ date: string; count: number }>;
    costs: Array<{ date: string; amount: number }>;
    errorRate: Array<{ date: string; rate: number }>;
  };
}

export interface AICostRecord {
  date: string;
  provider?: string | null;
  model?: string | null;
  capabilityId?: string | null;
  group?: string | null;
  module?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
}

export interface StepLog {
  step:
    | "ocr"
    | "hospital"
    | "catalog"
    | "summary"
    | "upload"
    | "catalog_fetch"
    | "catalog_sync"
    | "catalog_ai"
    | "saving";
  input: any;
  output: any;
  duration: number;
  timestamp: string;
}

/** 审核子步骤耗时记录（用于前端展示） */
export interface StepTiming {
  step: string; // 步骤标识，与 AuditStep 对应
  label: string; // 中文显示名称
  startTime: number; // Date.now() 开始时间戳
  endTime?: number; // Date.now() 结束时间戳（undefined 表示进行中）
  duration?: number; // 耗时毫秒（endTime - startTime）
  detail?: string; // 额外描述（如 "3/5 张图片"）
}

/** 单张图片的 OCR 识别结果（多图模式下使用） */
export interface InvoiceImageOcrResult {
  imageIndex: number; // 图片在上传组中的序号（0-based）
  ossUrl: string; // 图片 OSS URL
  ossKey: string; // 图片 OSS Key
  fileName: string; // 原始文件名
  documentType: "summary_invoice" | "detail_list" | "single_invoice";
  ocrData: MedicalInvoiceData; // 该图片的 OCR 识别结果
  aiLog?: AIInteractionLog; // 该图片的 AI 交互日志
}

// 审核记录中增加 AI 日志字段
export interface InvoiceAuditResult {
  invoiceId: string;
  ossUrl: string;
  ossKey: string;
  uploadTime: string;
  claimCaseId?: string;

  // 1. OCR Result
  ocrData: MedicalInvoiceData;
  // 2. Hospital Validation
  hospitalValidation: {
    hospitalName: string;
    matchedHospital?: HospitalInfo;
    isQualified: boolean;
    reason?: string;
  };
  // 3. Item Audits (with catalog matching)
  itemAudits: InvoiceItemAudit[];
  // 4. Summary
  summary: {
    totalAmount: number;
    qualifiedAmount: number;
    unqualifiedAmount: number;
    qualifiedItemCount: number;
    unqualifiedItemCount: number;
    estimatedReimbursement: number;
  };

  // Status
  auditStatus: "processing" | "completed" | "failed";
  auditTime?: string;
  errorMessage?: string;

  // AI Log
  aiLog?: AIInteractionLog;
  // Step Logs
  stepLogs?: StepLog[];
  // Validation Warnings (OCR 后置验证结果)
  validationWarnings?: ValidationWarning[];

  // 多图支持
  imageCount?: number; // 图片数量（1=单图，>1=多图）
  imageOcrResults?: InvoiceImageOcrResult[]; // 每张图片的独立 OCR 结果
  summaryChargeItems?: MedicalInvoiceData["chargeItems"]; // 汇总发票大类项目（仅参考，不参与审核）
  crossValidation?: {
    // 汇总 vs 明细金额交叉验证
    summaryTotal: number;
    detailItemsTotal: number;
    difference: number;
    isConsistent: boolean;
  };

  // 各子步骤耗时记录
  stepTimings?: StepTiming[];
}

/** 通用材料审核结果（非发票类材料使用） */
export interface MaterialAuditResult {
  auditId: string;
  materialType: string; // 材料类型 ID（如 "mat-1"）
  materialName: string; // 材料名称（如 "身份证正面"）
  ossUrl: string;
  ossKey: string;
  uploadTime: string;

  // OCR 提取的结构化数据（根据材料 jsonSchema 提取）
  extractedData: Record<string, any>;

  // AI 审核结论
  auditConclusion: string; // AI 给出的审核结论文本
  auditStatus: "completed" | "failed";
  errorMessage?: string;

  // 日志
  aiLog?: AIInteractionLog;
  stepTimings?: StepTiming[];
}

// OCR 后置验证警告
export interface ValidationWarning {
  type:
    | "duplicate_item"
    | "amount_mismatch"
    | "total_mismatch"
    | "insurance_balance"
    | "abnormal_value"
    | "summary_detail_mismatch"
    | "unqualified_hospital";
  severity: "info" | "warning" | "error";
  message: string;
  details?: {
    field?: string;
    expected?: number;
    actual?: number;
    difference?: number;
    items?: string[]; // 涉及的项目名称
  };
}

export interface InvoiceItemAudit {
  itemName: string; // 费用项目名称（从发票识别）
  quantity: number;
  unitPrice: number;
  totalPrice: number;

  // 医保目录匹配结果
  catalogMatch: {
    matched: boolean;
    matchedItem?: MedicalInsuranceCatalogItem;
    matchConfidence: number; // 匹配置信度 0-100
    matchMethod: "exact" | "alias" | "fuzzy" | "ai" | "manual" | "none";
  };

  // 审核结论
  isQualified: boolean; // 是否符合医保目录
  qualificationReason: string; // 判定依据
  estimatedReimbursement: number; // 预估报销金额
  remarks?: string;
}

export { MedicalInvoiceData };

// --- START: Types for Review Task (Manual Review Work Order) ---

export enum ReviewTaskStatus {
  PENDING = "待处理",
  IN_PROGRESS = "处理中",
  COMPLETED = "已完成",
  CANCELLED = "已取消",
}

export enum ReviewTaskPriority {
  LOW = "低",
  MEDIUM = "中",
  HIGH = "高",
  URGENT = "紧急",
}

export enum ReviewTaskType {
  LOW_CONFIDENCE = "置信度不足",
  AI_ERROR = "AI识别失败",
  MANUAL_REQUEST = "人工请求",
  COMPLIANCE_CHECK = "合规检查",
}

export interface ReviewTask {
  id: string;
  claimCaseId: string;
  reportNumber: string;
  materialId: string;
  materialName: string;
  documentId: string;
  ossUrl: string;
  ossKey: string;

  taskType: ReviewTaskType;
  priority: ReviewTaskPriority;
  status: ReviewTaskStatus;

  aiConfidence: number;
  threshold: number;
  aiExtractedData?: Record<string, any>;
  aiErrorMessage?: string;

  manualInputData?: Record<string, any>;
  manualReviewNotes?: string;
  reviewerId?: string;
  reviewerName?: string;

  createdAt: string;
  assignedAt?: string;
  completedAt?: string;

  createdBy: string;
}

export interface ReviewTaskCreateInput {
  claimCaseId: string;
  reportNumber: string;
  materialId: string;
  materialName: string;
  documentId: string;
  ossUrl: string;
  ossKey: string;
  taskType: ReviewTaskType;
  priority?: ReviewTaskPriority;
  aiConfidence: number;
  threshold: number;
  aiExtractedData?: Record<string, any>;
  aiErrorMessage?: string;
  createdBy: string;
}

export interface ReviewTaskUpdateInput {
  status?: ReviewTaskStatus;
  manualInputData?: Record<string, any>;
  manualReviewNotes?: string;
  reviewerId?: string;
  reviewerName?: string;
}

// --- END: Types for Review Task ---

// --- END: Types for Medical Invoice Audit & Insurance Catalog ---

// --- START: Types for Quote and Policy Management ---

// 询价单状态
export enum QuoteStatus {
  DRAFT = "草稿",
  PENDING = "待报价",
  QUOTED = "已报价",
  ACCEPTED = "已接受",
  REJECTED = "已拒绝",
  EXPIRED = "已过期",
  CONVERTED = "已转保单",
}

// 保单状态
export enum PolicyStatus {
  DRAFT = "草稿",
  PENDING_PAYMENT = "待支付",
  EFFECTIVE = "生效中",
  LAPSED = "失效",
  SURRENDERED = "已退保",
  EXPIRED = "已满期",
  CANCELLED = "已注销",
}

// 询价类型
export enum QuoteType {
  INDIVIDUAL = "个人询价",
  GROUP = "团体询价",
}

// 投保人信息
export interface QuotePolicyholder {
  name: string;
  idType: "身份证" | "护照" | "港澳通行证" | "其他";
  idNumber: string;
  gender: "男" | "女";
  birthDate: string;
  phone: string;
  email?: string;
  address?: string;
}

// 被保险人信息
export interface QuoteInsured {
  id: string;
  name: string;
  idType: "身份证" | "护照" | "港澳通行证" | "其他";
  idNumber: string;
  gender: "男" | "女";
  birthDate: string;
  relationship: "本人" | "配偶" | "子女" | "父母" | "其他";
  occupation?: string;
  phone?: string;
}

// 询价方案条款配置
export interface QuotePlanClause {
  clauseCode: string;
  clauseName: string;
  clauseType: "主险" | "附加险";
  sumInsured: number;
  premium: number;
  deductible?: string;
  coverageDetails?: CoverageItem[];
}

// 询价方案
export interface QuotePlan {
  id: string;
  planName: string;
  productCode: string;
  productName: string;
  companyName: string;
  premium: number;
  paymentPeriod: string;
  coveragePeriod: string;
  clauses: QuotePlanClause[];
  notes?: string;
}

// 询价单
export interface QuoteRequest {
  id: string;
  quoteNumber: string;
  type: QuoteType;
  status: QuoteStatus;
  policyholder: QuotePolicyholder;
  insureds: QuoteInsured[];
  plans: QuotePlan[];
  selectedPlanId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  operator: string;
  notes?: string;
}

// 保单条款
export interface PolicyClause {
  clauseCode: string;
  clauseName: string;
  clauseType: "主险" | "附加险";
  sumInsured: number;
  premium: number;
  paymentFrequency: "年缴" | "半年缴" | "季缴" | "月缴";
  deductible?: string;
  coverageDetails?: CoverageItem[];
  waitingPeriod?: string;
}

// 特别约定
export interface SpecialAgreement {
  id: string;
  title: string;
  content: string;
  category: "扩展责任" | "限制责任" | "特约事项" | "其他";
  effectiveDate?: string;
  expiryDate?: string;
}

// 免赔约定
export interface DeductionRule {
  id: string;
  name: string;
  type: "绝对免赔额" | "相对免赔额" | "比例免赔" | "累积免赔";
  value: number;
  unit: "元" | "%" | "次";
  description: string;
  applicableScope: "每次事故" | "年度累积" | "保单期间";
}

// 保单明细表项
export interface PolicyScheduleItem {
  id: string;
  category: string;
  itemName: string;
  sumInsured: number;
  deductible: number;
  reimbursementRatio: number;
  remarks?: string;
}

// 保单明细表
export interface PolicySchedule {
  version: string;
  generatedAt: string;
  items: PolicyScheduleItem[];
  totalSumInsured: number;
  totalPremium: number;
}

// 保单
export interface InsurancePolicy {
  id: string;
  policyNumber: string;
  quoteId?: string;
  quoteNumber?: string;
  status: PolicyStatus;

  // 产品信息
  productCode: string;
  productName: string;
  companyName: string;

  // 当事人信息
  policyholder: QuotePolicyholder;
  insureds: QuoteInsured[];

  // 条款配置
  mainClause: PolicyClause;
  riderClauses: PolicyClause[];

  // 特别约定与免赔
  specialAgreements: SpecialAgreement[];
  deductionRules: DeductionRule[];

  // 保单明细表
  schedule?: PolicySchedule;

  // 日期信息
  effectiveDate: string;
  expiryDate: string;
  issueDate: string;
  paymentDueDate?: string;

  // 金额信息
  totalPremium: number;
  paymentFrequency: "年缴" | "半年缴" | "季缴" | "月缴";
  paidPremium?: number;

  // 理赔统计
  claimCount: number;
  totalClaimAmount: number;

  // 元数据
  createdAt: string;
  updatedAt: string;
  operator: string;
  notes?: string;
}

// 保单列表项（用于列表展示）
export interface PolicyListItem {
  id: string;
  policyNumber: string;
  productName: string;
  companyName: string;
  policyholder: string;
  effectiveDate: string;
  expiryDate: string;
  status: PolicyStatus;
  totalPremium: number;
  claimCount: number;
}

// 询价单列表项（用于列表展示）
export interface QuoteListItem {
  id: string;
  quoteNumber: string;
  type: QuoteType;
  status: QuoteStatus;
  policyholder: string;
  insuredCount: number;
  planCount: number;
  createdAt: string;
  validUntil?: string;
}
// --- END: Types for Quote and Policy Management ---

// --- START: Types for User Operation Logs ---
// 用户操作类型枚举（涵盖所有C端用户操作）
export enum UserOperationType {
  LOGIN = "LOGIN", // 用户登录
  LOGOUT = "LOGOUT", // 用户登出
  REPORT_CLAIM = "REPORT_CLAIM", // 提交报案
  UPLOAD_FILE = "UPLOAD_FILE", // 上传文件
  DELETE_FILE = "DELETE_FILE", // 删除文件
  VIEW_FILE = "VIEW_FILE", // 查看文件
  SEND_MESSAGE = "SEND_MESSAGE", // 发送消息
  RECEIVE_MESSAGE = "RECEIVE_MESSAGE", // 接收消息
  VIEW_PROGRESS = "VIEW_PROGRESS", // 查看进度
  VIEW_CLAIM_DETAIL = "VIEW_CLAIM_DETAIL", // 查看赔案详情
  SUBMIT_FORM = "SUBMIT_FORM", // 提交表单
  UPDATE_PROFILE = "UPDATE_PROFILE", // 更新资料
  ANALYZE_DOCUMENT = "ANALYZE_DOCUMENT", // 文档分析
  QUICK_ANALYZE = "QUICK_ANALYZE", // 快速分析
  VOICE_TRANSCRIPTION = "VOICE_TRANSCRIPTION", // 语音转写
  LIVE_AUDIO_SESSION = "LIVE_AUDIO_SESSION", // 实时语音会话
  GENERATE_REPORT = "GENERATE_REPORT", // 生成报告
  CLAIM_ACTION = "CLAIM_ACTION", // 案件操作（通过/拒赔等）
  IMPORT_MATERIALS = "IMPORT_MATERIALS", // 批量导入材料
  TASK_CREATE = "TASK_CREATE", // 创建处理任务
  SYSTEM_CALL = "SYSTEM_CALL", // 系统调用
}

// 用户操作日志主类型
export interface UserOperationLog {
  logId: string; // 格式: log-YYYYMMDDHHMMSS-random
  timestamp: string; // ISO时间戳

  // 用户标识
  userName: string; // 用户名（来自登录）
  userGender?: string; // 用户性别
  sessionId?: string; // 浏览器会话ID（用于追踪匿名用户）

  // 操作详情
  operationType: UserOperationType; // 操作类型
  operationLabel: string; // 操作描述（中文）

  // 关联上下文
  claimId?: string; // 关联的理赔案件ID
  claimReportNumber?: string; // 理赔报案号
  currentStatus?: string; // 案件当前状态

  // 数据记录
  inputData?: Record<string, any>; // 输入数据（表单、参数等）
  outputData?: Record<string, any>; // 输出数据（结果、响应等）

  // AI交互（如果涉及AI调用）
  aiInteractions?: AIInteractionLog[]; // AI调用记录数组

  // 性能指标
  duration?: number; // 操作总耗时（毫秒）
  success: boolean; // 操作是否成功
  errorMessage?: string; // 错误信息（如果失败）

  // 技术信息
  userAgent?: string; // 浏览器UA
  deviceType?: "mobile" | "desktop" | "tablet";

  // 扩展字段
  metadata?: Record<string, any>; // 其他元数据
}
// --- END: Types for User Operation Logs ---

// --- 结构化字段人工订正记录 ---
export interface FieldCorrection {
  correctionId: string; // "fc-{timestamp}"
  documentId: string;
  fieldKey: string;
  fieldLabel: string;
  originalValue: string; // 变更前
  correctedValue: string; // 变更后
  correctedAt: string; // ISO timestamp
  correctedBy: string; // 操作人
  claimCaseId: string;
}

export type ClaimStageStatus =
  | "pending"
  | "processing"
  | "awaiting_human"
  | "completed"
  | "manual_completed"
  | "failed";

export interface ClaimStageProgress {
  key: "intake" | "parse" | "liability" | "assessment";
  label: string;
  status: ClaimStageStatus;
  completedAt?: string;
  startedAt?: string;
  completedBy?: "system" | "manual";
  summary?: string;
  blockingReason?: string;
  activeInterventionId?: string;
  interventionType?: InterventionPointType;
  interventionSubState?: InterventionSubState;
}

export type ClaimTimelineEventType =
  | "CLAIM_REPORTED"
  | "MATERIAL_UPLOADED"
  | "MATERIAL_COMPLETENESS_PASSED"
  | "MATERIAL_COMPLETENESS_FAILED"
  | "OCR_STARTED"
  | "OCR_COMPLETED"
  | "STRUCTURED_EXTRACTION_COMPLETED"
  | "LIABILITY_AUTO_COMPLETED"
  | "LIABILITY_MANUAL_COMPLETED"
  | "ASSESSMENT_AUTO_COMPLETED"
  | "ASSESSMENT_MANUAL_COMPLETED"
  | "MANUAL_REVIEW_REQUESTED"
  | "INTERVENTION_CREATED"
  | "INTERVENTION_STATE_CHANGED"
  | "INTERVENTION_RESOLVED"
  | "ADJUSTER_OVERRIDE_APPLIED"
  | "REUPLOAD_REQUESTED"
  | "REUPLOAD_RECEIVED"
  | "RE_EXTRACTION_TRIGGERED"
  | "MANUAL_DECISION_MADE"
  | "ROLLBACK_INITIATED";

export interface ClaimTimelineEvent {
  id: string;
  type: ClaimTimelineEventType;
  timestamp: string;
  actorType: "system" | "manual" | "customer";
  actorName?: string;
  claimId: string;
  materialId?: string;
  materialName?: string;
  documentId?: string;
  success: boolean;
  summary: string;
  details?: Record<string, unknown>;
}

// ============ 人工介入（Human-in-the-Loop）状态机类型 ============

/** 介入点类型 */
export type InterventionPointType =
  | "PARSE_LOW_CONFIDENCE" // 介入点1：材料识别置信度不足
  | "VALIDATION_GATE" // 介入点2：材料校验规则不通过
  | "RULE_MANUAL_ROUTE"; // 介入点3：规则引擎转人工

/** 介入点1 子状态：材料识别置信度不足 */
export type ParseConfidenceSubState =
  | "IDLE"
  | "REVIEW_CREATED"
  | "REVIEW_IN_PROGRESS"
  | "CORRECTION_SUBMITTED"
  | "RE_EXTRACTION_PENDING"
  | "RE_EXTRACTION_RUNNING"
  | "RESOLVED_PROCEED"
  | "RESOLVED_ACCEPT_AS_IS";

/** 介入点2 子状态：材料校验规则不通过 */
export type ValidationGateSubState =
  | "IDLE"
  | "VALIDATION_FAILED"
  | "PENDING_ADJUSTER_REVIEW"
  | "ADJUSTER_OVERRIDE"
  | "PENDING_REUPLOAD"
  | "REUPLOAD_RECEIVED"
  | "RE_VALIDATION_RUNNING"
  | "RESOLVED_PROCEED";

/** 介入点3 子状态：规则引擎转人工 */
export type RuleManualRouteSubState =
  | "IDLE"
  | "MANUAL_REVIEW_TRIGGERED"
  | "PENDING_ADJUSTER"
  | "ADJUSTER_REVIEWING"
  | "DECISION_APPROVE"
  | "DECISION_REJECT"
  | "DECISION_ADJUST"
  | "DECISION_REQUEST_INFO"
  | "PENDING_ADDITIONAL_INFO"
  | "INFO_RECEIVED"
  | "RESOLVED_PROCEED"
  | "RESOLVED_ROLLBACK";

/** 所有子状态联合类型 */
export type InterventionSubState =
  | ParseConfidenceSubState
  | ValidationGateSubState
  | RuleManualRouteSubState;

/** 状态转移事件 */
export type InterventionEvent =
  // 介入点1 事件
  | "CONFIDENCE_BELOW_THRESHOLD"
  | "ADJUSTER_CLAIM_TASK"
  | "ADJUSTER_SUBMIT_CORRECTIONS"
  | "ADJUSTER_ACCEPT_ORIGINAL"
  | "REQUEST_RE_EXTRACTION"
  | "CORRECTIONS_FINALIZED"
  | "RE_EXTRACTION_STARTED"
  | "RE_EXTRACTION_STILL_LOW_CONFIDENCE"
  | "RE_EXTRACTION_SUCCEEDED"
  // 介入点2 事件
  | "VALIDATION_RULES_FAILED"
  | "ADJUSTER_ASSIGNED"
  | "ADJUSTER_OVERRIDE_DECISION"
  | "OVERRIDE_CONFIRMED"
  | "ADJUSTER_REQUEST_REUPLOAD"
  | "CUSTOMER_REUPLOAD_COMPLETE"
  | "RE_VALIDATION_STARTED"
  | "RE_VALIDATION_PASSED"
  | "RE_VALIDATION_FAILED"
  // 介入点3 事件
  | "RULE_ROUTE_MANUAL"
  | "TASK_QUEUED"
  | "ADJUSTER_APPROVE"
  | "ADJUSTER_REJECT"
  | "ADJUSTER_ADJUST"
  | "ADJUSTER_REQUEST_INFO"
  | "DECISION_CONFIRMED"
  | "INFO_REQUEST_SENT"
  | "CUSTOMER_PROVIDES_INFO"
  | "RE_REVIEW_WITH_NEW_INFO"
  | "ROLLBACK_TO_INTAKE";

/** 介入实例解决方式 */
export type InterventionResolution = "PROCEED" | "ROLLBACK" | "ACCEPT_AS_IS";

/** 转人工原因结构 */
export interface InterventionReason {
  code: string; // 原因编码
  summary: string; // 一句话摘要（工作台列表显示）
  detail: string; // 详细说明（详情页横幅显示）
  sourceField?: string; // 相关字段（介入点1）
  sourceRuleId?: string; // 相关规则ID（介入点2/3）
  sourceRuleName?: string; // 相关规则名称
  confidence?: number; // 置信度值（介入点1）
  threshold?: number; // 阈值（介入点1）
  leftValue?: string; // 左字段值（介入点2）
  rightValue?: string; // 右字段值（介入点2）
  routeReason?: string; // 规则路由原因（介入点3）
}

/** 单次状态转移审计记录 */
export interface InterventionTransition {
  id: string;
  interventionId: string;
  fromState: InterventionSubState;
  toState: InterventionSubState;
  event: InterventionEvent;
  timestamp: string;
  actorType: "system" | "adjuster" | "supervisor" | "customer";
  actorName?: string;
  reason?: string;
  data?: Record<string, unknown>;
}

/** 理赔员决策数据（介入点3） */
export interface AdjusterDecision {
  type: "APPROVE" | "REJECT" | "ADJUST" | "REQUEST_INFO";
  adjustedAmount?: number;
  adjustedRatio?: number;
  reason: string;
  decidedAt: string;
  decidedBy: string;
}

/** 人工介入实例 */
export interface InterventionInstance {
  id: string;
  claimCaseId: string;
  stageKey: "intake" | "parse" | "liability" | "assessment";
  interventionType: InterventionPointType;
  currentState: InterventionSubState;
  previousState?: InterventionSubState;
  reason: InterventionReason;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolution?: InterventionResolution;
  rollbackTargetStage?: "intake" | "parse" | "liability";

  // 关联ID
  reviewTaskId?: string; // 关联 ReviewTask（介入点1）
  validationRuleIds?: string[]; // 失败的校验规则ID（介入点2）
  triggeringRuleId?: string; // 触发转人工的规则ID（介入点3）

  // 理赔员决策（介入点3）
  adjusterDecision?: AdjusterDecision;

  // 状态转移历史（审计追踪）
  transitions: InterventionTransition[];
}

export interface ClaimProcessTimeline {
  stages: ClaimStageProgress[];
  events: ClaimTimelineEvent[];
  source: "standard" | "derived";
}

// --- START: Types for Multi-File Processing ---

/** 文件类型分类 */
export type FileTypeCategory =
  | "image_invoice" // 发票图片
  | "image_report" // 检查报告图片
  | "image_scene" // 现场照片
  | "image_id" // 身份证件
  | "image_other" // 其他图片
  | "pdf_clause" // 条款 PDF
  | "pdf_report" // 报告 PDF
  | "pdf_invoice" // 发票 PDF
  | "pdf_other" // 其他 PDF
  | "video_scene" // 事故现场视频
  | "video_surveillance" // 监控视频
  | "excel_expense" // 费用清单 Excel
  | "excel_other" // 其他 Excel
  | "word_diagnosis" // 诊断证明 Word
  | "word_other" // 其他 Word
  | "other"; // 其他类型

/** 解析状态 */
export type ParseStatus = "pending" | "processing" | "completed" | "failed";

/** 视频关键帧 */
export interface KeyFrame {
  timestamp: number; // 时间戳（毫秒）
  imageData: string; // Base64 图像数据
  description?: string; // AI 描述
}

/** 视频元数据 */
export interface VideoMetadata {
  duration: number; // 时长（秒）
  width?: number; // 宽度
  height?: number; // 高度
  keyFrames: KeyFrame[]; // 关键帧
  audioTranscript?: string; // 语音转写文本
  format?: string; // 视频格式
  size?: number; // 文件大小（字节）
}

/** PDF 元数据 */
export interface PDFMetadata {
  pageCount: number; // 页数
  hasText: boolean; // 是否包含可提取文本
  hasImages: boolean; // 是否包含图片
  needsOCR: boolean; // 是否需要 OCR
}

/** 文档 AI 分析结果 */
export interface DocumentAnalysisResult {
  documentType: string; // 文档类型
  confidence: number; // 整体置信度 0-100
  extractedFields: Record<string, any>; // 提取的字段
  summary?: string; // 文档摘要
  warnings?: string[]; // 警告信息
  anomalies?: string[]; // 异常发现
}

/** 解析后的文档 */
export interface ParsedDocument {
  documentId: string; // 文档 ID
  fileName: string; // 原始文件名
  fileType: FileTypeCategory; // 文件类型分类
  mimeType: string; // MIME 类型
  ossKey: string; // OSS 存储路径
  ossUrl: string; // OSS 访问 URL
  parseStatus: ParseStatus; // 解析状态

  // 解析结果
  extractedText?: string; // 提取的文本
  structuredData?: Record<string, any>; // 结构化数据
  ocrData?: MedicalInvoiceData; // OCR 识别数据（发票等）

  // 类型特定元数据
  videoMetadata?: VideoMetadata; // 视频专用
  pdfMetadata?: PDFMetadata; // PDF 专用

  // AI 分析结果
  aiAnalysis?: DocumentAnalysisResult; // AI 分析
  confidence: number; // 整体置信度

  // 材料分类信息
  classification?: {
    materialId: string;
    materialName: string;
    confidence: number;
    source?: "ai" | "manual";
    errorMessage?: string;
    matchStrategy?: "rule" | "ai" | "fallback";
  };

  // 处理信息
  parseTime?: string; // 解析时间
  parseDuration?: number; // 解析耗时（毫秒）
  errorMessage?: string; // 错误信息
}

/** 交叉验证类型 */
export type CrossValidationType =
  | "amount_consistency" // 金额一致性
  | "date_consistency" // 日期一致性
  | "identity" // 身份一致性
  | "timeline"; // 时间线合理性

/** 交叉验证严重程度 */
export type CrossValidationSeverity = "info" | "warning" | "error";

/** 交叉验证结果 */
export interface CrossValidationResult {
  type: CrossValidationType; // 验证类型
  passed: boolean; // 是否通过
  severity: CrossValidationSeverity; // 严重程度
  message: string; // 验证消息
  details: {
    field?: string; // 涉及字段
    expected?: number | string; // 期望值
    actual?: number | string; // 实际值
    difference?: number; // 差异
    relatedDocuments?: string[]; // 相关文档 ID
  };
}

/** 材料完整性检查结果 */
export interface DocumentCompletenessResult {
  isComplete: boolean; // 是否完整
  completenessScore: number; // 完整度评分 0-100
  requiredMaterials: string[]; // 必需材料列表
  providedMaterials: string[]; // 已提供材料列表
  missingMaterials: string[]; // 缺失材料列表
  optionalMaterials: string[]; // 可选材料列表
  warnings?: string[]; // 警告信息
}

/** 人工介入点类型 */
export type InterventionType =
  | "document_incomplete" // 材料不完整
  | "eligibility_doubt" // 责任存疑
  | "amount_anomaly" // 金额异常
  | "high_risk" // 高风险
  | "fraud_suspected" // 欺诈嫌疑
  | "manual_request"; // 用户请求人工

/** 人工介入点 */
export interface InterventionPoint {
  id: string; // 介入点 ID
  type: InterventionType; // 介入类型
  reason: string; // 介入原因
  timestamp: string; // 时间戳
  requiredAction: string; // 需要的操作
  resolved: boolean; // 是否已解决
  resolvedBy?: string; // 解决人
  resolvedAt?: string; // 解决时间
  resolution?: string; // 解决方案
}

/** 多文件处理请求 */
export interface MultiFileProcessRequest {
  claimCaseId: string; // 案件 ID
  productCode: string; // 产品代码
  documents: Array<{
    ossKey: string; // OSS 路径
    fileName: string; // 文件名
    mimeType: string; // MIME 类型
  }>;
  options?: {
    skipOCR?: boolean; // 跳过 OCR
    skipAI?: boolean; // 跳过 AI 分析
    language?: string; // 语言
  };
}

/** 多文件处理响应 */
export interface MultiFileProcessResponse {
  claimCaseId: string; // 案件 ID
  documents: ParsedDocument[]; // 解析后的文档
  crossValidation: CrossValidationResult[]; // 交叉验证结果
  completeness: DocumentCompletenessResult; // 完整性检查
  interventionPoints: InterventionPoint[]; // 人工介入点
  processingTime: number; // 总处理时间（毫秒）
}

// --- END: Types for Multi-File Processing ---

// --- START: Types for Injury Case Processing ---

/**
 * 源文件锚点 - 记录 AI 提取结果在原始文件中的位置
 * 用于人工审核时一键跳转到源文件对应位置
 */
export interface SourceAnchor {
  /** 文件页码，0-based */
  pageIndex: number;
  /** OCR 原始文本片段，用于 L2 文本搜索高亮 */
  rawText?: string;
  /**
   * 归一化坐标 [x0, y0, x1, y1]，值域 0-1
   * 仅 PaddleOCR / GLM layout_parsing 返回此坐标
   */
  bbox?: [number, number, number, number];
  /** 高亮级别：precise=精确框选，text_search=文本搜索，page_only=仅页面定位 */
  highlightLevel: "precise" | "text_search" | "page_only";
}

/** 人工复核标记 */
export interface ReviewFlag {
  type:
    | "blurry"
    | "missing_signature"
    | "date_inconsistent"
    | "amount_unclear"
    | "low_confidence";
  description: string;
  pageIndex: number;
}

/** 扩展的已处理文件（在 ProcessedFile 基础上增加溯源和批次信息） */
export interface ProcessedFileExtended extends ProcessedFile {
  /** 所属导入批次 */
  batchId?: string;
  /** 文件总页数 */
  pageCount?: number;
  /** 每页缩略图 URL 列表 */
  thumbnailUrls?: string[];
  /** 文档中最早日期 */
  dateFrom?: string;
  /** 文档中最晚日期 */
  dateTo?: string;
  /** 出具机构名称 */
  institution?: string;
  /** OCR 质量评分 0-1 */
  ocrQualityScore?: number;
  /** 需要人工复核的标记列表 */
  reviewFlags?: ReviewFlag[];
  /** SHA-256 内容哈希，用于精确去重 */
  sha256?: string;
  /** 感知哈希，用于相似图片去重 */
  pHash?: string;
  /** 文件来源容器（压缩包/邮件） */
  sourceContainer?: {
    type: "zip" | "rar" | "eml" | "msg";
    containerFileName: string;
    emailSubject?: string;
    emailFrom?: string;
    emailDate?: string;
    /** 在压缩包中的相对路径 */
    entryPath?: string;
  };
  /** 是否为修订版本 */
  isRevision?: boolean;
  /** 被本文件替代的旧文件 ID */
  supersedesDocumentId?: string;
  /** 是否已被更新版本替代 */
  superseded?: boolean;
  /** 类型化结构化摘要 */
  documentSummary?: DocumentSummaryBase;
}

// --- 文档类型化摘要 ---

/** 所有文档摘要的公共基类 */
export interface DocumentSummaryBase {
  docId: string;
  summaryType: string;
  extractedAt: string;
  /** AI 提取整体置信度 0-1 */
  confidence: number;
  /**
   * 字段到源锚点的映射
   * key 为字段名（如 "accidentDate"），value 为该字段在源文件中的位置
   */
  sourceAnchors: Record<string, SourceAnchor>;
}

/** 交警责任认定书摘要 */
export interface AccidentLiabilitySummary extends DocumentSummaryBase {
  summaryType: "accident_liability";
  accidentDate?: string;
  accidentLocation?: string;
  parties: Array<{
    role: string;
    name: string;
    /** 责任比例 0-100 */
    liabilityPct: number;
  }>;
  liabilityBasis?: string;
  documentNumber?: string;
}

/** 住院病历摘要 */
export interface InpatientRecordSummary extends DocumentSummaryBase {
  summaryType: "inpatient_record";
  admissionDate?: string;
  dischargeDate?: string;
  hospitalizationDays?: number;
  diagnoses: Array<{ name: string; icdCode?: string }>;
  surgeries: Array<{ name: string; date?: string }>;
  dischargeCondition?: string;
  attendingDoctor?: string;
  ward?: string;
}

/** 费用发票/清单摘要 */
export interface ExpenseInvoiceSummary extends DocumentSummaryBase {
  summaryType: "expense_invoice";
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  institution?: string;
  breakdown: Array<{
    /** 费用大类，来自 expenseClassifier */
    category: string;
    itemName: string;
    amount: number;
  }>;
}

/** 伤残鉴定报告摘要 */
export interface DisabilityAssessmentSummary extends DocumentSummaryBase {
  summaryType: "disability_assessment";
  /** 伤残等级，如"十级伤残" */
  disabilityLevel?: string;
  disabilityBasis?: string;
  assessmentDate?: string;
  assessmentInstitution?: string;
  nursingDependencyLevel?: string;
}

/** 误工/收入证明摘要 */
export interface IncomeLostSummary extends DocumentSummaryBase {
  summaryType: "income_lost";
  /** 月收入（元） */
  monthlyIncome?: number;
  incomeType?: "salary" | "self_employed" | "average";
  /** 建议误工天数 */
  lostWorkDays?: number;
  employer?: string;
}

/** 诊断证明书摘要 */
export interface DiagnosisProofSummary extends DocumentSummaryBase {
  summaryType: "diagnosis_proof";
  diagnoses: Array<{ name: string; icdCode?: string }>;
  issueDate?: string;
  issuingDoctor?: string;
  institution?: string;
  restDays?: number;
}

export type AnyDocumentSummary =
  | AccidentLiabilitySummary
  | InpatientRecordSummary
  | ExpenseInvoiceSummary
  | DisabilityAssessmentSummary
  | IncomeLostSummary
  | DiagnosisProofSummary;

// --- 批次导入 ---

/** 单次批量导入的批次记录 */
export interface ImportBatch {
  batchId: string;
  claimCaseId: string;
  importedAt: string;
  importedBy: string;
  fileCount: number;
  successCount: number;
  failCount: number;
  status: "processing" | "completed" | "partial_failed";
  sourceType: "manual" | "folder" | "zip" | "email";
}

// --- 案件聚合与定损 ---

/** 跨文档矛盾检测项 */
export interface ConflictItem {
  type:
    | "date_mismatch"
    | "amount_mismatch"
    | "identity_mismatch"
    | "institution_mismatch";
  description: string;
  /** 两份存在矛盾的文件 ID */
  docIds: [string, string];
  severity: "warning" | "error";
}

/** 案件伤情概况（由病历/鉴定报告聚合） */
export interface InjuryProfile {
  injuryDescription: string;
  disabilityLevel?: string;
  hospitalizationDays: number;
  treatmentTimeline: Array<{
    date: string;
    event: string;
    sourceDocId: string;
  }>;
}

/** 定责结果 */
export interface LiabilityResult {
  /** 伤者/被保险人责任比例 0-100 */
  claimantLiabilityPct: number;
  /** 第三方责任比例 0-100 */
  thirdPartyLiabilityPct: number;
  basis: string;
  /** 来源文件（认定书） */
  sourceDocId: string;
}

/** 费用聚合结果 */
export interface ExpenseAggregation {
  medicalTotal: number;
  nursingDays: number;
  lostWorkDays: number;
  /** 月收入（元） */
  monthlyIncome: number;
  transportationTotal: number;
  assessmentFees: number;
  /** 各项聚合结果来自的文件 ID */
  sourceDocIds: string[];
}

/** 定损报告中单项赔偿条目 */
export interface DamageItem {
  id: string;
  category: string;
  itemName: string;
  originalAmount: number;
  approvedAmount: number;
  formula: string;
  basis: string;
  /** 每项赔偿对应的源文件 */
  sourceDocIds: string[];
  sourceAnchors?: SourceAnchor[];
}

/** 完整定损报告 */
export interface DamageReport {
  reportId: string;
  claimCaseId: string;
  generatedAt: string;
  generatedBy: "ai" | "manual";
  items: DamageItem[];
  subTotal: number;
  liabilityAdjustment: number;
  finalAmount: number;
  calculationFormula: string;
  regionalStandards: string;
  reportHtml?: string;
  status: "draft" | "confirmed";
}

/** 人伤案件扩展（在 ClaimCase 基础上增加自动化处理结果） */
export interface ClaimCaseInjury extends ClaimCase {
  injuryProfile?: InjuryProfile;
  liabilityResult?: LiabilityResult;
  expenseAggregation?: ExpenseAggregation;
  conflictsDetected?: ConflictItem[];
  damageReport?: DamageReport;
  importBatches?: ImportBatch[];
}

/** 重复文件检测结果 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: "exact" | "similar";
  /** 相似度 0-1 */
  similarity?: number;
  existingDocumentId?: string;
  existingFileName?: string;
  existingBatchId?: string;
  existingImportedAt?: string;
  message?: string;
}

// --- END: Types for Injury Case Processing ---

// ============================================
// OCR Document Review Types
// ============================================

/** OCR 提取字段值结构 - 包含值、置信度和溯源信息 */
export interface OCRFieldValue {
  value: string | number | boolean | null;
  confidence: number; // 置信度 0-1
  anchor?: SourceAnchor; // 溯源锚点（指向原始文件位置）
  reviewFlag?: ReviewFlag; // 人工复核标记
  approved?: boolean; // 是否已通过人工审核
}

/** OCR 识别结果 */
export interface OCRResult {
  documentId: string; // 文档ID
  materialType: string; // 材料类型ID（如 "mat-1"）
  extractedData: Record<string, OCRFieldValue>; // 提取的字段数据
  overallConfidence: number; // 整体置信度
  extractedAt: string; // 提取时间
  model: string; // 使用的AI模型
  rawOcrText?: string; // 原始OCR文本（可选）
}

/** 修正记录 - 保存每次人工修正的历史 */
export interface CorrectionRecord {
  id: string;
  documentId: string;
  fieldKey: string; // 字段名
  originalValue: string; // 原始值
  correctedValue: string; // 修正后的值
  originalConfidence: number; // 原始置信度
  correctedBy: string; // 修正人ID
  correctedAt: string; // 修正时间
  reason?: string; // 修正原因（可选）
}

/** Schema 解析后的字段定义 */
export interface ParsedSchemaField {
  key: string; // 字段键名
  label: string; // 字段显示名称
  type: "string" | "number" | "boolean" | "date"; // 字段类型
  required: boolean; // 是否必填
  format?: string; // 格式（如 date, email）
  description?: string; // 字段描述
  group?: string; // 所属分组
}

/** 校验规则函数类型 */
export type ValidationRule = (value: any) => string | null;

/** 校验规则集合 */
export interface ValidationRules {
  [key: string]: ValidationRule;
}

/** OCR 审核页面状态 */
export interface ReviewPageState {
  // 数据
  document: ClaimCase | null;
  ocrResult: OCRResult | null;
  materialConfig: ClaimsMaterial | null;
  correctionHistory: CorrectionRecord[];
  parsedFields: ParsedSchemaField[];

  // 表单状态
  formData: Record<string, OCRFieldValue>;
  validationErrors: Record<string, string>;

  // UI状态
  activeField: string | null;
  expandedGroups: string[];
  previewZoom: number;
  isCorrectionDrawerOpen: boolean;
  isSubmitting: boolean;
}
