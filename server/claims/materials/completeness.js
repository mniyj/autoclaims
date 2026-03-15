import { readData } from '../../utils/fileStore.js';

const MATERIAL_NAME_ALIASES = {
  '初期报告': ['mat-51', 'case_initial_report'],
  '公估报告': ['mat-52', 'case_public_adjuster_report'],
  '医疗费发票': ['医疗发票', 'mat-medical-invoice', 'mat-20'],
  '医疗发票': ['医疗费发票', 'mat-medical-invoice', 'mat-20'],
  'mat-medical-invoice': ['医疗费发票', '医疗发票', 'mat-20'],
  'mat-20': ['医疗费发票', '医疗发票', 'mat-medical-invoice'],
  '住院病历/病案': ['病历资料', '医疗记录', 'mat-medical-record', 'mat-12'],
  '病历资料': ['住院病历/病案', '医疗记录', 'mat-medical-record', 'mat-12'],
  '医疗记录': ['住院病历/病案', '病历资料', 'mat-medical-record', 'mat-12'],
  'mat-medical-record': ['住院病历/病案', '病历资料', '医疗记录', 'mat-12'],
  'mat-12': ['住院病历/病案', '病历资料', '医疗记录', 'mat-medical-record'],
  '费用清单': ['门诊费用明细', '住院费用清单', 'mat-fee-list'],
  'mat-fee-list': ['费用清单', '门诊费用明细', '住院费用清单'],
  'mat-51': ['初期报告', 'case_initial_report'],
  'mat-52': ['公估报告', 'case_public_adjuster_report'],
  'case_initial_report': ['初期报告', 'mat-51'],
  'case_public_adjuster_report': ['公估报告', 'mat-52']
};

const DEFAULT_MATERIALS = {
  AUTO: [
    { id: 'mat-driver-license', name: '驾驶证', required: true },
    { id: 'mat-vehicle-license', name: '行驶证', required: true },
    { id: 'mat-accident-liability', name: '事故责任认定书', required: true }
  ],
  ACC_DEATH: [
    { id: 'mat-death-certificate', name: '死亡证明', required: true },
    { id: 'mat-household-cancellation', name: '户籍注销证明', required: true },
    { id: 'mat-accident-proof', name: '事故认定书或事故证明', required: true },
    { id: 'mat-beneficiary-relationship', name: '受益人或亲属关系证明', required: true },
    { id: 'mat-id-card', name: '身份证件', required: true },
    { id: 'mat-bank-card', name: '银行卡信息', required: true }
  ],
  ACCIDENT: [
    { id: 'mat-accident-proof', name: '事故证明', required: true },
    { id: 'mat-medical-record', name: '医疗记录', required: true },
    { id: 'mat-id-card', name: '身份证件', required: true }
  ],
  HEALTH: [
    { id: 'mat-medical-invoice', name: '医疗发票', required: true },
    { id: 'mat-medical-record', name: '病历资料', required: true },
    { id: 'mat-fee-list', name: '费用清单', required: true }
  ],
  CRITICAL_ILLNESS: [
    { id: 'mat-diagnosis', name: '确诊证明', required: true },
    { id: 'mat-pathology', name: '病理报告', required: true },
    { id: 'mat-id-card', name: '身份证件', required: true }
  ]
};

function normalizeClaimType(claimType) {
  if (!claimType) return 'ACCIDENT';
  const normalized = String(claimType).toUpperCase();
  if (normalized.includes('ACC_DEATH') || normalized.includes('DEATH')) return 'ACC_DEATH';
  if (normalized.includes('AUTO') || normalized.includes('车')) return 'AUTO';
  if (normalized.includes('HEALTH') || normalized.includes('医疗')) return 'HEALTH';
  if (normalized.includes('重疾') || normalized.includes('疾病') || normalized.includes('CRITICAL')) {
    return 'CRITICAL_ILLNESS';
  }
  return 'ACCIDENT';
}

function collectUploadedNames(claim = {}, latestImportRecord = null) {
  const names = new Set();

  for (const doc of claim.documents || []) {
    if (doc?.name) names.add(String(doc.name));
    if (doc?.category) names.add(String(doc.category));
  }

  for (const category of claim.fileCategories || []) {
    if (category?.name) names.add(String(category.name));
    for (const file of category.files || []) {
      if (file?.name) names.add(String(file.name));
    }
  }

  for (const upload of claim.materialUploads || []) {
    if (upload?.materialName) names.add(String(upload.materialName));
    if (upload?.materialId) names.add(String(upload.materialId));
  }

  for (const doc of latestImportRecord?.documents || []) {
    if (doc?.classification?.materialName) names.add(String(doc.classification.materialName));
    if (doc?.classification?.materialId) names.add(String(doc.classification.materialId));
    if (doc?.documentSummary?.summaryType === 'expense_invoice' && Array.isArray(doc.documentSummary.breakdown) && doc.documentSummary.breakdown.length > 0) {
      names.add('费用清单');
      names.add('mat-fee-list');
    }
  }

  for (const name of Array.from(names)) {
    for (const alias of MATERIAL_NAME_ALIASES[name] || []) {
      names.add(alias);
    }
  }

  return names;
}

function matchesMaterial(uploadedNames, material) {
  const candidates = new Set([
    material?.id,
    material?.name,
    ...(MATERIAL_NAME_ALIASES[material?.id] || []),
    ...(MATERIAL_NAME_ALIASES[material?.name] || []),
  ].filter(Boolean).map((item) => String(item)));

  return Array.from(uploadedNames).some((name) => {
    const normalizedName = String(name);
    return Array.from(candidates).some(
      (candidate) =>
        normalizedName === candidate ||
        normalizedName.includes(candidate) ||
        candidate.includes(normalizedName),
    );
  });
}

function inferClaimTypeFromContext(claim = {}, claimType, coverageCode) {
  const normalizedCoverageCode = String(coverageCode || '').toUpperCase();
  if (normalizedCoverageCode === 'ACC_DEATH') {
    return 'ACC_DEATH';
  }

  if (
    claim.death_confirmed === true ||
    claim.deathConfirmed === true ||
    String(claim.result_type || '').toUpperCase() === 'DEATH' ||
    String(claim.resultType || '').toUpperCase() === 'DEATH'
  ) {
    return 'ACC_DEATH';
  }

  return normalizeClaimType(claimType);
}

export function evaluateMaterialCompleteness({ claimCaseId, productCode, claimType, coverageCode = null }) {
  const claims = readData('claim-cases') || [];
  const products = readData('products') || [];
  const allMaterials = readData('claims-materials') || [];
  const importRecords = readData('claim-documents') || [];

  const claim = claims.find(item => item.id === claimCaseId || item.reportNumber === claimCaseId);
  if (!claim) {
    return {
      claimType: normalizeClaimType(claimType),
      requiredMaterials: [],
      missingMaterials: [],
      uploadedCount: 0,
      totalRequired: 0
    };
  }

  const product = productCode
    ? products.find(item => item.productCode === productCode)
    : products.find(item => item.productCode === claim.productCode);
  const latestImportRecord = importRecords
    .filter(item => item.claimCaseId === claimCaseId)
    .sort((a, b) => new Date(b.importedAt || 0).getTime() - new Date(a.importedAt || 0).getTime())[0] || null;

  let requiredMaterials = [];
  const claimMaterials = product?.intakeConfig?.claimMaterials;

  if (claimMaterials?.materialOverrides) {
    requiredMaterials = Object.entries(claimMaterials.materialOverrides)
      .filter(([, config]) => config?.selected && config?.required !== false)
      .map(([materialId]) => {
        const material = allMaterials.find(item => item.id === materialId);
        return material ? { id: material.id, name: material.name, required: true } : null;
      })
      .filter(Boolean);
  }

  const resolvedClaimType = inferClaimTypeFromContext(
    claim,
    claimType || claim.insuranceType || claim.claimType || claim.productName,
    coverageCode
  );
  if (requiredMaterials.length === 0) {
    requiredMaterials = DEFAULT_MATERIALS[resolvedClaimType] || DEFAULT_MATERIALS.ACCIDENT;
  }

  const uploadedNames = collectUploadedNames(claim, latestImportRecord);
  const missingMaterials = requiredMaterials.filter(material => {
    return !matchesMaterial(uploadedNames, material);
  });

  return {
    claimType: resolvedClaimType,
    requiredMaterials,
    missingMaterials,
    uploadedCount: requiredMaterials.length - missingMaterials.length,
    totalRequired: requiredMaterials.length
  };
}
