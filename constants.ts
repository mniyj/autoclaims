import {
  type Clause,
  PrimaryCategory,
  ProductStatus,
  ClauseType,
  InsuranceCompanyProfile,
  CompanyListItem,
  IndustryData,
  CitySalaryData,
  CriticalIllnessRateData,
  AccidentRateData,
  DeathRateData,
  HospitalizationRateData,
  OutpatientRateData,
  InsuranceCategoryMapping,
  CategoryDefinition,
  EndUser,
  ResponsibilityItem,
  ClaimsMaterial,
  ClaimItem,
  ProductClaimConfig,
  ClaimCase,
  ClaimStatus,
  type InsuranceRuleset,
  RulesetProductLine,
  ExecutionDomain,
  RuleStatus,
  RuleActionType,
  RuleCategory,
  ConditionLogic,
  ConditionOperator,
  type IntakeField,
} from "./types";

export const PRODUCT_STATUSES = Object.values(ProductStatus);
export const PRIMARY_CATEGORIES = Object.values(PrimaryCategory);
export const CLAUSE_TYPES = Object.values(ClauseType);
export const MOCK_COMPANIES = [
  "众安",
  "人保健康",
  "人保寿险",
  "阳光人寿",
  "国泰",
  "新华人寿",
  "太保寿险",
  "太平人寿",
  "中意人寿",
  "信泰人寿",
  "中邮人寿",
  "工银安盛",
];

export const REGULATORY_OPTIONS = [
  {
    code: "13000",
    name: "寿险",
    children: [
      { code: "13100", name: "定期寿险" },
      { code: "13200", name: "终身寿险" },
      { code: "13300", name: "两全保险" },
    ],
  },
  {
    code: "14000",
    name: "年金险",
    children: [
      { code: "14100", name: "普通年金保险" },
      { code: "14200", name: "养老年金保险" },
    ],
  },
  {
    code: "15000",
    name: "健康险",
    children: [
      { code: "15100", name: "医疗保险" },
      { code: "15200", name: "重疾保险" },
      { code: "15300", name: "护理保险" },
      { code: "15400", name: "失能保险" },
    ],
  },
  {
    code: "16000",
    name: "意外险",
    children: [{ code: "16000", name: "意外伤害保险" }],
  },
  {
    code: "17000",
    name: "车险",
    children: [
      { code: "17100", name: " 交强险" },
      { code: "17200", name: " 商业险" },
    ],
  },
];

export const MOCK_RESPONSIBILITIES: ResponsibilityItem[] = [
  {
    id: "resp-1",
    code: "GENERAL_HOSPITALIZATION",
    name: "住院医疗费用",
    category: "医疗保险",
    description: "住院治疗费用报销",
  },
  {
    id: "resp-2",
    code: "OUT_HOSPITAL_DRUG",
    name: "院外特效药费用",
    category: "医疗保险",
    description: "院外特效药清单覆盖",
  },
  {
    id: "resp-3",
    code: "CRITICAL_ILLNESS_MEDICAL",
    name: "重疾医疗费用",
    category: "医疗保险",
    description: "重大疾病相关住院及门诊治疗费用报销",
  },
  {
    id: "resp-4",
    code: "OUTPATIENT_MEDICAL",
    name: "门急诊医疗费用",
    category: "医疗保险",
    description: "普通门诊与急诊检查、药品、治疗费用报销",
  },
  {
    id: "resp-5",
    code: "MAJOR_CI",
    name: "重大疾病保险金",
    category: "重大疾病保险",
    description: "确诊合同约定的重大疾病一次性给付保险金",
  },
  {
    id: "resp-6",
    code: "MID_CI",
    name: "中症保险金",
    category: "重大疾病保险",
    description: "确诊中症一次性给付保险金",
  },
  {
    id: "resp-7",
    code: "MINOR_CI",
    name: "轻症保险金",
    category: "重大疾病保险",
    description: "确诊轻症一次性给付保险金",
  },
  {
    id: "resp-8",
    code: "CANCER_MULTIPAY",
    name: "癌症多次赔付",
    category: "重大疾病保险",
    description: "满足间隔期条件的癌症多次给付",
  },
  {
    id: "resp-9",
    code: "DEATH_BENEFIT",
    name: "身故保险金",
    category: "定期寿险",
    description: "保障期内身故给付保险金",
  },
  {
    id: "resp-10",
    code: "INCOME_PROTECTION",
    name: "收入保障金",
    category: "定期寿险",
    description: "保障期内按月给付固定收入保障",
  },
  {
    id: "resp-11",
    code: "PREMIUM_WAIVER",
    name: "保费豁免",
    category: "重大疾病保险",
    description: "确诊轻/中/重症后豁免剩余保险费",
  },
  {
    id: "resp-12",
    code: "ACCIDENT_DEATH",
    name: "意外身故",
    category: "意外保险",
    description: "发生意外导致身故给付保险金",
  },
  {
    id: "resp-13",
    code: "ACCIDENT_DISABILITY",
    name: "意外伤残",
    category: "意外保险",
    description: "意外伤残按等级给付保险金",
  },
  {
    id: "resp-14",
    code: "ACCIDENT_MEDICAL",
    name: "意外医疗",
    category: "意外保险",
    description: "意外导致的门诊、住院医疗费用报销",
  },
  {
    id: "resp-15",
    code: "FRACTURE_ALLOWANCE",
    name: "骨折津贴",
    category: "意外保险",
    description: "意外骨折按次给付津贴",
  },
  {
    id: "resp-16",
    code: "ANNUITY_PAYOUT",
    name: "年金领取",
    category: "年金保险",
    description: "自约定起领日按期给付养老金",
  },
  {
    id: "resp-17",
    code: "SURVIVAL_BENEFIT",
    name: "生存金给付",
    category: "年金保险",
    description: "在约定节点给付生存金",
  },
  {
    id: "resp-18",
    code: "CASH_VALUE",
    name: "现金价值保障",
    category: "终身寿险",
    description: "保单现金价值随时间增长",
  },
];

export const initialProductState: Clause = {
  productCode: "",
  regulatoryName: "",
  companyName: "",
  version: "1.0",
  salesRegions: "全国（不含港澳台）",
  effectiveDate: new Date().toISOString().split("T")[0],
  discontinuationDate: new Date(
    new Date().setFullYear(new Date().getFullYear() + 5),
  )
    .toISOString()
    .split("T")[0],
  status: ProductStatus.DRAFT,
  primaryCategory: PrimaryCategory.HEALTH,
  secondaryCategory: "",
  clauseType: ClauseType.MAIN,
  coverageDetails: [],
  underwritingAge: "",
  coveragePeriod: "",
  waitingPeriod: "",
  productCardImage: "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
  productHeroImage: "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
  productLongImage: [
    "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
    "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
    "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
  ],
  productAttachments: [],
  productSummary: "",
  operator: "系统管理员",
  coverageArea: "",
  hospitalScope: "",
  claimScope: "",
  occupationScope: "1-4类职业",
  hesitationPeriod: "15天",
  policyEffectiveDate: "T+1",
  purchaseLimit: 1,
  annualPremium: 0,
  valueAddedServices: [],
  tags: [],
  promoTag: "",
  cardMetric1Label: "保额",
  cardMetric1Value: "",
  cardMetric2Label: "保障期限",
  cardMetric2Value: "",
  cardMetric3Label: "投保年龄",
  cardMetric3Value: "",
  supportsOnlineClaim: true,
  isOnline: true,
  clauseTextFile: "",
  rateTableFile: "",
  productDescriptionFile: "",
  cashValueTableFile: "",
};

export const MOCK_CLAUSES: Clause[] = [
  {
    productCode: "HOS2024-A",
    regulatoryName: "超级健康医疗保险（2024版）",
    companyName: "众安",
    version: "2.1",
    salesRegions: "全国（不含港澳台）",
    effectiveDate: "2024-01-01",
    discontinuationDate: "2028-12-31",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.HEALTH,
    secondaryCategory: "住院医疗",
    primaryCategoryCode: "A",
    secondaryCategoryCode: "A01",
    racewayId: "A0101",
    racewayName: "短期百万医疗",
    clauseType: ClauseType.MAIN,
    operator: "张三",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "一般医疗保险金",
        amount: "200万",
        details: "含住院、特殊门诊、外购药等费用。",
      },
      {
        mandatory: true,
        id: "2",
        name: "重疾医疗保险金",
        amount: "400万",
        details: "120种重大疾病医疗费用保障。",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        annualLimit: 6000000,
        guaranteedRenewalYears: 0,
        coverageDetails: [
          {
            mandatory: true,
            item_code: "GENERAL_MEDICAL",
            item_name: "一般医疗保险金",
            description: "含住院、特殊门诊、外购药等费用。",
            details: {
              limit: 2000000,
              deductible: 10000,
              reimbursement_ratio: 1,
              hospital_requirements: "二级及以上公立医院",
              coverage_scope: "住院费用/特殊门诊/外购药",
            },
          },
          {
            mandatory: true,
            item_code: "CRITICAL_ILLNESS_MEDICAL",
            item_name: "重疾医疗保险金",
            description: "120种重大疾病医疗费用保障。",
            details: {
              limit: 4000000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "二级及以上公立医院",
              coverage_scope: "重疾相关治疗费用",
            },
          },
        ],
      },
    ],
    underwritingAge: "30天 - 60周岁",
    coveragePeriod: "1年",
    coverageArea: "中国大陆",
    hospitalScope: "二级及以上公立医院",
    claimScope: "不限社保",
    occupationScope: "1-4类职业",
    hesitationPeriod: "15天",
    waitingPeriod: "30天（一般疾病），90天（特殊疾病）",
    policyEffectiveDate: "T+1",
    purchaseLimit: 1,
    annualPremium: 300,
    valueAddedServices: [
      {
        id: "vas1",
        name: "图文咨询服务",
        description:
          "用户可通过图文咨询的方式与医生进行一对一交流，医生为被保险人提供图文问诊、疾病诊断、用药处方等诊疗服务。服务时间每日9：00-21：00，精神类或心理咨询不在服务范围。客户可通过“众安互联网医院”微信小程序选择“健康咨询”使用。",
      },
      {
        id: "vas2",
        name: "视频问诊服务",
        description:
          "为被保险人提供视频问诊服务，每日9:00-21:00不限次使用。金牌医生快速接诊，提供1对1视频交流、疾病诊断、用药处方等诊疗服务（精神类或心理咨询不在服务范围）。金牌医生均具备国家专业医师资格证书，平均5年以上临床经验，保障问诊安全。客户可通过“众安互联网医院”微信小程序选择“视频问诊”使用。",
      },
      {
        id: "vas4",
        name: "医疗垫付服务",
        description:
          "若您在保险期间内等待期后（意外无等待期），在垫付服务覆盖城市中二级及以上的公立医院发生住院，且预估或实际住院费用需求超过产品免赔额需个人承担的医疗费用部分，可以申请进行垫付服务，垫付服务覆盖全国83个城市中的二级及以上公立医院（仅覆盖市区范围，城市下属的县、社区、镇、村等医院暂不支持）。\n客户可通过众安健康微信小程序、众安保险APP、众安健康微信公众号内在线申请医疗垫付或拨打客服电话952299或1010-9955提出垫付服务申请。服务专员联系客户收集材料，了解客户就医需求和费用情况，协助客户完成相关资料填写。",
      },
    ],
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["超级健康医疗保险条款.pdf"],
    productSummary: "这是一款覆盖广泛、保障全面的百万医疗险产品。",
    tags: ["医疗垫付", "就医绿通"],
    promoTag: "百万医疗险人手一份",
    cardMetric1Label: "总保额",
    cardMetric1Value: "最高600万",
    cardMetric2Label: "保障期限",
    cardMetric2Value: "1年",
    cardMetric3Label: "投保年龄",
    cardMetric3Value: "30天-60岁",
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: "超级健康医疗保险条款_v2.1.pdf",
    rateTableFile: "医疗险费率表_2024.xlsx",
    productDescriptionFile: "超级健康产品说明.pdf",
    cashValueTableFile: "",
  },
  {
    productCode: "GCLIFE_MED_2025_A",
    regulatoryName: "中意优护百万医疗保险（2025版）",
    companyName: "中意人寿",
    version: "1.0",
    salesRegions: "全国（不含港澳台）",
    effectiveDate: "2025-06-01",
    discontinuationDate: "",
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.HEALTH,
    secondaryCategory: "住院医疗",
    primaryCategoryCode: "A",
    secondaryCategoryCode: "A01",
    racewayId: "A0102",
    racewayName: "长期医疗",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "gen",
        name: "一般医疗保险金",
        amount: "300万",
        details: "含住院、特殊门诊、外购药等费用。",
      },
      {
        mandatory: true,
        id: "cri",
        name: "重疾医疗保险金",
        amount: "600万",
        details: "120种重大疾病医疗费用保障。",
      },
    ],
    underwritingAge: "30天 - 65周岁",
    coveragePeriod: "1年",
    coverageArea: "中国大陆",
    hospitalScope: "二级及以上公立医院普通部",
    claimScope: "经社保结算后100%",
    occupationScope: "1-4类职业",
    hesitationPeriod: "15天",
    waitingPeriod: "30天（一般疾病），90天（特定疾病）",
    policyEffectiveDate: "T+1",
    purchaseLimit: 1,
    annualPremium: 399,
    valueAddedServices: [
      {
        id: "vas1",
        name: "就医绿色通道",
        description: "提供三甲医院就医协调、专家门诊加号服务。",
      },
      {
        id: "vas2",
        name: "医疗垫付",
        description: "住院期间符合条件的医疗费用可申请垫付。",
      },
      {
        id: "vas3",
        name: "特药服务",
        description: "覆盖院外特药清单，提供药品配送与用药指导。",
      },
    ],
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["中意优护百万医疗保险（2025版）条款.pdf"],
    productSummary: "保证续保3年，涵盖住院、门诊特需与院外特药，安心就医。",
    tags: ["就医绿通", "医疗垫付"],
    promoTag: "百万医疗守护家人",
    cardMetric1Label: "总保额",
    cardMetric1Value: "最高600万",
    cardMetric2Label: "免赔额",
    cardMetric2Value: "1万元/年",
    cardMetric3Label: "投保年龄",
    cardMetric3Value: "30天-65岁",
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: "中意优护百万医疗保险条款_2025.pdf",
    rateTableFile: "医疗险费率表_中意_2025.xlsx",
    productDescriptionFile: "产品说明.pdf",
    cashValueTableFile: "",
    deductible: "年免赔额1万元",
    renewalWarranty: "保证续保3年",
    outHospitalMedicine: "院外特药100种，最高200万",
    healthConditionNotice: "支持智能核保",
    selectedResponsibilities: [
      {
        id: "resp-1",
        code: "GENERAL_HOSPITALIZATION",
        name: "住院医疗费用",
        category: "医疗险",
        description: "住院治疗费用报销",
      },
      {
        id: "resp-2",
        code: "OUT_HOSPITAL_DRUG",
        name: "院外特效药费用",
        category: "医疗险",
        description: "院外特效药清单覆盖",
      },
    ],
    coveragePlans: [
      {
        planType: "经典版",
        annualLimit: 6000000,
        guaranteedRenewalYears: 3,
        coverageDetails: [
          {
            mandatory: true,
            item_code: "GENERAL_HOSPITALIZATION",
            item_name: "住院医疗费用",
            description: "住院治疗费用报销",
            details: {
              limit: 3000000,
              deductible: 10000,
              reimbursement_ratio: 1.0,
              hospital_requirements: "二级及以上公立医院普通部",
              coverage_scope: "住院费用/特殊门诊/外购药",
            },
          },
          {
            mandatory: true,
            item_code: "CRITICAL_ILLNESS_MEDICAL",
            item_name: "重疾医疗费用",
            description: "重疾医疗专项保障",
            details: {
              limit: 6000000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "指定医院网络",
              coverage_scope: "重疾相关治疗费用",
            },
          },
        ],
      },
      {
        planType: "升级版",
        annualLimit: 8000000,
        guaranteedRenewalYears: 6,
        coverageDetails: [
          {
            mandatory: true,
            item_code: "GENERAL_HOSPITALIZATION",
            item_name: "住院医疗费用",
            description: "住院治疗费用报销",
            details: {
              limit: 4000000,
              deductible: 10000,
              reimbursement_ratio: 1.0,
              hospital_requirements: "二级及以上公立医院普通部",
              coverage_scope: "住院费用/特殊门诊/外购药",
            },
          },
          {
            mandatory: false,
            item_code: "OUT_HOSPITAL_DRUG",
            item_name: "院外特药费用",
            description: "院外特药清单覆盖",
            details: {
              limit: 2000000,
              deductible: 0,
              reimbursement_ratio: 0.8,
              hospital_requirements: "指定药房与配送网络",
              coverage_scope: "院外特药费用",
            },
          },
        ],
      },
    ],
  },
  {
    productCode: "GCLIFE_CI_2025_B",
    regulatoryName: "中意康享重大疾病保险（2025版）",
    companyName: "中意人寿",
    version: "1.0",
    salesRegions: "全国（不含港澳台）",
    effectiveDate: "2025-07-01",
    discontinuationDate: "",
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.CRITICAL_ILLNESS,
    secondaryCategory: "定期重疾",
    primaryCategoryCode: "B",
    secondaryCategoryCode: "B02",
    racewayId: "B0201",
    racewayName: "长期重疾",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    underwritingAge: "0 - 55周岁",
    coveragePeriod: "30年",
    coverageArea: "中国大陆",
    hospitalScope: "合法合规的医疗机构",
    claimScope: "确诊给付，医疗报销不适用",
    occupationScope: "1-4类职业",
    hesitationPeriod: "15天",
    waitingPeriod: "90天",
    policyEffectiveDate: "T+1",
    purchaseLimit: 1,
    annualPremium: 1200,
    valueAddedServices: [
      {
        id: "vas_ci_1",
        name: "第二诊疗意见",
        description: "联合三甲医院重疾专家提供第二诊疗意见服务。",
      },
      {
        id: "vas_ci_2",
        name: "重疾专家远程会诊",
        description: "提供远程多学科专家联合会诊服务。",
      },
    ],
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["中意康享重大疾病保险（2025版）条款.pdf"],
    productSummary: "轻中重症覆盖，确诊即赔，聚焦家庭经济支柱的收入风险。",
    tags: ["轻中重症全覆盖", "多次赔付可选"],
    promoTag: "重疾保障升级",
    cardMetric1Label: "基本保额",
    cardMetric1Value: "50万",
    cardMetric2Label: "轻症赔付比例",
    cardMetric2Value: "30%",
    cardMetric3Label: "保障期限",
    cardMetric3Value: "30年",
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: "中意康享重大疾病保险_2025.pdf",
    rateTableFile: "重疾险费率表_中意_2025.xlsx",
    productDescriptionFile: "产品说明.pdf",
    coveragePlans: [
      {
        planType: "经典版",
        coverageDetails: [
          {
            mandatory: true,
            item_code: "MAJOR_CI",
            item_name: "重大疾病保险金",
            description: "确诊给付一次",
            details: {
              limit: 500000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "确诊给付",
            },
          },
          {
            mandatory: true,
            item_code: "MID_CI",
            item_name: "中症保险金",
            description: "确诊给付一次",
            details: {
              limit: 100000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "确诊给付",
            },
          },
          {
            mandatory: true,
            item_code: "MINOR_CI",
            item_name: "轻症保险金",
            description: "确诊给付一次",
            details: {
              limit: 50000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "确诊给付",
            },
          },
          {
            mandatory: false,
            item_code: "DEATH_BENEFIT",
            item_name: "身故保险金",
            description: "保障期内身故给付",
            details: {
              limit: 500000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "身故责任",
            },
          },
        ],
      },
      {
        planType: "升级版",
        coverageDetails: [
          {
            mandatory: true,
            item_code: "MAJOR_CI",
            item_name: "重大疾病保险金",
            description: "确诊给付一次",
            details: {
              limit: 800000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "确诊给付",
            },
          },
          {
            mandatory: true,
            item_code: "MID_CI",
            item_name: "中症保险金",
            description: "确诊给付一次",
            details: {
              limit: 200000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "确诊给付",
            },
          },
          {
            mandatory: true,
            item_code: "MINOR_CI",
            item_name: "轻症保险金",
            description: "确诊给付一次",
            details: {
              limit: 100000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "确诊给付",
            },
          },
          {
            mandatory: false,
            item_code: "DEATH_BENEFIT",
            item_name: "身故保险金",
            description: "保障期内身故给付",
            details: {
              limit: 800000,
              deductible: 0,
              reimbursement_ratio: 1.0,
              hospital_requirements: "不限",
              coverage_scope: "身故责任",
            },
          },
        ],
      },
    ],
  },
  {
    productCode: "CZY-MED-EMB-2025-C",
    regulatoryName: "中意e民保医疗保险（互联网专属）",
    companyName: "中意人寿",
    version: "2025版",
    salesRegions: "中国大陆（不含港澳台）",
    effectiveDate: "2025-01-01",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.HEALTH,
    secondaryCategory: "医疗保险",
    primaryCategoryCode: "A",
    secondaryCategoryCode: "A01",
    racewayId: "A0102",
    racewayName: "长期医疗",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    underwritingAge: "28天-80周岁",
    coveragePeriod: "1年",
    coverageArea: "全国（不含港澳台）",
    hospitalScope: "二级及以上公立医院普通部",
    claimScope: "医保范围内100%，医保外按合同约定比例报销",
    occupationScope: "1-4类",
    hesitationPeriod: "无",
    waitingPeriod: "90天",
    policyEffectiveDate: "次日零时",
    purchaseLimit: 1,
    annualPremium: 298,
    valueAddedServices: [
      {
        id: "VAS01",
        name: "在线投保",
        description: "支持APP在线投保与电子保单",
      },
      {
        id: "VAS02",
        name: "在线理赔",
        description: "可通过掌上中意APP发起理赔",
      },
      {
        id: "VAS03",
        name: "智能核保",
        description: "提供智能核保，健康告知更宽松",
      },
    ],
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["中意e民保条款.pdf"],
    productSummary:
      "百万医疗基础款，含医保内/外医疗、质子重离子、特药、重疾相关保障，年度最高300万。",
    tags: ["金选"],
    promoTag: "经典版入门医疗",
    cardMetric1Label: "总保额",
    cardMetric1Value: "300万",
    cardMetric2Label: "保障期限",
    cardMetric2Value: "1年",
    cardMetric3Label: "投保年龄",
    cardMetric3Value: "28天-80岁",
    supportsOnlineClaim: true,
    isOnline: true,
    deductible: "共享1万元免赔额",
    renewalWarranty: "3年保证续保",
    outHospitalMedicine: "特定院外药品，按责任限额报销",
    healthConditionNotice: "健康告知宽松，支持智能核保",
    selectedResponsibilities: [
      {
        id: "resp-1",
        code: "GENERAL_HOSPITALIZATION",
        name: "住院医疗费用",
        category: "医疗险",
        description: "住院治疗费用报销",
      },
      {
        id: "resp-19",
        code: "GENERAL_OUT_OF_MEDICAL",
        name: "医保范围外医疗",
        category: "医疗险",
        description: "医保外合理住院治疗费用报销",
      },
      {
        id: "resp-20",
        code: "PROTON_HEAVY_ION",
        name: "质子重离子医疗保险金",
        category: "医疗险",
        description: "质子、重离子放射治疗费用保障",
      },
      {
        id: "resp-21",
        code: "SPECIAL_DRUG",
        name: "院外特定药品费用保险金",
        category: "医疗险",
        description: "特定抗肿瘤药品费用报销",
      },
      {
        id: "resp-22",
        code: "CRITICAL_ILLNESS_OUT_OF_TOWN",
        name: "重度疾病异地就医",
        category: "医疗险",
        description: "重疾跨省就医产生的合理费用",
      },
      {
        id: "resp-23",
        code: "CRITICAL_ILLNESS_GENE_TEST",
        name: "恶性肿瘤重度基因检测",
        category: "医疗险",
        description: "癌症相关基因检测费用",
      },
      {
        id: "resp-24",
        code: "CRITICAL_ILLNESS_DAILY_ALLOWANCE",
        name: "重度疾病住院津贴",
        category: "医疗险",
        description: "重疾住院期间按天给付津贴",
      },
      {
        id: "resp-25",
        code: "CRITICAL_ILLNESS_REHABILITATION",
        name: "重度疾病康复医疗",
        category: "医疗险",
        description: "癌症相关康复治疗、器械等费用",
      },
    ],
    coveragePlans: [
      {
        planType: "经典版",
        annualLimit: 3000000,
        guaranteedRenewalYears: 3,
        coverageDetails: [
          {
            mandatory: true,
            item_code: "GENERAL_HOSPITALIZATION",
            item_name: "医保范围内医疗",
            description: "医保内住院医疗费用",
            details: {
              limit: 3000000,
              deductible: 10000,
              reimbursement_ratio: 1,
              hospital_requirements: "二级及以上公立医院普通部",
              coverage_scope: "医保范围内住院医疗",
            },
          },
          {
            mandatory: true,
            item_code: "GENERAL_OUT_OF_MEDICAL",
            item_name: "医保范围外医疗",
            description: "医保外合理住院费用",
            details: {
              limit: 3000000,
              deductible: 10000,
              reimbursement_ratio: 0.6,
              hospital_requirements: "二级及以上公立医院普通部",
              coverage_scope: "医保外住院医疗",
            },
          },
          {
            mandatory: false,
            item_code: "PROTON_HEAVY_ION",
            item_name: "质子重离子医疗保险金",
            description: "质子、重离子治疗费用",
            details: {
              limit: 3000000,
              deductible: 10000,
              reimbursement_ratio: 1,
              hospital_requirements: "指定医疗机构",
              coverage_scope: "癌症放射治疗",
            },
          },
          {
            mandatory: false,
            item_code: "SPECIAL_DRUG",
            item_name: "院外特定药品费用保险金",
            description: "特定抗肿瘤药品费用",
            details: {
              limit: 200000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "指定药品目录",
              coverage_scope: "院外特药费用",
            },
          },
          {
            mandatory: false,
            item_code: "CRITICAL_ILLNESS_OUT_OF_TOWN",
            item_name: "重度疾病异地就医",
            description: "重疾异地治疗费用",
            details: {
              limit: 200000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "指定医院",
              coverage_scope: "重疾跨省就医费用",
            },
          },
          {
            mandatory: false,
            item_code: "CRITICAL_ILLNESS_GENE_TEST",
            item_name: "恶性肿瘤重度基因检测",
            description: "癌症基因检测费用",
            details: {
              limit: 10000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "指定检测机构",
              coverage_scope: "癌症基因检测费用",
            },
          },
          {
            mandatory: false,
            item_code: "CRITICAL_ILLNESS_DAILY_ALLOWANCE",
            item_name: "重度疾病住院津贴",
            description: "重疾住院每日津贴",
            details: {
              limit: 18000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "ICU或普通住院",
              coverage_scope: "津贴按天给付",
            },
          },
          {
            mandatory: false,
            item_code: "CRITICAL_ILLNESS_REHABILITATION",
            item_name: "重度疾病康复医疗",
            description: "癌症相关康复费用",
            details: {
              limit: 30000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "康复科或指定机构",
              coverage_scope: "康复器械、治疗等费用",
            },
          },
        ],
      },
    ],
  },
  {
    productCode: "ACC2023-B",
    regulatoryName: "个人综合意外保障计划",
    companyName: "阳光人寿",
    version: "1.5",
    salesRegions: "北京、上海、广东",
    effectiveDate: "2023-05-10",
    discontinuationDate: "2027-05-09",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ACCIDENT,
    secondaryCategory: "综合意外",
    primaryCategoryCode: "C",
    secondaryCategoryCode: "C01",
    racewayId: "C0101",
    racewayName: "成人综合意外",
    clauseType: ClauseType.MAIN,
    operator: "李四",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "意外身故",
        amount: "20万",
        details: "",
      },
      {
        mandatory: true,
        id: "2",
        name: "意外残疾",
        amount: "40万",
        details: "",
      },
      {
        mandatory: true,
        id: "3",
        name: "意外伤害医疗保险责任",
        amount: "4万",
        details: "含门急诊和住院",
      },
    ],
    selectedResponsibilities: [
      {
        id: "acc-r1",
        code: "ACCIDENTAL_DEATH_DISABILITY",
        name: "意外身故/伤残",
        category: "意外险",
        description: "",
      },
      {
        id: "acc-r2",
        code: "ACCIDENTAL_MEDICAL",
        name: "意外医疗",
        category: "意外险",
        description: "门急诊与住院医疗",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            item_code: "ACCIDENTAL_DEATH_DISABILITY",
            item_name: "意外身故保险金",
            description: "",
            details: { limit: 200000 },
          },
          {
            mandatory: true,
            item_code: "ACCIDENTAL_DEATH_DISABILITY",
            item_name: "意外伤残保险金",
            description: "",
            details: { limit: 400000 },
          },
          {
            mandatory: true,
            item_code: "ACCIDENTAL_MEDICAL",
            item_name: "意外伤害医疗保险责任",
            description: "含门急诊和住院",
            details: {
              limit: 40000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "合法合规的医疗机构",
              coverage_scope: "门急诊/住院",
            },
          },
        ],
      },
    ],
    underwritingAge: "18 - 65周岁",
    coveragePeriod: "1年",
    coverageArea: "全球",
    hospitalScope: "合法合规的医疗机构",
    claimScope: "合理且必要的医疗费用",
    occupationScope: "1-3类职业",
    hesitationPeriod: "10天",
    waitingPeriod: "T+3生效",
    policyEffectiveDate: "T+3",
    purchaseLimit: 3,
    annualPremium: 150,
    valueAddedServices: [
      {
        id: "vas1",
        name: "24小时紧急救援服务",
        description:
          "提供全球范围内的紧急医疗运送、医疗转运、遗体/骨灰送返等服务，确保客户在紧急情况下获得及时援助。",
      },
    ],
    productSummary: "为您的每一次出行和日常生活提供坚实保障。",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: "个人综合意外保障计划_v1.5.pdf",
    rateTableFile: "意外险费率表_2023.xlsx",
    productDescriptionFile: "综合意外险产品说明.pdf",
  },
  {
    productCode: "ACC2024-C",
    regulatoryName: "青少年意外保障计划（2024版）",
    companyName: "中意人寿",
    version: "1.0",
    salesRegions: "全国",
    effectiveDate: "2024-03-01",
    discontinuationDate: "2029-02-28",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ACCIDENT,
    secondaryCategory: "青少年意外",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "意外身故/残疾",
        amount: "30万",
        details: "适用于未成年人",
      },
      {
        mandatory: true,
        id: "2",
        name: "意外医疗",
        amount: "2万",
        details: "门急诊及住院医疗",
      },
    ],
    selectedResponsibilities: [
      {
        id: "acc-y1",
        code: "ACCIDENTAL_DEATH_DISABILITY",
        name: "意外身故/伤残",
        category: "意外险",
        description: "",
      },
      {
        id: "acc-y2",
        code: "ACCIDENTAL_MEDICAL",
        name: "意外医疗",
        category: "意外险",
        description: "门急诊及住院医疗",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            item_code: "ACCIDENTAL_DEATH_DISABILITY",
            item_name: "意外身故/残疾",
            description: "适用于未成年人",
            details: { limit: 300000 },
          },
          {
            mandatory: true,
            item_code: "ACCIDENTAL_MEDICAL",
            item_name: "意外医疗",
            description: "门急诊及住院医疗",
            details: {
              limit: 20000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "合法合规的医疗机构",
              coverage_scope: "门急诊/住院",
            },
          },
        ],
      },
    ],
    valueAddedServices: [
      {
        id: "vas1",
        name: "校园意外绿色通道",
        description: "提供校内事故快速理赔协助与就医指引。",
      },
      {
        id: "vas2",
        name: "门急诊垫付服务",
        description: "符合条件的门急诊费用可申请垫付。",
      },
    ],
    underwritingAge: "6 - 18周岁",
    coveragePeriod: "1年",
    coverageArea: "中国大陆",
    hospitalScope: "合法合规的医疗机构",
    claimScope: "合理且必要的医疗费用",
    occupationScope: "1-3类职业",
    hesitationPeriod: "10天",
    waitingPeriod: "T+1生效",
    policyEffectiveDate: "T+1",
    purchaseLimit: 1,
    annualPremium: 99,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["青少年意外保障计划_v1.0.pdf"],
    productSummary: "面向青少年的人群意外保障产品。",
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: "青少年意外保障计划_v1.0.pdf",
    rateTableFile: "意外险费率表_2024.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "ACC2022-A",
    regulatoryName: "老年人意外保障（关爱版）",
    companyName: "工银安盛",
    version: "1.2",
    salesRegions: "全国（不含港澳台）",
    effectiveDate: "2022-08-01",
    discontinuationDate: "2026-07-31",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ACCIDENT,
    secondaryCategory: "老年意外",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "意外身故",
        amount: "10万",
        details: "",
      },
      {
        mandatory: false,
        id: "2",
        name: "意外骨折津贴",
        amount: "3000元",
        details: "按次给付",
      },
      {
        mandatory: true,
        id: "3",
        name: "意外医疗",
        amount: "1万",
        details: "",
      },
    ],
    selectedResponsibilities: [
      {
        id: "acc-o1",
        code: "ACCIDENTAL_DEATH_DISABILITY",
        name: "意外身故/伤残",
        category: "意外险",
        description: "",
      },
      {
        id: "acc-o2",
        code: "ACCIDENTAL_MEDICAL",
        name: "意外医疗",
        category: "意外险",
        description: "",
      },
      {
        id: "acc-o3",
        code: "SPECIFIC_ACCIDENT",
        name: "特定意外（骨折津贴）",
        category: "意外险",
        description: "骨折按次给付",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            item_code: "ACCIDENTAL_DEATH_DISABILITY",
            item_name: "意外身故",
            description: "",
            details: { limit: 100000 },
          },
          {
            mandatory: false,
            item_code: "SPECIFIC_ACCIDENT",
            item_name: "骨折津贴",
            description: "按次给付",
            details: { additional_limit: 3000, scenario: "骨折津贴（按次）" },
          },
          {
            mandatory: true,
            item_code: "ACCIDENTAL_MEDICAL",
            item_name: "意外医疗",
            description: "",
            details: {
              limit: 10000,
              deductible: 0,
              reimbursement_ratio: 1,
              hospital_requirements: "合法合规的医疗机构",
              coverage_scope: "门急诊/住院",
            },
          },
        ],
      },
    ],
    valueAddedServices: [
      {
        id: "vas1",
        name: "急诊陪护协调",
        description: "为老年人提供急诊陪护协调服务。",
      },
      {
        id: "vas2",
        name: "住院绿色通道",
        description: "协助安排住院绿色通道与床位协调。",
      },
    ],
    underwritingAge: "60 - 80周岁",
    coveragePeriod: "1年",
    coverageArea: "中国大陆",
    hospitalScope: "合法合规的医疗机构",
    claimScope: "合理且必要的医疗费用",
    occupationScope: "1-2类职业",
    hesitationPeriod: "10天",
    waitingPeriod: "T+1",
    policyEffectiveDate: "T+1",
    purchaseLimit: 1,
    annualPremium: 199,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["老年人意外保障_关爱版_v1.2.pdf"],
    productSummary: "专为老年人设计的意外保障方案。",
    supportsOnlineClaim: true,
    isOnline: true,
    clauseTextFile: "老年人意外保障_关爱版_v1.2.pdf",
    rateTableFile: "意外险费率表_2022.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "ANN2024-A",
    regulatoryName: "稳健养老金计划",
    companyName: "信泰人寿",
    version: "1.0",
    salesRegions: "全国",
    effectiveDate: "2024-06-01",
    discontinuationDate: "2034-05-31",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "年金领取",
        amount: "按合同约定",
        details: "按约定频率领取年金",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "1",
            name: "年金领取",
            amount: "按合同约定",
            details: "按约定频率领取年金",
          },
        ],
      },
    ],
    underwritingAge: "18 - 60周岁",
    coveragePeriod: "至约定领取完毕",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["稳健养老金计划.pdf"],
    productSummary: "提供稳定的养老金收益与现金流。",
    supportsOnlineClaim: true,
    isOnline: true,
    paymentMethod: "期交",
    paymentPeriod: "10年",
    payoutFrequency: "年领",
    payoutStartAge: 60,
    underwritingOccupation: "1-4类职业",
    clauseTextFile: "稳健养老金计划.pdf",
    rateTableFile: "年金险费率表.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "ANN2025-B",
    regulatoryName: "增益型年金保险",
    companyName: "中邮人寿",
    version: "1.0",
    salesRegions: "全国",
    effectiveDate: "2025-01-01",
    discontinuationDate: "2035-12-31",
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "普通年金",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        id: "1",
        name: "年金领取",
        amount: "按合同约定",
        details: "支持月领/年领",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "1",
            name: "年金领取",
            amount: "按合同约定",
            details: "支持月领/年领",
          },
        ],
      },
    ],
    underwritingAge: "0 - 55周岁",
    coveragePeriod: "至约定领取完毕",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["增益型年金保险.pdf"],
    productSummary: "灵活的年金领取与增益方案。",
    supportsOnlineClaim: true,
    isOnline: true,
    paymentMethod: "期交",
    paymentPeriod: "15年",
    payoutFrequency: "月领",
    payoutStartAge: 65,
    underwritingOccupation: "1-4类职业",
    clauseTextFile: "增益型年金保险.pdf",
    rateTableFile: "年金险费率表_2025.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "ANN2023-C",
    regulatoryName: "教育金年金保险",
    companyName: "工银安盛",
    version: "2.0",
    salesRegions: "全国",
    effectiveDate: "2023-09-01",
    discontinuationDate: "2033-08-31",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "普通年金",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        id: "1",
        name: "教育金领取",
        amount: "按合同约定",
        details: "用于子女教育规划",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            id: "1",
            name: "教育金领取",
            amount: "按合同约定",
            details: "用于子女教育规划",
          },
        ],
      },
    ],
    underwritingAge: "0 - 16周岁",
    coveragePeriod: "至约定领取完毕",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["教育金年金保险.pdf"],
    productSummary: "为孩子教育储备资金的年金产品。",
    supportsOnlineClaim: true,
    isOnline: true,
    paymentMethod: "期交",
    paymentPeriod: "12年",
    payoutFrequency: "年领",
    payoutStartAge: 18,
    underwritingOccupation: "不限",
    clauseTextFile: "教育金年金保险.pdf",
    rateTableFile: "年金险费率表_教育金.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "TL2024-A",
    regulatoryName: "定期寿险保障计划",
    companyName: "中邮人寿",
    version: "1.0",
    salesRegions: "全国",
    effectiveDate: "2024-02-01",
    discontinuationDate: "2029-01-31",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.TERM_LIFE,
    secondaryCategory: "定期寿险",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "DEATH_OR_TOTAL_DISABILITY",
        name: "身故或全残保险金",
        amount: "100%基本保额",
        details: "核心责任",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "DEATH_OR_TOTAL_DISABILITY",
            name: "身故或全残保险金",
            amount: "100%基本保额",
            details: "核心责任",
          },
        ],
      },
    ],
    underwritingAge: "20 - 55周岁",
    coveragePeriod: "20年",
    waitingPeriod: "90天",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["定期寿险保障计划.pdf"],
    productSummary: "保障家庭责任期的定期寿险方案。",
    supportsOnlineClaim: true,
    isOnline: true,
    basicSumAssured: 500000,
    paymentPeriod: "20年",
    underwritingOccupation: "1-4类职业",
    clauseTextFile: "定期寿险保障计划.pdf",
    rateTableFile: "定期寿险费率表.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "TL2025-B",
    regulatoryName: "高额定期寿险（旗舰版）",
    companyName: "中意人寿",
    version: "1.0",
    salesRegions: "全国",
    effectiveDate: "2025-04-01",
    discontinuationDate: "2035-03-31",
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.TERM_LIFE,
    secondaryCategory: "定期寿险",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "DEATH_OR_TOTAL_DISABILITY",
        name: "身故或全残保险金",
        amount: "100%基本保额",
        details: "核心责任",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "DEATH_OR_TOTAL_DISABILITY",
            name: "身故或全残保险金",
            amount: "100%基本保额",
            details: "核心责任",
          },
        ],
      },
    ],
    underwritingAge: "25 - 60周岁",
    coveragePeriod: "30年",
    waitingPeriod: "90天",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["高额定期寿险_旗舰版.pdf"],
    productSummary: "高保额定寿，保障更长责任期。",
    supportsOnlineClaim: true,
    isOnline: true,
    basicSumAssured: 1000000,
    paymentPeriod: "30年",
    underwritingOccupation: "1-3类职业",
    clauseTextFile: "高额定期寿险_旗舰版.pdf",
    rateTableFile: "定期寿险费率表_旗舰.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "TL2023-C",
    regulatoryName: "家庭守护定寿（收入保障版）",
    companyName: "工银安盛",
    version: "1.2",
    salesRegions: "全国",
    effectiveDate: "2023-07-01",
    discontinuationDate: "2028-06-30",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.TERM_LIFE,
    secondaryCategory: "定期寿险",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "DEATH_OR_TOTAL_DISABILITY",
        name: "身故或全残保险金",
        amount: "100%基本保额",
        details: "等额给付",
      },
      {
        mandatory: false,
        id: "INCOME_PROTECTION",
        name: "收入保障金",
        amount: "5000元/月",
        details: "保障期内按月给付",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "DEATH_OR_TOTAL_DISABILITY",
            name: "身故或全残保险金",
            amount: "100%基本保额",
            details: "等额给付",
          },
          {
            mandatory: false,
            id: "INCOME_PROTECTION",
            name: "收入保障金",
            amount: "5000元/月",
            details: "保障期内按月给付",
          },
        ],
      },
    ],
    underwritingAge: "25 - 55周岁",
    coveragePeriod: "20年",
    waitingPeriod: "90天",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["家庭守护定寿_收入保障版_v1.2.pdf"],
    productSummary: "为家庭收入提供稳定保障的定寿方案。",
    supportsOnlineClaim: true,
    isOnline: true,
    basicSumAssured: 300000,
    paymentPeriod: "20年",
    underwritingOccupation: "1-3类职业",
    clauseTextFile: "家庭守护定寿_收入保障版_v1.2.pdf",
    rateTableFile: "定期寿险费率表_收入保障.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "WL2024-ZE-A",
    regulatoryName: "增额终身寿（成长版）",
    companyName: "信泰人寿",
    version: "1.0",
    salesRegions: "全国",
    effectiveDate: "2024-05-01",
    discontinuationDate: "2034-04-30",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.WHOLE_LIFE,
    secondaryCategory: "增额终身寿",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "身故保险金",
        amount: "按合同约定",
        details: "现金价值逐年增长",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "1",
            name: "身故保险金",
            amount: "按合同约定",
            details: "现金价值逐年增长",
          },
        ],
      },
    ],
    underwritingAge: "0 - 55周岁",
    coveragePeriod: "终身",
    waitingPeriod: "90天",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["增额终身寿_成长版.pdf"],
    productSummary: "长期增额，兼顾保障与财富传承。",
    supportsOnlineClaim: true,
    isOnline: true,
    paymentFrequency: "年交",
    paymentPeriod: "20年",
    paymentMethod: "期交",
    clauseTextFile: "增额终身寿_成长版.pdf",
    rateTableFile: "终身寿费率表_增额.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "WL2025-ZE-B",
    regulatoryName: "增额终身寿（传承版）",
    companyName: "中意人寿",
    version: "1.0",
    salesRegions: "全国",
    effectiveDate: "2025-01-01",
    discontinuationDate: "2035-12-31",
    status: ProductStatus.DRAFT,
    primaryCategory: PrimaryCategory.WHOLE_LIFE,
    secondaryCategory: "增额终身寿",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "身故保险金",
        amount: "按合同约定",
        details: "聚焦家族财富传承",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "1",
            name: "身故保险金",
            amount: "按合同约定",
            details: "聚焦家族财富传承",
          },
        ],
      },
    ],
    underwritingAge: "18 - 55周岁",
    coveragePeriod: "终身",
    waitingPeriod: "90天",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["增额终身寿_传承版.pdf"],
    productSummary: "面向中长期财富规划的保障型产品。",
    supportsOnlineClaim: true,
    isOnline: true,
    paymentFrequency: "年交",
    paymentPeriod: "30年",
    paymentMethod: "期交",
    clauseTextFile: "增额终身寿_传承版.pdf",
    rateTableFile: "终身寿费率表_传承.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "WL2023-ZE-C",
    regulatoryName: "增额终身寿（稳健版）",
    companyName: "工银安盛",
    version: "2.0",
    salesRegions: "全国",
    effectiveDate: "2023-03-01",
    discontinuationDate: "2030-02-28",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.WHOLE_LIFE,
    secondaryCategory: "增额终身寿",
    clauseType: ClauseType.MAIN,
    operator: "系统管理员",
    coverageDetails: [
      {
        mandatory: true,
        id: "1",
        name: "身故保险金",
        amount: "按合同约定",
        details: "现金价值稳健增长",
      },
    ],
    coveragePlans: [
      {
        planType: "标准版",
        coverageDetails: [
          {
            mandatory: true,
            id: "1",
            name: "身故保险金",
            amount: "按合同约定",
            details: "现金价值稳健增长",
          },
        ],
      },
    ],
    underwritingAge: "18 - 60周岁",
    coveragePeriod: "终身",
    waitingPeriod: "90天",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: ["增额终身寿_稳健版_v2.0.pdf"],
    productSummary: "兼顾保障与资产稳健增值的终身寿。",
    supportsOnlineClaim: true,
    isOnline: true,
    paymentFrequency: "年交",
    paymentPeriod: "20年",
    paymentMethod: "期交",
    clauseTextFile: "增额终身寿_稳健版_v2.0.pdf",
    rateTableFile: "终身寿费率表_稳健.xlsx",
    productDescriptionFile: "产品说明.pdf",
  },
  {
    productCode: "xintai_ann_d_2026001",
    companyName: "信泰人寿",
    regulatoryName: "信泰如意福享（2026）养老年金保险（互联网专属）",

    productSummary: "",
    version: "1.0",
    status: ProductStatus.DRAFT,
    effectiveDate: "2026-01-01",
    discontinuationDate: "",
    salesRegions: "全国",
    supportsOnlineClaim: false,
    isOnline: true,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意福享（2026）养老年金保险（互联网专属）/信泰如意福享（2026）养老年金保险（互联网专属）_备案材料.pdf",
    ],
    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "18至59周岁",
    coveragePeriod: "终身",
    waitingPeriod: "无",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "18至59周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "终身",
    primaryCategory: PrimaryCategory.ANNUITY,
    paymentMethod: "一次性付清、3年交、5年交、10年交",
    paymentPeriod: "10年",
    payoutFrequency: "每年",
    payoutStartAge: 60,
    underwritingOccupation: "不限",
    secondaryCategory: "养老年金保险",
    clauseType: ClauseType.MAIN,
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0102",
    racewayName: "养老年金",
  },
  {
    productCode: "xintai_ann_d_2026002",
    companyName: "信泰人寿",
    regulatoryName: "信泰如意怡享（2026）养老年金保险",

    productSummary: "",
    version: "1.0",
    status: ProductStatus.DRAFT,
    effectiveDate: "2026-02-01",
    discontinuationDate: "",
    salesRegions: "全国",
    supportsOnlineClaim: false,
    isOnline: false,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意怡享（2026）养老年金保险/信泰如意怡享（2026）养老年金保险_备案材料.pdf",
    ],
    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "18至65周岁",
    coveragePeriod: "至被保险人年满 100 周岁后的首个保单周年日",
    waitingPeriod: "无",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "18至65周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至100周岁",
    primaryCategory: PrimaryCategory.ANNUITY,
    paymentMethod: "一次性付清、3年交、5年交、10年交",
    paymentPeriod: "10年",
    payoutFrequency: "每年",
    payoutStartAge: 60,
    underwritingOccupation: "不限",
    secondaryCategory: "养老年金保险",
    clauseType: ClauseType.MAIN,
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0102",
    racewayName: "养老年金",
  },
  {
    productCode: "xintai_ann_d_2025003",
    companyName: "信泰人寿",
    regulatoryName: "信泰如意鑫享3.0养老年金保险",

    productSummary: "",
    version: "3.0",
    status: ProductStatus.DRAFT,
    effectiveDate: "2025-03-01",
    discontinuationDate: "",
    salesRegions: "全国",
    supportsOnlineClaim: false,
    isOnline: false,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鑫享3.0养老年金保险/信泰如意鑫享3.0养老年金保险_备案材料.pdf",
    ],
    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "0至65周岁",
    coveragePeriod: "终身",
    waitingPeriod: "无",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "0至65周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "终身",
    primaryCategory: PrimaryCategory.ANNUITY,
    paymentMethod: "一次性付清、5年交、10年交、20年交",
    paymentPeriod: "20年",
    payoutFrequency: "每年",
    payoutStartAge: 60,
    underwritingOccupation: "不限",
    secondaryCategory: "养老年金保险",
    clauseType: ClauseType.MAIN,
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0102",
    racewayName: "养老年金",
  },
  {
    productCode: "xintai_ann_d_2025004",
    companyName: "信泰人寿",
    regulatoryName: "信泰如意鸿禧A款养老年金保险（分红型）",

    productSummary: "",
    version: "A版",
    status: ProductStatus.DRAFT,
    effectiveDate: "2025-04-01",
    discontinuationDate: "",
    salesRegions: "全国",
    supportsOnlineClaim: false,
    isOnline: false,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鸿禧A款养老年金保险（分红型）/信泰如意鸿禧A款养老年金保险（分红型）_备案材料.pdf",
    ],
    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "18至65周岁",
    coveragePeriod: "至被保险人年满 100 周岁后的首个保单周年日",
    waitingPeriod: "无",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "18至65周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至100周岁",
    primaryCategory: PrimaryCategory.ANNUITY,
    paymentMethod: "一次性付清、3年交、5年交、10年交",
    paymentPeriod: "10年",
    payoutFrequency: "每年",
    payoutStartAge: 60,
    underwritingOccupation: "不限",
    secondaryCategory: "养老年金保险（分红型）",
    clauseType: ClauseType.MAIN,
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",
  },
  {
    productCode: "xintai_ann_d_2025005",
    companyName: "信泰人寿",
    regulatoryName: "信泰如意鸿禧B款养老年金保险（分红型）",

    productSummary: "",
    version: "B版",
    status: ProductStatus.DRAFT,
    effectiveDate: "2025-05-01",
    discontinuationDate: "",
    salesRegions: "全国",
    supportsOnlineClaim: false,
    isOnline: false,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鸿禧B款养老年金保险（分红型）/信泰如意鸿禧B款养老年金保险（分红型）_备案材料.pdf",
    ],
    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "18至65周岁",
    coveragePeriod: "至被保险人年满 100 周岁后的首个保单周年日",
    waitingPeriod: "无",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "18至65周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至100周岁",
    primaryCategory: PrimaryCategory.ANNUITY,
    paymentMethod: "一次性付清、3年交、5年交、10年交",
    paymentPeriod: "10年",
    payoutFrequency: "每年",
    payoutStartAge: 60,
    underwritingOccupation: "不限",
    secondaryCategory: "养老年金保险（分红型）",
    clauseType: ClauseType.MAIN,
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",
  },
  {
    productCode: "xintai_ann_d_2025006",
    companyName: "信泰人寿",
    regulatoryName: "信泰如意鑫享A款养老年金保险（分红型）",

    productSummary: "",
    version: "A版",
    status: ProductStatus.DRAFT,
    effectiveDate: "2025-06-01",
    discontinuationDate: "",
    salesRegions: "全国",
    supportsOnlineClaim: false,
    isOnline: false,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鑫享A款养老年金保险（分红型）/信泰如意鑫享A款养老年金保险（分红型）_备案材料.pdf",
    ],
    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "18至65周岁",
    coveragePeriod: "至被保险人年满 100 周岁后的首个保单周年日",
    waitingPeriod: "无",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "18至65周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至100周岁",
    primaryCategory: PrimaryCategory.ANNUITY,
    paymentMethod: "一次性付清、3年交、5年交、10年交",
    paymentPeriod: "10年",
    payoutFrequency: "每年",
    payoutStartAge: 60,
    underwritingOccupation: "不限",
    secondaryCategory: "养老年金保险（分红型）",
    clauseType: ClauseType.MAIN,
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",
  },
  {
    productCode: "xintai_ann_d_2025007",
    companyName: "信泰人寿",
    regulatoryName: "信泰如意鑫享B款养老年金保险（分红型）",

    productSummary: "",
    version: "B版",
    status: ProductStatus.DRAFT,
    effectiveDate: "2025-07-01",
    discontinuationDate: "",
    salesRegions: "全国",
    supportsOnlineClaim: false,
    isOnline: false,
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/trae_projects/insure_crawler/data/raw/xintai_life/信泰如意鑫享B款养老年金保险（分红型）/信泰如意鑫享B款养老年金保险（分红型）_备案材料.pdf",
    ],
    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "18至65周岁",
    coveragePeriod: "至被保险人年满 100 周岁后的首个保单周年日",
    waitingPeriod: "无",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "18至65周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至100周岁",
    primaryCategory: PrimaryCategory.ANNUITY,
    paymentMethod: "一次性付清、3年交、5年交、10年交",
    paymentPeriod: "10年",
    payoutFrequency: "每年",
    payoutStartAge: 60,
    underwritingOccupation: "不限",
    secondaryCategory: "养老年金保险（分红型）",
    clauseType: ClauseType.MAIN,
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",
  },
  {
    productCode: "gclife_ann_d_2025001",
    regulatoryName: "中意悠然安养养老年金保险（分红型）",

    companyName: "中意人寿",
    version: "A版",
    salesRegions: "全国",
    effectiveDate: "",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金保险（分红型）",
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",

    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "18至59周岁",
    coveragePeriod:
      "至被保险人年满 70 周岁、80 周岁后的首个保单周年日，或终身。",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 基本保险金额表.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 现金价值表.xls",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 条款.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然安养养老年金保险（分红型）- 条款/中意悠然安养养老年金保险（分红型）- 产品说明书.pdf",
    ],
    productSummary: "",
    operator: "",
    clauseType: ClauseType.MAIN,
    tags: [],
    promoTag: "",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "18至59周岁",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至70/80岁",
    supportsOnlineClaim: false,
    isOnline: false,
    paymentMethod:
      "一次性付清、5 年交、10 年交、20 年交、交至 54 周岁、交至 59 周岁。",
    paymentPeriod: "",
    payoutFrequency: "每年",
    payoutStartAge: 55,
    underwritingOccupation: "",
  },
  {
    productCode: "gclife_ann_d_2025002",
    regulatoryName: "中意悠然鑫瑞养老年金保险（分红型）",

    companyName: "中意人寿",
    version: "A版",
    salesRegions: "全国",
    effectiveDate: "",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金保险（分红型）",
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",

    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "",
    coveragePeriod:
      "自生效日的零时起至被保险人年满 75 周岁、年满 85 周岁或年满 100 周岁后的首个",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 现金价值表.xlsx",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 费率表.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 条款.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意悠然鑫瑞养老年金保险（分红型）- 条款/中意悠然鑫瑞养老年金保险（分红型）- 产品说明书.pdf",
    ],
    productSummary: "",
    operator: "",
    clauseType: ClauseType.MAIN,
    tags: [],
    promoTag: "",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至75-100岁",
    supportsOnlineClaim: false,
    isOnline: false,
    paymentMethod: "一次性付清、3 年交、5 年交、10 年交",
    paymentPeriod: "",
    payoutFrequency: "每年",
    payoutStartAge: 0,
    underwritingOccupation: "",
  },
  {
    productCode: "gclife_ann_d_2025003",
    regulatoryName: "中意一生中意年金保险（分红型）",

    companyName: "中意人寿",
    version: "A版",
    salesRegions: "全国",
    effectiveDate: "",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金保险（分红型）",
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",

    coverageDetails: [
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "",
    coveragePeriod:
      "自生效日的零时起至被保险人年满 88 周岁后的首个保单周年日的二十四时止。",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 产品说明书.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 基本保险金额表.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 条款.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意一生中意年金保险（分红型）- 条款/中意一生中意年金保险（分红型）- 现金价值表.xls",
    ],
    productSummary: "",
    operator: "",
    clauseType: ClauseType.MAIN,
    tags: [],
    promoTag: "",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至88周岁",
    supportsOnlineClaim: false,
    isOnline: false,
    paymentMethod: "一次性付清、3 年交、5 年交、10 年交。",
    paymentPeriod: "",
    payoutFrequency: "每年",
    payoutStartAge: 0,
    underwritingOccupation: "",
  },
  {
    productCode: "gclife_ann_d_2025004",
    regulatoryName: "中意真爱久久（尊享版）养老年金保险（分红型）",

    companyName: "中意人寿",
    version: "A版",
    salesRegions: "全国",
    effectiveDate: "",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金保险（分红型）",
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0101",
    racewayName: "养老年金（分红型）",

    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "",
    coveragePeriod:
      "自生效日的零时起至被保险人年满 100 周岁后的首个保单周年日的二十四时止",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 条款.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 产品说明书.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 基本保险金额表.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意真爱久久（尊享版）养老年金保险（分红型）- 条款/中意真爱久久（尊享版）养老年金保险（分红型）- 现金价值表.xlsx",
    ],
    productSummary: "",
    operator: "",
    clauseType: ClauseType.MAIN,
    tags: [],
    promoTag: "",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至100周岁",
    supportsOnlineClaim: false,
    isOnline: false,
    paymentMethod: "一次性付清、3 年交、5 年交、10 年交",
    paymentPeriod: "",
    payoutFrequency: "每年",
    payoutStartAge: 0,
    underwritingOccupation: "",
  },
  {
    productCode: "gclife_ann_u_2025005",
    regulatoryName: "中意鑫享年年养老年金保险（万能型）",

    companyName: "中意人寿",
    version: "A版",
    salesRegions: "全国",
    effectiveDate: "",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金保险（万能型）",
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0102",
    racewayName: "养老年金",

    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "",
    coveragePeriod: "终身",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/金融管家/中意人寿/中意鑫享年年养老年金保险（万能型）- 条款/中意鑫享年年养老年金保险（万能型）- 条款.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意鑫享年年养老年金保险（万能型）- 条款/中意鑫享年年养老年金保险（万能型）- 产品说明书.pdf",
    ],
    productSummary: "",
    operator: "",
    clauseType: ClauseType.MAIN,
    tags: [],
    promoTag: "",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "灵活加费",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "终身",
    supportsOnlineClaim: false,
    isOnline: false,
    paymentMethod:
      "一次性付清保险费、定期追加保险费、不定期追加保险费、约定转入的保险费",
    paymentPeriod: "",
    payoutFrequency: "每年",
    payoutStartAge: 55,
    underwritingOccupation: "",
  },
  {
    productCode: "gclife_ann_n_2025006",
    regulatoryName: "中意裕享金生养老年金保险",

    companyName: "中意人寿",
    version: "A版",
    salesRegions: "全国",
    effectiveDate: "",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金保险",
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0102",
    racewayName: "养老年金",

    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "",
    coveragePeriod:
      "本合同的保险期间为自生效日的零时起至被保险人年满 105 周岁后的首个保单周年",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 产品说明书.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 现金价值表.xlsx",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 条款.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生养老年金保险/中意裕享金生养老年金保险 - 基本保险金额表.pdf",
    ],
    productSummary: "",
    operator: "",
    clauseType: ClauseType.MAIN,
    tags: [],
    promoTag: "",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至105周岁",
    supportsOnlineClaim: false,
    isOnline: false,
    paymentMethod: "一次性付清、3 年交、5 年交、10 年交",
    paymentPeriod: "",
    payoutFrequency: "每年",
    payoutStartAge: 0,
    underwritingOccupation: "",
  },
  {
    productCode: "gclife_ann_n_2025007",
    regulatoryName: "中意裕享金生（尊享版）养老年金保险",

    companyName: "中意人寿",
    version: "A版",
    salesRegions: "全国",
    effectiveDate: "",
    discontinuationDate: "",
    status: ProductStatus.ACTIVE,
    primaryCategory: PrimaryCategory.ANNUITY,
    secondaryCategory: "养老年金保险",
    primaryCategoryCode: "D",
    secondaryCategoryCode: "D01",
    racewayId: "D0102",
    racewayName: "养老年金",

    coverageDetails: [
      {
        id: "annuity",
        name: "养老年金",
        amount: "按合同约定",
        details: "自起领日每年给付",
      },
      {
        id: "death",
        name: "身故保险金",
        amount: "按合同约定",
        details: "按条款约定给付",
      },
    ],
    underwritingAge: "",
    coveragePeriod:
      "本合同的保险期间为自生效日的零时起至被保险人年满 105 周岁后的首个保单周年",
    waitingPeriod: "无",
    productCardImage:
      "https://pic1.imgdb.cn/item/692dd43cc2ca2fe15cf17332.webp",
    productHeroImage:
      "https://pic1.imgdb.cn/item/69311d3fa11464095f88537e.webp",
    productLongImage: [
      "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
      "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d7.jpg",
    ],
    productAttachments: [
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 基本保险金额表.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 产品说明书.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 条款.pdf",
      "/Users/pegasus/Documents/金融管家/中意人寿/中意裕享金生（尊享版）养老年金保险/中意裕享金生（尊享版）养老年金保险 - 现金价值表.xlsx",
    ],
    productSummary: "",
    operator: "",
    clauseType: ClauseType.MAIN,
    tags: [],
    promoTag: "",
    cardMetric1Label: "交费方式",
    cardMetric1Value: "多期可选",
    cardMetric2Label: "投保年龄",
    cardMetric2Value: "",
    cardMetric3Label: "保险期间",
    cardMetric3Value: "至105周岁",
    supportsOnlineClaim: false,
    isOnline: false,
    paymentMethod: "一次性付清、3 年交、5 年交、10 年交",
    paymentPeriod: "",
    payoutFrequency: "每年",
    payoutStartAge: 0,
    underwritingOccupation: "",
  },
];

const toNumberFromAmount = (amt?: string): number => {
  if (!amt) return 0;
  const m = amt.match(/([0-9]+)(万|元)?/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return m[2] === "万" ? n * 10000 : n;
};

const mapAnnuityCode = (name: string) => {
  const n = name || "";
  if (/年金|教育金/.test(n)) return "ANNUITY_PAYMENT";
  if (/生存金/.test(n)) return "SURVIVAL_BENEFIT";
  if (/满期金/.test(n)) return "MATURITY_BENEFIT";
  if (/身故/.test(n)) return "DEATH_BENEFIT";
  return n.toUpperCase().replace(/\s+/g, "_");
};

const parseStartAges = (val: any): number[] => {
  if (typeof val === "number") return [val];
  if (typeof val === "string") {
    const nums = val.match(/\d+/g);
    return nums
      ? nums.map((x) => parseInt(x, 10)).filter((n) => !isNaN(n))
      : [];
  }
  return [];
};

const parseFrequencyOptions = (val: any): ("ANNUALLY" | "MONTHLY")[] => {
  const s = String(val || "").toLowerCase();
  const opts: ("ANNUALLY" | "MONTHLY")[] = [];
  if (/年|annual/.test(s)) opts.push("ANNUALLY");
  if (/月|month/.test(s)) opts.push("MONTHLY");
  return opts.length ? opts : ["ANNUALLY"];
};

const convertStructuredPlan = (clause: Clause) => {
  const baseDetails = clause.coverageDetails || [];
  const hasStructured =
    Array.isArray(baseDetails) && baseDetails.some((d: any) => !!d.item_code);
  if (hasStructured) {
    return [{ planType: "标准版", coverageDetails: baseDetails as any }];
  }
  const isStructuredCategory =
    clause.primaryCategory === PrimaryCategory.HEALTH ||
    clause.primaryCategory === PrimaryCategory.ACCIDENT;
  if (isStructuredCategory) {
    return [
      {
        planType: "标准版",
        annualLimit:
          baseDetails.reduce(
            (sum: number, d: any) => sum + toNumberFromAmount(d.amount),
            0,
          ) || undefined,
        guaranteedRenewalYears: 0,
        coverageDetails: baseDetails.map((d: any) => ({
          mandatory: true,
          item_code: (d.name || "").toUpperCase().replace(/\s+/g, "_"),
          item_name: d.name,
          description: d.details,
          details: {
            limit: toNumberFromAmount(d.amount),
            deductible: /一般|医疗/.test(d.name || "") ? 0 : 0,
            reimbursement_ratio: 1,
            hospital_requirements: (clause as any).hospitalScope || "",
            coverage_scope: /医疗|门急诊|住院/.test(d.name || "")
              ? "门急诊/住院医疗"
              : "责任按说明",
          },
        })),
      },
    ];
  }
  return [
    {
      planType: "标准版",
      coverageDetails: baseDetails.map((d: any) => ({
        mandatory: true,
        item_code: mapAnnuityCode(d.name),
        item_name: d.name,
        description: d.details,
        details: {
          start_age_options: parseStartAges((clause as any).payoutStartAge),
          frequency_options: parseFrequencyOptions(
            (clause as any).payoutFrequency,
          ),
          guaranteed_period_years: undefined as any,
          amount_logic: /年金|教育金|生存金|满期金/.test(d.name || "")
            ? "按合同约定"
            : undefined,
          payout_logic: /身故/.test(d.name || "")
            ? "按条款约定给付"
            : undefined,
        },
      })),
    },
  ];
};

export const SANITIZED_MOCK_CLAUSES: Clause[] = MOCK_CLAUSES.map((c) => {
  const rawPlans =
    (c as any).coveragePlans && (c as any).coveragePlans.length > 0
      ? (c as any).coveragePlans
      : convertStructuredPlan(c);
  const plans = (rawPlans || []).map((p: any) => ({
    ...p,
    coverageDetails: (p.coverageDetails || []).map((d: any) => ({
      mandatory: d.mandatory ?? true,
      ...d,
    })),
  }));
  return { ...c, coveragePlans: plans as any, coverageDetails: [] } as Clause;
});

export const MOCK_COMPANY_LIST: CompanyListItem[] = [
  {
    code: "zhongan",
    fullName: "众安在线财产保险股份有限公司",
    shortName: "众安",
    hotline: "1010-9955",
    website: "https://www.zhongan.com/",
    registeredCapital: "14.7 亿",
    status: "生效",
  },
  {
    code: "gclife",
    fullName: "中意人寿",
    shortName: "中意人寿",
    hotline: "956156",
    website: "https://www.generalichina.com/",
    registeredCapital: "37 亿",
    status: "生效",
  },
  {
    code: "xintai",
    fullName: "信泰人寿保险股份有限公司",
    shortName: "信泰人寿",
    hotline: "95365",
    website: "https://www.xintai.com/",
    registeredCapital: "102.05 亿",
    status: "生效",
  },
  {
    code: "chinapostlife",
    fullName: "中邮人寿保险股份有限公司",
    shortName: "中邮人寿",
    hotline: "400-890-9999",
    website: "https://www.chinapost-life.com/",
    registeredCapital: "286.63 亿",
    status: "生效",
  },
  {
    code: "icbcaxa",
    fullName: "工银安盛人寿保险有限公司",
    shortName: "工银安盛",
    hotline: "95359",
    website: "https://www.icbc-axa.com/",
    registeredCapital: "125.05 亿",
    status: "生效",
  },
];

export const MOCK_COMPANY_PROFILES: Record<string, InsuranceCompanyProfile> = {
  gclife: {
    code: "gclife",
    shortName: "中意人寿",
    hotline: "956156",
    basicInfo: {
      companyName: "中意人寿",
      companyType: ["寿险公司", "中外合资"],
      registeredCapital: {
        value: 37,
        unit: "亿",
      },
      address: "北京市朝阳区光华路5号院1号楼",
      website: "https://www.generalichina.com/",
    },
    solvency: {
      rating: "优秀",
      dividendRealizationRate: "37%-103%",
      financialInvestmentYield: {
        annual: 2.21,
        recentThreeYears: 4.71,
      },
      comprehensiveInvestmentYield: {
        annual: 2.8,
        recentThreeYears: 6.23,
      },
      comprehensiveSolvencyRatio: 212.24,
      coreSolvencyRatio: 166.14,
      riskRating: "AAA",
      sarmraScore: 82.42,
      totalAssets: {
        value: 1557.1,
        unit: "亿元",
      },
      reportDate: "2025年第2季度",
    },
    serviceCapability: {
      qualityIndex: 86.96,
      complaintsPer10kPolicies: 0.254,
      complaintsPer100mPremium: 1.532,
      complaintsPer10kCustomers: 0.217,
      ratingDate: "2022年第四季度",
      complaintDataUpdateDate: "2023年第四季度",
    },
    branchDistribution: {
      provinces: [
        "北京市",
        "上海市",
        "广东省",
        "江苏省",
        "辽宁省",
        "四川省",
        "陕西省",
        "山东省",
        "黑龙江省",
        "湖北省",
        "河南省",
        "浙江省",
        "福建省",
        "重庆市",
        "河北省",
      ],
    },
    shareholders: {
      note: "占比5%以上",
      list: [
        {
          name: "中国石油集团资本有限责任公司",
          stakePercentage: 50.0,
          type: "国有",
        },
        { name: "忠利保险有限公司", stakePercentage: 50.0, type: "外资" },
      ],
    },
  },
  xintai: {
    code: "xintai",
    shortName: "信泰人寿",
    hotline: "95365",
    basicInfo: {
      companyName: "信泰人寿保险股份有限公司",
      companyType: ["寿险公司"],
      registeredCapital: {
        value: 102.05,
        unit: "亿",
      },
      address: "杭州市江干区五星路 66 号",
      website: "https://www.xintai.com/",
    },
    solvency: {
      rating: "合格",
      dividendRealizationRate: "15%-114%",
      financialInvestmentYield: {
        annual: 0,
        recentThreeYears: 2.49,
      },
      comprehensiveInvestmentYield: {
        annual: 0,
        recentThreeYears: 2.57,
      },
      comprehensiveSolvencyRatio: 144.46,
      coreSolvencyRatio: 130.98,
      riskRating: "BB",
      sarmraScore: 69.25,
      totalAssets: {
        value: 2665.3,
        unit: "亿元",
      },
      reportDate: "2025 年第 2 季度",
    },
    serviceCapability: {
      qualityIndex: 77.09,
      complaintsPer10kPolicies: 1.196,
      complaintsPer100mPremium: 0.752,
      complaintsPer10kCustomers: 0.757,
      ratingDate: "2022 年第四季度",
      complaintDataUpdateDate: "2023 年第四季度",
    },
    branchDistribution: {
      provinces: [
        "浙江省",
        "江苏省",
        "北京市",
        "河北省",
        "福建省",
        "河南省",
        "山东省",
        "黑龙江省",
        "辽宁省",
        "上海市",
        "湖北省",
        "江西省",
        "广东省",
      ],
    },
    shareholders: {
      note: "占比 5% 以上",
      list: [
        {
          name: "物产中大集团股份有限公司",
          stakePercentage: 33.0,
          type: "国有",
        },
        {
          name: "存款保险基金管理有限责任公司",
          stakePercentage: 17.0,
          type: "国有",
        },
        {
          name: "中国保险保障基金有限责任公司",
          stakePercentage: 17.0,
          type: "国有",
        },
        {
          name: "北京九盛资产管理有限责任公司",
          stakePercentage: 9.69,
          type: "民营",
        },
        {
          name: "杭州城投资本集团有限公司",
          stakePercentage: 9.0,
          type: "国有",
        },
        {
          name: "杭州萧山环境集团有限公司",
          stakePercentage: 5.6,
          type: "国有",
        },
      ],
    },
  },
  chinapostlife: {
    code: "chinapostlife",
    shortName: "中邮人寿",
    hotline: "400-890-9999",
    basicInfo: {
      companyName: "中邮人寿保险股份有限公司",
      companyType: ["寿险公司", "国有控股", "中外合资"],
      registeredCapital: {
        value: 286.63,
        unit: "亿",
      },
      address: "北京市西城区金融大街甲3号B座",
      website: "https://www.chinapost-life.com/",
    },
    solvency: {
      rating: "良好",
      dividendRealizationRate: "35%-56%",
      financialInvestmentYield: {
        annual: 1.53,
        recentThreeYears: 3.8,
      },
      comprehensiveInvestmentYield: {
        annual: 2.29,
        recentThreeYears: 4.58,
      },
      comprehensiveSolvencyRatio: 194.59,
      coreSolvencyRatio: 128.57,
      riskRating: "BB",
      sarmraScore: 80.44,
      totalAssets: {
        value: 5825.8,
        unit: "亿元",
      },
      reportDate: "2025年第2季度",
    },
    serviceCapability: {
      qualityIndex: 83.74,
      complaintsPer10kPolicies: 0.151,
      complaintsPer100mPremium: 0.146,
      complaintsPer10kCustomers: 0.099,
      ratingDate: "2022年第四季度",
      complaintDataUpdateDate: "2023年第四季度",
    },
    branchDistribution: {
      provinces: [
        "江西省",
        "四川省",
        "陕西省",
        "北京市",
        "天津市",
        "辽宁省",
        "江苏省",
        "浙江省",
        "安徽省",
        "宁夏回族自治区",
        "河南省",
        "黑龙江省",
        "湖南省",
        "广东省",
        "山东省",
        "重庆市",
        "湖北省",
        "上海市",
        "河北省",
        "吉林省",
        "广西壮族自治区",
        "福建省",
      ],
    },
    shareholders: {
      note: "占比5%以上",
      list: [
        { name: "中国邮政集团有限公司", stakePercentage: 38.2, type: "国有" },
        { name: "友邦保险有限公司", stakePercentage: 25.0, type: "外资" },
        {
          name: "北京中邮资产管理有限公司",
          stakePercentage: 15.0,
          type: "国有",
        },
        { name: "中国集邮有限公司", stakePercentage: 12.19, type: "国有" },
        {
          name: "邮政科学研究规划院有限公司",
          stakePercentage: 9.62,
          type: "国有",
        },
      ],
    },
  },
  icbcaxa: {
    code: "icbcaxa",
    shortName: "工银安盛",
    hotline: "95359",
    basicInfo: {
      companyName: "工银安盛人寿保险有限公司",
      companyType: ["寿险公司", "国有控股", "中外合资"],
      registeredCapital: {
        value: 125.05,
        unit: "亿",
      },
      address: "中国（上海）自由贸易试验区陆家嘴环路 166 号",
      website: "https://www.icbc-axa.com/",
    },
    solvency: {
      rating: "优秀",
      dividendRealizationRate: "19%-112%",
      financialInvestmentYield: {
        annual: 1.81,
        recentThreeYears: 3.77,
      },
      comprehensiveInvestmentYield: {
        annual: 3.14,
        recentThreeYears: 6,
      },
      comprehensiveSolvencyRatio: 261,
      coreSolvencyRatio: 195,
      riskRating: "AAA",
      sarmraScore: 82.12,
      totalAssets: {
        value: 3224.0,
        unit: "亿元",
      },
      reportDate: "2025 年第 2 季度",
    },
    serviceCapability: {
      qualityIndex: 83.73,
      complaintsPer10kPolicies: 0.753,
      complaintsPer100mPremium: 0.447,
      complaintsPer10kCustomers: 0.183,
      ratingDate: "2022 年第四季度",
      complaintDataUpdateDate: "2023 年第四季度",
    },
    branchDistribution: {
      provinces: [
        "上海市",
        "北京市",
        "广东省",
        "辽宁省",
        "天津市",
        "浙江省",
        "山东省",
        "四川省",
        "河北省",
        "河南省",
        "湖北省",
        "陕西省",
        "山西省",
        "福建省",
        "安徽省",
        "重庆市",
        "广西壮族自治区",
        "云南省",
        "江西省",
      ],
    },
    shareholders: {
      note: "占比 5% 以上",
      list: [
        {
          name: "中国工商银行股份有限公司",
          stakePercentage: 60.0,
          type: "国有",
        },
        { name: "安盛中国公司", stakePercentage: 27.5, type: "外资" },
        { name: "五矿资本控股有限公司", stakePercentage: 10.0, type: "国有" },
      ],
    },
  },
};

export const MOCK_INDUSTRY_DATA: IndustryData[] = [
  {
    id: "1",
    code: "ID_INS001",
    name: "城市平均工资、月度护理成本、生活类支出数据",
    deployed: true,
    operator: "antsure1",
    operationTime: "2024-05-20 14:30:00",
  },
  {
    id: "2",
    code: "ID_INS002",
    name: "重疾发生率",
    deployed: true,
    operator: "antsure1",
    operationTime: "2024-05-20 14:35:00",
  },
  {
    id: "3",
    code: "ID_INS003",
    name: "意外发生率",
    deployed: true,
    operator: "antsure1",
    operationTime: "2024-05-20 15:00:00",
  },
  {
    id: "4",
    code: "ID_INS004",
    name: "因病身故发生率",
    deployed: true,
    operator: "antsure1",
    operationTime: "2024-05-20 15:10:00",
  },
  {
    id: "5",
    code: "ID_INS005",
    name: "住院发生率",
    deployed: false,
    operator: "antsure1",
    operationTime: "2024-05-20 16:20:00",
  },
  {
    id: "6",
    code: "ID_INS006",
    name: "门诊发生率",
    deployed: false,
    operator: "antsure1",
    operationTime: "2024-05-20 17:45:00",
  },
];

export const MOCK_CITY_SALARY_DATA: CitySalaryData[] = [
  {
    provinceName: "北京市",
    cityName: "北京市",
    provinceGbCode: "110000",
    cityGbCode: "110100",
    avgAnnualSalary: "218,312",
    avgMonthlySalary: "18,192.66667",
    monthlyNursingCost: "6502",
    monthly_living_expense: 1451,
  },
  {
    provinceName: "天津市",
    cityName: "天津市",
    provinceGbCode: "120000",
    cityGbCode: "120100",
    avgAnnualSalary: "138,007",
    avgMonthlySalary: "11,500.58333",
    monthlyNursingCost: "4300",
    monthly_living_expense: 1300,
  },
  {
    provinceName: "河北省",
    cityName: "石家庄市",
    provinceGbCode: "130000",
    cityGbCode: "130100",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "3300",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "唐山市",
    provinceGbCode: "130000",
    cityGbCode: "130200",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "3100",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "秦皇岛市",
    provinceGbCode: "130000",
    cityGbCode: "130300",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "3000",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "邯郸市",
    provinceGbCode: "130000",
    cityGbCode: "130400",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "2850",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "邢台市",
    provinceGbCode: "130000",
    cityGbCode: "130500",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "2800",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "保定市",
    provinceGbCode: "130000",
    cityGbCode: "130600",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "2950",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "张家口市",
    provinceGbCode: "130000",
    cityGbCode: "130700",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "2750",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "承德市",
    provinceGbCode: "130000",
    cityGbCode: "130800",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "2800",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "沧州市",
    provinceGbCode: "130000",
    cityGbCode: "130900",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "2900",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "廊坊市",
    provinceGbCode: "130000",
    cityGbCode: "131000",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "3150",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "河北省",
    cityName: "衡水市",
    provinceGbCode: "130000",
    cityGbCode: "131100",
    avgAnnualSalary: "94,818",
    avgMonthlySalary: "7,901.5",
    monthlyNursingCost: "2750",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "山西省",
    cityName: "太原市",
    provinceGbCode: "140000",
    cityGbCode: "140100",
    avgAnnualSalary: "95,025",
    avgMonthlySalary: "7,918.75",
    monthlyNursingCost: "3100",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "山西省",
    cityName: "大同市",
    provinceGbCode: "140000",
    cityGbCode: "140200",
    avgAnnualSalary: "95,025",
    avgMonthlySalary: "7,918.75",
    monthlyNursingCost: "2800",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "山西省",
    cityName: "阳泉市",
    provinceGbCode: "140000",
    cityGbCode: "140300",
    avgAnnualSalary: "95,025",
    avgMonthlySalary: "7,918.75",
    monthlyNursingCost: "2650",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "山西省",
    cityName: "长治市",
    provinceGbCode: "140000",
    cityGbCode: "140400",
    avgAnnualSalary: "95,025",
    avgMonthlySalary: "7,918.75",
    monthlyNursingCost: "2750",
    monthly_living_expense: 1065,
  },
  {
    provinceName: "山西省",
    cityName: "晋城市",
    provinceGbCode: "140000",
    cityGbCode: "140500",
    avgAnnualSalary: "95,025",
    avgMonthlySalary: "7,918.75",
    monthlyNursingCost: "2800",
    monthly_living_expense: 1065,
  },
];

export const MOCK_CRITICAL_ILLNESS_DATA: CriticalIllnessRateData[] = [
  { age: 0, gender: "男", rate: "0.000429" },
  { age: 1, gender: "男", rate: "0.000375" },
  { age: 2, gender: "男", rate: "0.000327" },
  { age: 3, gender: "男", rate: "0.000285" },
  { age: 4, gender: "男", rate: "0.00025" },
  { age: 5, gender: "男", rate: "0.000224" },
  { age: 6, gender: "男", rate: "0.000207" },
  { age: 7, gender: "男", rate: "0.0002" },
  { age: 8, gender: "男", rate: "0.000203" },
  { age: 9, gender: "男", rate: "0.000214" },
  { age: 10, gender: "男", rate: "0.00023" },
  { age: 11, gender: "男", rate: "0.000248" },
  { age: 12, gender: "男", rate: "0.000266" },
  { age: 13, gender: "男", rate: "0.000282" },
  { age: 14, gender: "男", rate: "0.000295" },
  { age: 15, gender: "男", rate: "0.000309" },
  { age: 16, gender: "男", rate: "0.000328" },
  { age: 17, gender: "男", rate: "0.000353" },
  { age: 18, gender: "男", rate: "0.000387" },
  { age: 19, gender: "男", rate: "0.000433" },
  { age: 20, gender: "男", rate: "0.00049" },
  { age: 21, gender: "男", rate: "0.000554" },
  { age: 22, gender: "男", rate: "0.000625" },
  { age: 23, gender: "男", rate: "0.0007" },
  { age: 24, gender: "男", rate: "0.000778" },
];

export const MOCK_ACCIDENT_RATE_DATA: AccidentRateData[] = [
  { age: 0, gender: "男", rate: "0.00015352" },
  { age: 1, gender: "男", rate: "0.00013395" },
  { age: 2, gender: "男", rate: "0.00011724" },
  { age: 3, gender: "男", rate: "0.00010343" },
  { age: 4, gender: "男", rate: "0.00009253" },
  { age: 5, gender: "男", rate: "0.00008426" },
  { age: 6, gender: "男", rate: "0.00007928" },
  { age: 7, gender: "男", rate: "0.00007719" },
  { age: 8, gender: "男", rate: "0.00007789" },
  { age: 9, gender: "男", rate: "0.00008119" },
  { age: 10, gender: "男", rate: "0.00008908" },
  { age: 11, gender: "男", rate: "0.00009691" },
  { age: 12, gender: "男", rate: "0.00010639" },
  { age: 13, gender: "男", rate: "0.00011707" },
  { age: 14, gender: "男", rate: "0.00012849" },
  { age: 15, gender: "男", rate: "0.0001393" },
  { age: 16, gender: "男", rate: "0.00015082" },
  { age: 17, gender: "男", rate: "0.0001619" },
];

export const MOCK_DEATH_RATE_DATA: DeathRateData[] = [
  { age: 0, rate: "0.000722" },
  { age: 1, rate: "0.000603" },
  { age: 2, rate: "0.000499" },
  { age: 3, rate: "0.000416" },
  { age: 4, rate: "0.000358" },
  { age: 5, rate: "0.000323" },
  { age: 6, rate: "0.000309" },
  { age: 7, rate: "0.000308" },
  { age: 8, rate: "0.000311" },
  { age: 9, rate: "0.000312" },
  { age: 10, rate: "0.000312" },
  { age: 11, rate: "0.000312" },
  { age: 12, rate: "0.000313" },
  { age: 13, rate: "0.000320" },
  { age: 14, rate: "0.000336" },
  { age: 15, rate: "0.000364" },
  { age: 16, rate: "0.000404" },
  { age: 17, rate: "0.000455" },
  { age: 18, rate: "0.000513" },
  { age: 19, rate: "0.000572" },
  { age: 20, rate: "0.000621" },
  { age: 21, rate: "0.000661" },
  { age: 22, rate: "0.000692" },
  { age: 23, rate: "0.000716" },
];

export const MOCK_HOSPITALIZATION_RATE_DATA: HospitalizationRateData[] = [
  {
    age: 0,
    gender: "男",
    rate: "0.0002212",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 1,
    gender: "男",
    rate: "0.0002212",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 2,
    gender: "男",
    rate: "0.0002212",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 3,
    gender: "男",
    rate: "0.0002212",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 4,
    gender: "男",
    rate: "0.0002212",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 5,
    gender: "男",
    rate: "0.0000738668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 6,
    gender: "男",
    rate: "0.0000738668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 7,
    gender: "男",
    rate: "0.0000738668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 8,
    gender: "男",
    rate: "0.0000738668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 9,
    gender: "男",
    rate: "0.0000738668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 10,
    gender: "男",
    rate: "0.0000738668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 11,
    gender: "男",
    rate: "0.0000402668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 12,
    gender: "男",
    rate: "0.0000402668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 13,
    gender: "男",
    rate: "0.0000402668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 14,
    gender: "男",
    rate: "0.0000402668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 15,
    gender: "男",
    rate: "0.0000402668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 16,
    gender: "男",
    rate: "0.0000472",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 17,
    gender: "男",
    rate: "0.0000472",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 18,
    gender: "男",
    rate: "0.0000472",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 19,
    gender: "男",
    rate: "0.0000472",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 20,
    gender: "男",
    rate: "0.0000472",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 21,
    gender: "男",
    rate: "0.0000666668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 22,
    gender: "男",
    rate: "0.0000666668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
  {
    age: 23,
    gender: "男",
    rate: "0.0000666668",
    treatmentCost: "21～53万",
    maxCost: "186万",
    roundingRule: "200万",
  },
];

export const MOCK_OUTPATIENT_RATE_DATA: OutpatientRateData[] = [
  // Age 0-5
  ...Array.from({ length: 6 }, (_, i) => ({
    age: i,
    rate: "0.036072",
    avgAnnualVisits: 6,
    avgCostPerVisit: 400,
    avgAnnualCost: 6000,
    suggestedSumAssured: 10000,
  })),
  // Age 6-20
  ...Array.from({ length: 15 }, (_, i) => ({
    age: i + 6,
    rate: "0.01868",
    avgAnnualVisits: 6,
    avgCostPerVisit: 400,
    avgAnnualCost: 6000,
    suggestedSumAssured: 10000,
  })),
  // Age 21-26
  ...Array.from({ length: 6 }, (_, i) => ({
    age: i + 21,
    rate: "0.031792",
    avgAnnualVisits: 6,
    avgCostPerVisit: 400,
    avgAnnualCost: 6000,
    suggestedSumAssured: 10000,
  })),
];

export const MAPPING_DATA: InsuranceCategoryMapping[] = [
  {
    antLevel3Code: "A0101",
    antLevel1Name: "医疗险",
    antLevel2Name: "住院医疗",
    antLevel3Name: "短期百万医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "A0102",
    antLevel1Name: "医疗险",
    antLevel2Name: "住院医疗",
    antLevel3Name: "长期医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "A0103",
    antLevel1Name: "医疗险",
    antLevel2Name: "住院医疗",
    antLevel3Name: "中老年长期医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "A0104",
    antLevel1Name: "医疗险",
    antLevel2Name: "住院医疗",
    antLevel3Name: "长期防癌医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "A0105",
    antLevel1Name: "医疗险",
    antLevel2Name: "住院医疗",
    antLevel3Name: "短期防癌医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "A0201",
    antLevel1Name: "医疗险",
    antLevel2Name: "门诊医疗",
    antLevel3Name: "通用门诊医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "A0202",
    antLevel1Name: "医疗险",
    antLevel2Name: "门诊医疗",
    antLevel3Name: "少儿门诊医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "A0203",
    antLevel1Name: "医疗险",
    antLevel2Name: "门诊医疗",
    antLevel3Name: "意外医疗",
    regLevel2Name: "医疗保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "B0101",
    antLevel1Name: "重疾险",
    antLevel2Name: "短期重疾",
    antLevel3Name: "一年期重疾",
    regLevel2Name: "疾病保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "B0201",
    antLevel1Name: "重疾险",
    antLevel2Name: "定期重疾",
    antLevel3Name: "长期重疾",
    regLevel2Name: "疾病保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "B0202",
    antLevel1Name: "重疾险",
    antLevel2Name: "定期重疾",
    antLevel3Name: "长期防癌",
    regLevel2Name: "疾病保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "B0301",
    antLevel1Name: "重疾险",
    antLevel2Name: "终身重疾",
    antLevel3Name: "终身重疾",
    regLevel2Name: "疾病保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "B0302",
    antLevel1Name: "重疾险",
    antLevel2Name: "终身重疾",
    antLevel3Name: "终身防癌",
    regLevel2Name: "疾病保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "C0101",
    antLevel1Name: "意外险",
    antLevel2Name: "综合意外",
    antLevel3Name: "成人综合意外",
    regLevel2Name: "意外伤害保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "C0102",
    antLevel1Name: "意外险",
    antLevel2Name: "综合意外",
    antLevel3Name: "少儿综合意外",
    regLevel2Name: "意外伤害保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "C0103",
    antLevel1Name: "意外险",
    antLevel2Name: "综合意外",
    antLevel3Name: "学平险",
    regLevel2Name: "意外伤害保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "C0104",
    antLevel1Name: "意外险",
    antLevel2Name: "综合意外",
    antLevel3Name: "老年综合意外",
    regLevel2Name: "意外伤害保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "C0201",
    antLevel1Name: "意外险",
    antLevel2Name: "出行意外",
    antLevel3Name: "两轮电动车意外",
    regLevel2Name: "意外伤害保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "C0202",
    antLevel1Name: "意外险",
    antLevel2Name: "出行意外",
    antLevel3Name: "交通意外",
    regLevel2Name: "意外伤害保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "C0203",
    antLevel1Name: "意外险",
    antLevel2Name: "出行意外",
    antLevel3Name: "旅行意外",
    regLevel2Name: "意外伤害保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "D0101",
    antLevel1Name: "养老金",
    antLevel2Name: "年金",
    antLevel3Name: "养老年金（分红型）",
    regLevel2Name: "养老年金保险",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "D0102",
    antLevel1Name: "养老金",
    antLevel2Name: "年金",
    antLevel3Name: "养老年金",
    regLevel2Name: "养老年金保险",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "E0101",
    antLevel1Name: "储蓄型",
    antLevel2Name: "年金",
    antLevel3Name: "中期年金（分红型）",
    regLevel2Name: "普通年金保险",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "E0102",
    antLevel1Name: "储蓄型",
    antLevel2Name: "年金",
    antLevel3Name: "中期年金",
    regLevel2Name: "普通年金保险",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "E0103",
    antLevel1Name: "储蓄型",
    antLevel2Name: "年金",
    antLevel3Name: "教育金",
    regLevel2Name: "普通年金保险",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "E0201",
    antLevel1Name: "储蓄型",
    antLevel2Name: "增额终身寿",
    antLevel3Name: "增额终身寿（分红型）",
    regLevel2Name: "增额终身寿",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "E0202",
    antLevel1Name: "储蓄型",
    antLevel2Name: "增额终身寿",
    antLevel3Name: "增额终身寿",
    regLevel2Name: "增额终身寿",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "E0301",
    antLevel1Name: "储蓄型",
    antLevel2Name: "两全保险",
    antLevel3Name: "两全保险",
    regLevel2Name: "两全保险",
    functionCategory: "储蓄",
  },
  {
    antLevel3Code: "F0101",
    antLevel1Name: "定期寿险",
    antLevel2Name: "定期寿险",
    antLevel3Name: "定期寿险",
    regLevel2Name: "定期寿险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "G0101",
    antLevel1Name: "车险",
    antLevel2Name: "交强险",
    antLevel3Name: "交强险",
    regLevel2Name: "机动车交通事故责任强制保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "G0201",
    antLevel1Name: "车险",
    antLevel2Name: "商业险",
    antLevel3Name: "第三者责任险",
    regLevel2Name: "机动车商业保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "G0202",
    antLevel1Name: "车险",
    antLevel2Name: "商业险",
    antLevel3Name: "车辆损失险",
    regLevel2Name: "机动车商业保险",
    functionCategory: "保障",
  },
  {
    antLevel3Code: "G0203",
    antLevel1Name: "车险",
    antLevel2Name: "商业险",
    antLevel3Name: "车上人员责任险",
    regLevel2Name: "机动车商业保险",
    functionCategory: "保障",
  },
];

export const LEVEL_3_DATA: CategoryDefinition[] = [
  {
    code: "A0101",
    name: "短期百万医疗",
    definition:
      "高保额、低保费，通常为一年期，用于报销因疾病或意外导致的巨大住院医疗费用。",
    features:
      "保障杠杆极高，一年期保费低廉；涵盖住院、特殊门诊、外购药等费用。",
    function:
      "补偿医保目录内外的巨额医疗支出，防止因病致贫；作为医保的有效补充。",
    audience: "预算有限但需要高额住院医疗保障的群体。",
    selectionPoints:
      "续保条件（是否保证续保），免赔额设定，增值服务（如就医绿通）。",
    coreMetrics: "保额，免赔额，续保条件，报销比例。",
  },
  {
    code: "A0102",
    name: "长期医疗",
    definition:
      "提供长期或保证续保年限的住院医疗保障，为被保险人提供稳定的高额医疗支持。",
    features:
      "保证长期续保，不受产品停售或健康变化影响；费率相对稳定，提供持久安全感。",
    function:
      "持续、稳定地覆盖疾病或意外导致的住院医疗费用，规避医疗通胀和未来健康风险。",
    audience: "追求长期稳定、不间断医疗保障的家庭和个人。",
    selectionPoints: "保证续保期限长短，费率调整机制是否透明，健康告知严格度。",
    coreMetrics: "保证续保年限，总保额，免赔额，费率调整规则。",
  },
  {
    code: "A0103",
    name: "中老年长期医疗",
    definition:
      "专为中老年人设计的长期医疗险，通常放宽了投保年龄和健康要求，但保障聚焦。",
    features:
      "投保年龄上限高，部分产品对三高或既往症友好；侧重中老年高发疾病保障。",
    function:
      "解决老年群体因健康状况较难购买医疗险的问题，提供持续的住院费用报销。",
    audience: "50岁以上，希望获得持续住院医疗保障的中老年群体。",
    selectionPoints: "投保年龄上限，健康告知宽松度，对既往症和特定疾病的责任。",
    coreMetrics: "投保年龄上限，免赔额，特定疾病赔付额，费率结构。",
  },
  {
    code: "A0104",
    name: "长期防癌医疗",
    definition:
      "专注于癌症治疗费用报销的长期医疗险，对非癌症疾病的健康告知相对宽松。",
    features:
      "保证长期续保，癌症相关费用报销比例高；通常健康告知宽松，可带病投保。",
    function:
      "集中应对癌症治疗费用高昂的风险，作为重疾险或普通医疗险的有效补充。",
    audience: "有癌症家族史、预算有限或健康欠佳（次标体）但需癌症保障者。",
    selectionPoints:
      "保证续保年限，癌症特药/外购药覆盖范围，非癌疾病的排除条款。",
    coreMetrics: "保证续保年限，癌症总保额，特药清单覆盖率。",
  },
  {
    code: "A0105",
    name: "短期防癌医疗",
    definition: "一年期或短期防癌医疗险，提供癌症治疗费用报销。",
    features:
      "价格便宜，投保灵活，适合短期内需要补充癌症保障的人群；健康告知宽松。",
    function: "短期内转移癌症医疗费用风险，保障高额的癌症治疗开支。",
    audience: "预算紧张或作为过渡性癌症保障者。",
    selectionPoints: "续保的稳定性，等待期长短，癌症特药报销范围。",
    coreMetrics: "保额，免赔额，续保条件，费率。",
  },
  {
    code: "A0201",
    name: "通用门诊医疗",
    definition:
      "报销普通疾病和意外导致的门诊或急诊费用，通常有次数或金额限制。",
    features: "解决小额的日常医疗开支，减少看病自付压力；通常与住院医疗搭配。",
    function: "覆盖日常看病产生的门诊费用，降低小额但高频的医疗支出风险。",
    audience: "追求全面医疗覆盖，希望减轻日常看病费用的个人或家庭。",
    selectionPoints: "单次/年度门诊限额，免赔额或免赔次数设定，就医网络覆盖。",
    coreMetrics: "年度门诊限额，单次限额，免赔额，报销比例。",
  },
  {
    code: "A0202",
    name: "少儿门诊医疗",
    definition:
      "专为儿童设计的门诊医疗产品，覆盖儿童高发的常见病和意外门诊费用。",
    features:
      "针对少儿高发疾病设置更高赔付或无免赔额；保障范围贴合少儿易生病特点。",
    function: "解决儿童因免疫力较低导致的频繁门诊和急诊费用，减轻家庭负担。",
    audience: "0-14岁儿童的家长。",
    selectionPoints:
      "门诊年度限额，儿科专科医院覆盖，是否包含疫苗接种并发症责任。",
    coreMetrics: "年度门诊保额，免赔额，就医医院范围，费率。",
  },
  {
    code: "A0203",
    name: "意外医疗",
    definition:
      "报销因意外事故产生的门诊、住院及手术费用，是综合意外险的关键组成部分。",
    features: "无健康告知要求，费用通常较低，报销意外产生的医疗费用。",
    function: "补偿意外事故造成的治疗费用，实现小额快速赔付。",
    audience: "所有需要意外风险保障的群体。",
    selectionPoints: "是否限制社保内用药，报销比例（社保内外），免赔额。",
    coreMetrics: "医疗保额，免赔额，社保外报销比例。",
  },
  {
    code: "B0101",
    name: "一年期重疾",
    definition: "期限为一年，确诊合同约定的重大疾病后给付保额。",
    features: "价格极低，保障杠杆高，适合短期内补充高额重疾保障。",
    function: "确诊后提供一笔现金流，用于治疗或弥补一年内的收入损失。",
    audience: "预算极少，或短期内急需高保额重疾保障的年轻人。",
    selectionPoints:
      "续保条件（是否可稳定续保），等待期，疾病定义是否使用最新标准。",
    coreMetrics: "保额，年保费，续保稳定性，疾病种类。",
  },
  {
    code: "B0201",
    name: "长期重疾",
    definition: "保障期限覆盖20年、30年或至指定年龄的重大疾病保险。",
    features: "保障期限固定且较长，保费锁定，提供特定年龄段的稳定保障。",
    function: "转移中青年时期收入中断和高额疾病治疗的风险，提供经济支持。",
    audience: "追求稳定重疾保障，预算高于一年期险种的家庭支柱。",
    selectionPoints: "轻中症保障及赔付比例，是否包含身故责任，保费豁免条款。",
    coreMetrics: "保额，保障期限，轻/中症赔付比例，保费结构。",
  },
  {
    code: "B0202",
    name: "长期防癌",
    definition: "针对癌症提供确诊给付的保险产品，保障期限长。",
    features: "聚焦高发重疾，通常比传统重疾险保费便宜；健康告知宽松。",
    function: "专门应对癌症带来的经济压力，保障持久稳定。",
    audience: "有癌症家族史，或因健康原因无法购买标准重疾险的人。",
    selectionPoints: "是否包含原位癌，多次赔付设计及其间隔期。",
    coreMetrics: "癌症保额，保障期限，保费，多次赔付设计。",
  },
  {
    code: "B0301",
    name: "终身重疾",
    definition: "提供终身重大疾病保障，通常包含身故责任，保障期直至生命终结。",
    features:
      "一次投入，终身锁定健康风险；现金价值可随时间增长，兼具财富传承功能。",
    function: "终极的健康风险转移工具，提供终身保障和财富安排。",
    audience: "财务稳健，追求终身保障和财富传承安排的高净值人群。",
    selectionPoints:
      "现金价值增长速度，身故责任形态（赔保额或现价），多次赔付设计。",
    coreMetrics: "保额，现金价值增长率，轻/中症赔付，身故责任。",
  },
  {
    code: "B0302",
    name: "终身防癌",
    definition: "提供终身癌症确诊给付的保险，保障责任聚焦于恶性肿瘤。",
    features:
      "保费低于终身重疾，健康告知宽松，保障目标明确，对次标体人群友好。",
    function: "锁定终身的癌症经济风险，减轻罹患癌症后的经济压力。",
    audience: "追求终身癌症保障，或已患有非癌症疾病的次标体人群。",
    selectionPoints: "癌症多次赔付的间隔期和条件，是否含特定器官保障。",
    coreMetrics: "癌症保额，保障期限（终身），保费结构。",
  },
  {
    code: "C0101",
    name: "成人综合意外",
    definition: "针对成人设计，提供意外身故、伤残及意外医疗保障。",
    features: "保障全面，覆盖意外事故的各个方面；保费低廉，杠杆高。",
    function: "应对日常生活和工作中的意外风险，提供经济补偿和医疗报销。",
    audience: "18-65岁的普通劳动者和家庭支柱。",
    selectionPoints: "伤残保额与等级划分，高风险职业的限制，意外医疗报销比例。",
    coreMetrics: "意外身故/伤残保额，意外医疗保额，职业类别限制。",
  },
  {
    code: "C0102",
    name: "少儿综合意外",
    definition:
      "针对儿童设计的意外保险，侧重意外医疗和特定风险（如烧烫伤、中毒）。",
    features: "高额意外医疗，通常不含身故保障或身故保额受限。",
    function: "应对儿童活泼好动导致的各种小意外伤害和医疗支出。",
    audience: "0-17岁的儿童和青少年。",
    selectionPoints:
      "意外医疗报销范围（社保外），是否包含住院津贴，特定意外责任。",
    coreMetrics: "意外医疗保额，伤残保额，特定事故保额。",
  },
  {
    code: "C0103",
    name: "学平险",
    definition: "针对在校学生设计，涵盖意外伤害和疾病住院医疗的综合保障计划。",
    features: "团体投保，费率低廉，保障范围限定在学习生活环境。",
    function: "解决学生在校期间和日常生活中发生的意外和疾病医疗费用。",
    audience: "在幼儿园、小学、中学、大学就读的学生。",
    selectionPoints: "疾病住院医疗是否包含，保障范围是否覆盖校外，门急诊额度。",
    coreMetrics: "意外医疗保额，疾病住院保额，年度保费。",
  },
  {
    code: "C0104",
    name: "老年综合意外",
    definition: "针对高龄人群设计，着重于骨折、跌倒等老年高发风险的意外险。",
    features: "投保年龄上限高，部分产品包含骨折津贴或救护车费用。",
    function: "应对老年人因身体机能下降更容易发生的意外伤害和骨折风险。",
    audience: "60岁以上的退休老年群体。",
    selectionPoints: "骨折保障额度，意外医疗报销比例，对既往症的限制。",
    coreMetrics: "骨折/烧烫伤保额，意外医疗保额，投保年龄上限。",
  },
  {
    code: "C0201",
    name: "两轮电动车意外",
    definition: "专门针对骑行两轮电动车过程中发生的意外伤害提供保障。",
    features: "聚焦特定交通工具风险，通常包含人身伤害及第三者责任。",
    function: "转移日益普及的电动车使用带来的特定意外和责任风险。",
    audience: "经常使用电动自行车或摩托车的骑行者。",
    selectionPoints: "是否包含驾驶员本身和乘客责任，第三者责任限额。",
    coreMetrics: "驾乘人员伤亡保额，第三者责任限额，保障范围。",
  },
  {
    code: "C0202",
    name: "交通意外",
    definition: "针对乘坐或驾驶特定交通工具时发生的意外提供额外赔付。",
    features: "高杠杆，仅在特定交通场景下提供高额保障。",
    function: "应对出差、旅行等高频交通出行中可能遭遇的巨大风险。",
    audience: "经常出差或需要高额交通意外保障的人群。",
    selectionPoints: "涵盖的交通工具种类（飞机、火车、私家车），赔付倍数设定。",
    coreMetrics: "交通工具意外额外保额，保障期限，保费。",
  },
  {
    code: "C0203",
    name: "旅行意外",
    definition:
      "在旅行期间提供意外身故/伤残、意外医疗及旅行不便（如延误）保障。",
    features: "保障期限灵活，包含紧急救援、旅行延误、证件损失等特色服务。",
    function: "转移旅行途中可能遇到的健康、安全和行程中断等风险。",
    audience: "国内或出境旅行者。",
    selectionPoints: "紧急救援服务范围，高风险运动是否承保，医疗费用垫付服务。",
    coreMetrics: "医疗保额，紧急救援限额，旅行延误赔偿标准。",
  },
  {
    code: "D0101",
    name: "养老年金（分红型）",
    definition:
      "在退休后按期给付养老金，同时可参与保险公司盈余分红的年金保险。",
    features: "确定性给付搭配不确定性分红，收益潜力高于普通年金。",
    function: "强制储蓄，规划未来养老生活，抵御长寿风险和通货膨胀。",
    audience: "有稳定收入，希望尽早规划退休生活，追求稳定收益和分红增值。",
    selectionPoints: "保证给付期限，分红实现率和历史表现，预定利率水平。",
    coreMetrics: "保证利率，分红实现率，养老金领取起始年龄，IRR。",
  },
  {
    code: "D0102",
    name: "养老年金",
    definition: "在退休后固定按期给付养老金，现金流确定且写入合同。",
    features: "确定性强，收益和给付金额固定，保证长期稳定性。",
    function: "锁定退休后的收入来源，实现专款专用，对抗长寿风险。",
    audience: "追求稳定、明确退休收入来源的群体。",
    selectionPoints: "保证领取期限，领取年龄和方式，现价增长与身故责任。",
    coreMetrics: "保证领取年限，内部收益率 (IRR)，养老金领取金额。",
  },
  {
    code: "E0101",
    name: "中期年金（分红型）",
    definition: "缴费和领取周期都相对较短的年金产品，带有分红收益。",
    features: "流动性高于养老金，投资期和回报期灵活，有分红增值潜力。",
    function:
      "实现中期财富增值和规划，满足特定时间节点的资金需求（如十年后大额支出）。",
    audience: "有明确中期财务目标，追求确定性收益和分红可能性的投资者。",
    selectionPoints: "分红机制和历史实现率，退保损失，现价回本速度。",
    coreMetrics: "保证利率，分红实现率，缴费/领取期限，IRR。",
  },
  {
    code: "E0102",
    name: "中期年金",
    definition: "锁定一个中期期限的现金流或生存金给付的年金产品。",
    features: "收益确定，期限相对灵活，可作为家庭资产配置的一部分。",
    function: "用于中期教育金、购房金等特定目标的规划和储蓄。",
    audience: "追求中期确定性回报的储蓄者。",
    selectionPoints: "现金价值增长速度，预定利率，给付时间点。",
    coreMetrics: "预定利率，缴费/领取期限，IRR。",
  },
  {
    code: "E0103",
    name: "教育金",
    definition: "专为子女教育储蓄设计，在孩子特定年龄给付教育金、深造金等。",
    features: "强制储蓄，锁定未来教育资金；通常有投保人豁免等保障功能。",
    function:
      "确保子女在关键教育阶段（高中、大学）有稳定的资金支持，实现专款专用。",
    audience: "有子女，希望提前锁定教育费用且注重专款专用的家庭。",
    selectionPoints: "教育金给付年龄和金额，投保人豁免责任的范围，总现价收益。",
    coreMetrics: "教育金给付额度，豁免责任范围，IRR。",
  },
  {
    code: "E0201",
    name: "增额终身寿（分红型）",
    definition: "保额和现金价值会随着时间复利增长的终身寿险，带有分红收益。",
    features: "现金价值增长确定性高，同时有分红可能，兼具保障和储蓄功能。",
    function: "长期财富规划、资产传承和锁定长期确定性现金流。",
    audience: "追求资产长期稳健增值、有高额传承需求的高净值人群。",
    selectionPoints: "现价复利增速，分红实现率，减保取现规则的灵活性。",
    coreMetrics: "现价复利增长率，分红实现率，保额增长率，减保灵活性。",
  },
  {
    code: "E0202",
    name: "增额终身寿",
    definition: "保额和现金价值按固定复利持续增长的终身寿险。",
    features: "收益确定，现价增长明确写入合同，具有较高的减保取现流动性。",
    function: "长期强制储蓄，资产配置，身故传承，或作为长期备用金。",
    audience: "注重资金安全性和确定性，有长期储蓄和传承需求的群体。",
    selectionPoints: "现价回本速度，减保规则的灵活性，有效保额增长率。",
    coreMetrics: "现价复利增长率，现金价值增长曲线，IRR，减保规则。",
  },
  {
    code: "E0301",
    name: "两全保险",
    definition: "无论被保险人生存到期满或在期内身故，保险公司都会给付保险金。",
    features: "具备“有病治病，无病返本”的特点，迎合消费者“保费安全”的需求。",
    function: "结合了储蓄和身故保障，确保资金到期返还，实现资产保全。",
    audience: "偏爱保守型投资，希望保费安全返回的储蓄者。",
    selectionPoints: "保障期限，生存金或满期金的给付比例，IRR（通常较低）。",
    coreMetrics: "满期给付金额，身故保额，保障期限，IRR。",
  },
  {
    code: "F0101",
    name: "定期寿险",
    definition:
      "在特定期限内，若被保险人身故或全残，给付保额。期满则合同终止。",
    features: "纯保障型产品，保费低廉，杠杆极高，投保门槛低。",
    function: "转移家庭经济支柱的死亡或全残风险，保障家人生活稳定和债务偿还。",
    audience: "承担家庭经济责任的成年人（有房贷、车贷等债务）。",
    selectionPoints:
      "保额充足性（覆盖负债+未来开支）、健康告知宽松度、免责条款。",
    coreMetrics: "保额、保障期限、保费（性价比）、健康告知、免责条款",
  },
  {
    code: "G0101",
    name: "交强险",
    definition:
      "法定强制保险，赔偿因交通事故造成的受害人的人身伤亡和财产损失。",
    features: "强制性、广覆盖、低保障，不赔本车和本车人员。",
    function: "保障交通事故受害人的基本权益，车辆年检必须凭证。",
    audience: "所有车主。",
    selectionPoints: "无（法定必须）。",
    coreMetrics: "责任限额。",
  },
  {
    code: "G0201",
    name: "第三者责任险",
    definition:
      "赔偿因交通事故致使第三者遭受人身伤亡或财产损失的经济赔偿责任。",
    features: "保额选择灵活（如100万、200万、300万），是交强险的重要补充。",
    function: "应对重大交通事故导致对他人的巨额赔偿风险，防止因事故致贫。",
    audience: "所有车主，建议高保额。",
    selectionPoints: "保额大小（建议200万起）。",
    coreMetrics: "赔偿限额。",
  },
  {
    code: "G0202",
    name: "车辆损失险",
    definition: "赔偿因自然灾害或意外事故造成的被保险车辆本身的损失。",
    features: "覆盖车辆碰撞、倾覆、火灾、爆炸等多种原因导致的车辆受损。",
    function: "承担车辆维修费用，减少车主的财产损失。",
    audience: "新车或价值较高的车辆车主。",
    selectionPoints: "保额（通常按车辆实际价值）。",
    coreMetrics: "车辆价值、保费。",
  },
  {
    code: "G0203",
    name: "车上人员责任险",
    definition: "赔偿因交通事故造成的本车驾驶员和乘客的人身伤亡。",
    features: "按座位投保，分为驾驶员座和乘客座。",
    function: "保障本车人员的安全风险，补充意外险的不足。",
    audience: "经常载人的车主。",
    selectionPoints: "每个座位的保额（如1万-10万）。",
    coreMetrics: "单座保额、座位数。",
  },
];

export const LEVEL_2_DATA: CategoryDefinition[] = [
  {
    code: "A01",
    name: "住院医疗",
    definition:
      "主要报销因疾病或意外导致的住院治疗费用，包括床位费、手术费、药品费等，是社保的重要补充。",
    features:
      "通常保额高（如百万级别），保费相对较低，杠杆效应显著，能有效应对大额医疗支出。",
    function:
      "防止家庭因病返贫，覆盖社保目录内外的医疗开销，提供更优质的医疗资源和服务（如绿通）。",
    audience: "所有希望规避大病医疗风险的个人和家庭，尤其是年轻人和家庭支柱。",
    selectionPoints:
      "续保条件（是否保证续保）、免赔额、报销范围（含外购药）、增值服务。",
    coreMetrics: "保证续保年限、免赔额、报销比例、外购药目录、保费",
    faqList: [
      {
        question: "保什么",
        isFocus: true,
        answer: "给我讲下这款产品的保障范围和保障特色",
      },
      {
        question: "投保规则",
        isFocus: false,
        answer: "给我讲下这款产品的投保规则",
      },
      {
        question: "续保规则",
        isFocus: false,
        answer: "给我讲下这款产品的续保规则",
      },
      {
        question: "健康要求",
        isFocus: true,
        answer: "给我讲下这款产品的健康要求",
      },
      {
        question: "价格及缴费方式",
        isFocus: false,
        answer: "给我讲下这款产品的价格及缴费方式",
      },
      {
        question: "适合人群",
        isFocus: false,
        answer: "给我讲下这款产品的适合人群",
      },
      {
        question: "保险公司",
        isFocus: false,
        answer: "给我讲下这款产品的保险公司",
      },
      {
        question: "理赔流程",
        isFocus: true,
        answer: "给我讲下这款产品的理赔流程",
      },
      {
        question: "医疗服务",
        isFocus: false,
        answer: "给我讲下这款产品的医疗服务",
      },
    ],
  },
  {
    code: "A02",
    name: "门诊医疗",
    definition:
      "用于报销日常看病产生的门诊或急诊费用，如挂号费、检查费、药费等，通常有年度限额。",
    features:
      "解决小额但高频的医疗支出，降低日常看病负担。常作为中高端医疗险或企业团险的福利。",
    function:
      "提升就医体验，减少小病带来的经济压力，鼓励及时就医，管理日常健康。",
    audience: "有小孩的家庭、体质较弱者、或追求全面医疗保障的高净值人群。",
    selectionPoints:
      "年度限额、单次限额、免赔额/次数、医院网络（是否含私立）、报销比例。",
    coreMetrics: "年度限额、免赔额、报销比例、就医医院范围、保费",
    faqList: [
      {
        question: "保什么",
        isFocus: true,
        answer: "给我讲下这款产品的保障范围和保障特色",
      },
      {
        question: "投保规则",
        isFocus: false,
        answer: "给我讲下这款产品的投保规则",
      },
      {
        question: "续保规则",
        isFocus: false,
        answer: "给我讲下这款产品的续保规则",
      },
      {
        question: "健康要求",
        isFocus: true,
        answer: "给我讲下这款产品的健康要求",
      },
      {
        question: "价格及缴费方式",
        isFocus: false,
        answer: "给我讲下这款产品的价格及缴费方式",
      },
      {
        question: "适合人群",
        isFocus: false,
        answer: "给我讲下这款产品的适合人群",
      },
      {
        question: "保险公司",
        isFocus: false,
        answer: "给我讲下这款产品的保险公司",
      },
      {
        question: "理赔流程",
        isFocus: true,
        answer: "给我讲下这款产品的理赔流程",
      },
      {
        question: "医疗服务",
        isFocus: false,
        answer: "给我讲下这款产品的医疗服务",
      },
    ],
  },
  {
    code: "B01",
    name: "短期重疾",
    definition:
      "保障期限为一年，确诊合同约定的重大疾病后一次性给付保险金，属于消费型保险。",
    features:
      "保费极低，保障杠杆非常高，适合在特定时期内用低预算快速补充高额重疾保障。",
    function:
      "确诊后提供一笔现金，用于弥补短期收入损失和支付康复费用，解决燃眉之急。",
    audience: "预算有限的年轻人、或需要临时加保的家庭支柱。",
    selectionPoints: "续保稳定性、等待期、疾病定义、是否含轻/中症保障。",
    coreMetrics: "保额、保费、续保条件、等待期、疾病种类",
    faqList: [
      {
        question: "保什么",
        isFocus: true,
        answer: "给我讲下这款产品的保障范围和保障特色",
      },
      {
        question: "保障场景",
        isFocus: true,
        answer: "给我讲下这款产品的赔付规则",
      },
      {
        question: "投保规则",
        isFocus: false,
        answer: "给我讲下这款产品的投保规则",
      },
      {
        question: "价格及缴费方式",
        isFocus: false,
        answer: "给我讲下这款产品的价格及缴费方式",
      },
      {
        question: "适合人群",
        isFocus: false,
        answer: "给我讲下这款产品的适合人群",
      },
      {
        question: "保险公司",
        isFocus: false,
        answer: "给我讲下这款产品的保险公司",
      },
      {
        question: "理赔流程",
        isFocus: true,
        answer: "给我讲下这款产品的理赔流程",
      },
    ],
  },
  {
    code: "B02",
    name: "定期重疾",
    definition:
      "在约定保障期限内（如20年、30年或至70岁）提供重疾保障，期满后合同终止。",
    features:
      "在家庭责任最重的阶段提供高性价比保障，保费比终身重疾便宜，保障聚焦。",
    function:
      "转移家庭支柱在工作年龄段的核心风险，确保即使患病，家庭财务也不会崩溃。",
    audience: "事业上升期、承担家庭主要经济责任的成年人（上有老下有小）。",
    selectionPoints:
      "保障期限选择、轻中症赔付比例、是否含身故责任、多次赔付设计。",
    coreMetrics: "保额、保障期限、轻/中症赔付比例、保费、保费豁免",
    faqList: [
      {
        question: "保什么",
        isFocus: true,
        answer: "给我讲下这款产品的保障范围和保障特色",
      },
      {
        question: "保障场景",
        isFocus: true,
        answer: "给我讲下这款产品的赔付规则",
      },
      {
        question: "投保规则",
        isFocus: false,
        answer: "给我讲下这款产品的投保规则",
      },
      {
        question: "价格及缴费方式",
        isFocus: false,
        answer: "给我讲下这款产品的价格及缴费方式",
      },
      {
        question: "适合人群",
        isFocus: false,
        answer: "给我讲下这款产品的适合人群",
      },
      {
        question: "保险公司",
        isFocus: false,
        answer: "给我讲下这款产品的保险公司",
      },
      {
        question: "理赔流程",
        isFocus: true,
        answer: "给我讲下这款产品的理赔流程",
      },
    ],
  },
  {
    code: "B03",
    name: "终身重疾",
    definition:
      "提供终身重大疾病保障，确诊后给付保险金，通常含有身故责任，保障至生命终点。",
    features:
      "保障期限长，锁定终身风险，后期现金价值较高，兼具保障和一定的储蓄功能。",
    function:
      "终极的健康风险转移工具，既可用于疾病治疗，也可在身后作为资产传承。",
    audience: "预算充足，追求终身保障和财富传承的人群。",
    selectionPoints: "多次赔付设计、疾病分组、现金价值增长率、身故责任形态。",
    coreMetrics: "保额、现金价值增长率、多次赔付条件、疾病分组、身故责任",
    faqList: [
      {
        question: "保什么",
        isFocus: true,
        answer: "给我讲下这款产品的保障范围和保障特色",
      },
      {
        question: "保障场景",
        isFocus: true,
        answer: "给我讲下这款产品的赔付规则",
      },
      {
        question: "投保规则",
        isFocus: false,
        answer: "给我讲下这款产品的投保规则",
      },
      {
        question: "价格及缴费方式",
        isFocus: false,
        answer: "给我讲下这款产品的价格及缴费方式",
      },
      {
        question: "适合人群",
        isFocus: false,
        answer: "给我讲下这款产品的适合人群",
      },
      {
        question: "保险公司",
        isFocus: false,
        answer: "给我讲下这款产品的保险公司",
      },
      {
        question: "理赔流程",
        isFocus: true,
        answer: "给我讲下这款产品的理赔流程",
      },
    ],
  },
  {
    code: "C01",
    name: "综合意外",
    definition:
      "提供因意外导致的身故、伤残和医疗费用报销的综合性保障，覆盖日常生活中的各种意外。",
    features:
      "保费低、杠杆高，投保门槛低（通常无健康告知），保障范围广，是人手必备的基础保障。",
    function:
      "应对突发意外带来的经济冲击，提供伤残补偿、医疗费用报销和身故抚恤。",
    audience: "所有人群，尤其是经常外出、从事有一定风险工作或家庭经济支柱。",
    selectionPoints:
      "意外身故/伤残保额、意外医疗报销范围（是否含社保外）、猝死责任。",
    coreMetrics: "意外身故/伤残保额、意外医疗保额、猝死责任、职业类别限制",
    faqList: [
      {
        question: "保什么",
        isFocus: true,
        answer: "给我讲下这款产品的保障范围和保障特色",
      },
      {
        question: "保障场景",
        isFocus: true,
        answer: "给我讲下这款产品的赔付规则",
      },
      {
        question: "投保规则",
        isFocus: false,
        answer: "给我讲下这款产品的投保规则",
      },
      {
        question: "价格及缴费方式",
        isFocus: false,
        answer: "给我讲下这款产品的价格及缴费方式",
      },
      {
        question: "适合人群",
        isFocus: false,
        answer: "给我讲下这款产品的适合人群",
      },
      {
        question: "保险公司",
        isFocus: false,
        answer: "给我讲下这款产品的保险公司",
      },
      {
        question: "理赔流程",
        isFocus: true,
        answer: "给我讲下这款产品的理赔流程",
      },
    ],
  },
  {
    code: "C02",
    name: "出行意外",
    definition:
      "专为出行场景设计，保障乘坐交通工具或在旅行途中发生的意外风险，通常保额很高。",
    features:
      "场景聚焦，杠杆极高，用很低的保费就能获得上百万的特定场景保障，保障期限灵活。",
    function:
      "针对性转移航空、铁路、自驾等高风险出行场景的巨灾风险，提供超高额保障。",
    audience: "经常出差、旅游的商务人士和旅行爱好者。",
    selectionPoints:
      "覆盖的交通工具种类、保障期限、是否含紧急救援、高风险运动责任。",
    coreMetrics: "特定交通工具保额、保障期限、紧急救援服务、保费",
    faqList: [
      {
        question: "保什么",
        isFocus: true,
        answer: "给我讲下这款产品的保障范围和保障特色",
      },
      {
        question: "保障场景",
        isFocus: true,
        answer: "给我讲下这款产品的赔付规则",
      },
      {
        question: "投保规则",
        isFocus: false,
        answer: "给我讲下这款产品的投保规则",
      },
      {
        question: "价格及缴费方式",
        isFocus: false,
        answer: "给我讲下这款产品的价格及缴费方式",
      },
      {
        question: "适合人群",
        isFocus: false,
        answer: "给我讲下这款产品的适合人群",
      },
      {
        question: "保险公司",
        isFocus: false,
        answer: "给我讲下这款产品的保险公司",
      },
      {
        question: "理赔流程",
        isFocus: true,
        answer: "给我讲下这款产品的理赔流程",
      },
    ],
  },
  {
    code: "D01",
    name: "年金",
    definition:
      "投保人按期缴费，到约定年龄后（如60岁），保险公司开始按年或月给付养老金。",
    features:
      "收益安全、稳定，提供与生命等长的现金流，专款专用，有效对抗长寿风险。",
    function:
      "强制储蓄，提前规划退休生活，确保老年有稳定、体面的收入来源，实现品质养老。",
    audience:
      "有稳定收入，希望提前锁定未来养老收入，追求安全稳健的个人或家庭。",
    selectionPoints:
      "保证领取期限、领取年龄和方式、内部收益率（IRR）、附加万能账户。",
    coreMetrics: "保证领取年限、内部收益率(IRR)、领取金额、起领年龄",
  },
  {
    code: "E01",
    name: "年金",
    definition:
      "缴费和领取周期相对较短的年金险，通常用于实现5-15年内的中期财务目标。",
    features:
      "期限灵活，流动性相对较好，用于特定时间点的资金规划，收益写入合同，安全确定。",
    function:
      "作为子女教育金、婚嫁金、创业金的储备工具，实现专款专用和强制储蓄。",
    audience: "有明确中期（5-15年）财务规划需求的家庭。",
    selectionPoints: "缴费和领取期限、现金价值回本速度、内部收益率（IRR）。",
    coreMetrics: "领取时间、内部收益率(IRR)、现金价值、缴费期限",
  },
  {
    code: "E02",
    name: "增额终身寿",
    definition:
      "保额和现金价值按固定复利逐年增长的终身寿险，兼具保障和长期储蓄功能。",
    features:
      "收益明确写入合同，安全稳定；现金价值增长快，可通过减保灵活取用资金。",
    function:
      "长期财富增值、资产传承、养老补充和子女教育金规划，是灵活的家庭蓄水池。",
    audience: "追求资产安全稳健增值，有长期储蓄或财富传承需求的高净值人群。",
    selectionPoints:
      "有效保额增长率、现金价值回本速度、减保/保单贷款规则的灵活性。",
    coreMetrics: "有效保额增长率、现金价值、内部收益率(IRR)、减保灵活性",
  },
  {
    code: "E03",
    name: "两全保险",
    definition:
      "保险期内身故给付身故金，期满生存则给付满期金。即“保生又保死”的保险。",
    features:
      "满足了“不出事能返本”的消费心理，兼具储蓄和基础保障功能，但收益率通常较低。",
    function:
      "强制储蓄，确保在约定时间点有一笔确定的资金，同时提供基础的身故保障。",
    audience: "风险偏好极低，储蓄习惯较差，希望保费能“返还”的保守型消费者。",
    selectionPoints: "满期金给付金额、保障期限、内部收益率（IRR）的真实水平。",
    coreMetrics: "满期金给付金额、身故保额、内部收益率(IRR)、保障期限",
  },
  {
    code: "F01",
    name: "定期寿险",
    definition:
      "在约定保障期限内，若被保险人身故或全残，保险公司给付保额，期满无事则合同终止。",
    features:
      "纯保障型产品，保费极低，杠杆超高，是体现爱与责任的家庭保障基石。",
    function:
      "防止家庭经济支柱突然离世导致家庭陷入财务困境，用于偿还债务、保障家人生活。",
    audience: "家庭经济支柱，尤其是有房贷、车贷或子女抚养责任的成年人。",
    selectionPoints:
      "保额充足性（覆盖负债+未来开支）、**性价比**（费率）、健康告知宽松度、免责条款。",
    coreMetrics: "保额、保障期限、保费（性价比）、健康告知、免责条款",
  },
  {
    code: "G01",
    name: "交强险",
    definition: "机动车交通事故责任强制保险，国家法律规定必须购买。",
    features:
      "强制投保，基础保障，赔付限额较低，主要赔偿受害人（不包括本车人员和被保险人）。",
    function: "满足车辆合法上路的基本要求，提供最基础的交通事故受害人赔偿。",
    audience: "所有机动车车主（必买）。",
    selectionPoints: "无法选择，统一标准。",
    coreMetrics: "死亡伤残赔偿限额、医疗费用赔偿限额、财产损失赔偿限额",
  },
  {
    code: "G02",
    name: "商业险",
    definition: "车主根据需要自愿投保的汽车保险，作为交强险的补充。",
    features:
      "保障范围广，保额可自定义，覆盖车辆损失、第三者责任及车上人员责任等。",
    function: "提供更全面的车辆和人员保障，弥补交强险赔付限额不足的问题。",
    audience: "希望获得全面车辆保障的车主。",
    selectionPoints:
      "险种组合（车损+三者+座位）、三者险保额、附加险种（如医保外用药）。",
    coreMetrics: "三者险保额、车损险保额、座位险保额、保费",
  },
];

export const LEVEL_1_DATA: CategoryDefinition[] = [
  {
    code: "A",
    name: "医疗险",
    definition:
      "报销因疾病或意外产生的医疗费用，是社保的有效补充，用于解决“看病贵”的问题。",
    features:
      "保费低、保额高，杠杆效应显著，能覆盖社保目录内外的大额医疗开销，实用性强。",
    function:
      "防止家庭因病致贫或返贫，提供就医绿通等增值服务，让普通人也能享有更优质的医疗资源。",
    audience: "所有担心大病医疗费用风险的个人和家庭，特别是家庭经济支柱。",
    selectionPoints:
      "**续保条件**（最关键）、免赔额、报销范围（含外购药）、健康告知、增值服务。",
    coreMetrics: "保证续保年限、免赔额、报销比例、外购药目录、保费",
  },
  {
    code: "B",
    name: "重疾险",
    definition:
      "确诊合同约定的重大疾病后，保险公司一次性给付一笔保险金，与实际医疗花费无关。",
    features:
      "一次性给付，资金用途灵活，可用于治疗康复、家庭生活开支及收入损失补偿。",
    function:
      "核心是**“收入损失补偿”**，弥补患病期间无法工作的收入缺口，保障家庭生活稳定。",
    audience:
      "家庭的经济支柱，承担房贷、车贷、子女教育和赡养老人责任的成年人。",
    selectionPoints:
      "轻/中症保障、多次赔付设计、高发疾病（如心脑血管）覆盖、是否含身故责任。",
    coreMetrics: "保额、疾病种类与分组、轻/中症赔付比例、多次赔付条件、保费",
  },
  {
    code: "C",
    name: "意外险",
    definition:
      "为因外来的、突发的、非本意的、非疾病的客观事件导致的伤害提供保障。",
    features:
      "保费低、杠杆高，投保门槛极低，通常无需健康告知，是人人必备的基础保障。",
    function:
      "提供意外身故/伤残赔偿金，报销意外医疗费用，部分产品含猝死和住院津贴。",
    audience:
      "所有人群，尤其是经常外出、从事有一定风险工作、老人和小孩等易发意外群体。",
    selectionPoints:
      "意外医疗报销范围（是否不限社保）、伤残赔付标准、是否含猝死责任、职业限制。",
    coreMetrics: "意外身故/伤残保额、意外医疗保额、猝死责任保额、职业类别限制",
  },
  {
    code: "D",
    name: "养老金",
    definition:
      "年轻时定期投入资金，达到约定退休年龄后，保险公司开始按期给付一笔稳定的现金流。",
    features:
      "安全稳定，提供与生命等长的确定性现金流，专款专用，有效对抗长寿风险。",
    function:
      "强制储蓄，提前规划退休生活，确保老年有稳定、体面的收入来源，实现品质养老。",
    audience:
      "有稳定收入，希望提前锁定未来养老收入，追求安全稳健理财方式的个人或家庭。",
    selectionPoints:
      "领取年龄和方式、**保证领取期限**、内部收益率（IRR）、现金价值增长情况。",
    coreMetrics: "保证领取年限、内部收益率(IRR)、领取金额、起领年龄",
  },
  {
    code: "E",
    name: "储蓄型",
    definition:
      "以资产增值为主要目的，兼具身故保障功能，其保额和现金价值会随时间复利增长。",
    features:
      "收益明确写入合同，安全稳定；后期可通过减保、保单贷款等方式灵活取用资金。",
    function:
      "实现长期强制储蓄、规划养老/教育金、资产隔离与财富传承，是家庭的“蓄水池”。",
    audience:
      "有长期闲置资金，追求资产安全稳健增值，有财富传承或长期规划需求的家庭。",
    selectionPoints:
      "**现金价值增长速度**、回本时间、减保/保单贷款规则的灵活性、预定利率。",
    coreMetrics: "有效保额增长率、内部收益率(IRR)、现金价值、减保灵活性",
  },
  {
    code: "F",
    name: "定期寿险",
    definition:
      "在约定保障期限内，若被保险人身故或全残，保险公司给付保额；期满则合同终止。",
    features:
      "纯保障型产品，保费极低，杠杆超高，用小成本转移家庭支柱倒下的巨大风险。",
    function:
      "核心功能是“**留爱不留债**”，防止家庭因经济支柱倒下而陷入财务危机，保障家人生活。",
    audience: "家庭经济支柱，尤其是有房贷、车贷或子女抚养责任的成年人。",
    selectionPoints:
      "保额充足性（覆盖负债+未来开支）、**性价比**（费率）、健康告知宽松度、免责条款。",
    coreMetrics: "保额、保障期限、保费（性价比）、健康告知、免责条款",
  },
  {
    code: "G",
    name: "车险",
    definition:
      "为机动车辆在行驶过程中可能发生的意外事故、损失及相关责任提供保障。",
    features:
      "包含强制性的交强险和可选的商业险，保障范围覆盖车辆损失、第三者责任及车上人员安全。",
    function:
      "转移因交通事故导致的巨额赔偿风险和车辆维修费用，满足法定上路要求。",
    audience: "所有机动车车主。",
    selectionPoints:
      "商业险险种搭配（车损、三者、座位）、三者险保额、增值服务（道路救援）。",
    coreMetrics: "三者险保额、车损险保额、座位险保额、保费",
  },
];

export const MOCK_END_USERS: EndUser[] = [
  {
    id: "U001",
    name: "张伟",
    age: 32,
    city: "北京",
    monthlyIncome: 25000,
    familyMembers: "配偶, 子女(1)",
    familyMemberCount: 3,
    gaps: {
      accident: 1000000,
      medical: 3000000,
      criticalIllness: 500000,
      termLife: 2000000,
      annuity: 0,
      education: 500000,
    },
    submissionTime: "2024-05-20 10:30:00",
    channel: "微信小程序",
  },
  {
    id: "U002",
    name: "李娜",
    age: 28,
    city: "上海",
    monthlyIncome: 18000,
    familyMembers: "未婚",
    familyMemberCount: 1,
    gaps: {
      accident: 500000,
      medical: 1000000,
      criticalIllness: 300000,
      termLife: 0,
      annuity: 200000,
      education: 0,
    },
    submissionTime: "2024-05-21 14:15:00",
    channel: "APP",
  },
  {
    id: "U003",
    name: "王强",
    age: 40,
    city: "深圳",
    monthlyIncome: 45000,
    familyMembers: "配偶, 子女(2), 父母(2)",
    familyMemberCount: 6,
    gaps: {
      accident: 2000000,
      medical: 6000000,
      criticalIllness: 1000000,
      termLife: 5000000,
      annuity: 1000000,
      education: 2000000,
    },
    submissionTime: "2024-05-22 09:00:00",
    channel: "Web官网",
  },
  {
    id: "U004",
    name: "刘芳",
    age: 35,
    city: "成都",
    monthlyIncome: 12000,
    familyMembers: "配偶, 子女(1)",
    familyMemberCount: 3,
    gaps: {
      accident: 300000,
      medical: 2000000,
      criticalIllness: 200000,
      termLife: 500000,
      annuity: 0,
      education: 100000,
    },
    submissionTime: "2024-05-22 16:45:00",
    channel: "微信小程序",
  },
  {
    id: "U005",
    name: "陈明",
    age: 25,
    city: "杭州",
    monthlyIncome: 15000,
    familyMembers: "未婚",
    familyMemberCount: 1,
    gaps: {
      accident: 500000,
      medical: 4000000,
      criticalIllness: 300000,
      termLife: 0,
      annuity: 0,
      education: 0,
    },
    submissionTime: "2024-05-23 11:20:00",
    channel: "APP",
  },
  {
    id: "U006",
    name: "赵敏",
    age: 45,
    city: "广州",
    monthlyIncome: 30000,
    familyMembers: "配偶, 子女(1)",
    familyMemberCount: 3,
    gaps: {
      accident: 1000000,
      medical: 2000000,
      criticalIllness: 800000,
      termLife: 1000000,
      annuity: 5000000,
      education: 0,
    },
    submissionTime: "2024-05-24 13:10:00",
    channel: "Web官网",
  },
];

export const MOCK_CLAIMS_MATERIALS: ClaimsMaterial[] = [
  // ══════════════════════════════════════════════════
  // 一、身份与授权类（mat-1 ~ mat-7）
  // ══════════════════════════════════════════════════
  {
    id: "mat-1",
    name: "身份证正面",
    description:
      "被保险人或受益人的身份证正面照片，包含姓名、性别、民族、出生日期、住址、身份证号等信息。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          name: { type: "string", description: "姓名" },
          gender: { type: "string", description: "性别" },
          ethnicity: { type: "string", description: "民族" },
          birth_date: {
            type: "string",
            format: "date",
            description: "出生日期",
          },
          address: { type: "string", description: "住址" },
          id_number: { type: "string", description: "身份证号码" },
        },
        required: ["name", "id_number"],
      },
      null,
      2,
    ),
    aiAuditPrompt:
      "请从身份证正面提取姓名、性别、民族、出生日期、住址和身份证号码。校验要点：1）身份证号码必须为18位，校验最后一位校验码是否正确；2）比对姓名是否与保单上的被保险人/受益人一致；3）检查出生日期与身份证号中的出生日期编码是否一致。若有信息模糊无法识别，请标注具体字段。",
  },
  {
    id: "mat-2",
    name: "身份证反面",
    description: "被保险人或受益人的身份证反面照片，包含签发机关和有效期限。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          issuing_authority: { type: "string", description: "签发机关" },
          valid_from: {
            type: "string",
            format: "date",
            description: "有效期起始日期",
          },
          valid_until: {
            type: "string",
            description: '有效期截止日期（可能为"长期"）',
          },
        },
        required: ["valid_from", "valid_until"],
      },
      null,
      2,
    ),
    required: true,
    aiAuditPrompt:
      '请从身份证反面提取签发机关、有效期起始日期和截止日期。校验要点：1）有效期截止日期是否晚于事故发生日/就诊日期，若已过期则标记为"证件已过期"；2）若截止日期为"长期"则视为有效。',
  },
  {
    id: "mat-3",
    name: "驾驶证（含副页）",
    description:
      "机动车驾驶人的驾驶证正页及副页，用于交通事故理赔时核实驾驶资质。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          name: { type: "string", description: "姓名" },
          license_number: { type: "string", description: "驾驶证号码" },
          vehicle_class: { type: "string", description: "准驾车型" },
          valid_period: { type: "string", description: "有效期限" },
          issue_date: {
            type: "string",
            format: "date",
            description: "初次领证日期",
          },
          file_number: { type: "string", description: "档案编号" },
        },
        required: ["name", "license_number", "vehicle_class"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从驾驶证正页和副页提取姓名、驾驶证号、准驾车型、有效期限和初次领证日期。校验要点：1）驾驶证有效期是否覆盖事故发生日期；2）准驾车型是否与事故中驾驶的车辆类型匹配（如C1不能驾驶大型车辆）；3）是否存在扣分或违章记录标注。",
  },
  {
    id: "mat-4",
    name: "行驶证（含副页）",
    description: "机动车行驶证正页及副页，用于核实车辆信息和年检状态。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          plate_number: { type: "string", description: "号牌号码" },
          vehicle_type: { type: "string", description: "车辆类型" },
          owner: { type: "string", description: "所有人" },
          vin: { type: "string", description: "车辆识别代号（VIN）" },
          engine_number: { type: "string", description: "发动机号码" },
          register_date: {
            type: "string",
            format: "date",
            description: "注册日期",
          },
          inspection_valid_until: {
            type: "string",
            format: "date",
            description: "检验有效期至",
          },
        },
        required: ["plate_number", "vehicle_type", "owner"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从行驶证正页和副页提取号牌号码、车辆类型、所有人、VIN码、发动机号、注册日期和检验有效期。校验要点：1）检验有效期是否覆盖事故发生日期，若已过期则标记；2）车辆类型与驾驶证准驾车型是否匹配。",
  },
  {
    id: "mat-5",
    name: "委托授权书",
    description: "被保险人或受益人委托他人代为办理理赔的授权委托书。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          principal_name: { type: "string", description: "委托人姓名" },
          agent_name: { type: "string", description: "被委托人（代理人）姓名" },
          principal_id: { type: "string", description: "委托人身份证号" },
          agent_id: { type: "string", description: "被委托人身份证号" },
          scope: { type: "string", description: "委托事项/授权范围" },
          date: { type: "string", format: "date", description: "委托日期" },
          has_signature: { type: "boolean", description: "是否有委托人签名" },
          has_fingerprint: { type: "boolean", description: "是否有指纹确认" },
        },
        required: ["principal_name", "agent_name", "scope"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从委托授权书提取委托人姓名和身份证号、被委托人姓名和身份证号、委托事项范围和日期。校验要点：1）委托人是否为保单被保险人或受益人；2）授权范围是否明确覆盖理赔申请及领取赔款事项；3）是否有委托人亲笔签名或指纹确认；4）委托日期是否合理（不应早于事故日期）。",
  },
  {
    id: "mat-6",
    name: "银行卡（正反面）",
    description: "用于接收理赔款项的银行卡正反面照片。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          bank_name: { type: "string", description: "开户银行" },
          card_number: { type: "string", description: "银行卡号" },
          account_holder: { type: "string", description: "持卡人姓名" },
        },
        required: ["bank_name", "card_number", "account_holder"],
      },
      null,
      2,
    ),
    required: true,
    aiAuditPrompt:
      "请从银行卡照片提取开户银行名称、银行卡号和持卡人姓名。校验要点：1）持卡人姓名是否与被保险人或受益人一致（若有委托授权书则应与被委托人一致）；2）银行卡号格式是否合法（一般为16-19位数字）；3）确认银行卡号清晰可辨。",
  },
  {
    id: "mat-7",
    name: "户籍所在地证明",
    description:
      "户籍所在地派出所或社区出具的户籍证明，用于确认城镇/农村户籍性质以适用不同赔偿标准。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          name: { type: "string", description: "姓名" },
          id_number: { type: "string", description: "身份证号" },
          household_address: { type: "string", description: "户籍地址" },
          household_type: {
            type: "string",
            description: "户籍性质（城镇/农村）",
          },
          issue_date: {
            type: "string",
            format: "date",
            description: "开具日期",
          },
          issuing_authority: { type: "string", description: "出具机关" },
        },
        required: ["name", "household_address", "household_type"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取户籍证明中的姓名、身份证号、户籍地址、户籍性质（城镇或农村）、开具日期和出具机关。校验要点：1）户籍性质直接影响残疾赔偿金和死亡赔偿金计算标准（城镇标准通常高于农村标准）；2）证明是否由户籍所在地公安派出所或社区出具并盖章。",
  },

  // ══════════════════════════════════════════════════
  // 二、事故认定类（mat-8 ~ mat-10）
  // ══════════════════════════════════════════════════
  {
    id: "mat-8",
    name: "交通事故责任认定书",
    description: "交警部门出具的交通事故责任认定文书，明确各方事故责任比例。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          document_number: { type: "string", description: "文书编号" },
          accident_date: {
            type: "string",
            format: "date",
            description: "事故发生日期",
          },
          accident_time: { type: "string", description: "事故发生时间" },
          accident_location: { type: "string", description: "事故发生地点" },
          parties: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "当事人姓名" },
                vehicle_info: { type: "string", description: "车辆信息" },
                responsibility: {
                  type: "string",
                  description: "责任认定（全责/主责/同责/次责/无责）",
                },
              },
            },
            description: "当事人及责任划分",
          },
          accident_summary: { type: "string", description: "事故经过摘要" },
          issuing_authority: { type: "string", description: "出具机关" },
        },
        required: ["accident_date", "accident_location", "parties"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从交通事故责任认定书中提取文书编号、事故日期时间、地点、各方当事人信息和责任划分、事故经过摘要。校验要点：1）明确各方责任比例（全责100%、主责70%、同责50%、次责30%、无责0%）；2）事故日期应在保险有效期内；3）被保险人在事故中的角色和责任。",
  },
  {
    id: "mat-9",
    name: "认定工伤决定书",
    description: "人力资源和社会保障局出具的工伤认定决定书，确认工伤事实。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          decision_number: { type: "string", description: "决定书编号" },
          employee_name: { type: "string", description: "职工姓名" },
          employer: { type: "string", description: "用人单位" },
          injury_date: {
            type: "string",
            format: "date",
            description: "受伤日期",
          },
          injury_description: { type: "string", description: "受伤经过及诊断" },
          work_injury_conclusion: {
            type: "string",
            description: "工伤认定结论",
          },
          decision_date: {
            type: "string",
            format: "date",
            description: "决定日期",
          },
          issuing_authority: { type: "string", description: "出具机关" },
        },
        required: [
          "employee_name",
          "employer",
          "injury_date",
          "work_injury_conclusion",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      '请从认定工伤决定书中提取决定书编号、职工姓名、用人单位、受伤日期、受伤经过及诊断、工伤认定结论和决定日期。校验要点：1）确认工伤认定结论为"认定为工伤"或"视同工伤"；2）受伤日期与就诊日期逻辑一致；3）确认出具机关为人力资源和社会保障局。',
  },
  {
    id: "mat-10",
    name: "工伤认定申请表",
    description: "申请人向人社部门提交的工伤认定申请表格。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          applicant_name: { type: "string", description: "申请人姓名" },
          employer: { type: "string", description: "用人单位名称" },
          injury_date: {
            type: "string",
            format: "date",
            description: "事故伤害日期",
          },
          injury_cause: { type: "string", description: "事故伤害原因" },
          injury_description: { type: "string", description: "受伤害经过简述" },
          application_date: {
            type: "string",
            format: "date",
            description: "申请日期",
          },
        },
        required: ["applicant_name", "employer", "injury_date"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从工伤认定申请表中提取申请人姓名、用人单位、事故伤害日期、伤害原因、受伤经过简述和申请日期。校验要点：1）申请人信息与认定工伤决定书中的职工信息应一致；2）事故日期和伤害经过描述应与工伤决定书吻合。",
  },

  // ══════════════════════════════════════════════════
  // 三、医疗类（mat-11 ~ mat-19）
  // ══════════════════════════════════════════════════
  {
    id: "mat-11",
    name: "门（急）诊病历",
    description: "医院门诊或急诊的就诊病历记录，包含主诉、诊断和治疗方案。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          department: { type: "string", description: "就诊科室" },
          visit_date: {
            type: "string",
            format: "date",
            description: "就诊日期",
          },
          patient_name: { type: "string", description: "患者姓名" },
          chief_complaint: { type: "string", description: "主诉" },
          present_illness: { type: "string", description: "现病史" },
          diagnosis: { type: "string", description: "诊断" },
          treatment: { type: "string", description: "处理/治疗方案" },
          doctor_name: { type: "string", description: "医生姓名" },
        },
        required: ["hospital_name", "visit_date", "diagnosis"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从门（急）诊病历中提取医院名称、就诊科室、就诊日期、患者姓名、主诉、现病史、诊断结果、治疗方案和医生姓名。校验要点：1）就诊日期与事故发生日期的时间逻辑是否合理（应在事故发生后）；2）诊断结果与事故伤情是否存在因果关系；3）治疗方案是否与诊断匹配。",
  },
  {
    id: "mat-12",
    name: "住院病历/病案",
    description: "完整的住院病历资料，包含入院记录、病程记录、出院小结等。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          admission_date: {
            type: "string",
            format: "date",
            description: "入院日期",
          },
          discharge_date: {
            type: "string",
            format: "date",
            description: "出院日期",
          },
          hospital_days: { type: "number", description: "住院天数" },
          admission_diagnosis: { type: "string", description: "入院诊断" },
          discharge_diagnosis: { type: "string", description: "出院诊断" },
          treatment_summary: { type: "string", description: "治疗经过摘要" },
          discharge_instructions: { type: "string", description: "出院医嘱" },
        },
        required: [
          "hospital_name",
          "admission_date",
          "discharge_date",
          "discharge_diagnosis",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从住院病历中提取医院名称、患者姓名、入院日期、出院日期、住院天数、入院诊断、出院诊断、治疗经过和出院医嘱。校验要点：1）住院天数计算是否正确（出院日期-入院日期）；2）入院诊断与出院诊断是否一致或有合理变化；3）治疗经过与诊断是否匹配。",
  },
  {
    id: "mat-13",
    name: "诊断证明书",
    description: "医院出具的正式诊断证明文件，是理赔审核的核心医疗材料。",
    sampleUrl: "https://pic1.imgdb.cn/item/69313be6a11464095f8a12dd.jpg",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          diagnosis: { type: "string", description: "诊断结果" },
          diagnosis_date: {
            type: "string",
            format: "date",
            description: "诊断日期",
          },
          doctor_name: { type: "string", description: "诊断医生" },
          treatment_advice: { type: "string", description: "治疗建议" },
          rest_days: { type: "number", description: "建议休息天数" },
          has_hospital_seal: { type: "boolean", description: "是否有医院公章" },
        },
        required: ["hospital_name", "diagnosis", "diagnosis_date"],
      },
      null,
      2,
    ),
    required: true,
    aiAuditPrompt:
      "请从诊断证明书中提取医院名称、患者姓名、诊断结果、诊断日期、诊断医生、治疗建议和建议休息天数。校验要点：1）诊断结果与事故伤情是否存在因果关系；2）医院是否为二级及以上医疗机构；3）是否有医院诊断专用章；4）建议休息天数与伤情严重程度是否匹配。若信息缺失，请指出具体缺失项。",
  },
  {
    id: "mat-14",
    name: "转院证明",
    description: "原医院出具的同意转院治疗的证明文件。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          patient_name: { type: "string", description: "患者姓名" },
          original_hospital: { type: "string", description: "转出医院" },
          receiving_hospital: { type: "string", description: "转入医院" },
          transfer_date: {
            type: "string",
            format: "date",
            description: "转院日期",
          },
          transfer_reason: { type: "string", description: "转院原因" },
        },
        required: [
          "original_hospital",
          "receiving_hospital",
          "transfer_date",
          "transfer_reason",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取转院证明中的患者姓名、转出医院、转入医院、转院日期和转院原因。校验要点：1）转院原因是否合理（如原医院不具备治疗条件）；2）转出和转入医院是否均为正规医疗机构；3）转院日期与住院记录是否衔接。",
  },
  {
    id: "mat-15",
    name: "医嘱休息证明（病假单）",
    description: "医生出具的建议患者休息的证明文件，用于计算误工天数。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          diagnosis: { type: "string", description: "诊断" },
          rest_start_date: {
            type: "string",
            format: "date",
            description: "休息起始日期",
          },
          rest_end_date: {
            type: "string",
            format: "date",
            description: "休息截止日期",
          },
          rest_days: { type: "number", description: "建议休息天数" },
          doctor_name: { type: "string", description: "医生姓名" },
        },
        required: ["hospital_name", "patient_name", "rest_days"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取医嘱休息证明中的医院名称、患者姓名、诊断、休息起止日期和休息天数。校验要点：1）建休天数是否与伤情严重程度匹配（轻微伤一般不超过15天，骨折通常3-6个月）；2）休息期与住院期是否有重叠（住院期间已包含在误工期内）；3）是否有医生签名和医院盖章。",
  },
  {
    id: "mat-16",
    name: "医嘱护理证明",
    description: "医院出具的患者需要护理的医嘱证明，用于计算护理费。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          nursing_level: {
            type: "string",
            description: "护理等级（特级/一级/二级/三级）",
          },
          nursing_period_start: {
            type: "string",
            format: "date",
            description: "护理期开始日期",
          },
          nursing_period_end: {
            type: "string",
            format: "date",
            description: "护理期结束日期",
          },
          nursing_persons: { type: "number", description: "护理人数" },
          doctor_name: { type: "string", description: "医生姓名" },
        },
        required: [
          "hospital_name",
          "patient_name",
          "nursing_level",
          "nursing_persons",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取医嘱护理证明中的医院名称、患者姓名、护理等级、护理期限和护理人数。校验要点：1）护理等级与伤情严重程度是否匹配；2）护理人数一般为1人，2人护理需要特殊医嘱说明；3）护理期限是否合理。",
  },
  {
    id: "mat-17",
    name: "营养费医嘱",
    description: "医生出具的患者需要加强营养的医嘱证明，用于计算营养费。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          nutrition_period_start: {
            type: "string",
            format: "date",
            description: "营养期开始日期",
          },
          nutrition_period_end: {
            type: "string",
            format: "date",
            description: "营养期结束日期",
          },
          nutrition_days: { type: "number", description: "营养期天数" },
          doctor_name: { type: "string", description: "医生姓名" },
        },
        required: ["hospital_name", "patient_name", "nutrition_days"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取营养费医嘱中的医院名称、患者姓名、营养期限和天数。校验要点：1）营养期天数是否有医嘱明确支持；2）营养期限与住院/恢复期是否合理衔接；3）是否有医生签名。",
  },
  {
    id: "mat-18",
    name: "住院天数证明",
    description:
      "医院出具的住院天数证明文件，用于核实住院期间的各项费用计算基础。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          admission_date: {
            type: "string",
            format: "date",
            description: "入院日期",
          },
          discharge_date: {
            type: "string",
            format: "date",
            description: "出院日期",
          },
          total_days: { type: "number", description: "住院总天数" },
          department: { type: "string", description: "住院科室" },
        },
        required: [
          "hospital_name",
          "patient_name",
          "admission_date",
          "discharge_date",
          "total_days",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取住院天数证明中的医院名称、患者姓名、入院日期、出院日期、住院总天数和科室。校验要点：1）住院天数计算是否正确（出院日期-入院日期）；2）与住院病历中的入院和出院日期是否一致。",
  },
  {
    id: "mat-19",
    name: "外购药处方笺",
    description: "医生开具的需要到院外药房购买药品的处方笺。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "开方医院" },
          patient_name: { type: "string", description: "患者姓名" },
          drug_name: { type: "string", description: "药品名称" },
          dosage: { type: "string", description: "用法用量" },
          quantity: { type: "string", description: "数量" },
          prescribing_doctor: { type: "string", description: "处方医生" },
          prescription_date: {
            type: "string",
            format: "date",
            description: "处方日期",
          },
        },
        required: [
          "hospital_name",
          "patient_name",
          "drug_name",
          "prescribing_doctor",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取外购药处方笺中的开方医院、患者姓名、药品名称、用法用量、数量、处方医生和处方日期。校验要点：1）外购药品是否与诊断结果相关；2）处方是否由主治医师开具；3）处方日期是否在治疗期间内；4）与购药发票中的药品名称和数量是否一致。",
  },

  // ══════════════════════════════════════════════════
  // 四、费用票据类（mat-20 ~ mat-28）
  // ══════════════════════════════════════════════════
  {
    id: "mat-20",
    name: "医疗费发票",
    description:
      "医院出具的医疗费用发票（门诊或住院发票），是理赔金额核定的主要依据。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          invoice_number: { type: "string", description: "发票号码" },
          invoice_code: { type: "string", description: "发票代码" },
          invoice_date: {
            type: "string",
            format: "date",
            description: "开票日期",
          },
          total_amount: { type: "number", description: "金额合计" },
          self_paid: { type: "number", description: "个人自付金额" },
          insurance_paid: { type: "number", description: "医保统筹支付" },
          personal_account: { type: "number", description: "个人账户支付" },
        },
        required: ["hospital_name", "invoice_number", "total_amount"],
      },
      null,
      2,
    ),
    required: true,
    aiAuditPrompt:
      "请从医疗费发票中提取医院名称、患者姓名、发票号码、发票代码、开票日期、金额合计、个人自付、医保统筹支付和个人账户支付。校验要点：1）各项金额相加是否等于合计金额；2）发票日期是否在就诊期间内；3）发票是否为正规财政票据或税务发票；4）与费用明细清单中的总金额是否一致。",
  },
  {
    id: "mat-21",
    name: "费用明细清单",
    description: "医院出具的住院/门诊费用逐项明细清单。",
    sampleUrl: "https://pic1.imgdb.cn/item/69313be5a11464095f8a12d8.jpg",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hospital_name: { type: "string", description: "医院名称" },
          patient_name: { type: "string", description: "患者姓名" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_name: { type: "string", description: "项目名称" },
                category: { type: "string", description: "费用类别" },
                quantity: { type: "number", description: "数量" },
                unit_price: { type: "number", description: "单价" },
                total_price: { type: "number", description: "金额" },
              },
            },
            description: "费用明细项目列表",
          },
          total_amount: { type: "number", description: "费用总额" },
        },
        required: ["hospital_name", "items", "total_amount"],
      },
      null,
      2,
    ),
    required: true,
    aiAuditPrompt:
      "请从费用明细清单中提取医院名称、患者姓名、所有费用明细项（项目名称、类别、数量、单价、金额）和费用总额。校验要点：1）各项费用金额=单价×数量；2）所有项目金额之和是否等于总额；3）与医疗费发票的总金额是否一致；4）是否存在异常高价项目。",
  },
  {
    id: "mat-22",
    name: "购药发票",
    description: "在院外药房购买药品的购药发票。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          pharmacy_name: { type: "string", description: "药房名称" },
          invoice_number: { type: "string", description: "发票号码" },
          invoice_date: {
            type: "string",
            format: "date",
            description: "购药日期",
          },
          drug_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                drug_name: { type: "string", description: "药品名称" },
                quantity: { type: "number", description: "数量" },
                unit_price: { type: "number", description: "单价" },
                amount: { type: "number", description: "金额" },
              },
            },
            description: "购药明细",
          },
          total_amount: { type: "number", description: "合计金额" },
        },
        required: ["pharmacy_name", "invoice_number", "total_amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从购药发票中提取药房名称、发票号码、购药日期、药品明细（名称、数量、单价、金额）和合计金额。校验要点：1）购买的药品是否与外购药处方笺中开具的药品一致；2）药品数量是否与处方匹配；3）购药日期是否在治疗期间内；4）药房是否为正规药店。",
  },
  {
    id: "mat-23",
    name: "辅助器具发票",
    description: "购买残疾辅助器具（如轮椅、拐杖、假肢等）的发票。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          seller_name: { type: "string", description: "销售商名称" },
          invoice_number: { type: "string", description: "发票号码" },
          invoice_date: {
            type: "string",
            format: "date",
            description: "购买日期",
          },
          item_name: { type: "string", description: "器具名称" },
          specification: { type: "string", description: "规格型号" },
          quantity: { type: "number", description: "数量" },
          unit_price: { type: "number", description: "单价" },
          total_amount: { type: "number", description: "合计金额" },
        },
        required: ["seller_name", "item_name", "total_amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从辅助器具发票中提取销售商名称、发票号码、器具名称、规格型号、数量、单价和合计金额。校验要点：1）器具类型是否与伤残等级和伤情匹配（如截肢才需要假肢）；2）价格是否在当地辅助器具配制机构的标准范围内；3）是否有残疾辅助器具证明或医嘱支持。",
  },
  {
    id: "mat-24",
    name: "护理费发票",
    description: "聘请护工或护理机构的护理费用发票。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          nursing_institution: {
            type: "string",
            description: "护理机构/护工姓名",
          },
          invoice_number: { type: "string", description: "发票号码" },
          invoice_date: {
            type: "string",
            format: "date",
            description: "发票日期",
          },
          nursing_period_start: {
            type: "string",
            format: "date",
            description: "护理起始日期",
          },
          nursing_period_end: {
            type: "string",
            format: "date",
            description: "护理结束日期",
          },
          nursing_days: { type: "number", description: "护理天数" },
          daily_rate: { type: "number", description: "日费率" },
          total_amount: { type: "number", description: "合计金额" },
        },
        required: ["nursing_institution", "nursing_days", "total_amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从护理费发票中提取护理机构/护工信息、发票号码、护理起止日期、护理天数、日费率和合计金额。校验要点：1）护理天数是否与医嘱护理证明中的护理期限一致；2）日费率是否在当地护理行业合理范围内；3）金额=天数×日费率的计算是否正确。",
  },
  {
    id: "mat-25",
    name: "交通费票据",
    description: "因就医产生的交通费用票据（出租车票、公交票、火车票等）。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          transport_type: {
            type: "string",
            description: "交通方式（出租车/公交/地铁/火车/飞机等）",
          },
          departure: { type: "string", description: "出发地" },
          destination: { type: "string", description: "目的地" },
          date: { type: "string", format: "date", description: "乘车日期" },
          amount: { type: "number", description: "金额" },
          ticket_number: { type: "string", description: "票号" },
        },
        required: ["transport_type", "date", "amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从交通费票据中提取交通方式、出发地、目的地、日期、金额和票号。校验要点：1）交通日期是否在就医期间内（与诊断证明、住院病历日期对应）；2）出发地或目的地是否与就诊医院所在地一致；3）交通方式是否合理（一般应选择经济便捷方式，特殊情况如伤情严重可乘坐出租车/飞机）。",
  },
  {
    id: "mat-26",
    name: "住宿费发票",
    description: "因异地就医产生的住宿费用发票。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          hotel_name: { type: "string", description: "住宿单位名称" },
          invoice_number: { type: "string", description: "发票号码" },
          check_in_date: {
            type: "string",
            format: "date",
            description: "入住日期",
          },
          check_out_date: {
            type: "string",
            format: "date",
            description: "退房日期",
          },
          days: { type: "number", description: "住宿天数" },
          daily_rate: { type: "number", description: "日房价" },
          total_amount: { type: "number", description: "合计金额" },
        },
        required: ["hotel_name", "days", "total_amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从住宿费发票中提取住宿单位名称、发票号码、入住退房日期、天数、日房价和合计金额。校验要点：1）住宿日期是否与就医日期匹配（应为异地就医期间）；2）住宿地点是否在就诊医院附近；3）日房价是否在当地合理标准内（一般参照当地国家机关一般工作人员出差住宿标准）。",
  },
  {
    id: "mat-27",
    name: "鉴定费发票",
    description: "进行伤残鉴定、劳动能力鉴定等产生的鉴定费发票。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          institution_name: { type: "string", description: "鉴定机构名称" },
          invoice_number: { type: "string", description: "发票号码" },
          invoice_date: {
            type: "string",
            format: "date",
            description: "发票日期",
          },
          appraisal_type: {
            type: "string",
            description: "鉴定类型（伤残鉴定/劳动能力鉴定/护理依赖鉴定等）",
          },
          total_amount: { type: "number", description: "鉴定费金额" },
        },
        required: ["institution_name", "appraisal_type", "total_amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从鉴定费发票中提取鉴定机构名称、发票号码、日期、鉴定类型和金额。校验要点：1）鉴定机构是否具有法定资质；2）鉴定费用是否在当地收费标准范围内；3）鉴定类型与案件所需鉴定项目是否匹配。",
  },
  {
    id: "mat-28",
    name: "丧葬费票据",
    description: "死亡案件中产生的丧葬服务费用票据。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          service_provider: { type: "string", description: "殡葬服务单位" },
          invoice_number: { type: "string", description: "发票号码" },
          invoice_date: {
            type: "string",
            format: "date",
            description: "发票日期",
          },
          service_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_name: { type: "string", description: "服务项目" },
                amount: { type: "number", description: "金额" },
              },
            },
            description: "丧葬服务明细",
          },
          total_amount: { type: "number", description: "合计金额" },
        },
        required: ["service_provider", "total_amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从丧葬费票据中提取殡葬服务单位、发票信息、服务项目明细和合计金额。校验要点：1）丧葬费法定标准为受诉法院所在地上一年度职工月平均工资×6个月，实际费用仅作参考；2）服务项目是否合理（基本丧葬服务）。",
  },

  // ══════════════════════════════════════════════════
  // 五、收入与误工类（mat-29 ~ mat-34）
  // ══════════════════════════════════════════════════
  {
    id: "mat-29",
    name: "误工证明",
    description: "用人单位出具的因伤误工及收入减少情况的证明。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          employer_name: { type: "string", description: "用人单位名称" },
          employee_name: { type: "string", description: "员工姓名" },
          position: { type: "string", description: "职务/岗位" },
          absence_start_date: {
            type: "string",
            format: "date",
            description: "误工起始日期",
          },
          absence_end_date: {
            type: "string",
            format: "date",
            description: "误工截止日期",
          },
          absence_days: { type: "number", description: "误工天数" },
          salary_deduction: { type: "number", description: "扣发工资金额" },
          has_employer_seal: { type: "boolean", description: "是否有单位公章" },
        },
        required: ["employer_name", "employee_name", "absence_days"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从误工证明中提取用人单位名称、员工姓名、职务、误工起止日期、误工天数和扣发工资金额。校验要点：1）误工期是否与医嘱建休期匹配（误工期不超过建休期+住院期）；2）是否有用人单位公章；3）扣发工资金额是否与收入证明中的收入水平一致。",
  },
  {
    id: "mat-30",
    name: "收入证明/工资证明",
    description: "用人单位出具的工资收入证明，用于计算误工费赔偿基数。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          employer_name: { type: "string", description: "用人单位名称" },
          employee_name: { type: "string", description: "员工姓名" },
          position: { type: "string", description: "职务/岗位" },
          monthly_salary: { type: "number", description: "月工资收入" },
          annual_income: { type: "number", description: "年收入" },
          employment_date: {
            type: "string",
            format: "date",
            description: "入职日期",
          },
          has_employer_seal: { type: "boolean", description: "是否有单位公章" },
        },
        required: ["employer_name", "employee_name", "monthly_salary"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从收入证明中提取用人单位、员工姓名、职务、月工资和年收入。校验要点：1）月收入水平是否与行业及地区平均水平大致匹配，过高需要银行流水和纳税证明佐证；2）年收入是否约等于月工资×12；3）是否有用人单位公章。",
  },
  {
    id: "mat-31",
    name: "劳动合同",
    description: "劳动者与用人单位签订的劳动合同，证明劳动关系。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          employer_name: { type: "string", description: "用人单位名称" },
          employee_name: { type: "string", description: "劳动者姓名" },
          contract_start_date: {
            type: "string",
            format: "date",
            description: "合同起始日期",
          },
          contract_end_date: {
            type: "string",
            format: "date",
            description: "合同终止日期",
          },
          position: { type: "string", description: "工作岗位" },
          salary: { type: "number", description: "劳动报酬（月薪）" },
          contract_type: {
            type: "string",
            description:
              "合同类型（固定期限/无固定期限/以完成一定工作任务为期限）",
          },
        },
        required: ["employer_name", "employee_name", "contract_start_date"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从劳动合同中提取用人单位、劳动者姓名、合同期限、工作岗位、劳动报酬和合同类型。校验要点：1）合同有效期是否覆盖事故发生日期（证明事故时存在劳动关系）；2）合同中约定的工资是否与收入证明一致；3）用人单位是否与误工证明中的单位一致。",
  },
  {
    id: "mat-32",
    name: "工资银行流水",
    description: "银行打印的工资入账记录流水，用于佐证实际收入水平。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          account_holder: { type: "string", description: "账户持有人" },
          bank_name: { type: "string", description: "开户银行" },
          period_start: {
            type: "string",
            format: "date",
            description: "流水起始日期",
          },
          period_end: {
            type: "string",
            format: "date",
            description: "流水截止日期",
          },
          monthly_entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  format: "date",
                  description: "交易日期",
                },
                description: { type: "string", description: "摘要/交易对方" },
                amount: { type: "number", description: "金额" },
              },
            },
            description: "工资入账明细",
          },
          average_monthly_income: {
            type: "number",
            description: "月均工资收入",
          },
        },
        required: ["account_holder", "bank_name", "average_monthly_income"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从工资银行流水中提取账户持有人、开户银行、流水期间和每月工资入账记录。校验要点：1）工资入账记录是否来自与误工证明、劳动合同中一致的用人单位；2）月均工资是否与收入证明中声称的月薪大致一致；3）事故后是否出现工资减少或停发情况（佐证误工损失）。",
  },
  {
    id: "mat-33",
    name: "纳税证明",
    description: "税务机关出具的个人所得税纳税证明或完税凭证。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          taxpayer_name: { type: "string", description: "纳税人姓名" },
          id_number: { type: "string", description: "身份证号" },
          tax_period_start: {
            type: "string",
            format: "date",
            description: "纳税期间起",
          },
          tax_period_end: {
            type: "string",
            format: "date",
            description: "纳税期间止",
          },
          total_income: { type: "number", description: "收入总额" },
          total_tax: { type: "number", description: "已缴税额" },
          issuing_authority: { type: "string", description: "出具机关" },
        },
        required: ["taxpayer_name", "total_income", "total_tax"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从纳税证明中提取纳税人姓名、身份证号、纳税期间、收入总额、已缴税额和出具机关。校验要点：1）纳税记录中的收入水平是否与收入证明、银行流水一致；2）纳税期间是否覆盖事故前的连续收入时段；3）通过税额反推的税前收入是否与声称的月薪匹配。",
  },
  {
    id: "mat-34",
    name: "护理人员收入证明",
    description:
      "护理人员（非专业护工）所在单位出具的收入证明，用于计算护理费中的误工损失。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          employer_name: { type: "string", description: "用人单位名称" },
          employee_name: { type: "string", description: "护理人员姓名" },
          position: { type: "string", description: "职务/岗位" },
          monthly_salary: { type: "number", description: "月工资收入" },
          has_employer_seal: { type: "boolean", description: "是否有单位公章" },
          issue_date: {
            type: "string",
            format: "date",
            description: "开具日期",
          },
        },
        required: ["employer_name", "employee_name", "monthly_salary"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从护理人员收入证明中提取单位名称、护理人员姓名、职务和月收入。校验要点：1）护理人员是否为被保险人的亲属或朋友（非专业护工）；2）月收入水平是否合理；3）护理天数对应的误工损失=月收入÷21.75×护理天数。",
  },

  // ══════════════════════════════════════════════════
  // 六、伤残与鉴定类（mat-35 ~ mat-38）
  // ══════════════════════════════════════════════════
  {
    id: "mat-35",
    name: "伤残鉴定意见书",
    description: "司法鉴定机构出具的人体伤残等级鉴定意见书。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          institution_name: { type: "string", description: "鉴定机构名称" },
          appraisal_number: { type: "string", description: "鉴定文书编号" },
          appraisal_date: {
            type: "string",
            format: "date",
            description: "鉴定日期",
          },
          subject_name: { type: "string", description: "被鉴定人姓名" },
          disability_grade: {
            type: "string",
            description: "伤残等级（一级~十级）",
          },
          injury_description: { type: "string", description: "伤情描述" },
          conclusions: { type: "string", description: "鉴定结论" },
          appraiser_names: { type: "string", description: "鉴定人" },
        },
        required: [
          "institution_name",
          "subject_name",
          "disability_grade",
          "conclusions",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从伤残鉴定意见书中提取鉴定机构、文书编号、鉴定日期、被鉴定人、伤残等级、伤情描述和鉴定结论。校验要点：1）鉴定机构是否具有司法鉴定资质（应在司法行政部门登记）；2）伤残等级与伤情描述是否匹配（如十级为最轻，一级为最重）；3）鉴定日期是否在伤情稳定后（一般出院后3-6个月）；4）伤残等级直接影响残疾赔偿金计算（十级=10%，九级=20%，依此类推）。",
  },
  {
    id: "mat-36",
    name: "劳动能力鉴定结论",
    description:
      "劳动能力鉴定委员会出具的劳动能力鉴定结论通知书，用于工伤案件。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          committee_name: { type: "string", description: "鉴定委员会名称" },
          conclusion_number: { type: "string", description: "鉴定结论编号" },
          subject_name: { type: "string", description: "被鉴定人姓名" },
          employer: { type: "string", description: "用人单位" },
          disability_level: { type: "string", description: "伤残等级" },
          nursing_dependency_level: {
            type: "string",
            description: "生活自理障碍等级",
          },
          conclusion_date: {
            type: "string",
            format: "date",
            description: "鉴定日期",
          },
        },
        required: ["committee_name", "subject_name", "disability_level"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从劳动能力鉴定结论中提取鉴定委员会、被鉴定人、用人单位、伤残等级、生活自理障碍等级和鉴定日期。校验要点：1）鉴定结论是否由设区的市级以上劳动能力鉴定委员会出具；2）与认定工伤决定书中的人员信息是否一致；3）伤残等级是否合理。",
  },
  {
    id: "mat-37",
    name: "残疾辅助器具证明",
    description: "辅助器具配制机构出具的残疾人需要配置辅助器具的证明。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          institution_name: { type: "string", description: "配制机构名称" },
          subject_name: { type: "string", description: "申请人姓名" },
          device_type: {
            type: "string",
            description: "器具类型（假肢/矫形器/轮椅/助听器等）",
          },
          device_specification: { type: "string", description: "器具规格型号" },
          replacement_cycle: { type: "string", description: "更换周期" },
          price_limit: { type: "number", description: "价格限额" },
          issue_date: {
            type: "string",
            format: "date",
            description: "出具日期",
          },
        },
        required: ["institution_name", "subject_name", "device_type"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从残疾辅助器具证明中提取配制机构、申请人、器具类型、规格、更换周期和价格限额。校验要点：1）器具类型是否与伤残情况匹配；2）配制机构是否具有相应资质；3）价格限额是否在国产普及型标准范围内；4）更换周期对于计算后续费用很重要。",
  },
  {
    id: "mat-38",
    name: "护理依赖鉴定",
    description: "对需要长期护理的伤残人员进行的护理依赖程度鉴定。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          institution_name: { type: "string", description: "鉴定机构名称" },
          subject_name: { type: "string", description: "被鉴定人姓名" },
          nursing_dependency_level: {
            type: "string",
            description: "护理依赖等级（完全/大部分/部分护理依赖）",
          },
          evaluation_date: {
            type: "string",
            format: "date",
            description: "评定日期",
          },
          daily_activities_assessment: {
            type: "string",
            description: "日常生活能力评估",
          },
          conclusions: { type: "string", description: "鉴定结论" },
        },
        required: [
          "institution_name",
          "subject_name",
          "nursing_dependency_level",
        ],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从护理依赖鉴定中提取鉴定机构、被鉴定人、护理依赖等级、评定日期和日常生活能力评估结论。校验要点：1）护理依赖等级分为完全（100%）、大部分（80%）和部分（50%）三级；2）鉴定机构是否有资质；3）等级认定与后续护理费计算标准直接相关。",
  },

  // ══════════════════════════════════════════════════
  // 七、居住与扶养类（mat-39 ~ mat-42）
  // ══════════════════════════════════════════════════
  {
    id: "mat-39",
    name: "居住证明/暂住证",
    description:
      "证明被害人在城镇地区连续居住满一年以上的居住证明或暂住证，用于适用城镇标准计算赔偿。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          name: { type: "string", description: "姓名" },
          id_number: { type: "string", description: "身份证号" },
          residence_address: { type: "string", description: "居住地址" },
          residence_type: { type: "string", description: "居住证类型" },
          valid_from: {
            type: "string",
            format: "date",
            description: "有效期起始",
          },
          valid_until: {
            type: "string",
            format: "date",
            description: "有效期截止",
          },
          issuing_authority: { type: "string", description: "发证机关" },
        },
        required: ["name", "residence_address"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取居住证明中的姓名、身份证号、居住地址、有效期限和发证机关。校验要点：1）是否在城镇连续居住满一年以上（可结合居住证有效期判断）；2）如果户籍为农村但在城镇居住满一年且有固定收入，可适用城镇标准计算赔偿金；3）居住证是否在有效期内。",
  },
  {
    id: "mat-40",
    name: "被扶养人身份证明",
    description: "被扶养人的身份证、户口本或出生证明等身份证明文件。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          dependent_name: { type: "string", description: "被扶养人姓名" },
          gender: { type: "string", description: "性别" },
          birth_date: {
            type: "string",
            format: "date",
            description: "出生日期",
          },
          id_number: { type: "string", description: "身份证号" },
          relationship_to_victim: {
            type: "string",
            description: "与受害人关系",
          },
          dependent_type: {
            type: "string",
            description: "被扶养人类型（未成年子女/无劳动能力配偶/年迈父母等）",
          },
        },
        required: ["dependent_name", "birth_date", "relationship_to_victim"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取被扶养人身份证明中的姓名、性别、出生日期、身份证号、与受害人关系和被扶养人类型。校验要点：1）未成年人扶养至18周岁（扶养年限=18-现年龄）；2）无劳动能力又无其他生活来源的成年人扶养20年，60周岁以上每增加一岁减少一年，75周岁以上为5年；3）多个被扶养人的年赔偿总额不超过上一年度城镇/农村居民人均消费支出。",
  },
  {
    id: "mat-41",
    name: "扶养关系证明",
    description: "村委会、居委会或民政部门出具的扶养关系证明。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          supporter_name: {
            type: "string",
            description: "扶养人（受害人）姓名",
          },
          dependent_name: { type: "string", description: "被扶养人姓名" },
          relationship: { type: "string", description: "扶养关系" },
          other_supporters_count: {
            type: "number",
            description: "其他扶养义务人数",
          },
          issuing_authority: { type: "string", description: "出具机关" },
          issue_date: {
            type: "string",
            format: "date",
            description: "开具日期",
          },
        },
        required: ["supporter_name", "dependent_name", "relationship"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取扶养关系证明中的扶养人、被扶养人、扶养关系、其他扶养义务人数和出具机关。校验要点：1）确认扶养关系真实性（如父母子女关系、配偶关系）；2）其他共同扶养义务人数直接影响赔偿金分摊（被扶养人生活费÷共同扶养人数）；3）出具机关是否为户籍所在地村委会/居委会或民政部门。",
  },
  {
    id: "mat-42",
    name: "被扶养人无收入证明",
    description: "证明被扶养人确无劳动能力和收入来源的证明文件。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          dependent_name: { type: "string", description: "被扶养人姓名" },
          id_number: { type: "string", description: "身份证号" },
          has_income: {
            type: "boolean",
            description: "是否有收入（应为false）",
          },
          reason_no_income: {
            type: "string",
            description: "无收入原因（残疾/年幼/年迈等）",
          },
          issuing_authority: { type: "string", description: "出具机关" },
          issue_date: {
            type: "string",
            format: "date",
            description: "开具日期",
          },
        },
        required: ["dependent_name", "reason_no_income"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请提取被扶养人无收入证明中的被扶养人姓名、身份证号、无收入原因和出具机关。校验要点：1）无收入原因是否合理（未成年、在校学生、残疾人、年迈丧失劳动能力等）；2）确认被扶养人确实丧失劳动能力或无其他生活来源；3）证明是否由相关部门或社区出具并盖章。",
  },

  // ══════════════════════════════════════════════════
  // 八、死亡相关类（mat-43 ~ mat-45）
  // ══════════════════════════════════════════════════
  {
    id: "mat-43",
    name: "死亡证明",
    description: "医院或公安机关出具的死亡医学证明书或死亡证明。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          deceased_name: { type: "string", description: "死者姓名" },
          id_number: { type: "string", description: "身份证号" },
          death_date: {
            type: "string",
            format: "date",
            description: "死亡日期",
          },
          death_cause: { type: "string", description: "死亡原因" },
          death_location: { type: "string", description: "死亡地点" },
          certifying_institution: { type: "string", description: "出具机构" },
        },
        required: ["deceased_name", "death_date", "death_cause"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从死亡证明中提取死者姓名、身份证号、死亡日期、死亡原因、死亡地点和出具机构。校验要点：1）死亡原因是否与事故存在因果关系（如交通事故致死、工伤致死）；2）死亡日期与事故日期的逻辑关系是否合理；3）出具机构应为医院或公安机关。",
  },
  {
    id: "mat-44",
    name: "户籍注销证明",
    description: "公安派出所出具的死者户籍已注销的证明文件。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          deceased_name: { type: "string", description: "死者姓名" },
          id_number: { type: "string", description: "身份证号" },
          cancellation_date: {
            type: "string",
            format: "date",
            description: "户籍注销日期",
          },
          issuing_authority: {
            type: "string",
            description: "出具机关（派出所）",
          },
        },
        required: ["deceased_name", "cancellation_date"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从户籍注销证明中提取死者姓名、身份证号、户籍注销日期和出具机关。校验要点：1）户籍注销日期应在死亡日期之后；2）姓名和身份证号与死亡证明一致；3）出具机关应为户籍所在地公安派出所。",
  },
  {
    id: "mat-45",
    name: "亲属关系证明",
    description: "公安、民政或社区出具的死者与理赔申请人之间亲属关系的证明。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          deceased_name: { type: "string", description: "死者姓名" },
          claimant_name: { type: "string", description: "申请人姓名" },
          relationship: {
            type: "string",
            description: "亲属关系（配偶/子女/父母等）",
          },
          issuing_authority: { type: "string", description: "出具机关" },
          issue_date: {
            type: "string",
            format: "date",
            description: "开具日期",
          },
        },
        required: ["deceased_name", "claimant_name", "relationship"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从亲属关系证明中提取死者姓名、申请人姓名、亲属关系、出具机关和开具日期。校验要点：1）确认申请人为法定赔偿权利人（配偶、父母、子女为第一顺序继承人）；2）亲属关系真实性由户籍所在地相关部门证明；3）若有多个权利人，需全部出具关系证明。",
  },

  // ══════════════════════════════════════════════════
  // 九、法律文书类（mat-46 ~ mat-47）
  // ══════════════════════════════════════════════════
  {
    id: "mat-46",
    name: "调解协议书/判决书",
    description:
      "交通事故调解协议、人民法院民事判决书或调解书，明确赔偿金额和各项分项。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          case_number: { type: "string", description: "案号/文书编号" },
          document_type: {
            type: "string",
            description: "文书类型（调解协议/民事判决书/民事调解书）",
          },
          parties: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: {
                  type: "string",
                  description: "当事人角色（原告/被告/申请人/被申请人）",
                },
                name: { type: "string", description: "姓名/名称" },
              },
            },
            description: "当事人信息",
          },
          agreement_date: {
            type: "string",
            format: "date",
            description: "协议/判决日期",
          },
          compensation_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item: { type: "string", description: "赔偿项目" },
                amount: { type: "number", description: "金额" },
              },
            },
            description: "赔偿明细",
          },
          total_compensation: { type: "number", description: "赔偿总额" },
          court_or_mediator: { type: "string", description: "法院/调解机构" },
        },
        required: ["document_type", "total_compensation"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从调解协议书或判决书中提取案号、文书类型、各方当事人、协议/判决日期、赔偿明细（各项赔偿项目及金额）和赔偿总额。校验要点：1）各项赔偿金额之和是否等于赔偿总额；2）赔偿项目是否完整（医疗费、误工费、护理费、残疾赔偿金等）；3）被保险人在案件中的角色及应承担的赔偿比例。",
  },
  {
    id: "mat-47",
    name: "律师费发票及合同",
    description: "聘请律师代理理赔案件的律师服务合同和律师费发票。",
    jsonSchema: JSON.stringify(
      {
        type: "object",
        properties: {
          law_firm_name: { type: "string", description: "律师事务所名称" },
          lawyer_name: { type: "string", description: "律师姓名" },
          contract_date: {
            type: "string",
            format: "date",
            description: "合同签订日期",
          },
          fee_type: {
            type: "string",
            description: "收费方式（固定/风险代理/计时等）",
          },
          fee_amount: { type: "number", description: "律师费金额" },
          invoice_number: { type: "string", description: "发票号码" },
          invoice_date: {
            type: "string",
            format: "date",
            description: "发票日期",
          },
        },
        required: ["law_firm_name", "fee_amount"],
      },
      null,
      2,
    ),
    required: false,
    aiAuditPrompt:
      "请从律师费发票及合同中提取律师事务所名称、律师姓名、合同日期、收费方式、律师费金额和发票信息。校验要点：1）律师费是否在当地律师收费指导价标准范围内；2）律师服务合同与发票金额是否一致；3）发票是否为正规律师事务所开具的增值税发票。",
  },
];

export const MOCK_CLAIM_ITEMS: ClaimItem[] = [
  {
    id: "item-1",
    name: "一般住院医疗理赔",
    description: "针对普通疾病住院产生的费用进行理赔。",
    materialIds: [
      "mat-1",
      "mat-2",
      "mat-6",
      "mat-12",
      "mat-13",
      "mat-20",
      "mat-21",
    ],
  },
  {
    id: "item-2",
    name: "意外伤残理赔",
    description: "针对因意外导致的伤残进行理赔。",
    materialIds: [
      "mat-1",
      "mat-2",
      "mat-6",
      "mat-8",
      "mat-13",
      "mat-20",
      "mat-21",
      "mat-35",
    ],
  },
];

export const MOCK_PRODUCT_CLAIM_CONFIGS: ProductClaimConfig[] = [
  {
    productCode: "ZA-001",
    responsibilityConfigs: [
      {
        responsibilityId: "resp-1",
        claimItemIds: ["item-1"],
      },
    ],
  },
];

export const MOCK_CLAIM_CASES: ClaimCase[] = [
  {
    id: "claim-1",
    reportNumber: "R202405010001",
    reporter: "张三",
    reportTime: "2024-05-01 10:00:00",
    accidentTime: "2024-04-28 15:30:00",
    accidentReason: "疾病住院",
    claimAmount: 5000.0,
    productCode: "ZA-001",
    productName: "尊享e生2024版",
    status: ClaimStatus.PROCESSING,
    operator: "李四",
  },
  {
    id: "claim-2",
    reportNumber: "R202405100005",
    reporter: "王五",
    reportTime: "2024-05-10 14:20:00",
    accidentTime: "2024-05-09 09:00:00",
    accidentReason: "意外摔伤",
    claimAmount: 1200.5,
    productCode: "ZA-002",
    productName: "小米综合意外险",
    status: ClaimStatus.REPORTED,
    operator: "赵六",
  },
  {
    id: "claim-3",
    reportNumber: "R202405150012",
    reporter: "陈七",
    reportTime: "2024-05-15 09:15:00",
    accidentTime: "2024-05-10 20:00:00",
    accidentReason: "急性阑尾炎",
    claimAmount: 8500.0,
    productCode: "ZA-001",
    productName: "尊享e生2024版",
    status: ClaimStatus.APPROVED,
    operator: "孙八",
  },
  {
    id: "claim-4",
    reportNumber: "R202405200020",
    reporter: "周九",
    reportTime: "2024-05-20 16:45:00",
    accidentTime: "2024-05-18 11:30:00",
    accidentReason: "交通事故",
    claimAmount: 25000.0,
    productCode: "ZA-003",
    productName: "百万医疗险2024",
    status: ClaimStatus.PENDING_INFO,
    operator: "吴十",
  },
  {
    id: "claim-detail-1",
    reportNumber: "CLAIM-2024-0421",
    reporter: "王芳",
    reportTime: "2024-01-02 09:24",
    accidentTime: "2024-01-01 15:15",
    accidentReason: "疾病住院",
    accidentLocation: "中国北京市朝阳区主街123号",
    claimAmount: 144.0,
    approvedAmount: 132.0,
    productCode: "ZA-001",
    productName: "尊享e生2024版",
    status: ClaimStatus.PROCESSING,
    operator: "系统管理员",
    policyholder: "张伟",
    insured: "李娜",
    policyPeriod: "2024年1月1日 - 2024年12月31日",
    policyNumber: "POL-2024-7890",
    calculationItems: [
      {
        id: "calc-1",
        type: "医疗费用",
        fileName: "发票1.jpg",
        date: "2025-1-1",
        item: "色甘酸钠",
        amount: 17,
        claimAmount: 17,
        basis: "乙类药，保险覆盖，100%报销",
      },
      {
        id: "calc-2",
        type: "医疗费用",
        fileName: "发票1.jpg",
        date: "2025-1-1",
        item: "急诊诊疗",
        amount: 25,
        claimAmount: 25,
        basis: "甲类药，保险覆盖，100%报销",
      },
      {
        id: "calc-3",
        type: "医疗费用",
        fileName: "发票1.jpg",
        date: "2025-1-1",
        item: "氯胆乳膏",
        amount: 30,
        claimAmount: 24,
        basis: "丙类药，不属保险范围，80%报销",
      },
      {
        id: "calc-4",
        type: "Medical",
        fileName: "Invoice 2.jpg",
        date: "2025-1-2",
        item: "Sodium Cromoglicate",
        amount: 17,
        claimAmount: 17,
        basis: "Class B, covered by insurance, 100% reimbursement",
      },
      {
        id: "calc-5",
        type: "Medical",
        fileName: "Invoice 2.jpg",
        date: "2025-1-2",
        item: "Emergency Consultation",
        amount: 25,
        claimAmount: 25,
        basis: "Class A, covered by insurance, 100% reimbursement",
      },
      {
        id: "calc-6",
        type: "Medical",
        fileName: "Invoice 2.jpg",
        date: "2025-1-2",
        item: "Hydroquinone Cream",
        amount: 30,
        claimAmount: 24,
        basis: "Class C, not covered by insurance, 80% reimbursement",
      },
    ],
    fileCategories: [
      {
        name: "医疗费用",
        files: [
          { name: "发票1.jpg", url: "#" },
          { name: "发票2.jpg", url: "#" },
          { name: "诊断证明.pdf", url: "#" },
        ],
      },
      { name: "伤残费用", files: [] },
      { name: "误工费", files: [{ name: "请假条.jpg", url: "#" }] },
    ],
    risks: [
      {
        type: "danger",
        title: "高欺诈概率",
        description: "基于图像分析，发票1.jpg显示可能被篡改的迹象。",
      },
      {
        type: "warning",
        title: "文件不完整",
        description: "雇主证明缺少公章。",
      },
    ],
  },
];

// --- START: Ruleset Management Constants ---
export const PRODUCT_LINE_LABELS: Record<string, string> = {
  [RulesetProductLine.ACCIDENT]: "意外险",
  [RulesetProductLine.HEALTH]: "医疗险",
  [RulesetProductLine.CRITICAL_ILLNESS]: "重疾险",
  [RulesetProductLine.TERM_LIFE]: "定期寿险",
  [RulesetProductLine.WHOLE_LIFE]: "终身寿险",
  [RulesetProductLine.ANNUITY]: "年金险",
};

export const DOMAIN_LABELS: Record<string, string> = {
  [ExecutionDomain.ELIGIBILITY]: "定责",
  [ExecutionDomain.ASSESSMENT]: "定损",
  [ExecutionDomain.POST_PROCESS]: "后处理",
};

export const RULE_STATUS_LABELS: Record<string, string> = {
  [RuleStatus.EFFECTIVE]: "生效",
  [RuleStatus.DISABLED]: "已禁用",
  [RuleStatus.DRAFT]: "草稿",
};

export const RULE_STATUS_COLORS: Record<string, string> = {
  [RuleStatus.EFFECTIVE]: "bg-green-100 text-green-700",
  [RuleStatus.DISABLED]: "bg-gray-100 text-gray-500",
  [RuleStatus.DRAFT]: "bg-yellow-100 text-yellow-700",
};

export const CATEGORY_LABELS: Record<string, string> = {
  [RuleCategory.COVERAGE_SCOPE]: "保障范围",
  [RuleCategory.EXCLUSION]: "除外责任",
  [RuleCategory.WAITING_PERIOD]: "等待期",
  [RuleCategory.CLAIM_TIMELINE]: "报案时效",
  [RuleCategory.COVERAGE_PERIOD]: "保障期间",
  [RuleCategory.POLICY_STATUS]: "保单状态",
  [RuleCategory.ITEM_CLASSIFICATION]: "费用分类",
  [RuleCategory.PRICING_REASONABILITY]: "定价合理性",
  [RuleCategory.DISABILITY_ASSESSMENT]: "伤残评估",
  [RuleCategory.DEPRECIATION]: "折旧",
  [RuleCategory.PROPORTIONAL_LIABILITY]: "按责分摊",
  [RuleCategory.DEDUCTIBLE]: "免赔额",
  [RuleCategory.SUB_LIMIT]: "分项限额",
  [RuleCategory.SOCIAL_INSURANCE]: "社保结算",
  [RuleCategory.BENEFIT_OFFSET]: "既往赔付抵扣",
  [RuleCategory.AGGREGATE_CAP]: "总限额",
  [RuleCategory.POST_ADJUSTMENT]: "后处理调整",
};

export const OPERATOR_LABELS: Record<string, string> = {
  [ConditionOperator.EQ]: "等于",
  [ConditionOperator.NE]: "不等于",
  [ConditionOperator.GT]: "大于",
  [ConditionOperator.GTE]: "大于等于",
  [ConditionOperator.LT]: "小于",
  [ConditionOperator.LTE]: "小于等于",
  [ConditionOperator.IN]: "包含于",
  [ConditionOperator.NOT_IN]: "不包含于",
  [ConditionOperator.CONTAINS]: "包含",
  [ConditionOperator.NOT_CONTAINS]: "不包含",
  [ConditionOperator.STARTS_WITH]: "以...开头",
  [ConditionOperator.BETWEEN]: "介于",
  [ConditionOperator.IS_NULL]: "为空",
  [ConditionOperator.IS_NOT_NULL]: "不为空",
  [ConditionOperator.IS_TRUE]: "为真",
  [ConditionOperator.IS_FALSE]: "为假",
  [ConditionOperator.MATCHES_REGEX]: "正则匹配",
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  [RuleActionType.APPROVE_CLAIM]: "通过案件",
  [RuleActionType.REJECT_CLAIM]: "拒赔案件",
  [RuleActionType.SET_CLAIM_RATIO]: "设置赔付比例",
  [RuleActionType.ROUTE_CLAIM_MANUAL]: "转人工审核",
  [RuleActionType.FLAG_FRAUD]: "标记欺诈",
  [RuleActionType.TERMINATE_CONTRACT]: "解除合同",
  [RuleActionType.APPROVE_ITEM]: "通过明细",
  [RuleActionType.REJECT_ITEM]: "拒赔明细",
  [RuleActionType.ADJUST_ITEM_AMOUNT]: "调整明细金额",
  [RuleActionType.SET_ITEM_RATIO]: "设置明细比例",
  [RuleActionType.FLAG_ITEM]: "标记明细",
  [RuleActionType.APPLY_FORMULA]: "应用公式",
  [RuleActionType.APPLY_CAP]: "应用限额",
  [RuleActionType.APPLY_DEDUCTIBLE]: "应用免赔额",
  [RuleActionType.SUM_COVERAGES]: "汇总保障",
  [RuleActionType.DEDUCT_PRIOR_BENEFIT]: "扣减既往赔付",
  [RuleActionType.ADD_REMARK]: "添加备注",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  CLAUSE: "条款",
  POLICY: "保单",
  REGULATION: "监管法规",
  AI_GENERATED: "AI生成",
  MANUAL: "手动录入",
};

export const PRIORITY_LEVEL_LABELS: Record<number, string> = {
  1: "最高优先级（条款/法规强制）",
  2: "高优先级（保单特约）",
  3: "中优先级（通用规则）",
  4: "低优先级（默认/兜底）",
};

export const EXECUTION_MODE_LABELS: Record<string, string> = {
  ALL_MATCH: "全量匹配",
  FIRST_MATCH: "首次匹配",
  PRIORITY_ORDERED: "按优先级",
};

export const INPUT_GRANULARITY_LABELS: Record<string, string> = {
  CLAIM: "案件级",
  ITEM: "明细级",
  COVERAGE: "保障级",
};

export const FIELD_SCOPE_LABELS: Record<string, string> = {
  CLAIM: "案件",
  POLICY: "保单",
  ITEM: "明细",
  COMPUTED: "计算值",
};

export const FIELD_DATA_TYPE_LABELS: Record<string, string> = {
  STRING: "字符串",
  NUMBER: "数字",
  BOOLEAN: "布尔",
  DATE: "日期",
  ENUM: "枚举",
  ARRAY: "数组",
};

export const MOCK_RULESETS: InsuranceRuleset[] = [
  {
    ruleset_id: "RS-ACCIDENT-001",
    product_line: RulesetProductLine.ACCIDENT,
    policy_info: {
      policy_no: "POL-2024-ACC-001",
      product_code: "ZA-002",
      product_name: "小米综合意外险",
      insurer: "众安保险",
      effective_date: "2024-01-01",
      expiry_date: "2024-12-31",
      coverages: [
        {
          coverage_code: "ACC_DEATH",
          coverage_name: "意外身故",
          sum_insured: 500000,
          deductible: 0,
          co_pay_ratio: 0,
        },
        {
          coverage_code: "ACC_MEDICAL",
          coverage_name: "意外医疗",
          sum_insured: 50000,
          deductible: 100,
          co_pay_ratio: 0.1,
        },
      ],
    },
    rules: [
      {
        rule_id: "R001",
        rule_name: "保障期间校验",
        description: "检查事故日期是否在保障期间内",
        category: RuleCategory.COVERAGE_PERIOD,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.ELIGIBILITY,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "条款第三条",
          clause_code: "CL-003",
          source_text: "保障期间为保险合同生效之日起至到期日止",
        },
        priority: { level: 1, rank: 10 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            {
              field: "claim.accident_date",
              operator: ConditionOperator.GTE,
              value: "${policy.effective_date}",
            },
            {
              field: "claim.accident_date",
              operator: ConditionOperator.LTE,
              value: "${policy.expiry_date}",
            },
          ],
        },
        action: { action_type: RuleActionType.APPROVE_CLAIM, params: {} },
        parsing_confidence: {
          overall: 0.95,
          condition_confidence: 0.93,
          action_confidence: 0.97,
          needs_human_review: false,
        },
      },
      {
        rule_id: "R002",
        rule_name: "等待期校验",
        description: "意外险通常无等待期",
        category: RuleCategory.WAITING_PERIOD,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.ELIGIBILITY,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "POLICY",
          source_ref: "保单特约",
          clause_code: null,
          source_text: "意外险无等待期",
        },
        priority: { level: 3, rank: 20 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: { action_type: RuleActionType.APPROVE_CLAIM, params: {} },
      },
      {
        rule_id: "R003",
        rule_name: "除外责任-酒驾",
        description: "酒后驾驶导致的事故不予赔付",
        category: RuleCategory.EXCLUSION,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.ELIGIBILITY,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "条款第七条",
          clause_code: "CL-007",
          source_text:
            "被保险人饮酒、醉酒后驾车导致的事故，不承担给付保险金的责任",
        },
        priority: { level: 1, rank: 5 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            {
              field: "claim.is_drunk_driving",
              operator: ConditionOperator.IS_TRUE,
              value: null,
            },
          ],
        },
        action: {
          action_type: RuleActionType.REJECT_CLAIM,
          params: { reject_reason_code: "EXCL_DRUNK_DRIVING" },
        },
        parsing_confidence: {
          overall: 0.65,
          condition_confidence: 0.58,
          action_confidence: 0.72,
          needs_human_review: true,
          review_hints: ["酒驾判定条件可能需要补充BAC阈值"],
        },
      },
      {
        rule_id: "R004",
        rule_name: "费用分类判断",
        category: RuleCategory.ITEM_CLASSIFICATION,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.ASSESSMENT,
          loop_over: "claim.expense_items",
          item_alias: "expense_item",
          item_action_on_reject: "ZERO_AMOUNT",
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "条款第十条",
          clause_code: "CL-010",
          source_text: "医疗费用按社保目录分类处理",
        },
        priority: { level: 2, rank: 10 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            {
              field: "expense_item.category",
              operator: ConditionOperator.IN,
              value: ["治疗费", "检查费", "药品费", "材料费", "床位费"],
            },
          ],
        },
        action: { action_type: RuleActionType.APPROVE_ITEM, params: {} },
      },
      {
        rule_id: "R005",
        rule_name: "伤残等级赔付",
        category: RuleCategory.DISABILITY_ASSESSMENT,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.ASSESSMENT,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "条款第五条",
          clause_code: "CL-005",
          source_text: "根据伤残等级对应比例给付残疾保险金",
        },
        priority: { level: 2, rank: 20 },
        conditions: {
          logic: ConditionLogic.AND,
          expressions: [
            {
              field: "claim.disability_grade",
              operator: ConditionOperator.IS_NOT_NULL,
              value: null,
            },
          ],
        },
        action: {
          action_type: RuleActionType.SET_CLAIM_RATIO,
          params: {
            disability_grade_table: [
              { grade: 1, payout_ratio: 1.0 },
              { grade: 2, payout_ratio: 0.9 },
              { grade: 3, payout_ratio: 0.8 },
              { grade: 4, payout_ratio: 0.7 },
              { grade: 5, payout_ratio: 0.6 },
              { grade: 6, payout_ratio: 0.5 },
              { grade: 7, payout_ratio: 0.4 },
              { grade: 8, payout_ratio: 0.3 },
              { grade: 9, payout_ratio: 0.2 },
              { grade: 10, payout_ratio: 0.1 },
            ],
          },
        },
      },
      {
        rule_id: "R006",
        rule_name: "免赔额扣除",
        category: RuleCategory.DEDUCTIBLE,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.POST_PROCESS,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "条款第十二条",
          clause_code: "CL-012",
          source_text: "每次事故免赔额100元",
        },
        priority: { level: 2, rank: 10 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: {
          action_type: RuleActionType.APPLY_DEDUCTIBLE,
          params: { deductible_amount: 100 },
        },
      },
      {
        rule_id: "R007",
        rule_name: "年度限额",
        category: RuleCategory.AGGREGATE_CAP,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.POST_PROCESS,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "保障计划表",
          clause_code: "CL-001",
          source_text: "意外医疗保险金限额：50,000元/年",
        },
        priority: { level: 1, rank: 20 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: {
          action_type: RuleActionType.APPLY_CAP,
          params: { cap_field: "total_approved_amount", cap_amount: 50000 },
        },
      },
    ],
    execution_pipeline: {
      domains: [
        {
          domain: "ELIGIBILITY",
          label: "定责",
          execution_mode: "ALL_MATCH",
          input_granularity: "CLAIM",
          short_circuit_on: ["REJECT_CLAIM"],
          category_sequence: [
            RuleCategory.COVERAGE_PERIOD,
            RuleCategory.WAITING_PERIOD,
            RuleCategory.POLICY_STATUS,
            RuleCategory.EXCLUSION,
            RuleCategory.COVERAGE_SCOPE,
            RuleCategory.CLAIM_TIMELINE,
          ],
        },
        {
          domain: "ASSESSMENT",
          label: "定损",
          execution_mode: "ALL_MATCH",
          input_granularity: "ITEM",
          loop_collection: "claim.expense_items",
          short_circuit_on: [],
          category_sequence: [
            RuleCategory.ITEM_CLASSIFICATION,
            RuleCategory.PRICING_REASONABILITY,
            RuleCategory.DISABILITY_ASSESSMENT,
            RuleCategory.DEPRECIATION,
            RuleCategory.PROPORTIONAL_LIABILITY,
          ],
        },
        {
          domain: "POST_PROCESS",
          label: "后处理",
          execution_mode: "PRIORITY_ORDERED",
          input_granularity: "CLAIM",
          short_circuit_on: [],
          category_sequence: [
            RuleCategory.DEDUCTIBLE,
            RuleCategory.SUB_LIMIT,
            RuleCategory.SOCIAL_INSURANCE,
            RuleCategory.BENEFIT_OFFSET,
            RuleCategory.AGGREGATE_CAP,
            RuleCategory.POST_ADJUSTMENT,
          ],
        },
      ],
    },
    override_chains: [
      {
        chain_id: "OC-001",
        topic: "免赔额适用方式",
        conflict_type: "OVERRIDE",
        affected_domain: "POST_PROCESS",
        effective_rule_id: "R006",
        chain: [
          {
            rule_id: "R006",
            priority_level: 2,
            summary: "每次事故扣除100元免赔额",
            status: "EFFECTIVE",
          },
        ],
      },
    ],
    field_dictionary: {
      "claim.accident_date": {
        label: "事故日期",
        data_type: "DATE",
        scope: "CLAIM",
        source: "报案信息",
        applicable_domains: [
          ExecutionDomain.ELIGIBILITY,
          ExecutionDomain.ASSESSMENT,
        ],
      },
      "claim.is_drunk_driving": {
        label: "是否酒驾",
        data_type: "BOOLEAN",
        scope: "CLAIM",
        source: "调查信息",
        applicable_domains: [ExecutionDomain.ELIGIBILITY],
      },
      "claim.disability_grade": {
        label: "伤残等级",
        data_type: "NUMBER",
        scope: "CLAIM",
        source: "鉴定报告",
        applicable_domains: [ExecutionDomain.ASSESSMENT],
      },
      "expense_item.category": {
        label: "费用类别",
        data_type: "ENUM",
        scope: "ITEM",
        source: "费用明细",
        applicable_domains: [ExecutionDomain.ASSESSMENT],
        enum_values: [
          { code: "治疗费", label: "治疗费" },
          { code: "检查费", label: "检查费" },
          { code: "药品费", label: "药品费" },
          { code: "材料费", label: "材料费" },
          { code: "床位费", label: "床位费" },
        ],
      },
      "policy.effective_date": {
        label: "保单生效日",
        data_type: "DATE",
        scope: "POLICY",
        source: "保单信息",
        applicable_domains: [ExecutionDomain.ELIGIBILITY],
      },
      "policy.expiry_date": {
        label: "保单到期日",
        data_type: "DATE",
        scope: "POLICY",
        source: "保单信息",
        applicable_domains: [ExecutionDomain.ELIGIBILITY],
      },
      total_approved_amount: {
        label: "总核定金额",
        data_type: "NUMBER",
        scope: "COMPUTED",
        source: "计算值",
        applicable_domains: [ExecutionDomain.POST_PROCESS],
      },
    },
    metadata: {
      schema_version: "2.0",
      version: "1",
      generated_at: "2024-06-15T10:30:00Z",
      generated_by: "AI_PARSING",
      ai_model: "claude-3.5-sonnet",
      total_rules: 7,
      rules_by_domain: { eligibility: 3, assessment: 2, post_process: 2 },
      low_confidence_rules: 1,
      unresolved_conflicts: 0,
      audit_trail: [
        {
          timestamp: "2024-06-15T10:30:00Z",
          user_id: "system",
          action: "AI解析生成规则集",
        },
        {
          timestamp: "2024-06-15T11:00:00Z",
          user_id: "admin",
          action: "人工审核通过",
        },
      ],
    },
  },
  {
    ruleset_id: "RS-HEALTH-001",
    product_line: RulesetProductLine.HEALTH,
    policy_info: {
      policy_no: "POL-2024-HLT-001",
      product_code: "ZA-001",
      product_name: "尊享e生2024版",
      insurer: "众安保险",
      effective_date: "2024-01-01",
      expiry_date: "2024-12-31",
      coverages: [
        {
          coverage_code: "HLT_INPATIENT",
          coverage_name: "住院医疗",
          sum_insured: 6000000,
          deductible: 10000,
          co_pay_ratio: 0,
        },
      ],
    },
    rules: [
      {
        rule_id: "H001",
        rule_name: "等待期30天校验",
        description: "首次投保等待期30天",
        category: RuleCategory.WAITING_PERIOD,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.ELIGIBILITY,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "条款第四条",
          clause_code: "CL-004",
          source_text: "首次投保等待期为30天",
        },
        priority: { level: 1, rank: 15 },
        conditions: {
          logic: ConditionLogic.OR,
          expressions: [
            {
              logic: "AND" as const,
              expressions: [
                {
                  field: "policy.is_renewal",
                  operator: ConditionOperator.IS_TRUE,
                  value: null,
                },
              ],
            },
            {
              logic: "AND" as const,
              expressions: [
                {
                  field: "policy.is_renewal",
                  operator: ConditionOperator.IS_FALSE,
                  value: null,
                },
                {
                  field: "claim.accident_date",
                  operator: ConditionOperator.GT,
                  value: "${policy.effective_date + 30d}",
                },
              ],
            },
          ],
        },
        action: { action_type: RuleActionType.APPROVE_CLAIM, params: {} },
        parsing_confidence: {
          overall: 0.88,
          condition_confidence: 0.82,
          action_confidence: 0.94,
          needs_human_review: false,
        },
      },
      {
        rule_id: "H002",
        rule_name: "年度免赔额1万元",
        category: RuleCategory.DEDUCTIBLE,
        status: RuleStatus.EFFECTIVE,
        execution: {
          domain: ExecutionDomain.POST_PROCESS,
          loop_over: null,
          item_alias: null,
          item_action_on_reject: null,
        },
        source: {
          source_type: "CLAUSE",
          source_ref: "保障计划表",
          clause_code: "CL-001",
          source_text: "年度免赔额：10,000元",
        },
        priority: { level: 1, rank: 10 },
        conditions: { logic: ConditionLogic.ALWAYS_TRUE, expressions: [] },
        action: {
          action_type: RuleActionType.APPLY_DEDUCTIBLE,
          params: { deductible_amount: 10000 },
        },
      },
    ],
    execution_pipeline: {
      domains: [
        {
          domain: "ELIGIBILITY",
          label: "定责",
          execution_mode: "ALL_MATCH",
          input_granularity: "CLAIM",
          short_circuit_on: ["REJECT_CLAIM"],
          category_sequence: [
            RuleCategory.COVERAGE_PERIOD,
            RuleCategory.WAITING_PERIOD,
            RuleCategory.EXCLUSION,
          ],
        },
        {
          domain: "ASSESSMENT",
          label: "定损",
          execution_mode: "ALL_MATCH",
          input_granularity: "ITEM",
          loop_collection: "claim.expense_items",
          short_circuit_on: [],
          category_sequence: [
            RuleCategory.ITEM_CLASSIFICATION,
            RuleCategory.PRICING_REASONABILITY,
          ],
        },
        {
          domain: "POST_PROCESS",
          label: "后处理",
          execution_mode: "PRIORITY_ORDERED",
          input_granularity: "CLAIM",
          short_circuit_on: [],
          category_sequence: [
            RuleCategory.DEDUCTIBLE,
            RuleCategory.SOCIAL_INSURANCE,
            RuleCategory.AGGREGATE_CAP,
          ],
        },
      ],
    },
    override_chains: [],
    field_dictionary: {
      "policy.is_renewal": {
        label: "是否续保",
        data_type: "BOOLEAN",
        scope: "POLICY",
        source: "保单信息",
        applicable_domains: [ExecutionDomain.ELIGIBILITY],
      },
      "claim.accident_date": {
        label: "事故日期",
        data_type: "DATE",
        scope: "CLAIM",
        source: "报案信息",
        applicable_domains: [
          ExecutionDomain.ELIGIBILITY,
          ExecutionDomain.ASSESSMENT,
        ],
      },
    },
    metadata: {
      schema_version: "2.0",
      version: "1",
      generated_at: "2024-07-01T14:00:00Z",
      generated_by: "HYBRID",
      ai_model: "claude-3.5-sonnet",
      total_rules: 2,
      rules_by_domain: { eligibility: 1, assessment: 0, post_process: 1 },
      low_confidence_rules: 0,
      unresolved_conflicts: 0,
    },
  },
];
// --- END: Ruleset Management Constants ---

// --- START: Intake Config Constants ---
export const INTAKE_FIELD_TYPE_OPTIONS: Record<string, string> = {
  text: "文本输入",
  date: "日期选择",
  time: "时间选择",
  number: "数字输入",
  textarea: "多行文本",
  enum: "下拉选择",
  enum_with_other: "下拉选择(含其他)",
  multi_select: "多选",
  text_with_search: "搜索选择",
  boolean: "是/否",
};

export const INTAKE_VALIDATION_RULE_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "lte_today", label: "不晚于今天" },
  {
    value: "lte_today_and_gte_policy_start",
    label: "不晚于今天且不早于保单生效日",
  },
  { value: "gte_accident_date", label: "不早于事故日期" },
  { value: "gt_zero", label: "大于零" },
  { value: "max_length_200", label: "最大200字" },
  { value: "max_length_500", label: "最大500字" },
  { value: "phone_number", label: "手机号格式" },
];

export const INTAKE_COMMON_PRESET: IntakeField[] = [
  {
    field_id: "accident_date",
    label: "事故日期",
    type: "date",
    required: true,
    placeholder: "请选择事故发生日期",
    validation: {
      rule: "lte_today_and_gte_policy_start",
      error_msg: "事故日期必须在保单有效期内且不晚于今天",
    },
  },
  {
    field_id: "accident_time",
    label: "事故时间",
    type: "time",
    required: false,
    placeholder: "请选择事故发生时间（可选）",
  },
  {
    field_id: "accident_location",
    label: "事故地点",
    type: "text",
    required: true,
    placeholder: "请输入事故发生的详细地点",
  },
  {
    field_id: "accident_description",
    label: "事故描述",
    type: "textarea",
    required: true,
    placeholder: "请描述事故经过",
    validation: { rule: "max_length_500", error_msg: "事故描述不能超过500字" },
  },
  {
    field_id: "accident_reason",
    label: "事故原因",
    type: "enum",
    required: true,
    placeholder: "请选择事故原因",
    data_source: "accident_cause_db",
  },
  {
    field_id: "claim_item",
    label: "索赔项目",
    type: "enum",
    required: true,
    placeholder: "请选择索赔项目",
    data_source: "claim_items_db",
  },
  {
    field_id: "claim_amount",
    label: "索赔金额",
    type: "number",
    required: true,
    placeholder: "请输入索赔金额（CNY）",
    validation: {
      rule: "gte_0_and_decimal_2",
      error_msg: "索赔金额必须大于等于0，最多保留两位小数",
    },
  },
];

export const INTAKE_FIELD_PRESETS: Record<string, IntakeField[]> = {
  [PrimaryCategory.ACCIDENT]: [
    {
      field_id: "accident_date",
      label: "事故日期",
      type: "date",
      required: true,
      placeholder: "请选择事故发生日期",
      validation: {
        rule: "lte_today_and_gte_policy_start",
        error_msg: "事故日期必须在保单有效期内且不晚于今天",
      },
    },
    {
      field_id: "accident_time",
      label: "事故时间",
      type: "time",
      required: false,
      placeholder: "请选择事故发生时间（可选）",
    },
    {
      field_id: "accident_location",
      label: "事故地点",
      type: "text",
      required: true,
      placeholder: "请输入事故发生的详细地点",
    },
    {
      field_id: "accident_reason",
      label: "出险原因",
      type: "enum",
      required: true,
      placeholder: "请选择出险原因",
      options: [], // 空选项，用户可从事故原因配置加载
    },
    {
      field_id: "claim_item",
      label: "索赔项目",
      type: "enum",
      required: true,
      placeholder: "请选择索赔项目",
      data_source: "claim_items_db",
    },
    {
      field_id: "injury_description",
      label: "伤情描述",
      type: "textarea",
      required: true,
      placeholder: "请详细描述受伤情况",
      validation: {
        rule: "max_length_500",
        error_msg: "伤情描述不能超过500字",
      },
    },
    {
      field_id: "treatment_type",
      label: "治疗方式",
      type: "enum",
      required: true,
      placeholder: "请选择治疗方式",
      options: ["门诊", "住院", "手术", "康复治疗"],
    },
    {
      field_id: "hospital_name",
      label: "就诊医院",
      type: "text_with_search",
      required: true,
      placeholder: "请搜索或输入就诊医院名称",
      data_source: "hospital_db",
    },
    {
      field_id: "treatment_status",
      label: "治疗状态",
      type: "enum",
      required: true,
      placeholder: "请选择当前治疗状态",
      options: ["治疗中", "已出院", "已痊愈"],
    },
    {
      field_id: "involves_third_party",
      label: "是否涉及第三方",
      type: "boolean",
      required: true,
      follow_up: { condition: "true", extra_fields: ["third_party_info"] },
    },
    {
      field_id: "third_party_info",
      label: "第三方信息",
      type: "textarea",
      required: false,
      placeholder: "请描述第三方相关信息",
    },
  ],
  [PrimaryCategory.HEALTH]: [
    {
      field_id: "diagnosis_date",
      label: "确诊日期",
      type: "date",
      required: true,
      placeholder: "请选择确诊日期",
      validation: {
        rule: "lte_today_and_gte_policy_start",
        error_msg: "确诊日期必须在保单有效期内",
      },
    },
    {
      field_id: "hospital_name",
      label: "就诊医院",
      type: "text_with_search",
      required: true,
      placeholder: "请搜索或输入就诊医院名称",
      data_source: "hospital_db",
    },
    {
      field_id: "diagnosis_result",
      label: "诊断结果",
      type: "textarea",
      required: true,
      placeholder: "请输入诊断结果",
    },
    {
      field_id: "treatment_type",
      label: "治疗类型",
      type: "multi_select",
      required: true,
      placeholder: "请选择治疗类型",
      options: ["门诊", "住院", "日间手术", "特殊门诊", "住院前后门急诊"],
    },
    {
      field_id: "total_expense",
      label: "费用总额(元)",
      type: "number",
      required: true,
      placeholder: "请输入医疗费用总额",
      validation: { rule: "gt_zero", error_msg: "费用总额必须大于零" },
    },
  ],
  [PrimaryCategory.CRITICAL_ILLNESS]: [
    {
      field_id: "diagnosis_date",
      label: "确诊日期",
      type: "date",
      required: true,
      placeholder: "请选择确诊日期",
      validation: {
        rule: "lte_today_and_gte_policy_start",
        error_msg: "确诊日期必须在保单有效期内",
      },
    },
    {
      field_id: "diagnosis_hospital",
      label: "确诊医院",
      type: "text_with_search",
      required: true,
      placeholder: "请搜索或输入确诊医院",
      data_source: "hospital_db",
    },
    {
      field_id: "disease_name",
      label: "疾病名称",
      type: "text_with_search",
      required: true,
      placeholder: "请搜索或输入疾病名称",
      data_source: "disease_db",
    },
    {
      field_id: "claim_item",
      label: "索赔项目",
      type: "enum",
      required: true,
      placeholder: "请选择索赔项目",
      data_source: "claim_items_db",
    },
    {
      field_id: "severity_level",
      label: "疾病严重程度",
      type: "enum",
      required: true,
      placeholder: "请选择严重程度",
      options: ["重度", "中度", "轻度"],
    },
  ],
  [PrimaryCategory.TERM_LIFE]: [
    {
      field_id: "death_date",
      label: "身故日期",
      type: "date",
      required: true,
      placeholder: "请选择身故日期",
      validation: {
        rule: "lte_today_and_gte_policy_start",
        error_msg: "身故日期必须在保单有效期内",
      },
    },
    {
      field_id: "death_reason",
      label: "身故原因",
      type: "enum",
      required: true,
      placeholder: "请选择身故原因",
      options: ["疾病", "意外", "自然"],
    },
    {
      field_id: "death_location",
      label: "身故地点",
      type: "text",
      required: true,
      placeholder: "请输入身故地点",
    },
  ],
  [PrimaryCategory.WHOLE_LIFE]: [
    {
      field_id: "death_date",
      label: "身故日期",
      type: "date",
      required: true,
      placeholder: "请选择身故日期",
      validation: {
        rule: "lte_today_and_gte_policy_start",
        error_msg: "身故日期必须在保单有效期内",
      },
    },
    {
      field_id: "death_reason",
      label: "身故原因",
      type: "enum",
      required: true,
      placeholder: "请选择身故原因",
      options: ["疾病", "意外", "自然"],
    },
    {
      field_id: "death_location",
      label: "身故地点",
      type: "text",
      required: true,
      placeholder: "请输入身故地点",
    },
  ],
  [PrimaryCategory.ANNUITY]: [
    {
      field_id: "claim_date",
      label: "申请日期",
      type: "date",
      required: true,
      placeholder: "请选择申请日期",
      validation: { rule: "lte_today", error_msg: "申请日期不能晚于今天" },
    },
    {
      field_id: "payout_method",
      label: "领取方式",
      type: "enum",
      required: true,
      placeholder: "请选择领取方式",
      options: ["年领", "月领", "一次性领取"],
    },
  ],
};
// --- END: Intake Config Constants ---
