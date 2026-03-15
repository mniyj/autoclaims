function pickTop(items: string[], count = 3): string[] {
  return items.filter(Boolean).slice(0, count);
}

export function summarizeProgressForVoice(progress: {
  claimId?: string;
  statusLabel?: string;
  nextStep?: string;
}): string {
  const claimLabel = progress.claimId ? `案件${progress.claimId}` : "这个案件";
  const status = progress.statusLabel || "处理中";
  const nextStep = progress.nextStep || "请您留意后续通知";
  return `${claimLabel}目前是${status}。下一步是${nextStep}。`;
}

export function summarizeMissingMaterialsForVoice(result: {
  claimId?: string;
  missingMaterials?: Array<{ name?: string }>;
}): string {
  const missing = (result.missingMaterials || [])
    .map((item) => item.name || "")
    .filter(Boolean);
  if (missing.length === 0) {
    return `案件${result.claimId || ""}当前必需材料已经齐了，暂时不用补传。`.trim();
  }
  const topMissing = pickTop(missing).join("、");
  return `现在还缺${missing.length}项关键材料，主要是${topMissing}。您补齐这些，我这边就能继续往下走。`;
}

export function summarizeCoverageForVoice(result: {
  claimType?: string;
  responsibilities?: Array<{ name?: string }>;
  exclusions?: string[];
}): string {
  const claimType = result.claimType || "这个险种";
  const responsibilities = pickTop(
    (result.responsibilities || []).map((item) => item.name || ""),
  );
  const exclusions = pickTop(result.exclusions || [], 2);
  const parts = [
    `${claimType}主要能保${responsibilities.length > 0 ? responsibilities.join("、") : "常见责任，具体还要以条款为准"}。`,
  ];
  if (exclusions.length > 0) {
    parts.push(`需要特别注意的是：${exclusions.join("；")}。`);
  }
  return parts.join("");
}

export function summarizeSettlementForVoice(result: {
  estimatedAmount?: number;
  basis?: string;
  claimType?: string;
}): string {
  const amount = Number(result.estimatedAmount || 0);
  if (!amount) {
    return `现在还没法给您准确赔付预估，需要结合案件金额和材料再判断。`;
  }
  return `${result.claimType || "这个险种"}目前预估能赔大约${amount.toLocaleString()}元。${result.basis || "这只是当前估算，最终以审核结果为准"}。`;
}

export function summarizeMaterialsForVoice(result: {
  claimType?: string;
  materials?: Array<{ name?: string; required?: boolean }>;
}): string {
  const required = pickTop(
    (result.materials || [])
      .filter((item) => item.required)
      .map((item) => item.name || ""),
  );
  const optional = pickTop(
    (result.materials || [])
      .filter((item) => !item.required)
      .map((item) => item.name || ""),
    2,
  );
  const parts = [
    `${result.claimType || "该险种"}一般先准备${required.length > 0 ? required.join("、") : "基础理赔材料"}。`,
  ];
  if (optional.length > 0) {
    parts.push(`如果有的话，再补上${optional.join("、")}会更完整。`);
  }
  return parts.join("");
}
