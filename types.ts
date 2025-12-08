
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
  mandatory?: boolean;
  id: string;
  name: string;
  amount: string;
  details: string;
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
  mandatory?: boolean;
  item_code: string;
  item_name: string;
  description: string;
  details: HealthCoverageDetailSpec;
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
  selectedResponsibilities?: ResponsibilityItem[];

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

// --- START: Types for Responsibility Management ---
export interface ResponsibilityItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
}
// --- END: Types for Responsibility Management ---
