
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
  name: string; // 标准名称
  type: 'A' | 'B' | 'C' | 'excluded'; // 甲乙丙类或不在目录
  reimbursementRatio?: number; // 报销比例（0-100）
  restrictions?: string; // 使用限制说明
  effectiveDate: string; // 生效日期
  expiryDate?: string; // 失效日期
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

// 发票识别结果（扩展现有 MedicalInvoiceData）
export interface InvoiceAuditResult {
  invoiceId: string;
  ossUrl: string;
  ossKey: string;
  uploadTime: string;
  claimCaseId?: string; // 关联的理赔案件ID

  // OCR 原始数据
  ocrData: MedicalInvoiceData; // 复用 smartclaim-ai-agent 的类型

  // 医院校验结果
  hospitalValidation: {
    hospitalName: string;
    matchedHospital?: HospitalInfo;
    isQualified: boolean; // 是否符合理赔要求
    reason?: string; // 不符合原因
  };

  // 费用明细审核结果
  itemAudits: InvoiceItemAudit[];

  // 汇总统计
  summary: {
    totalAmount: number; // 总金额
    qualifiedAmount: number; // 符合医保目录的金额
    unqualifiedAmount: number; // 不符合的金额
    qualifiedItemCount: number;
    unqualifiedItemCount: number;
    estimatedReimbursement: number; // 预估报销金额
  };

  auditStatus: 'pending' | 'completed' | 'failed';
  auditTime?: string;
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
    matchMethod: 'exact' | 'fuzzy' | 'manual' | 'none';
  };

  // 审核结论
  isQualified: boolean; // 是否符合医保目录
  qualificationReason: string; // 判定依据
  estimatedReimbursement: number; // 预估报销金额
  remarks?: string;
}

export { MedicalInvoiceData };
// --- END: Types for Medical Invoice Audit & Insurance Catalog ---
