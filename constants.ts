
import { type Clause, PrimaryCategory, ProductStatus, ClauseType, InsuranceCompanyProfile, CompanyListItem, IndustryData, CitySalaryData, CriticalIllnessRateData, AccidentRateData, DeathRateData, HospitalizationRateData, OutpatientRateData, InsuranceCategoryMapping, CategoryDefinition, EndUser, ResponsibilityItem, ClaimsMaterial, ClaimItem, ProductClaimConfig, ClaimCase, ClaimStatus, type InsuranceRuleset, RulesetProductLine, ExecutionDomain, RuleStatus, RuleActionType, RuleCategory, ConditionLogic, ConditionOperator, type IntakeField } from './types';

export const PRODUCT_STATUSES = Object.values(ProductStatus);
export const PRIMARY_CATEGORIES = Object.values(PrimaryCategory);
export const CLAUSE_TYPES = Object.values(ClauseType);
export const MOCK_COMPANIES = ['众安', '人保健康', '人保寿险', '阳光人寿', '国泰', '新华人寿', '太保寿险', '太平人寿', '中意人寿', '信泰人寿', '中邮人寿', '工银安盛'];

export const REGULATORY_OPTIONS = [
  {
    code: '13000',
    name: '寿险',
    children: [
      { code: '13100', name: '定期寿险' },
      { code: '13200', name: '终身寿险' },
      { code: '13300', name: '两全保险' },
    ]
  },
  {
    code: '14000',
    name: '年金险',
    children: [
      { code: '14100', name: '普通年金保险' },
      { code: '14200', name: '养老年金保险' },
    ]
  },
  {
    code: '15000',
    name: '健康险',
    children: [
      { code: '15100', name: '医疗保险' },
      { code: '15200', name: '重疾保险' },
      { code: '15300', name: '护理保险' },
      { code: '15400', name: '失能保险' },
    ]
  },
  {
    code: '16000',
    name: '意外险',
    children: [
      { code: '16000', name: '意外伤害保险' },
    ]
  },
];

export const MOCK_RESPONSIBILITIES: ResponsibilityItem[] = [
  {
    id: 'resp-1',
    code: 'GENERAL_HOSPITALIZATION',
    name: '住院医疗费用',
    category: '医疗保险',
    description: '住院治疗费用报销'
  },
  {
    id: 'resp-2',
    code: 'OUT_HOSPITAL_DRUG',
    name: '院外特效药费用',
    category: '医疗保险',
    description: '院外特效药清单覆盖'
  },
  {
    id: 'resp-3',
    code: 'CRITICAL_ILLNESS_MEDICAL',
    name: '重疾医疗费用',
    category: '医疗保险',
    description: '重大疾病相关住院及门诊治疗费用报销'
  },
  {
    id: 'resp-4',
    code: 'OUTPATIENT_MEDICAL',
    name: '门急诊医疗费用',
    category: '医疗保险',
    description: '普通门诊与急诊检查、药品、治疗费用报销'
  },
  {
    id: 'resp-5',
    code: 'MAJOR_CI',
    name: '重大疾病保险金',
    category: '重大疾病保险',
    description: '确诊合同约定的重大疾病一次性给付保险金'
  },
  {
    id: 'resp-6',
    code: 'MID_CI',
    name: '中症保险金',
    category: '重大疾病保险',
    description: '确诊中症一次性给付保险金'
  },
  {
    id: 'resp-7',
    code: 'MINOR_CI',
    name: '轻症保险金',
    category: '重大疾病保险',
    description: '确诊轻症一次性给付保险金'
  },
  {
    id: 'resp-8',
    code: 'CANCER_MULTIPAY',
    name: '癌症多次赔付',
    category: '重大疾病保险',
    description: '满足间隔期条件的癌症多次给付'
  },
  {
    id: 'resp-9',
    code: 'DEATH_BENEFIT',
    name: '身故保险金',
    category: '定期寿险',
    description: '保障期内身故给付保险金'
  },
  {
    id: 'resp-10',
    code: 'INCOME_PROTECTION',
    name: '收入保障金',
    category: '定期寿险',
    description: '保障期内按月给付固定收入保障'
  },
  {
    id: 'resp-11',
    code: 'PREMIUM_WAIVER',
    name: '保费豁免',
    category: '重大疾病保险',
    description: '确诊轻/中/重症后豁免剩余保险费'
  },
  {
    id: 'resp-12',
    code: 'ACCIDENT_DEATH',
    name: '意外身故',
    category: '意外保险',
    description: '发生意外导致身故给付保险金'
  },
  {
    id: 'resp-13',
    code: 'ACCIDENT_DISABILITY',
    name: '意外伤残',
    category: '意外保险',
    description: '意外伤残按等级给付保险金'
  },
  {
    id: 'resp-14',
    code: 'ACCIDENT_MEDICAL',
    name: '意外医疗',
    category: '意外保险',
    description: '意外导致的门诊、住院医疗费用报销'
  },
  {
    id: 'resp-15',
    code: 'FRACTURE_ALLOWANCE',
    name: '骨折津贴',
    category: '意外保险',
    description: '意外骨折按次给付津贴'
  },
  {
    id: 'resp-16',
    code: 'ANNUITY_PAYOUT',
    name: '年金领取',
    category: '年金保险',
    description: '自约定起领日按期给付养老金'
  },
  {
    id: 'resp-17',
    code: 'SURVIVAL_BENEFIT',
    name: '生存金给付',
    category: '年金保险',
    description: '在约定节点给付生存金'
  },
  {
    id: 'resp-18',
    code: 'CASH_VALUE',
    name: '现金价值保障',
    category: '终身寿险',
    description: '保单现金价值随时间增长'
  }
];

export const initialProductState: Clause = {
    productCode: '',
    regulatoryName: '',
    companyName: '',
    version: '1.0',
    salesRegions: '全国（不含港澳台）',
    effectiveDate: new Date().toISOString().split('T')[0],
    discontinuationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0],
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.HEALTH,
    secondaryCategory: '',
    clauseType: ClauseType.MAIN,
    coverageDetails: [],
    underwritingAge: '',
    coveragePeriod: '',
    waitingPeriod: '',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: [],
    productSummary: '',
    operator: '系统管理员',
    coverageArea: '',
    hospitalScope: '',
    claimScope: '',
    occupationScope: '1-4类职业',
    hesitationPeriod: '15天',
    policyEffectiveDate: 'T+1',
    purchaseLimit: 1,
    annualPremium: 0,
    valueAddedServices: [],
    tags: [],
    promoTag: '',
    cardMetric1Label: '保额',
    cardMetric1Value: '',
    cardMetric2Label: '保障期限',
    cardMetric2Value: '',
    cardMetric3Label: '投保年龄',
    cardMetric3Value: '',
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: '',
    rateTableFile: '',
    productDescriptionFile: '',
    cashValueTableFile: '',
};

export const MOCK_CLAUSES: Clause[] = [
  {
    productCode: 'HOS2024-A',
    regulatoryName: '超级健康医疗保险（2024版）',
    companyName: '人保健康',
    version: '2.1',
    salesRegions: '全国（不含港澳台）',
    effectiveDate: '2024-01-01',
    discontinuationDate: '2028-12-31',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.HEALTH,
    secondaryCategory: '住院医疗',
    primaryCategoryCode: 'A',
    secondaryCategoryCode: 'A01',
    racewayId: 'A0101', racewayName: '短期百万医疗',
    clauseType: ClauseType.MAIN,
    operator: '张三',
    coverageDetails: [
      { mandatory: true, id: '1', name: '一般医疗保险金', amount: '200万', details: '含住院、特殊门诊、外购药等费用。' },
      { mandatory: true, id: '2', name: '重疾医疗保险金', amount: '400万', details: '120种重大疾病医疗费用保障。' }
    ],
    coveragePlans: [
      {
        planType: '标准版',
        annualLimit: 6000000,
        guaranteedRenewalYears: 0,
      coverageDetails: [
          { mandatory: true, item_code: 'GENERAL_MEDICAL', item_name: '一般医疗保险金', description: '含住院、特殊门诊、外购药等费用。', details: { limit: 2000000, deductible: 10000, reimbursement_ratio: 1, hospital_requirements: '二级及以上公立医院', coverage_scope: '住院费用/特殊门诊/外购药' } },
          { mandatory: true, item_code: 'CRITICAL_ILLNESS_MEDICAL', item_name: '重疾医疗保险金', description: '120种重大疾病医疗费用保障。', details: { limit: 4000000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '二级及以上公立医院', coverage_scope: '重疾相关治疗费用' } }
      ]
      }
    ],
    underwritingAge: '30天 - 60周岁',
    coveragePeriod: '1年',
    coverageArea: '中国大陆',
    hospitalScope: '二级及以上公立医院',
    claimScope: '不限社保',
    occupationScope: '1-4类职业',
    hesitationPeriod: '15天',
    waitingPeriod: '30天（一般疾病），90天（特殊疾病）',
    policyEffectiveDate: 'T+1',
    purchaseLimit: 1,
    annualPremium: 300,
    valueAddedServices: [
        { id: 'vas1', name: '图文咨询服务', description: '用户可通过图文咨询的方式与医生进行一对一交流，医生为被保险人提供图文问诊、疾病诊断、用药处方等诊疗服务。服务时间每日9：00-21：00，精神类或心理咨询不在服务范围。客户可通过“众安互联网医院”微信小程序选择“健康咨询”使用。' },
        { id: 'vas2', name: '视频问诊服务', description: '为被保险人提供视频问诊服务，每日9:00-21:00不限次使用。金牌医生快速接诊，提供1对1视频交流、疾病诊断、用药处方等诊疗服务（精神类或心理咨询不在服务范围）。金牌医生均具备国家专业医师资格证书，平均5年以上临床经验，保障问诊安全。客户可通过“众安互联网医院”微信小程序选择“视频问诊”使用。' },
        { id: 'vas4', name: '医疗垫付服务', description: '若您在保险期间内等待期后（意外无等待期），在垫付服务覆盖城市中二级及以上的公立医院发生住院，且预估或实际住院费用需求超过产品免赔额需个人承担的医疗费用部分，可以申请进行垫付服务，垫付服务覆盖全国83个城市中的二级及以上公立医院（仅覆盖市区范围，城市下属的县、社区、镇、村等医院暂不支持）。\n客户可通过众安健康微信小程序、众安保险APP、众安健康微信公众号内在线申请医疗垫付或拨打客服电话952299或1010-9955提出垫付服务申请。服务专员联系客户收集材料，了解客户就医需求和费用情况，协助客户完成相关资料填写。' }
    ],
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['超级健康医疗保险条款.pdf'],
    productSummary: '这是一款覆盖广泛、保障全面的百万医疗险产品。',
    tags: ['医疗垫付', '就医绿通'],
    promoTag: '百万医疗险人手一份',
    cardMetric1Label: '总保额',
    cardMetric1Value: '最高600万',
    cardMetric2Label: '保障期限',
    cardMetric2Value: '1年',
    cardMetric3Label: '投保年龄',
    cardMetric3Value: '30天-60岁',
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: '超级健康医疗保险条款_v2.1.pdf',
    rateTableFile: '医疗险费率表_2024.xlsx',
    productDescriptionFile: '超级健康产品说明.pdf',
    cashValueTableFile: '',
  },
  {
    productCode: 'GCLIFE_MED_2025_A',
    regulatoryName: '中意优护百万医疗保险（2025版）',
    companyName: '中意人寿',
    version: '1.0',
    salesRegions: '全国（不含港澳台）',
    effectiveDate: '2025-06-01',
    discontinuationDate: '',
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.HEALTH,
    secondaryCategory: '住院医疗',
    primaryCategoryCode: 'A',
    secondaryCategoryCode: 'A01',
    racewayId: 'A0102', racewayName: '长期医疗',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: 'gen', name: '一般医疗保险金', amount: '300万', details: '含住院、特殊门诊、外购药等费用。' },
      { mandatory: true, id: 'cri', name: '重疾医疗保险金', amount: '600万', details: '120种重大疾病医疗费用保障。' }
    ],
    underwritingAge: '30天 - 65周岁',
    coveragePeriod: '1年',
    coverageArea: '中国大陆',
    hospitalScope: '二级及以上公立医院普通部',
    claimScope: '经社保结算后100%',
    occupationScope: '1-4类职业',
    hesitationPeriod: '15天',
    waitingPeriod: '30天（一般疾病），90天（特定疾病）',
    policyEffectiveDate: 'T+1',
    purchaseLimit: 1,
    annualPremium: 399,
    valueAddedServices: [
      { id: 'vas1', name: '就医绿色通道', description: '提供三甲医院就医协调、专家门诊加号服务。' },
      { id: 'vas2', name: '医疗垫付', description: '住院期间符合条件的医疗费用可申请垫付。' },
      { id: 'vas3', name: '特药服务', description: '覆盖院外特药清单，提供药品配送与用药指导。' }
    ],
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['中意优护百万医疗保险（2025版）条款.pdf'],
    productSummary: '保证续保3年，涵盖住院、门诊特需与院外特药，安心就医。',
    tags: ['就医绿通', '医疗垫付'],
    promoTag: '百万医疗守护家人',
    cardMetric1Label: '总保额',
    cardMetric1Value: '最高600万',
    cardMetric2Label: '免赔额',
    cardMetric2Value: '1万元/年',
    cardMetric3Label: '投保年龄',
    cardMetric3Value: '30天-65岁',
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: '中意优护百万医疗保险条款_2025.pdf',
    rateTableFile: '医疗险费率表_中意_2025.xlsx',
    productDescriptionFile: '产品说明.pdf',
    cashValueTableFile: '',
    deductible: '年免赔额1万元',
    renewalWarranty: '保证续保3年',
    outHospitalMedicine: '院外特药100种，最高200万',
    healthConditionNotice: '支持智能核保',
    selectedResponsibilities: [
      { id: 'resp-1', code: 'GENERAL_HOSPITALIZATION', name: '住院医疗费用', category: '医疗险', description: '住院治疗费用报销' },
      { id: 'resp-2', code: 'OUT_HOSPITAL_DRUG', name: '院外特效药费用', category: '医疗险', description: '院外特效药清单覆盖' }
    ],
    coveragePlans: [
      {
        planType: '经典版',
        annualLimit: 6000000,
        guaranteedRenewalYears: 3,
      coverageDetails: [
          { mandatory: true, item_code: 'GENERAL_HOSPITALIZATION', item_name: '住院医疗费用', description: '住院治疗费用报销', details: { limit: 3000000, deductible: 10000, reimbursement_ratio: 1.0, hospital_requirements: '二级及以上公立医院普通部', coverage_scope: '住院费用/特殊门诊/外购药' } },
          { mandatory: true, item_code: 'CRITICAL_ILLNESS_MEDICAL', item_name: '重疾医疗费用', description: '重疾医疗专项保障', details: { limit: 6000000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '指定医院网络', coverage_scope: '重疾相关治疗费用' } }
      ]
      },
      {
        planType: '升级版',
        annualLimit: 8000000,
        guaranteedRenewalYears: 6,
        coverageDetails: [
          { mandatory: true, item_code: 'GENERAL_HOSPITALIZATION', item_name: '住院医疗费用', description: '住院治疗费用报销', details: { limit: 4000000, deductible: 10000, reimbursement_ratio: 1.0, hospital_requirements: '二级及以上公立医院普通部', coverage_scope: '住院费用/特殊门诊/外购药' } },
          { mandatory: false, item_code: 'OUT_HOSPITAL_DRUG', item_name: '院外特药费用', description: '院外特药清单覆盖', details: { limit: 2000000, deductible: 0, reimbursement_ratio: 0.8, hospital_requirements: '指定药房与配送网络', coverage_scope: '院外特药费用' } }
        ]
      }
    ]
  },
  {
    productCode: 'GCLIFE_CI_2025_B',
    regulatoryName: '中意康享重大疾病保险（2025版）',
    companyName: '中意人寿',
    version: '1.0',
    salesRegions: '全国（不含港澳台）',
    effectiveDate: '2025-07-01',
    discontinuationDate: '',
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.CRITICAL_ILLNESS,
    secondaryCategory: '定期重疾',
    primaryCategoryCode: 'B',
    secondaryCategoryCode: 'B02',
    racewayId: 'B0201', racewayName: '长期重疾',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    underwritingAge: '0 - 55周岁',
    coveragePeriod: '30年',
    coverageArea: '中国大陆',
    hospitalScope: '合法合规的医疗机构',
    claimScope: '确诊给付，医疗报销不适用',
    occupationScope: '1-4类职业',
    hesitationPeriod: '15天',
    waitingPeriod: '90天',
    policyEffectiveDate: 'T+1',
    purchaseLimit: 1,
    annualPremium: 1200,
    valueAddedServices: [
      { id: 'vas_ci_1', name: '第二诊疗意见', description: '联合三甲医院重疾专家提供第二诊疗意见服务。' },
      { id: 'vas_ci_2', name: '重疾专家远程会诊', description: '提供远程多学科专家联合会诊服务。' }
    ],
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['中意康享重大疾病保险（2025版）条款.pdf'],
    productSummary: '轻中重症覆盖，确诊即赔，聚焦家庭经济支柱的收入风险。',
    tags: ['轻中重症全覆盖', '多次赔付可选'],
    promoTag: '重疾保障升级',
    cardMetric1Label: '基本保额',
    cardMetric1Value: '50万',
    cardMetric2Label: '轻症赔付比例',
    cardMetric2Value: '30%',
    cardMetric3Label: '保障期限',
    cardMetric3Value: '30年',
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: '中意康享重大疾病保险_2025.pdf',
    rateTableFile: '重疾险费率表_中意_2025.xlsx',
    productDescriptionFile: '产品说明.pdf',
    coveragePlans: [
      {
        planType: '经典版',
        coverageDetails: [
          { mandatory: true, item_code: 'MAJOR_CI', item_name: '重大疾病保险金', description: '确诊给付一次', details: { limit: 500000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '确诊给付' } },
          { mandatory: true, item_code: 'MID_CI', item_name: '中症保险金', description: '确诊给付一次', details: { limit: 100000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '确诊给付' } },
          { mandatory: true, item_code: 'MINOR_CI', item_name: '轻症保险金', description: '确诊给付一次', details: { limit: 50000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '确诊给付' } },
          { mandatory: false, item_code: 'DEATH_BENEFIT', item_name: '身故保险金', description: '保障期内身故给付', details: { limit: 500000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '身故责任' } }
        ]
      },
      {
        planType: '升级版',
        coverageDetails: [
          { mandatory: true, item_code: 'MAJOR_CI', item_name: '重大疾病保险金', description: '确诊给付一次', details: { limit: 800000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '确诊给付' } },
          { mandatory: true, item_code: 'MID_CI', item_name: '中症保险金', description: '确诊给付一次', details: { limit: 200000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '确诊给付' } },
          { mandatory: true, item_code: 'MINOR_CI', item_name: '轻症保险金', description: '确诊给付一次', details: { limit: 100000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '确诊给付' } },
          { mandatory: false, item_code: 'DEATH_BENEFIT', item_name: '身故保险金', description: '保障期内身故给付', details: { limit: 800000, deductible: 0, reimbursement_ratio: 1.0, hospital_requirements: '不限', coverage_scope: '身故责任' } }
        ]
      }
    ]
  },
  {
    productCode: 'CZY-MED-EMB-2025-C',
    regulatoryName: '中意e民保医疗保险（互联网专属）',
    companyName: '中意人寿',
    version: '2025版',
    salesRegions: '中国大陆（不含港澳台）',
    effectiveDate: '2025-01-01',
    discontinuationDate: '',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.HEALTH,
    secondaryCategory: '医疗保险',
    primaryCategoryCode: 'A',
    secondaryCategoryCode: 'A01',
    racewayId: 'A0102', racewayName: '长期医疗',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    underwritingAge: '28天-80周岁',
    coveragePeriod: '1年',
    coverageArea: '全国（不含港澳台）',
    hospitalScope: '二级及以上公立医院普通部',
    claimScope: '医保范围内100%，医保外按合同约定比例报销',
    occupationScope: '1-4类',
    hesitationPeriod: '无',
    waitingPeriod: '90天',
    policyEffectiveDate: '次日零时',
    purchaseLimit: 1,
    annualPremium: 298,
    valueAddedServices: [
      { id: 'VAS01', name: '在线投保', description: '支持APP在线投保与电子保单' },
      { id: 'VAS02', name: '在线理赔', description: '可通过掌上中意APP发起理赔' },
      { id: 'VAS03', name: '智能核保', description: '提供智能核保，健康告知更宽松' }
    ],
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['中意e民保条款.pdf'],
    productSummary: '百万医疗基础款，含医保内/外医疗、质子重离子、特药、重疾相关保障，年度最高300万。',
    tags: ['金选'],
    promoTag: '经典版入门医疗',
    cardMetric1Label: '总保额',
    cardMetric1Value: '300万',
    cardMetric2Label: '保障期限',
    cardMetric2Value: '1年',
    cardMetric3Label: '投保年龄',
    cardMetric3Value: '28天-80岁',
    supportsOnlineClaim: true,
    isOnline: true,
    deductible: '共享1万元免赔额',
    renewalWarranty: '3年保证续保',
    outHospitalMedicine: '特定院外药品，按责任限额报销',
    healthConditionNotice: '健康告知宽松，支持智能核保',
    selectedResponsibilities: [
      { id: 'resp-1', code: 'GENERAL_HOSPITALIZATION', name: '住院医疗费用', category: '医疗险', description: '住院治疗费用报销' },
      { id: 'resp-19', code: 'GENERAL_OUT_OF_MEDICAL', name: '医保范围外医疗', category: '医疗险', description: '医保外合理住院治疗费用报销' },
      { id: 'resp-20', code: 'PROTON_HEAVY_ION', name: '质子重离子医疗保险金', category: '医疗险', description: '质子、重离子放射治疗费用保障' },
      { id: 'resp-21', code: 'SPECIAL_DRUG', name: '院外特定药品费用保险金', category: '医疗险', description: '特定抗肿瘤药品费用报销' },
      { id: 'resp-22', code: 'CRITICAL_ILLNESS_OUT_OF_TOWN', name: '重度疾病异地就医', category: '医疗险', description: '重疾跨省就医产生的合理费用' },
      { id: 'resp-23', code: 'CRITICAL_ILLNESS_GENE_TEST', name: '恶性肿瘤重度基因检测', category: '医疗险', description: '癌症相关基因检测费用' },
      { id: 'resp-24', code: 'CRITICAL_ILLNESS_DAILY_ALLOWANCE', name: '重度疾病住院津贴', category: '医疗险', description: '重疾住院期间按天给付津贴' },
      { id: 'resp-25', code: 'CRITICAL_ILLNESS_REHABILITATION', name: '重度疾病康复医疗', category: '医疗险', description: '癌症相关康复治疗、器械等费用' }
    ],
    coveragePlans: [
      {
        planType: '经典版',
        annualLimit: 3000000,
        guaranteedRenewalYears: 3,
      coverageDetails: [
          { mandatory: true, item_code: 'GENERAL_HOSPITALIZATION', item_name: '医保范围内医疗', description: '医保内住院医疗费用', details: { limit: 3000000, deductible: 10000, reimbursement_ratio: 1, hospital_requirements: '二级及以上公立医院普通部', coverage_scope: '医保范围内住院医疗' } },
          { mandatory: true, item_code: 'GENERAL_OUT_OF_MEDICAL', item_name: '医保范围外医疗', description: '医保外合理住院费用', details: { limit: 3000000, deductible: 10000, reimbursement_ratio: 0.6, hospital_requirements: '二级及以上公立医院普通部', coverage_scope: '医保外住院医疗' } },
          { mandatory: false, item_code: 'PROTON_HEAVY_ION', item_name: '质子重离子医疗保险金', description: '质子、重离子治疗费用', details: { limit: 3000000, deductible: 10000, reimbursement_ratio: 1, hospital_requirements: '指定医疗机构', coverage_scope: '癌症放射治疗' } },
          { mandatory: false, item_code: 'SPECIAL_DRUG', item_name: '院外特定药品费用保险金', description: '特定抗肿瘤药品费用', details: { limit: 200000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '指定药品目录', coverage_scope: '院外特药费用' } },
          { mandatory: false, item_code: 'CRITICAL_ILLNESS_OUT_OF_TOWN', item_name: '重度疾病异地就医', description: '重疾异地治疗费用', details: { limit: 200000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '指定医院', coverage_scope: '重疾跨省就医费用' } },
          { mandatory: false, item_code: 'CRITICAL_ILLNESS_GENE_TEST', item_name: '恶性肿瘤重度基因检测', description: '癌症基因检测费用', details: { limit: 10000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '指定检测机构', coverage_scope: '癌症基因检测费用' } },
          { mandatory: false, item_code: 'CRITICAL_ILLNESS_DAILY_ALLOWANCE', item_name: '重度疾病住院津贴', description: '重疾住院每日津贴', details: { limit: 18000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: 'ICU或普通住院', coverage_scope: '津贴按天给付' } },
          { mandatory: false, item_code: 'CRITICAL_ILLNESS_REHABILITATION', item_name: '重度疾病康复医疗', description: '癌症相关康复费用', details: { limit: 30000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '康复科或指定机构', coverage_scope: '康复器械、治疗等费用' } }
      ]
      }
    ]
  },
  {
    productCode: 'ACC2023-B',
    regulatoryName: '个人综合意外保障计划',
    companyName: '阳光人寿',
    version: '1.5',
    salesRegions: '北京、上海、广东',
    effectiveDate: '2023-05-10',
    discontinuationDate: '2027-05-09',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ACCIDENT,
    secondaryCategory: '综合意外',
    primaryCategoryCode: 'C',
    secondaryCategoryCode: 'C01',
    racewayId: 'C0101', racewayName: '成人综合意外',
    clauseType: ClauseType.MAIN,
    operator: '李四',
    coverageDetails: [
        { mandatory: true, id: '1', name: '意外身故', amount: '20万', details: '' },
        { mandatory: true, id: '2', name: '意外残疾', amount: '40万', details: '' },
        { mandatory: true, id: '3', name: '意外伤害医疗保险责任', amount: '4万', details: '含门急诊和住院' },
    ],
    selectedResponsibilities: [
      { id: 'acc-r1', code: 'ACCIDENTAL_DEATH_DISABILITY', name: '意外身故/伤残', category: '意外险', description: '' },
      { id: 'acc-r2', code: 'ACCIDENTAL_MEDICAL', name: '意外医疗', category: '意外险', description: '门急诊与住院医疗' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, item_code: 'ACCIDENTAL_DEATH_DISABILITY', item_name: '意外身故保险金', description: '', details: { limit: 200000 } },
        { mandatory: true, item_code: 'ACCIDENTAL_DEATH_DISABILITY', item_name: '意外伤残保险金', description: '', details: { limit: 400000 } },
        { mandatory: true, item_code: 'ACCIDENTAL_MEDICAL', item_name: '意外伤害医疗保险责任', description: '含门急诊和住院', details: { limit: 40000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '合法合规的医疗机构', coverage_scope: '门急诊/住院' } }
      ]}
    ],
    underwritingAge: '18 - 65周岁',
    coveragePeriod: '1年',
    coverageArea: '全球',
    hospitalScope: '合法合规的医疗机构',
    claimScope: '合理且必要的医疗费用',
    occupationScope: '1-3类职业',
    hesitationPeriod: '10天',
    waitingPeriod: 'T+3生效',
    policyEffectiveDate: 'T+3',
    purchaseLimit: 3,
    annualPremium: 150,
    valueAddedServices: [
        { id: 'vas1', name: '24小时紧急救援服务', description: '提供全球范围内的紧急医疗运送、医疗转运、遗体/骨灰送返等服务，确保客户在紧急情况下获得及时援助。'}
    ],
    productSummary: '为您的每一次出行和日常生活提供坚实保障。',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: '个人综合意外保障计划_v1.5.pdf',
    rateTableFile: '意外险费率表_2023.xlsx',
    productDescriptionFile: '综合意外险产品说明.pdf',
  },
  {
    productCode: 'ACC2024-C',
    regulatoryName: '青少年意外保障计划（2024版）',
    companyName: '中意人寿',
    version: '1.0',
    salesRegions: '全国',
    effectiveDate: '2024-03-01',
    discontinuationDate: '2029-02-28',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ACCIDENT,
    secondaryCategory: '青少年意外',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: '1', name: '意外身故/残疾', amount: '30万', details: '适用于未成年人' },
      { mandatory: true, id: '2', name: '意外医疗', amount: '2万', details: '门急诊及住院医疗' }
    ],
    selectedResponsibilities: [
      { id: 'acc-y1', code: 'ACCIDENTAL_DEATH_DISABILITY', name: '意外身故/伤残', category: '意外险', description: '' },
      { id: 'acc-y2', code: 'ACCIDENTAL_MEDICAL', name: '意外医疗', category: '意外险', description: '门急诊及住院医疗' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, item_code: 'ACCIDENTAL_DEATH_DISABILITY', item_name: '意外身故/残疾', description: '适用于未成年人', details: { limit: 300000 } },
        { mandatory: true, item_code: 'ACCIDENTAL_MEDICAL', item_name: '意外医疗', description: '门急诊及住院医疗', details: { limit: 20000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '合法合规的医疗机构', coverage_scope: '门急诊/住院' } }
      ]}
    ],
    valueAddedServices: [
      { id: 'vas1', name: '校园意外绿色通道', description: '提供校内事故快速理赔协助与就医指引。' },
      { id: 'vas2', name: '门急诊垫付服务', description: '符合条件的门急诊费用可申请垫付。' }
    ],
    underwritingAge: '6 - 18周岁',
    coveragePeriod: '1年',
    coverageArea: '中国大陆',
    hospitalScope: '合法合规的医疗机构',
    claimScope: '合理且必要的医疗费用',
    occupationScope: '1-3类职业',
    hesitationPeriod: '10天',
    waitingPeriod: 'T+1生效',
    policyEffectiveDate: 'T+1',
    purchaseLimit: 1,
    annualPremium: 99,
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['青少年意外保障计划_v1.0.pdf'],
    productSummary: '面向青少年的人群意外保障产品。',
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: '青少年意外保障计划_v1.0.pdf',
    rateTableFile: '意外险费率表_2024.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'ACC2022-A',
    regulatoryName: '老年人意外保障（关爱版）',
    companyName: '工银安盛',
    version: '1.2',
    salesRegions: '全国（不含港澳台）',
    effectiveDate: '2022-08-01',
    discontinuationDate: '2026-07-31',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ACCIDENT,
    secondaryCategory: '老年意外',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: '1', name: '意外身故', amount: '10万', details: '' },
      { mandatory: false, id: '2', name: '意外骨折津贴', amount: '3000元', details: '按次给付' },
      { mandatory: true, id: '3', name: '意外医疗', amount: '1万', details: '' }
    ],
    selectedResponsibilities: [
      { id: 'acc-o1', code: 'ACCIDENTAL_DEATH_DISABILITY', name: '意外身故/伤残', category: '意外险', description: '' },
      { id: 'acc-o2', code: 'ACCIDENTAL_MEDICAL', name: '意外医疗', category: '意外险', description: '' },
      { id: 'acc-o3', code: 'SPECIFIC_ACCIDENT', name: '特定意外（骨折津贴）', category: '意外险', description: '骨折按次给付' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, item_code: 'ACCIDENTAL_DEATH_DISABILITY', item_name: '意外身故', description: '', details: { limit: 100000 } },
        { mandatory: false, item_code: 'SPECIFIC_ACCIDENT', item_name: '骨折津贴', description: '按次给付', details: { additional_limit: 3000, scenario: '骨折津贴（按次）' } },
        { mandatory: true, item_code: 'ACCIDENTAL_MEDICAL', item_name: '意外医疗', description: '', details: { limit: 10000, deductible: 0, reimbursement_ratio: 1, hospital_requirements: '合法合规的医疗机构', coverage_scope: '门急诊/住院' } }
      ]}
    ],
    valueAddedServices: [
      { id: 'vas1', name: '急诊陪护协调', description: '为老年人提供急诊陪护协调服务。' },
      { id: 'vas2', name: '住院绿色通道', description: '协助安排住院绿色通道与床位协调。' }
    ],
    underwritingAge: '60 - 80周岁',
    coveragePeriod: '1年',
    coverageArea: '中国大陆',
    hospitalScope: '合法合规的医疗机构',
    claimScope: '合理且必要的医疗费用',
    occupationScope: '1-2类职业',
    hesitationPeriod: '10天',
    waitingPeriod: 'T+1',
    policyEffectiveDate: 'T+1',
    purchaseLimit: 1,
    annualPremium: 199,
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['老年人意外保障_关爱版_v1.2.pdf'],
    productSummary: '专为老年人设计的意外保障方案。',
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: '老年人意外保障_关爱版_v1.2.pdf',
    rateTableFile: '意外险费率表_2022.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'ANN2024-A',
    regulatoryName: '稳健养老金计划',
    companyName: '信泰人寿',
    version: '1.0',
    salesRegions: '全国',
    effectiveDate: '2024-06-01',
    discontinuationDate: '2034-05-31',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: '养老年金',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: '1', name: '年金领取', amount: '按合同约定', details: '按约定频率领取年金' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: '1', name: '年金领取', amount: '按合同约定', details: '按约定频率领取年金' }
      ]}
    ],
    underwritingAge: '18 - 60周岁',
    coveragePeriod: '至约定领取完毕',
    waitingPeriod: '无',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['稳健养老金计划.pdf'],
    productSummary: '提供稳定的养老金收益与现金流。',
    supportsOnlineClaim: true,
    isOnline: true,
    paymentMethod: '期交',
    paymentPeriod: '10年',
    payoutFrequency: '年领',
    payoutStartAge: 60,
    underwritingOccupation: '1-4类职业',
    clauseTextFile: '稳健养老金计划.pdf',
    rateTableFile: '年金险费率表.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'ANN2025-B',
    regulatoryName: '增益型年金保险',
    companyName: '中邮人寿',
    version: '1.0',
    salesRegions: '全国',
    effectiveDate: '2025-01-01',
    discontinuationDate: '2035-12-31',
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: '普通年金',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { id: '1', name: '年金领取', amount: '按合同约定', details: '支持月领/年领' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: '1', name: '年金领取', amount: '按合同约定', details: '支持月领/年领' }
      ]}
    ],
    underwritingAge: '0 - 55周岁',
    coveragePeriod: '至约定领取完毕',
    waitingPeriod: '无',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['增益型年金保险.pdf'],
    productSummary: '灵活的年金领取与增益方案。',
    supportsOnlineClaim: true,
    isOnline: true,
    paymentMethod: '期交',
    paymentPeriod: '15年',
    payoutFrequency: '月领',
    payoutStartAge: 65,
    underwritingOccupation: '1-4类职业',
    clauseTextFile: '增益型年金保险.pdf',
    rateTableFile: '年金险费率表_2025.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'ANN2023-C',
    regulatoryName: '教育金年金保险',
    companyName: '工银安盛',
    version: '2.0',
    salesRegions: '全国',
    effectiveDate: '2023-09-01',
    discontinuationDate: '2033-08-31',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: '普通年金',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { id: '1', name: '教育金领取', amount: '按合同约定', details: '用于子女教育规划' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { id: '1', name: '教育金领取', amount: '按合同约定', details: '用于子女教育规划' }
      ]}
    ],
    underwritingAge: '0 - 16周岁',
    coveragePeriod: '至约定领取完毕',
    waitingPeriod: '无',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['教育金年金保险.pdf'],
    productSummary: '为孩子教育储备资金的年金产品。',
    supportsOnlineClaim: true,
    isOnline: true,
    paymentMethod: '期交',
    paymentPeriod: '12年',
    payoutFrequency: '年领',
    payoutStartAge: 18,
    underwritingOccupation: '不限',
    clauseTextFile: '教育金年金保险.pdf',
    rateTableFile: '年金险费率表_教育金.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'TL2024-A',
    regulatoryName: '定期寿险保障计划',
    companyName: '中邮人寿',
    version: '1.0',
    salesRegions: '全国',
    effectiveDate: '2024-02-01',
    discontinuationDate: '2029-01-31',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.TERM_LIFE,
    secondaryCategory: '定期寿险',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金', amount: '100%基本保额', details: '核心责任' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金', amount: '100%基本保额', details: '核心责任' }
      ]}
    ],
    underwritingAge: '20 - 55周岁',
    coveragePeriod: '20年',
    waitingPeriod: '90天',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['定期寿险保障计划.pdf'],
    productSummary: '保障家庭责任期的定期寿险方案。',
    supportsOnlineClaim: true,
    isOnline: true,
    basicSumAssured: 500000,
    paymentPeriod: '20年',
    underwritingOccupation: '1-4类职业',
    clauseTextFile: '定期寿险保障计划.pdf',
    rateTableFile: '定期寿险费率表.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'TL2025-B',
    regulatoryName: '高额定期寿险（旗舰版）',
    companyName: '中意人寿',
    version: '1.0',
    salesRegions: '全国',
    effectiveDate: '2025-04-01',
    discontinuationDate: '2035-03-31',
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.TERM_LIFE,
    secondaryCategory: '定期寿险',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金', amount: '100%基本保额', details: '核心责任' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金', amount: '100%基本保额', details: '核心责任' }
      ]}
    ],
    underwritingAge: '25 - 60周岁',
    coveragePeriod: '30年',
    waitingPeriod: '90天',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['高额定期寿险_旗舰版.pdf'],
    productSummary: '高保额定寿，保障更长责任期。',
    supportsOnlineClaim: true,
    isOnline: true,
    basicSumAssured: 1000000,
    paymentPeriod: '30年',
    underwritingOccupation: '1-3类职业',
    clauseTextFile: '高额定期寿险_旗舰版.pdf',
    rateTableFile: '定期寿险费率表_旗舰.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'TL2023-C',
    regulatoryName: '家庭守护定寿（收入保障版）',
    companyName: '工银安盛',
    version: '1.2',
    salesRegions: '全国',
    effectiveDate: '2023-07-01',
    discontinuationDate: '2028-06-30',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.TERM_LIFE,
    secondaryCategory: '定期寿险',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金', amount: '100%基本保额', details: '等额给付' },
      { mandatory: false, id: 'INCOME_PROTECTION', name: '收入保障金', amount: '5000元/月', details: '保障期内按月给付' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: 'DEATH_OR_TOTAL_DISABILITY', name: '身故或全残保险金', amount: '100%基本保额', details: '等额给付' },
        { mandatory: false, id: 'INCOME_PROTECTION', name: '收入保障金', amount: '5000元/月', details: '保障期内按月给付' }
      ]}
    ],
    underwritingAge: '25 - 55周岁',
    coveragePeriod: '20年',
    waitingPeriod: '90天',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['家庭守护定寿_收入保障版_v1.2.pdf'],
    productSummary: '为家庭收入提供稳定保障的定寿方案。',
    supportsOnlineClaim: true,
    isOnline: true,
    basicSumAssured: 300000,
    paymentPeriod: '20年',
    underwritingOccupation: '1-3类职业',
    clauseTextFile: '家庭守护定寿_收入保障版_v1.2.pdf',
    rateTableFile: '定期寿险费率表_收入保障.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'WL2024-ZE-A',
    regulatoryName: '增额终身寿（成长版）',
    companyName: '信泰人寿',
    version: '1.0',
    salesRegions: '全国',
    effectiveDate: '2024-05-01',
    discontinuationDate: '2034-04-30',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.WHOLE_LIFE,
    secondaryCategory: '增额终身寿',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: '1', name: '身故保险金', amount: '按合同约定', details: '现金价值逐年增长' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: '1', name: '身故保险金', amount: '按合同约定', details: '现金价值逐年增长' }
      ]}
    ],
    underwritingAge: '0 - 55周岁',
    coveragePeriod: '终身',
    waitingPeriod: '90天',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['增额终身寿_成长版.pdf'],
    productSummary: '长期增额，兼顾保障与财富传承。',
    supportsOnlineClaim: true,
    isOnline: true,
    paymentFrequency: '年交',
    paymentPeriod: '20年',
    paymentMethod: '期交',
    clauseTextFile: '增额终身寿_成长版.pdf',
    rateTableFile: '终身寿费率表_增额.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'WL2025-ZE-B',
    regulatoryName: '增额终身寿（传承版）',
    companyName: '中意人寿',
    version: '1.0',
    salesRegions: '全国',
    effectiveDate: '2025-01-01',
    discontinuationDate: '2035-12-31',
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.WHOLE_LIFE,
    secondaryCategory: '增额终身寿',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: '1', name: '身故保险金', amount: '按合同约定', details: '聚焦家族财富传承' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: '1', name: '身故保险金', amount: '按合同约定', details: '聚焦家族财富传承' }
      ]}
    ],
    underwritingAge: '18 - 55周岁',
    coveragePeriod: '终身',
    waitingPeriod: '90天',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['增额终身寿_传承版.pdf'],
    productSummary: '面向中长期财富规划的保障型产品。',
    supportsOnlineClaim: true,
    isOnline: true,
    paymentFrequency: '年交',
    paymentPeriod: '30年',
    paymentMethod: '期交',
    clauseTextFile: '增额终身寿_传承版.pdf',
    rateTableFile: '终身寿费率表_传承.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
    productCode: 'WL2023-ZE-C',
    regulatoryName: '增额终身寿（稳健版）',
    companyName: '工银安盛',
    version: '2.0',
    salesRegions: '全国',
    effectiveDate: '2023-03-01',
    discontinuationDate: '2030-02-28',
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.WHOLE_LIFE,
    secondaryCategory: '增额终身寿',
    clauseType: ClauseType.MAIN,
    operator: '系统管理员',
    coverageDetails: [
      { mandatory: true, id: '1', name: '身故保险金', amount: '按合同约定', details: '现金价值稳健增长' }
    ],
    coveragePlans: [
      { planType: '标准版', coverageDetails: [
        { mandatory: true, id: '1', name: '身故保险金', amount: '按合同约定', details: '现金价值稳健增长' }
      ]}
    ],
    underwritingAge: '18 - 60周岁',
    coveragePeriod: '终身',
    waitingPeriod: '90天',
    productCardImage: 'https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp',
    productHeroImage: 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
    productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
    productAttachments: ['增额终身寿_稳健版_v2.0.pdf'],
    productSummary: '兼顾保障与资产稳健增值的终身寿。',
    supportsOnlineClaim: true,
    isOnline: true,
    paymentFrequency: '年交',
    paymentPeriod: '20年',
    paymentMethod: '期交',
    clauseTextFile: '增额终身寿_稳健版_v2.0.pdf',
    rateTableFile: '终身寿费率表_稳健.xlsx',
    productDescriptionFile: '产品说明.pdf'
  },
  {
"productCode": "xintai_ann_d_2026001",
"companyName": "信泰人寿",
"regulatoryName": "信泰如意福享（2026）养老年金保险（互联网专属）",
 
"productSummary": "",
"version": "1.0",
"status": ProductStatus.DRAFT,
"effectiveDate": "2026-01-01",
"discontinuationDate": "",
"salesRegions": "全国",
"supportsOnlineClaim": false,
"isOnline": true,
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意福享（2026）养老年金保险（互联网专属）/信泰如意福享（2026）养老年金保险（互联网专属）_备案材料.pdf"
],
"coverageDetails": [
  { "id": "annuity", "name": "养老年金", "amount": "按合同约定", "details": "自起领日每年给付" },
  { "id": "death", "name": "身故保险金", "amount": "按合同约定", "details": "按条款约定给付" }
],
"underwritingAge": "18至59周岁",
"coveragePeriod": "终身",
"waitingPeriod": "无",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "18至59周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "终身",
"primaryCategory": PrimaryCategory.ANNUITY,
"paymentMethod": "一次性付清、3年交、5年交、10年交",
"paymentPeriod": "10年",
"payoutFrequency": "每年",
"payoutStartAge": 60,
"underwritingOccupation": "不限",
"secondaryCategory": "养老年金保险",
"clauseType": ClauseType.MAIN,
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0102",
"racewayName": "养老年金",
 
},
{
"productCode": "xintai_ann_d_2026002",
"companyName": "信泰人寿",
"regulatoryName": "信泰如意怡享（2026）养老年金保险",
 
"productSummary": "",
"version": "1.0",
"status": ProductStatus.DRAFT,
"effectiveDate": "2026-02-01",
"discontinuationDate": "",
"salesRegions": "全国",
"supportsOnlineClaim": false,
"isOnline": false,
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意怡享（2026）养老年金保险/信泰如意怡享（2026）养老年金保险_备案材料.pdf"
],
"coverageDetails": [
  { "id": "annuity", "name": "养老年金", "amount": "按合同约定", "details": "自起领日每年给付" },
  { "id": "death", "name": "身故保险金", "amount": "按合同约定", "details": "按条款约定给付" }
],
"underwritingAge": "18至65周岁",
"coveragePeriod": "至被保险人年满 100 周岁后的首个保单周年日",
"waitingPeriod": "无",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "18至65周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至100周岁",
"primaryCategory": PrimaryCategory.ANNUITY,
"paymentMethod": "一次性付清、3年交、5年交、10年交",
"paymentPeriod": "10年",
"payoutFrequency": "每年",
"payoutStartAge": 60,
"underwritingOccupation": "不限",
"secondaryCategory": "养老年金保险",
"clauseType": ClauseType.MAIN,
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0102",
"racewayName": "养老年金",
 
},
{
"productCode": "xintai_ann_d_2025003",
"companyName": "信泰人寿",
"regulatoryName": "信泰如意鑫享3.0养老年金保险",
 
"productSummary": "",
"version": "3.0",
"status": ProductStatus.DRAFT,
"effectiveDate": "2025-03-01",
"discontinuationDate": "",
"salesRegions": "全国",
"supportsOnlineClaim": false,
"isOnline": false,
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鑫享3.0养老年金保险/信泰如意鑫享3.0养老年金保险_备案材料.pdf"
],
"coverageDetails": [
  { "id": "annuity", "name": "养老年金", "amount": "按合同约定", "details": "自起领日每年给付" },
  { "id": "death", "name": "身故保险金", "amount": "按合同约定", "details": "按条款约定给付" }
],
"underwritingAge": "0至65周岁",
"coveragePeriod": "终身",
"waitingPeriod": "无",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "0至65周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "终身",
"primaryCategory": PrimaryCategory.ANNUITY,
"paymentMethod": "一次性付清、5年交、10年交、20年交",
"paymentPeriod": "20年",
"payoutFrequency": "每年",
"payoutStartAge": 60,
"underwritingOccupation": "不限",
"secondaryCategory": "养老年金保险",
"clauseType": ClauseType.MAIN,
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0102",
"racewayName": "养老年金",
 
},
{
"productCode": "xintai_ann_d_2025004",
"companyName": "信泰人寿",
"regulatoryName": "信泰如意鸿禧A款养老年金保险（分红型）",
 
"productSummary": "",
"version": "A版",
"status": ProductStatus.DRAFT,
"effectiveDate": "2025-04-01",
"discontinuationDate": "",
"salesRegions": "全国",
"supportsOnlineClaim": false,
"isOnline": false,
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鸿禧A款养老年金保险（分红型）/信泰如意鸿禧A款养老年金保险（分红型）_备案材料.pdf"
],
"coverageDetails": [
  { "id": "annuity", "name": "养老年金", "amount": "按合同约定", "details": "自起领日每年给付" },
  { "id": "death", "name": "身故保险金", "amount": "按合同约定", "details": "按条款约定给付" }
],
"underwritingAge": "18至65周岁",
"coveragePeriod": "至被保险人年满 100 周岁后的首个保单周年日",
"waitingPeriod": "无",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "18至65周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至100周岁",
"primaryCategory": PrimaryCategory.ANNUITY,
"paymentMethod": "一次性付清、3年交、5年交、10年交",
"paymentPeriod": "10年",
"payoutFrequency": "每年",
"payoutStartAge": 60,
"underwritingOccupation": "不限",
"secondaryCategory": "养老年金保险（分红型）",
"clauseType": ClauseType.MAIN,
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
},
{
"productCode": "xintai_ann_d_2025005",
"companyName": "信泰人寿",
"regulatoryName": "信泰如意鸿禧B款养老年金保险（分红型）",
 
"productSummary": "",
"version": "B版",
"status": ProductStatus.DRAFT,
"effectiveDate": "2025-05-01",
"discontinuationDate": "",
"salesRegions": "全国",
"supportsOnlineClaim": false,
"isOnline": false,
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鸿禧B款养老年金保险（分红型）/信泰如意鸿禧B款养老年金保险（分红型）_备案材料.pdf"
],
"coverageDetails": [
  { "id": "annuity", "name": "养老年金", "amount": "按合同约定", "details": "自起领日每年给付" },
  { "id": "death", "name": "身故保险金", "amount": "按合同约定", "details": "按条款约定给付" }
],
"underwritingAge": "18至65周岁",
"coveragePeriod": "至被保险人年满 100 周岁后的首个保单周年日",
"waitingPeriod": "无",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "18至65周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至100周岁",
"primaryCategory": PrimaryCategory.ANNUITY,
"paymentMethod": "一次性付清、3年交、5年交、10年交",
"paymentPeriod": "10年",
"payoutFrequency": "每年",
"payoutStartAge": 60,
"underwritingOccupation": "不限",
"secondaryCategory": "养老年金保险（分红型）",
"clauseType": ClauseType.MAIN,
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
},
{
"productCode": "xintai_ann_d_2025006",
"companyName": "信泰人寿",
"regulatoryName": "信泰如意鑫享A款养老年金保险（分红型）",
 
"productSummary": "",
"version": "A版",
"status": ProductStatus.DRAFT,
"effectiveDate": "2025-06-01",
"discontinuationDate": "",
"salesRegions": "全国",
"supportsOnlineClaim": false,
"isOnline": false,
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鑫享A款养老年金保险（分红型）/信泰如意鑫享A款养老年金保险（分红型）_备案材料.pdf"
],
"coverageDetails": [
  { "id": "annuity", "name": "养老年金", "amount": "按合同约定", "details": "自起领日每年给付" },
  { "id": "death", "name": "身故保险金", "amount": "按合同约定", "details": "按条款约定给付" }
],
"underwritingAge": "18至65周岁",
"coveragePeriod": "至被保险人年满 100 周岁后的首个保单周年日",
"waitingPeriod": "无",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "18至65周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至100周岁",
"primaryCategory": PrimaryCategory.ANNUITY,
"paymentMethod": "一次性付清、3年交、5年交、10年交",
"paymentPeriod": "10年",
"payoutFrequency": "每年",
"payoutStartAge": 60,
"underwritingOccupation": "不限",
"secondaryCategory": "养老年金保险（分红型）",
"clauseType": ClauseType.MAIN,
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
},
{
"productCode": "xintai_ann_d_2025007",
"companyName": "信泰人寿",
"regulatoryName": "信泰如意鑫享B款养老年金保险（分红型）",
 
"productSummary": "",
"version": "B版",
"status": ProductStatus.DRAFT,
"effectiveDate": "2025-07-01",
"discontinuationDate": "",
"salesRegions": "全国",
"supportsOnlineClaim": false,
"isOnline": false,
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鑫享B款养老年金保险（分红型）/信泰如意鑫享B款养老年金保险（分红型）_备案材料.pdf"
],
"coverageDetails": [
  { "id": "annuity", "name": "养老年金", "amount": "按合同约定", "details": "自起领日每年给付" },
  { "id": "death", "name": "身故保险金", "amount": "按合同约定", "details": "按条款约定给付" }
],
"underwritingAge": "18至65周岁",
"coveragePeriod": "至被保险人年满 100 周岁后的首个保单周年日",
"waitingPeriod": "无",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "18至65周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至100周岁",
"primaryCategory": PrimaryCategory.ANNUITY,
"paymentMethod": "一次性付清、3年交、5年交、10年交",
"paymentPeriod": "10年",
"payoutFrequency": "每年",
"payoutStartAge": 60,
"underwritingOccupation": "不限",
"secondaryCategory": "养老年金保险（分红型）",
"clauseType": ClauseType.MAIN,
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
},
{
"productCode": "gclife_ann_d_2025001",
"regulatoryName": "中意悠然安养养老年金保险（分红型）",
 
"companyName": "中意人寿",
"version": "A版",
"salesRegions": "全国",
"effectiveDate": "",
"discontinuationDate": "",
"status": ProductStatus.ACTIVE,
"primaryCategory": PrimaryCategory.ANNUITY,
"secondaryCategory": "养老年金保险（分红型）",
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
"coverageDetails": [
{
"id": "annuity",
"name": "养老年金",
"amount": "按合同约定",
"details": "自起领日每年给付"
},
{
"id": "death",
"name": "身故保险金",
"amount": "按合同约定",
"details": "按条款约定给付"
}
],
"underwritingAge": "18至59周岁",
"coveragePeriod": "至被保险人年满 70 周岁、80 周岁后的首个保单周年日，或终身。",
"waitingPeriod": "无",
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 基本保险金额表.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 现金价值表.xls",
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 条款.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 产品说明书.pdf"
],
"productSummary": "",
"operator": "",
"clauseType": ClauseType.MAIN,
"tags": [],
"promoTag": "",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "18至59周岁",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至70/80岁",
"supportsOnlineClaim": false,
"isOnline": false,
"paymentMethod": "一次性付清、5 年交、10 年交、20 年交、交至 54 周岁、交至 59 周岁。",
"paymentPeriod": "",
"payoutFrequency": "每年",
"payoutStartAge": 55,
"underwritingOccupation": ""
},
{
"productCode": "gclife_ann_d_2025002",
"regulatoryName": "中意悠然鑫瑞养老年金保险（分红型）",
 
"companyName": "中意人寿",
"version": "A版",
"salesRegions": "全国",
"effectiveDate": "",
"discontinuationDate": "",
"status": ProductStatus.ACTIVE,
"primaryCategory": PrimaryCategory.ANNUITY,
"secondaryCategory": "养老年金保险（分红型）",
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
"coverageDetails": [
{
"id": "annuity",
"name": "养老年金",
"amount": "按合同约定",
"details": "自起领日每年给付"
},
{
"id": "death",
"name": "身故保险金",
"amount": "按合同约定",
"details": "按条款约定给付"
}
],
"underwritingAge": "",
"coveragePeriod": "自生效日的零时起至被保险人年满 75 周岁、年满 85 周岁或年满 100 周岁后的首个",
"waitingPeriod": "无",
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 现金价值表.xlsx",
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 费率表.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 条款.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 产品说明书.pdf"
],
"productSummary": "",
"operator": "",
"clauseType": ClauseType.MAIN,
"tags": [],
"promoTag": "",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至75-100岁",
"supportsOnlineClaim": false,
"isOnline": false,
"paymentMethod": "一次性付清、3 年交、5 年交、10 年交",
"paymentPeriod": "",
"payoutFrequency": "每年",
"payoutStartAge": 0,
"underwritingOccupation": ""
},
{
"productCode": "gclife_ann_d_2025003",
"regulatoryName": "中意一生中意年金保险（分红型）",
 
"companyName": "中意人寿",
"version": "A版",
"salesRegions": "全国",
"effectiveDate": "",
"discontinuationDate": "",
"status": ProductStatus.ACTIVE,
"primaryCategory": PrimaryCategory.ANNUITY,
"secondaryCategory": "养老年金保险（分红型）",
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
"coverageDetails": [
{
"id": "death",
"name": "身故保险金",
"amount": "按合同约定",
"details": "按条款约定给付"
}
],
"underwritingAge": "",
"coveragePeriod": "自生效日的零时起至被保险人年满 88 周岁后的首个保单周年日的二十四时止。",
"waitingPeriod": "无",
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 产品说明书.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 基本保险金额表.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 条款.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 现金价值表.xls"
],
"productSummary": "",
"operator": "",
"clauseType": ClauseType.MAIN,
"tags": [],
"promoTag": "",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至88周岁",
"supportsOnlineClaim": false,
"isOnline": false,
"paymentMethod": "一次性付清、3 年交、5 年交、10 年交。",
"paymentPeriod": "",
"payoutFrequency": "每年",
"payoutStartAge": 0,
"underwritingOccupation": ""
},
{
"productCode": "gclife_ann_d_2025004",
"regulatoryName": "中意真爱久久（尊享版）养老年金保险（分红型）",
 
"companyName": "中意人寿",
"version": "A版",
"salesRegions": "全国",
"effectiveDate": "",
"discontinuationDate": "",
"status": ProductStatus.ACTIVE,
"primaryCategory": PrimaryCategory.ANNUITY,
"secondaryCategory": "养老年金保险（分红型）",
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0101",
"racewayName": "养老年金（分红型）",
 
"coverageDetails": [
{
"id": "annuity",
"name": "养老年金",
"amount": "按合同约定",
"details": "自起领日每年给付"
},
{
"id": "death",
"name": "身故保险金",
"amount": "按合同约定",
"details": "按条款约定给付"
}
],
"underwritingAge": "",
"coveragePeriod": "自生效日的零时起至被保险人年满 100 周岁后的首个保单周年日的二十四时止",
"waitingPeriod": "无",
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 条款.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 产品说明书.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 基本保险金额表.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 现金价值表.xlsx"
],
"productSummary": "",
"operator": "",
"clauseType": ClauseType.MAIN,
"tags": [],
"promoTag": "",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至100周岁",
"supportsOnlineClaim": false,
"isOnline": false,
"paymentMethod": "一次性付清、3 年交、5 年交、10 年交",
"paymentPeriod": "",
"payoutFrequency": "每年",
"payoutStartAge": 0,
"underwritingOccupation": ""
},
{
"productCode": "gclife_ann_u_2025005",
"regulatoryName": "中意鑫享年年养老年金保险（万能型）",
 
"companyName": "中意人寿",
"version": "A版",
"salesRegions": "全国",
"effectiveDate": "",
"discontinuationDate": "",
"status": ProductStatus.ACTIVE,
"primaryCategory": PrimaryCategory.ANNUITY,
"secondaryCategory": "养老年金保险（万能型）",
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0102",
"racewayName": "养老年金",
 
"coverageDetails": [
{
"id": "annuity",
"name": "养老年金",
"amount": "按合同约定",
"details": "自起领日每年给付"
},
{
"id": "death",
"name": "身故保险金",
"amount": "按合同约定",
"details": "按条款约定给付"
}
],
"underwritingAge": "",
"coveragePeriod": "终身",
"waitingPeriod": "无",
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/金融管家/中意人寿/中意鑫享年年养老年金保险（万能型）- 条款/中意鑫享年年养老年金保险（万能型）- 条款.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意鑫享年年养老年金保险（万能型）- 条款/中意鑫享年年养老年金保险（万能型）- 产品说明书.pdf"
],
"productSummary": "",
"operator": "",
"clauseType": ClauseType.MAIN,
"tags": [],
"promoTag": "",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "灵活加费",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "终身",
"supportsOnlineClaim": false,
"isOnline": false,
"paymentMethod": "一次性付清保险费、定期追加保险费、不定期追加保险费、约定转入的保险费",
"paymentPeriod": "",
"payoutFrequency": "每年",
"payoutStartAge": 55,
"underwritingOccupation": ""
},
{
"productCode": "gclife_ann_n_2025006",
"regulatoryName": "中意裕享金生养老年金保险",
 
"companyName": "中意人寿",
"version": "A版",
"salesRegions": "全国",
"effectiveDate": "",
"discontinuationDate": "",
"status": ProductStatus.ACTIVE,
"primaryCategory": PrimaryCategory.ANNUITY,
"secondaryCategory": "养老年金保险",
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0102",
"racewayName": "养老年金",
 
"coverageDetails": [
{
"id": "annuity",
"name": "养老年金",
"amount": "按合同约定",
"details": "自起领日每年给付"
},
{
"id": "death",
"name": "身故保险金",
"amount": "按合同约定",
"details": "按条款约定给付"
}
],
"underwritingAge": "",
"coveragePeriod": "本合同的保险期间为自生效日的零时起至被保险人年满 105 周岁后的首个保单周年",
"waitingPeriod": "无",
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 产品说明书.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 现金价值表.xlsx",
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 条款.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 基本保险金额表.pdf"
],
"productSummary": "",
"operator": "",
"clauseType": ClauseType.MAIN,
"tags": [],
"promoTag": "",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至105周岁",
"supportsOnlineClaim": false,
"isOnline": false,
"paymentMethod": "一次性付清、3 年交、5 年交、10 年交",
"paymentPeriod": "",
"payoutFrequency": "每年",
"payoutStartAge": 0,
"underwritingOccupation": ""
},
{
"productCode": "gclife_ann_n_2025007",
"regulatoryName": "中意裕享金生（尊享版）养老年金保险",
 
"companyName": "中意人寿",
"version": "A版",
"salesRegions": "全国",
"effectiveDate": "",
"discontinuationDate": "",
"status": ProductStatus.ACTIVE,
"primaryCategory": PrimaryCategory.ANNUITY,
"secondaryCategory": "养老年金保险",
"primaryCategoryCode": "D",
"secondaryCategoryCode": "D01",
"racewayId": "D0102",
"racewayName": "养老年金",
 
"coverageDetails": [
{
"id": "annuity",
"name": "养老年金",
"amount": "按合同约定",
"details": "自起领日每年给付"
},
{
"id": "death",
"name": "身故保险金",
"amount": "按合同约定",
"details": "按条款约定给付"
}
],
"underwritingAge": "",
"coveragePeriod": "本合同的保险期间为自生效日的零时起至被保险人年满 105 周岁后的首个保单周年",
"waitingPeriod": "无",
"productCardImage": "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
"productHeroImage": 'https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp',
productLongImage: ['https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg', 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg'],
"productAttachments": [
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 基本保险金额表.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 产品说明书.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 条款.pdf",
"/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 现金价值表.xlsx"
],
"productSummary": "",
"operator": "",
"clauseType": ClauseType.MAIN,
"tags": [],
"promoTag": "",
"cardMetric1Label": "交费方式",
"cardMetric1Value": "多期可选",
"cardMetric2Label": "投保年龄",
"cardMetric2Value": "",
"cardMetric3Label": "保险期间",
"cardMetric3Value": "至105周岁",
"supportsOnlineClaim": false,
"isOnline": false,
"paymentMethod": "一次性付清、3 年交、5 年交、10 年交",
"paymentPeriod": "",
"payoutFrequency": "每年",
"payoutStartAge": 0,
"underwritingOccupation": ""
}
];

const toNumberFromAmount = (amt?: string): number => {
  if (!amt) return 0;
  const m = amt.match(/([0-9]+)(万|元)?/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return m[2] === '万' ? n * 10000 : n;
};

const mapAnnuityCode = (name: string) => {
  const n = name || '';
  if (/年金|教育金/.test(n)) return 'ANNUITY_PAYMENT';
  if (/生存金/.test(n)) return 'SURVIVAL_BENEFIT';
  if (/满期金/.test(n)) return 'MATURITY_BENEFIT';
  if (/身故/.test(n)) return 'DEATH_BENEFIT';
  return n.toUpperCase().replace(/\s+/g, '_');
};

const parseStartAges = (val: any): number[] => {
  if (typeof val === 'number') return [val];
  if (typeof val === 'string') {
    const nums = val.match(/\d+/g);
    return nums ? nums.map(x => parseInt(x, 10)).filter(n => !isNaN(n)) : [];
  }
  return [];
};

const parseFrequencyOptions = (val: any): ('ANNUALLY'|'MONTHLY')[] => {
  const s = String(val || '').toLowerCase();
  const opts: ('ANNUALLY'|'MONTHLY')[] = [];
  if (/年|annual/.test(s)) opts.push('ANNUALLY');
  if (/月|month/.test(s)) opts.push('MONTHLY');
  return opts.length ? opts : ['ANNUALLY'];
};

const convertStructuredPlan = (clause: Clause) => {
  const baseDetails = clause.coverageDetails || [];
  const hasStructured = Array.isArray(baseDetails) && baseDetails.some((d: any) => !!d.item_code);
  if (hasStructured) {
    return [{ planType: '标准版', coverageDetails: baseDetails as any }];
  }
  const isStructuredCategory = clause.primaryCategory === PrimaryCategory.HEALTH || clause.primaryCategory === PrimaryCategory.ACCIDENT;
  if (isStructuredCategory) {
    return [{
      planType: '标准版',
      annualLimit: baseDetails.reduce((sum: number, d: any) => sum + toNumberFromAmount(d.amount), 0) || undefined,
      guaranteedRenewalYears: 0,
      coverageDetails: baseDetails.map((d: any) => ({
        mandatory: true,
        item_code: (d.name || '').toUpperCase().replace(/\s+/g, '_'),
        item_name: d.name,
        description: d.details,
        details: {
          limit: toNumberFromAmount(d.amount),
          deductible: /一般|医疗/.test(d.name || '') ? 0 : 0,
          reimbursement_ratio: 1,
          hospital_requirements: (clause as any).hospitalScope || '',
          coverage_scope: /医疗|门急诊|住院/.test(d.name || '') ? '门急诊/住院医疗' : '责任按说明',
        }
      }))
    }];
  }
  return [{ planType: '标准版', coverageDetails: baseDetails.map((d: any) => ({
    mandatory: true,
    item_code: mapAnnuityCode(d.name),
    item_name: d.name,
    description: d.details,
    details: {
      start_age_options: parseStartAges((clause as any).payoutStartAge),
      frequency_options: parseFrequencyOptions((clause as any).payoutFrequency),
      guaranteed_period_years: undefined as any,
      amount_logic: /年金|教育金|生存金|满期金/.test(d.name || '') ? '按合同约定' : undefined,
      payout_logic: /身故/.test(d.name || '') ? '按条款约定给付' : undefined,
    }
  })) }];
};

export const SANITIZED_MOCK_CLAUSES: Clause[] = MOCK_CLAUSES.map(c => {
  const rawPlans = (c as any).coveragePlans && (c as any).coveragePlans.length > 0 ? (c as any).coveragePlans : convertStructuredPlan(c);
  const plans = (rawPlans || []).map((p: any) => ({
    ...p,
    coverageDetails: (p.coverageDetails || []).map((d: any) => ({ mandatory: d.mandatory ?? true, ...d }))
  }));
  return { ...c, coveragePlans: plans as any, coverageDetails: [] } as Clause;
});

export const MOCK_COMPANY_LIST: CompanyListItem[] = [
    {
        code: 'gclife',
        fullName: '中意人寿',
        shortName: '中意人寿',
        hotline: '956156',
        website: 'https://www.generalichina.com/',
        registeredCapital: '37 亿',
        status: '生效',
    },
    {
        code: 'xintai',
        fullName: '信泰人寿保险股份有限公司',
        shortName: '信泰人寿',
        hotline: '95365',
        website: 'https://www.xintai.com/',
        registeredCapital: '102.05 亿',
        status: '生效',
    },
    {
        code: 'chinapostlife',
        fullName: '中邮人寿保险股份有限公司',
        shortName: '中邮人寿',
        hotline: '400-890-9999',
        website: 'https://www.chinapost-life.com/',
        registeredCapital: '286.63 亿',
        status: '生效',
    },
    {
        code: 'icbcaxa',
        fullName: '工银安盛人寿保险有限公司',
        shortName: '工银安盛',
        hotline: '95359',
        website: 'https://www.icbc-axa.com/',
        registeredCapital: '125.05 亿',
        status: '生效',
    }
];

export const MOCK_COMPANY_PROFILES: Record<string, InsuranceCompanyProfile> = {
    'gclife': {
      code: 'gclife',
      shortName: '中意人寿',
      hotline: '956156',
      basicInfo: {
        companyName: "中意人寿",
        companyType: ["寿险公司", "中外合资"],
        registeredCapital: {
          value: 37,
          unit: "亿"
        },
        address: "北京市朝阳区光华路5号院1号楼",
        website: "https://www.generalichina.com/"
      },
      solvency: {
        rating: "优秀",
        dividendRealizationRate: "37%-103%",
        financialInvestmentYield: {
          annual: 2.21,
          recentThreeYears: 4.71
        },
        comprehensiveInvestmentYield: {
          annual: 2.8,
          recentThreeYears: 6.23
        },
        comprehensiveSolvencyRatio: 212.24,
        coreSolvencyRatio: 166.14,
        riskRating: "AAA",
        sarmraScore: 82.42,
        totalAssets: {
          value: 1557.1,
          unit: "亿元"
        },
        reportDate: "2025年第2季度"
      },
      serviceCapability: {
        qualityIndex: 86.96,
        complaintsPer10kPolicies: 0.254,
        complaintsPer100mPremium: 1.532,
        complaintsPer10kCustomers: 0.217,
        ratingDate: "2022年第四季度",
        complaintDataUpdateDate: "2023年第四季度"
      },
      branchDistribution: {
        provinces: [
          "北京市", "上海市", "广东省", "江苏省", "辽宁省", "四川省", "陕西省", "山东省", "黑龙江省", "湖北省", "河南省", "浙江省", "福建省", "重庆市", "河北省"
        ]
      },
      shareholders: {
        note: "占比5%以上",
        list: [
          { "name": "中国石油集团资本有限责任公司", "stakePercentage": 50.00, "type": "国有" },
          { "name": "忠利保险有限公司", "stakePercentage": 50.00, "type": "外资" }
        ]
      }
    },
    'xintai': {
      code: "xintai",
      shortName: "信泰人寿",
      hotline: "95365",
      basicInfo: {
        companyName: "信泰人寿保险股份有限公司",
        companyType: ["寿险公司"],
        registeredCapital: {
          value: 102.05,
          unit: "亿"
        },
        address: "杭州市江干区五星路 66 号",
        website: "https://www.xintai.com/"
      },
      solvency: {
        rating: "合格",
        dividendRealizationRate: "15%-114%",
        financialInvestmentYield: {
          annual: 0,
          recentThreeYears: 2.49
        },
        comprehensiveInvestmentYield: {
          annual: 0,
          recentThreeYears: 2.57
        },
        comprehensiveSolvencyRatio: 144.46,
        coreSolvencyRatio: 130.98,
        riskRating: "BB",
        sarmraScore: 69.25,
        totalAssets: {
          value: 2665.3,
          unit: "亿元"
        },
        reportDate: "2025 年第 2 季度"
      },
      serviceCapability: {
        qualityIndex: 77.09,
        complaintsPer10kPolicies: 1.196,
        complaintsPer100mPremium: 0.752,
        complaintsPer10kCustomers: 0.757,
        ratingDate: "2022 年第四季度",
        complaintDataUpdateDate: "2023 年第四季度"
      },
      branchDistribution: {
        provinces: [
          "浙江省", "江苏省", "北京市", "河北省", "福建省", "河南省", "山东省", "黑龙江省", "辽宁省", "上海市", "湖北省", "江西省", "广东省"
        ]
      },
      shareholders: {
        note: "占比 5% 以上",
        list: [
          { "name": "物产中大集团股份有限公司", "stakePercentage": 33.00, "type": "国有" },
          { "name": "存款保险基金管理有限责任公司", "stakePercentage": 17.00, "type": "国有" },
          { "name": "中国保险保障基金有限责任公司", "stakePercentage": 17.00, "type": "国有" },
          { "name": "北京九盛资产管理有限责任公司", "stakePercentage": 9.69, "type": "民营" },
          { "name": "杭州城投资本集团有限公司", "stakePercentage": 9.00, "type": "国有" },
          { "name": "杭州萧山环境集团有限公司", "stakePercentage": 5.60, "type": "国有" }
        ]
      }
    },
    'chinapostlife': {
        code: "chinapostlife",
        shortName: "中邮人寿",
        hotline: "400-890-9999",
        basicInfo: {
          "companyName": "中邮人寿保险股份有限公司",
          "companyType": [
            "寿险公司",
            "国有控股",
            "中外合资"
          ],
          "registeredCapital": {
            "value": 286.63,
            "unit": "亿"
          },
          "address": "北京市西城区金融大街甲3号B座",
          "website": "https://www.chinapost-life.com/"
        },
        solvency: {
          "rating": "良好",
          "dividendRealizationRate": "35%-56%",
          "financialInvestmentYield": {
            "annual": 1.53,
            "recentThreeYears": 3.8
          },
          "comprehensiveInvestmentYield": {
            "annual": 2.29,
            "recentThreeYears": 4.58
          },
          "comprehensiveSolvencyRatio": 194.59,
          "coreSolvencyRatio": 128.57,
          "riskRating": "BB",
          "sarmraScore": 80.44,
          "totalAssets": {
            "value": 5825.8,
            "unit": "亿元"
          },
          "reportDate": "2025年第2季度"
        },
        serviceCapability: {
          "qualityIndex": 83.74,
          "complaintsPer10kPolicies": 0.151,
          "complaintsPer100mPremium": 0.146,
          "complaintsPer10kCustomers": 0.099,
          "ratingDate": "2022年第四季度",
          "complaintDataUpdateDate": "2023年第四季度"
        },
        branchDistribution: {
          "provinces": [
            "江西省", "四川省", "陕西省", "北京市", "天津市", "辽宁省", "江苏省", "浙江省", "安徽省", "宁夏回族自治区", "河南省", "黑龙江省", "湖南省", "广东省", "山东省", "重庆市", "湖北省", "上海市", "河北省", "吉林省", "广西壮族自治区", "福建省"
          ]
        },
        shareholders: {
          "note": "占比5%以上",
          "list": [
            { "name": "中国邮政集团有限公司", "stakePercentage": 38.20, "type": "国有" },
            { "name": "友邦保险有限公司", "stakePercentage": 25.00, "type": "外资" },
            { "name": "北京中邮资产管理有限公司", "stakePercentage": 15.00, "type": "国有" },
            { "name": "中国集邮有限公司", "stakePercentage": 12.19, "type": "国有" },
            { "name": "邮政科学研究规划院有限公司", "stakePercentage": 9.62, "type": "国有" }
          ]
        }
    },
    'icbcaxa': {
        code: "icbcaxa",
        shortName: "工银安盛",
        hotline: "95359",
        basicInfo: {
          "companyName": "工银安盛人寿保险有限公司",
          "companyType": [
            "寿险公司",
            "国有控股",
            "中外合资"
          ],
          "registeredCapital": {
            "value": 125.05,
            "unit": "亿"
          },
          "address": "中国（上海）自由贸易试验区陆家嘴环路 166 号",
          "website": "https://www.icbc-axa.com/"
        },
        solvency: {
          "rating": "优秀",
          "dividendRealizationRate": "19%-112%",
          "financialInvestmentYield": {
            "annual": 1.81,
            "recentThreeYears": 3.77
          },
          "comprehensiveInvestmentYield": {
            "annual": 3.14,
            "recentThreeYears": 6
          },
          "comprehensiveSolvencyRatio": 261,
          "coreSolvencyRatio": 195,
          "riskRating": "AAA",
          "sarmraScore": 82.12,
          "totalAssets": {
            "value": 3224.0,
            "unit": "亿元"
          },
          "reportDate": "2025 年第 2 季度"
        },
        serviceCapability: {
          "qualityIndex": 83.73,
          "complaintsPer10kPolicies": 0.753,
          "complaintsPer100mPremium": 0.447,
          "complaintsPer10kCustomers": 0.183,
          "ratingDate": "2022 年第四季度",
          "complaintDataUpdateDate": "2023 年第四季度"
        },
        branchDistribution: {
          "provinces": [
            "上海市", "北京市", "广东省", "辽宁省", "天津市", "浙江省", "山东省", "四川省", "河北省", "河南省", "湖北省", "陕西省", "山西省", "福建省", "安徽省", "重庆市", "广西壮族自治区", "云南省", "江西省"
          ]
        },
        shareholders: {
          "note": "占比 5% 以上",
          "list": [
            { "name": "中国工商银行股份有限公司", "stakePercentage": 60.00, "type": "国有" },
            { "name": "安盛中国公司", "stakePercentage": 27.50, "type": "外资" },
            { "name": "五矿资本控股有限公司", "stakePercentage": 10.00, "type": "国有" }
          ]
        }
    }
};

export const MOCK_INDUSTRY_DATA: IndustryData[] = [
  { id: '1', code: 'ID_INS001', name: '城市平均工资、月度护理成本、生活类支出数据', deployed: true, operator: 'antsure1', operationTime: '2024-05-20 14:30:00' },
  { id: '2', code: 'ID_INS002', name: '重疾发生率', deployed: true, operator: 'antsure1', operationTime: '2024-05-20 14:35:00' },
  { id: '3', code: 'ID_INS003', name: '意外发生率', deployed: true, operator: 'antsure1', operationTime: '2024-05-20 15:00:00' },
  { id: '4', code: 'ID_INS004', name: '因病身故发生率', deployed: true, operator: 'antsure1', operationTime: '2024-05-20 15:10:00' },
  { id: '5', code: 'ID_INS005', name: '住院发生率', deployed: false, operator: 'antsure1', operationTime: '2024-05-20 16:20:00' },
  { id: '6', code: 'ID_INS006', name: '门诊发生率', deployed: false, operator: 'antsure1', operationTime: '2024-05-20 17:45:00' },
];

export const MOCK_CITY_SALARY_DATA: CitySalaryData[] = [
  { provinceName: '北京市', cityName: '北京市', provinceGbCode: '110000', cityGbCode: '110100', avgAnnualSalary: '218,312', avgMonthlySalary: '18,192.66667', monthlyNursingCost: '6502', monthly_living_expense: 1451 },
  { provinceName: '天津市', cityName: '天津市', provinceGbCode: '120000', cityGbCode: '120100', avgAnnualSalary: '138,007', avgMonthlySalary: '11,500.58333', monthlyNursingCost: '4300', monthly_living_expense: 1300 },
  { provinceName: '河北省', cityName: '石家庄市', provinceGbCode: '130000', cityGbCode: '130100', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '3300', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '唐山市', provinceGbCode: '130000', cityGbCode: '130200', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '3100', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '秦皇岛市', provinceGbCode: '130000', cityGbCode: '130300', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '3000', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '邯郸市', provinceGbCode: '130000', cityGbCode: '130400', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '2850', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '邢台市', provinceGbCode: '130000', cityGbCode: '130500', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '2800', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '保定市', provinceGbCode: '130000', cityGbCode: '130600', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '2950', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '张家口市', provinceGbCode: '130000', cityGbCode: '130700', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '2750', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '承德市', provinceGbCode: '130000', cityGbCode: '130800', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '2800', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '沧州市', provinceGbCode: '130000', cityGbCode: '130900', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '2900', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '廊坊市', provinceGbCode: '130000', cityGbCode: '131000', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '3150', monthly_living_expense: 1065 },
  { provinceName: '河北省', cityName: '衡水市', provinceGbCode: '130000', cityGbCode: '131100', avgAnnualSalary: '94,818', avgMonthlySalary: '7,901.5', monthlyNursingCost: '2750', monthly_living_expense: 1065 },
  { provinceName: '山西省', cityName: '太原市', provinceGbCode: '140000', cityGbCode: '140100', avgAnnualSalary: '95,025', avgMonthlySalary: '7,918.75', monthlyNursingCost: '3100', monthly_living_expense: 1065 },
  { provinceName: '山西省', cityName: '大同市', provinceGbCode: '140000', cityGbCode: '140200', avgAnnualSalary: '95,025', avgMonthlySalary: '7,918.75', monthlyNursingCost: '2800', monthly_living_expense: 1065 },
  { provinceName: '山西省', cityName: '阳泉市', provinceGbCode: '140000', cityGbCode: '140300', avgAnnualSalary: '95,025', avgMonthlySalary: '7,918.75', monthlyNursingCost: '2650', monthly_living_expense: 1065 },
  { provinceName: '山西省', cityName: '长治市', provinceGbCode: '140000', cityGbCode: '140400', avgAnnualSalary: '95,025', avgMonthlySalary: '7,918.75', monthlyNursingCost: '2750', monthly_living_expense: 1065 },
  { provinceName: '山西省', cityName: '晋城市', provinceGbCode: '140000', cityGbCode: '140500', avgAnnualSalary: '95,025', avgMonthlySalary: '7,918.75', monthlyNursingCost: '2800', monthly_living_expense: 1065 },
];

export const MOCK_CRITICAL_ILLNESS_DATA: CriticalIllnessRateData[] = [
  { age: 0, gender: '男', rate: '0.000429' },
  { age: 1, gender: '男', rate: '0.000375' },
  { age: 2, gender: '男', rate: '0.000327' },
  { age: 3, gender: '男', rate: '0.000285' },
  { age: 4, gender: '男', rate: '0.00025' },
  { age: 5, gender: '男', rate: '0.000224' },
  { age: 6, gender: '男', rate: '0.000207' },
  { age: 7, gender: '男', rate: '0.0002' },
  { age: 8, gender: '男', rate: '0.000203' },
  { age: 9, gender: '男', rate: '0.000214' },
  { age: 10, gender: '男', rate: '0.00023' },
  { age: 11, gender: '男', rate: '0.000248' },
  { age: 12, gender: '男', rate: '0.000266' },
  { age: 13, gender: '男', rate: '0.000282' },
  { age: 14, gender: '男', rate: '0.000295' },
  { age: 15, gender: '男', rate: '0.000309' },
  { age: 16, gender: '男', rate: '0.000328' },
  { age: 17, gender: '男', rate: '0.000353' },
  { age: 18, gender: '男', rate: '0.000387' },
  { age: 19, gender: '男', rate: '0.000433' },
  { age: 20, gender: '男', rate: '0.00049' },
  { age: 21, gender: '男', rate: '0.000554' },
  { age: 22, gender: '男', rate: '0.000625' },
  { age: 23, gender: '男', rate: '0.0007' },
  { age: 24, gender: '男', rate: '0.000778' },
];

export const MOCK_ACCIDENT_RATE_DATA: AccidentRateData[] = [
  { age: 0, gender: '男', rate: '0.00015352' },
  { age: 1, gender: '男', rate: '0.00013395' },
  { age: 2, gender: '男', rate: '0.00011724' },
  { age: 3, gender: '男', rate: '0.00010343' },
  { age: 4, gender: '男', rate: '0.00009253' },
  { age: 5, gender: '男', rate: '0.00008426' },
  { age: 6, gender: '男', rate: '0.00007928' },
  { age: 7, gender: '男', rate: '0.00007719' },
  { age: 8, gender: '男', rate: '0.00007789' },
  { age: 9, gender: '男', rate: '0.00008119' },
  { age: 10, gender: '男', rate: '0.00008908' },
  { age: 11, gender: '男', rate: '0.00009691' },
  { age: 12, gender: '男', rate: '0.00010639' },
  { age: 13, gender: '男', rate: '0.00011707' },
  { age: 14, gender: '男', rate: '0.00012849' },
  { age: 15, gender: '男', rate: '0.0001393' },
  { age: 16, gender: '男', rate: '0.00015082' },
  { age: 17, gender: '男', rate: '0.0001619' },
];

export const MOCK_DEATH_RATE_DATA: DeathRateData[] = [
  { age: 0, rate: '0.000722' },
  { age: 1, rate: '0.000603' },
  { age: 2, rate: '0.000499' },
  { age: 3, rate: '0.000416' },
  { age: 4, rate: '0.000358' },
  { age: 5, rate: '0.000323' },
  { age: 6, rate: '0.000309' },
  { age: 7, rate: '0.000308' },
  { age: 8, rate: '0.000311' },
  { age: 9, rate: '0.000312' },
  { age: 10, rate: '0.000312' },
  { age: 11, rate: '0.000312' },
  { age: 12, rate: '0.000313' },
  { age: 13, rate: '0.000320' },
  { age: 14, rate: '0.000336' },
  { age: 15, rate: '0.000364' },
  { age: 16, rate: '0.000404' },
  { age: 17, rate: '0.000455' },
  { age: 18, rate: '0.000513' },
  { age: 19, rate: '0.000572' },
  { age: 20, rate: '0.000621' },
  { age: 21, rate: '0.000661' },
  { age: 22, rate: '0.000692' },
  { age: 23, rate: '0.000716' },
];

export const MOCK_HOSPITALIZATION_RATE_DATA: HospitalizationRateData[] = [
  { age: 0, gender: '男', rate: '0.0002212', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 1, gender: '男', rate: '0.0002212', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 2, gender: '男', rate: '0.0002212', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 3, gender: '男', rate: '0.0002212', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 4, gender: '男', rate: '0.0002212', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 5, gender: '男', rate: '0.0000738668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 6, gender: '男', rate: '0.0000738668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 7, gender: '男', rate: '0.0000738668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 8, gender: '男', rate: '0.0000738668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 9, gender: '男', rate: '0.0000738668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 10, gender: '男', rate: '0.0000738668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 11, gender: '男', rate: '0.0000402668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 12, gender: '男', rate: '0.0000402668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 13, gender: '男', rate: '0.0000402668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 14, gender: '男', rate: '0.0000402668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 15, gender: '男', rate: '0.0000402668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 16, gender: '男', rate: '0.0000472', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 17, gender: '男', rate: '0.0000472', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 18, gender: '男', rate: '0.0000472', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 19, gender: '男', rate: '0.0000472', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 20, gender: '男', rate: '0.0000472', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 21, gender: '男', rate: '0.0000666668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 22, gender: '男', rate: '0.0000666668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
  { age: 23, gender: '男', rate: '0.0000666668', treatmentCost: '21～53万', maxCost: '186万', roundingRule: '200万' },
];

export const MOCK_OUTPATIENT_RATE_DATA: OutpatientRateData[] = [
  // Age 0-5
  ...Array.from({ length: 6 }, (_, i) => ({
    age: i,
    rate: '0.036072',
    avgAnnualVisits: 6,
    avgCostPerVisit: 400,
    avgAnnualCost: 6000,
    suggestedSumAssured: 10000
  })),
  // Age 6-20
  ...Array.from({ length: 15 }, (_, i) => ({
    age: i + 6,
    rate: '0.01868',
    avgAnnualVisits: 6,
    avgCostPerVisit: 400,
    avgAnnualCost: 6000,
    suggestedSumAssured: 10000
  })),
  // Age 21-26
  ...Array.from({ length: 6 }, (_, i) => ({
    age: i + 21,
    rate: '0.031792',
    avgAnnualVisits: 6,
    avgCostPerVisit: 400,
    avgAnnualCost: 6000,
    suggestedSumAssured: 10000
  })),
];

export const MAPPING_DATA: InsuranceCategoryMapping[] = [
    { antLevel3Code: 'A0101', antLevel1Name: '医疗险', antLevel2Name: '住院医疗', antLevel3Name: '短期百万医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'A0102', antLevel1Name: '医疗险', antLevel2Name: '住院医疗', antLevel3Name: '长期医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'A0103', antLevel1Name: '医疗险', antLevel2Name: '住院医疗', antLevel3Name: '中老年长期医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'A0104', antLevel1Name: '医疗险', antLevel2Name: '住院医疗', antLevel3Name: '长期防癌医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'A0105', antLevel1Name: '医疗险', antLevel2Name: '住院医疗', antLevel3Name: '短期防癌医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'A0201', antLevel1Name: '医疗险', antLevel2Name: '门诊医疗', antLevel3Name: '通用门诊医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'A0202', antLevel1Name: '医疗险', antLevel2Name: '门诊医疗', antLevel3Name: '少儿门诊医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'A0203', antLevel1Name: '医疗险', antLevel2Name: '门诊医疗', antLevel3Name: '意外医疗', regLevel2Name: '医疗保险', functionCategory: '保障' },
    { antLevel3Code: 'B0101', antLevel1Name: '重疾险', antLevel2Name: '短期重疾', antLevel3Name: '一年期重疾', regLevel2Name: '疾病保险', functionCategory: '保障' },
    { antLevel3Code: 'B0201', antLevel1Name: '重疾险', antLevel2Name: '定期重疾', antLevel3Name: '长期重疾', regLevel2Name: '疾病保险', functionCategory: '保障' },
    { antLevel3Code: 'B0202', antLevel1Name: '重疾险', antLevel2Name: '定期重疾', antLevel3Name: '长期防癌', regLevel2Name: '疾病保险', functionCategory: '保障' },
    { antLevel3Code: 'B0301', antLevel1Name: '重疾险', antLevel2Name: '终身重疾', antLevel3Name: '终身重疾', regLevel2Name: '疾病保险', functionCategory: '保障' },
    { antLevel3Code: 'B0302', antLevel1Name: '重疾险', antLevel2Name: '终身重疾', antLevel3Name: '终身防癌', regLevel2Name: '疾病保险', functionCategory: '保障' },
    { antLevel3Code: 'C0101', antLevel1Name: '意外险', antLevel2Name: '综合意外', antLevel3Name: '成人综合意外', regLevel2Name: '意外伤害保险', functionCategory: '保障' },
    { antLevel3Code: 'C0102', antLevel1Name: '意外险', antLevel2Name: '综合意外', antLevel3Name: '少儿综合意外', regLevel2Name: '意外伤害保险', functionCategory: '保障' },
    { antLevel3Code: 'C0103', antLevel1Name: '意外险', antLevel2Name: '综合意外', antLevel3Name: '学平险', regLevel2Name: '意外伤害保险', functionCategory: '保障' },
    { antLevel3Code: 'C0104', antLevel1Name: '意外险', antLevel2Name: '综合意外', antLevel3Name: '老年综合意外', regLevel2Name: '意外伤害保险', functionCategory: '保障' },
    { antLevel3Code: 'C0201', antLevel1Name: '意外险', antLevel2Name: '出行意外', antLevel3Name: '两轮电动车意外', regLevel2Name: '意外伤害保险', functionCategory: '保障' },
    { antLevel3Code: 'C0202', antLevel1Name: '意外险', antLevel2Name: '出行意外', antLevel3Name: '交通意外', regLevel2Name: '意外伤害保险', functionCategory: '保障' },
    { antLevel3Code: 'C0203', antLevel1Name: '意外险', antLevel2Name: '出行意外', antLevel3Name: '旅行意外', regLevel2Name: '意外伤害保险', functionCategory: '保障' },
    { antLevel3Code: 'D0101', antLevel1Name: '养老金', antLevel2Name: '年金', antLevel3Name: '养老年金（分红型）', regLevel2Name: '养老年金保险', functionCategory: '储蓄' },
    { antLevel3Code: 'D0102', antLevel1Name: '养老金', antLevel2Name: '年金', antLevel3Name: '养老年金', regLevel2Name: '养老年金保险', functionCategory: '储蓄' },
    { antLevel3Code: 'E0101', antLevel1Name: '储蓄型', antLevel2Name: '年金', antLevel3Name: '中期年金（分红型）', regLevel2Name: '普通年金保险', functionCategory: '储蓄' },
    { antLevel3Code: 'E0102', antLevel1Name: '储蓄型', antLevel2Name: '年金', antLevel3Name: '中期年金', regLevel2Name: '普通年金保险', functionCategory: '储蓄' },
    { antLevel3Code: 'E0103', antLevel1Name: '储蓄型', antLevel2Name: '年金', antLevel3Name: '教育金', regLevel2Name: '普通年金保险', functionCategory: '储蓄' },
    { antLevel3Code: 'E0201', antLevel1Name: '储蓄型', antLevel2Name: '增额终身寿', antLevel3Name: '增额终身寿（分红型）', regLevel2Name: '增额终身寿', functionCategory: '储蓄' },
    { antLevel3Code: 'E0202', antLevel1Name: '储蓄型', antLevel2Name: '增额终身寿', antLevel3Name: '增额终身寿', regLevel2Name: '增额终身寿', functionCategory: '储蓄' },
    { antLevel3Code: 'E0301', antLevel1Name: '储蓄型', antLevel2Name: '两全保险', antLevel3Name: '两全保险', regLevel2Name: '两全保险', functionCategory: '储蓄' },
    { antLevel3Code: 'F0101', antLevel1Name: '定期寿险', antLevel2Name: '定期寿险', antLevel3Name: '定期寿险', regLevel2Name: '定期寿险', functionCategory: '保障' },
];

export const LEVEL_3_DATA: CategoryDefinition[] = [
    { code: 'A0101', name: '短期百万医疗', definition: '高保额、低保费，通常为一年期，用于报销因疾病或意外导致的巨大住院医疗费用。', features: '保障杠杆极高，一年期保费低廉；涵盖住院、特殊门诊、外购药等费用。', function: '补偿医保目录内外的巨额医疗支出，防止因病致贫；作为医保的有效补充。', audience: '预算有限但需要高额住院医疗保障的群体。', selectionPoints: '续保条件（是否保证续保），免赔额设定，增值服务（如就医绿通）。', coreMetrics: '保额，免赔额，续保条件，报销比例。' },
    { code: 'A0102', name: '长期医疗', definition: '提供长期或保证续保年限的住院医疗保障，为被保险人提供稳定的高额医疗支持。', features: '保证长期续保，不受产品停售或健康变化影响；费率相对稳定，提供持久安全感。', function: '持续、稳定地覆盖疾病或意外导致的住院医疗费用，规避医疗通胀和未来健康风险。', audience: '追求长期稳定、不间断医疗保障的家庭和个人。', selectionPoints: '保证续保期限长短，费率调整机制是否透明，健康告知严格度。', coreMetrics: '保证续保年限，总保额，免赔额，费率调整规则。' },
    { code: 'A0103', name: '中老年长期医疗', definition: '专为中老年人设计的长期医疗险，通常放宽了投保年龄和健康要求，但保障聚焦。', features: '投保年龄上限高，部分产品对三高或既往症友好；侧重中老年高发疾病保障。', function: '解决老年群体因健康状况较难购买医疗险的问题，提供持续的住院费用报销。', audience: '50岁以上，希望获得持续住院医疗保障的中老年群体。', selectionPoints: '投保年龄上限，健康告知宽松度，对既往症和特定疾病的责任。', coreMetrics: '投保年龄上限，免赔额，特定疾病赔付额，费率结构。' },
    { code: 'A0104', name: '长期防癌医疗', definition: '专注于癌症治疗费用报销的长期医疗险，对非癌症疾病的健康告知相对宽松。', features: '保证长期续保，癌症相关费用报销比例高；通常健康告知宽松，可带病投保。', function: '集中应对癌症治疗费用高昂的风险，作为重疾险或普通医疗险的有效补充。', audience: '有癌症家族史、预算有限或健康欠佳（次标体）但需癌症保障者。', selectionPoints: '保证续保年限，癌症特药/外购药覆盖范围，非癌疾病的排除条款。', coreMetrics: '保证续保年限，癌症总保额，特药清单覆盖率。' },
    { code: 'A0105', name: '短期防癌医疗', definition: '一年期或短期防癌医疗险，提供癌症治疗费用报销。', features: '价格便宜，投保灵活，适合短期内需要补充癌症保障的人群；健康告知宽松。', function: '短期内转移癌症医疗费用风险，保障高额的癌症治疗开支。', audience: '预算紧张或作为过渡性癌症保障者。', selectionPoints: '续保的稳定性，等待期长短，癌症特药报销范围。', coreMetrics: '保额，免赔额，续保条件，费率。' },
    { code: 'A0201', name: '通用门诊医疗', definition: '报销普通疾病和意外导致的门诊或急诊费用，通常有次数或金额限制。', features: '解决小额的日常医疗开支，减少看病自付压力；通常与住院医疗搭配。', function: '覆盖日常看病产生的门诊费用，降低小额但高频的医疗支出风险。', audience: '追求全面医疗覆盖，希望减轻日常看病费用的个人或家庭。', selectionPoints: '单次/年度门诊限额，免赔额或免赔次数设定，就医网络覆盖。', coreMetrics: '年度门诊限额，单次限额，免赔额，报销比例。' },
    { code: 'A0202', name: '少儿门诊医疗', definition: '专为儿童设计的门诊医疗产品，覆盖儿童高发的常见病和意外门诊费用。', features: '针对少儿高发疾病设置更高赔付或无免赔额；保障范围贴合少儿易生病特点。', function: '解决儿童因免疫力较低导致的频繁门诊和急诊费用，减轻家庭负担。', audience: '0-14岁儿童的家长。', selectionPoints: '门诊年度限额，儿科专科医院覆盖，是否包含疫苗接种并发症责任。', coreMetrics: '年度门诊保额，免赔额，就医医院范围，费率。' },
    { code: 'A0203', name: '意外医疗', definition: '报销因意外事故产生的门诊、住院及手术费用，是综合意外险的关键组成部分。', features: '无健康告知要求，费用通常较低，报销意外产生的医疗费用。', function: '补偿意外事故造成的治疗费用，实现小额快速赔付。', audience: '所有需要意外风险保障的群体。', selectionPoints: '是否限制社保内用药，报销比例（社保内外），免赔额。', coreMetrics: '医疗保额，免赔额，社保外报销比例。' },
    { code: 'B0101', name: '一年期重疾', definition: '期限为一年，确诊合同约定的重大疾病后给付保额。', features: '价格极低，保障杠杆高，适合短期内补充高额重疾保障。', function: '确诊后提供一笔现金流，用于治疗或弥补一年内的收入损失。', audience: '预算极少，或短期内急需高保额重疾保障的年轻人。', selectionPoints: '续保条件（是否可稳定续保），等待期，疾病定义是否使用最新标准。', coreMetrics: '保额，年保费，续保稳定性，疾病种类。' },
    { code: 'B0201', name: '长期重疾', definition: '保障期限覆盖20年、30年或至指定年龄的重大疾病保险。', features: '保障期限固定且较长，保费锁定，提供特定年龄段的稳定保障。', function: '转移中青年时期收入中断和高额疾病治疗的风险，提供经济支持。', audience: '追求稳定重疾保障，预算高于一年期险种的家庭支柱。', selectionPoints: '轻中症保障及赔付比例，是否包含身故责任，保费豁免条款。', coreMetrics: '保额，保障期限，轻/中症赔付比例，保费结构。' },
    { code: 'B0202', name: '长期防癌', definition: '针对癌症提供确诊给付的保险产品，保障期限长。', features: '聚焦高发重疾，通常比传统重疾险保费便宜；健康告知宽松。', function: '专门应对癌症带来的经济压力，保障持久稳定。', audience: '有癌症家族史，或因健康原因无法购买标准重疾险的人。', selectionPoints: '是否包含原位癌，多次赔付设计及其间隔期。', coreMetrics: '癌症保额，保障期限，保费，多次赔付设计。' },
    { code: 'B0301', name: '终身重疾', definition: '提供终身重大疾病保障，通常包含身故责任，保障期直至生命终结。', features: '一次投入，终身锁定健康风险；现金价值可随时间增长，兼具财富传承功能。', function: '终极的健康风险转移工具，提供终身保障和财富安排。', audience: '财务稳健，追求终身保障和财富传承安排的高净值人群。', selectionPoints: '现金价值增长速度，身故责任形态（赔保额或现价），多次赔付设计。', coreMetrics: '保额，现金价值增长率，轻/中症赔付，身故责任。' },
    { code: 'B0302', name: '终身防癌', definition: '提供终身癌症确诊给付的保险，保障责任聚焦于恶性肿瘤。', features: '保费低于终身重疾，健康告知宽松，保障目标明确，对次标体人群友好。', function: '锁定终身的癌症经济风险，减轻罹患癌症后的经济压力。', audience: '追求终身癌症保障，或已患有非癌症疾病的次标体人群。', selectionPoints: '癌症多次赔付的间隔期和条件，是否含特定器官保障。', coreMetrics: '癌症保额，保障期限（终身），保费结构。' },
    { code: 'C0101', name: '成人综合意外', definition: '针对成人设计，提供意外身故、伤残及意外医疗保障。', features: '保障全面，覆盖意外事故的各个方面；保费低廉，杠杆高。', function: '应对日常生活和工作中的意外风险，提供经济补偿和医疗报销。', audience: '18-65岁的普通劳动者和家庭支柱。', selectionPoints: '伤残保额与等级划分，高风险职业的限制，意外医疗报销比例。', coreMetrics: '意外身故/伤残保额，意外医疗保额，职业类别限制。' },
    { code: 'C0102', name: '少儿综合意外', definition: '针对儿童设计的意外保险，侧重意外医疗和特定风险（如烧烫伤、中毒）。', features: '高额意外医疗，通常不含身故保障或身故保额受限。', function: '应对儿童活泼好动导致的各种小意外伤害和医疗支出。', audience: '0-17岁的儿童和青少年。', selectionPoints: '意外医疗报销范围（社保外），是否包含住院津贴，特定意外责任。', coreMetrics: '意外医疗保额，伤残保额，特定事故保额。' },
    { code: 'C0103', name: '学平险', definition: '针对在校学生设计，涵盖意外伤害和疾病住院医疗的综合保障计划。', features: '团体投保，费率低廉，保障范围限定在学习生活环境。', function: '解决学生在校期间和日常生活中发生的意外和疾病医疗费用。', audience: '在幼儿园、小学、中学、大学就读的学生。', selectionPoints: '疾病住院医疗是否包含，保障范围是否覆盖校外，门急诊额度。', coreMetrics: '意外医疗保额，疾病住院保额，年度保费。' },
    { code: 'C0104', name: '老年综合意外', definition: '针对高龄人群设计，着重于骨折、跌倒等老年高发风险的意外险。', features: '投保年龄上限高，部分产品包含骨折津贴或救护车费用。', function: '应对老年人因身体机能下降更容易发生的意外伤害和骨折风险。', audience: '60岁以上的退休老年群体。', selectionPoints: '骨折保障额度，意外医疗报销比例，对既往症的限制。', coreMetrics: '骨折/烧烫伤保额，意外医疗保额，投保年龄上限。' },
    { code: 'C0201', name: '两轮电动车意外', definition: '专门针对骑行两轮电动车过程中发生的意外伤害提供保障。', features: '聚焦特定交通工具风险，通常包含人身伤害及第三者责任。', function: '转移日益普及的电动车使用带来的特定意外和责任风险。', audience: '经常使用电动自行车或摩托车的骑行者。', selectionPoints: '是否包含驾驶员本身和乘客责任，第三者责任限额。', coreMetrics: '驾乘人员伤亡保额，第三者责任限额，保障范围。' },
    { code: 'C0202', name: '交通意外', definition: '针对乘坐或驾驶特定交通工具时发生的意外提供额外赔付。', features: '高杠杆，仅在特定交通场景下提供高额保障。', function: '应对出差、旅行等高频交通出行中可能遭遇的巨大风险。', audience: '经常出差或需要高额交通意外保障的人群。', selectionPoints: '涵盖的交通工具种类（飞机、火车、私家车），赔付倍数设定。', coreMetrics: '交通工具意外额外保额，保障期限，保费。' },
    { code: 'C0203', name: '旅行意外', definition: '在旅行期间提供意外身故/伤残、意外医疗及旅行不便（如延误）保障。', features: '保障期限灵活，包含紧急救援、旅行延误、证件损失等特色服务。', function: '转移旅行途中可能遇到的健康、安全和行程中断等风险。', audience: '国内或出境旅行者。', selectionPoints: '紧急救援服务范围，高风险运动是否承保，医疗费用垫付服务。', coreMetrics: '医疗保额，紧急救援限额，旅行延误赔偿标准。' },
    { code: 'D0101', name: '养老年金（分红型）', definition: '在退休后按期给付养老金，同时可参与保险公司盈余分红的年金保险。', features: '确定性给付搭配不确定性分红，收益潜力高于普通年金。', function: '强制储蓄，规划未来养老生活，抵御长寿风险和通货膨胀。', audience: '有稳定收入，希望尽早规划退休生活，追求稳定收益和分红增值。', selectionPoints: '保证给付期限，分红实现率和历史表现，预定利率水平。', coreMetrics: '保证利率，分红实现率，养老金领取起始年龄，IRR。' },
    { code: 'D0102', name: '养老年金', definition: '在退休后固定按期给付养老金，现金流确定且写入合同。', features: '确定性强，收益和给付金额固定，保证长期稳定性。', function: '锁定退休后的收入来源，实现专款专用，对抗长寿风险。', audience: '追求稳定、明确退休收入来源的群体。', selectionPoints: '保证领取期限，领取年龄和方式，现价增长与身故责任。', coreMetrics: '保证领取年限，内部收益率 (IRR)，养老金领取金额。' },
    { code: 'E0101', name: '中期年金（分红型）', definition: '缴费和领取周期都相对较短的年金产品，带有分红收益。', features: '流动性高于养老金，投资期和回报期灵活，有分红增值潜力。', function: '实现中期财富增值和规划，满足特定时间节点的资金需求（如十年后大额支出）。', audience: '有明确中期财务目标，追求确定性收益和分红可能性的投资者。', selectionPoints: '分红机制和历史实现率，退保损失，现价回本速度。', coreMetrics: '保证利率，分红实现率，缴费/领取期限，IRR。' },
    { code: 'E0102', name: '中期年金', definition: '锁定一个中期期限的现金流或生存金给付的年金产品。', features: '收益确定，期限相对灵活，可作为家庭资产配置的一部分。', function: '用于中期教育金、购房金等特定目标的规划和储蓄。', audience: '追求中期确定性回报的储蓄者。', selectionPoints: '现金价值增长速度，预定利率，给付时间点。', coreMetrics: '预定利率，缴费/领取期限，IRR。' },
    { code: 'E0103', name: '教育金', definition: '专为子女教育储蓄设计，在孩子特定年龄给付教育金、深造金等。', features: '强制储蓄，锁定未来教育资金；通常有投保人豁免等保障功能。', function: '确保子女在关键教育阶段（高中、大学）有稳定的资金支持，实现专款专用。', audience: '有子女，希望提前锁定教育费用且注重专款专用的家庭。', selectionPoints: '教育金给付年龄和金额，投保人豁免责任的范围，总现价收益。', coreMetrics: '教育金给付额度，豁免责任范围，IRR。' },
    { code: 'E0201', name: '增额终身寿（分红型）', definition: '保额和现金价值会随着时间复利增长的终身寿险，带有分红收益。', features: '现金价值增长确定性高，同时有分红可能，兼具保障和储蓄功能。', function: '长期财富规划、资产传承和锁定长期确定性现金流。', audience: '追求资产长期稳健增值、有高额传承需求的高净值人群。', selectionPoints: '现价复利增速，分红实现率，减保取现规则的灵活性。', coreMetrics: '现价复利增长率，分红实现率，保额增长率，减保灵活性。' },
    { code: 'E0202', name: '增额终身寿', definition: '保额和现金价值按固定复利持续增长的终身寿险。', features: '收益确定，现价增长明确写入合同，具有较高的减保取现流动性。', function: '长期强制储蓄，资产配置，身故传承，或作为长期备用金。', audience: '注重资金安全性和确定性，有长期储蓄和传承需求的群体。', selectionPoints: '现价回本速度，减保规则的灵活性，有效保额增长率。', coreMetrics: '现价复利增长率，现金价值增长曲线，IRR，减保规则。' },
    { code: 'E0301', name: '两全保险', definition: '无论被保险人生存到期满或在期内身故，保险公司都会给付保险金。', features: '具备“有病治病，无病返本”的特点，迎合消费者“保费安全”的需求。', function: '结合了储蓄和身故保障，确保资金到期返还，实现资产保全。', audience: '偏爱保守型投资，希望保费安全返回的储蓄者。', selectionPoints: '保障期限，生存金或满期金的给付比例，IRR（通常较低）。', coreMetrics: '满期给付金额，身故保额，保障期限，IRR。' },
    { code: 'F0101', name: '定期寿险', definition: '在特定期限内，若被保险人身故或全残，给付保额。期满则合同终止。', features: '纯保障型产品，保费低廉，杠杆极高，投保门槛低。', function: '转移家庭经济支柱的死亡或全残风险，保障家人生活稳定和债务偿还。', audience: '承担家庭经济责任的成年人（有房贷、车贷等债务）。', selectionPoints: '保额充足性（覆盖负债+未来开支）、健康告知宽松度、免责条款。', coreMetrics: '保额、保障期限、保费（性价比）、健康告知、免责条款' },
];

export const LEVEL_2_DATA: CategoryDefinition[] = [
    { 
        code: 'A01', 
        name: '住院医疗', 
        definition: '主要报销因疾病或意外导致的住院治疗费用，包括床位费、手术费、药品费等，是社保的重要补充。', 
        features: '通常保额高（如百万级别），保费相对较低，杠杆效应显著，能有效应对大额医疗支出。', 
        function: '防止家庭因病返贫，覆盖社保目录内外的医疗开销，提供更优质的医疗资源和服务（如绿通）。', 
        audience: '所有希望规避大病医疗风险的个人和家庭，尤其是年轻人和家庭支柱。', 
        selectionPoints: '续保条件（是否保证续保）、免赔额、报销范围（含外购药）、增值服务。', 
        coreMetrics: '保证续保年限、免赔额、报销比例、外购药目录、保费',
        faqList: [
            { question: '保什么', isFocus: true, answer: '给我讲下这款产品的保障范围和保障特色' },
            { question: '投保规则', isFocus: false, answer: '给我讲下这款产品的投保规则' },
            { question: '续保规则', isFocus: false, answer: '给我讲下这款产品的续保规则' },
            { question: '健康要求', isFocus: true, answer: '给我讲下这款产品的健康要求' },
            { question: '价格及缴费方式', isFocus: false, answer: '给我讲下这款产品的价格及缴费方式' },
            { question: '适合人群', isFocus: false, answer: '给我讲下这款产品的适合人群' },
            { question: '保险公司', isFocus: false, answer: '给我讲下这款产品的保险公司' },
            { question: '理赔流程', isFocus: true, answer: '给我讲下这款产品的理赔流程' },
            { question: '医疗服务', isFocus: false, answer: '给我讲下这款产品的医疗服务' }
        ]
    },
    { 
        code: 'A02', 
        name: '门诊医疗', 
        definition: '用于报销日常看病产生的门诊或急诊费用，如挂号费、检查费、药费等，通常有年度限额。', 
        features: '解决小额但高频的医疗支出，降低日常看病负担。常作为中高端医疗险或企业团险的福利。', 
        function: '提升就医体验，减少小病带来的经济压力，鼓励及时就医，管理日常健康。', 
        audience: '有小孩的家庭、体质较弱者、或追求全面医疗保障的高净值人群。', 
        selectionPoints: '年度限额、单次限额、免赔额/次数、医院网络（是否含私立）、报销比例。', 
        coreMetrics: '年度限额、免赔额、报销比例、就医医院范围、保费',
        faqList: [
            { question: '保什么', isFocus: true, answer: '给我讲下这款产品的保障范围和保障特色' },
            { question: '投保规则', isFocus: false, answer: '给我讲下这款产品的投保规则' },
            { question: '续保规则', isFocus: false, answer: '给我讲下这款产品的续保规则' },
            { question: '健康要求', isFocus: true, answer: '给我讲下这款产品的健康要求' },
            { question: '价格及缴费方式', isFocus: false, answer: '给我讲下这款产品的价格及缴费方式' },
            { question: '适合人群', isFocus: false, answer: '给我讲下这款产品的适合人群' },
            { question: '保险公司', isFocus: false, answer: '给我讲下这款产品的保险公司' },
            { question: '理赔流程', isFocus: true, answer: '给我讲下这款产品的理赔流程' },
            { question: '医疗服务', isFocus: false, answer: '给我讲下这款产品的医疗服务' }
        ]
    },
    { 
        code: 'B01', 
        name: '短期重疾', 
        definition: '保障期限为一年，确诊合同约定的重大疾病后一次性给付保险金，属于消费型保险。', 
        features: '保费极低，保障杠杆非常高，适合在特定时期内用低预算快速补充高额重疾保障。', 
        function: '确诊后提供一笔现金，用于弥补短期收入损失和支付康复费用，解决燃眉之急。', 
        audience: '预算有限的年轻人、或需要临时加保的家庭支柱。', 
        selectionPoints: '续保稳定性、等待期、疾病定义、是否含轻/中症保障。', 
        coreMetrics: '保额、保费、续保条件、等待期、疾病种类',
        faqList: [
            { question: '保什么', isFocus: true, answer: '给我讲下这款产品的保障范围和保障特色' },
            { question: '保障场景', isFocus: true, answer: '给我讲下这款产品的赔付规则' },
            { question: '投保规则', isFocus: false, answer: '给我讲下这款产品的投保规则' },
            { question: '价格及缴费方式', isFocus: false, answer: '给我讲下这款产品的价格及缴费方式' },
            { question: '适合人群', isFocus: false, answer: '给我讲下这款产品的适合人群' },
            { question: '保险公司', isFocus: false, answer: '给我讲下这款产品的保险公司' },
            { question: '理赔流程', isFocus: true, answer: '给我讲下这款产品的理赔流程' }
        ]
    },
    { 
        code: 'B02', 
        name: '定期重疾', 
        definition: '在约定保障期限内（如20年、30年或至70岁）提供重疾保障，期满后合同终止。', 
        features: '在家庭责任最重的阶段提供高性价比保障，保费比终身重疾便宜，保障聚焦。', 
        function: '转移家庭支柱在工作年龄段的核心风险，确保即使患病，家庭财务也不会崩溃。', 
        audience: '事业上升期、承担家庭主要经济责任的成年人（上有老下有小）。', 
        selectionPoints: '保障期限选择、轻中症赔付比例、是否含身故责任、多次赔付设计。', 
        coreMetrics: '保额、保障期限、轻/中症赔付比例、保费、保费豁免',
        faqList: [
            { question: '保什么', isFocus: true, answer: '给我讲下这款产品的保障范围和保障特色' },
            { question: '保障场景', isFocus: true, answer: '给我讲下这款产品的赔付规则' },
            { question: '投保规则', isFocus: false, answer: '给我讲下这款产品的投保规则' },
            { question: '价格及缴费方式', isFocus: false, answer: '给我讲下这款产品的价格及缴费方式' },
            { question: '适合人群', isFocus: false, answer: '给我讲下这款产品的适合人群' },
            { question: '保险公司', isFocus: false, answer: '给我讲下这款产品的保险公司' },
            { question: '理赔流程', isFocus: true, answer: '给我讲下这款产品的理赔流程' }
        ]
    },
    { 
        code: 'B03', 
        name: '终身重疾', 
        definition: '提供终身重大疾病保障，确诊后给付保险金，通常含有身故责任，保障至生命终点。', 
        features: '保障期限长，锁定终身风险，后期现金价值较高，兼具保障和一定的储蓄功能。', 
        function: '终极的健康风险转移工具，既可用于疾病治疗，也可在身后作为资产传承。', 
        audience: '预算充足，追求终身保障和财富传承的人群。', 
        selectionPoints: '多次赔付设计、疾病分组、现金价值增长率、身故责任形态。', 
        coreMetrics: '保额、现金价值增长率、多次赔付条件、疾病分组、身故责任',
        faqList: [
            { question: '保什么', isFocus: true, answer: '给我讲下这款产品的保障范围和保障特色' },
            { question: '保障场景', isFocus: true, answer: '给我讲下这款产品的赔付规则' },
            { question: '投保规则', isFocus: false, answer: '给我讲下这款产品的投保规则' },
            { question: '价格及缴费方式', isFocus: false, answer: '给我讲下这款产品的价格及缴费方式' },
            { question: '适合人群', isFocus: false, answer: '给我讲下这款产品的适合人群' },
            { question: '保险公司', isFocus: false, answer: '给我讲下这款产品的保险公司' },
            { question: '理赔流程', isFocus: true, answer: '给我讲下这款产品的理赔流程' }
        ]
    },
    {
        code: 'C01',
        name: '综合意外',
        definition: '提供因意外导致的身故、伤残和医疗费用报销的综合性保障，覆盖日常生活中的各种意外。',
        features: '保费低、杠杆高，投保门槛低（通常无健康告知），保障范围广，是人手必备的基础保障。',
        function: '应对突发意外带来的经济冲击，提供伤残补偿、医疗费用报销和身故抚恤。',
        audience: '所有人群，尤其是经常外出、从事有一定风险工作或家庭经济支柱。',
        selectionPoints: '意外身故/伤残保额、意外医疗报销范围（是否含社保外）、猝死责任。',
        coreMetrics: '意外身故/伤残保额、意外医疗保额、猝死责任、职业类别限制',
        faqList: [
            { question: '保什么', isFocus: true, answer: '给我讲下这款产品的保障范围和保障特色' },
            { question: '保障场景', isFocus: true, answer: '给我讲下这款产品的赔付规则' },
            { question: '投保规则', isFocus: false, answer: '给我讲下这款产品的投保规则' },
            { question: '价格及缴费方式', isFocus: false, answer: '给我讲下这款产品的价格及缴费方式' },
            { question: '适合人群', isFocus: false, answer: '给我讲下这款产品的适合人群' },
            { question: '保险公司', isFocus: false, answer: '给我讲下这款产品的保险公司' },
            { question: '理赔流程', isFocus: true, answer: '给我讲下这款产品的理赔流程' }
        ]
    },
    {
        code: 'C02',
        name: '出行意外',
        definition: '专为出行场景设计，保障乘坐交通工具或在旅行途中发生的意外风险，通常保额很高。',
        features: '场景聚焦，杠杆极高，用很低的保费就能获得上百万的特定场景保障，保障期限灵活。',
        function: '针对性转移航空、铁路、自驾等高风险出行场景的巨灾风险，提供超高额保障。',
        audience: '经常出差、旅游的商务人士和旅行爱好者。',
        selectionPoints: '覆盖的交通工具种类、保障期限、是否含紧急救援、高风险运动责任。',
        coreMetrics: '特定交通工具保额、保障期限、紧急救援服务、保费',
        faqList: [
            { question: '保什么', isFocus: true, answer: '给我讲下这款产品的保障范围和保障特色' },
            { question: '保障场景', isFocus: true, answer: '给我讲下这款产品的赔付规则' },
            { question: '投保规则', isFocus: false, answer: '给我讲下这款产品的投保规则' },
            { question: '价格及缴费方式', isFocus: false, answer: '给我讲下这款产品的价格及缴费方式' },
            { question: '适合人群', isFocus: false, answer: '给我讲下这款产品的适合人群' },
            { question: '保险公司', isFocus: false, answer: '给我讲下这款产品的保险公司' },
            { question: '理赔流程', isFocus: true, answer: '给我讲下这款产品的理赔流程' }
        ]
    },
    { code: 'D01', name: '年金', definition: '投保人按期缴费，到约定年龄后（如60岁），保险公司开始按年或月给付养老金。', features: '收益安全、稳定，提供与生命等长的现金流，专款专用，有效对抗长寿风险。', function: '强制储蓄，提前规划退休生活，确保老年有稳定、体面的收入来源，实现品质养老。', audience: '有稳定收入，希望提前锁定未来养老收入，追求安全稳健的个人或家庭。', selectionPoints: '保证领取期限、领取年龄和方式、内部收益率（IRR）、附加万能账户。', coreMetrics: '保证领取年限、内部收益率(IRR)、领取金额、起领年龄' },
    { code: 'E01', name: '年金', definition: '缴费和领取周期相对较短的年金险，通常用于实现5-15年内的中期财务目标。', features: '期限灵活，流动性相对较好，用于特定时间点的资金规划，收益写入合同，安全确定。', function: '作为子女教育金、婚嫁金、创业金的储备工具，实现专款专用和强制储蓄。', audience: '有明确中期（5-15年）财务规划需求的家庭。', selectionPoints: '缴费和领取期限、现金价值回本速度、内部收益率（IRR）。', coreMetrics: '领取时间、内部收益率(IRR)、现金价值、缴费期限' },
    { code: 'E02', name: '增额终身寿', definition: '保额和现金价值按固定复利逐年增长的终身寿险，兼具保障和长期储蓄功能。', features: '收益明确写入合同，安全稳定；现金价值增长快，可通过减保灵活取用资金。', function: '长期财富增值、资产传承、养老补充和子女教育金规划，是灵活的家庭蓄水池。', audience: '追求资产安全稳健增值，有长期储蓄或财富传承需求的高净值人群。', selectionPoints: '有效保额增长率、现金价值回本速度、减保/保单贷款规则的灵活性。', coreMetrics: '有效保额增长率、现金价值、内部收益率(IRR)、减保灵活性' },
    { code: 'E03', name: '两全保险', definition: '保险期内身故给付身故金，期满生存则给付满期金。即“保生又保死”的保险。', features: '满足了“不出事能返本”的消费心理，兼具储蓄和基础保障功能，但收益率通常较低。', function: '强制储蓄，确保在约定时间点有一笔确定的资金，同时提供基础的身故保障。', audience: '风险偏好极低，储蓄习惯较差，希望保费能“返还”的保守型消费者。', selectionPoints: '满期金给付金额、保障期限、内部收益率（IRR）的真实水平。', coreMetrics: '满期金给付金额、身故保额、内部收益率(IRR)、保障期限' },
    { code: 'F01', name: '定期寿险', definition: '在约定保障期限内，若被保险人身故或全残，保险公司给付保额，期满无事则合同终止。', features: '纯保障型产品，保费极低，杠杆超高，是体现爱与责任的家庭保障基石。', function: '防止家庭经济支柱突然离世导致家庭陷入财务困境，用于偿还债务、保障家人生活。', audience: '家庭经济支柱，尤其是有房贷、车贷或子女抚养责任的成年人。', selectionPoints: '保额充足性（覆盖负债+未来开支）、**性价比**（费率）、健康告知宽松度、免责条款。', coreMetrics: '保额、保障期限、保费（性价比）、健康告知、免责条款' },
];

export const LEVEL_1_DATA: CategoryDefinition[] = [
    { code: 'A', name: '医疗险', definition: '报销因疾病或意外产生的医疗费用，是社保的有效补充，用于解决“看病贵”的问题。', features: '保费低、保额高，杠杆效应显著，能覆盖社保目录内外的大额医疗开销，实用性强。', function: '防止家庭因病致贫或返贫，提供就医绿通等增值服务，让普通人也能享有更优质的医疗资源。', audience: '所有担心大病医疗费用风险的个人和家庭，特别是家庭经济支柱。', selectionPoints: '**续保条件**（最关键）、免赔额、报销范围（含外购药）、健康告知、增值服务。', coreMetrics: '保证续保年限、免赔额、报销比例、外购药目录、保费' },
    { code: 'B', name: '重疾险', definition: '确诊合同约定的重大疾病后，保险公司一次性给付一笔保险金，与实际医疗花费无关。', features: '一次性给付，资金用途灵活，可用于治疗康复、家庭生活开支及收入损失补偿。', function: '核心是**“收入损失补偿”**，弥补患病期间无法工作的收入缺口，保障家庭生活稳定。', audience: '家庭的经济支柱，承担房贷、车贷、子女教育和赡养老人责任的成年人。', selectionPoints: '轻/中症保障、多次赔付设计、高发疾病（如心脑血管）覆盖、是否含身故责任。', coreMetrics: '保额、疾病种类与分组、轻/中症赔付比例、多次赔付条件、保费' },
    { code: 'C', name: '意外险', definition: '为因外来的、突发的、非本意的、非疾病的客观事件导致的伤害提供保障。', features: '保费低、杠杆高，投保门槛极低，通常无需健康告知，是人人必备的基础保障。', function: '提供意外身故/伤残赔偿金，报销意外医疗费用，部分产品含猝死和住院津贴。', audience: '所有人群，尤其是经常外出、从事有一定风险工作、老人和小孩等易发意外群体。', selectionPoints: '意外医疗报销范围（是否不限社保）、伤残赔付标准、是否含猝死责任、职业限制。', coreMetrics: '意外身故/伤残保额、意外医疗保额、猝死责任保额、职业类别限制' },
    { code: 'D', name: '养老金', definition: '年轻时定期投入资金，达到约定退休年龄后，保险公司开始按期给付一笔稳定的现金流。', features: '安全稳定，提供与生命等长的确定性现金流，专款专用，有效对抗长寿风险。', function: '强制储蓄，提前规划退休生活，确保老年有稳定、体面的收入来源，实现品质养老。', audience: '有稳定收入，希望提前锁定未来养老收入，追求安全稳健理财方式的个人或家庭。', selectionPoints: '领取年龄和方式、**保证领取期限**、内部收益率（IRR）、现金价值增长情况。', coreMetrics: '保证领取年限、内部收益率(IRR)、领取金额、起领年龄' },
    { code: 'E', name: '储蓄型', definition: '以资产增值为主要目的，兼具身故保障功能，其保额和现金价值会随时间复利增长。', features: '收益明确写入合同，安全稳定；后期可通过减保、保单贷款等方式灵活取用资金。', function: '实现长期强制储蓄、规划养老/教育金、资产隔离与财富传承，是家庭的“蓄水池”。', audience: '有长期闲置资金，追求资产安全稳健增值，有财富传承或长期规划需求的家庭。', selectionPoints: '**现金价值增长速度**、回本时间、减保/保单贷款规则的灵活性、预定利率。', coreMetrics: '有效保额增长率、内部收益率(IRR)、现金价值、减保灵活性' },
    { code: 'F', name: '定期寿险', definition: '在约定保障期限内，若被保险人身故或全残，保险公司给付保额；期满则合同终止。', features: '纯保障型产品，保费极低，杠杆超高，用小成本转移家庭支柱倒下的巨大风险。', function: '核心功能是“**留爱不留债**”，防止家庭因经济支柱倒下而陷入财务危机，保障家人生活。', audience: '家庭经济支柱，尤其是有房贷、车贷或子女抚养责任的成年人。', selectionPoints: '保额充足性（覆盖负债+未来开支）、**性价比**（费率）、健康告知宽松度、免责条款。', coreMetrics: '保额、保障期限、保费（性价比）、健康告知、免责条款' },
];

export const MOCK_END_USERS: EndUser[] = [
  {
    id: 'U001',
    name: '张伟',
    age: 32,
    city: '北京',
    monthlyIncome: 25000,
    familyMembers: '配偶, 子女(1)',
    familyMemberCount: 3,
    gaps: {
      accident: 1000000,
      medical: 3000000,
      criticalIllness: 500000,
      termLife: 2000000,
      annuity: 0,
      education: 500000,
    },
    submissionTime: '2024-05-20 10:30:00',
    channel: '微信小程序'
  },
  {
    id: 'U002',
    name: '李娜',
    age: 28,
    city: '上海',
    monthlyIncome: 18000,
    familyMembers: '未婚',
    familyMemberCount: 1,
    gaps: {
      accident: 500000,
      medical: 1000000,
      criticalIllness: 300000,
      termLife: 0,
      annuity: 200000,
      education: 0,
    },
    submissionTime: '2024-05-21 14:15:00',
    channel: 'APP'
  },
  {
    id: 'U003',
    name: '王强',
    age: 40,
    city: '深圳',
    monthlyIncome: 45000,
    familyMembers: '配偶, 子女(2), 父母(2)',
    familyMemberCount: 6,
    gaps: {
      accident: 2000000,
      medical: 6000000,
      criticalIllness: 1000000,
      termLife: 5000000,
      annuity: 1000000,
      education: 2000000,
    },
    submissionTime: '2024-05-22 09:00:00',
    channel: 'Web官网'
  },
  {
    id: 'U004',
    name: '刘芳',
    age: 35,
    city: '成都',
    monthlyIncome: 12000,
    familyMembers: '配偶, 子女(1)',
    familyMemberCount: 3,
    gaps: {
      accident: 300000,
      medical: 2000000,
      criticalIllness: 200000,
      termLife: 500000,
      annuity: 0,
      education: 100000,
    },
    submissionTime: '2024-05-22 16:45:00',
    channel: '微信小程序'
  },
  {
    id: 'U005',
    name: '陈明',
    age: 25,
    city: '杭州',
    monthlyIncome: 15000,
    familyMembers: '未婚',
    familyMemberCount: 1,
    gaps: {
      accident: 500000,
      medical: 4000000,
      criticalIllness: 300000,
      termLife: 0,
      annuity: 0,
      education: 0,
    },
    submissionTime: '2024-05-23 11:20:00',
    channel: 'APP'
  },
   {
    id: 'U006',
    name: '赵敏',
    age: 45,
    city: '广州',
    monthlyIncome: 30000,
    familyMembers: '配偶, 子女(1)',
    familyMemberCount: 3,
    gaps: {
      accident: 1000000,
      medical: 2000000,
      criticalIllness: 800000,
      termLife: 1000000,
      annuity: 5000000,
      education: 0,
    },
    submissionTime: '2024-05-24 13:10:00',
    channel: 'Web官网'
  },
];

export const MOCK_CLAIMS_MATERIALS: ClaimsMaterial[] = [
  {
    id: 'mat-1',
    name: '诊断证明书',
    description: '医院出具的包含疾病诊断、治疗过程的正式证明文件。',
    sampleUrl: 'https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg',
    jsonSchema: JSON.stringify({
      type: 'object',
      properties: {
        diagnosis: { type: 'string', description: '诊断结果' },
        hospital_name: { type: 'string', description: '医院名称' },
        admission_date: { type: 'string', format: 'date', description: '入院日期' },
        discharge_date: { type: 'string', format: 'date', description: '出院日期' }
      }
    }, null, 2),
    required: true,
    aiAuditPrompt: '从诊断证明书中抽取诊断结论、医院名称、入院与出院日期，用于校验投保责任是否覆盖该疾病。若信息缺失，指出缺失项。'
  },
  {
    id: 'mat-2',
    name: '费用总清单',
    description: '医院打印的住院期间所有费用的明细清单。',
    sampleUrl: 'https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg',
    jsonSchema: JSON.stringify({
      type: 'object',
      properties: {
        total_amount: { type: 'number', description: '费用总额' },
        self_paid: { type: 'number', description: '自费金额' },
        medicare_paid: { type: 'number', description: '医保支付' }
      }
    }, null, 2),
    required: true,
    aiAuditPrompt: '核对费用总额、自费与医保支付三项数值并计算合理给付基数，输出不一致或异常值提示。'
  },
  {
    id: 'mat-3',
    name: '身份证',
    description: '被保险人或受益人的有效身份证明。',
    jsonSchema: JSON.stringify({
      type: 'object',
      properties: {
        name: { type: 'string', description: '姓名' },
        id_number: { type: 'string', description: '身份证号' }
      }
    }, null, 2),
    required: true,
    aiAuditPrompt: '比对证件姓名与保单被保险人/受益人信息，验证身份证号格式与校验位。'
  }
];

export const MOCK_CLAIM_ITEMS: ClaimItem[] = [
  {
    id: 'item-1',
    name: '一般住院医疗理赔',
    description: '针对普通疾病住院产生的费用进行理赔。',
    materialIds: ['mat-1', 'mat-2', 'mat-3']
  },
  {
    id: 'item-2',
    name: '意外伤残理赔',
    description: '针对因意外导致的伤残进行理赔。',
    materialIds: ['mat-1', 'mat-3']
  }
];

export const MOCK_PRODUCT_CLAIM_CONFIGS: ProductClaimConfig[] = [
  {
    productCode: 'ZA-001',
    responsibilityConfigs: [
      {
        responsibilityId: 'resp-1',
        claimItemIds: ['item-1']
      }
    ]
  }
];

export const MOCK_CLAIM_CASES: ClaimCase[] = [
  {
    id: 'claim-1',
    reportNumber: 'R202405010001',
    reporter: '张三',
    reportTime: '2024-05-01 10:00:00',
    accidentTime: '2024-04-28 15:30:00',
    accidentReason: '疾病住院',
    claimAmount: 5000.00,
    productCode: 'ZA-001',
    productName: '尊享e生2024版',
    status: ClaimStatus.PROCESSING,
    operator: '李四'
  },
  {
    id: 'claim-2',
    reportNumber: 'R202405100005',
    reporter: '王五',
    reportTime: '2024-05-10 14:20:00',
    accidentTime: '2024-05-09 09:00:00',
    accidentReason: '意外摔伤',
    claimAmount: 1200.50,
    productCode: 'ZA-002',
    productName: '小米综合意外险',
    status: ClaimStatus.REPORTED,
    operator: '赵六'
  },
  {
    id: 'claim-3',
    reportNumber: 'R202405150012',
    reporter: '陈七',
    reportTime: '2024-05-15 09:15:00',
    accidentTime: '2024-05-10 20:00:00',
    accidentReason: '急性阑尾炎',
    claimAmount: 8500.00,
    productCode: 'ZA-001',
    productName: '尊享e生2024版',
    status: ClaimStatus.APPROVED,
    operator: '孙八'
  },
  {
    id: 'claim-4',
    reportNumber: 'R202405200020',
    reporter: '周九',
    reportTime: '2024-05-20 16:45:00',
    accidentTime: '2024-05-18 11:30:00',
    accidentReason: '交通事故',
    claimAmount: 25000.00,
    productCode: 'ZA-003',
    productName: '百万医疗险2024',
    status: ClaimStatus.PENDING_INFO,
    operator: '吴十'
  },
  {
    id: 'claim-detail-1',
    reportNumber: 'CLAIM-2024-0421',
    reporter: '王芳',
    reportTime: '2024-01-02 09:24',
    accidentTime: '2024-01-01 15:15',
    accidentReason: '疾病住院',
    accidentLocation: '中国北京市朝阳区主街123号',
    claimAmount: 144.00,
    approvedAmount: 132.00,
    productCode: 'ZA-001',
    productName: '尊享e生2024版',
    status: ClaimStatus.PROCESSING,
    operator: '系统管理员',
    policyholder: '张伟',
    insured: '李娜',
    policyPeriod: '2024年1月1日 - 2024年12月31日',
    policyNumber: 'POL-2024-7890',
    calculationItems: [
      { id: 'calc-1', type: '医疗费用', fileName: '发票1.jpg', date: '2025-1-1', item: '色甘酸钠', amount: 17, claimAmount: 17, basis: '乙类药，保险覆盖，100%报销' },
      { id: 'calc-2', type: '医疗费用', fileName: '发票1.jpg', date: '2025-1-1', item: '急诊诊疗', amount: 25, claimAmount: 25, basis: '甲类药，保险覆盖，100%报销' },
      { id: 'calc-3', type: '医疗费用', fileName: '发票1.jpg', date: '2025-1-1', item: '氯胆乳膏', amount: 30, claimAmount: 24, basis: '丙类药，不属保险范围，80%报销' },
      { id: 'calc-4', type: 'Medical', fileName: 'Invoice 2.jpg', date: '2025-1-2', item: 'Sodium Cromoglicate', amount: 17, claimAmount: 17, basis: 'Class B, covered by insurance, 100% reimbursement' },
      { id: 'calc-5', type: 'Medical', fileName: 'Invoice 2.jpg', date: '2025-1-2', item: 'Emergency Consultation', amount: 25, claimAmount: 25, basis: 'Class A, covered by insurance, 100% reimbursement' },
      { id: 'calc-6', type: 'Medical', fileName: 'Invoice 2.jpg', date: '2025-1-2', item: 'Hydroquinone Cream', amount: 30, claimAmount: 24, basis: 'Class C, not covered by insurance, 80% reimbursement' },
    ],
    fileCategories: [
      { name: '医疗费用', files: [{ name: '发票1.jpg', url: '#' }, { name: '发票2.jpg', url: '#' }, { name: '诊断证明.pdf', url: '#' }] },
      { name: '伤残费用', files: [] },
      { name: '误工费', files: [{ name: '请假条.jpg', url: '#' }] }
    ],
    risks: [
      { type: 'danger', title: '高欺诈概率', description: '基于图像分析，发票1.jpg显示可能被篡改的迹象。' },
      { type: 'warning', title: '文件不完整', description: '雇主证明缺少公章。' }
    ]
  }
];

// --- START: Ruleset Management Constants ---
export const PRODUCT_LINE_LABELS: Record<string, string> = {
  [RulesetProductLine.ACCIDENT]: '意外险',
  [RulesetProductLine.HEALTH]: '医疗险',
  [RulesetProductLine.CRITICAL_ILLNESS]: '重疾险',
  [RulesetProductLine.TERM_LIFE]: '定期寿险',
  [RulesetProductLine.WHOLE_LIFE]: '终身寿险',
  [RulesetProductLine.ANNUITY]: '年金险',
};

export const DOMAIN_LABELS: Record<string, string> = {
  [ExecutionDomain.ELIGIBILITY]: '定责',
  [ExecutionDomain.ASSESSMENT]: '定损',
  [ExecutionDomain.POST_PROCESS]: '后处理',
};

export const RULE_STATUS_LABELS: Record<string, string> = {
  [RuleStatus.EFFECTIVE]: '生效',
  [RuleStatus.DISABLED]: '已禁用',
  [RuleStatus.DRAFT]: '草稿',
};

export const RULE_STATUS_COLORS: Record<string, string> = {
  [RuleStatus.EFFECTIVE]: 'bg-green-100 text-green-700',
  [RuleStatus.DISABLED]: 'bg-gray-100 text-gray-500',
  [RuleStatus.DRAFT]: 'bg-yellow-100 text-yellow-700',
};

export const CATEGORY_LABELS: Record<string, string> = {
  [RuleCategory.COVERAGE_SCOPE]: '保障范围',
  [RuleCategory.EXCLUSION]: '除外责任',
  [RuleCategory.WAITING_PERIOD]: '等待期',
  [RuleCategory.CLAIM_TIMELINE]: '报案时效',
  [RuleCategory.COVERAGE_PERIOD]: '保障期间',
  [RuleCategory.POLICY_STATUS]: '保单状态',
  [RuleCategory.ITEM_CLASSIFICATION]: '费用分类',
  [RuleCategory.PRICING_REASONABILITY]: '定价合理性',
  [RuleCategory.DISABILITY_ASSESSMENT]: '伤残评估',
  [RuleCategory.DEPRECIATION]: '折旧',
  [RuleCategory.PROPORTIONAL_LIABILITY]: '按责分摊',
  [RuleCategory.DEDUCTIBLE]: '免赔额',
  [RuleCategory.SUB_LIMIT]: '分项限额',
  [RuleCategory.SOCIAL_INSURANCE]: '社保结算',
  [RuleCategory.BENEFIT_OFFSET]: '既往赔付抵扣',
  [RuleCategory.AGGREGATE_CAP]: '总限额',
  [RuleCategory.POST_ADJUSTMENT]: '后处理调整',
};

export const OPERATOR_LABELS: Record<string, string> = {
  [ConditionOperator.EQ]: '等于',
  [ConditionOperator.NE]: '不等于',
  [ConditionOperator.GT]: '大于',
  [ConditionOperator.GTE]: '大于等于',
  [ConditionOperator.LT]: '小于',
  [ConditionOperator.LTE]: '小于等于',
  [ConditionOperator.IN]: '包含于',
  [ConditionOperator.NOT_IN]: '不包含于',
  [ConditionOperator.CONTAINS]: '包含',
  [ConditionOperator.NOT_CONTAINS]: '不包含',
  [ConditionOperator.STARTS_WITH]: '以...开头',
  [ConditionOperator.BETWEEN]: '介于',
  [ConditionOperator.IS_NULL]: '为空',
  [ConditionOperator.IS_NOT_NULL]: '不为空',
  [ConditionOperator.IS_TRUE]: '为真',
  [ConditionOperator.IS_FALSE]: '为假',
  [ConditionOperator.MATCHES_REGEX]: '正则匹配',
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  [RuleActionType.APPROVE_CLAIM]: '通过案件',
  [RuleActionType.REJECT_CLAIM]: '拒赔案件',
  [RuleActionType.SET_CLAIM_RATIO]: '设置赔付比例',
  [RuleActionType.ROUTE_CLAIM_MANUAL]: '转人工审核',
  [RuleActionType.FLAG_FRAUD]: '标记欺诈',
  [RuleActionType.TERMINATE_CONTRACT]: '解除合同',
  [RuleActionType.APPROVE_ITEM]: '通过明细',
  [RuleActionType.REJECT_ITEM]: '拒赔明细',
  [RuleActionType.ADJUST_ITEM_AMOUNT]: '调整明细金额',
  [RuleActionType.SET_ITEM_RATIO]: '设置明细比例',
  [RuleActionType.FLAG_ITEM]: '标记明细',
  [RuleActionType.APPLY_FORMULA]: '应用公式',
  [RuleActionType.APPLY_CAP]: '应用限额',
  [RuleActionType.APPLY_DEDUCTIBLE]: '应用免赔额',
  [RuleActionType.SUM_COVERAGES]: '汇总保障',
  [RuleActionType.DEDUCT_PRIOR_BENEFIT]: '扣减既往赔付',
  [RuleActionType.ADD_REMARK]: '添加备注',
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  CLAUSE: '条款',
  POLICY: '保单',
  REGULATION: '监管法规',
  AI_GENERATED: 'AI生成',
  MANUAL: '手动录入',
};

export const PRIORITY_LEVEL_LABELS: Record<number, string> = {
  1: '最高优先级（条款/法规强制）',
  2: '高优先级（保单特约）',
  3: '中优先级（通用规则）',
  4: '低优先级（默认/兜底）',
};

export const EXECUTION_MODE_LABELS: Record<string, string> = {
  ALL_MATCH: '全量匹配',
  FIRST_MATCH: '首次匹配',
  PRIORITY_ORDERED: '按优先级',
};

export const INPUT_GRANULARITY_LABELS: Record<string, string> = {
  CLAIM: '案件级',
  ITEM: '明细级',
  COVERAGE: '保障级',
};

export const FIELD_SCOPE_LABELS: Record<string, string> = {
  CLAIM: '案件',
  POLICY: '保单',
  ITEM: '明细',
  COMPUTED: '计算值',
};

export const FIELD_DATA_TYPE_LABELS: Record<string, string> = {
  STRING: '字符串',
  NUMBER: '数字',
  BOOLEAN: '布尔',
  DATE: '日期',
  ENUM: '枚举',
  ARRAY: '数组',
};

export const MOCK_RULESETS: InsuranceRuleset[] = [
  {
    ruleset_id: 'RS-ACCIDENT-001',
    product_line: RulesetProductLine.ACCIDENT,
    policy_info: {
      policy_no: 'POL-2024-ACC-001',
      product_code: 'ZA-002',
      product_name: '小米综合意外险',
      insurer: '众安保险',
      effective_date: '2024-01-01',
      expiry_date: '2024-12-31',
      coverages: [
        { coverage_code: 'ACC_DEATH', coverage_name: '意外身故', sum_insured: 500000, deductible: 0, co_pay_ratio: 0 },
        { coverage_code: 'ACC_MEDICAL', coverage_name: '意外医疗', sum_insured: 50000, deductible: 100, co_pay_ratio: 0.1 },
      ],
    },
    rules: [
      {
        rule_id: 'R001',
        rule_name: '保障期间校验',
        description: '检查事故日期是否在保障期间内',
        category: RuleCategory.COVERAGE_PERIOD,
        status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.ELIGIBILITY, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'CLAUSE', source_ref: '条款第三条', clause_code: 'CL-003', source_text: '保障期间为保险合同生效之日起至到期日止' },
        priority: { level: 1, rank: 10 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            { field: 'claim.accident_date', operator: ConditionOperator.GTE, value: '${policy.effective_date}' },
            { field: 'claim.accident_date', operator: ConditionOperator.LTE, value: '${policy.expiry_date}' },
          ],
        },
        action: { action_type: RuleActionType.APPROVE_CLAIM, params: {} },
        parsing_confidence: { overall: 0.95, condition_confidence: 0.93, action_confidence: 0.97, needs_human_review: false },
      },
      {
        rule_id: 'R002',
        rule_name: '等待期校验',
        description: '意外险通常无等待期',
        category: RuleCategory.WAITING_PERIOD,
        status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.ELIGIBILITY, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'POLICY', source_ref: '保单特约', clause_code: null, source_text: '意外险无等待期' },
        priority: { level: 3, rank: 20 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: { action_type: RuleActionType.APPROVE_CLAIM, params: {} },
      },
      {
        rule_id: 'R003',
        rule_name: '除外责任-酒驾',
        description: '酒后驾驶导致的事故不予赔付',
        category: RuleCategory.EXCLUSION,
        status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.ELIGIBILITY, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'CLAUSE', source_ref: '条款第七条', clause_code: 'CL-007', source_text: '被保险人饮酒、醉酒后驾车导致的事故，不承担给付保险金的责任' },
        priority: { level: 1, rank: 5 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            { field: 'claim.is_drunk_driving', operator: ConditionOperator.IS_TRUE, value: null },
          ],
        },
        action: { action_type: RuleActionType.REJECT_CLAIM, params: { reject_reason_code: 'EXCL_DRUNK_DRIVING' } },
        parsing_confidence: { overall: 0.65, condition_confidence: 0.58, action_confidence: 0.72, needs_human_review: true, review_hints: ['酒驾判定条件可能需要补充BAC阈值'] },
      },
      {
        rule_id: 'R004',
        rule_name: '费用分类判断',
        category: RuleCategory.ITEM_CLASSIFICATION,
        status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.ASSESSMENT, loop_over: 'claim.expense_items', item_alias: 'expense_item', item_action_on_reject: 'ZERO_AMOUNT' },
        source: { source_type: 'CLAUSE', source_ref: '条款第十条', clause_code: 'CL-010', source_text: '医疗费用按社保目录分类处理' },
        priority: { level: 2, rank: 10 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            { field: 'expense_item.category', operator: ConditionOperator.IN, value: ['治疗费', '检查费', '药品费', '材料费', '床位费'] },
          ],
        },
        action: { action_type: RuleActionType.APPROVE_ITEM, params: {} },
      },
      {
        rule_id: 'R005',
        rule_name: '伤残等级赔付',
        category: RuleCategory.DISABILITY_ASSESSMENT,
        status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.ASSESSMENT, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'CLAUSE', source_ref: '条款第五条', clause_code: 'CL-005', source_text: '根据伤残等级对应比例给付残疾保险金' },
        priority: { level: 2, rank: 20 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            { field: 'claim.disability_grade', operator: ConditionOperator.IS_NOT_NULL, value: null },
          ],
        },
        action: {
          action_type: RuleActionType.SET_CLAIM_RATIO,
          params: {
            disability_grade_table: [
              { grade: 1, payout_ratio: 1.0 }, { grade: 2, payout_ratio: 0.9 }, { grade: 3, payout_ratio: 0.8 },
              { grade: 4, payout_ratio: 0.7 }, { grade: 5, payout_ratio: 0.6 }, { grade: 6, payout_ratio: 0.5 },
              { grade: 7, payout_ratio: 0.4 }, { grade: 8, payout_ratio: 0.3 }, { grade: 9, payout_ratio: 0.2 },
              { grade: 10, payout_ratio: 0.1 },
            ],
          },
        },
      },
      {
        rule_id: 'R006',
        rule_name: '免赔额扣除',
        category: RuleCategory.DEDUCTIBLE,
        status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.POST_PROCESS, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'CLAUSE', source_ref: '条款第十二条', clause_code: 'CL-012', source_text: '每次事故免赔额100元' },
        priority: { level: 2, rank: 10 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: { action_type: RuleActionType.APPLY_DEDUCTIBLE, params: { deductible_amount: 100 } },
      },
      {
        rule_id: 'R007',
        rule_name: '年度限额',
        category: RuleCategory.AGGREGATE_CAP,
        status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.POST_PROCESS, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'CLAUSE', source_ref: '保障计划表', clause_code: 'CL-001', source_text: '意外医疗保险金限额：50,000元/年' },
        priority: { level: 1, rank: 20 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: { action_type: RuleActionType.APPLY_CAP, params: { cap_field: 'total_approved_amount', cap_amount: 50000 } },
      },
    ],
    execution_pipeline: {
      domains: [
        { domain: 'ELIGIBILITY', label: '定责', execution_mode: 'ALL_MATCH', input_granularity: 'CLAIM', short_circuit_on: ['REJECT_CLAIM'], category_sequence: [RuleCategory.COVERAGE_PERIOD, RuleCategory.WAITING_PERIOD, RuleCategory.POLICY_STATUS, RuleCategory.EXCLUSION, RuleCategory.COVERAGE_SCOPE, RuleCategory.CLAIM_TIMELINE] },
        { domain: 'ASSESSMENT', label: '定损', execution_mode: 'ALL_MATCH', input_granularity: 'ITEM', loop_collection: 'claim.expense_items', short_circuit_on: [], category_sequence: [RuleCategory.ITEM_CLASSIFICATION, RuleCategory.PRICING_REASONABILITY, RuleCategory.DISABILITY_ASSESSMENT, RuleCategory.DEPRECIATION, RuleCategory.PROPORTIONAL_LIABILITY] },
        { domain: 'POST_PROCESS', label: '后处理', execution_mode: 'PRIORITY_ORDERED', input_granularity: 'CLAIM', short_circuit_on: [], category_sequence: [RuleCategory.DEDUCTIBLE, RuleCategory.SUB_LIMIT, RuleCategory.SOCIAL_INSURANCE, RuleCategory.BENEFIT_OFFSET, RuleCategory.AGGREGATE_CAP, RuleCategory.POST_ADJUSTMENT] },
      ],
    },
    override_chains: [
      { chain_id: 'OC-001', topic: '免赔额适用方式', conflict_type: 'OVERRIDE', affected_domain: 'POST_PROCESS', effective_rule_id: 'R006', chain: [{ rule_id: 'R006', priority_level: 2, summary: '每次事故扣除100元免赔额', status: 'EFFECTIVE' }] },
    ],
    field_dictionary: {
      'claim.accident_date': { label: '事故日期', data_type: 'DATE', scope: 'CLAIM', source: '报案信息', applicable_domains: [ExecutionDomain.ELIGIBILITY, ExecutionDomain.ASSESSMENT] },
      'claim.is_drunk_driving': { label: '是否酒驾', data_type: 'BOOLEAN', scope: 'CLAIM', source: '调查信息', applicable_domains: [ExecutionDomain.ELIGIBILITY] },
      'claim.disability_grade': { label: '伤残等级', data_type: 'NUMBER', scope: 'CLAIM', source: '鉴定报告', applicable_domains: [ExecutionDomain.ASSESSMENT] },
      'expense_item.category': { label: '费用类别', data_type: 'ENUM', scope: 'ITEM', source: '费用明细', applicable_domains: [ExecutionDomain.ASSESSMENT], enum_values: [{ code: '治疗费', label: '治疗费' }, { code: '检查费', label: '检查费' }, { code: '药品费', label: '药品费' }, { code: '材料费', label: '材料费' }, { code: '床位费', label: '床位费' }] },
      'policy.effective_date': { label: '保单生效日', data_type: 'DATE', scope: 'POLICY', source: '保单信息', applicable_domains: [ExecutionDomain.ELIGIBILITY] },
      'policy.expiry_date': { label: '保单到期日', data_type: 'DATE', scope: 'POLICY', source: '保单信息', applicable_domains: [ExecutionDomain.ELIGIBILITY] },
      'total_approved_amount': { label: '总核定金额', data_type: 'NUMBER', scope: 'COMPUTED', source: '计算值', applicable_domains: [ExecutionDomain.POST_PROCESS] },
    },
    metadata: {
      schema_version: '2.0', version: '1', generated_at: '2024-06-15T10:30:00Z', generated_by: 'AI_PARSING', ai_model: 'claude-3.5-sonnet', total_rules: 7,
      rules_by_domain: { eligibility: 3, assessment: 2, post_process: 2 }, low_confidence_rules: 1, unresolved_conflicts: 0,
      audit_trail: [
        { timestamp: '2024-06-15T10:30:00Z', user_id: 'system', action: 'AI解析生成规则集' },
        { timestamp: '2024-06-15T11:00:00Z', user_id: 'admin', action: '人工审核通过' },
      ],
    },
  },
  {
    ruleset_id: 'RS-HEALTH-001',
    product_line: RulesetProductLine.HEALTH,
    policy_info: {
      policy_no: 'POL-2024-HLT-001', product_code: 'ZA-001', product_name: '尊享e生2024版', insurer: '众安保险',
      effective_date: '2024-01-01', expiry_date: '2024-12-31',
      coverages: [{ coverage_code: 'HLT_INPATIENT', coverage_name: '住院医疗', sum_insured: 6000000, deductible: 10000, co_pay_ratio: 0 }],
    },
    rules: [
      {
        rule_id: 'H001', rule_name: '等待期30天校验', description: '首次投保等待期30天', category: RuleCategory.WAITING_PERIOD, status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.ELIGIBILITY, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'CLAUSE', source_ref: '条款第四条', clause_code: 'CL-004', source_text: '首次投保等待期为30天' },
        priority: { level: 1, rank: 15 },
        conditions: {
          logic: ConditionLogic.OR,
          expressions: [
            { logic: 'AND' as const, expressions: [{ field: 'policy.is_renewal', operator: ConditionOperator.IS_TRUE, value: null }] },
            { logic: 'AND' as const, expressions: [{ field: 'policy.is_renewal', operator: ConditionOperator.IS_FALSE, value: null }, { field: 'claim.accident_date', operator: ConditionOperator.GT, value: '${policy.effective_date + 30d}' }] },
          ],
        },
        action: { action_type: RuleActionType.APPROVE_CLAIM, params: {} },
        parsing_confidence: { overall: 0.88, condition_confidence: 0.82, action_confidence: 0.94, needs_human_review: false },
      },
      {
        rule_id: 'H002', rule_name: '年度免赔额1万元', category: RuleCategory.DEDUCTIBLE, status: RuleStatus.EFFECTIVE,
        execution: { domain: ExecutionDomain.POST_PROCESS, loop_over: null, item_alias: null, item_action_on_reject: null },
        source: { source_type: 'CLAUSE', source_ref: '保障计划表', clause_code: 'CL-001', source_text: '年度免赔额：10,000元' },
        priority: { level: 1, rank: 10 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: { action_type: RuleActionType.APPLY_DEDUCTIBLE, params: { deductible_amount: 10000 } },
      },
    ],
    execution_pipeline: {
      domains: [
        { domain: 'ELIGIBILITY', label: '定责', execution_mode: 'ALL_MATCH', input_granularity: 'CLAIM', short_circuit_on: ['REJECT_CLAIM'], category_sequence: [RuleCategory.COVERAGE_PERIOD, RuleCategory.WAITING_PERIOD, RuleCategory.EXCLUSION] },
        { domain: 'ASSESSMENT', label: '定损', execution_mode: 'ALL_MATCH', input_granularity: 'ITEM', loop_collection: 'claim.expense_items', short_circuit_on: [], category_sequence: [RuleCategory.ITEM_CLASSIFICATION, RuleCategory.PRICING_REASONABILITY] },
        { domain: 'POST_PROCESS', label: '后处理', execution_mode: 'PRIORITY_ORDERED', input_granularity: 'CLAIM', short_circuit_on: [], category_sequence: [RuleCategory.DEDUCTIBLE, RuleCategory.SOCIAL_INSURANCE, RuleCategory.AGGREGATE_CAP] },
      ],
    },
    override_chains: [],
    field_dictionary: {
      'policy.is_renewal': { label: '是否续保', data_type: 'BOOLEAN', scope: 'POLICY', source: '保单信息', applicable_domains: [ExecutionDomain.ELIGIBILITY] },
      'claim.accident_date': { label: '事故日期', data_type: 'DATE', scope: 'CLAIM', source: '报案信息', applicable_domains: [ExecutionDomain.ELIGIBILITY, ExecutionDomain.ASSESSMENT] },
    },
    metadata: {
      schema_version: '2.0', version: '1', generated_at: '2024-07-01T14:00:00Z', generated_by: 'HYBRID', ai_model: 'claude-3.5-sonnet', total_rules: 2,
      rules_by_domain: { eligibility: 1, assessment: 0, post_process: 1 }, low_confidence_rules: 0, unresolved_conflicts: 0,
    },
  },
];
// --- END: Ruleset Management Constants ---

// --- START: Intake Config Constants ---
export const INTAKE_FIELD_TYPE_OPTIONS: Record<string, string> = {
  text: '文本输入',
  date: '日期选择',
  time: '时间选择',
  number: '数字输入',
  textarea: '多行文本',
  enum: '下拉选择',
  enum_with_other: '下拉选择(含其他)',
  multi_select: '多选',
  text_with_search: '搜索选择',
  boolean: '是/否',
};

export const INTAKE_VALIDATION_RULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'lte_today', label: '不晚于今天' },
  { value: 'lte_today_and_gte_policy_start', label: '不晚于今天且不早于保单生效日' },
  { value: 'gte_accident_date', label: '不早于事故日期' },
  { value: 'gt_zero', label: '大于零' },
  { value: 'max_length_200', label: '最大200字' },
  { value: 'max_length_500', label: '最大500字' },
  { value: 'phone_number', label: '手机号格式' },
];

export const INTAKE_FIELD_PRESETS: Record<string, IntakeField[]> = {
  [PrimaryCategory.ACCIDENT]: [
    { field_id: 'accident_date', label: '事故日期', type: 'date', required: true, placeholder: '请选择事故发生日期', validation: { rule: 'lte_today_and_gte_policy_start', error_msg: '事故日期必须在保单有效期内且不晚于今天' } },
    { field_id: 'accident_time', label: '事故时间', type: 'time', required: false, placeholder: '请选择事故发生时间（可选）' },
    { field_id: 'accident_location', label: '事故地点', type: 'text', required: true, placeholder: '请输入事故发生的详细地点' },
    { field_id: 'accident_reason', label: '出险原因', type: 'enum', required: true, placeholder: '请选择出险原因', options: ['交通事故', '跌倒坠落', '物体打击', '机械伤害', '动物咬伤', '高温烫伤', '溺水', '中毒', '其他'] },
    { field_id: 'injury_description', label: '伤情描述', type: 'textarea', required: true, placeholder: '请详细描述受伤情况', validation: { rule: 'max_length_500', error_msg: '伤情描述不能超过500字' } },
    { field_id: 'treatment_type', label: '治疗方式', type: 'enum', required: true, placeholder: '请选择治疗方式', options: ['门诊', '住院', '手术', '康复治疗'] },
    { field_id: 'hospital_name', label: '就诊医院', type: 'text_with_search', required: true, placeholder: '请搜索或输入就诊医院名称', data_source: 'hospital_db' },
    { field_id: 'treatment_status', label: '治疗状态', type: 'enum', required: true, placeholder: '请选择当前治疗状态', options: ['治疗中', '已出院', '已痊愈'] },
    { field_id: 'involves_third_party', label: '是否涉及第三方', type: 'boolean', required: true, follow_up: { condition: 'true', extra_fields: ['third_party_info'] } },
    { field_id: 'third_party_info', label: '第三方信息', type: 'textarea', required: false, placeholder: '请描述第三方相关信息' },
  ],
  [PrimaryCategory.HEALTH]: [
    { field_id: 'diagnosis_date', label: '确诊日期', type: 'date', required: true, placeholder: '请选择确诊日期', validation: { rule: 'lte_today_and_gte_policy_start', error_msg: '确诊日期必须在保单有效期内' } },
    { field_id: 'hospital_name', label: '就诊医院', type: 'text_with_search', required: true, placeholder: '请搜索或输入就诊医院名称', data_source: 'hospital_db' },
    { field_id: 'diagnosis_result', label: '诊断结果', type: 'textarea', required: true, placeholder: '请输入诊断结果' },
    { field_id: 'treatment_type', label: '治疗类型', type: 'multi_select', required: true, placeholder: '请选择治疗类型', options: ['门诊', '住院', '日间手术', '特殊门诊', '住院前后门急诊'] },
    { field_id: 'total_expense', label: '费用总额(元)', type: 'number', required: true, placeholder: '请输入医疗费用总额', validation: { rule: 'gt_zero', error_msg: '费用总额必须大于零' } },
  ],
  [PrimaryCategory.CRITICAL_ILLNESS]: [
    { field_id: 'diagnosis_date', label: '确诊日期', type: 'date', required: true, placeholder: '请选择确诊日期', validation: { rule: 'lte_today_and_gte_policy_start', error_msg: '确诊日期必须在保单有效期内' } },
    { field_id: 'diagnosis_hospital', label: '确诊医院', type: 'text_with_search', required: true, placeholder: '请搜索或输入确诊医院', data_source: 'hospital_db' },
    { field_id: 'disease_name', label: '疾病名称', type: 'text_with_search', required: true, placeholder: '请搜索或输入疾病名称', data_source: 'disease_db' },
    { field_id: 'severity_level', label: '疾病严重程度', type: 'enum', required: true, placeholder: '请选择严重程度', options: ['重度', '中度', '轻度'] },
  ],
  [PrimaryCategory.TERM_LIFE]: [
    { field_id: 'death_date', label: '身故日期', type: 'date', required: true, placeholder: '请选择身故日期', validation: { rule: 'lte_today_and_gte_policy_start', error_msg: '身故日期必须在保单有效期内' } },
    { field_id: 'death_reason', label: '身故原因', type: 'enum', required: true, placeholder: '请选择身故原因', options: ['疾病', '意外', '自然'] },
    { field_id: 'death_location', label: '身故地点', type: 'text', required: true, placeholder: '请输入身故地点' },
  ],
  [PrimaryCategory.WHOLE_LIFE]: [
    { field_id: 'death_date', label: '身故日期', type: 'date', required: true, placeholder: '请选择身故日期', validation: { rule: 'lte_today_and_gte_policy_start', error_msg: '身故日期必须在保单有效期内' } },
    { field_id: 'death_reason', label: '身故原因', type: 'enum', required: true, placeholder: '请选择身故原因', options: ['疾病', '意外', '自然'] },
    { field_id: 'death_location', label: '身故地点', type: 'text', required: true, placeholder: '请输入身故地点' },
  ],
  [PrimaryCategory.ANNUITY]: [
    { field_id: 'claim_date', label: '申请日期', type: 'date', required: true, placeholder: '请选择申请日期', validation: { rule: 'lte_today', error_msg: '申请日期不能晚于今天' } },
    { field_id: 'payout_method', label: '领取方式', type: 'enum', required: true, placeholder: '请选择领取方式', options: ['年领', '月领', '一次性领取'] },
  ],
};
// --- END: Intake Config Constants ---
