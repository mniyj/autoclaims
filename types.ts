
export enum ProductStatus {
  DRAFT = '草稿',
  ACTIVE = '生效',
  INACTIVE = '失效',
}

export enum PrimaryCategory {
  HEALTH = '医疗保险',
  ACCIDENT = '意外保险',
  CRITICAL_ILLNESS = '重大疾病保险',
  TERM_LIFE = '定期寿险',
  WHOLE_LIFE = '终身寿险',
  ANNUITY = '年金保险',
}

export enum ClauseType {
  MAIN = '主险',
  RIDER = '附加险',
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
  tagStyles?: Record<string, 'gold' | 'green' | 'red' | 'gray'>;
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

  // New file upload fields
  clauseTextFile?: string;
  rateTableFile?: string;
  productDescriptionFile?: string;
  cashValueTableFile?: string;
  basicSumInsuredTableFile?: string;
  }

export interface HealthAccidentCriticalIllnessProduct extends BaseProduct {
  primaryCategory: PrimaryCategory.HEALTH | PrimaryCategory.ACCIDENT | PrimaryCategory.CRITICAL_ILLNESS;
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

export type InsuranceProduct =
  | HealthAccidentCriticalIllnessProduct
  | TermLifeProduct
  | WholeLifeProduct
  | AnnuityProduct;

// Type for the clause data fetched from the "database"
export type Clause =
  | Omit<HealthAccidentCriticalIllnessProduct, 'marketingName' | 'salesUrl'>
  | Omit<TermLifeProduct, 'marketingName' | 'salesUrl'>
  | Omit<WholeLifeProduct, 'marketingName' | 'salesUrl'>
  | Omit<AnnuityProduct, 'marketingName' | 'salesUrl'>;

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
  status: '生效' | '失效';
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
export interface ClaimsMaterial {
  id: string;
  name: string;
  description: string;
  sampleUrl?: string;
  jsonSchema: string; // JSON string representing the schema to extract
  required: boolean;
  aiAuditPrompt?: string;
}

export interface ClaimItem {
  id: string;
  name: string;
  description: string;
  materialIds: string[]; // IDs of ClaimsMaterial associated with this claim item
}

export interface ProductClaimConfig {
  productCode: string;
  responsibilityConfigs: ResponsibilityClaimConfig[];
}

export interface ResponsibilityClaimConfig {
  responsibilityId: string;
  claimItemIds: string[]; // IDs of ClaimItem associated with this responsibility
}

export enum ClaimStatus {
  REPORTED = '已报案',
  PROCESSING = '处理中',
  PENDING_INFO = '待补传',
  APPROVED = '已结案-给付',
  REJECTED = '已结案-拒赔',
  CANCELLED = '已撤案',
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
  files: { name: string; url: string }[];
}

export interface ClaimRiskIndicator {
  type: 'danger' | 'warning';
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
}
// --- END: Types for Claims Management ---

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

export type IntakeFieldType = 'text' | 'date' | 'time' | 'number' | 'textarea'
  | 'enum' | 'enum_with_other' | 'multi_select' | 'text_with_search' | 'boolean';

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
  mode: 'realtime_or_record';
  slot_filling_prompt?: string;
}

export interface IntakeConfig {
  product_type?: string;
  config_version?: string;
  fields: IntakeField[];
  voice_input: IntakeVoiceInput;
}
// --- END: Types for Claim Intake Configuration ---

// --- START: Types for Ruleset Management ---
export enum RulesetProductLine {
  ACCIDENT = 'ACCIDENT',
  HEALTH = 'HEALTH',
  CRITICAL_ILLNESS = 'CRITICAL_ILLNESS',
  TERM_LIFE = 'TERM_LIFE',
  WHOLE_LIFE = 'WHOLE_LIFE',
  ANNUITY = 'ANNUITY',
}

export enum ExecutionDomain {
  ELIGIBILITY = 'ELIGIBILITY',
  ASSESSMENT = 'ASSESSMENT',
  POST_PROCESS = 'POST_PROCESS',
}

export enum RuleStatus {
  EFFECTIVE = 'EFFECTIVE',
  DISABLED = 'DISABLED',
  DRAFT = 'DRAFT',
}

export enum RuleActionType {
  APPROVE_CLAIM = 'APPROVE_CLAIM',
  REJECT_CLAIM = 'REJECT_CLAIM',
  SET_CLAIM_RATIO = 'SET_CLAIM_RATIO',
  ROUTE_CLAIM_MANUAL = 'ROUTE_CLAIM_MANUAL',
  FLAG_FRAUD = 'FLAG_FRAUD',
  TERMINATE_CONTRACT = 'TERMINATE_CONTRACT',
  APPROVE_ITEM = 'APPROVE_ITEM',
  REJECT_ITEM = 'REJECT_ITEM',
  ADJUST_ITEM_AMOUNT = 'ADJUST_ITEM_AMOUNT',
  SET_ITEM_RATIO = 'SET_ITEM_RATIO',
  FLAG_ITEM = 'FLAG_ITEM',
  APPLY_FORMULA = 'APPLY_FORMULA',
  APPLY_CAP = 'APPLY_CAP',
  APPLY_DEDUCTIBLE = 'APPLY_DEDUCTIBLE',
  SUM_COVERAGES = 'SUM_COVERAGES',
  DEDUCT_PRIOR_BENEFIT = 'DEDUCT_PRIOR_BENEFIT',
  ADD_REMARK = 'ADD_REMARK',
}

export enum RuleCategory {
  COVERAGE_SCOPE = 'COVERAGE_SCOPE',
  EXCLUSION = 'EXCLUSION',
  WAITING_PERIOD = 'WAITING_PERIOD',
  CLAIM_TIMELINE = 'CLAIM_TIMELINE',
  COVERAGE_PERIOD = 'COVERAGE_PERIOD',
  POLICY_STATUS = 'POLICY_STATUS',
  ITEM_CLASSIFICATION = 'ITEM_CLASSIFICATION',
  PRICING_REASONABILITY = 'PRICING_REASONABILITY',
  DISABILITY_ASSESSMENT = 'DISABILITY_ASSESSMENT',
  DEPRECIATION = 'DEPRECIATION',
  PROPORTIONAL_LIABILITY = 'PROPORTIONAL_LIABILITY',
  DEDUCTIBLE = 'DEDUCTIBLE',
  SUB_LIMIT = 'SUB_LIMIT',
  SOCIAL_INSURANCE = 'SOCIAL_INSURANCE',
  BENEFIT_OFFSET = 'BENEFIT_OFFSET',
  AGGREGATE_CAP = 'AGGREGATE_CAP',
  POST_ADJUSTMENT = 'POST_ADJUSTMENT',
}

export enum ConditionOperator {
  EQ = 'EQ',
  NE = 'NE',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  BETWEEN = 'BETWEEN',
  IS_NULL = 'IS_NULL',
  IS_NOT_NULL = 'IS_NOT_NULL',
  IS_TRUE = 'IS_TRUE',
  IS_FALSE = 'IS_FALSE',
  MATCHES_REGEX = 'MATCHES_REGEX',
}

export enum ConditionLogic {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  ALWAYS_TRUE = 'ALWAYS_TRUE',
}

export interface LeafCondition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean | string[] | null;
  value_unit?: string;
}

export interface GroupCondition {
  logic: 'AND' | 'OR' | 'NOT';
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
  depreciation_table?: { age_from_months: number; age_to_months: number; monthly_rate_percent: number }[];
}

export interface RuleExecution {
  domain: ExecutionDomain;
  loop_over: string | null;
  item_alias: string | null;
  item_action_on_reject: 'ZERO_AMOUNT' | 'SKIP_ITEM' | 'FLAG_ITEM' | null;
}

export interface RuleSource {
  source_type: 'CLAUSE' | 'POLICY' | 'REGULATION' | 'AI_GENERATED' | 'MANUAL';
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
  generated_by: 'AI_PARSING' | 'MANUAL_ENTRY' | 'HYBRID';
  ai_model?: string;
  total_rules: number;
  rules_by_domain?: {
    eligibility: number;
    assessment: number;
    post_process: number;
  };
  low_confidence_rules?: number;
  unresolved_conflicts?: number;
  audit_trail?: {
    timestamp: string;
    user_id: string;
    action: string;
    details?: string;
  }[];
}

export interface InsuranceRuleset {
  ruleset_id: string;
  product_line: RulesetProductLine;
  policy_info: RulesetPolicyInfo;
  rules: RulesetRule[];
  execution_pipeline: ExecutionPipeline;
  override_chains: OverrideChain[];
  field_dictionary: Record<string, FieldDefinition>;
  metadata: RulesetMetadata;
}
// --- END: Types for Ruleset Management ---

// --- START: Types for Medical Invoice Audit & Insurance Catalog ---
// Import MedicalInvoiceData from smartclaim-ai-agent
import type { MedicalInvoiceData } from './smartclaim-ai-agent/types';

// 医保目录相关类型
export interface MedicalInsuranceCatalogItem {
  id: string;
  province: string; // 省份代码，如 "beijing", "shanghai", "national"（国家目录）
  category: 'drug' | 'treatment' | 'material'; // 药品/诊疗项目/耗材
  code: string; // 医保编码
  name: string; // 标准名称（通用名）
  type: 'A' | 'B' | 'C' | 'excluded'; // 甲乙丙类或不在目录
  reimbursementRatio?: number; // 报销比例（0-100）
  restrictions?: string; // 使用限制说明
  effectiveDate: string; // 生效日期
  expiryDate?: string; // 失效日期

  // 名称兼容化字段 - 用于处理发票名称与目录名称不一致
  aliases?: string[];           // 别名列表（商品名、曾用名、常见缩写等）
  genericName?: string;         // 药品通用名（国际非专利药名对应的中文名）
  specifications?: string;      // 规格型号
  dosageForm?: string;          // 剂型
  manufacturer?: string;        // 生产厂家
}

// 医院等级数据
export interface HospitalInfo {
  id: string;
  name: string; // 医院名称
  province: string;
  city: string;
  level: '三级甲等' | '三级乙等' | '二级甲等' | '二级乙等' | '一级' | '未定级' | '民营';
  type: '公立' | '民营';
  address?: string;
  qualifiedForInsurance: boolean; // 是否符合保险理赔要求（公立二级及以上）
}

// 增加 AI 交互日志类型定义
export interface AIInteractionLog {
  model: string;
  prompt: string;
  response: string;
  duration: number;
  timestamp: string;
  usageMetadata?: any;
  timing?: {
    ocrDuration?: number;      // OCR 识别耗时 (ms)
    parsingDuration?: number;  // 大模型格式化耗时 (ms)
    totalDuration?: number;    // 总耗时 (ms)
  };
  errorMessage?: string;       // 错误信息（如果失败）
  statusCode?: number;         // HTTP 状态码
}

export interface StepLog {
  step: 'ocr' | 'hospital' | 'catalog' | 'summary' | 'upload' | 'catalog_fetch' | 'catalog_sync' | 'catalog_ai' | 'saving';
  input: any;
  output: any;
  duration: number;
  timestamp: string;
}

/** 审核子步骤耗时记录（用于前端展示） */
export interface StepTiming {
  step: string;       // 步骤标识，与 AuditStep 对应
  label: string;      // 中文显示名称
  startTime: number;  // Date.now() 开始时间戳
  endTime?: number;   // Date.now() 结束时间戳（undefined 表示进行中）
  duration?: number;  // 耗时毫秒（endTime - startTime）
  detail?: string;    // 额外描述（如 "3/5 张图片"）
}

/** 单张图片的 OCR 识别结果（多图模式下使用） */
export interface InvoiceImageOcrResult {
  imageIndex: number;           // 图片在上传组中的序号（0-based）
  ossUrl: string;               // 图片 OSS URL
  ossKey: string;               // 图片 OSS Key
  fileName: string;             // 原始文件名
  documentType: 'summary_invoice' | 'detail_list' | 'single_invoice';
  ocrData: MedicalInvoiceData;  // 该图片的 OCR 识别结果
  aiLog?: AIInteractionLog;     // 该图片的 AI 交互日志
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
  auditStatus: 'processing' | 'completed' | 'failed';
  auditTime?: string;
  errorMessage?: string;
  
  // AI Log
  aiLog?: AIInteractionLog;
  // Step Logs
  stepLogs?: StepLog[];
  // Validation Warnings (OCR 后置验证结果)
  validationWarnings?: ValidationWarning[];

  // 多图支持
  imageCount?: number;                                         // 图片数量（1=单图，>1=多图）
  imageOcrResults?: InvoiceImageOcrResult[];                    // 每张图片的独立 OCR 结果
  summaryChargeItems?: MedicalInvoiceData['chargeItems'];      // 汇总发票大类项目（仅参考，不参与审核）
  crossValidation?: {                                          // 汇总 vs 明细金额交叉验证
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
  materialType: string;       // 材料类型 ID（如 "mat-1"）
  materialName: string;       // 材料名称（如 "身份证正面"）
  ossUrl: string;
  ossKey: string;
  uploadTime: string;

  // OCR 提取的结构化数据（根据材料 jsonSchema 提取）
  extractedData: Record<string, any>;

  // AI 审核结论
  auditConclusion: string;    // AI 给出的审核结论文本
  auditStatus: 'completed' | 'failed';
  errorMessage?: string;

  // 日志
  aiLog?: AIInteractionLog;
  stepTimings?: StepTiming[];
}

// OCR 后置验证警告
export interface ValidationWarning {
  type: 'duplicate_item' | 'amount_mismatch' | 'total_mismatch' | 'insurance_balance' | 'abnormal_value' | 'summary_detail_mismatch';
  severity: 'info' | 'warning' | 'error';
  message: string;
  details?: {
    field?: string;
    expected?: number;
    actual?: number;
    difference?: number;
    items?: string[];  // 涉及的项目名称
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
    matchMethod: 'exact' | 'alias' | 'fuzzy' | 'ai' | 'manual' | 'none';
  };

  // 审核结论
  isQualified: boolean; // 是否符合医保目录
  qualificationReason: string; // 判定依据
  estimatedReimbursement: number; // 预估报销金额
  remarks?: string;
}

export { MedicalInvoiceData };
// --- END: Types for Medical Invoice Audit & Insurance Catalog ---

// --- START: Types for User Operation Logs ---
// 用户操作类型枚举（涵盖所有C端用户操作）
export enum UserOperationType {
  LOGIN = 'LOGIN',                          // 用户登录
  LOGOUT = 'LOGOUT',                        // 用户登出
  REPORT_CLAIM = 'REPORT_CLAIM',            // 提交报案
  UPLOAD_FILE = 'UPLOAD_FILE',              // 上传文件
  DELETE_FILE = 'DELETE_FILE',              // 删除文件
  VIEW_FILE = 'VIEW_FILE',                  // 查看文件
  SEND_MESSAGE = 'SEND_MESSAGE',            // 发送消息
  RECEIVE_MESSAGE = 'RECEIVE_MESSAGE',      // 接收消息
  VIEW_PROGRESS = 'VIEW_PROGRESS',          // 查看进度
  VIEW_CLAIM_DETAIL = 'VIEW_CLAIM_DETAIL',  // 查看赔案详情
  SUBMIT_FORM = 'SUBMIT_FORM',              // 提交表单
  UPDATE_PROFILE = 'UPDATE_PROFILE',        // 更新资料
  ANALYZE_DOCUMENT = 'ANALYZE_DOCUMENT',    // 文档分析
  QUICK_ANALYZE = 'QUICK_ANALYZE',          // 快速分析
  VOICE_TRANSCRIPTION = 'VOICE_TRANSCRIPTION', // 语音转写
  LIVE_AUDIO_SESSION = 'LIVE_AUDIO_SESSION',   // 实时语音会话
}

// 用户操作日志主类型
export interface UserOperationLog {
  logId: string;                    // 格式: log-YYYYMMDDHHMMSS-random
  timestamp: string;                // ISO时间戳

  // 用户标识
  userName: string;                 // 用户名（来自登录）
  userGender?: string;              // 用户性别
  sessionId?: string;               // 浏览器会话ID（用于追踪匿名用户）

  // 操作详情
  operationType: UserOperationType; // 操作类型
  operationLabel: string;           // 操作描述（中文）

  // 关联上下文
  claimId?: string;                 // 关联的理赔案件ID
  claimReportNumber?: string;       // 理赔报案号
  currentStatus?: string;           // 案件当前状态

  // 数据记录
  inputData?: Record<string, any>;  // 输入数据（表单、参数等）
  outputData?: Record<string, any>; // 输出数据（结果、响应等）

  // AI交互（如果涉及AI调用）
  aiInteractions?: AIInteractionLog[]; // AI调用记录数组

  // 性能指标
  duration?: number;                // 操作总耗时（毫秒）
  success: boolean;                 // 操作是否成功
  errorMessage?: string;            // 错误信息（如果失败）

  // 技术信息
  userAgent?: string;               // 浏览器UA
  deviceType?: 'mobile' | 'desktop' | 'tablet';

  // 扩展字段
  metadata?: Record<string, any>;   // 其他元数据
}
// --- END: Types for User Operation Logs ---
