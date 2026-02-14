
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

// --- START: Types for Ruleset Management ---

export enum RulesetProductLine {
  AUTO = 'AUTO',
  ACCIDENT = 'ACCIDENT',
  HEALTH = 'HEALTH',
  PROPERTY = 'PROPERTY',
  LIABILITY = 'LIABILITY',
}

export enum ExecutionDomain {
  ELIGIBILITY = 'ELIGIBILITY',
  ASSESSMENT = 'ASSESSMENT',
  POST_PROCESS = 'POST_PROCESS',
}

export enum RuleStatus {
  EFFECTIVE = 'EFFECTIVE',
  OVERRIDDEN = 'OVERRIDDEN',
  EXPIRED = 'EXPIRED',
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  DISABLED = 'DISABLED',
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
  E_LIABILITY_TRIGGER = 'E_LIABILITY_TRIGGER',
  E_EXCLUSION = 'E_EXCLUSION',
  E_OCCUPATION_CHECK = 'E_OCCUPATION_CHECK',
  E_POLICY_STATUS = 'E_POLICY_STATUS',
  E_PAYOUT_RATIO = 'E_PAYOUT_RATIO',
  E_ANTI_FRAUD = 'E_ANTI_FRAUD',
  A_PROVIDER_QUALIFY = 'A_PROVIDER_QUALIFY',
  A_ITEM_EXCLUSION = 'A_ITEM_EXCLUSION',
  A_ITEM_NECESSITY = 'A_ITEM_NECESSITY',
  A_ITEM_PRICING = 'A_ITEM_PRICING',
  A_ITEM_SOCIAL_INSURANCE = 'A_ITEM_SOCIAL_INSURANCE',
  A_ITEM_DEPRECIATION = 'A_ITEM_DEPRECIATION',
  A_ITEM_DEDUCTIBLE = 'A_ITEM_DEDUCTIBLE',
  P_COMPENSATION_DEDUCT = 'P_COMPENSATION_DEDUCT',
  P_CUMULATIVE_CAP = 'P_CUMULATIVE_CAP',
  P_DEDUCTIBLE = 'P_DEDUCTIBLE',
  P_LIABILITY_APPLY = 'P_LIABILITY_APPLY',
  P_MULTI_COVERAGE = 'P_MULTI_COVERAGE',
  P_PRIOR_BENEFIT_DEDUCT = 'P_PRIOR_BENEFIT_DEDUCT',
}

export enum ConditionOperator {
  EQ = 'EQ',
  NEQ = 'NEQ',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  BETWEEN = 'BETWEEN',
  NOT_BETWEEN = 'NOT_BETWEEN',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  IS_NULL = 'IS_NULL',
  IS_NOT_NULL = 'IS_NOT_NULL',
  IS_TRUE = 'IS_TRUE',
  IS_FALSE = 'IS_FALSE',
  MATCHES = 'MATCHES',
}

export enum ConditionLogic {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  SINGLE = 'SINGLE',
  ALWAYS_TRUE = 'ALWAYS_TRUE',
}

export interface LeafCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
  value_unit?: string | null;
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
  reduction_ratio?: number;
  deductible_amount?: number;
  cap_field?: string;
  cap_amount?: number;
  social_insurance_ratio?: number;
  non_social_insurance_ratio?: number;
  fraud_risk_score?: number;
  route_reason?: string;
  remark_template?: string;
  formula?: {
    expression: string;
    output_field: string;
  };
  disability_grade_table?: Array<{
    grade: number;
    payout_ratio: number;
  }>;
  depreciation_table?: Array<{
    age_from_months: number;
    age_to_months: number;
    monthly_rate_percent: number;
  }>;
  pricing_reference?: {
    source: string;
    tolerance_percent: number;
  };
}

export interface RuleAction {
  action_type: RuleActionType;
  params: RuleActionParams;
}

export interface RuleExecution {
  domain: ExecutionDomain;
  loop_over?: string | null;
  item_alias?: string | null;
  item_action_on_reject?: 'ZERO_AMOUNT' | 'SKIP_ITEM' | 'FLAG_ITEM' | null;
}

export interface RuleSource {
  source_type: 'STANDARD_CLAUSE' | 'ADDITIONAL_CLAUSE' | 'SPECIAL_AGREEMENT' | 'ENDORSEMENT' | 'REGULATORY';
  source_ref: string;
  source_text: string;
  clause_code?: string | null;
  page_location?: {
    page: number;
    bbox: number[];
  } | null;
}

export interface RulePriority {
  level: 1 | 2 | 3 | 4;
  level_label: 'MAIN_CLAUSE' | 'ADDITIONAL_CLAUSE' | 'SPECIAL_AGREEMENT' | 'REGULATORY';
  rank: number;
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
  execution: RuleExecution;
  source: RuleSource;
  priority: RulePriority;
  category: RuleCategory;
  applies_to?: {
    coverage_codes: string[];
  };
  conditions: RuleConditions;
  action: RuleAction;
  status: RuleStatus;
  overridden_by?: string | null;
  override_reason?: string | null;
  tags?: string[];
  parsing_confidence?: ParsingConfidence;
}

export interface DomainConfig {
  domain: ExecutionDomain;
  label: string;
  execution_mode: 'SEQUENTIAL_SHORT_CIRCUIT' | 'LOOP_PER_ITEM' | 'SEQUENTIAL_AGGREGATE';
  input_granularity?: 'CLAIM_LEVEL' | 'ITEM_LEVEL' | 'AGGREGATE_LEVEL';
  loop_collection?: string | null;
  short_circuit_on?: string[] | null;
  category_sequence: string[];
}

export interface ExecutionPipeline {
  domains: DomainConfig[];
}

export interface OverrideChainItem {
  rule_id: string;
  priority_level: number;
  status: string;
  summary: string;
}

export interface OverrideChain {
  chain_id: string;
  topic: string;
  affected_domain?: ExecutionDomain;
  chain: OverrideChainItem[];
  effective_rule_id: string;
  conflict_type: 'OVERRIDE' | 'SAME_PRIORITY_CONFLICT' | 'COMPLEMENT';
  resolution?: Record<string, unknown> | null;
}

export interface FieldDefinition {
  label: string;
  data_type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'ENUM' | 'ARRAY';
  scope: 'CLAIM_LEVEL' | 'ITEM_LEVEL' | 'POLICY_LEVEL' | 'CALCULATED';
  applicable_domains: ExecutionDomain[];
  enum_values?: Array<{
    code: string;
    label: string;
  }>;
  source: string;
}

export interface RulesetPolicyInfo {
  policy_no: string;
  product_code: string;
  product_name: string;
  plan_name?: string | null;
  insurer: string;
  effective_date: string;
  expiry_date: string;
  payment_mode?: 'ANNUAL' | 'MONTHLY' | 'SINGLE';
  insured_subject?: Record<string, unknown>;
  clause_versions?: Array<Record<string, unknown>>;
  coverages: Array<Record<string, unknown>>;
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
  rules_by_status?: {
    effective: number;
    overridden: number;
  };
  unresolved_conflicts?: number;
  low_confidence_rules?: number;
  audit_trail?: Array<{
    timestamp: string;
    action: string;
    user_id: string;
    details: string;
  }>;
}

export interface InsuranceRuleset {
  ruleset_id: string;
  product_line: RulesetProductLine;
  policy_info: RulesetPolicyInfo;
  rules: RulesetRule[];
  override_chains: OverrideChain[];
  field_dictionary: Record<string, FieldDefinition>;
  execution_pipeline: ExecutionPipeline;
  metadata: RulesetMetadata;
}
// --- END: Types for Ruleset Management ---
