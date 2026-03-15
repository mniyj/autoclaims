import { readData, writeData } from "../utils/fileStore.js";
import { analyzeMultiFiles } from "../services/multiFileAnalyzer.js";
import { aggregateCase } from "../services/caseAggregator.js";
import { generateDamageReport } from "../services/reportGenerator.js";
import { summarizePaymentEvidence } from "../services/paymentEvidenceService.js";
import { buildDecisionTrace } from "../services/decisionTraceService.js";
import { summarizeHandlingProfile } from "../services/handlingProfileService.js";

const SUMMARY_MATERIAL_IDS = new Set([
  "case_initial_report",
  "case_public_adjuster_report",
  "mat-7",
  "mat-43",
  "mat-44",
  "mat-45",
  "mat-57",
  "mat-58",
  "mat-64",
  "mat-65",
  "mat-66",
]);

function normalizeChineseDate(value) {
  if (!value) return null;
  const match = String(value)
    .replace(/\s+/g, "")
    .match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function buildTextAnchor(rawText) {
  if (!rawText) return undefined;
  return {
    pageIndex: 0,
    rawText: String(rawText).trim(),
    highlightLevel: "text_search",
  };
}

function matchValue(text, patterns = []) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return {
        value: match[1].trim(),
        rawText: match[0].trim(),
      };
    }
  }
  return null;
}

function matchNumber(text, patterns = []) {
  const matched = matchValue(text, patterns);
  if (!matched) return null;
  const numeric = Number(String(matched.value).replace(/[,，]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return {
    value: numeric,
    rawText: matched.rawText,
  };
}

function inferRelationshipLabel(rawRelationship = "") {
  if (/夫妻/.test(rawRelationship)) return "配偶";
  if (/父子|父女|母子|母女|兄弟姐妹/.test(rawRelationship)) return rawRelationship;
  return rawRelationship || null;
}

function extractCaseReportSummary(doc) {
  const text = String(doc.extractedText || "");
  if (!text) return null;

  const reportType = /初\s*期\s*报\s*告/.test(text)
    ? "initial"
    : /终\s*期\s*报\s*告|公估报告/.test(text)
      ? "public_adjuster"
      : "other";
  const accidentDateMatch = matchValue(text, [
    /出险(?:时间|日期)[:：]?\s*([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?)/,
    /([0-9]{4}[.\-/][0-9]{1,2}[.\-/][0-9]{1,2})作业事故/,
  ]);
  const accidentLocationMatch = matchValue(text, [
    /出险地点[:：]?\s*([^\n]+)/,
    /查勘地点[:：]?\s*([^\n]+)/,
  ]);
  const victimNameMatch = matchValue(text, [
    /姓名[:：]?\s*([^\s，。,；;]+)/,
    /工人([^\s，。,；;]{2,8})被砸受伤/,
    /工人([^\s，。,；;]{2,8})送至/,
  ]);
  const compensationPaidMatch = matchNumber(text, [
    /三者理算金额\s*RMB\s*([0-9,]+(?:\.[0-9]+)?)/,
    /已赔付(?:金额)?[:：]?\s*([0-9,]+(?:\.[0-9]+)?)/,
    /赔付(?:金额)?[:：]?\s*([0-9,]+(?:\.[0-9]+)?)/,
  ]);

  let incidentSummary = null;
  const sectionMatch = text.match(/二、事情经过([\s\S]*?)(?:三、|$)/);
  if (sectionMatch?.[1]) {
    incidentSummary = sectionMatch[1].replace(/\s+/g, " ").trim();
  } else {
    const sentenceMatch = text.match(/([^。]*?(?:抢救无效死亡|导致[^。]{0,20}死亡|三者工人死亡)[^。]*。?)/);
    incidentSummary = sentenceMatch?.[1]?.replace(/\s+/g, " ").trim() || null;
  }

  const employmentMatch = matchValue(text, [
    /(黄山永顺起重设备安装有限公司的员工费斌斌操作[\s\S]{0,120}?黄山景泰起重设备安装工程有限公司4名工人协助捆绑和摘钩)/,
    /(受雇[\s\S]{0,80}?作业)/,
  ]);
  const liabilityOpinionMatch = matchValue(text, [
    /保单责任[:：]?\s*([^\n]+)/,
    /责任分析[:：]?\s*([^\n]+)/,
    /责任意见[:：]?\s*([^\n]+)/,
  ]);
  const suggestedRatioMatch = matchValue(text, [
    /(按照同等责任协商)/,
    /(同等责任)/,
  ]);
  const urbanIncomeMatch = matchNumber(text, [
    /死亡赔偿金[:：]\s*([0-9,]+(?:\.[0-9]+)?)元\/年×20年/,
  ]);
  const funeralAnnualSalaryMatch = matchNumber(text, [
    /丧葬费[:：]\s*([0-9,]+(?:\.[0-9]+)?)元\/年÷12个月×6个月/,
  ]);

  const deathConfirmed = /死亡|抢救无效/.test(text);
  const deathDateMatch = matchValue(text, [
    /死亡日期[:：]?\s*([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?)/,
  ]) || accidentDateMatch;

  const sourceAnchors = {};
  if (accidentDateMatch) sourceAnchors.accidentDate = buildTextAnchor(accidentDateMatch.rawText);
  if (accidentLocationMatch) sourceAnchors.accidentLocation = buildTextAnchor(accidentLocationMatch.rawText);
  if (incidentSummary) sourceAnchors.incidentSummary = buildTextAnchor(incidentSummary.slice(0, 120));

  return {
    docId: doc.documentId,
    summaryType: "case_report",
    extractedAt: new Date().toISOString(),
    reportType,
    victimName: victimNameMatch?.value || null,
    accidentDate: normalizeChineseDate(accidentDateMatch?.value),
    accidentLocation: accidentLocationMatch?.value || null,
    incidentSummary,
    deathConfirmed,
    deathDate: deathConfirmed ? normalizeChineseDate(deathDateMatch?.value) : null,
    identityChainSummary: employmentMatch?.value?.replace(/\s+/g, " ").trim() || null,
    liabilityOpinion: liabilityOpinionMatch?.value || null,
    compensationPaid: compensationPaidMatch?.value ?? null,
    suggestedLiabilityPct: suggestedRatioMatch ? 50 : null,
    regionalStandards: urbanIncomeMatch || funeralAnnualSalaryMatch
      ? {
          region: /安徽/.test(text) ? "安徽省" : null,
          year: 2024,
          urbanPerCapitaIncome: urbanIncomeMatch?.value || null,
          funeralMonthlySalary: funeralAnnualSalaryMatch?.value
            ? parseFloat((funeralAnnualSalaryMatch.value / 12).toFixed(2))
            : null,
        }
      : null,
    claimants: [],
    sourceAnchors,
    confidence: 0.78,
  };
}

function extractDeathRecordSummary(doc) {
  const text = String(doc.extractedText || "");
  if (!text) return null;

  const deceasedMatch = matchValue(text, [
    /死者姓名[:：]?\s*([^\s*，,\n]+)/,
    /姓名[:：]?\s*([^\s，,\n]+)/,
    /村民([^\s（(，,\n]{2,8})\s*[（(]身份证/,
  ]);
  const deathDateMatch = matchValue(text, [
    /死亡日期[:：]?\s*([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?)/,
    /于\s*([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?)因/,
  ]);
  const cancellationDateMatch = matchValue(text, [
    /于\s*([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?)办理死亡注销/,
    /户口已注销[^\n]{0,30}?([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?)/,
  ]);
  const deathCauseMatch = matchValue(text, [
    /死亡原因[:：]?\s*([^\n]+)/,
    /因([^\n]{0,40}?死亡)/,
  ]);
  const deathLocationMatch = matchValue(text, [
    /死亡地点[:：]?\s*([^\n]+)/,
  ]);
  const issuingAuthorityMatch = matchValue(text, [
    /证明单位[:：]?\s*([^\n]+)/,
    /(休宁县公安局|海阳县公安局|海阳派出所|盐铺村村民委员会)/,
  ]);

  const sourceAnchors = {};
  if (deceasedMatch) sourceAnchors.deceasedName = buildTextAnchor(deceasedMatch.rawText);
  if (deathDateMatch) sourceAnchors.deathDate = buildTextAnchor(deathDateMatch.rawText);

  return {
    docId: doc.documentId,
    summaryType: "death_record",
    extractedAt: new Date().toISOString(),
    deceasedName: deceasedMatch?.value || null,
    deathDate: normalizeChineseDate(deathDateMatch?.value),
    cancellationDate: normalizeChineseDate(cancellationDateMatch?.value),
    deathCause: deathCauseMatch?.value || null,
    deathLocation: deathLocationMatch?.value || null,
    issuingAuthority: issuingAuthorityMatch?.value || null,
    sourceAnchors,
    confidence: 0.86,
  };
}

function extractHouseholdProofSummary(doc) {
  const text = String(doc.extractedText || "");
  if (!text) return null;

  const residentMatch = matchValue(text, [
    /户主姓名\s*([^\s\n]+)/,
    /姓名[:：]?\s*([^\s\n]+)/,
  ]);
  const householdTypeMatch = matchValue(text, [
    /户\s*别\s*([^\s\n]+)/,
  ]);
  const addressMatch = matchValue(text, [
    /住\s*址\s*([^\n]+)/,
  ]);
  const authorityMatch = matchValue(text, [
    /户口登记机关\s*([^\n]+)/,
    /(海口市公安局|海阳县公安局|海阳派出所)/,
  ]);
  const issueDateMatch = matchValue(text, [
    /([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?)签发/,
  ]);

  return {
    docId: doc.documentId,
    summaryType: "household_proof",
    extractedAt: new Date().toISOString(),
    residentName: residentMatch?.value || null,
    householdType: householdTypeMatch?.value || null,
    householdAddress: addressMatch?.value || null,
    issuingAuthority: authorityMatch?.value || null,
    issueDate: normalizeChineseDate(issueDateMatch?.value),
    sourceAnchors: {
      householdType: buildTextAnchor(householdTypeMatch?.rawText),
    },
    confidence: 0.82,
  };
}

function extractClaimantRelationshipSummary(doc) {
  const text = String(doc.extractedText || "");
  if (!text) return null;

  const deceasedMatch = matchValue(text, [
    /村民([^\s（(，,\n]{2,8})\s*[（(]身份证号/,
    /(方冬九)/,
  ]);
  const relationMatch = text.match(/与\s*([^\s（(，,\n]{2,8})\s*(?:[（(][^）)]*[）)])?\s*为\s*(夫妻|父子|父女|母子|母女|兄弟姐妹)关系/);
  const authorityMatch = matchValue(text, [
    /证明单位[:：]\s*([^\n]+)/,
  ]);
  const issueDateMatch = matchValue(text, [
    /证明时间[:：]?\s*([0-9]{4}[.\-/年]\s*[0-9]{1,2}[.\-/月]\s*[0-9]{1,2}日?号?)/,
    /([0-9]{4}[.\-/年]\s*[0-9]{1,2}[.\-/月]\s*[0-9]{1,2}日?号?)/,
  ]);

  if (!relationMatch && !deceasedMatch) return null;

  return {
    docId: doc.documentId,
    summaryType: "claimant_relationship",
    extractedAt: new Date().toISOString(),
    deceasedName: deceasedMatch?.value || null,
    claimantName: relationMatch?.[1] || null,
    relationship: inferRelationshipLabel(relationMatch?.[2] || ""),
    issuingAuthority: authorityMatch?.value || null,
    issueDate: normalizeChineseDate(issueDateMatch?.value),
    sourceAnchors: {
      relationship: buildTextAnchor(relationMatch?.[0]),
    },
    confidence: 0.85,
  };
}

function extractPoliceCallSummary(doc) {
  const text = String(doc.extractedText || "");
  if (!text) return null;

  const callTimeMatch = matchValue(text, [
    /报警时间[:：]?\s*([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2}日?\s*[0-9]{1,2}[:：时][0-9]{1,2}分?)/,
    /(2024[\/.-]\d{2}[\/.-]\d{2}\s+\d{2}:\d{2}:\d{2})/,
  ]);
  const handlingUnitMatch = matchValue(text, [
    /(?:处理单位|接警单位|出警单位)[:：]?\s*([^\n]+)/,
    /(商山派出所|休宁县公安局[^\n]{0,12}|110指挥中心)/,
  ]);
  const summaryMatch = matchValue(text, [
    /(拨打了?110[\s\S]{0,80}?事故)/,
    /(报警应该是景泰公司的人拨打的110[^\n]*)/,
    /(接警后[^\n]{0,80})/,
  ]);

  return {
    docId: doc.documentId,
    summaryType: "police_call_record",
    extractedAt: new Date().toISOString(),
    callTime: normalizeChineseDate(callTimeMatch?.value),
    handlingUnit: handlingUnitMatch?.value || null,
    incidentSummary: summaryMatch?.value || "材料记载事故后存在 110 报警/接警事实",
    sourceAnchors: {
      incidentSummary: buildTextAnchor(summaryMatch?.rawText || handlingUnitMatch?.rawText),
    },
    confidence: 0.7,
  };
}

function extractInterviewSummary(doc) {
  const text = String(doc.extractedText || "");
  if (!text) return null;

  const recordPersonMatch = matchValue(text, [
    /(?:请问|被询问人|陈述人)[^。\n]{0,20}?([^\s，。,；;\n]{2,8})/,
    /黄灿叶|费斌斌|方冬九/,
  ]);
  const recordingUnitMatch = matchValue(text, [
    /(商山派出所|休宁县公安局|阳光财产保险[^\n]{0,20}|湖南立衡保险公估有限公司)/,
  ]);
  const incidentStatementMatch = matchValue(text, [
    /(刚吊起来的塔吊控制室突然失衡[\s\S]{0,120}?已无抢救生还可能)/,
    /(我便操作起重机进行吊运[\s\S]{0,120}?砸到了方冬九)/,
  ]);

  return {
    docId: doc.documentId,
    summaryType: "incident_interview",
    extractedAt: new Date().toISOString(),
    recordPerson: recordPersonMatch?.value || null,
    recordingUnit: recordingUnitMatch?.value || null,
    incidentStatement: incidentStatementMatch?.value || "笔录记载了事故经过及相关人员陈述",
    sourceAnchors: {
      incidentStatement: buildTextAnchor(incidentStatementMatch?.rawText),
    },
    confidence: 0.74,
  };
}

function extractEmploymentChatSummary(doc) {
  const text = String(doc.extractedText || "");
  const fileName = String(doc.fileName || "");
  if (!text && !fileName) return null;

  const participants = [];
  for (const name of ["汪国亮", "琚强强", "黄山永顺", "黄山景泰"]) {
    if (text.includes(name) || fileName.includes(name)) {
      participants.push(name);
    }
  }
  const taskSummaryMatch = matchValue(text, [
    /(吊装任务[\s\S]{0,60}?对接)/,
    /(派工记录[\s\S]{0,80})/,
    /(安排[\s\S]{0,60}?吊装)/,
  ]);
  const relationHintMatch = matchValue(text, [
    /(我这边接到老板安排的景泰公司吊装任务都是和琚强强对接)/,
    /(景泰公司吊装任务[^\n]*)/,
  ]);

  return {
    docId: doc.documentId,
    summaryType: "identity_chain_evidence",
    extractedAt: new Date().toISOString(),
    communicationDate: normalizeChineseDate(matchValue(text, [/(\d{4}[.\-/年]\d{1,2}[.\-/月]\d{1,2}日?)/])?.value),
    participants,
    taskSummary: taskSummaryMatch?.value || fileName || "材料反映了吊装派工或沟通安排",
    relationHint: relationHintMatch?.value || null,
    sourceAnchors: {
      taskSummary: buildTextAnchor(taskSummaryMatch?.rawText || relationHintMatch?.rawText || fileName),
    },
    confidence: 0.68,
  };
}

function extractPaymentVoucherSummary(doc) {
  const text = String(doc.extractedText || "");
  if (!text) return null;

  const amount = matchNumber(text, [
    /¥\s*([0-9,]+(?:\.[0-9]+)?)/,
    /转账金额[:：]?\s*([0-9,]+(?:\.[0-9]+)?)/,
  ]);
  if (!amount) return null;

  const payeeMatch = matchValue(text, [
    /胡荣妹/,
    /收款人[:：]?\s*([^\n]+)/,
  ]);
  const paidAtMatch = matchValue(text, [
    /交易时间\s*(\d{4}\/\d{2}\/\d{2})/,
    /付款时间[:：]?\s*([0-9]{4}[.\-/年][0-9]{1,2}[.\-/月][0-9]{1,2})/,
  ]);
  const voucherNumberMatch = matchValue(text, [
    /凭证号\s*([A-Za-z0-9]+)/,
  ]);
  const noteMatch = matchValue(text, [
    /附言\s*([^\n]+)/,
  ]);

  return {
    docId: doc.documentId,
    summaryType: "payment_voucher",
    extractedAt: new Date().toISOString(),
    paidAmount: amount.value,
    payeeName: payeeMatch?.value || null,
    paidAt: normalizeChineseDate(paidAtMatch?.value),
    voucherNumber: voucherNumberMatch?.value || null,
    paymentNote: noteMatch?.value || null,
    sourceAnchors: {
      paidAmount: buildTextAnchor(amount.rawText),
      voucherNumber: buildTextAnchor(voucherNumberMatch?.rawText),
    },
    confidence: 0.88,
  };
}

function extractIncidentStatementSummary(doc) {
  const text = String(doc.extractedText || "");
  const fileName = String(doc.fileName || "");
  if (!text && !fileName) return null;

  const authorityMatch = matchValue(text, [
    /(商山镇人民政府|休宁县商山镇政府|休宁县应急管理局|村民委员会)/,
  ]);
  const summaryMatch = matchValue(text, [
    /(由于吊车驾驶员对起吊货物没有进行试吊的情况下就直接起吊导致货物侧翻砸到地面人员[\s\S]{0,40}?致其死亡)/,
    /(事故发生经过[\s\S]{0,120})/,
  ]);
  const liabilityHintMatch = matchValue(text, [
    /(没有进行试吊的情况下就直接起吊导致货物侧翻)/,
    /(应配备指挥员或者安全监督员)/,
  ]);

  return {
    docId: doc.documentId,
    summaryType: "incident_statement",
    extractedAt: new Date().toISOString(),
    issueDate: normalizeChineseDate(matchValue(text, [/(\d{4}[.\-/年]\d{1,2}[.\-/月]\d{1,2}日?)/])?.value),
    issuingAuthority: authorityMatch?.value || null,
    incidentSummary: summaryMatch?.value || fileName || "材料说明了事故经过及相关管理情况",
    liabilityHint: liabilityHintMatch?.value || null,
    sourceAnchors: {
      incidentSummary: buildTextAnchor(summaryMatch?.rawText || liabilityHintMatch?.rawText || fileName),
    },
    confidence: 0.8,
  };
}

function extractLiabilityEvidence(doc) {
  const text = String(doc.extractedText || "");
  const fileName = String(doc.fileName || "");
  if (!text) return null;

  if (/事故证明|政府情况说明/.test(fileName) || /没有进行试吊/.test(text)) {
    const accidentDateMatch = matchValue(text, [
      /(\d{4}年\d{1,2}月\d{1,2}日)上午\d{1,2}时\d{1,2}分左右/,
    ]);
    const reasoningMatch = matchValue(text, [
      /(由于吊车驾驶员对起吊货物没有进行试吊的情况下就直接起吊导致货物侧翻砸到地面人员[\s\S]{0,30}?致其死亡)/,
    ]);
    return {
      type: "government_statement",
      sourceDocId: doc.documentId,
      sourceFileName: fileName,
      accidentDate: normalizeChineseDate(accidentDateMatch?.value),
      text: reasoningMatch?.value || "镇政府情况说明指向吊车驾驶员未试吊直接起吊导致货物侧翻伤人死亡",
      confidence: 0.72,
    };
  }

  if (/笔录/.test(fileName) && /试吊|侧翻|赔偿协议/.test(text)) {
    const evidenceText =
      matchValue(text, [/(刚吊起来的塔吊控制室突然失衡[\s\S]{0,80}?砸到了方冬九)/])?.value ||
      matchValue(text, [/(赔偿方冬九家属\s*100\s*万元[\s\S]{0,40}?支付\s*15\s*万元)/])?.value ||
      null;
    return {
      type: "witness_statement",
      sourceDocId: doc.documentId,
      sourceFileName: fileName,
      text: evidenceText || "询问笔录记载了作业经过及赔偿协商情况",
      confidence: 0.6,
    };
  }

  return null;
}

function extractPaymentEvidence(doc) {
  const text = String(doc.extractedText || "");
  const fileName = String(doc.fileName || "");
  if (!text) return null;

  const transferAmount = matchNumber(text, [
    /转账金额\s*¥\s*([0-9,]+(?:\.[0-9]+)?)/,
    /¥\s*([0-9,]+(?:\.[0-9]+)?)\s*\n交易时间/,
  ]);
  const paidTo = matchValue(text, [
    /户名\s*([^\n]+)/,
    /胡荣妹/,
  ]);
  const memo = matchValue(text, [
    /附言\s*([^\n]+)/,
  ]);

  if (transferAmount) {
    return {
      type: "bank_transfer",
      sourceDocId: doc.documentId,
      sourceFileName: fileName,
      amount: transferAmount.value,
      payee: paidTo?.value || null,
      description: memo?.value || "赔偿款转账记录",
      paidAt: normalizeChineseDate(matchValue(text, [/交易时间\s*(\d{4}\/\d{2}\/\d{2})/])?.value),
    };
  }

  const agreementMatch = text.match(/赔偿方冬九家属\s*([0-9]+)\s*万元[\s\S]{0,40}?赔付方冬九家属\s*([0-9]+)\s*万元[\s\S]{0,40}?支付\s*([0-9]+)\s*万元丧葬费/);
  if (agreementMatch) {
    return {
      type: "agreement_note",
      sourceDocId: doc.documentId,
      sourceFileName: fileName,
      insuredCompanyCompensation: Number(agreementMatch[1]) * 10000,
      thirdPartyCompanyCompensation: Number(agreementMatch[2]) * 10000,
      funeralAdvancePaid: Number(agreementMatch[3]) * 10000,
      description: "笔录记载已与家属达成赔偿协议并垫付部分丧葬费",
    };
  }

  return null;
}

function buildLiabilitySuggestionFromEvidence(aggregation, liabilityEvidence = []) {
  if (aggregation.liabilityResult || aggregation.liabilityApportionment) {
    if (aggregation.liabilityResult) {
      return aggregation.liabilitySuggestion;
    }

    return {
      status: "REFERENCE_READY",
      conclusion: `公估报告建议按第三方责任 ${aggregation.liabilityApportionment.thirdPartyLiabilityPct}% 作为现阶段折算比例`,
      confidence: aggregation.liabilityApportionment.confidence || 0.75,
      basis: [
        {
          type: "public_adjuster_report",
          sourceDocId: aggregation.liabilityApportionment.sourceDocId,
          text: aggregation.liabilityApportionment.basis,
        },
      ],
    };
  }

  const governmentEvidence = liabilityEvidence.find((item) => item.type === "government_statement");
  if (!governmentEvidence) {
    return aggregation.liabilitySuggestion;
  }

  const basis = liabilityEvidence
    .slice(0, 3)
    .map((item) => ({
      type: item.type,
      sourceDocId: item.sourceDocId,
      text: item.text || item.description || item.sourceFileName,
    }));

  return {
    status: "MANUAL_REVIEW",
    conclusion: "现有材料倾向认定涉事吊车驾驶员未试吊直接起吊导致货物侧翻伤人，永顺侧存在明显作业过失；但缺少正式责任比例文书，暂不能自动折算比例",
    confidence: 0.68,
    basis,
  };
}

function deriveRegionalStandards(summaries = []) {
  const configured = (readData("compensation-standards") || []).find(
    (item) => item.region === "安徽省" && Number(item.year) === 2024
  );
  if (configured) {
    return {
      region: configured.region,
      year: configured.year,
      urbanPerCapitaIncome: configured.urbanPerCapitaIncome,
      funeralMonthlySalary: configured.funeralMonthlySalary,
      sourceDocument: configured.sourceDocument || null,
      source: "configured_standard",
    };
  }

  const reports = summaries.filter((item) => item?.summaryType === "case_report");
  for (const report of reports) {
    if (report?.regionalStandards?.urbanPerCapitaIncome || report?.regionalStandards?.funeralMonthlySalary) {
      return {
        region: report.regionalStandards.region || "安徽省",
        year: report.regionalStandards.year || 2024,
        urbanPerCapitaIncome: report.regionalStandards.urbanPerCapitaIncome || 47446,
        funeralMonthlySalary: report.regionalStandards.funeralMonthlySalary || 8499.92,
        sourceDocument: report.regionalStandards.sourceDocument || "案卷材料提取",
        source: "material_extraction",
      };
    }
  }
  return null;
}

function deriveLiabilityApportionment(aggregation, summaries = []) {
  if (aggregation.liabilityResult && Number.isFinite(aggregation.liabilityResult.thirdPartyLiabilityPct)) {
    return null;
  }

  const reportCandidates = summaries.filter(
    (item) => item?.summaryType === "case_report" && Number.isFinite(item?.suggestedLiabilityPct)
  );
  const report = reportCandidates.find((item) => item?.reportType === "public_adjuster")
    || reportCandidates.find((item) => item?.reportType === "initial")
    || reportCandidates[0];
  if (!report) return null;

  return {
    claimantLiabilityPct: 100 - report.suggestedLiabilityPct,
    thirdPartyLiabilityPct: report.suggestedLiabilityPct,
    source: "public_adjuster_report",
    sourceDocId: report.docId,
    basis: "公估报告载明“本案最终建议总损失扣除交强险死亡伤残项限额后再按照同等责任协商”",
    confidence: 0.82,
  };
}

function mergeLiabilityApportionment(existing, derived) {
  if (!existing && !derived) return null;
  if (!existing) return derived;
  if (!derived) return existing;
  return {
    ...derived,
    ...existing,
    sourceDocId: existing.sourceDocId || derived.sourceDocId || null,
    basis: existing.basis || derived.basis || null,
  };
}

function extractLocalSummary(doc) {
  const materialId = doc.classification?.materialId;
  if (!SUMMARY_MATERIAL_IDS.has(materialId)) return null;

  switch (materialId) {
    case "case_initial_report":
    case "case_public_adjuster_report":
      return extractCaseReportSummary(doc);
    case "mat-43":
    case "mat-44":
      return extractDeathRecordSummary(doc);
    case "mat-7":
      return extractHouseholdProofSummary(doc);
    case "mat-45":
      return extractClaimantRelationshipSummary(doc);
    case "mat-57":
      return extractPoliceCallSummary(doc);
    case "mat-58":
      return extractInterviewSummary(doc);
    case "mat-64":
      return extractEmploymentChatSummary(doc);
    case "mat-65":
      return extractPaymentVoucherSummary(doc);
    case "mat-66":
      return extractIncidentStatementSummary(doc);
    default:
      return null;
  }
}

function buildDocumentsFromMaterials(materials, existingDocuments = []) {
  const existingByFileName = new Map(
    existingDocuments.map((doc) => [doc.fileName, doc])
  );

  return materials.map((material, index) => {
    const existing = existingByFileName.get(material.fileName);
    return {
      documentId: existing?.documentId || material.id || `repair-doc-${index + 1}`,
      fileName: material.fileName,
      fileType: material.fileType,
      mimeType: material.fileType,
      ossKey: material.ossKey || existing?.ossKey || null,
      classification: {
        materialId: material.materialId || existing?.classification?.materialId || "unknown",
        materialName: material.materialName || existing?.classification?.materialName || material.category || "未识别",
        confidence: material.confidence || existing?.classification?.confidence || 0,
      },
      status: material.status === "failed" ? "failed" : "completed",
      extractedText: material.ocrText || existing?.extractedText || "",
      structuredData: material.structuredData || existing?.structuredData || {},
      errorMessage: material.classificationError || existing?.errorMessage || null,
    };
  });
}

async function main() {
  const claimCaseId = process.argv[2];
  if (!claimCaseId) {
    throw new Error("Usage: node server/scripts/rebuildClaimAnalysis.js <claimCaseId>");
  }

  const allMaterials = readData("claim-materials") || [];
  const allClaimDocs = readData("claim-documents") || [];
  const allClaimCases = readData("claim-cases") || [];
  const allReports = readData("damage-reports") || [];

  const materials = allMaterials.filter((item) => item.claimCaseId === claimCaseId);
  if (materials.length === 0) {
    throw new Error(`No claim-materials found for ${claimCaseId}`);
  }

  const importRecordIndex = allClaimDocs
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.claimCaseId === claimCaseId)
    .sort((a, b) => new Date(b.record.importedAt || 0) - new Date(a.record.importedAt || 0))[0];
  if (!importRecordIndex) {
    throw new Error(`No claim-documents import record found for ${claimCaseId}`);
  }

  const latestRecord = importRecordIndex.record;
  const previousAggregation = latestRecord.aggregation || {};
  const claimCase = allClaimCases.find((item) => item.id === claimCaseId) || {};
  const productCode = latestRecord.productCode || claimCase.productCode || null;
  const documents = buildDocumentsFromMaterials(materials, latestRecord.documents || []);

  const summaries = [];
  const summaryByDocId = new Map();
  const liabilityEvidence = [];
  const paymentEvidence = [];
  for (const doc of documents) {
    if (doc.status !== "completed") continue;
    const summary = extractLocalSummary(doc);
    if (!summary) continue;
    summaries.push(summary);
    summaryByDocId.set(doc.documentId, summary);
    doc.documentSummary = summary;
  }
  for (const doc of documents) {
    if (doc.status !== "completed") continue;
    const evidence = extractLiabilityEvidence(doc);
    if (evidence) liabilityEvidence.push(evidence);
    const payment = extractPaymentEvidence(doc);
    if (payment) paymentEvidence.push(payment);
  }

  const analysisResult = await analyzeMultiFiles(documents, {
    claimCaseId,
    productCode,
  });
  const aggregation = aggregateCase({
    summaries,
    claimCaseId,
    validationFacts: analysisResult?.validationFacts || {},
    validationResults: analysisResult?.materialValidationResults || [],
    documents,
  });
  aggregation.regionalStandards = deriveRegionalStandards(summaries) || {
    region: "安徽省",
    year: 2024,
    urbanPerCapitaIncome: 47446,
    funeralMonthlySalary: 8499.92,
  };
  aggregation.liabilityApportionment = mergeLiabilityApportionment(
    previousAggregation.liabilityApportionment,
    deriveLiabilityApportionment(aggregation, summaries)
  );
  aggregation.liabilityEvidence = liabilityEvidence;
  aggregation.paymentEvidence = paymentEvidence;
  const normalizedPayments = summarizePaymentEvidence(paymentEvidence);
  aggregation.paymentEvidenceNormalized = normalizedPayments.uniqueTransfers;
  aggregation.paymentSummary = normalizedPayments.summary;
  aggregation.deductionSummary = previousAggregation.deductionSummary
    ? {
        ...aggregation.paymentSummary,
        ...previousAggregation.deductionSummary,
      }
    : aggregation.paymentSummary;
  aggregation.compulsoryInsuranceOffset = {
    applicable: false,
    deductionTotal: 0,
    reason: "当前案件按工程机械设备保险附加第三者责任险处理，不适用交强险扣减",
  };
  aggregation.liabilitySuggestion = buildLiabilitySuggestionFromEvidence(aggregation, liabilityEvidence);
  aggregation.identityChainEvidence = summaries.filter(
    (item) => item?.summaryType === "identity_chain_evidence" || item?.summaryType === "employment_chat"
  );
  delete aggregation.employmentEvidence;
  aggregation.incidentStatements = summaries.filter((item) => item?.summaryType === "incident_statement");
  aggregation.interviewRecords = summaries.filter((item) => item?.summaryType === "incident_interview");
  aggregation.policeCallRecords = summaries.filter((item) => item?.summaryType === "police_call_record");
  aggregation.manualReviewItems = [
    !(aggregation.liabilityResult || aggregation.liabilityApportionment)
      ? "缺少公安/安监正式责任划分文书，责任比例仍需人工确认"
      : null,
    aggregation.liabilityApportionment
      ? "责任比例当前采用公估报告“同等责任”口径 50%，如后续取得正式责任文书需及时覆盖"
      : null,
    paymentEvidence.length > 0
      ? "已有赔偿协商和垫付款记录，正式定损前需核对已支付金额、赔付路径与抵扣口径"
      : null,
    "死亡赔偿金已按统一城镇标准试算，如法院地或统计年度不同需调整地区标准参数",
  ].filter(Boolean);
  aggregation.factConfirmations = previousAggregation.factConfirmations || {};
  aggregation.handlingProfile = summarizeHandlingProfile({
    claimCase,
    aggregation,
    materials,
  });
  const currentFactModel = aggregation.factModel || {};
  const {
    employmentRelationConfirmed: _currentLegacyEmploymentRelationConfirmed,
    employmentRelationConfirmedAt: _currentLegacyEmploymentRelationConfirmedAt,
    employmentEvidence: _currentLegacyEmploymentEvidence,
    ...restCurrentFactModel
  } = currentFactModel;
  const previousFactModel = previousAggregation.factModel || {};
  const {
    employmentRelationConfirmed: _legacyEmploymentRelationConfirmed,
    employmentRelationConfirmedAt: _legacyEmploymentRelationConfirmedAt,
    employmentEvidence: _legacyEmploymentEvidence,
    ...restPreviousFactModel
  } = previousFactModel;
  aggregation.factModel = {
    ...restCurrentFactModel,
    ...restPreviousFactModel,
    handlingProfile: aggregation.handlingProfile,
    regionalStandards: aggregation.regionalStandards,
    liabilityApportionment: aggregation.liabilityApportionment,
    liabilityEvidence,
    identityChainEvidence: aggregation.identityChainEvidence,
    incidentStatements: aggregation.incidentStatements,
    interviewRecords: aggregation.interviewRecords,
    policeCallRecords: aggregation.policeCallRecords,
    paymentEvidence,
    paymentEvidenceNormalized: aggregation.paymentEvidenceNormalized,
    paymentSummary: aggregation.paymentSummary,
    compulsoryInsuranceOffset: aggregation.compulsoryInsuranceOffset,
    manualReviewItems: aggregation.manualReviewItems,
    legacyAliases: {
      ...((aggregation.factModel || {}).legacyAliases || {}),
      ...((previousAggregation.factModel || {}).legacyAliases || {}),
    },
  };
  if (previousAggregation?.factModel?.employmentRelationConfirmedAt) {
    aggregation.factModel.legacyAliases.employmentRelationConfirmedAt =
      previousAggregation.factModel.employmentRelationConfirmedAt;
  }
  if (previousAggregation?.factModel?.employmentRelationConfirmed !== undefined) {
    aggregation.factModel.legacyAliases.employmentRelationConfirmed =
      previousAggregation.factModel.employmentRelationConfirmed;
  }
  if (previousAggregation?.factModel?.thirdPartyIdentityChainConfirmedAt) {
    aggregation.factModel.thirdPartyIdentityChainConfirmedAt =
      previousAggregation.factModel.thirdPartyIdentityChainConfirmedAt;
  }
  if (previousAggregation?.factModel?.thirdPartyIdentityChainConfirmed !== undefined) {
    aggregation.factModel.thirdPartyIdentityChainConfirmed =
      previousAggregation.factModel.thirdPartyIdentityChainConfirmed;
  }
  const operationLogs = (readData("user-operation-logs") || []).filter(
    (item) => item.claimId === claimCaseId
  );
  aggregation.decisionTrace = buildDecisionTrace({
    claimCaseId,
    materials,
    summaries,
    aggregation,
    operationLogs,
  });

  const nextMaterials = allMaterials.map((material) => {
    if (material.claimCaseId !== claimCaseId) return material;
    const doc = documents.find((item) => item.fileName === material.fileName);
    const summary = doc ? summaryByDocId.get(doc.documentId) : null;
    return {
      ...material,
      status: material.status === "failed" ? "failed" : "completed",
      documentSummary: summary || material.documentSummary || null,
      processedAt: new Date().toISOString(),
    };
  });

  const nextDocuments = documents.map((doc) => ({
    ...doc,
    extractedText: undefined,
  }));
  allClaimDocs[importRecordIndex.index] = {
    ...latestRecord,
    documents: nextDocuments,
    aggregation,
    validationFacts: analysisResult?.validationFacts || {},
    materialValidationResults: analysisResult?.materialValidationResults || [],
    completeness: {
      ...(analysisResult?.completeness || latestRecord.completeness || {}),
      warnings: (analysisResult?.completeness?.warnings || []).filter(
        (item) => item !== "材料已上传至 OSS，后台识别处理中"
      ),
    },
    repairedAt: new Date().toISOString(),
  };

  const report = generateDamageReport({
    claimCaseId,
    aggregationResult: aggregation,
    claimCase,
  });
  const nextReports = allReports.filter((item) => item.claimCaseId !== claimCaseId);
  nextReports.push({ ...report, reportHtml: undefined });

  writeData("claim-materials", nextMaterials);
  writeData("claim-documents", allClaimDocs);
  writeData("damage-reports", nextReports);

  console.log(
    JSON.stringify(
      {
        claimCaseId,
        materials: materials.length,
        summaries: summaries.length,
        aggregationSummary: aggregation.aggregationSummary,
        liabilitySuggestion: aggregation.liabilitySuggestion,
        manualReviewItems: aggregation.manualReviewItems,
        damageReport: {
          reportId: report.reportId,
          itemCount: report.items.length,
          finalAmount: report.finalAmount,
          categories: report.items.map((item) => item.category),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
