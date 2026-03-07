import { readData } from '../../utils/fileStore.js';

const DEFAULT_MATERIALS = {
  AUTO: [
    { id: 'mat-driver-license', name: '驾驶证', required: true },
    { id: 'mat-vehicle-license', name: '行驶证', required: true },
    { id: 'mat-accident-liability', name: '事故责任认定书', required: true }
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
  if (normalized.includes('AUTO') || normalized.includes('车')) return 'AUTO';
  if (normalized.includes('HEALTH') || normalized.includes('医疗')) return 'HEALTH';
  if (normalized.includes('重疾') || normalized.includes('疾病') || normalized.includes('CRITICAL')) {
    return 'CRITICAL_ILLNESS';
  }
  return 'ACCIDENT';
}

function collectUploadedNames(claim = {}) {
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

  return names;
}

export function evaluateMaterialCompleteness({ claimCaseId, productCode, claimType }) {
  const claims = readData('claim-cases') || [];
  const products = readData('products') || [];
  const allMaterials = readData('claims-materials') || [];

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

  const resolvedClaimType = normalizeClaimType(claimType || claim.insuranceType || claim.claimType || claim.productName);
  if (requiredMaterials.length === 0) {
    requiredMaterials = DEFAULT_MATERIALS[resolvedClaimType] || DEFAULT_MATERIALS.ACCIDENT;
  }

  const uploadedNames = collectUploadedNames(claim);
  const missingMaterials = requiredMaterials.filter(material => {
    return !Array.from(uploadedNames).some(name => name.includes(material.name) || material.name.includes(name));
  });

  return {
    claimType: resolvedClaimType,
    requiredMaterials,
    missingMaterials,
    uploadedCount: requiredMaterials.length - missingMaterials.length,
    totalRequired: requiredMaterials.length
  };
}
