import { readData } from "../utils/fileStore.js";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "");
}

function extractKeywords(...sources) {
  const joined = sources.filter(Boolean).join(" ");
  const raw = joined.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]{2,}/g) || [];
  const stopWords = new Set(["材料", "提供", "照片", "图片", "文件", "用于", "以及", "信息", "相关"]);
  const uniq = new Set();
  for (const token of raw) {
    const t = token.trim().toLowerCase();
    if (!t || stopWords.has(t)) continue;
    uniq.add(t);
  }
  return Array.from(uniq).slice(0, 24);
}

function buildKeywordRuleResult(material, reason, confidence = 0.95) {
  return {
    materialId: material.id,
    materialName: material.name || "未命名材料",
    confidence,
    source: "ai",
    matchStrategy: "rule",
    reason,
  };
}

function matchSpecialReport(fileName = "") {
  if (!fileName) return null;

  if (fileName.includes("公估报告")) {
    return {
      materialId: "case_public_adjuster_report",
      materialName: "公估报告",
      confidence: 0.99,
      source: "filename",
      matchStrategy: "filename",
      reason: "文件名命中公估报告",
    };
  }

  if (fileName.includes("初期报告")) {
    return {
      materialId: "case_initial_report",
      materialName: "初期报告",
      confidence: 0.99,
      source: "filename",
      matchStrategy: "filename",
      reason: "文件名命中初期报告",
    };
  }

  return null;
}

function resolveMaterial(materials, targetId, fallbackName) {
  return (
    materials.find((item) => item.id === targetId) ||
    materials.find((item) => item.name === fallbackName) ||
    null
  );
}

function matchExplicitMaterialRule(materials, fileName, ocrText) {
  const specialReportMatch = matchSpecialReport(fileName);
  if (specialReportMatch) {
    return specialReportMatch;
  }

  const corpus = `${fileName || ""}\n${ocrText || ""}`;
  const rules = [
    {
      targetId: "mat-50",
      fallbackName: "保险单/保单",
      patterns: [/保险单|电子保单|保单信息|报案保单|保单号/i],
      exclude: [/收条|收据|确认函|收到赔偿款/i],
      reason: "命中保险单/保单关键词",
    },
    {
      targetId: "mat-57",
      fallbackName: "报警记录",
      patterns: [/报警记录|接警|接处警|出警|报警回执|110报警|报警人|拨打了?110/i],
      reason: "命中报警/接处警关键词",
    },
    {
      targetId: "mat-58",
      fallbackName: "事故笔录",
      patterns: [/询问笔录|事故笔录|调查笔录|谈话记录|目击者笔录|面签|陈述如下/i],
      reason: "命中笔录/面签关键词",
    },
    {
      targetId: "mat-59",
      fallbackName: "户口本",
      patterns: [/户口本|户口簿|常住人口登记卡|户主页|居民户口簿/i],
      reason: "命中户口簿关键词",
    },
    {
      targetId: "mat-60",
      fallbackName: "家庭关系证明",
      patterns: [/家庭关系证明|亲属关系证明|关系证明|兹证明.+关系/i],
      reason: "命中家庭关系证明关键词",
    },
    {
      targetId: "mat-61",
      fallbackName: "赔偿协议书",
      patterns: [/赔偿协议书|赔偿协议|和解协议|一次性处理协议/i],
      exclude: [/判决书|民事调解书|人民法院/i],
      reason: "命中赔偿协议关键词",
    },
    {
      targetId: "mat-62",
      fallbackName: "赔款收条",
      patterns: [/赔款收条|收条|收据|确认函|今收到|收到赔偿款/i],
      reason: "命中收条/确认函关键词",
    },
    {
      targetId: "mat-63",
      fallbackName: "谅解书",
      patterns: [/谅解书|谅解函/i],
      reason: "命中谅解书关键词",
    },
    {
      targetId: "mat-64",
      fallbackName: "派工记录/聊天记录",
      patterns: [/派工记录|派工单|微信聊天|聊天记录|微信记录|作业安排|吊车租赁微信聊天/i],
      reason: "命中派工/聊天记录关键词",
    },
    {
      targetId: "mat-65",
      fallbackName: "赔偿支付凭证",
      patterns: [/支付记录|转账详情|电子回单|付款凭证|转账记录|银行回单|凭证号|垫付.+赔偿款/i],
      reason: "命中转账/支付凭证关键词",
    },
    {
      targetId: "mat-66",
      fallbackName: "事故证明/情况说明",
      patterns: [/事故证明|情况说明|政府情况说明|走访记录|走访情况|事故经过说明/i],
      reason: "命中事故证明/情况说明关键词",
    },
    {
      targetId: "mat-11",
      fallbackName: "门（急）诊病历",
      patterns: [/急诊病历|门诊病历|门急诊病历|急诊医学科/i],
      reason: "命中急诊/门诊病历关键词",
    },
    {
      targetId: "mat-53",
      fallbackName: "事故现场照片",
      patterns: [/现场复勘|协商现场|事故现场|现场照片|复勘现场/i],
      reason: "命中现场照片关键词",
    },
    {
      targetId: "mat-55",
      fallbackName: "操作证",
      patterns: [/操作证|特种设备作业人员证/i],
      exclude: [/查询结果|查询平台|操作证查询|证件查询|查询页|查询截图/i],
      reason: "命中操作证关键词",
    },
    {
      targetId: "mat-56",
      fallbackName: "操作证查询结果",
      patterns: [/操作证查询结果|操作证查询|查询平台|查询结果|证件状态|证件查询/i],
      reason: "命中操作证查询关键词",
    },
    {
      targetId: "mat-46",
      fallbackName: "调解协议书/判决书",
      patterns: [/判决书|民事调解书|调解协议书|人民法院/i],
      reason: "命中法院/调解文书关键词",
    },
  ];

  for (const rule of rules) {
    if (!rule.patterns.some((pattern) => pattern.test(corpus))) continue;
    if (rule.exclude?.some((pattern) => pattern.test(corpus))) continue;
    const material = resolveMaterial(materials, rule.targetId, rule.fallbackName);
    if (material) {
      return buildKeywordRuleResult(material, rule.reason);
    }
  }

  return null;
}

export function classifyMaterialByRules(materials, fileName, ocrText) {
  const explicitRuleResult = matchExplicitMaterialRule(materials, fileName, ocrText);
  if (explicitRuleResult) {
    return explicitRuleResult;
  }

  const corpus = `${fileName || ""} ${ocrText || ""}`;
  const normalizedCorpus = normalizeText(corpus);
  const candidates = [];

  for (const material of materials) {
    const materialName = material.name || "";
    const keywords = extractKeywords(materialName, material.description);
    let score = 0;
    const reasons = [];

    const normalizedMaterialName = normalizeText(materialName);
    if (normalizedMaterialName && normalizedCorpus.includes(normalizedMaterialName)) {
      score += 8;
      reasons.push("name_hit");
    }

    for (const keyword of keywords) {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) continue;
      if (normalizedCorpus.includes(normalizedKeyword)) {
        score += normalizedKeyword.length >= 4 ? 2 : 1;
        reasons.push(keyword);
      }
      if (reasons.length >= 8) break;
    }

    if (/发票|票据|金额|大写/.test(corpus) && /发票|票据/.test(materialName)) score += 6;
    if (/身份证|公民身份号码/.test(corpus) && /身份证/.test(materialName)) score += 6;
    if (/驾驶证|准驾车型/.test(corpus) && /驾驶证/.test(materialName)) score += 6;
    if (/行驶证|号牌号码/.test(corpus) && /行驶证/.test(materialName)) score += 6;
    if (/病历|诊断|住院/.test(corpus) && /(病历|诊断|住院|出院)/.test(materialName)) score += 5;
    if (/责任认定|认定书|事故认定/.test(corpus) && /(责任认定|认定书|事故认定)/.test(materialName)) score += 8;

    if (score > 0) {
      candidates.push({
        materialId: material.id,
        materialName: materialName || "未命名材料",
        score,
        reasons: reasons.slice(0, 6),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];

  if (!best) return null;

  const margin = second ? best.score - second.score : best.score;
  if (best.score < 6 || margin < 2) return null;

  const confidence = Math.min(0.96, 0.5 + best.score / 20);
  return {
    materialId: best.materialId,
    materialName: best.materialName,
    confidence,
    source: "ai",
    matchStrategy: "rule",
    reason: `规则命中(${best.reasons.join(",") || "keyword"})`,
  };
}

export function getMaterialCatalog() {
  const materials = readData("claims-materials");
  return Array.isArray(materials) ? materials : [];
}
