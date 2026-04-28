import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useVoiceController } from "../hooks/useVoiceController";
import {
  ClaimStatus,
  Message,
  ClaimState,
  ClaimDocument,
  HistoricalClaim,
  Policy,
  Attachment,
  MedicalInvoiceData,
  OCRData,
  DischargeSummaryData,
  IntakeConfig,
  IntakeField,
  CalculatedMaterial,
  ClaimRequiredMaterial,
  ClaimFileCategory,
  ClaimMaterialUpload,
  IntentType,
  UIComponentType,
  ClaimProgressInfo,
  MaterialsListInfo,
  MissingMaterialsInfo,
  PremiumImpactInfo,
  SettlementEstimateInfo,
  SettlementDetailInfo,
  PolicyInfoData,
  ClaimHistoryInfo,
  PaymentStatusInfo,
  CoverageInfo,
} from "./types";
import { MOCK_HISTORICAL_CLAIMS } from "./constants";

// --- Hospital Info Type ---
interface HospitalInfo {
  id: string;
  name: string;
  province: string;
  city: string;
  level: string;
  type: string;
  address?: string;
  qualifiedForInsurance: boolean;
}
import {
  getAIResponse,
  analyzeDocument,
  quickAnalyze,
  smartChat,
  type QuickAnalyzeMaterial,
} from "./geminiService";
import { configService } from "./services/configService";
import { getIntentLabel, recognizeIntent } from "./intentService";
import {
  cancelActiveClaimOrchestrator,
  continueClaimOrchestratorWithText,
  executeClaimOrchestratorSelection,
  executeTool,
} from "./intentTools";
import { getSignedUrl } from "./ossService";
import { logUserOperation } from "./logService";
import { UserOperationType } from "../types";
import type { AIInteractionLog } from "../types";

// --- Helpers ---
function encode(bytes: Uint8Array) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: "audio/pcm;rate=16000",
  };
}

function downsampleAudioBuffer(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16000,
): Float32Array {
  if (inputSampleRate <= outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  let outputOffset = 0;
  let inputOffset = 0;

  while (outputOffset < outputLength) {
    const nextInputOffset = Math.round((outputOffset + 1) * ratio);
    let accumulator = 0;
    let count = 0;

    for (
      let i = inputOffset;
      i < nextInputOffset && i < input.length;
      i += 1
    ) {
      accumulator += input[i];
      count += 1;
    }

    output[outputOffset] = count > 0 ? accumulator / count : 0;
    outputOffset += 1;
    inputOffset = nextInputOffset;
  }

  return output;
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{
      transcript: string;
    }> & {
      isFinal: boolean;
    }
  >;
};

type BrowserSpeechRecognitionErrorEvent = {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type VoiceTransportMode = "server" | "browser";
type VoiceOutputChannel = "aliyun" | "browser" | "degraded" | "connecting";

type VoiceServiceStatus = {
  geminiConfigured?: boolean;
  nlsMode?: "aliyun" | "mock";
  ttsMode?: "aliyun" | "mock";
};

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitAudioContext?: typeof AudioContext;
  }
}

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function describeVoiceServicesStatus(services?: VoiceServiceStatus): string | null {
  if (!services) {
    return null;
  }

  if (services.nlsMode === "aliyun" && services.ttsMode === "aliyun") {
    return "阿里云语音服务已连接，当前播报使用阿里云音色。";
  }

  if (services.nlsMode === "aliyun" && services.ttsMode !== "aliyun") {
    return "语音识别已接入阿里云，但语音播报未启用阿里云 TTS，当前会退回默认播报。";
  }

  if (services.nlsMode !== "aliyun" && services.ttsMode === "aliyun") {
    return "语音播报已接入阿里云 TTS，但语音识别仍处于模拟模式。";
  }

  return "当前语音服务处于降级模式，阿里云语音识别或播报配置未生效。";
}

function getVoiceOutputBadge(channel: VoiceOutputChannel): {
  label: string;
  className: string;
} {
  switch (channel) {
    case "aliyun":
      return {
        label: "阿里云播报",
        className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      };
    case "browser":
      return {
        label: "浏览器播报",
        className: "bg-amber-100 text-amber-700 border border-amber-200",
      };
    case "degraded":
      return {
        label: "降级模式",
        className: "bg-rose-100 text-rose-700 border border-rose-200",
      };
    default:
      return {
        label: "连接中",
        className: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
}

function getVoiceRecognitionErrorMessage(error?: string): {
  statusText: string;
  assistantMessage?: string;
  shouldExitVoiceMode: boolean;
  shouldRetry: boolean;
} {
  switch (error) {
    case "no-speech":
      return {
        statusText: "没有听清，请再说一次",
        shouldExitVoiceMode: false,
        shouldRetry: true,
      };
    case "aborted":
      return {
        statusText: "语音识别已中断，正在重试",
        shouldExitVoiceMode: false,
        shouldRetry: true,
      };
    case "audio-capture":
      return {
        statusText: "未检测到麦克风",
        assistantMessage: "未检测到可用麦克风，请检查设备后再试，或改用文字输入。",
        shouldExitVoiceMode: true,
        shouldRetry: false,
      };
    case "not-allowed":
    case "service-not-allowed":
      return {
        statusText: "麦克风权限未开启",
        assistantMessage: "麦克风权限未开启，请允许浏览器访问麦克风后重试，或改用文字输入。",
        shouldExitVoiceMode: true,
        shouldRetry: false,
      };
    case "network":
      return {
        statusText: "语音服务连接失败",
        assistantMessage: "当前浏览器语音服务连接失败，请稍后再试；如果仍无法恢复，再改用文字输入。",
        shouldExitVoiceMode: true,
        shouldRetry: false,
      };
    default:
      return {
        statusText: "语音识别出错，请重试",
        assistantMessage: "语音识别暂时不可用，请改用文字输入或稍后重试。",
        shouldExitVoiceMode: true,
        shouldRetry: false,
      };
  }
}

type BackendPolicy = {
  id?: string;
  policyNumber?: string;
  productName?: string;
  productCode?: string;
  insureds?: Array<{ name?: string }>;
  policyholder?: { name?: string };
  effectiveDate?: string;
  issueDate?: string;
  expiryDate?: string;
};

type BackendClaimCase = {
  id: string;
  reportNumber?: string;
  reportTime?: string;
  productName?: string;
  productCode?: string;
  accidentReason?: string;
  insured?: string;
  status?: string;
  fileCategories?: ClaimFileCategory[];
  requiredMaterials?: ClaimRequiredMaterial[];
  materialUploads?: ClaimMaterialUpload[];
  timeline?: HistoricalClaim["timeline"];
  assessment?: HistoricalClaim["assessment"];
};

const fetchPoliciesFromBackend = async (): Promise<Policy[]> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch("/api/policies", { signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("POLICY_REQUEST_TIMEOUT");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error("Failed to load policies");
  const data = await response.json();
  const policies = Array.isArray(data) ? data : [];
  return policies
    .map((policy: BackendPolicy) => ({
      id: policy.policyNumber || policy.id || "",
      policyholderName: policy.policyholder?.name || "",
      insuredName:
        policy.insureds?.[0]?.name || policy.policyholder?.name || "",
      type: policy.productName || policy.productCode || "未知险种",
      validFrom: policy.effectiveDate || policy.issueDate || "",
      validUntil: policy.expiryDate || "",
      productCode: policy.productCode || "",
    }))
    .filter((p) => p.id);
};

const mapBackendClaimStatus = (status?: string): ClaimStatus => {
  switch (status) {
    case "已报案":
    case "REPORTED":
      return ClaimStatus.REPORTING;
    case "补充材料":
    case "材料待补":
    case "DOCUMENTING":
      return ClaimStatus.DOCUMENTING;
    case "审核中":
    case "REVIEWING":
      return ClaimStatus.REVIEWING;
    case "待打款":
    case "PAYING":
      return ClaimStatus.PAYING;
    case "已结案":
    case "已赔付":
    case "PAID":
      return ClaimStatus.PAID;
    case "已拒赔":
    case "REJECTED":
      return ClaimStatus.REJECTED;
    default:
      return ClaimStatus.REPORTING;
  }
};

const markUploadedMaterials = (
  materials: ClaimRequiredMaterial[] = [],
  fileCategories: ClaimFileCategory[] = [],
  materialUploads: ClaimMaterialUpload[] = [],
): ClaimRequiredMaterial[] => {
  const uploadedCategoryNames = new Set(
    fileCategories
      .filter((category) => Array.isArray(category.files) && category.files.length > 0)
      .map((category) => category.name),
  );
  const uploadedMaterialIds = new Set(
    materialUploads
      .filter((item) => Array.isArray(item.files) && item.files.length > 0)
      .map((item) => item.materialId),
  );
  const uploadedMaterialNames = new Set(
    materialUploads
      .filter((item) => Array.isArray(item.files) && item.files.length > 0)
      .map((item) => item.materialName),
  );

  return materials.map((material) => ({
    ...material,
    uploaded:
      material.uploaded ||
      uploadedMaterialIds.has(material.materialId) ||
      uploadedMaterialNames.has(material.materialName) ||
      uploadedCategoryNames.has(material.materialName) ||
      uploadedCategoryNames.has(material.materialId),
  }));
};

const MATERIAL_MATCH_STOP_WORDS = [
  "材料",
  "证明",
  "资料",
  "文件",
  "复印件",
  "原件",
  "照片",
  "影像",
  "扫描件",
  "上传",
  "电子版",
];

const MATERIAL_MATCH_ALIASES: Record<string, string[]> = {
  发票: ["发票", "票据", "收据", "医疗发票", "住院发票", "门诊发票"],
  清单: ["费用清单", "明细", "明细清单", "费用明细", "住院清单"],
  病历: ["病历", "门诊病历", "病历本", "病案"],
  出院小结: ["出院小结", "出院记录", "出院证明", "出院摘要"],
  诊断证明: ["诊断证明", "诊断书", "疾病诊断证明"],
  身份证: ["身份证", "身份证件", "证件", "身份证明"],
  银行卡: ["银行卡", "银行账户", "收款账户", "开户行"],
  事故认定: ["事故认定", "事故证明", "责任认定", "交通事故责任认定书"],
  行驶证: ["行驶证", "机动车行驶证", "车辆行驶证", "行驶证正页", "行驶证副页"],
  驾驶证: ["驾驶证", "机动车驾驶证", "驾照", "准驾车型"],
  保单: ["保单", "保险合同", "投保单"],
  委托书: ["委托书", "授权书"],
  死亡证明: ["死亡证明", "死亡医学证明"],
  医嘱: ["医嘱", "医嘱单"],
  化验报告: ["化验单", "检验报告", "检验单", "化验结果"],
  检查报告: ["检查单", "影像报告", "ct报告", "mri报告", "b超报告", "超声报告"],
  住院证明: ["住院证明", "入院证明", "住院通知"],
};

const normalizeMaterialText = (value?: string): string => {
  return (value || "").toLowerCase().replace(/\s+/g, "");
};

const tokenizeMaterialText = (value?: string): string[] => {
  const normalized = normalizeMaterialText(value);
  if (!normalized) {
    return [];
  }

  const tokens = new Set<string>();
  const chunks = normalized.split(/[\/,，、()（）\-_:：]/).filter(Boolean);
  chunks.forEach((chunk) => {
    if (!MATERIAL_MATCH_STOP_WORDS.some((word) => chunk.includes(word))) {
      tokens.add(chunk);
    }
  });

  Object.entries(MATERIAL_MATCH_ALIASES).forEach(([key, aliases]) => {
    if (normalized.includes(key.toLowerCase()) || aliases.some((alias) => normalized.includes(alias.toLowerCase()))) {
      tokens.add(key.toLowerCase());
      aliases.forEach((alias) => tokens.add(alias.toLowerCase()));
    }
  });

  return Array.from(tokens).filter((token) => token.length >= 2);
};

const getAttachmentSignalTokens = (attachment: Attachment): string[] => {
  const tokens = new Set<string>();
  const addText = (value?: string | number) => {
    tokenizeMaterialText(typeof value === "number" ? String(value) : value).forEach(
      (token) => tokens.add(token),
    );
  };

  addText(attachment.name);
  addText(attachment.analysis?.category);
  addText(attachment.analysis?.summary);
  addText(attachment.analysis?.ocr?.description);
  addText(attachment.analysis?.ocr?.merchant);
  addText(attachment.analysis?.ocr?.invoiceNumber);
  addText(attachment.analysis?.ocr?.idNumber);
  addText(attachment.analysis?.ocr?.name);
  addText(attachment.analysis?.medicalData?.documentType);
  addText(attachment.analysis?.medicalData?.invoiceInfo?.invoiceNumber);
  addText(attachment.analysis?.medicalData?.invoiceInfo?.hospitalName);
  addText(attachment.analysis?.medicalData?.basicInfo?.name);
  addText(attachment.analysis?.dischargeSummaryData?.document_type);
  addText(attachment.analysis?.dischargeSummaryData?.hospital_info?.hospital_name);
  addText(attachment.analysis?.dischargeSummaryData?.patient_info?.name);

  if (attachment.analysis?.medicalData?.invoiceInfo?.invoiceNumber) {
    tokens.add("发票");
  }
  if (attachment.analysis?.dischargeSummaryData) {
    tokens.add("出院小结");
    tokens.add("出院记录");
  }
  if (attachment.analysis?.medicalData?.documentType === "detail_list") {
    tokens.add("清单");
    tokens.add("明细");
  }

  return Array.from(tokens);
};

const getAttachmentHeuristicBonus = (
  attachment: Attachment,
  material: ClaimRequiredMaterial,
): number => {
  const materialText = normalizeMaterialText(
    [material.materialName, material.materialDescription].filter(Boolean).join(" "),
  );

  let score = 0;

  if (attachment.analysis?.medicalData?.invoiceInfo?.invoiceNumber) {
    if (materialText.includes("发票")) score += 40;
    if (materialText.includes("清单")) score -= 10;
  }

  if (attachment.analysis?.medicalData?.documentType === "detail_list") {
    if (materialText.includes("清单") || materialText.includes("明细")) score += 45;
  }

  if (attachment.analysis?.dischargeSummaryData) {
    if (materialText.includes("出院")) score += 55;
    if (materialText.includes("病历")) score += 15;
  }

  if (attachment.analysis?.ocr?.idNumber) {
    if (materialText.includes("身份证")) score += 45;
  }

  if (
    normalizeMaterialText(attachment.analysis?.category).includes("银行卡") ||
    normalizeMaterialText(attachment.name).includes("银行卡")
  ) {
    if (materialText.includes("银行卡") || materialText.includes("收款")) score += 45;
  }

  if (
    normalizeMaterialText(attachment.analysis?.category).includes("诊断") ||
    normalizeMaterialText(attachment.name).includes("诊断")
  ) {
    if (materialText.includes("诊断")) score += 45;
  }

  if (
    normalizeMaterialText(attachment.analysis?.category).includes("病历") ||
    normalizeMaterialText(attachment.name).includes("病历")
  ) {
    if (materialText.includes("病历")) score += 35;
  }

  if (
    normalizeMaterialText(attachment.analysis?.category).includes("行驶证") ||
    normalizeMaterialText(attachment.name).includes("行驶证")
  ) {
    if (materialText.includes("行驶证")) score += 45;
  }

  if (
    normalizeMaterialText(attachment.analysis?.category).includes("驾驶证") ||
    normalizeMaterialText(attachment.name).includes("驾驶证") ||
    normalizeMaterialText(attachment.analysis?.category).includes("驾照") ||
    normalizeMaterialText(attachment.name).includes("驾照")
  ) {
    if (materialText.includes("驾驶证") || materialText.includes("驾照")) score += 45;
  }

  return score;
};

// Checks whether a claim still needs materials matching any of the given AI-identified categories
const claimNeedsMatchingMaterial = (
  claim: HistoricalClaim,
  pendingCategories: string[],
): boolean => {
  if (!claim.requiredMaterials || claim.requiredMaterials.length === 0) return false;

  return claim.requiredMaterials.some((material) => {
    const matTokens = new Set(
      tokenizeMaterialText(`${material.materialName} ${material.materialDescription || ""}`),
    );
    const matNorm = normalizeMaterialText(material.materialName);

    return pendingCategories.some((cat) => {
      const catNorm = normalizeMaterialText(cat);
      if (matNorm.includes(catNorm) || catNorm.includes(matNorm)) return true;
      return tokenizeMaterialText(cat).some((token) => matTokens.has(token));
    });
  });
};

const resolveMaterialCategoryName = (
  attachment: Attachment,
  requiredMaterials: ClaimRequiredMaterial[],
  explicitMaterialName?: string,
): string => {
  return resolveMaterialMatch(attachment, requiredMaterials, explicitMaterialName)
    .materialName;
};

const buildMaterialMatchSummary = (
  matchedFiles: Array<{
    attachment: Attachment;
    match: { materialId?: string; materialName: string };
  }>,
): string | null => {
  if (matchedFiles.length === 0) {
    return null;
  }

  const matchedGroups = new Map<string, string[]>();
  const unmatchedFiles: string[] = [];

  matchedFiles.forEach(({ attachment, match }) => {
    if (!match.materialId) {
      unmatchedFiles.push(attachment.name);
      return;
    }

    const current = matchedGroups.get(match.materialName) || [];
    current.push(attachment.name);
    matchedGroups.set(match.materialName, current);
  });

  const matchedLines = Array.from(matchedGroups.entries()).map(
    ([materialName, fileNames]) =>
      `- ${materialName}: ${fileNames.join("、")}`,
  );
  const unmatchedSection =
    unmatchedFiles.length > 0
      ? `\n未命中任何材料项：\n${unmatchedFiles.map((fileName) => `- ${fileName}`).join("\n")}`
      : "";

  if (matchedLines.length === 0 && unmatchedFiles.length === 0) {
    return null;
  }

  if (matchedLines.length === 0) {
    return `本次上传未命中任何材料项，已暂存为“其他材料”。${unmatchedSection}`;
  }

  return `已按材料项完成归类。\n${matchedLines.join("\n")}${unmatchedSection}`;
};

const resolveMaterialMatch = (
  attachment: Attachment,
  requiredMaterials: ClaimRequiredMaterial[],
  explicitMaterialName?: string,
): { materialId?: string; materialName: string } => {
  if (explicitMaterialName) {
    // Try strict name match first; if the claim's requiredMaterials list uses
    // a slightly different label (全/半角括号、空格、别名), fall through to the
    // AI-provided match so we don't drop an otherwise-correct classification.
    const explicitMaterial = requiredMaterials.find(
      (material) => material.materialName === explicitMaterialName,
    );
    if (explicitMaterial?.materialId) {
      return {
        materialId: explicitMaterial.materialId,
        materialName: explicitMaterialName,
      };
    }
    if (attachment.analysis?.matchedMaterialId) {
      return {
        materialId: attachment.analysis.matchedMaterialId,
        materialName:
          attachment.analysis.matchedMaterialName ||
          explicitMaterialName ||
          attachment.analysis.category,
      };
    }
    return {
      materialId: undefined,
      materialName: explicitMaterialName,
    };
  }

  // quickAnalyze 已直接从材料目录匹配，跳过 token 评分
  if (attachment.analysis?.matchedMaterialId) {
    return {
      materialId: attachment.analysis.matchedMaterialId,
      materialName:
        attachment.analysis.matchedMaterialName || attachment.analysis.category,
    };
  }

  if (requiredMaterials.length === 0) {
    return { materialName: attachment.analysis?.category || "其他材料" };
  }

  const candidateText = [
    attachment.analysis?.category,
    attachment.analysis?.summary,
    attachment.analysis?.ocr?.description,
    attachment.name,
  ]
    .filter(Boolean)
    .join(" ");
  const normalizedCandidate = normalizeMaterialText(candidateText);
  const candidateTokens = [
    ...new Set([
      ...tokenizeMaterialText(candidateText),
      ...getAttachmentSignalTokens(attachment),
    ]),
  ];

  let bestMatch: { materialId: string; materialName: string; score: number } | null = null;

  requiredMaterials.forEach((material) => {
    const materialTexts = [
      material.materialName,
      material.materialDescription,
      material.source,
      material.sourceDetails,
    ].filter(Boolean);
    const materialTokens = materialTexts.flatMap((text) => tokenizeMaterialText(text));
    let score = 0;

    if (normalizedCandidate.includes(normalizeMaterialText(material.materialName))) {
      score += 100;
    }

    materialTokens.forEach((token) => {
      if (!token) {
        return;
      }
      if (normalizedCandidate.includes(token)) {
        score += token.length >= 4 ? 20 : 10;
      }
      if (candidateTokens.includes(token)) {
        score += 8;
      }
    });

    score += getAttachmentHeuristicBonus(attachment, material);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        materialId: material.materialId,
        materialName: material.materialName,
        score,
      };
    }
  });

  if (bestMatch && bestMatch.score >= 10) {
    return {
      materialId: bestMatch.materialId,
      materialName: bestMatch.materialName,
    };
  }

  const semanticKeywords = [
    { keys: ["事故", "现场", "碰撞", "车损", "车辆", "损失", "定损"], target: ["事故现场", "车辆损失", "现场照片", "定损"] },
    { keys: ["病历", "门诊", "住院"], target: ["病历"] },
    { keys: ["发票", "费用"], target: ["发票", "费用"] },
    { keys: ["身份证"], target: ["身份"] },
    { keys: ["银行卡"], target: ["银行"] },
  ];
  for (const group of semanticKeywords) {
    if (group.keys.some((k) => normalizedCandidate.includes(k))) {
      const semanticHit = requiredMaterials.find((m) =>
        group.target.some((t) => m.materialName.includes(t)),
      );
      if (semanticHit) {
        return {
          materialId: semanticHit.materialId,
          materialName: semanticHit.materialName,
        };
      }
    }
  }

  return { materialName: attachment.analysis?.category || "其他材料" };
};

const mapFileCategoriesToDocuments = (
  fileCategories: ClaimFileCategory[] = [],
): ClaimDocument[] => {
  return fileCategories.flatMap((category, categoryIndex) =>
    (category.files || []).map((file, fileIndex) => ({
      id: `CAT-${categoryIndex}-${fileIndex}-${file.name}`,
      name: file.name,
      type: detectMimeType(file.name),
      status: "verified" as const,
      url: file.url,
      ossKey: file.ossKey,
      category: category.name,
    })),
  );
};

const isSameStoredFile = (
  left: { name: string; url?: string; ossKey?: string },
  right: { name: string; url?: string; ossKey?: string },
): boolean => {
  if (left.ossKey && right.ossKey) {
    return left.ossKey === right.ossKey;
  }
  if (left.url && right.url) {
    return left.url === right.url;
  }
  return left.name === right.name;
};

const mergeClaimDetail = (
  baseClaim: HistoricalClaim,
  backendClaim?: BackendClaimCase | null,
): HistoricalClaim => {
  if (!backendClaim) {
    return baseClaim;
  }

  const fileCategories = backendClaim.fileCategories || baseClaim.fileCategories || [];
  const materialUploads = backendClaim.materialUploads || baseClaim.materialUploads || [];
  const requiredMaterials = markUploadedMaterials(
    backendClaim.requiredMaterials || baseClaim.requiredMaterials || [],
    fileCategories,
    materialUploads,
  );

  return {
    ...baseClaim,
    id: backendClaim.id || baseClaim.id,
    date:
      backendClaim.reportTime?.split("T")[0] ||
      backendClaim.reportTime?.split(" ")[0] ||
      baseClaim.date,
    type: backendClaim.productName || backendClaim.productCode || baseClaim.type,
    incidentReason: backendClaim.accidentReason || baseClaim.incidentReason,
    insuredName: backendClaim.insured || baseClaim.insuredName,
    status: mapBackendClaimStatus(backendClaim.status) || baseClaim.status,
    timeline: backendClaim.timeline || baseClaim.timeline,
    assessment: backendClaim.assessment || baseClaim.assessment,
    fileCategories,
    materialUploads,
    requiredMaterials,
    documents:
      mapFileCategoriesToDocuments(fileCategories).length > 0
        ? mapFileCategoriesToDocuments(fileCategories)
        : baseClaim.documents,
  };
};

const getUploadedFilesForMaterial = (
  claim: HistoricalClaim,
  materialId: string,
) => {
  return (
    claim.materialUploads?.find((item) => item.materialId === materialId)?.files ||
    []
  );
};

const getDocIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "fa-file-pdf";
  if (lowerName.includes("身份") || lowerName.includes("证"))
    return "fa-id-card";
  if (
    lowerName.includes("票") ||
    lowerName.includes("凭证") ||
    lowerName.includes("清单")
  )
    return "fa-receipt";
  if (
    lowerName.includes("小结") ||
    lowerName.includes("出院") ||
    lowerName.includes("记录")
  )
    return "fa-file-waveform";
  if (lowerName.includes("照片") || lowerName.includes("现场"))
    return "fa-camera-retro";
  if (lowerName.includes("诊断") || lowerName.includes("报告"))
    return "fa-file-medical";
  return "fa-file-lines";
};

const getStatusLabel = (status: ClaimStatus) => {
  switch (status) {
    case ClaimStatus.REPORTING:
      return "报案登记";
    case ClaimStatus.DOCUMENTING:
      return "补充材料";
    case ClaimStatus.REVIEWING:
      return "智能审核";
    case ClaimStatus.SETTLED:
      return "审核完成";
    case ClaimStatus.PAID:
      return "已打款";
    case ClaimStatus.REJECTED:
      return "已拒赔";
    default:
      return "处理中";
  }
};

const detectMimeType = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (/\.(jpg|jpeg)$/i.test(lower)) return "image/jpeg";
  if (/\.png$/i.test(lower)) return "image/png";
  if (/\.webp$/i.test(lower)) return "image/webp";
  if (/\.gif$/i.test(lower)) return "image/gif";
  if (/\.pdf$/i.test(lower)) return "application/pdf";
  if (/\.docx$/i.test(lower)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (/\.doc$/i.test(lower)) return "application/msword";
  return "application/octet-stream";
};

const shouldStartNewClaimFlow = (text: string) => {
  const normalized = text.replace(/\s+/g, "");
  const excludePatterns = [
    "继续报案",
    "恢复报案",
    "修改报案",
    "撤销报案",
    "取消报案",
    "不理赔了",
    "不赔了",
    "进度查询",
  ];

  if (excludePatterns.some((pattern) => normalized.includes(pattern))) {
    return false;
  }

  return (
    normalized.includes("我要报案") ||
    normalized.includes("我要新报案") ||
    normalized.includes("我要理赔") ||
    normalized.includes("申请理赔") ||
    normalized.includes("出险了") ||
    normalized.includes("发生事故") ||
    normalized.includes("报案")
  );
};

const hasMissingFields = (doc: Attachment) => {
  return doc.analysis?.missingFields && doc.analysis.missingFields.length > 0;
};

const STORAGE_KEY = "smartclaim_v9_history";
const MAX_FILES_PER_UPLOAD = 20;
const MAX_CONCURRENT_ANALYSIS = 10;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.82;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const createImageAttachment = (file: File) =>
  new Promise<Attachment>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(
        1,
        MAX_IMAGE_DIMENSION / Math.max(image.width, image.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ base64: "", type: file.type, name: file.name, url });
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
      resolve({
        base64: dataUrl.split(",")[1],
        type: "image/jpeg",
        name: file.name,
        url,
      });
    };
    image.onerror = async () => {
      const dataUrl = await readFileAsDataUrl(file);
      resolve({
        base64: dataUrl.split(",")[1],
        type: file.type,
        name: file.name,
        url,
      });
    };
    image.src = url;
  });

const createFileAttachment = async (file: File): Promise<Attachment> => {
  const dataUrl = await readFileAsDataUrl(file);
  return { base64: dataUrl.split(",")[1], type: file.type, name: file.name };
};

// --- Components ---

// Simple Card
const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = "", onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-4 relative overflow-hidden ${onClick ? "cursor-pointer hover:shadow-lg active:scale-95" : ""} ${className}`}
    >
      {children}
    </div>
  );
};

// Medical Data Display Component
const MedicalDataDisplay = ({ data }: { data: MedicalInvoiceData }) => {
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-4 text-xs space-y-4 border border-slate-100 shadow-inner">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
        <div>
          <span className="text-slate-400">医院:</span>{" "}
          <span className="font-bold text-slate-700 ml-1">
            {data.invoiceInfo?.hospitalName || "-"}
          </span>
        </div>
        <div>
          <span className="text-slate-400">姓名:</span>{" "}
          <span className="font-bold text-slate-700 ml-1">
            {data.basicInfo?.name || "-"}
          </span>
        </div>
        <div>
          <span className="text-slate-400">科室:</span>{" "}
          <span className="text-slate-600 ml-1">
            {data.basicInfo?.department || "-"}
          </span>
        </div>
        <div>
          <span className="text-slate-400">时间:</span>{" "}
          <span className="text-slate-600 ml-1">
            {data.invoiceInfo?.issueDate || "-"}
          </span>
        </div>
      </div>

      {/* Amounts */}
      <div className="bg-white rounded-lg p-3 border border-slate-100 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-slate-400 scale-90 origin-left">总金额</span>
          <span className="text-base font-bold text-slate-800">
            ¥{data.totalAmount || 0}
          </span>
        </div>
        <div className="h-8 w-px bg-slate-100"></div>
        <div className="flex flex-col items-end">
          <span className="text-slate-400 scale-90 origin-right">医保支付</span>
          <span className="text-slate-600">
            ¥{data.insurancePayment?.governmentFundPayment || 0}
          </span>
        </div>
        <div className="h-8 w-px bg-slate-100"></div>
        <div className="flex flex-col items-end">
          <span className="text-slate-400 scale-90 origin-right">个人支付</span>
          <span className="text-blue-600 font-bold">
            ¥{data.insurancePayment?.personalPayment || 0}
          </span>
        </div>
      </div>

      {/* Items List */}
      {data.chargeItems && data.chargeItems.length > 0 && (
        <div>
          <div className="text-slate-400 mb-2 font-bold scale-90 origin-left">
            收费明细
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {data.chargeItems.map((item, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1 last:border-0"
              >
                <div
                  className="flex-1 truncate mr-2 text-slate-600"
                  title={item.itemName}
                >
                  {item.itemName}
                </div>
                <div className="text-slate-400 scale-90 whitespace-nowrap">
                  {item.quantity} x {item.unitPrice}
                </div>
                <div className="w-16 text-right font-medium text-slate-700">
                  ¥{item.totalPrice}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Discharge Summary Data Display Component
const DischargeSummaryDisplay = ({ data }: { data: DischargeSummaryData }) => {
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-4 text-xs space-y-4 border border-slate-100 shadow-inner animate-enter">
      {/* Hospital Header */}
      <div className="text-center border-b border-slate-200 pb-2 mb-2">
        <div className="font-bold text-base text-slate-800">
          {data.hospital_info?.hospital_name}
        </div>
        <div className="text-slate-500 mt-0.5">
          {data.hospital_info?.department} - {data.document_type}
        </div>
      </div>

      {/* Patient Info Grid */}
      <div className="grid grid-cols-2 gap-2 bg-white p-2 rounded border border-slate-100">
        <div>
          <span className="text-slate-400">姓名:</span>{" "}
          <span className="font-bold ml-1">{data.patient_info?.name}</span>
        </div>
        <div>
          <span className="text-slate-400">性别/年龄:</span>{" "}
          <span className="ml-1">
            {data.patient_info?.gender} / {data.patient_info?.age}岁
          </span>
        </div>
        <div>
          <span className="text-slate-400">入院:</span>{" "}
          <span className="ml-1">
            {data.admission_details?.admission_date?.split(" ")[0]}
          </span>
        </div>
        <div>
          <span className="text-slate-400">出院:</span>{" "}
          <span className="ml-1">
            {data.discharge_details?.discharge_date?.split(" ")[0]} (
            {data.discharge_details?.hospital_stay_days}天)
          </span>
        </div>
      </div>

      {/* Admission Details */}
      {(data.admission_details?.main_symptoms_on_admission ||
        data.admission_details?.admission_condition_summary) && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
            <i className="fas fa-right-to-bracket text-blue-500"></i> 入院情况
          </div>
          <div className="bg-white p-2 rounded border border-slate-100 leading-relaxed text-slate-600">
            {data.admission_details?.main_symptoms_on_admission && (
              <div className="mb-1">
                <span className="text-slate-400">主诉:</span>{" "}
                {data.admission_details.main_symptoms_on_admission}
              </div>
            )}
            {data.admission_details?.admission_condition_summary && (
              <div>
                <span className="text-slate-400">查体:</span>{" "}
                {data.admission_details.admission_condition_summary}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diagnoses */}
      <div>
        <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
          <i className="fas fa-stethoscope text-blue-500"></i> 诊断信息
        </div>
        <div className="space-y-1">
          {data.diagnoses?.map((d, i) => (
            <div
              key={i}
              className="flex flex-col bg-white p-2 rounded border border-slate-100"
            >
              <div className="flex justify-between items-start">
                <span className="font-medium text-slate-700">
                  {d.diagnosis_name}
                </span>
                <span className="text-slate-400 text-[10px] px-1.5 py-0.5 bg-slate-100 rounded whitespace-nowrap">
                  {d.diagnosis_type}
                </span>
              </div>
              {d.notes && (
                <div className="text-[10px] text-slate-400 mt-1">
                  Note: {d.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Treatments & Surgery */}
      {data.main_treatments_during_hospitalization &&
        data.main_treatments_during_hospitalization.length > 0 && (
          <div>
            <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
              <i className="fas fa-syringe text-blue-500"></i> 诊疗操作
            </div>
            <div className="space-y-1">
              {data.main_treatments_during_hospitalization.map((t, i) => (
                <div
                  key={i}
                  className="bg-white p-2 rounded border border-slate-100"
                >
                  <div className="font-medium text-slate-700">
                    {t.treatment_name}
                  </div>
                  {t.description && (
                    <div className="text-slate-500 text-[10px] mt-0.5">
                      {t.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Course Summary */}
      {data.hospitalization_course_summary && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
            <i className="fas fa-file-waveform text-blue-500"></i> 住院经过
          </div>
          <p className="bg-white p-2 rounded border border-slate-100 leading-relaxed text-slate-600">
            {data.hospitalization_course_summary}
          </p>
        </div>
      )}

      {/* Discharge Condition */}
      {data.condition_at_discharge && (
        <div>
          <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
            <i className="fas fa-person-walking-arrow-right text-blue-500"></i>{" "}
            出院情况
          </div>
          <p className="bg-white p-2 rounded border border-slate-100 leading-relaxed text-slate-600">
            {data.condition_at_discharge}
          </p>
        </div>
      )}

      {/* Discharge Orders (Meds) */}
      {data.discharge_instructions?.medications &&
        data.discharge_instructions.medications.length > 0 && (
          <div>
            <div className="font-bold text-slate-700 mb-1 flex items-center gap-1">
              <i className="fas fa-pills text-blue-500"></i> 出院带药
            </div>
            <div className="bg-white rounded border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px]">
                  <tr>
                    <th className="p-2 font-normal">药品</th>
                    <th className="p-2 font-normal">用法</th>
                    <th className="p-2 font-normal">总量</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {data.discharge_instructions.medications.map((m, i) => (
                    <tr key={i}>
                      <td className="p-2 font-medium text-slate-700">
                        {m.med_name}
                        {m.notes && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {m.notes}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-slate-500">
                        {m.frequency} {m.route}
                      </td>
                      <td className="p-2 text-slate-500">
                        {m.dosage} x {m.duration}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Advice */}
      <div className="space-y-2">
        {data.discharge_instructions?.lifestyle_recommendations &&
          data.discharge_instructions.lifestyle_recommendations.length > 0 && (
            <div className="bg-yellow-50 p-2.5 rounded text-yellow-800 border border-yellow-100 text-[10px]">
              <div className="font-bold mb-1">
                <i className="fas fa-triangle-exclamation mr-1"></i>
                医嘱/生活建议
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {data.discharge_instructions.lifestyle_recommendations.map(
                  (r, i) => (
                    <li key={i}>{r}</li>
                  ),
                )}
              </ul>
            </div>
          )}

        {data.discharge_instructions?.follow_up_appointments &&
          data.discharge_instructions.follow_up_appointments.length > 0 && (
            <div className="bg-blue-50 p-2.5 rounded text-blue-800 border border-blue-100 flex gap-2">
              <i className="fas fa-calendar-check mt-0.5"></i>
              <div>
                <div className="font-bold mb-1">复诊建议</div>
                {data.discharge_instructions.follow_up_appointments.map(
                  (f, i) => (
                    <div key={i}>
                      {f.date_or_interval} - {f.department} {f.notes}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

// Generic OCR Data Display Component
const GenericOCRDisplay = ({ data }: { data: OCRData }) => {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs border border-slate-100 shadow-inner grid grid-cols-2 gap-2">
      {Object.entries(data).map(([k, v]) => (
        <div
          key={k}
          className="flex flex-col bg-white p-2 rounded border border-slate-50"
        >
          <span className="text-slate-400 uppercase scale-90 origin-left mb-0.5">
            {k}
          </span>
          <span className="font-bold text-slate-700 truncate" title={String(v)}>
            {String(v)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 意图识别 UI 组件
// ============================================================================

/** 理赔进度卡片 */
const ClaimProgressCard = ({ data }: { data: ClaimProgressInfo }) => {
  const getStatusColor = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.PAID:
        return "text-green-500";
      case ClaimStatus.REJECTED:
        return "text-red-500";
      case ClaimStatus.REVIEWING:
        return "text-blue-500";
      default:
        return "text-orange-500";
    }
  };

  return (
    <div className="mt-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fas fa-chart-line text-blue-500"></i>
            <span className="font-bold text-slate-700">理赔进度</span>
          </div>
          <span className={`text-sm font-bold ${getStatusColor(data.status)}`}>
            {data.statusLabel}
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* 进度条 */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>处理进度</span>
            <span>{data.progress}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${data.progress}%` }}
            />
          </div>
        </div>

        {/* 当前阶段 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-slate-600">
            当前阶段：
            <span className="font-medium text-slate-800">
              {data.currentStage}
            </span>
          </span>
        </div>

        {/* 时间线 */}
        {data.timeline && data.timeline.length > 0 && (
          <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
            {data.timeline.slice(-3).map((event, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1 ${event.status === "completed" ? "bg-green-500" : event.status === "active" ? "bg-blue-500" : "bg-slate-300"}`}
                ></div>
                <div className="flex-1">
                  <div className="font-medium text-slate-700">
                    {event.label}
                  </div>
                  <div className="text-slate-500">{event.description}</div>
                  <div className="text-slate-400 text-[10px]">{event.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** 材料清单卡片 */
const MaterialsListCard = ({
  data,
  onViewSample,
}: {
  data: MaterialsListInfo;
  onViewSample?: (url: string, name: string, ossKey?: string) => void;
}) => {
  const [showAll, setShowAll] = useState(false);
  const requiredMaterials = data.materials.filter((m) => m.required);
  const optionalMaterials = data.materials.filter((m) => !m.required);
  const displayMaterials = showAll
    ? data.materials
    : data.materials.slice(0, 5);

  return (
    <div className="mt-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <i className="fas fa-clipboard-check text-emerald-500"></i>
          <span className="font-bold text-slate-700">
            {data.claimType} - 材料清单
          </span>
        </div>
      </div>

      <div className="p-4">
        {/* 必需材料 */}
        <div className="mb-3">
          <div className="text-xs font-bold text-slate-500 mb-2">
            必需材料 ({requiredMaterials.length}项)
          </div>
          <div className="space-y-2">
            {displayMaterials
              .filter((m) => m.required)
              .map((material, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100"
                >
                  <div className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-700">
                      {material.name}
                    </div>
                    {material.description && (
                      <div className="text-xs text-slate-500">
                        {material.description}
                      </div>
                    )}
                  </div>
                  {material.sampleUrl && (
                    <button
                      onClick={() =>
                        onViewSample?.(material.sampleUrl!, material.name, material.ossKey)
                      }
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      <i className="fas fa-eye"></i> 示例
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* 可选材料 */}
        {optionalMaterials.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-slate-500 mb-2">
              补充材料 ({optionalMaterials.length}项)
            </div>
            <div className="space-y-1">
              {displayMaterials
                .filter((m) => !m.required)
                .map((material, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg"
                  >
                    <i className="fas fa-circle text-[6px] text-slate-400"></i>
                    <span className="text-sm text-slate-600">
                      {material.name}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 展开/收起按钮 */}
        {data.materials.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full py-2 text-xs text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showAll ? "收起" : `查看全部 ${data.materials.length} 项材料`}
          </button>
        )}
      </div>
    </div>
  );
};

/** 缺失材料卡片 */
const MissingMaterialsCard = ({ data }: { data: MissingMaterialsInfo }) => {
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "bg-red-50 border-red-200 text-red-700";
      case "medium":
        return "bg-orange-50 border-orange-200 text-orange-700";
      default:
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
    }
  };

  return (
    <div
      className={`mt-3 rounded-xl shadow-sm border overflow-hidden ${getUrgencyColor(data.urgency)}`}
    >
      <div className="px-4 py-3 border-b border-current/10">
        <div className="flex items-center gap-2">
          <i className="fas fa-exclamation-triangle"></i>
          <span className="font-bold">
            还缺 {data.missingItems.length} 项材料
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-2">
          {data.missingItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-current/20 text-current text-xs flex items-center justify-center font-bold">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs opacity-80">{item.description}</div>
              </div>
            </div>
          ))}
        </div>

        {data.deadline && (
          <div className="mt-3 pt-3 border-t border-current/10 text-sm">
            <i className="fas fa-clock mr-1"></i>
            补交截止：<span className="font-bold">{data.deadline}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/** 保费影响卡片 */
const PremiumImpactCard = ({ data }: { data: PremiumImpactInfo }) => {
  const isIncrease = data.premiumChange.direction === "increase";
  const isDecrease = data.premiumChange.direction === "decrease";

  return (
    <div className="mt-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <i className="fas fa-calculator text-purple-500"></i>
          <span className="font-bold text-slate-700">保费影响预估</span>
        </div>
      </div>

      <div className="p-4">
        {/* NCD 变化 */}
        <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">当前 NCD</div>
            <div className="text-xl font-bold text-slate-700">
              {data.currentNCD}
            </div>
          </div>
          <i className="fas fa-arrow-right text-slate-400"></i>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">下年 NCD</div>
            <div className="text-xl font-bold text-slate-700">
              {data.nextYearNCD}
            </div>
          </div>
        </div>

        {/* 保费变化 */}
        <div
          className={`p-3 rounded-lg mb-3 ${isIncrease ? "bg-red-50 border border-red-100" : isDecrease ? "bg-green-50 border border-green-100" : "bg-slate-50"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">预估保费变化</span>
            <span
              className={`text-lg font-bold ${isIncrease ? "text-red-500" : isDecrease ? "text-green-500" : "text-slate-600"}`}
            >
              {isIncrease ? "+" : ""}
              {data.premiumChange.amount}元 ({isIncrease ? "+" : ""}
              {data.premiumChange.percentage}%)
            </span>
          </div>
        </div>

        {/* 说明 */}
        <div className="text-xs text-slate-500 mb-3">{data.explanation}</div>

        {/* 建议 */}
        {data.suggestions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-500 mb-2">建议</div>
            <ul className="space-y-1">
              {data.suggestions.map((suggestion, idx) => (
                <li
                  key={idx}
                  className="text-xs text-slate-600 flex items-start gap-1"
                >
                  <i className="fas fa-lightbulb text-yellow-500 mt-0.5"></i>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Materials List Card in Conversation
const MaterialsMessageCard = ({
  materials,
  caseNumber,
  onUpload,
  onViewSample,
  onBatchUpload,
}: {
  materials: CalculatedMaterial[];
  caseNumber?: string;
  onUpload: (id: string) => void;
  onViewSample: (url: string, ossKey?: string) => void;
  onBatchUpload: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const requiredCount = materials.filter((m) => m.required).length;

  const displayMaterials = isExpanded ? materials : materials.slice(0, 3);
  const hasMore = materials.length > 3;

  return (
    <div className="mt-4 w-full max-w-sm sm:max-w-md animate-enter">
      <div className="bg-white/90 backdrop-blur-xl rounded-[24px] shadow-xl border border-white/60 overflow-hidden flex flex-col">
        {/* Header - Success State */}
        <div className="px-5 py-4 bg-gradient-to-br from-emerald-50 to-white border-b border-emerald-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20 flex items-center justify-center text-white text-lg">
              <i className="fas fa-check-circle"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">报案成功</h3>
              {caseNumber && (
                <p className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md mt-1 inline-block border border-emerald-100">
                  #{caseNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Banner */}
        <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100/30">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-blue-700 font-bold flex items-center gap-1.5">
              <i className="fas fa-clipboard-list text-blue-500"></i>
              待传: {requiredCount} 份必填 / 共 {materials.length} 份
            </span>
            <div className="flex gap-1">
              {[...Array(materials.length)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i < requiredCount ? "bg-red-400" : "bg-blue-300"}`}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* Materials Scroll Area */}
        <div className="p-4 space-y-2.5 overflow-hidden">
          {displayMaterials.map((mat, idx) => (
            <div
              key={mat.materialId}
              className={`group p-3 rounded-2xl border transition-all duration-300 ${
                mat.required
                  ? "bg-red-50/30 border-red-100 hover:border-red-200"
                  : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm ${
                    mat.required
                      ? "bg-red-500 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 truncate">
                      {mat.materialName}
                    </span>
                    {mat.required && (
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">
                        Required
                      </span>
                    )}
                  </div>
                  {mat.materialDescription && (
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all cursor-default">
                      {mat.materialDescription}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2.5">
                    {mat.sampleUrl && (
                      <button
                        onClick={() => onViewSample(mat.sampleUrl!, mat.ossKey)}
                        className="text-[10px] text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <i className="fas fa-eye text-[9px]"></i> 示例图
                      </button>
                    )}
                    <button
                      onClick={() => onUpload(mat.materialId)}
                      className="text-[10px] text-blue-500 font-bold hover:text-blue-600 flex items-center gap-1 active:scale-95 transition-transform ml-auto bg-blue-50 px-2 py-1 rounded-md"
                    >
                      <i className="fas fa-arrow-up-from-bracket text-[9px]"></i>{" "}
                      点击上传
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full py-2.5 text-[11px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-100 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isExpanded ? (
                <>
                  <i className="fas fa-chevron-up"></i> 收起材料列表
                </>
              ) : (
                <>
                  <i className="fas fa-chevron-down"></i> 查看其余{" "}
                  {materials.length - 3} 份材料
                </>
              )}
            </button>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 pt-1 bg-white flex flex-col gap-2">
          <button
            onClick={onBatchUpload}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-wand-magic-sparkles"></i>{" "}
            批量上传（智能自动分类）
          </button>
          <button
            onClick={() => {}}
            className="w-full py-2.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            稍后在“理赔历史”中补充
          </button>
        </div>
      </div>
    </div>
  );
};

// File Inspector Item Component - handles signed URL fetching for thumbnails
const FileInspectorItem = ({
  doc,
  index,
  isError,
  failedImages,
  setFailedImages,
  onPreview,
  onToggleExpand,
  isExpanded,
  onReplaceFile,
}: {
  doc: Attachment;
  index: number;
  isError: boolean;
  failedImages: Set<number>;
  setFailedImages: React.Dispatch<React.SetStateAction<Set<number>>>;
  onPreview: (doc: Attachment) => void;
  onToggleExpand: (index: number) => void;
  isExpanded: boolean;
  onReplaceFile: () => void;
}) => {
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  useEffect(() => {
    let active = true;
    if (doc.ossKey && !doc.url) {
      setIsLoadingUrl(true);
      getSignedUrl(doc.ossKey)
        .then((url) => {
          if (active) setSignedUrl(url);
        })
        .catch(() => {
          if (active) setSignedUrl("");
        })
        .finally(() => {
          if (active) setIsLoadingUrl(false);
        });
    }
    return () => {
      active = false;
    };
  }, [doc.ossKey, doc.url]);

  const imgSrc =
    signedUrl ||
    doc.url ||
    (doc.base64 ? `data:${doc.type};base64,${doc.base64}` : "");
  const showImage =
    doc.type?.includes("image") && imgSrc && !failedImages.has(index);

  return (
    <div
      className={`p-4 rounded-xl shadow-sm border flex gap-4 animate-enter ${isError ? "bg-red-50 border-red-200" : "bg-white border-slate-100"}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className="w-20 h-20 rounded-lg bg-slate-100 shrink-0 overflow-hidden border border-slate-100 relative group cursor-pointer"
        onClick={() => onPreview(doc)}
      >
        {showImage ? (
          <img
            src={imgSrc}
            className={`w-full h-full object-cover transition-transform group-hover:scale-110 ${isError ? "opacity-80" : ""}`}
            onError={() => setFailedImages((prev) => new Set(prev).add(index))}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">
            {isLoadingUrl ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <i className={`fas ${getDocIcon(doc.name)}`}></i>
            )}
          </div>
        )}

        {/* Zoom Hint Overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <i className="fas fa-magnifying-glass-plus text-white text-lg"></i>
        </div>

        {isError && (
          <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center pointer-events-none">
            <i className="fas fa-triangle-exclamation text-red-500 text-2xl drop-shadow-sm"></i>
          </div>
        )}
      </div>
      <div
        className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer"
        onClick={() => onToggleExpand(index)}
      >
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-slate-800 text-sm truncate mb-1">
            {doc.name}
          </h4>
          {isError && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReplaceFile();
              }}
              className="text-[10px] bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded-full font-bold transition-colors"
            >
              更换文件
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {isError ? (
            <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-md font-bold border border-red-200 flex items-center gap-1">
              <i className="fas fa-times-circle"></i> 缺失信息
            </span>
          ) : (
            <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-md font-semibold border border-blue-100">
              {doc.analysis?.category || "分析中..."}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1 text-blue-500 text-xs font-bold select-none">
          {isExpanded ? "收起详情" : "查看识别详情"}
          <i
            className={`fas fa-chevron-${isExpanded ? "up" : "down"} transition-transform`}
          ></i>
        </div>

        {isExpanded && doc.analysis && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="cursor-auto animate-enter origin-top"
          >
            {doc.analysis.medicalData ? (
              <MedicalDataDisplay data={doc.analysis.medicalData} />
            ) : doc.analysis.dischargeSummaryData ? (
              <DischargeSummaryDisplay
                data={doc.analysis.dischargeSummaryData}
              />
            ) : (
              <GenericOCRDisplay data={doc.analysis.ocr} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Image Previewer Component
const ImagePreview = ({ attachment }: { attachment: Attachment }) => {
  const [scale, setScale] = useState(1);
  const [signedUrl, setSignedUrl] = useState("");

  useEffect(() => {
    let active = true;
    if (attachment.ossKey) {
      getSignedUrl(attachment.ossKey)
        .then((url) => {
          if (active) setSignedUrl(url);
        })
        .catch(() => {
          if (active) setSignedUrl("");
        });
    }
    return () => {
      active = false;
    };
  }, [attachment.ossKey]);

  const src =
    signedUrl ||
    attachment.url ||
    (attachment.base64
      ? `data:${attachment.type};base64,${attachment.base64}`
      : "");

  return (
    <div className="relative w-full h-full flex flex-col bg-black/95">
      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20">
        <button
          onClick={() => setScale((s) => Math.max(0.1, s - 0.1))}
          className="text-white hover:scale-110 transition"
        >
          <i className="fas fa-minus"></i>
        </button>
        <span className="text-white font-mono text-sm w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(5, s + 0.1))}
          className="text-white hover:scale-110 transition"
        >
          <i className="fas fa-plus"></i>
        </button>
        <div className="w-px h-4 bg-white/20 mx-2"></div>
        <button
          onClick={() => setScale(1)}
          className="text-xs text-white/70 hover:text-white uppercase font-bold tracking-wider"
        >
          Reset
        </button>
      </div>

      {/* Scroll Container */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <img
          src={src}
          style={{
            transform: `scale(${scale})`,
            transition: "transform 0.1s ease-out",
          }}
          className="max-w-full max-h-full object-contain"
          alt={attachment.name}
        />
      </div>
    </div>
  );
};

// File Type Detection Utility
type FileType = "image" | "pdf" | "word" | "unknown";

const detectFileType = (url: string): FileType => {
  const lowerUrl = url.toLowerCase();
  const extension = lowerUrl.split("?")[0].split("#")[0].split(".").pop() || "";

  // Image formats
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tif", "tiff"].includes(extension)) {
    return "image";
  }

  // PDF
  if (extension === "pdf") {
    return "pdf";
  }

  // Word documents
  if (extension === "doc" || extension === "docx") {
    return "word";
  }

  // Check URL patterns for common file hosting services
  if (lowerUrl.includes("/pdf/") || lowerUrl.includes(".pdf?")) {
    return "pdf";
  }

  return "unknown";
};

const extractOssKeyFromUrl = (url?: string): string | undefined => {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
    return pathname || undefined;
  } catch {
    return undefined;
  }
};

const getFileIcon = (fileType: FileType): string => {
  switch (fileType) {
    case "image":
      return "fa-image";
    case "pdf":
      return "fa-file-pdf";
    case "word":
      return "fa-file-word";
    default:
      return "fa-file";
  }
};

const getFileTypeLabel = (fileType: FileType): string => {
  switch (fileType) {
    case "image":
      return "图片";
    case "pdf":
      return "PDF文档";
    case "word":
      return "Word文档";
    default:
      return "文件";
  }
};

// Sample Preview Modal Component
interface SamplePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleUrl: string;
  sampleName: string;
  sampleOssKey?: string;
}

const SamplePreviewModal: React.FC<SamplePreviewModalProps> = ({
  isOpen,
  onClose,
  sampleUrl,
  sampleName,
  sampleOssKey,
}) => {
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileType = detectFileType(sampleUrl || sampleOssKey || "");

  useEffect(() => {
    if (!isOpen) {
      setSignedUrl("");
      setIsLoading(true);
      setLoadError(null);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    const resolvedOssKey =
      sampleOssKey ||
      (sampleUrl.includes("oss-") || sampleUrl.includes("aliyuncs")
        ? extractOssKeyFromUrl(sampleUrl)
        : undefined);

    if (!resolvedOssKey) {
      setSignedUrl(sampleUrl);
      setIsLoading(false);
      return;
    }

    getSignedUrl(resolvedOssKey)
      .then((url) => {
        setSignedUrl(url);
        setIsLoading(false);
      })
      .catch(() => {
        setSignedUrl(sampleUrl);
        setIsLoading(false);
      });
  }, [isOpen, sampleOssKey, sampleUrl]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderPreview = () => {
    const url = signedUrl || sampleUrl;

    switch (fileType) {
      case "image":
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-black/50">
            <img
              src={url}
              alt={sampleName}
              className="max-w-full max-h-full object-contain"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setLoadError("图片加载失败");
              }}
            />
          </div>
        );

      case "pdf":
        return (
          <div className="w-full h-full bg-white">
            <iframe
              src={`${url}#toolbar=1&navpanes=1`}
              className="w-full h-full border-0"
              title={sampleName}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setLoadError("PDF加载失败");
              }}
            />
          </div>
        );

      case "word":
        // Use Microsoft Office Online Viewer for Word documents
        const encodedUrl = encodeURIComponent(url);
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
        return (
          <div className="w-full h-full bg-white">
            <iframe
              src={officeViewerUrl}
              className="w-full h-full border-0"
              title={sampleName}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setLoadError("文档加载失败");
              }}
            />
          </div>
        );

      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-8">
            <i className="fas fa-file-circle-question text-6xl mb-4"></i>
            <p className="text-lg mb-2">无法预览此文件类型</p>
            <p className="text-sm text-white/60 mb-4">
              该文件格式不支持在线预览，请下载后查看
            </p>
            <a
              href={url}
              download
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <i className="fas fa-download"></i>
              下载文件
            </a>
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex flex-col animate-enter"
      onClick={onClose}
    >
      {/* Header */}
      <div className="h-16 bg-black/80 text-white flex items-center justify-between px-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <i className={`fas ${getFileIcon(fileType)} text-lg`}></i>
          </div>
          <div>
            <h3 className="font-bold truncate max-w-md">{sampleName}</h3>
            <p className="text-xs text-white/60">{getFileTypeLabel(fileType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={signedUrl || sampleUrl}
            download
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="fas fa-download"></i>
            下载
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <i className="fas fa-xmark text-lg"></i>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 z-10">
            <div className="w-12 h-12 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p>加载中...</p>
          </div>
        )}

        {loadError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/80 p-8">
            <i className="fas fa-triangle-exclamation text-5xl text-yellow-500 mb-4"></i>
            <p className="text-lg mb-2">{loadError}</p>
            <p className="text-sm text-white/60 mb-4">
              无法加载该文件，请尝试下载后查看
            </p>
            <a
              href={signedUrl || sampleUrl}
              download
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <i className="fas fa-download"></i>
              下载文件
            </a>
          </div>
        ) : (
          renderPreview()
        )}
      </div>

      {/* Footer with tips */}
      <div className="h-12 bg-black/80 text-white/60 flex items-center justify-center px-6 border-t border-white/10 shrink-0 text-xs">
        <i className="fas fa-info-circle mr-2"></i>
        支持预览图片、PDF 和 Word 文档格式
      </div>
    </div>
  );
};

// Hospital Select Field Component
interface HospitalSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hospitals: HospitalInfo[];
  isLoading: boolean;
  error?: string;
}

const HospitalSelectField: React.FC<HospitalSelectFieldProps> = ({
  value,
  onChange,
  placeholder = "请选择或搜索医院",
  hospitals,
  isLoading,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchQuery(value || "");
  }, [value]);

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 筛选医院
  const filteredHospitals = hospitals.filter((hospital) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      hospital.name.toLowerCase().includes(query) ||
      hospital.city.toLowerCase().includes(query) ||
      hospital.province.toLowerCase().includes(query) ||
      (hospital.address && hospital.address.toLowerCase().includes(query))
    );
  });

  // 优先显示合规医院
  const sortedHospitals = [...filteredHospitals].sort((a, b) => {
    if (a.qualifiedForInsurance === b.qualifiedForInsurance) return 0;
    return a.qualifiedForInsurance ? -1 : 1;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelectHospital = (hospital: HospitalInfo) => {
    setSearchQuery(hospital.name);
    onChange(hospital.name);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const getProvinceLabel = (provinceCode: string): string => {
    const provinceMap: Record<string, string> = {
      beijing: "北京",
      tianjin: "天津",
      hebei: "河北",
      shanxi: "山西",
      neimenggu: "内蒙古",
      liaoning: "辽宁",
      jilin: "吉林",
      heilongjiang: "黑龙江",
      shanghai: "上海",
      jiangsu: "江苏",
      zhejiang: "浙江",
      anhui: "安徽",
      fujian: "福建",
      jiangxi: "江西",
      shandong: "山东",
      henan: "河南",
      hubei: "湖北",
      hunan: "湖南",
      guangdong: "广东",
      guangxi: "广西",
      hainan: "海南",
      chongqing: "重庆",
      sichuan: "四川",
      guizhou: "贵州",
      yunnan: "云南",
      xizang: "西藏",
      shaanxi: "陕西",
      gansu: "甘肃",
      qinghai: "青海",
      ningxia: "宁夏",
      xinjiang: "新疆",
    };
    return provinceMap[provinceCode] || provinceCode;
  };

  const inputClass = `w-full px-4 py-3 rounded-xl bg-white/50 border outline-none text-slate-700 font-medium transition-colors ${
    error
      ? "border-red-300 bg-red-50/30"
      : "border-white/60 focus:border-blue-400"
  }`;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={inputClass}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          ) : (
            <i className="fas fa-hospital text-xs"></i>
          )}
        </div>
      </div>

      {/* 下拉列表 */}
      {isOpen && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {sortedHospitals.length > 0 ? (
            <div className="py-1">
              {sortedHospitals.slice(0, 50).map((hospital) => (
                <button
                  key={hospital.id}
                  type="button"
                  onClick={() => handleSelectHospital(hospital)}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-slate-700 truncate">
                          {hospital.name}
                        </span>
                        {hospital.qualifiedForInsurance ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100 shrink-0">
                            合规
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-100 shrink-0">
                            不合规
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{getProvinceLabel(hospital.province)}</span>
                        <span>·</span>
                        <span>{hospital.city}</span>
                        <span>·</span>
                        <span>{hospital.level}</span>
                        <span>·</span>
                        <span>{hospital.type}</span>
                      </div>
                      {hospital.address && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {hospital.address}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {sortedHospitals.length > 50 && (
                <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
                  显示前50条结果，请输入更多关键词缩小范围
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              <div className="mx-auto h-8 w-8 text-gray-300 mb-2 flex items-center justify-center">
                <i className="fas fa-hospital text-2xl"></i>
              </div>
              <p className="text-gray-600 mb-1">未找到匹配的医院</p>
              <p className="text-xs text-gray-400">
                {searchQuery
                  ? "您可以直接输入医院名称"
                  : "请输入关键词搜索医院"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Auth Component
const AuthScreen = ({
  onLogin,
}: {
  onLogin: (name: string, gender: string) => void;
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("先生");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleSubmit = () => {
    setError("");

    if (code.trim() !== "ant") {
      setError("邀请码无效，请重试");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!name.trim()) {
      setError("请输入您的姓名");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    onLogin(name, gender);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-50">
      <div
        className={`glass-panel max-w-sm w-full p-8 rounded-[32px] flex flex-col items-center shadow-2xl transition-transform ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
      >
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-6 overflow-hidden">
          <img
            src="https://gw.alipayobjects.com/mdn/rms/afts/img/A*BAhDQLCn3-wAAAAAAAAAAAAAARQnAQ"
            alt="Logo"
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          SmartClaim AI
        </h1>
        <p className="text-sm text-slate-500 mb-8 font-medium">
          蚂蚁数科｜保险科技
        </p>

        {/* Form */}
        <div className="w-full space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1">
              邀请码
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-white/60 focus:bg-white focus:border-blue-400 outline-none text-transparent caret-blue-500 transition-all font-medium text-center relative z-0"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                {code ? (
                  <span className="text-xl tracking-widest filter drop-shadow-sm">
                    {Array.from(code)
                      .map(() => "😊")
                      .join("")}
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">
                    请输入邀请码
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 ml-1">
              姓名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="您的称呼"
              className="w-full px-4 py-3 rounded-xl bg-white/50 border border-white/60 focus:bg-white focus:border-blue-400 outline-none text-slate-700 transition-all font-medium placeholder-slate-400 text-center"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {["先生", "女士"].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${gender === g ? "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30" : "bg-white/40 border-white/40 text-slate-500 hover:bg-white/60"}`}
              >
                {g}
              </button>
            ))}
          </div>

          {error && (
            <div className="text-red-500 text-xs font-bold text-center mt-2 flex items-center justify-center gap-1 animate-enter">
              <i className="fas fa-circle-exclamation"></i> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="w-full py-4 mt-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-transform hover:shadow-2xl hover:shadow-blue-500/30"
          >
            进入体验 <i className="fas fa-arrow-right ml-2 text-sm"></i>
          </button>
        </div>
      </div>

      {/* Styles for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export const App: React.FC = () => {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState("");
  const [userGender, setUserGender] = useState("");

  // --- State ---
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "您好！我是 **SmartClaim AI**。✨\n\n请告诉我您遇到了什么问题，或者点击下方按钮快速开始。",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStatusText, setVoiceStatusText] = useState("请直接描述您的事故情况");
  const [voiceOutputChannel, setVoiceOutputChannel] =
    useState<VoiceOutputChannel>("connecting");
  const [showReportingForm, setShowReportingForm] = useState(false);
  const [selectedDetailClaim, setSelectedDetailClaim] =
    useState<HistoricalClaim | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    active: number;
    currentFile?: string;
  }>({ total: 0, completed: 0, failed: 0, active: 0 });
  const [userLocation, setUserLocation] = useState<
    { latitude: number; longitude: number } | undefined
  >();
  const [fileInspectData, setFileInspectData] = useState<Attachment[] | null>(
    null,
  );
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );
  const [expandedDocIndex, setExpandedDocIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [messageQuickActions, setMessageQuickActions] = useState<
    Record<
      string,
      {
        reaction?: "like" | "dislike";
        copied?: boolean;
        shared?: boolean;
      }
    >
  >({});
  const [documentMaterialSelections, setDocumentMaterialSelections] = useState<
    Record<string, string>
  >({});
  const [reassigningDocumentKey, setReassigningDocumentKey] = useState<
    string | null
  >(null);

  // Policy Selection State
  const [policySearchTerm, setPolicySearchTerm] = useState("");
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);
  const [isClaimsExpanded, setIsClaimsExpanded] = useState(false);

  // Claim Selection State
  const [claimSearchTerm, setClaimSearchTerm] = useState("");

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Form State
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("车辆理赔");
  const [isRecordingForm, setIsRecordingForm] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Dynamic Intake Form State
  const [selectedIntakeConfig, setSelectedIntakeConfig] =
    useState<IntakeConfig | null>(null);
  const [selectedPolicyForForm, setSelectedPolicyForForm] =
    useState<Policy | null>(null);
  const [dynamicFormValues, setDynamicFormValues] = useState<
    Record<string, any>
  >({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 动态材料清单状态
  const [calculatedMaterials, setCalculatedMaterials] = useState<Array<{
    materialId: string;
    materialName: string;
    materialDescription?: string;
    sampleUrl?: string;
    ossKey?: string;
    required: boolean;
    source: string;
    sourceDetails: string;
  }> | null>(null);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(false);
  const [showMaterialsList, setShowMaterialsList] = useState(true);

  // 报案后材料清单弹窗状态
  const [submittedClaimId, setSubmittedClaimId] = useState<string | null>(null);
  const [submittedMaterials, setSubmittedMaterials] = useState<
    CalculatedMaterial[]
  >([]);

  // 全局材料目录（报案前上传时使用）
  const [globalMaterialsCatalog, setGlobalMaterialsCatalog] = useState<QuickAnalyzeMaterial[]>([]);
  const [previewSampleUrl, setPreviewSampleUrl] = useState<string | null>(null);
  const [samplePreviewData, setSamplePreviewData] = useState<{
    isOpen: boolean;
    url: string;
    name: string;
    ossKey?: string;
  }>({ isOpen: false, url: "", name: "" });
  const materialUploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMaterialId, setUploadingMaterialId] = useState<string | null>(
    null,
  );

  // 医院数据状态
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const policyUploadRef = useRef<HTMLInputElement>(null);
  // Browser-SpeechRecognition fallback path (only used when the server voice
  // service is unreachable). Server mode is fully owned by useVoiceController.
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceTransportModeRef = useRef<VoiceTransportMode | null>(null);
  const shouldResumeVoiceRecognitionRef = useRef(false);
  const isVoiceModeRef = useRef(false);
  const voiceNetworkRetryCountRef = useRef(0);

  // -----------------------------------------------------------------------
  // Phase 1 real-time voice stack: turn-state driven controller.
  // Owns WebSocket, mic capture, and TTS playback for the server transport
  // path. Callbacks are fresh closures each render (hook stores them in a
  // ref internally so the WebSocket handlers always see the latest).
  // -----------------------------------------------------------------------
  const voiceController = useVoiceController({
    userName,
    onSttText: (text, isFinal) => {
      if (isFinal && text.trim()) {
        setVoiceTranscript("");
        setIsTranscribing(false);
        appendVoiceUserMessage(text);
      } else {
        setVoiceTranscript(text);
      }
    },
    onLlmText: (text) => {
      if (text && text.trim()) {
        appendAssistantMessageSilently(text);
      }
    },
    onError: (message) => {
      appendAssistantMessage(message);
    },
    onToolCallStart: (toolName) => {
      if (toolName) setVoiceStatusText(`正在${toolName}...`);
    },
    onToolCallEnd: () => {
      // Status text re-derived from turnState via the effect below.
    },
    onSessionEnded: () => {
      // A claim was submitted or terminal cleanup — drop out of voice mode.
      setIsVoiceMode(false);
      voiceTransportModeRef.current = null;
    },
    onServiceMessage: (msg) => {
      if (msg) appendAssistantMessageSilently(msg, { role: "system" });
    },
  });

  // Mirror turnState → UI status line + output channel badge.
  useEffect(() => {
    const state = voiceController.turnState;
    setVoiceStatusText(voiceController.statusText);
    if (state === "SPEAKING") {
      setVoiceOutputChannel(
        voiceController.services?.ttsMode === "aliyun" ? "aliyun" : "browser",
      );
    } else if (state === "LISTENING") {
      setVoiceOutputChannel(
        voiceController.services?.ttsMode === "aliyun" ? "aliyun" : "connecting",
      );
    }
  }, [voiceController.turnState, voiceController.statusText, voiceController.services]);

  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);

  const [claimState, setClaimState] = useState<ClaimState>(() => {
    let initialHistory = MOCK_HISTORICAL_CLAIMS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) initialHistory = JSON.parse(saved);
    } catch {
      initialHistory = MOCK_HISTORICAL_CLAIMS;
    }
    return {
      status: ClaimStatus.REPORTING,
      reportInfo: {},
      requiredDocs: [],
      documents: [],
      historicalClaims: initialHistory,
    };
  });

  // --- Effects ---
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(claimState.historicalClaims),
      );
    } catch {
      null;
    }
  }, [claimState.historicalClaims]);

  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
  }, [isVoiceMode]);

  // 启动时加载全局材料目录，用于报案前上传时的 AI 分类
  useEffect(() => {
    configService.loadMaterials().then((materials) => {
      setGlobalMaterialsCatalog(
        materials.map((m) => ({
          materialId: m.id,
          materialName: m.name,
          materialDescription: m.description,
        })),
      );
    }).catch(() => {
      // 加载失败不阻断主流程，quickAnalyze 退回自由文本识别
    });
  }, []);

  useEffect(() => {
    // Unmount cleanup for the browser-fallback voice path. The server-side
    // transport (WebSocket + AudioWorklet + TTS player) is owned by
    // useVoiceController and cleans itself up via its own unmount effect.
    return () => {
      shouldResumeVoiceRecognitionRef.current = false;
      voiceNetworkRetryCountRef.current = 0;
      speechRecognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    setClaimState((prev) => ({
      ...prev,
      claimant: {
        ...prev.claimant,
        userId: userName || prev.claimant?.userId,
        username: userName || prev.claimant?.username,
      },
    }));
  }, [userName]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => console.warn("Location access denied", err),
      );
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isAnalyzing, isLoading]);

  useEffect(() => {
    // Reset expansion when modal closes
    if (!fileInspectData) {
      setExpandedDocIndex(null);
    }
  }, [fileInspectData]);

  // 加载医院数据
  useEffect(() => {
    const fetchHospitals = async () => {
      setIsLoadingHospitals(true);
      try {
        const response = await fetch("/api/hospital-info");
        if (response.ok) {
          const data = await response.json();
          setHospitals(data || []);
        } else {
          console.warn("Failed to fetch hospitals:", response.status);
          setHospitals([]);
        }
      } catch (error) {
        console.error("Error fetching hospitals:", error);
        setHospitals([]);
      } finally {
        setIsLoadingHospitals(false);
      }
    };
    fetchHospitals();
  }, []);

  // 动态计算理赔材料清单
  useEffect(() => {
    const calculateMaterials = async () => {
      if (!selectedIntakeConfig?.claimMaterials?.enableDynamicCalculation) {
        setCalculatedMaterials(null);
        return;
      }
      if (!selectedPolicyForForm) return;

      const claimItemFieldId =
        selectedIntakeConfig.claimMaterials.claimItemFieldId || "claim_item";
      const accidentCauseFieldId =
        selectedIntakeConfig.claimMaterials.accidentCauseFieldId ||
        "accident_reason";

      const claimItemValue = dynamicFormValues[claimItemFieldId];
      const accidentCauseValue = dynamicFormValues[accidentCauseFieldId];

      if (!claimItemValue) {
        setCalculatedMaterials(null);
        return;
      }

      setIsMaterialsLoading(true);
      try {
        const claimItemIds = Array.isArray(claimItemValue)
          ? claimItemValue
          : [claimItemValue];

        const productResponse = await fetch(
          `/api/products/${encodeURIComponent(selectedPolicyForForm.productCode)}`,
        );
        const product = productResponse.ok
          ? await productResponse.json()
          : null;
        const categoryCode =
          product?.racewayId || product?.categoryLevel3Code || "";

        const response = await fetch("/api/claim-materials/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productCode: selectedPolicyForForm.productCode,
            categoryCode,
            claimItemIds,
            accidentCauseId: accidentCauseValue || undefined,
          }),
        });

        const result = await response.json();
        if (result.success && result.materials) {
          setCalculatedMaterials(result.materials);
        } else {
          setCalculatedMaterials(null);
        }
      } catch (error) {
        console.error("Failed to calculate materials:", error);
        setCalculatedMaterials(null);
      } finally {
        setIsMaterialsLoading(false);
      }
    };

    const timer = setTimeout(calculateMaterials, 300);
    return () => clearTimeout(timer);
  }, [dynamicFormValues, selectedIntakeConfig, selectedPolicyForForm]);

  const handleViewAttachments = (
    attachments: Attachment[],
    context: string,
  ) => {
    setFileInspectData(attachments);
    setFailedImages(new Set());
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: "查看材料",
      userName,
      userGender,
      inputData: {
        context,
        count: attachments.length,
        names: attachments.slice(0, 5).map((item) => item.name),
      },
    });
  };

  const handlePreviewAttachment = (attachment: Attachment, context: string) => {
    setPreviewAttachment(attachment);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: "预览材料",
      userName,
      userGender,
      inputData: {
        context,
        name: attachment.name,
        type: attachment.type,
      },
    });
  };

  const handleResetChat = () => {
    setMessages([]);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: "重置对话",
      userName,
      userGender,
    });
  };

  const setQuickActionFlag = (
    messageId: string,
    flag: "copied" | "shared",
  ) => {
    setMessageQuickActions((prev) => ({
      ...prev,
      [messageId]: {
        ...prev[messageId],
        [flag]: true,
      },
    }));

    window.setTimeout(() => {
      setMessageQuickActions((prev) => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          [flag]: false,
        },
      }));
    }, 1600);
  };

  const handleToggleReaction = (messageId: string, reaction: "like" | "dislike") => {
    setMessageQuickActions((prev) => {
      const current = prev[messageId]?.reaction;
      return {
        ...prev,
        [messageId]: {
          ...prev[messageId],
          reaction: current === reaction ? undefined : reaction,
        },
      };
    });
  };

  const handleCopyMessage = async (msg: Message) => {
    if (!msg.content?.trim()) return;
    try {
      await navigator.clipboard.writeText(msg.content);
      setQuickActionFlag(msg.id, "copied");
    } catch (error) {
      console.error("Copy message failed:", error);
    }
  };

  const handleShareMessage = async (msg: Message) => {
    if (!msg.content?.trim()) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "SmartClaim 对话",
          text: msg.content,
        });
      } else {
        await navigator.clipboard.writeText(msg.content);
      }
      setQuickActionFlag(msg.id, "shared");
    } catch (error) {
      console.error("Share message failed:", error);
    }
  };

  const handleTogglePolicyExpand = (nextExpanded: boolean, total: number) => {
    setIsPolicyExpanded(nextExpanded);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: nextExpanded ? "展开保单列表" : "收起保单列表",
      userName,
      userGender,
      inputData: { total },
    });
  };

  const handleToggleClaimsExpand = (nextExpanded: boolean, total: number) => {
    setIsClaimsExpanded(nextExpanded);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: nextExpanded ? "展开案件列表" : "收起案件列表",
      userName,
      userGender,
      inputData: { total },
    });
  };

  const handleOpenUploadGuide = () => {
    setShowUploadGuide(true);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "打开上传指引",
      userName,
      userGender,
    });
  };

  const handleCloseUploadGuide = () => {
    setShowUploadGuide(false);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "关闭上传指引",
      userName,
      userGender,
    });
  };

  const handleUploadGuideChooseFile = () => {
    setShowUploadGuide(false);
    fileInputRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "上传指引选择文件",
      userName,
      userGender,
    });
  };

  const handlePolicyUploadClick = () => {
    policyUploadRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "选择上传保单",
      userName,
      userGender,
    });
  };

  const handleReplaceFileClick = () => {
    fileInputRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "更换文件",
      userName,
      userGender,
    });
  };

  const handleCloseFileInspect = () => {
    setFileInspectData(null);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: "关闭文件列表",
      userName,
      userGender,
    });
  };

  const handleClosePreview = () => {
    setPreviewAttachment(null);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: "关闭材料预览",
      userName,
      userGender,
    });
  };

  const handleOpenReportingForm = () => {
    console.log(
      "[DEBUG] Opening reporting form, pendingFiles:",
      pendingFiles.length,
    );
    setShowReportingForm(true);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: "打开报案表单",
      userName,
      userGender,
    });
  };

  const handleCloseReportingForm = () => {
    setShowReportingForm(false);
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: "关闭报案表单",
      userName,
      userGender,
    });
  };

  const handleCloseClaimDetail = () => {
    setSelectedDetailClaim(null);
    logUserOperation({
      operationType: UserOperationType.VIEW_CLAIM_DETAIL,
      operationLabel: "关闭案件详情",
      userName,
      userGender,
    });
  };

  // --- Handlers ---

  const handleLogin = (name: string, gender: string) => {
    setUserName(name);
    setUserGender(gender);
    setIsAuthenticated(true);

    // Update the welcome message with user name
    setMessages((prev) => [
      {
        ...prev[0],
        content: `您好，**${name}${gender}**！我是 **SmartClaim AI**。✨\n\n请告诉我您遇到了什么问题，或者点击下方按钮快速开始。`,
      },
    ]);

    logUserOperation({
      operationType: UserOperationType.LOGIN,
      operationLabel: "索赔人登录",
      userName: name,
      userGender: gender,
    });
  };

  const handleDocumentClick = (doc: ClaimDocument) => {
    const attachment: Attachment = {
      name: doc.name,
      type: doc.type,
      base64: doc.base64 || "",
      url: doc.url,
      ossKey: doc.ossKey,
      analysis: doc.analysis || {
        category: doc.category || "未分类",
        isRelevant: true,
        relevanceReasoning: "历史记录",
        clarityScore: 0,
        completenessScore: 0,
        summary: "历史归档文件",
        missingFields: [],
        ocr: doc.ocrData || {},
        medicalData: doc.medicalData,
        dischargeSummaryData: doc.dischargeSummaryData,
      },
    };
    setFileInspectData([attachment]);
    setExpandedDocIndex(0);
    logUserOperation({
      operationType: UserOperationType.VIEW_FILE,
      operationLabel: "查看历史材料",
      userName,
      userGender,
      inputData: { name: attachment.name, type: attachment.type },
    });
  };

  const handleReassignDocumentMaterial = async (
    claim: HistoricalClaim,
    doc: ClaimDocument,
  ) => {
    const documentKey = doc.id || `${doc.name}-${doc.url || doc.ossKey || ""}`;
    const targetMaterialId = documentMaterialSelections[documentKey];
    const targetMaterial = claim.requiredMaterials?.find(
      (material) => material.materialId === targetMaterialId,
    );

    if (!targetMaterial) {
      appendAssistantMessage("请先选择要归类到的材料项。");
      return;
    }

    setReassigningDocumentKey(documentKey);
    try {
      const response = await fetch(`/api/claim-cases/${claim.id}`);
      const backendClaim = response.ok ? ((await response.json()) as BackendClaimCase) : null;
      const existingFileCategories = backendClaim?.fileCategories || claim.fileCategories || [];
      const existingMaterialUploads = backendClaim?.materialUploads || claim.materialUploads || [];

      const fileRecord = {
        name: doc.name,
        url: doc.url || "",
        ossKey: doc.ossKey,
      };

      const sanitizedCategories = existingFileCategories
        .map((category) => ({
          ...category,
          files: (category.files || []).filter(
            (file) => !isSameStoredFile(file, fileRecord),
          ),
        }))
        .filter((category) => category.files.length > 0);

      const targetCategoryIndex = sanitizedCategories.findIndex(
        (category) => category.name === targetMaterial.materialName,
      );
      let updatedCategories =
        targetCategoryIndex >= 0
          ? sanitizedCategories.map((category, index) =>
              index === targetCategoryIndex
                ? { ...category, files: [...category.files, fileRecord] }
                : category,
            )
          : [
              ...sanitizedCategories,
              { name: targetMaterial.materialName, files: [fileRecord] },
            ];

      const sanitizedMaterialUploads = existingMaterialUploads
        .map((item) => ({
          ...item,
          files: (item.files || []).filter((file) => !isSameStoredFile(file, fileRecord)),
        }))
        .filter((item) => item.files.length > 0);

      const targetUploadIndex = sanitizedMaterialUploads.findIndex(
        (item) => item.materialId === targetMaterial.materialId,
      );
      const updatedMaterialUploads =
        targetUploadIndex >= 0
          ? sanitizedMaterialUploads.map((item, index) =>
              index === targetUploadIndex
                ? { ...item, files: [...item.files, fileRecord] }
                : item,
            )
          : [
              ...sanitizedMaterialUploads,
              {
                materialId: targetMaterial.materialId,
                materialName: targetMaterial.materialName,
                files: [fileRecord],
              },
            ];

      await fetch(`/api/claim-cases/${claim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileCategories: updatedCategories,
          materialUploads: updatedMaterialUploads,
        }),
      });

      const nextClaim = mergeClaimDetail(claim, {
        ...(backendClaim || { id: claim.id }),
        fileCategories: updatedCategories,
        materialUploads: updatedMaterialUploads,
        requiredMaterials: claim.requiredMaterials,
      });

      nextClaim.documents = (nextClaim.documents || []).map((item) =>
        item.id === doc.id || isSameStoredFile(item, fileRecord)
          ? { ...item, category: targetMaterial.materialName }
          : item,
      );

      setClaimState((prev) => ({
        ...prev,
        historicalClaims: (prev.historicalClaims || []).map((item) =>
          item.id === claim.id ? nextClaim : item,
        ),
      }));
      setSelectedDetailClaim(nextClaim);
      setDocumentMaterialSelections((prev) => {
        const next = { ...prev };
        delete next[documentKey];
        return next;
      });
      appendAssistantMessage(`已将 ${doc.name} 归类到“${targetMaterial.materialName}”。`);
    } catch (error) {
      console.error("[Claim Detail] Failed to reassign document material:", error);
      appendAssistantMessage("调整材料归类失败，请稍后重试。");
    } finally {
      setReassigningDocumentKey(null);
    }
  };

  const restartVoiceRecognition = () => {
    if (!isVoiceModeRef.current || isLoading || isTranscribing) {
      return;
    }

    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      return;
    }

    try {
      recognition.start();
      setVoiceStatusText("正在聆听...");
    } catch {
      null;
    }
  };

  /**
   * Browser-native SpeechRecognition fallback. Used ONLY when the server-side
   * voice service (Aliyun NLS via useVoiceController) is unreachable. Its
   * `finalTranscript` routes through the regular text `handleSend` — we do
   * not relay back to the server socket.
   */
  const startBrowserVoiceRecognition = (): BrowserSpeechRecognition | null => {
    const RecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) return null;

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim() || "";
        if (!transcript) continue;
        if (result.isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }

      if (interimTranscript) {
        voiceNetworkRetryCountRef.current = 0;
        setVoiceTranscript(interimTranscript);
      }

      if (finalTranscript) {
        voiceNetworkRetryCountRef.current = 0;
        shouldResumeVoiceRecognitionRef.current = false;
        setVoiceTranscript(finalTranscript);
        setVoiceStatusText("正在处理...");
        setIsTranscribing(true);
        recognition.stop();

        Promise.resolve(handleSend(finalTranscript))
          .catch((error) => console.error("[Voice HandleSend Error]", error))
          .finally(() => {
            setIsTranscribing(false);
            setVoiceTranscript("");
            if (isVoiceModeRef.current && !window.speechSynthesis?.speaking) {
              shouldResumeVoiceRecognitionRef.current = true;
              restartVoiceRecognition();
            }
          });
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "network") {
        voiceNetworkRetryCountRef.current += 1;
        const shouldRetry = voiceNetworkRetryCountRef.current <= 2;
        setVoiceStatusText(
          shouldRetry ? "语音网络波动，正在重试..." : "语音识别网络异常",
        );
        shouldResumeVoiceRecognitionRef.current = shouldRetry;
        if (shouldRetry && isVoiceModeRef.current && !window.speechSynthesis?.speaking) {
          window.setTimeout(
            () => restartVoiceRecognition(),
            400 * voiceNetworkRetryCountRef.current,
          );
          return;
        }
      } else {
        console.error("[Voice Recognition Error]", event.error);
      }

      const handling = getVoiceRecognitionErrorMessage(event.error);
      setVoiceStatusText(handling.statusText);
      shouldResumeVoiceRecognitionRef.current = handling.shouldRetry;

      if (handling.shouldExitVoiceMode) {
        setIsVoiceMode(false);
        voiceTransportModeRef.current = null;
      }
      if (handling.assistantMessage) appendAssistantMessage(handling.assistantMessage);
      if (
        handling.shouldRetry &&
        isVoiceModeRef.current &&
        !window.speechSynthesis?.speaking
      ) {
        restartVoiceRecognition();
      }
    };

    recognition.onend = () => {
      if (
        isVoiceModeRef.current &&
        shouldResumeVoiceRecognitionRef.current &&
        !window.speechSynthesis?.speaking
      ) {
        restartVoiceRecognition();
      }
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
    return recognition;
  };


  /**
   * Browser-TTS fallback. Only invoked when the server transport (Aliyun TTS
   * via useVoiceController) is unavailable and we dropped to the browser
   * SpeechRecognition path. In server mode the reply text is already being
   * streamed through useVoiceController's TTSPlayer, so this helper does
   * nothing there — we early-return.
   */
  const speakAssistantReply = (content: string) => {
    if (voiceTransportModeRef.current === "server") return;
    const text = stripMarkdownForSpeech(content);
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
      restartVoiceRecognition();
      return;
    }

    shouldResumeVoiceRecognitionRef.current = isVoiceModeRef.current;
    speechRecognitionRef.current?.stop();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setVoiceStatusText("正在播报...");
    utterance.onend = () => {
      setVoiceStatusText("请直接描述您的事故情况");
      if (shouldResumeVoiceRecognitionRef.current) restartVoiceRecognition();
    };
    utterance.onerror = () => {
      setVoiceStatusText("请直接描述您的事故情况");
      if (shouldResumeVoiceRecognitionRef.current) restartVoiceRecognition();
    };
    window.speechSynthesis.speak(utterance);
  };

  const appendAssistantMessage = (
    content: string,
    extra?: Partial<Message>,
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content,
        timestamp: Date.now(),
        ...extra,
      },
    ]);

    if (isVoiceModeRef.current) {
      speakAssistantReply(content);
    }
  };

  const resolveClaimMaterialSelection = (
    intakeConfig: IntakeConfig | null | undefined,
    fieldData: Record<string, unknown> | undefined,
  ) => {
    if (!intakeConfig?.claimMaterials || !fieldData) {
      return { claimItemIds: [] as string[], accidentCauseId: undefined as string | undefined };
    }

    const claimItemFieldId =
      intakeConfig.claimMaterials.claimItemFieldId || "claim_item";
    const accidentCauseFieldId =
      intakeConfig.claimMaterials.accidentCauseFieldId || "accident_reason";

    const claimItemValue = fieldData[claimItemFieldId];
    const accidentCauseValue = fieldData[accidentCauseFieldId];

    return {
      claimItemIds: claimItemValue
        ? Array.isArray(claimItemValue)
          ? claimItemValue.map((item) => String(item))
          : [String(claimItemValue)]
        : [],
      accidentCauseId: accidentCauseValue
        ? String(accidentCauseValue)
        : undefined,
    };
  };

  const handleClaimSubmissionMaterials = async (options: {
    claimId: string;
    productCode?: string;
    successMessage: string;
    intakeConfig?: IntakeConfig | null;
    fieldData?: Record<string, unknown>;
  }) => {
    const { claimId, productCode, successMessage, intakeConfig, fieldData } = options;
    setSubmittedClaimId(claimId);

    const { claimItemIds, accidentCauseId } = resolveClaimMaterialSelection(
      intakeConfig,
      fieldData,
    );
    const updateLocalClaimMaterials = (
      materials: ClaimRequiredMaterial[],
      fileCategories?: ClaimFileCategory[],
    ) => {
      setClaimState((prev) => ({
        ...prev,
        historicalClaims: (prev.historicalClaims || []).map((claim) =>
          claim.id === claimId
            ? {
                ...claim,
                requiredMaterials: markUploadedMaterials(
                  materials,
                  fileCategories || claim.fileCategories || [],
                ),
                fileCategories: fileCategories || claim.fileCategories,
              }
            : claim,
        ),
      }));

      setSelectedDetailClaim((prev) => {
        if (!prev || prev.id !== claimId) {
          return prev;
        }
        return {
          ...prev,
          requiredMaterials: markUploadedMaterials(
            materials,
            fileCategories || prev.fileCategories || [],
          ),
          fileCategories: fileCategories || prev.fileCategories,
        };
      });
    };

    if (!productCode || claimItemIds.length === 0) {
      setSubmittedMaterials([]);
      updateLocalClaimMaterials([]);
      appendAssistantMessage(
        `${successMessage}\n\n您的报案已提交。请继续上传相关理赔材料，系统会在案件详情中展示所需清单。`,
        {
          reportSuccess: { caseNumber: claimId },
        },
      );
      return;
    }

    try {
      let categoryCode = "";
      const productResponse = await fetch(
        `/api/products/${encodeURIComponent(productCode)}`,
      );
      if (productResponse.ok) {
        const product = await productResponse.json();
        categoryCode = product?.racewayId || product?.categoryLevel3Code || "";
      }

      const materialsResponse = await fetch("/api/claim-materials/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode,
          categoryCode,
          claimItemIds,
          accidentCauseId,
        }),
      });

      const materialsResult = await materialsResponse.json();
      const materials =
        materialsResponse.ok && materialsResult.success && Array.isArray(materialsResult.materials)
          ? (materialsResult.materials as CalculatedMaterial[])
          : [];

      if (materials.length > 0) {
        setSubmittedMaterials(materials);
        updateLocalClaimMaterials(materials);
        await fetch(`/api/claim-cases/${claimId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedClaimItems: claimItemIds,
            selectedAccidentCauseId: accidentCauseId,
            requiredMaterials: materials.map((material) => ({
              ...material,
              uploaded: false,
            })),
          }),
        }).catch((error) => {
          console.warn("[Claim] Failed to persist calculated materials:", error);
        });

        appendAssistantMessage(
          `${successMessage}\n\n为了尽快为您处理理赔，请按下方清单上传相关证明材料。`,
          {
            reportSuccess: { caseNumber: claimId },
            calculatedMaterials: materials,
          },
        );
        return;
      }

      setSubmittedMaterials([]);
      updateLocalClaimMaterials([]);
      appendAssistantMessage(
        `${successMessage}\n\n您的报案已提交。当前未能计算出动态材料清单，请稍后在案件详情中查看或直接上传材料。`,
        {
          reportSuccess: { caseNumber: claimId },
        },
      );
    } catch (error) {
      console.warn("[Claim] Failed to calculate materials for orchestrator:", error);
      setSubmittedMaterials([]);
      updateLocalClaimMaterials([]);
      appendAssistantMessage(
        `${successMessage}\n\n您的报案已提交，但暂时无法获取动态材料清单，请稍后在案件详情中查看。`,
        {
          reportSuccess: { caseNumber: claimId },
        },
      );
    }
  };

  const MAX_CLARIFICATION_ROUNDS = 2;

  const resolveClarification = async (userText: string) => {
    const pending = claimState.pendingClarification;
    if (!pending) return;

    const lower = userText.trim();
    if (/转人工|人工客服|算了|取消/.test(lower)) {
      setClaimState((prev) => ({ ...prev, pendingClarification: undefined }));
      appendAssistantMessage(
        "已为您转接人工客服通道，稍后将有理赔专员联系您。",
      );
      return;
    }

    const combinedText = `${pending.originalUserText}（用户补充：${userText}）`;
    try {
      const intentResult = await recognizeIntent(
        combinedText,
        messages.map((m) => ({ role: m.role, content: m.content })),
        claimState,
      );

      if (intentResult.requiresClarification) {
        if (pending.round >= MAX_CLARIFICATION_ROUNDS) {
          setClaimState((prev) => ({
            ...prev,
            pendingClarification: undefined,
          }));
          appendAssistantMessage(
            "抱歉，我这边还是没有完全理解您的需求。建议您点击下方按钮转接人工客服，会有专员跟进处理。",
            {
              clarificationOptions: ["转人工客服"],
              isClarification: true,
            },
          );
          return;
        }

        const nextRound = pending.round + 1;
        setClaimState((prev) => ({
          ...prev,
          pendingClarification: {
            intent: intentResult.intent,
            entities: intentResult.entities,
            question:
              intentResult.clarificationQuestion || pending.question,
            options: intentResult.clarificationOptions || pending.options,
            missingEntities: intentResult.missingEntities,
            round: nextRound,
            originalUserText: pending.originalUserText,
          },
        }));
        appendAssistantMessage(
          intentResult.clarificationQuestion || pending.question,
          {
            clarificationOptions:
              intentResult.clarificationOptions || pending.options,
            isClarification: true,
            intentResult: {
              intent: intentResult.intent,
              confidence: intentResult.confidence,
            },
          },
        );
        return;
      }

      const clearedState: ClaimState = {
        ...claimState,
        pendingClarification: undefined,
      };
      setClaimState(clearedState);

      const toolResponse = await executeTool(
        intentResult.intent,
        intentResult.entities,
        clearedState,
      );
      if (toolResponse.data?.claimStatePatch) {
        setClaimState(toolResponse.data.claimStatePatch as ClaimState);
      }
      appendAssistantMessage(toolResponse.message || "好的，已为您处理。", {
        uiComponent: toolResponse.uiComponent,
        uiData: toolResponse.uiData,
        intentResult: {
          intent: intentResult.intent,
          confidence: intentResult.confidence,
        },
        claimsList:
          toolResponse.data?.claims && Array.isArray(toolResponse.data.claims)
            ? toolResponse.data.claims
            : undefined,
        clarificationOptions: toolResponse.suggestedFollowups,
      });
    } catch (error) {
      console.error("[Clarification Error]", error);
      setClaimState((prev) => ({ ...prev, pendingClarification: undefined }));
      appendAssistantMessage(
        "处理您的回答时遇到了问题，请稍后再试或转接人工客服。",
      );
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;

    const messagePreview = textToSend.slice(0, 200);
    const operationStart = Date.now();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // 优先处理：若存在待澄清上下文，按澄清回复处理
    if (claimState.pendingClarification) {
      try {
        await resolveClarification(textToSend);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const orchestratorState = claimState.claimOrchestrator?.state;
    const trimmedText = textToSend.trim();
    const isClaimFlowActive =
      Boolean(orchestratorState) &&
      !["IDLE", "ENDED", "ERROR"].includes(orchestratorState);
    const isCancelClaimFlow = /撤销报案|取消报案|不赔了|不理赔了|算了/.test(trimmedText);
    const confirmMatch = /确认|确认提交|提交|继续报案|继续提交/.test(trimmedText);

    if (isClaimFlowActive && isCancelClaimFlow) {
      try {
        const toolResponse = await cancelActiveClaimOrchestrator(claimState);
        if (toolResponse.data?.claimStatePatch) {
          setClaimState(toolResponse.data.claimStatePatch as ClaimState);
        }
        appendAssistantMessage(toolResponse.message);
      } catch (error) {
        console.error("[Claim Orchestrator Cancel Error]", error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (orchestratorState === "SELECTING_POLICY") {
      const indexMatch = trimmedText.match(/^(?:第\s*)?(\d+)(?:\s*张)?$/);
      if (indexMatch) {
        try {
          const toolResponse = await executeClaimOrchestratorSelection(
            Number(indexMatch[1]),
            claimState,
          );
          if (toolResponse.data?.claimStatePatch) {
            setClaimState(toolResponse.data.claimStatePatch as ClaimState);
          }
          appendAssistantMessage(toolResponse.message);
        } catch (error) {
          console.error("[Claim Orchestrator Selection Error]", error);
        } finally {
          setIsLoading(false);
        }
        return;
      }
    }

    if (
      orchestratorState === "COLLECTING_FIELDS" ||
      orchestratorState === "MODIFYING_FIELD" ||
      (orchestratorState === "CONFIRMING_SUBMISSION" && confirmMatch)
    ) {
      try {
        const toolResponse = await continueClaimOrchestratorWithText(
          trimmedText,
          claimState,
        );
        if (toolResponse.data?.claimStatePatch) {
          setClaimState(toolResponse.data.claimStatePatch as ClaimState);
        }
        if (toolResponse.data?.submittedClaim?.claimId) {
          await handleClaimSubmissionMaterials({
            claimId: toolResponse.data.submittedClaim.claimId as string,
            productCode: toolResponse.data.submittedClaim.productCode as string | undefined,
            successMessage: toolResponse.message,
            intakeConfig:
              (toolResponse.data.claimStatePatch as ClaimState | undefined)?.claimOrchestrator
                ?.intakeConfig || claimState.claimOrchestrator?.intakeConfig,
            fieldData:
              ((toolResponse.data.claimStatePatch as ClaimState | undefined)?.claimOrchestrator
                ?.collectedFields as Record<string, unknown> | undefined) ||
              claimState.claimOrchestrator?.collectedFields,
          });
        } else {
          appendAssistantMessage(toolResponse.message);
        }
      } catch (error) {
        console.error("[Claim Orchestrator Continue Error]", error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (orchestratorState === "CONFIRMING_SUBMISSION" && !confirmMatch) {
      appendAssistantMessage(
        "报案信息已经收集完成。输入“确认提交”即可提交，输入“取消报案”可结束当前流程。",
      );
      setIsLoading(false);
      return;
    }

    if (shouldStartNewClaimFlow(textToSend)) {
      try {
        const toolResponse = await executeTool(
          IntentType.REPORT_NEW_CLAIM,
          {},
          claimState,
        );
        if (toolResponse.data?.claimStatePatch) {
          setClaimState(toolResponse.data.claimStatePatch as ClaimState);
        }
        setPolicySearchTerm("");
        setIsPolicyExpanded(false);
        appendAssistantMessage(toolResponse.message, {
          policies:
            toolResponse.data?.policies && Array.isArray(toolResponse.data.policies)
              ? toolResponse.data.policies
              : undefined,
          policySelection:
            toolResponse.data?.policies && Array.isArray(toolResponse.data.policies)
              ? true
              : undefined,
        });
      } catch (error) {
        console.error("[Claim Orchestrator Start Error]", error);
        appendAssistantMessage("暂未获取到保单数据，请稍后重试或上传保单 PDF。");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // 使用智能聊天，自动进行意图识别
      const {
        text,
        groundingLinks,
        aiLog,
        intentResult,
        toolResponse,
        usedIntentTool,
      } = await smartChat(
        textToSend,
        messages
          .concat(userMsg)
          .map((m) => ({ role: m.role, content: m.content })),
        claimState,
        { userLocation },
      );

      // 如果有工具执行结果，显示特殊 UI
      let uiComponent: UIComponentType | undefined;
      let uiData: any;
      let responseAttachments: Attachment[] | undefined;

      if (usedIntentTool && toolResponse) {
        uiComponent = toolResponse.uiComponent;
        uiData = toolResponse.uiData;
        if (toolResponse.data?.claimStatePatch) {
          setClaimState(toolResponse.data.claimStatePatch as ClaimState);
        }
        if (toolResponse.data?.submittedClaim?.claimId) {
          await handleClaimSubmissionMaterials({
            claimId: toolResponse.data.submittedClaim.claimId as string,
            productCode: toolResponse.data.submittedClaim.productCode as string | undefined,
            successMessage: text,
            intakeConfig:
              (toolResponse.data.claimStatePatch as ClaimState | undefined)?.claimOrchestrator
                ?.intakeConfig || claimState.claimOrchestrator?.intakeConfig,
            fieldData:
              ((toolResponse.data.claimStatePatch as ClaimState | undefined)?.claimOrchestrator
                ?.collectedFields as Record<string, unknown> | undefined) ||
              claimState.claimOrchestrator?.collectedFields,
          });
          setIsLoading(false);
          return;
        }

        // 记录意图识别操作
        logUserOperation({
          operationType: UserOperationType.VIEW_PROGRESS,
          operationLabel: `意图识别: ${intentResult ? getIntentLabel(intentResult.intent) : "未知"}`,
          userName,
          userGender,
          inputData: {
            message: messagePreview,
            intent: intentResult?.intent,
            confidence: intentResult?.confidence,
          },
          outputData: {
            usedIntentTool,
            uiComponent,
            toolSuccess: toolResponse.success,
          },
          aiInteractions: aiLog ? [aiLog] : undefined,
          duration: Date.now() - operationStart,
        });
      } else {
        // Inject car insurance checklist image if applicable
        if (textToSend.includes("车") || textToSend.includes("机动车")) {
          responseAttachments = [
            {
              name: "车险理赔材料清单",
              type: "image/jpeg",
              url: "https://pic1.imgdb.cn/item/693fab0b4a4e4213d0058351.jpg",
            },
          ];
        }

        logUserOperation({
          operationType: UserOperationType.SEND_MESSAGE,
          operationLabel: "发送消息",
          userName,
          userGender,
          inputData: {
            message: messagePreview,
            messageLength: textToSend.length,
          },
          outputData: {
            responseLength: text.length,
            groundingLinkCount: groundingLinks?.length || 0,
          },
          aiInteractions: aiLog ? [aiLog] : undefined,
          duration: Date.now() - operationStart,
        });
      }

      appendAssistantMessage(text, {
        groundingLinks,
        attachments: responseAttachments,
        policies:
          (toolResponse?.data?.policies && Array.isArray(toolResponse.data.policies)
            ? toolResponse.data.policies
            : toolResponse?.nextAction?.data && Array.isArray(toolResponse.nextAction.data)
              ? toolResponse.nextAction.data
            : undefined,
          )
            ? ((toolResponse?.data?.policies && Array.isArray(toolResponse.data.policies)
                ? toolResponse.data.policies
                : toolResponse?.nextAction?.data) as Policy[])
            : undefined,
        policySelection:
          (toolResponse?.data?.policies && Array.isArray(toolResponse.data.policies)) ||
          (toolResponse?.nextAction?.data && Array.isArray(toolResponse.nextAction.data))
            ? true
            : undefined,
        claimsList:
          toolResponse?.data?.claims && Array.isArray(toolResponse.data.claims)
            ? toolResponse.data.claims
            : toolResponse?.uiData?.claims && Array.isArray(toolResponse.uiData.claims)
              ? toolResponse.uiData.claims
              : toolResponse?.uiData?.claims && toolResponse.uiComponent === UIComponentType.CLAIM_HISTORY
                ? toolResponse.uiData.claims
                : undefined,
        intentResult: intentResult
          ? {
              intent: intentResult.intent,
              confidence: intentResult.confidence,
            }
          : undefined,
        reportSuccess:
          toolResponse?.data?.submittedClaim?.claimId
            ? {
                caseNumber: toolResponse.data.submittedClaim.claimId as string,
              }
            : undefined,
        uiComponent,
        uiData,
        clarificationOptions:
          uiComponent === UIComponentType.CLARIFICATION
            ? (uiData?.options as string[] | undefined)
            : // 非澄清回答附带"猜你想问"快捷建议
              (toolResponse?.suggestedFollowups as string[] | undefined),
        isClarification:
          uiComponent === UIComponentType.CLARIFICATION ? true : undefined,
      });
    } catch (error) {
      console.error("[Smart Chat Error]", error);
      appendAssistantMessage("网络连接似乎有些问题，请稍后再试。");
      logUserOperation({
        operationType: UserOperationType.SEND_MESSAGE,
        operationLabel: "发送消息",
        userName,
        userGender,
        inputData: {
          message: messagePreview,
          messageLength: textToSend.length,
        },
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        duration: Date.now() - operationStart,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = async (
    files: FileList | File[],
    source: "file" | "camera" | "policy" = "file",
    postClaimMeta?: {
      claimId: string;
      materialId: string;
      materialName: string;
    },
  ) => {
    setIsLoading(true);
    const uploadStart = Date.now();
    const fileArray = Array.from(files);
    const limitedFiles = fileArray.slice(0, MAX_FILES_PER_UPLOAD);
    if (fileArray.length > MAX_FILES_PER_UPLOAD) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `单次最多处理 ${MAX_FILES_PER_UPLOAD} 份文件，已自动取前 ${MAX_FILES_PER_UPLOAD} 份。`,
          timestamp: Date.now(),
        },
      ]);
    }
    if (limitedFiles.length === 0) {
      setIsLoading(false);
      return;
    }

    const fileReadPromises = limitedFiles.map((file) =>
      file.type.startsWith("image/")
        ? createImageAttachment(file)
        : createFileAttachment(file),
    );

    const newAttachments = await Promise.all(fileReadPromises);

    // 2. Add User Message with thumbnails immediately
    const userMsg: Message = {
      id: `upload-${Date.now()}`,
      role: "user",
      content:
        newAttachments.length > 1
          ? `已上传 ${newAttachments.length} 份文件`
          : `上传文件`,
      timestamp: Date.now(),
      attachments: newAttachments,
    };
    setMessages((prev) => [...prev, userMsg]);

    setUploadProgress({
      total: newAttachments.length,
      completed: 0,
      failed: 0,
      active: 0,
    });
    setIsAnalyzing("准备批量分析...");

    let completedCount = 0;
    let failedCount = 0;
    const aiLogs: AIInteractionLog[] = [];

    const results: Array<
      Attachment & { status: "success" | "failed"; error?: string }
    > = new Array(newAttachments.length);
    let nextIndex = 0;
    const worker = async () => {
      while (true) {
        const current = nextIndex++;
        if (current >= newAttachments.length) return;
        const att = newAttachments[current];
        setUploadProgress((prev) => ({
          ...prev,
          currentFile: att.name,
          active: prev.active + 1,
        }));
        setIsAnalyzing(att.name);
        try {
          const catalogForClassification =
            submittedMaterials.length > 0
              ? submittedMaterials
              : globalMaterialsCatalog.length > 0
                ? globalMaterialsCatalog
                : undefined;
          const analysisResult = await quickAnalyze(
            att.base64!,
            att.type,
            catalogForClassification,
          );
          aiLogs.push(analysisResult.aiLog);
          const mappedAnalysis = {
            category: analysisResult.category || "未知类型",
            isRelevant: true,
            relevanceReasoning: "快速识别",
            clarityScore: 0,
            completenessScore: 0,
            summary: "快速识别结果",
            missingFields: [],
            ocr: {},
            matchedMaterialId: analysisResult.matchedMaterialId,
            matchedMaterialName: analysisResult.matchedMaterialName,
          };
          completedCount++;
          setUploadProgress((prev) => ({
            ...prev,
            completed: completedCount,
            currentFile: undefined,
            active: Math.max(0, prev.active - 1),
          }));
          results[current] = {
            ...att,
            analysis: mappedAnalysis,
            status: "success",
            url: analysisResult.ossUrl || att.url,
            ossKey: analysisResult.ossKey || att.ossKey,
          };
        } catch (err) {
          console.error(`Analysis failed for ${att.name}:`, err);
          failedCount++;
          setUploadProgress((prev) => ({
            ...prev,
            failed: failedCount,
            currentFile: undefined,
            active: Math.max(0, prev.active - 1),
          }));
          results[current] = { ...att, status: "failed", error: String(err) };
        }
      }
    };
    const workerCount = Math.min(
      MAX_CONCURRENT_ANALYSIS,
      newAttachments.length,
    );
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const analyzedAttachments = results.filter(Boolean);
    const cleanedAttachments = analyzedAttachments.map((att) => {
      if (att.type.includes("pdf")) return att;
      // Only clear base64 if we have a valid URL for preview
      if (att.type.includes("image") && att.url)
        return { ...att, base64: undefined };
      // Keep base64 if no URL is available (needed for preview)
      return att;
    });

    setIsAnalyzing(null);
    setPendingFiles(cleanedAttachments);
    console.log(
      "[DEBUG] processFiles completed, setPendingFiles with:",
      cleanedAttachments.length,
      "files",
    );
    cleanedAttachments.forEach((att, i) => {
      console.log(
        `[DEBUG] File ${i}: name=${att.name}, hasUrl=${!!att.url}, hasOssKey=${!!att.ossKey}`,
      );
    });

    // 4. Update User Message to show analysis is done (optional visual update)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === userMsg.id ? { ...m, attachments: cleanedAttachments } : m,
      ),
    );

    // 5. Generate Summary String for Assistant Message
    const categoryCounts = cleanedAttachments.reduce(
      (acc, curr) => {
        const cat = curr.analysis?.category || "未知类型";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const summaryStr = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat} x${count}`)
      .join("，");

    // Check for errors to adjust message tone
    const hasErrors = cleanedAttachments.some(hasMissingFields);
    const contentPrefix = hasErrors
      ? `⚠️ 发现 ${cleanedAttachments.length} 份文件，但部分文件缺失关键信息，请检查：`
      : `✅ 已完成 ${cleanedAttachments.length} 份文件的智能识别 (${summaryStr})，详情如下：`;

    // 6. Create Assistant Message with Aggregated Results (Single Card + List Modal)
    setMessages((prev) => [
      ...prev,
      {
        id: `analysis-${Date.now()}`,
        role: "assistant",
        content: contentPrefix,
        timestamp: Date.now(),
        analysisResults: cleanedAttachments,
        intentChoice: !hasErrors, // Only show intent choices if no errors
      },
    ]);

    // Reset upload progress after completion
    setUploadProgress({ total: 0, completed: 0, failed: 0, active: 0 });

    // 报案后追加材料：同步到后台（按材料类型上传 or 批量上传均适用）
    const claimIdToSync = postClaimMeta?.claimId ?? submittedClaimId;
    if (claimIdToSync) {
      try {
        const existingResp = await fetch(`/api/claim-cases/${claimIdToSync}`);
        const existingClaim = existingResp.ok ? await existingResp.json() : {};
        const existingCategories: {
          name: string;
          files: { name: string; url: string; ossKey?: string }[];
        }[] = existingClaim.fileCategories || [];
        const existingRequiredMaterials: ClaimRequiredMaterial[] =
          existingClaim.requiredMaterials || [];
        const existingMaterialUploads: ClaimMaterialUpload[] =
          existingClaim.materialUploads || [];

        const validFiles = cleanedAttachments.filter(
          (att) =>
            att.url &&
            (att.url.startsWith("/uploads/") || att.url.startsWith("http")),
        );

        if (validFiles.length === 0) {
          console.warn(
            "[Claim] No valid URLs to save (all blob URLs filtered out), skipping PUT",
          );
          return;
        }

        // 按分类分组：指定材料类型上传 → 用 materialName；批量上传 → 用 AI 识别类别
        const grouped = new Map<
          string,
          { name: string; url: string; ossKey?: string }[]
        >();
        const matchedFiles = validFiles.map((att) => {
          const match = resolveMaterialMatch(
            att,
            existingRequiredMaterials,
            postClaimMeta?.materialName,
          );
          return { attachment: att, match };
        });
        matchedFiles.forEach(({ attachment, match }) => {
          const catName = match.materialName;
          if (!grouped.has(catName)) grouped.set(catName, []);
          grouped
            .get(catName)!
            .push({
              name: attachment.name,
              url: attachment.url!,
              ossKey: attachment.ossKey || "",
            });
        });

        // 合并到现有 fileCategories
        let updatedCategories = [...existingCategories];
        grouped.forEach((files, catName) => {
          const idx = updatedCategories.findIndex((c) => c.name === catName);
          if (idx >= 0) {
            updatedCategories = updatedCategories.map((cat, i) =>
              i === idx ? { ...cat, files: [...cat.files, ...files] } : cat,
            );
          } else {
            updatedCategories = [...updatedCategories, { name: catName, files }];
          }
        });

        let updatedMaterialUploads = [...existingMaterialUploads];
        matchedFiles.forEach(({ attachment, match }) => {
          if (!match.materialId) {
            return;
          }
          const fileRecord = {
            name: attachment.name,
            url: attachment.url!,
            ossKey: attachment.ossKey || "",
          };
          const idx = updatedMaterialUploads.findIndex(
            (item) => item.materialId === match.materialId,
          );
          if (idx >= 0) {
            updatedMaterialUploads = updatedMaterialUploads.map((item, itemIndex) =>
              itemIndex === idx
                ? {
                    ...item,
                    files: [...item.files, fileRecord],
                  }
                : item,
            );
          } else {
            updatedMaterialUploads = [
              ...updatedMaterialUploads,
              {
                materialId: match.materialId,
                materialName: match.materialName,
                files: [fileRecord],
              },
            ];
          }
        });

        await fetch(`/api/claim-cases/${claimIdToSync}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileCategories: updatedCategories,
            materialUploads: updatedMaterialUploads,
          }),
        });
        const materialMatchSummary = buildMaterialMatchSummary(matchedFiles);
        setClaimState((prev) => ({
          ...prev,
          historicalClaims: (prev.historicalClaims || []).map((claim) =>
            claim.id === claimIdToSync
              ? {
                  ...claim,
                  fileCategories: updatedCategories,
                  materialUploads: updatedMaterialUploads,
                  requiredMaterials: markUploadedMaterials(
                    claim.requiredMaterials || [],
                    updatedCategories,
                    updatedMaterialUploads,
                  ),
                  documents: [
                    ...(claim.documents || []),
                    ...matchedFiles.map(({ attachment, match }, index) => ({
                      id: `POST-${Date.now()}-${index}`,
                      name: attachment.name,
                      type: attachment.type,
                      status: "verified" as const,
                      url: attachment.url,
                      ossKey: attachment.ossKey,
                      category: match.materialName,
                      ocrData: attachment.analysis?.ocr,
                      medicalData: attachment.analysis?.medicalData,
                      dischargeSummaryData: attachment.analysis?.dischargeSummaryData,
                      missingFields: attachment.analysis?.missingFields,
                      analysis: attachment.analysis,
                    })),
                  ],
                }
              : claim,
          ),
        }));
        setSelectedDetailClaim((prev) => {
          if (!prev || prev.id !== claimIdToSync) {
            return prev;
          }
          return {
            ...prev,
            fileCategories: updatedCategories,
            materialUploads: updatedMaterialUploads,
            requiredMaterials: markUploadedMaterials(
              prev.requiredMaterials || [],
              updatedCategories,
              updatedMaterialUploads,
            ),
            documents: [
              ...(prev.documents || []),
              ...matchedFiles.map(({ attachment, match }, index) => ({
                id: `POST-DETAIL-${Date.now()}-${index}`,
                name: attachment.name,
                type: attachment.type,
                status: "verified" as const,
                url: attachment.url,
                ossKey: attachment.ossKey,
                category: match.materialName,
                ocrData: attachment.analysis?.ocr,
                medicalData: attachment.analysis?.medicalData,
                dischargeSummaryData: attachment.analysis?.dischargeSummaryData,
                missingFields: attachment.analysis?.missingFields,
                analysis: attachment.analysis,
              })),
            ],
          };
        });
        console.log(
          "[Claim] Post-claim files saved to backend:",
          claimIdToSync,
          validFiles.length,
          "files",
        );
        if (materialMatchSummary) {
          appendAssistantMessage(materialMatchSummary);
        }
      } catch (err) {
        console.error("[Claim] Failed to save post-claim files:", err);
      }
    }

    setIsLoading(false);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "上传材料",
      userName,
      userGender,
      inputData: {
        source,
        totalFiles: fileArray.length,
        limitedFiles: limitedFiles.length,
        fileTypes: Array.from(new Set(limitedFiles.map((file) => file.type))),
      },
      outputData: {
        successCount: completedCount,
        failedCount,
        categories: categoryCounts,
      },
      aiInteractions: aiLogs.length > 0 ? aiLogs : undefined,
      duration: Date.now() - uploadStart,
      success: failedCount === 0,
    });
  };

  const handlePolicyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, "policy");
    }
    if (policyUploadRef.current) policyUploadRef.current.value = "";
  };

  const handleClaimClick = async (claim: HistoricalClaim) => {
    // 检查是否是案件选择组件的点击
    const lastAssistantMessage = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (lastAssistantMessage?.uiComponent === UIComponentType.CLAIM_SELECTION) {
      // 获取原始意图（如果有）
      const originalIntent = lastAssistantMessage.uiData?.intent as
        | IntentType
        | undefined;

      if (originalIntent) {
        // 有直接可用的意图类型，直接执行工具函数
        console.log(
          `[Claim Selection] Retriggering intent: ${originalIntent} for claim: ${claim.id}`,
        );

        setIsLoading(true);
        try {
          const toolResponse = await executeTool(
            originalIntent,
            { claimId: claim.id },
            claimState,
          );

          // 添加用户选择消息
          const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: `选择案件：${claim.id}`,
            timestamp: Date.now(),
          };

          // 添加 AI 响应消息
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: toolResponse.message,
            timestamp: Date.now(),
            uiComponent: toolResponse.uiComponent,
            uiData: toolResponse.uiData,
          };

          setMessages((prev) => [...prev, userMessage, assistantMessage]);
        } catch (error) {
          console.error("[Claim Selection Error]", error);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: "处理请求时出现错误，请稍后重试。",
              timestamp: Date.now(),
            },
          ]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // 兼容旧逻辑：没有 intent 时使用自然语言查询进度
        handleSend(`查询案件 ${claim.id} 的进度`);
      }
      return;
    }

    if (pendingFiles.length > 0) {
      const attachStart = Date.now();
      const newDocs: ClaimDocument[] = pendingFiles.map((file, index) => ({
        id: `DOC-${Date.now()}-${index}`,
        name: file.name,
        type: file.type,
        status: "pending",
        base64: file.base64,
        url: file.url,
        ossKey: file.ossKey,
        category: file.analysis?.category || "未分类",
        ocrData: file.analysis?.ocr,
        medicalData: file.analysis?.medicalData,
        dischargeSummaryData: file.analysis?.dischargeSummaryData,
        missingFields: file.analysis?.missingFields,
        analysis: file.analysis,
      }));

      const updatedClaims = (claimState.historicalClaims || []).map((c) => {
        if (c.id === claim.id) {
          return {
            ...c,
            documents: [...(c.documents || []), ...newDocs],
            status:
              c.status === ClaimStatus.REPORTING
                ? ClaimStatus.DOCUMENTING
                : c.status,
          };
        }
        return c;
      });

      setClaimState((prev) => ({
        ...prev,
        historicalClaims: updatedClaims,
      }));

      setPendingFiles([]);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `✅ 已将 **${newDocs.length}** 份新材料关联至案件 **${claim.id}**。**`,
          timestamp: Date.now(),
        },
      ]);

      const updatedClaim = updatedClaims.find((c) => c.id === claim.id);
      if (updatedClaim) {
        setSelectedDetailClaim(updatedClaim);
      }
      logUserOperation({
        operationType: UserOperationType.SUBMIT_FORM,
        operationLabel: "关联材料至案件",
        userName,
        userGender,
        claimId: claim.id,
        inputData: { attachCount: newDocs.length },
        outputData: { claimId: claim.id },
        duration: Date.now() - attachStart,
      });
    } else {
      let nextClaim = claim;
      try {
        const response = await fetch(`/api/claim-cases/${claim.id}`);
        if (response.ok) {
          const backendClaim = (await response.json()) as BackendClaimCase;
          nextClaim = mergeClaimDetail(claim, backendClaim);
          setClaimState((prev) => ({
            ...prev,
            historicalClaims: (prev.historicalClaims || []).map((item) =>
              item.id === claim.id ? nextClaim : item,
            ),
          }));
        }
      } catch (error) {
        console.warn("[Claim Detail] Failed to fetch latest claim detail:", error);
      }

      setSelectedDetailClaim(nextClaim);
      setSubmittedClaimId(nextClaim.id);
      setSubmittedMaterials(nextClaim.requiredMaterials || []);
      logUserOperation({
        operationType: UserOperationType.VIEW_CLAIM_DETAIL,
        operationLabel: "查看案件详情",
        userName,
        userGender,
        claimId: claim.id,
      });
    }
  };

  // Camera & Voice Functions
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files, "file");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCamera = async () => {
    const cameraStart = Date.now();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraOpen(true);
      logUserOperation({
        operationType: UserOperationType.UPLOAD_FILE,
        operationLabel: "打开相机",
        userName,
        userGender,
        duration: Date.now() - cameraStart,
      });
    } catch (err) {
      console.error(err);
      logUserOperation({
        operationType: UserOperationType.UPLOAD_FILE,
        operationLabel: "打开相机失败",
        userName,
        userGender,
        success: false,
        errorMessage: String(err),
      });
    }
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    setIsCameraOpen(false);
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "关闭相机",
      userName,
      userGender,
    });
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg").split(",")[1];
    closeCamera();
    processFiles(
      [
        new File([decode(base64)], `photo_${Date.now()}.jpg`, {
          type: "image/jpeg",
        }),
      ],
      "camera",
    );
  };

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      // Exit voice mode: stop both server and browser transports.
      shouldResumeVoiceRecognitionRef.current = false;
      voiceNetworkRetryCountRef.current = 0;
      speechRecognitionRef.current?.stop();
      if (voiceTransportModeRef.current === "server") {
        await voiceController.stop();
      }
      voiceTransportModeRef.current = null;
      window.speechSynthesis?.cancel();
      setIsVoiceMode(false);
      setIsTranscribing(false);
      setVoiceTranscript("");
      setVoiceStatusText("请直接描述您的事故情况");
      logUserOperation({
        operationType: UserOperationType.LIVE_AUDIO_SESSION,
        operationLabel: "结束语音会话",
        userName,
        userGender,
      });
      return;
    }

    const voiceStart = Date.now();
    try {
      // Try server-side voice first (Aliyun NLS + TTS with turn-state protocol).
      const started = await voiceController.start();
      if (started) {
        voiceTransportModeRef.current = "server";
        setIsVoiceMode(true);
        setVoiceTranscript("");
        logUserOperation({
          operationType: UserOperationType.LIVE_AUDIO_SESSION,
          operationLabel: "开始语音会话",
          userName,
          userGender,
          duration: Date.now() - voiceStart,
        });
        return;
      }

      // Fallback: browser SpeechRecognition (no server). Used only if
      // the backend voice service is unreachable AND the browser has local STT.
      const RecognitionCtor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!RecognitionCtor) {
        appendAssistantMessage(
          "当前语音服务不可用，且浏览器不支持本地语音识别，请改用文字输入。",
        );
        return;
      }

      setIsVoiceMode(true);
      voiceTransportModeRef.current = "browser";
      setVoiceOutputChannel("browser");
      voiceNetworkRetryCountRef.current = 0;
      setVoiceTranscript("");
      setVoiceStatusText("正在聆听...");
      shouldResumeVoiceRecognitionRef.current = true;
      startBrowserVoiceRecognition();
      logUserOperation({
        operationType: UserOperationType.LIVE_AUDIO_SESSION,
        operationLabel: "开始语音会话（浏览器降级）",
        userName,
        userGender,
        duration: Date.now() - voiceStart,
      });
    } catch (err) {
      setIsVoiceMode(false);
      voiceTransportModeRef.current = null;
      setVoiceStatusText("请直接描述您的事故情况");
      logUserOperation({
        operationType: UserOperationType.LIVE_AUDIO_SESSION,
        operationLabel: "开始语音会话失败",
        userName,
        userGender,
        success: false,
        errorMessage: String(err),
      });
    }
  };

  const handlePolicySelect = async (policy: Policy) => {
    if (
      isVoiceModeRef.current &&
      claimState.claimOrchestrator?.state === "SELECTING_POLICY"
    ) {
      const policies = claimState.claimOrchestrator.availablePolicies || [];
      const policyIndex = policies.findIndex((item) => item.id === policy.id);

      if (policyIndex >= 0) {
        setIsLoading(true);
        try {
          const toolResponse = await executeClaimOrchestratorSelection(
            policyIndex + 1,
            claimState,
          );
          if (toolResponse.data?.claimStatePatch) {
            setClaimState(toolResponse.data.claimStatePatch as ClaimState);
          }
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "user",
              content: `选择保单：${policy.type}`,
              timestamp: Date.now(),
            },
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              content: toolResponse.message,
              timestamp: Date.now(),
            },
          ]);
          if (isVoiceModeRef.current) {
            speakAssistantReply(toolResponse.message);
          }
        } catch (error) {
          console.error("[Claim Orchestrator Policy Select Error]", error);
        } finally {
          setIsLoading(false);
        }
        return;
      }
    }

    setClaimState((prev) => ({
      ...prev,
      selectedPolicyId: policy.id,
      claimOrchestrator: prev.claimOrchestrator
        ? {
            ...prev.claimOrchestrator,
            state: "IDLE",
            availablePolicies: [],
            selectedPolicy: null,
            intakeConfig: null,
            collectedFields: {},
            pendingFieldId: null,
            lastResponse: undefined,
          }
        : prev.claimOrchestrator,
    }));

    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: `已选保单: ${policy.type}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // 2. Fetch product intakeConfig by productCode
    let intakeConfig: IntakeConfig | null = null;
    if (policy.productCode) {
      try {
        const res = await fetch(
          `/api/products/${encodeURIComponent(policy.productCode)}`,
        );
        if (res.ok) {
          const product = await res.json();
          if (product?.intakeConfig?.fields?.length > 0) {
            intakeConfig = product.intakeConfig as IntakeConfig;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch intakeConfig:", err);
      }
    }
    setDynamicFormValues({});
    setFormErrors({});
    setSelectedIntakeConfig(intakeConfig);

    const hasIntakeFields = !!intakeConfig;

    if (!isVoiceModeRef.current) {
      if (!hasIntakeFields) {
        setSelectedPolicyForForm(null);
        setShowReportingForm(false);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: `收到，已为您锁定保单 **${policy.type}** (${policy.id})。✅\n\n该产品未配置在线报案字段，当前无法继续在线报案。`,
            timestamp: Date.now() + 1,
          },
        ]);
        setIsLoading(false);

        logUserOperation({
          operationType: UserOperationType.SUBMIT_FORM,
          operationLabel: "选择保单",
          userName,
          userGender,
          inputData: {
            policyId: policy.id,
            policyType: policy.type,
            hasIntakeConfig: false,
          },
        });
        return;
      }

      setSelectedPolicyForForm(policy);
      setShowReportingForm(true);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `收到，已为您锁定保单 **${policy.type}** (${policy.id})。✅\n\n已为您打开在线报案卡片，请填写事故信息并提交。`,
          timestamp: Date.now() + 1,
        },
      ]);
      setIsLoading(false);

      logUserOperation({
        operationType: UserOperationType.SUBMIT_FORM,
        operationLabel: "选择保单",
        userName,
        userGender,
        inputData: {
          policyId: policy.id,
          policyType: policy.type,
          hasIntakeConfig: true,
        },
      });
      return;
    }

    setSelectedPolicyForForm(policy);
    setShowReportingForm(false);

    // 3. Voice flow continues with conversational collection
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `收到，已为您锁定保单 **${policy.type}** (${policy.id})。✅\n\n请通过语音描述您的事故情况：`,
      timestamp: Date.now() + 1,
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);

    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: "选择保单",
      userName,
      userGender,
      inputData: {
        policyId: policy.id,
        policyType: policy.type,
        hasIntakeConfig: hasIntakeFields,
      },
    });
  };

  const handleIntentChoice = (choice: "new" | "supplement") => {
    if (choice === "new") {
      handleSend("我要新报案");
    } else {
      // Collect AI-identified categories from files the user has already uploaded
      const pendingCategories = pendingFiles
        .map((f) => f.analysis?.category)
        .filter((c): c is string => !!c);

      const allClaims = claimState.historicalClaims || [];

      // When material categories are identified, only show claims that still need those materials
      const filteredClaims =
        pendingCategories.length > 0
          ? allClaims.filter((claim) =>
              claimNeedsMatchingMaterial(claim, pendingCategories),
            )
          : allClaims;

      const hasNoMatch = pendingCategories.length > 0 && filteredClaims.length === 0;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: hasNoMatch
            ? "您目前的赔案列表中，没有需要补充此类材料的赔案"
            : "请选择关联的案件：",
          timestamp: Date.now(),
          claimsList: hasNoMatch ? undefined : filteredClaims,
        },
      ]);
    }
    logUserOperation({
      operationType: UserOperationType.SUBMIT_FORM,
      operationLabel: "选择报案方式",
      userName,
      userGender,
      inputData: { choice },
    });
  };

  // Check if a follow_up-controlled field should be visible
  const isFieldVisible = (field: IntakeField): boolean => {
    if (!selectedIntakeConfig) return false;
    // Check if any boolean field's follow_up hides this field
    for (const parentField of selectedIntakeConfig.fields) {
      if (parentField.type === "boolean" && parentField.follow_up) {
        if (parentField.follow_up.extra_fields.includes(field.field_id)) {
          const parentValue = dynamicFormValues[parentField.field_id];
          const conditionMet =
            parentField.follow_up.condition === "true"
              ? parentValue === true
              : parentValue === false;
          return conditionMet;
        }
      }
    }
    return true;
  };

  // Check if a field is a follow_up dependent (hidden by default until parent triggers)
  const isFollowUpField = (fieldId: string): boolean => {
    if (!selectedIntakeConfig) return false;
    return selectedIntakeConfig.fields.some(
      (f) =>
        f.type === "boolean" && f.follow_up?.extra_fields.includes(fieldId),
    );
  };

  const validateDynamicForm = (): boolean => {
    if (!selectedIntakeConfig) return false;
    const errors: Record<string, string> = {};
    for (const field of selectedIntakeConfig.fields) {
      if (isFollowUpField(field.field_id) && !isFieldVisible(field)) continue;
      if (field.required) {
        const val = dynamicFormValues[field.field_id];
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0)
        ) {
          errors[field.field_id] = `请填写${field.label}`;
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDynamicFormChange = (fieldId: string, value: any) => {
    setDynamicFormValues((prev) => ({ ...prev, [fieldId]: value }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const handleFormSubmit = async () => {
    console.log(
      "[DEBUG] handleFormSubmit called, pendingFiles:",
      pendingFiles.length,
      pendingFiles,
    );
    if (!validateDynamicForm()) return;

    const reportStart = Date.now();
    const newClaimId = "CLM" + Date.now().toString().slice(-6);
    const reportNumber =
      "R" +
      new Date()
        .toISOString()
        .replace(/[-T:.Z]/g, "")
        .slice(0, 14) +
      Math.random().toString(36).slice(2, 6).toUpperCase();
    const productName = selectedPolicyForForm?.type || formType;
    const productCode = selectedPolicyForForm?.productCode || "";
    const policyNumber = selectedPolicyForForm?.id || "";

    // Build description from dynamic values
    const description =
      dynamicFormValues["accident_description"] ||
      dynamicFormValues["injury_description"] ||
      dynamicFormValues["diagnosis_result"] ||
      "";

    // Map pending files if any
    const initialDocs: ClaimDocument[] = pendingFiles.map((file, index) => ({
      id: `DOC-${Date.now()}-${index}`,
      name: file.name,
      type: file.type,
      status: "pending",
      base64: file.base64,
      url: file.url,
      ossKey: file.ossKey,
      category: file.analysis?.category || "未分类",
      ocrData: file.analysis?.ocr,
      medicalData: file.analysis?.medicalData,
      dischargeSummaryData: file.analysis?.dischargeSummaryData,
      missingFields: file.analysis?.missingFields,
      analysis: file.analysis,
    }));

    // Update local historicalClaims
    setClaimState((prev) => ({
      ...prev,
      historicalClaims: [
        {
          id: newClaimId,
          date: new Date().toISOString().split("T")[0],
          type: productName,
          status: ClaimStatus.DOCUMENTING,
          incidentReason: description,
          documents: initialDocs,
          timeline: [
            {
              date: new Date().toLocaleString(),
              label: "报案登记",
              description: "用户通过在线填单提交报案",
              status: "completed",
            },
          ],
        },
        ...(prev.historicalClaims || []),
      ],
    }));

    // 准备索赔项目IDs
    const claimItemFieldId =
      selectedIntakeConfig?.claimMaterials?.claimItemFieldId || "claim_item";
    const accidentCauseFieldId =
      selectedIntakeConfig?.claimMaterials?.accidentCauseFieldId ||
      "accident_reason";
    const claimItemValue = dynamicFormValues[claimItemFieldId];
    const selectedClaimItems = claimItemValue
      ? Array.isArray(claimItemValue)
        ? claimItemValue
        : [claimItemValue]
      : [];
    const selectedAccidentCauseId =
      dynamicFormValues[accidentCauseFieldId] || undefined;

    // Convert pendingFiles to fileCategories format
    console.log(
      "[DEBUG] Creating fileCategories from pendingFiles:",
      pendingFiles.length,
    );
    const fileCategoriesMap = new Map<
      string,
      { name: string; url: string; ossKey?: string }[]
    >();
    pendingFiles.forEach((file) => {
      const persistedUrl =
        file.url &&
        (file.url.startsWith("/uploads/") || file.url.startsWith("http"))
          ? file.url
          : "";
      if (!persistedUrl && !file.ossKey) {
        return;
      }
      const category = file.analysis?.category || "其他材料";
      if (!fileCategoriesMap.has(category)) {
        fileCategoriesMap.set(category, []);
      }
      fileCategoriesMap.get(category)!.push({
        name: file.name,
        url: persistedUrl,
        ossKey: file.ossKey,
      });
    });
    const fileCategories = Array.from(fileCategoriesMap.entries()).map(
      ([name, files]) => ({ name, files }),
    );
    console.log(
      "[DEBUG] fileCategories created:",
      JSON.stringify(fileCategories, null, 2),
    );

    // Create backend claim case record
    let claimCaseCreated = false;
    let claimCaseErrorMessage = "";
    try {
      const response = await fetch("/api/claim-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newClaimId,
          reportNumber,
          reporter: userName,
          reportTime: new Date().toLocaleString(),
          accidentTime: dynamicFormValues["accident_date"] || "",
          accidentReason:
            dynamicFormValues["accident_reason"] ||
            dynamicFormValues["death_reason"] ||
            description,
          accidentLocation: dynamicFormValues["accident_location"] || "",
          productCode,
          productName,
          policyNumber,
          policyholder: selectedPolicyForForm?.policyholderName || "",
          insured: selectedPolicyForForm?.insuredName || "",
          status: "已报案",
          operator: userName,
          claimAmount: dynamicFormValues["claim_amount"] || 0,
          intakeFormData: dynamicFormValues,
          selectedClaimItems,
          selectedAccidentCauseId,
          requiredMaterials:
            calculatedMaterials?.map((m) => ({
              ...m,
              uploaded: false,
            })) || [],
          fileCategories,
        }),
      });

      if (response.ok) {
        claimCaseCreated = true;
        console.log(
          "[Claim] Backend claim case created successfully:",
          newClaimId,
        );
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        claimCaseErrorMessage = errorData.error || "Unknown error";
        console.error(
          "[Claim] Failed to create backend claim case:",
          errorData,
        );
      }
    } catch (err) {
      claimCaseErrorMessage =
        err instanceof Error ? err.message : "Network error";
      console.error("[Claim] Network error creating backend claim case:", err);
    }

    if (!claimCaseCreated) {
      setClaimState((prev) => ({
        ...prev,
        historicalClaims: (prev.historicalClaims || []).filter(
          (claim) => claim.id !== newClaimId,
        ),
      }));
      setSubmittedClaimId(null);
      setSubmittedMaterials([]);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `报案提交失败，案件尚未同步到后台。${claimCaseErrorMessage ? `\n\n原因：${claimCaseErrorMessage}` : ""}\n\n请重试提交；已上传的材料仍会保留在当前页面。`,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    setPendingFiles([]);
    setShowReportingForm(false);
    setDynamicFormValues({});
    setFormErrors({});

    // 报案后主动调用API获取材料清单
    try {
      // 获取产品信息以取得 categoryCode
      let categoryCode = "";
      if (productCode) {
        const productResponse = await fetch(
          `/api/products/${encodeURIComponent(productCode)}`,
        );
        if (productResponse.ok) {
          const product = await productResponse.json();
          categoryCode =
            product?.racewayId || product?.categoryLevel3Code || "";
        }
      }

      // 调用材料计算 API
      const materialsResponse = await fetch("/api/claim-materials/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode,
          categoryCode,
          claimItemIds: selectedClaimItems,
          accidentCauseId: selectedAccidentCauseId,
        }),
      });

      const materialsResult = await materialsResponse.json();

      if (
        materialsResponse.ok &&
        materialsResult.success &&
        materialsResult.materials &&
        materialsResult.materials.length > 0
      ) {
        // 关闭表单
        setShowReportingForm(false);
        setSubmittedClaimId(newClaimId);
        setSubmittedMaterials(materialsResult.materials);

        // 添加报案成功和材料列表消息
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `报案成功！案件编号: **${newClaimId}**\n\n为了尽快为您处理理赔，请按下方清单上传相关证明材料。`,
            timestamp: Date.now(),
            reportSuccess: { caseNumber: newClaimId },
            calculatedMaterials: materialsResult.materials,
          },
        ]);
      } else {
        // 没有材料清单或后端返回错误，直接显示报案成功消息
        setShowReportingForm(false);
        const errorDetail = materialsResult.error
          ? `\n(错误详情: ${materialsResult.error})`
          : "";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `报案成功！案件编号: **${newClaimId}**\n\n您的报案已提交。${materialsResult.success === false ? "但计算材料清单时遇到了一些问题，请稍后在理赔详情中查看或上传。" : "请上传相关理赔材料以便我们尽快处理您的索赔。"}${errorDetail}`,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err) {
      console.warn("Failed to fetch materials:", err);
      // API调用失败，仍然显示报案成功消息
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `报案成功！案件编号: **${newClaimId}**\n\n您的报案已提交，由于网络连接问题，无法立即显示材料清单，请稍后在理赔历史中查询需要上传的材料。`,
          timestamp: Date.now(),
        },
      ]);
    }

    logUserOperation({
      operationType: UserOperationType.REPORT_CLAIM,
      operationLabel: "提交报案",
      userName,
      userGender,
      claimId: newClaimId,
      inputData: {
        formType: productName,
        dynamicFields: Object.keys(dynamicFormValues).length,
        pendingFileCount: pendingFiles.length,
      },
      outputData: { claimId: newClaimId, reportNumber },
      duration: Date.now() - reportStart,
    });
  };

  // 批量上传材料（系统自动分类）
  const handleBatchMaterialUpload = () => {
    fileInputRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "批量上传材料",
      userName,
      userGender,
      inputData: { claimId: submittedClaimId },
    });
  };

  // 按材料类型手动上传
  const handleMaterialUploadForType = (materialId: string) => {
    setUploadingMaterialId(materialId);
    materialUploadInputRef.current?.click();
    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "按类型上传材料",
      userName,
      userGender,
      inputData: { claimId: submittedClaimId, materialId },
    });
  };

  // 处理材料类型上传
  const handleMaterialTypeFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    console.log("[DEBUG] handleMaterialTypeFileChange called, files:", files?.length, "uploadingMaterialId:", uploadingMaterialId, "submittedClaimId:", submittedClaimId);
    if (!files || files.length === 0 || !uploadingMaterialId) return;

    const fileArray = Array.from(files);
    const material = submittedMaterials.find(
      (m) => m.materialId === uploadingMaterialId,
    );

    // 在 setUploadingMaterialId(null) 之前捕获，因为 processFiles 是异步的
    const capturedMaterialId = uploadingMaterialId;
    const capturedMaterialName = material?.materialName || "其他材料";

    console.log("[DEBUG] About to call processFiles with postClaimMeta:", {
      claimId: submittedClaimId,
      materialId: capturedMaterialId,
      materialName: capturedMaterialName,
    });

    // 若已提交报案，传入 postClaimMeta 以在上传完成后同步到后台
    if (submittedClaimId) {
      processFiles(files, "file", {
        claimId: submittedClaimId,
        materialId: capturedMaterialId,
        materialName: capturedMaterialName,
      });
    } else {
      processFiles(files, "file");
    }

    logUserOperation({
      operationType: UserOperationType.UPLOAD_FILE,
      operationLabel: "上传指定类型材料",
      userName,
      userGender,
      inputData: {
        claimId: submittedClaimId,
        materialId: capturedMaterialId,
        materialName: capturedMaterialName,
        fileCount: fileArray.length,
      },
    });

    setUploadingMaterialId(null);
    e.target.value = "";
  };

  // --- Render ---

  // Show Auth Screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen relative bg-transparent font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 z-20 shrink-0 bg-white/30 backdrop-blur-md border-b border-white/50 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md">
            <img
              src="https://gw.alipayobjects.com/mdn/rms/afts/img/A*BAhDQLCn3-wAAAAAAAAAAAAAARQnAQ"
              alt="Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">
              SmartClaim
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wide">
                蚂蚁数科｜保险科技
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleResetChat}
          className="w-10 h-10 rounded-full glass-btn flex items-center justify-center text-slate-600"
        >
          <i className="fas fa-rotate-right"></i>
        </button>
      </header>

      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth pb-36"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-enter`}
            >
              <div
                className={`p-4 max-w-[85%] sm:max-w-[75%] ${
                  msg.role === "assistant"
                    ? "msg-bubble-ai"
                    : msg.role === "system"
                      ? "rounded-2xl border border-blue-200 bg-blue-50/90 text-blue-900 shadow-sm"
                      : "msg-bubble-user"
                }`}
              >
                <div className="prose-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* User Attachments Grid (Thumbnails & Filenames) - Max 5 Items Logic */}
                {msg.attachments && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {/* Render first 4 items normally */}
                    {msg.attachments.slice(0, 4).map((att, i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-1 items-center cursor-pointer group"
                        onClick={() =>
                          handleViewAttachments(msg.attachments!, "消息附件")
                        }
                      >
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/10 border border-white/20 group-hover:shadow-md transition-all">
                          {att.type.includes("image") &&
                          (att.base64 || att.url) ? (
                            <img
                              src={
                                att.url ||
                                `data:${att.type};base64,${att.base64}`
                              }
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <i
                                className={`fas ${getDocIcon(att.name)} text-xl opacity-50`}
                              ></i>
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-center w-full truncate opacity-70 px-0.5 leading-tight">
                          {att.name}
                        </div>
                      </div>
                    ))}

                    {/* If exactly 5 items, render the 5th one normally */}
                    {msg.attachments.length === 5 && (
                      <div
                        className="flex flex-col gap-1 items-center cursor-pointer group"
                        onClick={() =>
                          handleViewAttachments(msg.attachments!, "消息附件")
                        }
                      >
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/10 border border-white/20 group-hover:shadow-md transition-all">
                          {msg.attachments[4].type.includes("image") &&
                          (msg.attachments[4].base64 ||
                            msg.attachments[4].url) ? (
                            <img
                              src={
                                msg.attachments[4].url ||
                                `data:${msg.attachments[4].type};base64,${msg.attachments[4].base64}`
                              }
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <i
                                className={`fas ${getDocIcon(msg.attachments[4].name)} text-xl opacity-50`}
                              ></i>
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-center w-full truncate opacity-70 px-0.5 leading-tight">
                          {msg.attachments[4].name}
                        </div>
                      </div>
                    )}

                    {/* If more than 5 items, render the +N button in the 5th slot */}
                    {msg.attachments.length > 5 && (
                      <div
                        className="flex flex-col gap-1 items-center cursor-pointer group"
                        onClick={() =>
                          handleViewAttachments(msg.attachments!, "消息附件")
                        }
                      >
                        <div className="relative w-full aspect-square rounded-lg bg-white/20 border border-white/30 group-hover:bg-white/30 transition-all flex items-center justify-center text-white font-bold text-xs shadow-inner">
                          +{msg.attachments.length - 4}
                        </div>
                        <div className="text-[10px] text-center w-full truncate opacity-70 px-0.5 leading-tight">
                          更多...
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {msg.analysisResults && msg.analysisResults.length > 0 && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {msg.analysisResults.map((doc, idx) => {
                        const isError = hasMissingFields(doc);
                        const imgSrc =
                          doc.url ||
                          (doc.base64
                            ? `data:${doc.type};base64,${doc.base64}`
                            : "");
                        const isImage = doc.type.includes("image");

                        return (
                          <div
                            key={idx}
                            className={`group relative w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${isError ? "border-red-300 bg-red-50" : "border-white/60 bg-white/60"}`}
                            onClick={() =>
                              handleViewAttachments(
                                msg.analysisResults!,
                                "分析结果",
                              )
                            }
                            title={`${doc.name}${isError ? " (缺少信息)" : ""}`}
                          >
                            {isImage && imgSrc ? (
                              <img
                                src={imgSrc}
                                className="w-full h-full object-cover"
                                alt={doc.name}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100">
                                <i
                                  className={`fas ${getDocIcon(doc.name)} text-lg ${isError ? "text-red-400" : "text-blue-400"}`}
                                />
                              </div>
                            )}
                            <div
                              className={`absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm ${isError ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}
                            >
                              <i
                                className={`fas ${isError ? "fa-exclamation" : "fa-check"}`}
                              />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-1">
                              <p className="text-[9px] text-white truncate text-center leading-tight">
                                {doc.analysis?.category || "未分类"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(() => {
                      const hasErrors =
                        msg.analysisResults!.some(hasMissingFields);
                      const categoryCounts = msg.analysisResults!.reduce(
                        (acc, doc) => {
                          const cat = doc.analysis?.category || "未分类";
                          acc[cat] = (acc[cat] || 0) + 1;
                          return acc;
                        },
                        {} as Record<string, number>,
                      );
                      const summaryStr = Object.entries(categoryCounts)
                        .map(([cat, count]) => `${cat} x${count}`)
                        .join("，");

                      return (
                        <div
                          className={`p-3 rounded-xl border flex items-center gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer ${hasErrors ? "bg-red-50/80 border-red-200" : "bg-blue-50/50 border-blue-200"}`}
                          onClick={() =>
                            handleViewAttachments(
                              msg.analysisResults!,
                              "分析结果",
                            )
                          }
                        >
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${hasErrors ? "bg-red-100 text-red-500" : "bg-blue-100 text-blue-500"}`}
                          >
                            <i className="fas fa-file-contract"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-700">
                              已识别 {msg.analysisResults!.length} 份文件
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 truncate">
                              {summaryStr}
                              {hasErrors && (
                                <span className="text-red-500 ml-1">
                                  (部分文件缺失关键信息)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-slate-400">
                            <i className="fas fa-chevron-right text-sm"></i>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Intent-based UI Components */}
                {msg.uiComponent && msg.uiData && (
                  <div className="mt-3">
                    {/* 理赔进度卡片 */}
                    {msg.uiComponent === UIComponentType.CLAIM_PROGRESS && (
                      <ClaimProgressCard
                        data={msg.uiData as ClaimProgressInfo}
                      />
                    )}
                    {/* 材料清单 */}
                    {msg.uiComponent === UIComponentType.MATERIALS_LIST && (
                      <MaterialsListCard
                        data={msg.uiData as MaterialsListInfo}
                        onViewSample={(url, name, ossKey) =>
                          setSamplePreviewData({
                            isOpen: true,
                            url,
                            name: `${name}样例`,
                            ossKey,
                          })
                        }
                      />
                    )}
                    {/* 缺失材料提醒 */}
                    {msg.uiComponent === UIComponentType.MISSING_MATERIALS && (
                      <MissingMaterialsCard
                        data={msg.uiData as MissingMaterialsInfo}
                      />
                    )}
                    {/* 保费影响说明 */}
                    {msg.uiComponent === UIComponentType.PREMIUM_IMPACT && (
                      <PremiumImpactCard
                        data={msg.uiData as PremiumImpactInfo}
                      />
                    )}
                    {msg.uiComponent === UIComponentType.SETTLEMENT_ESTIMATE && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-slate-700 shadow-sm">
                        {(() => {
                          const data = msg.uiData as SettlementEstimateInfo;
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                                    赔付预估
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-slate-800">
                                    {data.claimType} · {data.claimId}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-slate-500">预估金额</div>
                                  <div className="text-xl font-bold text-emerald-700">
                                    ¥{data.estimatedAmount.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              {data.breakdown.length > 0 && (
                                <div className="space-y-2">
                                  {data.breakdown.map((item, index) => (
                                    <div
                                      key={`${item.item}-${index}`}
                                      className="rounded-xl border border-white/80 bg-white/80 px-3 py-2"
                                    >
                                      <div className="flex items-center justify-between gap-3 text-sm">
                                        <span className="font-medium text-slate-700">
                                          {item.item}
                                        </span>
                                        <span className="font-semibold text-slate-900">
                                          ¥{item.amount.toLocaleString()}
                                        </span>
                                      </div>
                                      {item.note && (
                                        <div className="mt-1 text-xs text-slate-500">
                                          {item.note}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs text-slate-500">
                                {data.disclaimer}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {msg.uiComponent === UIComponentType.SETTLEMENT_DETAIL && (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 text-slate-700 shadow-sm">
                        {(() => {
                          const data = msg.uiData as SettlementDetailInfo;
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
                                    赔付明细
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-slate-800">
                                    案件 {data.claimId}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-slate-500">核定金额</div>
                                  <div className="text-xl font-bold text-sky-700">
                                    ¥{data.finalAmount.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {data.items.map((item, index) => (
                                  <div
                                    key={`${item.name}-${index}`}
                                    className="rounded-xl border border-white/80 bg-white/80 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                      <span className="font-medium text-slate-700">
                                        {item.name}
                                      </span>
                                      <span className="text-slate-500">
                                        ¥{item.claimed.toLocaleString()} → ¥
                                        {item.approved.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.deduction}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
                                <span className="text-slate-500">
                                  申请金额 ¥{data.totalClaimed.toLocaleString()}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  核定金额 ¥{data.totalApproved.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {msg.uiComponent === UIComponentType.POLICY_INFO && (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-slate-700 shadow-sm">
                        {(() => {
                          const data = msg.uiData as PolicyInfoData;
                          return (
                            <div className="space-y-3">
                              <div>
                                <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
                                  保单信息
                                </div>
                                <div className="mt-1 text-sm font-semibold text-slate-800">
                                  {data.productName}
                                </div>
                                <div className="text-xs text-slate-500">
                                  保单号 {data.policyId} · 被保人 {data.insuredName}
                                </div>
                              </div>
                              <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-600">
                                保障期限：{data.validFrom || "未知"} 至 {data.validUntil || "未知"}
                              </div>
                              {data.coverages.length > 0 && (
                                <div className="space-y-2">
                                  {data.coverages.map((coverage, index) => (
                                    <div
                                      key={`${coverage.name}-${index}`}
                                      className="rounded-xl border border-white/80 bg-white/80 px-3 py-2"
                                    >
                                      <div className="flex items-center justify-between gap-3 text-sm">
                                        <span className="font-medium text-slate-700">
                                          {coverage.name}
                                        </span>
                                        <span className="text-slate-500">
                                          {coverage.limit
                                            ? `保额 ¥${coverage.limit.toLocaleString()}`
                                            : "详见条款"}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {msg.uiComponent === UIComponentType.PAYMENT_STATUS && (
                      <div className="rounded-2xl border border-lime-100 bg-lime-50/80 p-4 text-slate-700 shadow-sm">
                        {(() => {
                          const data = msg.uiData as PaymentStatusInfo;
                          const statusLabelMap = {
                            pending: "待打款",
                            processing: "打款处理中",
                            success: "已到账",
                            failed: "打款失败",
                          } as const;
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-lime-600">
                                    打款状态
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-slate-800">
                                    案件 {data.claimId}
                                  </div>
                                </div>
                                <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {statusLabelMap[data.paymentStatus]}
                                </div>
                              </div>
                              {data.amount ? (
                                <div className="rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-slate-800">
                                  打款金额 ¥{data.amount.toLocaleString()}
                                </div>
                              ) : null}
                              <div className="space-y-1 text-xs text-slate-500">
                                {data.bankName ? <div>收款银行：{data.bankName}</div> : null}
                                {data.accountTail ? <div>尾号：{data.accountTail}</div> : null}
                                {data.transactionId ? <div>流水号：{data.transactionId}</div> : null}
                                {data.estimatedDate ? <div>{data.estimatedDate}</div> : null}
                                {data.completedDate ? <div>到账日期：{data.completedDate}</div> : null}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {msg.uiComponent === UIComponentType.COVERAGE_INFO && (
                      <div className="rounded-2xl border border-violet-100 bg-violet-50/80 p-4 text-slate-700 shadow-sm">
                        {(() => {
                          const data = msg.uiData as CoverageInfo;
                          return (
                            <div className="space-y-3">
                              <div className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
                                保障范围
                              </div>
                              <div className="text-sm text-slate-700">{data.explanation}</div>
                              {data.coverageItems.length > 0 && (
                                <div className="space-y-2">
                                  {data.coverageItems.map((item, index) => (
                                    <div
                                      key={`${item.name}-${index}`}
                                      className="rounded-xl border border-white/80 bg-white/80 px-3 py-2"
                                    >
                                      <div className="flex items-center justify-between gap-3 text-sm">
                                        <span className="font-medium text-slate-700">
                                          {item.name}
                                        </span>
                                        <span
                                          className={
                                            item.covered ? "text-emerald-600" : "text-rose-500"
                                          }
                                        >
                                          {item.covered ? "可赔" : "不赔"}
                                        </span>
                                      </div>
                                      {item.note ? (
                                        <div className="mt-1 text-xs text-slate-500">{item.note}</div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {data.exclusions.length > 0 && (
                                <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-500">
                                  重点注意：{data.exclusions.join("；")}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {msg.uiComponent === UIComponentType.CLAIM_HISTORY && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-slate-700 shadow-sm">
                        {(() => {
                          const data = msg.uiData as ClaimHistoryInfo;
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                                  历史理赔
                                </div>
                                <div className="text-xs text-slate-500">
                                  共 {data.totalCount} 件
                                </div>
                              </div>
                              <div className="text-sm text-slate-700">
                                累计申请金额 ¥{data.totalAmount.toLocaleString()}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Grounding Links */}
                {msg.groundingLinks && (
                  <div className="mt-3 pt-3 border-t border-dashed border-current/20 flex flex-wrap gap-2">
                    {msg.groundingLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.uri}
                        target="_blank"
                        className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors no-underline text-current"
                      >
                        <i className="fas fa-link text-[10px]"></i>{" "}
                        {link.title || "Source"}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Interactive Elements (Below Bubble) */}
              <div className="mt-2 w-full max-w-[85%] sm:max-w-[75%]">
                {msg.role === "assistant" && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleReaction(msg.id, "like")}
                      aria-label="点赞"
                      title="点赞"
                      className={`glass-btn w-8 h-8 inline-flex items-center justify-center rounded-lg text-xs transition-all ${messageQuickActions[msg.id]?.reaction === "like" ? "text-emerald-600 bg-emerald-50/80 border-emerald-200" : "text-slate-600"}`}
                    >
                      <i className="fas fa-thumbs-up"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleReaction(msg.id, "dislike")}
                      aria-label="点踩"
                      title="点踩"
                      className={`glass-btn w-8 h-8 inline-flex items-center justify-center rounded-lg text-xs transition-all ${messageQuickActions[msg.id]?.reaction === "dislike" ? "text-rose-600 bg-rose-50/80 border-rose-200" : "text-slate-600"}`}
                    >
                      <i className="fas fa-thumbs-down"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      aria-label={messageQuickActions[msg.id]?.copied ? "已复制" : "复制"}
                      title={messageQuickActions[msg.id]?.copied ? "已复制" : "复制"}
                      className="glass-btn w-8 h-8 inline-flex items-center justify-center rounded-lg text-xs text-slate-600"
                    >
                      <i className={`fas ${messageQuickActions[msg.id]?.copied ? "fa-check" : "fa-copy"}`}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareMessage(msg)}
                      aria-label={messageQuickActions[msg.id]?.shared ? "已分享" : "分享"}
                      title={messageQuickActions[msg.id]?.shared ? "已分享" : "分享"}
                      className="glass-btn w-8 h-8 inline-flex items-center justify-center rounded-lg text-xs text-slate-600"
                    >
                      <i className="fas fa-share-nodes"></i>
                    </button>
                  </div>
                )}

                {msg.reportingChoice && (
                  <div className="flex gap-2">
                    <button
                      onClick={toggleVoiceMode}
                      className="glass-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <i className="fas fa-microphone text-blue-500"></i>{" "}
                      语音报案
                    </button>
                    {selectedIntakeConfig && (
                      <button
                        onClick={handleOpenReportingForm}
                        className="glass-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
                      >
                        <i className="fas fa-pen-to-square text-cyan-500"></i>{" "}
                        在线填单
                      </button>
                    )}
                  </div>
                )}

                {msg.intentChoice && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleIntentChoice("new")}
                      className="glass-btn w-full py-3 rounded-xl text-sm font-bold text-left px-4"
                    >
                      🆕 发起新理赔
                    </button>
                    <button
                      onClick={() => handleIntentChoice("supplement")}
                      className="glass-btn w-full py-3 rounded-xl text-sm font-bold text-left px-4"
                    >
                      📎 补充至旧案
                    </button>
                  </div>
                )}

                {msg.clarificationOptions &&
                  msg.clarificationOptions.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[11px] text-slate-400 font-medium">
                        {msg.isClarification ? "请选择" : "💡 猜你想问"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.clarificationOptions.slice(0, 4).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSend(opt)}
                            disabled={isLoading}
                            className={
                              msg.isClarification
                                ? "glass-btn px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors disabled:opacity-50"
                                : "px-3 py-1.5 rounded-full text-xs text-slate-600 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
                            }
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {msg.calculatedMaterials &&
                  msg.calculatedMaterials.length > 0 && (
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <i className="fas fa-clipboard-list text-blue-500"></i>
                          所需理赔材料（
                          {
                            msg.calculatedMaterials.filter((m) => m.required)
                              .length
                          }
                          份必传 / 共{msg.calculatedMaterials.length}份）
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {msg.calculatedMaterials.map((material) => (
                          <div
                            key={material.materialId}
                            className={`p-3 rounded-lg border transition-all ${
                              material.required
                                ? "bg-white border-blue-200 shadow-sm"
                                : "bg-white/60 border-slate-200"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                                  material.required
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                <i
                                  className={`fas ${material.required ? "fa-star" : "fa-file-lines"}`}
                                ></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700">
                                      {material.materialName}
                                    </span>
                                    {material.required && (
                                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                                        必传
                                      </span>
                                    )}
                                  </div>
                                  {submittedClaimId && (
                                    <button
                                      onClick={() =>
                                        handleMaterialUploadForType(
                                          material.materialId,
                                        )
                                      }
                                      className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0"
                                    >
                                      <i className="fas fa-upload text-[10px]"></i>
                                      上传
                                    </button>
                                  )}
                                </div>
                                {material.materialDescription && (
                                  <p className="text-xs text-slate-500 leading-relaxed mb-2">
                                    {material.materialDescription}
                                  </p>
                                )}
                                {material.sampleUrl && (
                                  <button
                                    onClick={() =>
                                      setSamplePreviewData({
                                        isOpen: true,
                                        url: material.sampleUrl,
                                        name: `${material.materialName}样例`,
                                        ossKey: material.ossKey,
                                      })
                                    }
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
                                  >
                                    <i className="fas fa-eye text-[10px]"></i>
                                    查看样例
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-blue-200 space-y-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                          >
                            <i className="fas fa-file-arrow-up"></i>
                            批量上传
                          </button>
                          <button
                            onClick={openCamera}
                            className="flex-1 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-slate-200 shadow-sm"
                          >
                            <i className="fas fa-camera"></i>
                            拍照上传
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <i className="fas fa-info-circle text-blue-500"></i>
                          上传的材料将自动识别分类，请确保照片清晰完整
                        </p>
                      </div>
                    </div>
                  )}

                {msg.policies && (
                  <div className="bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                    {/* Search Bar */}
                    <div className="relative mb-3">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        placeholder="搜索保单号或险种..."
                        className="w-full pl-8 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 outline-none focus:border-blue-400 transition-colors"
                        value={policySearchTerm}
                        onChange={(e) => setPolicySearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const filteredPolicies = msg.policies.filter(
                          (p) =>
                            p.type.includes(policySearchTerm) ||
                            p.id
                              .toLowerCase()
                              .includes(policySearchTerm.toLowerCase()) ||
                            p.insuredName.includes(policySearchTerm),
                        );

                        const visiblePolicies = isPolicyExpanded
                          ? filteredPolicies
                          : filteredPolicies.slice(0, 3);

                        return (
                          <>
                            {visiblePolicies.map((p) => {
                              const now = new Date();
                              const validUntil = new Date(p.validUntil);
                              const isExpired = validUntil < now;

                              return (
                                <Card
                                  key={p.id}
                                  onClick={() => handlePolicySelect(p)}
                                  className={`relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${isExpired ? "bg-slate-50" : ""}`}
                                >
                                  <div className="relative z-10">
                                    {/* Header: ID + Status */}
                                    <div className="flex justify-between items-center mb-1.5">
                                      <span className="text-[10px] font-mono text-slate-400">
                                        {p.id}
                                      </span>
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isExpired ? "bg-slate-200 text-slate-500" : "bg-green-100 text-green-600"}`}
                                      >
                                        {isExpired ? "已失效" : "保障中"}
                                      </span>
                                    </div>

                                    {/* Main Title */}
                                    <div className="font-bold text-slate-700 text-sm mb-2">
                                      {p.type}
                                    </div>

                                    {/* Details: Insured + Date */}
                                    <div className="flex flex-col gap-0.5 text-xs text-slate-500 border-t border-slate-100 pt-2">
                                      <div className="flex justify-between">
                                        <span>被保人</span>
                                        <span className="font-medium text-slate-700">
                                          {p.insuredName}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>有效期至</span>
                                        <span
                                          className={
                                            isExpired
                                              ? "text-red-400"
                                              : "text-slate-600"
                                          }
                                        >
                                          {p.validUntil}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Stamp Effect for Expired */}
                                  {isExpired && (
                                    <div className="absolute -right-2 -bottom-2 w-20 h-20 border-4 border-slate-300 rounded-full flex items-center justify-center opacity-20 -rotate-12 pointer-events-none">
                                      <div className="w-16 h-16 border-2 border-slate-300 rounded-full flex items-center justify-center">
                                        <span className="text-slate-400 font-black text-xs transform -rotate-0">
                                          已过期
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}

                            {/* Empty State */}
                            {filteredPolicies.length === 0 && (
                              <div className="text-center py-4 text-slate-400 text-xs italic">
                                未找到匹配的保单
                              </div>
                            )}

                            {/* Actions Footer */}
                            <div className="flex gap-2 pt-1">
                              {/* Expand Toggle */}
                              {filteredPolicies.length > 3 && (
                                <button
                                  onClick={() =>
                                    handleTogglePolicyExpand(
                                      !isPolicyExpanded,
                                      filteredPolicies.length,
                                    )
                                  }
                                  className="flex-1 py-2 rounded-lg bg-white/60 hover:bg-white text-xs text-slate-600 font-bold border border-slate-100 transition-colors"
                                >
                                  {isPolicyExpanded
                                    ? "收起"
                                    : `查看全部 (${filteredPolicies.length})`}
                                </button>
                              )}

                              {/* Upload Button */}
                              <button
                                onClick={handlePolicyUploadClick}
                                className="flex-1 py-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-xs text-blue-600 font-bold flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <i className="fas fa-file-arrow-up"></i>{" "}
                                上传保单 PDF
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 案件选择列表 - 来自 claimsList 或 CLAIM_SELECTION uiComponent */}
                {(msg.claimsList ||
                  msg.uiComponent === UIComponentType.CLAIM_SELECTION) && (
                  <div className="bg-white/50 p-3 rounded-xl border border-white/60 shadow-sm">
                    {/* Search Bar */}
                    <div className="relative mb-3">
                      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        placeholder="搜索案件号、险种或原因..."
                        className="w-full pl-8 pr-3 py-2 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 outline-none focus:border-blue-400 transition-colors"
                        value={claimSearchTerm}
                        onChange={(e) => setClaimSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const claimsList =
                          msg.claimsList || msg.uiData?.claims || [];
                        const filteredClaims = claimsList.filter(
                          (c) =>
                            c.id
                              .toLowerCase()
                              .includes(claimSearchTerm.toLowerCase()) ||
                            c.type.includes(claimSearchTerm) ||
                            (c.incidentReason &&
                              c.incidentReason.includes(claimSearchTerm)),
                        );

                        const visibleClaims = isClaimsExpanded
                          ? filteredClaims
                          : filteredClaims.slice(0, 3);
                        return (
                          <>
                            {visibleClaims.map((c, i) => (
                              <Card key={i} onClick={() => handleClaimClick(c)}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-slate-700 text-sm">
                                    {c.type}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === ClaimStatus.PAID ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}
                                  >
                                    {getStatusLabel(c.status)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {c.id}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {c.date}
                                  </span>
                                </div>

                                {c.incidentReason && (
                                  <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 line-clamp-2">
                                    <span className="font-bold text-slate-400 mr-1">
                                      <i className="fas fa-circle-info"></i>
                                    </span>
                                    {c.incidentReason}
                                  </div>
                                )}

                                {pendingFiles.length > 0 && (
                                  <div className="mt-2 text-xs bg-blue-50 text-blue-600 p-1.5 rounded text-center border border-blue-100 font-bold">
                                    <i className="fas fa-file-import mr-1"></i>{" "}
                                    点击关联当前文件
                                  </div>
                                )}
                              </Card>
                            ))}

                            {filteredClaims.length === 0 && (
                              <div className="text-center py-4 text-slate-400 text-xs italic">
                                未找到匹配的案件
                              </div>
                            )}

                            {filteredClaims.length > 3 && (
                              <button
                                onClick={() =>
                                  handleToggleClaimsExpand(
                                    !isClaimsExpanded,
                                    filteredClaims.length,
                                  )
                                }
                                className="w-full py-2 rounded-lg bg-white/60 hover:bg-white text-xs text-slate-600 font-bold border border-slate-100 transition-colors flex items-center justify-center gap-1"
                              >
                                {isClaimsExpanded
                                  ? "收起"
                                  : `查看更多历史案件 (${filteredClaims.length - 3})`}
                                <i
                                  className={`fas fa-chevron-${isClaimsExpanded ? "up" : "down"}`}
                                ></i>
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex items-center gap-3 animate-pulse text-slate-500 text-sm ml-2">
              <i className="fas fa-circle-notch fa-spin text-blue-500"></i>
              正在分析文件: <span className="font-bold">{isAnalyzing}</span>...
            </div>
          )}
          {isLoading && !isAnalyzing && (
            <div className="flex gap-1 ml-4">
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-100"></div>
              <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce delay-200"></div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Input Dock */}
      <div className="absolute bottom-0 left-0 w-full z-30 p-4 bg-gradient-to-t from-white/80 to-transparent pointer-events-none flex flex-col items-center">
        <div className="w-full max-w-2xl pointer-events-auto space-y-3">
          {uploadProgress.total > 0 && (
            <div className="p-4 bg-white/90 backdrop-blur-sm rounded-xl border border-blue-200 shadow-lg">
              <div className="flex justify-between text-sm text-gray-600 mb-3">
                <span className="font-medium">
                  处理进度: {uploadProgress.completed} / {uploadProgress.total}
                </span>
                <span
                  className={
                    uploadProgress.failed > 0
                      ? "text-red-600 font-medium"
                      : "text-gray-600"
                  }
                >
                  {uploadProgress.failed > 0 &&
                    `失败: ${uploadProgress.failed}`}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
              {(uploadProgress.currentFile || uploadProgress.active > 0) && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                  <svg
                    className="animate-spin h-3 w-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8 018 0 18 018 0-018-8 018-8 018 0z"
                    ></path>
                  </svg>
                  {(uploadProgress.currentFile
                    ? `正在处理: ${uploadProgress.currentFile}`
                    : "正在处理...") +
                    (uploadProgress.active > 0
                      ? ` · 并行处理中: ${uploadProgress.active}`
                      : "")}
                </p>
              )}
            </div>
          )}

          {/* Quick Actions (Scrollable) */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => handleSend("我要报案")}
              className="glass-btn shrink-0 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2"
            >
              <i className="fas fa-truck-medical text-red-500"></i> 我要报案
            </button>
            <button
              onClick={() => handleSend("进度查询")}
              className="glass-btn shrink-0 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2"
            >
              <i className="fas fa-list-check text-blue-500"></i> 进度查询
            </button>
            <button
              onClick={toggleVoiceMode}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${isVoiceMode ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "glass-btn"}`}
            >
              <i className="fas fa-microphone"></i>{" "}
              {isVoiceMode ? "挂断语音" : "语音管家"}
            </button>
          </div>

          {/* Input Bar */}
          <div className="input-dock p-2 flex items-center gap-2">
            <button
              onClick={handleOpenUploadGuide}
              className="w-10 h-10 rounded-full hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors"
            >
              <i className="fas fa-paperclip text-lg"></i>
            </button>
            <button
              onClick={openCamera}
              className="w-10 h-10 rounded-full hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors"
            >
              <i className="fas fa-camera text-lg"></i>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="输入消息..."
              className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 font-medium h-10"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="w-10 h-10 rounded-full primary-btn flex items-center justify-center disabled:opacity-50 disabled:shadow-none"
            >
              <i className="fas fa-arrow-up"></i>
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={policyUploadRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handlePolicyUpload}
      />
      <input
        ref={materialUploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleMaterialTypeFileChange}
      />

      {/* --- Overlays --- */}

      {/* Sample Image Preview Modal */}
      {previewSampleUrl && (
        <div
          className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-enter"
          onClick={() => setPreviewSampleUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[80vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewSampleUrl(null)}
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors z-10"
            >
              <i className="fas fa-xmark"></i>
            </button>
            <img
              src={previewSampleUrl}
              alt="材料样例"
              className="w-full h-full object-contain rounded-2xl shadow-2xl bg-white"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white text-xs rounded-full">
              材料样例图片
            </div>
          </div>
        </div>
      )}

      <SamplePreviewModal
        isOpen={samplePreviewData.isOpen}
        onClose={() =>
          setSamplePreviewData({ isOpen: false, url: "", name: "" })
        }
        sampleUrl={samplePreviewData.url}
        sampleName={samplePreviewData.name}
        sampleOssKey={samplePreviewData.ossKey}
      />

      {/* Upload Guide Modal */}
      {showUploadGuide && (
        <div
          className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 animate-enter"
          onClick={handleCloseUploadGuide}
        >
          <div
            className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-white/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <i className="fas fa-cloud-arrow-up"></i>
              </div>
              <div>
                <h3 className="font-bold text-slate-800">上传材料指引</h3>
                <p className="text-xs text-slate-500">SmartClaim AI 智能识别</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <i className="fas fa-robot mt-1 text-blue-500"></i>
                <p className="leading-relaxed text-xs">
                  文件上传后，系统将自动进行 <strong>OCR 识别</strong>
                  ，提取关键字段（如金额、日期、诊断）并归档。
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fas fa-check text-green-500"></i>
                  <span>支持格式：JPG, PNG, PDF</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fas fa-check text-green-500"></i>
                  <span>大小限制：单文件不超过 10MB</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fas fa-triangle-exclamation text-yellow-500"></i>
                  <span>请确保图片光线充足，文字清晰可辨</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleUploadGuideChooseFile}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <i className="fas fa-plus"></i> 选择文件
            </button>
          </div>
        </div>
      )}

      {/* Reporting Form Modal - Dynamic */}
      {showReportingForm && selectedIntakeConfig && (
        <div
          className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 animate-enter"
          onClick={handleCloseReportingForm}
        >
          <div
            className="glass-panel w-full max-w-md max-h-[85vh] rounded-[32px] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 pb-3 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800">在线报案</h3>
                {selectedPolicyForForm && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedPolicyForForm.type}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseReportingForm}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
              {/* 已上传文件显示区域 */}
              {pendingFiles.length > 0 && (
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                  <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                    <i className="fas fa-paperclip"></i>
                    已上传材料 ({pendingFiles.length})
                  </h4>
                  <div className="space-y-2">
                    {pendingFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-sm text-slate-700 bg-white/60 rounded-lg px-3 py-2"
                      >
                        <i
                          className={`fas ${file.type?.includes("image") ? "fa-image text-blue-500" : "fa-file text-gray-500"}`}
                        ></i>
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-slate-400">
                          {file.analysis?.category || "未分类"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3">
                    <i className="fas fa-info-circle text-blue-500 mr-1"></i>
                    这些文件将随报案一起提交
                  </p>
                </div>
              )}

              {selectedIntakeConfig.fields.map((field) => {
                // Handle follow_up visibility
                if (isFollowUpField(field.field_id) && !isFieldVisible(field))
                  return null;

                const value = dynamicFormValues[field.field_id];
                const error = formErrors[field.field_id];
                const inputClass = `w-full px-4 py-3 rounded-xl bg-white/50 border outline-none text-slate-700 font-medium transition-colors ${error ? "border-red-300 bg-red-50/30" : "border-white/60 focus:border-blue-400"}`;

                return (
                  <div key={field.field_id} className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 ml-1">
                      {field.label}
                      {field.required && (
                        <span className="text-red-400 ml-0.5">*</span>
                      )}
                    </label>

                    {/* text */}
                    {field.type === "text" && (
                      <input
                        type="text"
                        value={value || ""}
                        onChange={(e) =>
                          handleDynamicFormChange(
                            field.field_id,
                            e.target.value,
                          )
                        }
                        placeholder={field.placeholder}
                        className={inputClass}
                      />
                    )}

                    {/* text_with_search */}
                    {field.type === "text_with_search" &&
                    field.data_source === "hospital_db" ? (
                      <HospitalSelectField
                        value={value || ""}
                        onChange={(val) =>
                          handleDynamicFormChange(field.field_id, val)
                        }
                        placeholder={field.placeholder}
                        hospitals={hospitals}
                        isLoading={isLoadingHospitals}
                        error={error}
                      />
                    ) : field.type === "text_with_search" ? (
                      <input
                        type="text"
                        value={value || ""}
                        onChange={(e) =>
                          handleDynamicFormChange(
                            field.field_id,
                            e.target.value,
                          )
                        }
                        placeholder={field.placeholder}
                        className={inputClass}
                      />
                    ) : null}

                    {/* date */}
                    {field.type === "date" && (
                      <input
                        type="date"
                        value={value || ""}
                        onChange={(e) =>
                          handleDynamicFormChange(
                            field.field_id,
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    )}

                    {/* time */}
                    {field.type === "time" && (
                      <input
                        type="time"
                        value={value || ""}
                        onChange={(e) =>
                          handleDynamicFormChange(
                            field.field_id,
                            e.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    )}

                    {/* number */}
                    {field.type === "number" && (
                      <input
                        type="number"
                        value={value ?? ""}
                        onChange={(e) =>
                          handleDynamicFormChange(
                            field.field_id,
                            e.target.value,
                          )
                        }
                        placeholder={field.placeholder}
                        className={inputClass}
                      />
                    )}

                    {/* textarea */}
                    {field.type === "textarea" && (
                      <textarea
                        value={value || ""}
                        onChange={(e) =>
                          handleDynamicFormChange(
                            field.field_id,
                            e.target.value,
                          )
                        }
                        placeholder={field.placeholder}
                        className={`${inputClass} h-24 resize-none`}
                      />
                    )}

                    {/* enum */}
                    {field.type === "enum" && (
                      <select
                        value={value || ""}
                        onChange={(e) =>
                          handleDynamicFormChange(
                            field.field_id,
                            e.target.value,
                          )
                        }
                        className={`${inputClass} appearance-none`}
                      >
                        <option value="">
                          {field.placeholder || "请选择"}
                        </option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* enum_with_other */}
                    {field.type === "enum_with_other" && (
                      <>
                        <select
                          value={
                            value === "__other__"
                              ? "__other__"
                              : field.options?.includes(value)
                                ? value
                                : value
                                  ? "__other__"
                                  : ""
                          }
                          onChange={(e) => {
                            if (e.target.value === "__other__")
                              handleDynamicFormChange(
                                field.field_id,
                                "__other__",
                              );
                            else
                              handleDynamicFormChange(
                                field.field_id,
                                e.target.value,
                              );
                          }}
                          className={`${inputClass} appearance-none`}
                        >
                          <option value="">
                            {field.placeholder || "请选择"}
                          </option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value="__other__">其他</option>
                        </select>
                        {(value === "__other__" ||
                          (value && !field.options?.includes(value))) && (
                          <input
                            type="text"
                            value={value === "__other__" ? "" : value}
                            onChange={(e) =>
                              handleDynamicFormChange(
                                field.field_id,
                                e.target.value || "__other__",
                              )
                            }
                            placeholder="请输入..."
                            className={`${inputClass} mt-2`}
                          />
                        )}
                      </>
                    )}

                    {/* multi_select */}
                    {field.type === "multi_select" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {field.options?.map((opt) => {
                          const selected =
                            Array.isArray(value) && value.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const current = Array.isArray(value)
                                  ? value
                                  : [];
                                const next = selected
                                  ? current.filter((v: string) => v !== opt)
                                  : [...current, opt];
                                handleDynamicFormChange(field.field_id, next);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                selected
                                  ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                                  : "bg-white/40 border-white/60 text-slate-600 hover:bg-white/60"
                              }`}
                            >
                              {selected && (
                                <i className="fas fa-check mr-1 text-[10px]"></i>
                              )}
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* boolean */}
                    {field.type === "boolean" && (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "是", val: true },
                          { label: "否", val: false },
                        ].map(({ label, val }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() =>
                              handleDynamicFormChange(field.field_id, val)
                            }
                            className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${
                              value === val
                                ? "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/30"
                                : "bg-white/40 border-white/60 text-slate-500 hover:bg-white/60"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div className="text-red-500 text-xs font-medium ml-1 flex items-center gap-1">
                        <i className="fas fa-circle-exclamation text-[10px]"></i>{" "}
                        {error}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 动态材料清单展示 */}
              {calculatedMaterials && calculatedMaterials.length > 0 && (
                <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <i className="fas fa-clipboard-list text-blue-500"></i>
                      所需理赔材料（
                      {calculatedMaterials.filter((m) => m.required).length}
                      份必传 / 共{calculatedMaterials.length}份）
                    </h4>
                    <button
                      onClick={() => setShowMaterialsList(!showMaterialsList)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      {showMaterialsList ? (
                        <>
                          收起 <i className="fas fa-chevron-up text-[10px]"></i>
                        </>
                      ) : (
                        <>
                          展开{" "}
                          <i className="fas fa-chevron-down text-[10px]"></i>
                        </>
                      )}
                    </button>
                  </div>

                  {isMaterialsLoading && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="ml-2 text-sm text-slate-500">
                        计算中...
                      </span>
                    </div>
                  )}

                  {!isMaterialsLoading && showMaterialsList && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {calculatedMaterials.map((material) => (
                        <div
                          key={material.materialId}
                          className={`flex items-start gap-2 p-3 rounded-lg transition-all ${
                            material.required
                              ? "bg-red-50 border border-red-200 hover:border-red-300"
                              : "bg-white border border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <i
                            className={`fas fa-${
                              material.required
                                ? "exclamation-circle text-red-500"
                                : "info-circle text-gray-400"
                            } mt-0.5 text-sm`}
                          ></i>
                          <div className="flex-1">
                            <div className="font-medium text-sm text-slate-800">
                              {material.materialName}
                              {material.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </div>
                            {material.materialDescription && (
                              <div className="text-xs text-slate-500 mt-1">
                                {material.materialDescription}
                              </div>
                            )}
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <i className="fas fa-tag text-[10px]"></i>
                              来源: {material.sourceDetails}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isMaterialsLoading && !showMaterialsList && (
                    <div className="text-xs text-center text-slate-500">
                      点击“展开”查看所需材料清单
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 pt-3 shrink-0">
              <button
                onClick={handleFormSubmit}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 active:scale-95 transition-transform"
              >
                提交报案
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera */}
      {isCameraOpen && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col">
          <div className="relative flex-1 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            ></video>
            <button
              onClick={closeCamera}
              className="absolute top-6 right-6 w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center"
            >
              <i className="fas fa-xmark"></i>
            </button>
          </div>
          <div className="h-32 bg-black flex items-center justify-center gap-8">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
            >
              <div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform"></div>
            </button>
          </div>
        </div>
      )}

      {/* Voice Mode */}
      {isVoiceMode && (
        <div
          className="absolute inset-0 z-40 flex flex-col animate-enter overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #e0f2fe 0%, #dbeafe 30%, #e0e7ff 65%, #ede9fe 100%)",
          }}
        >
          {/* 柔光光斑 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-white/50 blur-3xl"></div>
            <div className="absolute top-[55%] left-[20%] w-40 h-40 rounded-full bg-sky-200/50 blur-3xl"></div>
            <div className="absolute top-[30%] right-[15%] w-32 h-32 rounded-full bg-indigo-200/40 blur-3xl"></div>
          </div>

          {/* 顶部栏 */}
          <div className="relative flex items-center justify-between px-6 pt-6">
            <button className="w-9 h-9 flex items-center justify-center text-slate-600/80">
              <i className="fas fa-ellipsis text-lg"></i>
            </button>
            <div className="flex-1" />
            <button className="w-9 h-9 flex items-center justify-center text-slate-600/80 text-base font-medium">
              字<i className="fas fa-circle-check ml-0.5 text-[10px] text-slate-500"></i>
            </button>
          </div>

          {/* 左上文字 */}
          <div className="relative px-8 mt-14">
            {voiceTranscript ? (
              <p className="text-slate-800 text-xl font-medium leading-relaxed max-w-[80%]">
                {voiceTranscript}
              </p>
            ) : (
              <p className="text-slate-400 text-xl">请说话</p>
            )}
          </div>

          {/* 中间留白 + 提示 */}
          <div className="relative flex-1 flex flex-col items-center justify-end pb-8">
            <div className="flex gap-1.5 mb-4">
              {[0, 150, 300].map((delay, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-500/70 animate-pulse"
                  style={{ animationDelay: `${delay}ms` }}
                ></span>
              ))}
            </div>
            <p className="text-slate-500 text-sm">
              {isTranscribing
                ? "正在处理..."
                : voiceStatusText === "请直接描述您的事故情况"
                ? "你可以开始说话"
                : voiceStatusText}
            </p>
          </div>

          {/* 底部按钮行 */}
          <div className="relative flex items-center justify-center pb-3 px-6">
            <button
              onClick={toggleVoiceMode}
              className="w-14 h-14 rounded-full bg-white/55 backdrop-blur-md shadow-sm border border-white/70 flex items-center justify-center text-rose-500 hover:bg-white/75 transition-all"
            >
              <i className="fas fa-xmark text-xl"></i>
            </button>
          </div>

          <p className="relative text-center text-slate-400 text-xs pb-5 pt-3">
            内容由 AI 生成
          </p>
        </div>
      )}

      {/* Detail View */}
      {selectedDetailClaim && (
        <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg max-h-[85vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-enter">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50">
              <h2 className="text-xl font-bold text-slate-800">案件详情</h2>
              <button
                onClick={handleCloseClaimDetail}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
              {/* Status Section */}
              <div className="p-5 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 shadow-sm">
                <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">
                  Current Status
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-slate-800">
                    {getStatusLabel(selectedDetailClaim.status)}
                  </span>
                  <span className="text-2xl text-blue-500">
                    <i
                      className={`fas ${
                        selectedDetailClaim.status === ClaimStatus.PAID
                          ? "fa-circle-check"
                          : selectedDetailClaim.status === ClaimStatus.REJECTED
                            ? "fa-circle-xmark"
                            : "fa-spinner fa-spin"
                      }`}
                    ></i>
                  </span>
                </div>
                {selectedDetailClaim.assessment && (
                  <div className="text-sm text-slate-600 bg-white/60 p-3 rounded-lg border border-blue-50/50">
                    {selectedDetailClaim.assessment.reasoning}
                  </div>
                )}
              </div>

              {/* Timeline Section */}
              {selectedDetailClaim.timeline &&
                selectedDetailClaim.timeline.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <i className="fas fa-clock-rotate-left"></i> 理赔进度
                    </h4>
                    <div className="relative pl-2">
                      {/* Vertical Connector Line */}
                      <div className="absolute left-[7px] top-2 bottom-4 w-0.5 bg-slate-100"></div>

                      <div className="space-y-6">
                        {selectedDetailClaim.timeline.map((event, idx) => (
                          <div key={idx} className="relative flex gap-4 group">
                            <div
                              className={`w-4 h-4 rounded-full mt-1 shrink-0 z-10 ring-4 ring-white transition-all duration-500 ${
                                event.status === "completed"
                                  ? "bg-blue-500 shadow-lg shadow-blue-500/30"
                                  : event.status === "active"
                                    ? "bg-green-500 animate-pulse shadow-lg shadow-green-500/30"
                                    : "bg-slate-200"
                              }`}
                            ></div>
                            <div
                              className={`${event.status === "pending" ? "opacity-50" : "opacity-100"}`}
                            >
                              <div className="text-[10px] font-bold text-slate-400 font-mono tracking-wide mb-0.5 uppercase">
                                {event.date}
                              </div>
                              <div
                                className={`text-sm font-bold mb-1 ${event.status === "active" ? "text-green-600" : "text-slate-700"}`}
                              >
                                {event.label}
                              </div>
                              <div className="text-xs text-slate-500 leading-relaxed max-w-[280px]">
                                {event.description}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* Required Materials Section */}
              {selectedDetailClaim.requiredMaterials &&
                selectedDetailClaim.requiredMaterials.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <i className="fas fa-clipboard-list"></i> 材料清单
                    </h4>
                    <div className="space-y-3">
                      {selectedDetailClaim.requiredMaterials.map((material) => {
                        const uploadedFiles = getUploadedFilesForMaterial(
                          selectedDetailClaim,
                          material.materialId,
                        );

                        return (
                          <div
                            key={material.materialId}
                            className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-800">
                                    {material.materialName}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      material.required
                                        ? "bg-red-100 text-red-600"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {material.required ? "必传" : "选传"}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                      material.uploaded
                                        ? "bg-emerald-100 text-emerald-600"
                                        : "bg-amber-100 text-amber-600"
                                    }`}
                                  >
                                    {material.uploaded ? "已上传" : "待上传"}
                                  </span>
                                  {uploadedFiles.length > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-600">
                                      已挂接 {uploadedFiles.length} 份
                                    </span>
                                  )}
                                </div>
                                {material.materialDescription && (
                                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                                    {material.materialDescription}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  handleMaterialUploadForType(material.materialId)
                                }
                                className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                              >
                                上传
                              </button>
                            </div>

                            {uploadedFiles.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                {uploadedFiles.map((file, index) => (
                                  <div
                                    key={`${material.materialId}-${index}-${file.name}`}
                                    className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2"
                                  >
                                    <i className="fas fa-file-lines text-slate-400"></i>
                                    <span className="truncate">{file.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Documents Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <i className="fas fa-folder-open"></i> 关联材料
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedDetailClaim.documents?.map((d, i) => (
                    <div
                      key={i}
                      className="p-3 bg-white rounded-xl border border-slate-100 flex flex-col gap-3 hover:shadow-md transition-shadow"
                    >
                      <div
                        onClick={() => handleDocumentClick(d)}
                        className="flex items-center gap-3 cursor-pointer active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                          <i className={`fas ${getDocIcon(d.name)}`}></i>
                        </div>
                        <div className="overflow-hidden min-w-0">
                          <div className="text-sm font-bold text-slate-700 truncate">
                            {d.name}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1">
                            <i className="fas fa-check-circle text-green-500 text-[10px]"></i>{" "}
                            已验证
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            当前归类：{d.category || "未分类"}
                          </div>
                        </div>
                      </div>
                      {selectedDetailClaim.requiredMaterials &&
                        selectedDetailClaim.requiredMaterials.length > 0 && (
                          <div
                            className="flex items-center gap-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <select
                              value={
                                documentMaterialSelections[
                                  d.id || `${d.name}-${d.url || d.ossKey || ""}`
                                ] || ""
                              }
                              onChange={(event) =>
                                setDocumentMaterialSelections((prev) => ({
                                  ...prev,
                                  [d.id || `${d.name}-${d.url || d.ossKey || ""}`]:
                                    event.target.value,
                                }))
                              }
                              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-400"
                            >
                              <option value="">重新归类到材料项</option>
                              {selectedDetailClaim.requiredMaterials.map((material) => (
                                <option
                                  key={material.materialId}
                                  value={material.materialId}
                                >
                                  {material.materialName}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() =>
                                handleReassignDocumentMaterial(
                                  selectedDetailClaim,
                                  d,
                                )
                              }
                              disabled={
                                reassigningDocumentKey ===
                                  (d.id || `${d.name}-${d.url || d.ossKey || ""}`) ||
                                !documentMaterialSelections[
                                  d.id || `${d.name}-${d.url || d.ossKey || ""}`
                                ]
                              }
                              className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                            >
                              保存
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                  {!selectedDetailClaim.documents?.length && (
                    <div className="text-sm text-slate-400 italic py-4 text-center w-full bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      暂无关联文件
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Inspector Modal (List View) */}
      {fileInspectData && (
        <div className="absolute inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-enter">
          <div className="w-full sm:max-w-lg bg-white h-[90vh] sm:h-auto sm:max-h-[80vh] sm:rounded-[32px] rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
              <h3 className="text-lg font-bold text-slate-800">
                文件详情 ({fileInspectData.length})
              </h3>
              <button
                onClick={handleCloseFileInspect}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {fileInspectData.map((doc, i) => (
                <FileInspectorItem
                  key={i}
                  doc={doc}
                  index={i}
                  isError={hasMissingFields(doc)}
                  failedImages={failedImages}
                  setFailedImages={setFailedImages}
                  isExpanded={expandedDocIndex === i}
                  onPreview={(d) => handlePreviewAttachment(d, "文件列表")}
                  onToggleExpand={(idx) =>
                    setExpandedDocIndex(expandedDocIndex === idx ? null : idx)
                  }
                  onReplaceFile={handleReplaceFileClick}
                />
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 bg-white">
              <button
                onClick={handleCloseFileInspect}
                className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal (Full Screen) */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[200] flex flex-col animate-enter">
          {/* Top Bar */}
          <div className="h-16 bg-black/95 text-white flex items-center justify-between px-6 border-b border-white/10 shrink-0">
            <h3 className="font-bold truncate max-w-md">
              {previewAttachment.name}
            </h3>
            <button
              onClick={handleClosePreview}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <i className="fas fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-black/90 relative overflow-hidden">
            {previewAttachment.type.includes("image") &&
            (previewAttachment.base64 || previewAttachment.url) ? (
              <ImagePreview attachment={previewAttachment} />
            ) : previewAttachment.type.includes("pdf") &&
              previewAttachment.base64 ? (
              <iframe
                src={`data:application/pdf;base64,${previewAttachment.base64}`}
                className="w-full h-full bg-white"
                title={previewAttachment.name}
              ></iframe>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 flex-col gap-4">
                <i className="fas fa-file-circle-question text-6xl"></i>
                <p>无法预览此文件类型或文件内容未加载</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
