// 智能理赔微信小程序 - 常量和Mock数据
// 从 smartclaim-ai-agent/constants.ts 迁移

import { ClaimStatus, HistoricalClaim, Policy } from './types';

// ============================================================================
// Mock Data - 模拟理赔数据
// ============================================================================

// 1. 病毒性脑膜炎
const MOCK_DISCHARGE_MENINGITIS = {
  document_type: "出院记录",
  document_id: "DOC-20190409-001",
  hospital_info: {
    hospital_name: "某儿童医院", // 图片未显示具体医院名，通用处理
    department: "儿科"
  },
  patient_info: {
    name: "王小明",
    gender: "男",
    age: 6,
    patient_id: "P-2019040201"
  },
  admission_details: {
    admission_date: "2019-04-02 16:53:00",
    main_symptoms_on_admission: "发热伴头痛1天",
    admission_condition_summary: "患儿主因发热伴头痛1天入院。查体：T37.6℃，神志清楚，颈稍抵抗，双侧巴氏征可疑阳性。无皮疹，心肺听诊无明显异常。",
    past_medical_history_relevant: "既往体健。"
  },
  discharge_details: {
    discharge_date: "2019-04-09 11:30:00",
    hospital_stay_days: 7,
    discharge_status: "好转",
    discharge_destination: "回家"
  },
  diagnoses: [
    { diagnosis_name: "中枢神经系统感染", diagnosis_type: "出院诊断", notes: "病毒性脑膜炎可能性大" },
    { diagnosis_name: "呼吸道感染", diagnosis_type: "出院诊断" },
    { diagnosis_name: "鼻窦炎", diagnosis_type: "出院诊断" }
  ],
  hospitalization_course_summary: "入院后完善检查，脑脊液生化示正常，但临床表现支持中枢感染。给予热毒宁抗病毒，甘露醇降颅压等治疗。患儿头痛消失，体温正常，颈软，巴氏征阴性，病情好转出院。",
  main_treatments_during_hospitalization: [
    { treatment_name: "抗病毒治疗", description: "热毒宁" },
    { treatment_name: "降颅压治疗", description: "甘露醇" },
    { treatment_name: "营养支持", description: "磷酸肌酸钠" }
  ],
  condition_at_discharge: "体温正常，无头痛呕吐，饮食睡眠可。查体：颈软，病理征阴性。",
  discharge_instructions: {
    lifestyle_recommendations: ["预防感冒", "不适随诊"],
    medications: []
  },
  physician_info: {
    attending_physician: "张医生",
    summary_completion_date: "2019-04-09"
  }
};

// 2. 骨关节炎
const MOCK_DISCHARGE_ARTHRITIS = {
  document_type: "出院记录",
  document_id: "DOC-20190521-002",
  hospital_info: {
    hospital_name: "滕州市中心人民医院",
    department: "风湿免疫科"
  },
  patient_info: {
    name: "李桂英",
    gender: "女",
    age: 54,
    date_of_birth: "1965-03-12"
  },
  admission_details: {
    admission_date: "2019-05-09 14:39:27",
    main_symptoms_on_admission: "双膝、双手指关节疼痛1月余",
    admission_condition_summary: "既往高血压病史。查体：双手指远端指间关节压痛，双膝关节压痛，无肿胀，轻度骨摩擦感。",
    past_medical_history_relevant: "高血压病史"
  },
  discharge_details: {
    discharge_date: "2019-05-21 10:27:01",
    hospital_stay_days: 12,
    discharge_status: "好转"
  },
  diagnoses: [
    { diagnosis_name: "双膝、双手骨关节炎", diagnosis_type: "出院诊断" },
    { diagnosis_name: "高血压病2级(中危)", diagnosis_type: "出院诊断" },
    { diagnosis_name: "甲状腺结节", diagnosis_type: "出院诊断" },
    { diagnosis_name: "颈椎病", diagnosis_type: "出院诊断" }
  ],
  hospitalization_course_summary: "入院后给予II级护理。完善检查：类风湿因子6.5IU/mL。颈椎MRI示退行性变。给予塞来昔布胶囊止痛，硫酸氨基葡萄糖养软骨治疗，联合局部治疗及改善循环治疗。患者关节疼痛明显减轻。",
  main_treatments_during_hospitalization: [
    { treatment_name: "药物治疗", description: "塞来昔布 0.2g bid, 硫酸氨基葡萄糖" },
    { treatment_name: "局部治疗", description: "双膝关节腔穿刺" }
  ],
  condition_at_discharge: "双膝关节疼痛明显缓解，饮食睡眠可。",
  discharge_instructions: {
    medications: [
      { med_name: "塞来昔布", dosage: "0.2g", frequency: "每日2次", route: "口服" },
      { med_name: "硫酸氨基葡萄糖", notes: "养软骨治疗" }
    ],
    lifestyle_recommendations: ["低盐低脂饮食", "监测血压"]
  },
  physician_info: {
    attending_physician: "王主任",
    summary_completion_date: "2019-05-21"
  }
};

// 3. 急性支气管炎
const MOCK_DISCHARGE_BRONCHITIS = {
  document_type: "出院证明书",
  document_id: "DOC-20190321-003",
  hospital_info: {
    hospital_name: "江油市中医医院",
    department: "儿科"
  },
  patient_info: {
    name: "陈乐乐",
    gender: "男",
    age: 3, // Inferred roughly
    patient_id: "P-JY-8829"
  },
  admission_details: {
    admission_date: "2019-03-14 18:20",
    main_symptoms_on_admission: "咳嗽3天",
    admission_condition_summary: "T 36.5℃。咽部充血，双肺呼吸音粗，双肺未闻及固定湿啰音。中医诊断：咳嗽（风热外犯）。",
    past_medical_history_relevant: ""
  },
  discharge_details: {
    discharge_date: "2019-03-21 09:00",
    hospital_stay_days: 7,
    discharge_status: "治愈"
  },
  diagnoses: [
    { diagnosis_name: "咳嗽 (风热外犯)", diagnosis_type: "中医诊断" },
    { diagnosis_name: "急性支气管炎", diagnosis_type: "西医诊断" },
    { diagnosis_name: "咳嗽变异性哮喘?", diagnosis_type: "西医诊断", notes: "待排查" }
  ],
  hospitalization_course_summary: "入院后查血常规：白细胞7.06x10^9/L。给予阿奇霉素抗感染，沙丁胺醇、布地奈德雾化吸入止咳平喘，中药疏风清热。患儿咳嗽明显好转，双肺呼吸音清晰。",
  main_treatments_during_hospitalization: [
    { treatment_name: "西医治疗", description: "阿奇霉素抗感染，雾化吸入" },
    { treatment_name: "中医治疗", description: "银翘散合麻杏石甘汤加减" }
  ],
  condition_at_discharge: "偶有咳嗽，无发热，咽部无充血，双肺呼吸音清晰。",
  discharge_instructions: {
    medications: [
      { med_name: "氟替卡松气雾剂", dosage: "125ug", frequency: "bid", route: "吸入" },
      { med_name: "孟鲁司特咀嚼片", dosage: "4mg", frequency: "qn", duration: "5天" }
    ],
    follow_up_appointments: [
      { date_or_interval: "3月内", department: "门诊", notes: "随访1次" }
    ]
  },
  physician_info: {
    attending_physician: "李供斌",
    summary_completion_date: "2019-03-21"
  }
};

// 4. 尺骨骨折
const MOCK_DISCHARGE_FRACTURE = {
  document_type: "出院记录",
  document_id: "DOC-20210502-004",
  hospital_info: {
    hospital_name: "哈尔滨医科大学附属第一医院",
    department: "骨科"
  },
  patient_info: {
    name: "赵强",
    gender: "男",
    age: 35, // Inferred
  },
  admission_details: {
    admission_date: "2021-05-01",
    main_symptoms_on_admission: "左尺骨鹰嘴骨折",
    admission_condition_summary: "左肘关节疼痛肿胀，活动受限。X线示左尺骨鹰嘴骨折，左侧股骨粗隆间骨折？"
  },
  discharge_details: {
    discharge_date: "2021-05-05",
    hospital_stay_days: 5,
    discharge_status: "好转"
  },
  diagnoses: [
    { diagnosis_name: "左尺骨鹰嘴骨折", diagnosis_type: "出院确定诊断" },
    { diagnosis_name: "左侧股骨粗隆间骨折", diagnosis_type: "出院确定诊断" },
    { diagnosis_name: "肺气肿", diagnosis_type: "出院确定诊断" },
    { diagnosis_name: "肺炎", diagnosis_type: "出院确定诊断" }
  ],
  hospitalization_course_summary: "入院后完善相关检查。于全麻下行切开复位内固定术。术后给予抗炎、消肿、止痛治疗。切口愈合良好。",
  main_treatments_during_hospitalization: [
    { treatment_name: "手术治疗", description: "切开复位内固定术" },
    { treatment_name: "对症治疗", description: "抗炎、消肿" }
  ],
  condition_at_discharge: "无不适主诉，切口愈合良好。",
  discharge_instructions: {
    lifestyle_recommendations: ["避免患肢早期负重", "加强营养"],
    medications: [
      { med_name: "接骨七厘片", notes: "促进骨折愈合" },
      { med_name: "利伐沙班", notes: "预防血栓" }
    ],
    follow_up_appointments: [
      { date_or_interval: "术后14日", department: "门诊", notes: "视切口愈合情况拆线" },
      { date_or_interval: "定期", department: "放射科", notes: "复查X线" }
    ]
  },
  physician_info: {
    attending_physician: "张医生",
    summary_completion_date: "2021-05-05"
  }
};

// Mock保单数据
const MOCK_POLICIES: Policy[] = [
  {
    id: 'POL-AUTO-2024001',
    insuredName: '张建国',
    type: '机动车综合商业险',
    validFrom: '2026-01-01',
    validUntil: '2027-01-01'
  },
  {
    id: 'POL-MED-2024002',
    insuredName: '张建国',
    type: '个人百万医疗险',
    validFrom: '2024-02-15',
    validUntil: '2025-02-15'
  },
  {
    id: 'POL-LIFE-2020003',
    insuredName: '张建国',
    type: '终身重大疾病险',
    validFrom: '2020-05-10',
    validUntil: '9999-12-31'
  },
  {
    id: 'POL-HOME-2024004',
    insuredName: '张建国',
    type: '家庭财产综合险',
    validFrom: '2024-03-01',
    validUntil: '2025-03-01'
  },
  {
    id: 'POL-TRAV-2024005',
    insuredName: '张建国',
    type: '全球旅行意外险',
    validFrom: '2024-05-01',
    validUntil: '2024-05-15'
  }
];

// Mock历史理赔数据
const MOCK_HISTORICAL_CLAIMS: HistoricalClaim[] = [
  {
    id: 'CLM-2024-001',
    date: '2024-01-10',
    type: '车辆理赔',
    status: ClaimStatus.PAID,
    amount: 2500,
    insuredName: '张建国',
    incidentReason: '在小区地库发生剐蹭',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: true,
      reasoning: '根据报案描述及现场照片，事故属于保单责任范围内的小额剐蹭。',
      clauseReference: '车辆险条款第12条：意外碰撞责任',
      items: [{ name: '维修费用', claimed: 2500, approved: 2500, deduction: '无' }],
      totalApproved: 2500,
      deductible: 0,
      finalAmount: 2500
    }
  },
  {
    id: 'CLM-2024-002',
    date: '2024-02-20',
    type: '医疗理赔',
    status: ClaimStatus.REVIEWING,
    amount: undefined,
    insuredName: '张建国',
    incidentReason: '突发急性阑尾炎住院',
    documents: [],
    timeline: [],
    assessment: undefined
  },
  {
    id: 'CLM-2019-001',
    date: '2019-04-09',
    type: '少儿住院医疗',
    status: ClaimStatus.PAID,
    amount: 1200,
    insuredName: '王小明',
    incidentReason: '病毒性脑膜炎住院',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: true,
      reasoning: '诊断符合少儿住院险保障范围。',
      items: [{ name: '住院费用', claimed: 1200, approved: 1200, deduction: '无' }],
      totalApproved: 1200,
      deductible: 0,
      finalAmount: 1200
    }
  },
  {
    id: 'CLM-2019-002',
    date: '2019-05-21',
    type: '重疾医疗理赔',
    status: ClaimStatus.PAID,
    amount: 4500,
    insuredName: '李桂英',
    incidentReason: '骨关节炎、高血压住院',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: true,
      reasoning: '符合医疗险报销条件。',
      items: [{ name: '住院费用', claimed: 4500, approved: 4500, deduction: '无' }],
      totalApproved: 4500,
      deductible: 0,
      finalAmount: 4500
    }
  },
  {
    id: 'CLM-2019-003',
    date: '2019-03-21',
    type: '少儿门急诊理赔',
    status: ClaimStatus.SETTLED,
    amount: 580,
    insuredName: '陈乐乐',
    incidentReason: '急性支气管炎',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: true,
      reasoning: '符合门急诊医疗报销范围。',
      items: [{ name: '门诊费用', claimed: 580, approved: 580, deduction: '无' }],
      totalApproved: 580,
      deductible: 0,
      finalAmount: 580
    }
  },
  {
    id: 'CLM-2021-001',
    date: '2021-05-05',
    type: '意外伤害理赔',
    status: ClaimStatus.PAID,
    amount: undefined,
    insuredName: '赵强',
    incidentReason: '左尺骨鹰嘴骨折手术',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: true,
      reasoning: '意外骨折属于理赔范围。',
      items: [{ name: '手术费用', claimed: 8000, approved: 8000, deduction: '无' }],
      totalApproved: 8000,
      deductible: 0,
      finalAmount: 8000
    }
  },
  {
    id: 'CLM-2024-003',
    date: '2024-03-15',
    type: '车辆理赔',
    status: ClaimStatus.SETTLED,
    amount: 800,
    insuredName: '张建国',
    incidentReason: '高速公路行驶被石子蹦裂挡风玻璃',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: true,
      reasoning: '物业证明显示为非人为导致的突发水管爆裂，属于家财险责任。',
      items: [{ name: '地板修复', claimed: 1200, approved: 800, deduction: '旧物折旧' }],
      totalApproved: 800,
      deductible: 0,
      finalAmount: 800
    }
  },
  {
    id: 'CLM-2024-004',
    date: '2024-04-01',
    type: '旅行意外理赔',
    status: ClaimStatus.REJECTED,
    amount: undefined,
    insuredName: '张建国',
    incidentReason: '由于个人迟到导致航司误机，申请补偿',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: false,
      reasoning: '保单仅保障"自然灾害、机械故障、劳工罢工"等客观原因导致的延误。个人迟到属于免责条款范围。',
      clauseReference: '旅行意外险附加险第4.2条：个人过失免责'
    }
  },
  {
    id: 'CLM-2024-005',
    date: '2024-03-15',
    type: '财产理赔',
    status: ClaimStatus.SETTLED,
    amount: 800,
    insuredName: '张建国',
    incidentReason: '家中水管爆裂导致地板泡水',
    documents: [],
    timeline: [],
    assessment: {
      isLiable: true,
      reasoning: '物业证明显示为非人为导致的突发水管爆裂，属于家财险责任。',
      items: [{ name: '地板修复', claimed: 1200, approved: 800, deduction: '旧物折旧' }],
      totalApproved: 800,
      deductible: 0,
      finalAmount: 800
    }
  }
];

export {
  MOCK_DISCHARGE_MENINGITIS,
  MOCK_DISCHARGE_ARTHRITIS,
  MOCK_DISCHARGE_BRONCHITIS,
  MOCK_DISCHARGE_FRACTURE,
  MOCK_POLICIES,
  MOCK_HISTORICAL_CLAIMS
};
