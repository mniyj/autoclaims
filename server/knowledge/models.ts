export const EntityType = {
  DRUG: 'drug',
  SERVICE_ITEM: 'service_item',
  DISEASE: 'disease',
  HOSPITAL: 'hospital',
  POLICY_RULE: 'policy_rule'
} as const;

export type EntityType = typeof EntityType[keyof typeof EntityType];

export const DataStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  DEPRECATED: 'deprecated'
} as const;

export type DataStatus = typeof DataStatus[keyof typeof DataStatus];

export interface DrugMaster {
  drug_id: string;
  generic_name: string;
  brand_name?: string;
  aliases: string[];
  dosage_form?: string;
  spec?: string;
  package?: string;
  manufacturer?: string;
  nhsa_code?: string;
  nmpa_approval_no?: string;
  reimbursement_flag?: '甲类' | '乙类' | '丙类' | '自费';
  reimbursement_restriction?: string;
  indications?: string;
  dose_min?: number;
  dose_max?: number;
  course_min?: number;
  course_max?: number;
  route?: string;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
  created_at: string;
  updated_at: string;
}

export interface ServiceItemMaster {
  item_id: string;
  standard_name: string;
  aliases: string[];
  local_names: string[];
  item_category: string;
  sub_category?: string;
  local_item_code?: string;
  price_low?: number;
  price_high?: number;
  unit?: string;
  applicable_conditions?: string;
  frequency_min?: number;
  frequency_max?: number;
  course_min?: number;
  course_max?: number;
  department?: string;
  inpatient_flag: boolean;
  outpatient_flag: boolean;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
  created_at: string;
  updated_at: string;
}

export interface DiseaseMaster {
  disease_id: string;
  standard_name: string;
  aliases: string[];
  icd_code?: string;
  severity_level?: '轻微' | '一般' | '严重' | '危重';
  common_tests?: string[];
  common_treatments?: string[];
  common_drugs?: string[];
  typical_los_min?: number;
  typical_los_max?: number;
  inpatient_necessity_flag?: boolean;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
  created_at: string;
  updated_at: string;
}

export interface HospitalMaster {
  hospital_id: string;
  standard_name: string;
  aliases: string[];
  province: string;
  city: string;
  district?: string;
  level?: '三级甲等' | '三级乙等' | '三级' | '二级甲等' | '二级乙等' | '二级' | '一级' | '社区卫生中心';
  ownership_type?: '公立' | '私立' | '合资';
  contract_flag?: boolean;
  risk_score?: number;
  address?: string;
  phone?: string;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
  created_at: string;
  updated_at: string;
}

export interface PolicyRuleMaster {
  rule_id: string;
  product_id: string;
  product_code?: string;
  product_name?: string;
  coverage_type: string;
  exclusion_type?: string;
  hospital_scope?: string;
  deductible?: number;
  deductible_type?: '绝对免赔额' | '相对免赔额' | '比例免赔' | '累积免赔';
  reimbursement_ratio?: number;
  annual_limit?: number;
  per_accident_limit?: number;
  special_drug_flag?: boolean;
  effective_date: string;
  expiry_date?: string;
  status: DataStatus;
  version: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface AliasMapping {
  alias_id: string;
  alias_text: string;
  entity_type: EntityType;
  entity_id: string;
  entity_name?: string;
  source: string;
  confidence: number;
  status: DataStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const RelationType = {
  RECOMMENDED: 'recommended',
  OPTIONAL: 'optional',
  NOT_RECOMMENDED: 'not_recommended',
  CONTRAINDICATED: 'contraindicated',
  REQUIRED: 'required',
  COMMON: 'common'
} as const;

export type RelationType = typeof RelationType[keyof typeof RelationType];

export interface DiseaseDrugRelation {
  rel_id: string;
  disease_id: string;
  drug_id: string;
  rel_type: RelationType;
  evidence_level?: number;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
}

export interface DiseaseServiceRelation {
  rel_id: string;
  disease_id: string;
  item_id: string;
  rel_type: RelationType;
  evidence_level?: number;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
}

export interface SurgeryComboRelation {
  rel_id: string;
  surgery_item_id: string;
  related_item_id: string;
  combo_type: string;
  required_flag: boolean;
  confidence: number;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
}

export interface PolicyCoverageRelation {
  rel_id: string;
  product_id: string;
  coverage_type: string;
  entity_type: EntityType;
  entity_id: string;
  coverage_action: 'cover' | 'exclude' | 'limit';
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
}

export const ReasonabilityRuleType = {
  DIAGNOSIS_DRUG_MATCH: 'diagnosis_drug_match',
  DIAGNOSIS_SERVICE_MATCH: 'diagnosis_service_match',
  DOSAGE_REASONABILITY: 'dosage_reasonability',
  FREQUENCY_REASONABILITY: 'frequency_reasonability',
  HOSPITALIZATION_NECESSITY: 'hospitalization_necessity'
} as const;

export type ReasonabilityRuleType = typeof ReasonabilityRuleType[keyof typeof ReasonabilityRuleType];

export interface ReasonabilityRule {
  rule_id: string;
  subject_type: 'disease';
  subject_id: string;
  subject_name?: string;
  object_type: EntityType;
  object_id?: string;
  object_name?: string;
  rule_type: ReasonabilityRuleType;
  condition_expr?: string;
  threshold?: number;
  action: 'approve' | 'manual_review' | 'reject' | 'warning';
  reason_code: string;
  priority: number;
  source: string;
  version: string;
  valid_from: string;
  valid_to?: string;
  status: DataStatus;
}

export const EvidenceNodeType = {
  CONTRACT: 'contract',
  DIAGNOSIS: 'diagnosis',
  DRUG: 'drug',
  SERVICE: 'service',
  AMOUNT: 'amount',
  RULE: 'rule',
  MODEL: 'model',
  CONCLUSION: 'conclusion'
} as const;

export type EvidenceNodeType = typeof EvidenceNodeType[keyof typeof EvidenceNodeType];

export const EvidenceEdgeType = {
  SUPPORTS: 'supports',
  CONTRADICTS: 'contradicts',
  TRIGGERS: 'triggers',
  DERIVED_FROM: 'derived_from',
  EXCEEDS_THRESHOLD: 'exceeds_threshold',
  MATCHES_POLICY: 'matches_policy'
} as const;

export type EvidenceEdgeType = typeof EvidenceEdgeType[keyof typeof EvidenceEdgeType];

export interface EvidenceNode {
  node_id: string;
  case_id: string;
  node_type: EvidenceNodeType;
  label: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface EvidenceEdge {
  edge_id: string;
  case_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: EvidenceEdgeType;
  weight?: number;
  created_at: string;
}

export interface RawFileRecord {
  file_id: string;
  source_name: string;
  source_url?: string;
  file_name: string;
  file_type: 'pdf' | 'excel' | 'word' | 'html' | 'csv';
  file_hash: string;
  publish_date?: string;
  download_date: string;
  parser_version?: string;
  data_version?: string;
  status: DataStatus;
  created_at: string;
}
