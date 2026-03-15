/**
 * 定损报告生成服务
 *
 * 根据案件聚合数据（InjuryProfile、LiabilityResult、ExpenseAggregation）
 * 结合各地赔偿标准，计算各项赔偿，生成 HTML 格式的定损报告。
 */

import crypto from "crypto";
import { buildDecisionTraceForReport } from "./decisionTraceService.js";
import { resolveClaimDomainModel } from "./claimDomainService.js";
import { getLossLedgerAmountBeforeDeductible } from "../claims/medical/review.js";

// 默认赔偿参数（当无法获取当地标准时使用，需管理员配置实际值）
const DEFAULT_STANDARDS = {
  region: "上海市",
  year: 2024,
  // 上一年度城镇居民人均可支配收入（元/年）
  urbanPerCapitaIncome: 79610,
  ruralPerCapitaIncome: 40000,
  funeralMonthlySalary: 9000,
  urbanPerCapitaConsumptionExpenditure: 52000,
  // 护理费日标准（元/天）
  nursingDailyRate: 200,
  // 住院伙食补助（元/天）
  hospitalMealSubsidy: 20,
  // 交通费（若无票据，按天估算）
  transportationDailyRate: 30,
};

// 伤残赔偿系数（按等级，1-10 级）
const DISABILITY_COMPENSATION_RATES = {
  "一级伤残": 1.0,
  "二级伤残": 0.9,
  "三级伤残": 0.8,
  "四级伤残": 0.7,
  "五级伤残": 0.6,
  "六级伤残": 0.5,
  "七级伤残": 0.4,
  "八级伤残": 0.3,
  "九级伤残": 0.2,
  "十级伤残": 0.1,
};

// 伤残赔偿年限（20 年，超过 60 岁每增一岁减 1 年，75 岁以上计 5 年）
function getCompensationYears(age = 35) {
  if (age <= 60) return 20;
  if (age > 75) return 5;
  return 20 - (age - 60);
}

function getDependentCompensationYears(age = 10) {
  if (age < 18) return 18 - age;
  if (age < 60) return 20;
  if (age > 75) return 5;
  return 20 - (age - 60);
}

function resolveLiabilityContext(aggregationResult = {}) {
  if (aggregationResult?.liabilityResult && Number.isFinite(aggregationResult.liabilityResult.thirdPartyLiabilityPct)) {
    return {
      thirdPartyLiabilityPct: aggregationResult.liabilityResult.thirdPartyLiabilityPct,
      claimantLiabilityPct: aggregationResult.liabilityResult.claimantLiabilityPct,
      basis: aggregationResult.liabilityResult.basis || "",
      source: "liability_result",
    };
  }

  const applied = aggregationResult?.liabilityApportionment;
  if (applied && Number.isFinite(applied.thirdPartyLiabilityPct)) {
    return {
      thirdPartyLiabilityPct: applied.thirdPartyLiabilityPct,
      claimantLiabilityPct: applied.claimantLiabilityPct,
      basis: applied.basis || "",
      source: applied.source || "manual",
    };
  }

  return null;
}

function resolveReportDomainModel({ claimCaseId, claimCase = {}, aggregationResult = {} }) {
  return (
    aggregationResult?.domainModel ||
    aggregationResult?.handlingProfile?.domainModel ||
    resolveClaimDomainModel({
      claimCase: { ...claimCase, id: claimCase?.id || claimCaseId },
      aggregation: aggregationResult,
      materials: [],
      handlingProfile: aggregationResult?.handlingProfile || null,
    })
  );
}

function buildDecisionSummary({ report, aggregationResult = {}, claimCase = {} }) {
  const traceStages = Array.isArray(report.decisionTrace?.stages)
    ? report.decisionTrace.stages
    : [];
  const manualStage = traceStages.find((stage) => stage.stage === "manual_review") || null;
  const manualActions = Array.isArray(manualStage?.manualActions)
    ? manualStage.manualActions
    : [];
  const liabilityContext = report.liabilityResult || {};
  const deductionSummary = aggregationResult?.deductionSummary || {};
  const standards = aggregationResult?.regionalStandards || {};
  const pendingItems = Array.isArray(aggregationResult?.manualReviewItems)
    ? aggregationResult.manualReviewItems
    : [];

  return {
    claimNumber: claimCase?.reportNumber || report.claimCaseId,
    liabilityRatioText: Number.isFinite(liabilityContext.thirdPartyLiabilityPct)
      ? `第三方责任 ${liabilityContext.thirdPartyLiabilityPct}% / 自身责任 ${liabilityContext.claimantLiabilityPct}%`
      : "责任比例待人工确认",
    liabilitySourceText: liabilityContext.basis || liabilityContext.source || "未形成明确责任依据",
    deductionText: `已识别付款 ¥${Number(deductionSummary.confirmedPaidAmount || 0).toFixed(2)}；当前抵扣 ¥${Number(deductionSummary.deductionTotal || 0).toFixed(2)}`,
    standardsText: standards?.region
      ? `${standards.region}${standards.year || ""}年标准，城镇居民人均可支配收入 ¥${Number(standards.urbanPerCapitaIncome || 0).toLocaleString("zh-CN")} / 年`
      : report.regionalStandards,
    manualActions,
    pendingItems,
  };
}

function buildMedicalDecisionSummary({ report, aggregationResult = {}, claimCase = {} }) {
  const deductionSummary = aggregationResult?.deductionSummary || {};
  const standards = aggregationResult?.regionalStandards || {};
  const settlementSnapshot = report.settlementSnapshot || {};
  const policyBinding = settlementSnapshot.policyBinding || {};
  const coverageBreakdown = Array.isArray(settlementSnapshot.coverageBreakdown)
    ? settlementSnapshot.coverageBreakdown
    : [];
  return {
    claimNumber: claimCase?.reportNumber || report.claimCaseId,
    medicalExpenseText: `医疗费用合计 ¥${Number(report.subTotal || 0).toFixed(2)}`,
    deductionText: `已识别付款 ¥${Number(deductionSummary.confirmedPaidAmount || 0).toFixed(2)}；当前抵扣 ¥${Number(deductionSummary.deductionTotal || 0).toFixed(2)}`,
    deductibleText: `规则免赔额 ¥${Number(settlementSnapshot.deductible || 0).toFixed(2)}；赔付比例 ${Number((settlementSnapshot.reimbursementRatio ?? 1) * 100).toFixed(0)}%`,
    policyText: policyBinding.policyNumber
      ? `保单 ${policyBinding.policyNumber} / 产品 ${policyBinding.productCode || "-"} / 规则集 ${policyBinding.rulesetId || "-"}`
      : "未绑定有效保单快照",
    insuredMatchText:
      policyBinding.insuredMatched === false
        ? `承保名单不匹配：${policyBinding.insuredName || "当前被保险人"} 不在保单承保名单内`
        : policyBinding.insuredMatched === true
          ? `承保名单匹配：${policyBinding.insuredName || "当前被保险人"}`
          : "承保名单匹配状态待确认",
    hospitalText: settlementSnapshot?.medicalReview?.hospitalReview?.requirement?.rawText
      ? `医院要求：${settlementSnapshot.medicalReview.hospitalReview.requirement.rawText}；当前医院：${settlementSnapshot.medicalReview.hospitalReview.hospital?.name || settlementSnapshot.medicalReview.hospitalReview.hospitalName || "未识别"}`
      : "医院要求：未配置或未识别",
    catalogText: settlementSnapshot?.medicalReview?.catalogSummary
      ? `目录内金额 ¥${Number(settlementSnapshot.medicalReview.catalogSummary.catalogCoveredAmount || 0).toFixed(2)}；目录外/自费 ¥${Number(settlementSnapshot.medicalReview.catalogSummary.selfPayAmount || 0).toFixed(2)}；待确认 ¥${Number(settlementSnapshot.medicalReview.catalogSummary.uncertainAmount || 0).toFixed(2)}`
      : "目录匹配：未形成结构化结果",
    coverageText:
      coverageBreakdown.length > 0
        ? coverageBreakdown
            .map(
              (item) =>
                `${item.coverageCode}：申报 ¥${Number(item.claimedAmount || 0).toFixed(2)} / 核定 ¥${Number(item.approvedAmount || 0).toFixed(2)}`,
            )
            .join('；')
        : "责任拆分：未形成结构化结果",
    standardsText: standards?.region
      ? `${standards.region}${standards.year || ""}年标准`
      : report.regionalStandards,
  };
}

function buildMedicalReportItemsFromLedger(reviewResult) {
  const lossLedger = Array.isArray(reviewResult?.amount?.lossLedger)
    ? reviewResult.amount.lossLedger
    : [];

  if (lossLedger.length === 0) {
    return null;
  }

  const items = lossLedger.map((item) => {
    const beforeDeductibleAmount = getLossLedgerAmountBeforeDeductible(item);
    const medicalReview = item?.medicalReview || {};
    const latestMessage = Array.isArray(item?.entries) && item.entries.length > 0
      ? item.entries[item.entries.length - 1]?.message
      : "";
    return {
      id: item.itemKey,
      category: item.category || "医疗费",
      itemName: item.itemName,
      originalAmount: Number(item.claimedAmount || 0),
      approvedAmount: beforeDeductibleAmount,
      formula:
        item.status === "ZERO_PAY" && beforeDeductibleAmount <= 0
          ? "目录外/不赔项目，核定为 0"
          : `核定金额 ¥${beforeDeductibleAmount.toFixed(2)}`,
      basis: [medicalReview?.basis, latestMessage].filter(Boolean).join("；") || "按医疗费用审核主链核定",
    };
  });

  const subTotal = items.reduce((sum, item) => sum + Number(item.approvedAmount || 0), 0);
  return {
    items,
    subTotal: parseFloat(subTotal.toFixed(2)),
  };
}

function renderDecisionTraceHtml(stages = []) {
  if (!Array.isArray(stages) || stages.length === 0) {
    return "";
  }

  return stages
    .map(
      (stage) => `
      <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e8ecf0; border-radius: 4px;">
        <div style="font-weight: bold; margin-bottom: 6px;">${stage.title}</div>
        <div style="font-size: 13px; color: #555; margin-bottom: 6px;">${stage.summary || ""}</div>
        ${(stage.facts || [])
          .map((fact) => `<div style="font-size:12px; color:#666;">${fact.label}：${fact.value}</div>`)
          .join("")}
        ${Array.isArray(stage.manualActions) && stage.manualActions.length > 0
          ? `<div style="margin-top:6px; font-size:12px; color:#666;">${stage.manualActions
              .map(
                (action) =>
                  `<div>• ${action.label}${action.detail ? `：${action.detail}` : ""}${action.timestamp ? `（${new Date(action.timestamp).toLocaleString("zh-CN")}）` : ""}</div>`
              )
              .join("")}</div>`
          : ""}
        ${Array.isArray(stage.sourceDocIds) && stage.sourceDocIds.length > 0
          ? `<div style="margin-top:6px; font-size:12px; color:#8c8c8c;">来源材料 ${stage.sourceDocIds.length} 份</div>`
          : ""}
      </div>
    `,
    )
    .join("");
}

function getReportPresentationConfig(domainModel = {}) {
  const scenario = domainModel?.claimScenario || "unknown";

  switch (scenario) {
    case "medical_expense":
      return {
        reportKind: "medical_expense_report",
        reportTitle: "医疗费用审核报告",
        amountLabels: ["核定费用", "抵扣金额", "报告结论金额"],
        detailSectionTitle: "费用明细",
      };
    case "accident_benefit":
      return {
        reportKind: "benefit_assessment_report",
        reportTitle: "给付审核报告",
        amountLabels: ["核定金额", "扣减金额", "给付结论金额"],
        detailSectionTitle: "给付项目",
      };
    case "auto_property_damage":
    case "auto_injury":
      return {
        reportKind: "auto_loss_report",
        reportTitle: "车险损失审核报告",
        amountLabels: ["损失总额", "责任系数", "报告结论金额"],
        detailSectionTitle: "损失项目",
      };
    default:
      return {
        reportKind: "liability_damage_report",
        reportTitle: "定损报告",
        amountLabels: ["损失总额", "责任调整系数", "应赔金额"],
        detailSectionTitle: "损失明细",
      };
  }
}

/**
 * 计算各项赔偿条目
 */
function calculateDamageItems({ injuryProfile, liabilityResult, expenseAggregation, deathProfile, standards, claimantAge = 35, summaries = [] }) {
  const std = { ...DEFAULT_STANDARDS, ...standards };
  const items = [];
  let itemIndex = 0;

  const makeId = () => `di-${++itemIndex}`;

  // 1. 医疗费
  if (expenseAggregation?.medicalTotal > 0) {
    items.push({
      id: makeId(),
      category: "医疗费",
      itemName: "住院及门诊医疗费用",
      originalAmount: expenseAggregation.medicalTotal,
      approvedAmount: expenseAggregation.medicalTotal,
      formula: "实际发票金额",
      basis: "依据医疗发票据实核定",
      sourceDocIds: expenseAggregation.sourceDocIds || [],
    });
  }

  // 2. 误工费
  const lostWorkDays = expenseAggregation?.lostWorkDays || injuryProfile?.hospitalizationDays || 0;
  if (lostWorkDays > 0) {
    const dailyIncome =
      expenseAggregation?.monthlyIncome > 0
        ? expenseAggregation.monthlyIncome / 30
        : std.urbanPerCapitaIncome / 365;
    const lostWorkAmount = lostWorkDays * dailyIncome;
    items.push({
      id: makeId(),
      category: "误工费",
      itemName: "误工损失",
      originalAmount: parseFloat(lostWorkAmount.toFixed(2)),
      approvedAmount: parseFloat(lostWorkAmount.toFixed(2)),
      formula: `${lostWorkDays}天 × ¥${dailyIncome.toFixed(2)}/天`,
      basis: expenseAggregation?.monthlyIncome > 0 ? "依据收入证明计算" : `参照${std.region}当年平均工资计算`,
      sourceDocIds: expenseAggregation?.sourceDocIds || [],
    });
  }

  // 3. 护理费
  const nursingDays = expenseAggregation?.nursingDays || injuryProfile?.hospitalizationDays || 0;
  if (nursingDays > 0) {
    const nursingAmount = nursingDays * std.nursingDailyRate;
    items.push({
      id: makeId(),
      category: "护理费",
      itemName: "住院期间护理费",
      originalAmount: nursingAmount,
      approvedAmount: nursingAmount,
      formula: `${nursingDays}天 × ¥${std.nursingDailyRate}/天`,
      basis: `参照${std.region}护理费标准`,
      sourceDocIds: [],
    });
  }

  // 4. 住院伙食补助
  const hospitalDays = injuryProfile?.hospitalizationDays || 0;
  if (hospitalDays > 0) {
    const mealAmount = hospitalDays * std.hospitalMealSubsidy;
    items.push({
      id: makeId(),
      category: "住院伙食补助费",
      itemName: "住院伙食补助",
      originalAmount: mealAmount,
      approvedAmount: mealAmount,
      formula: `${hospitalDays}天 × ¥${std.hospitalMealSubsidy}/天`,
      basis: "依据住院天数按标准计算",
      sourceDocIds: [],
    });
  }

  // 5. 交通费
  if (expenseAggregation?.transportationTotal > 0) {
    items.push({
      id: makeId(),
      category: "交通费",
      itemName: "就医交通费",
      originalAmount: expenseAggregation.transportationTotal,
      approvedAmount: expenseAggregation.transportationTotal,
      formula: "票据合计",
      basis: "依据交通费票据据实核定",
      sourceDocIds: expenseAggregation.sourceDocIds || [],
    });
  }

  // 6. 伤残赔偿金
  const disabilityLevel = injuryProfile?.disabilityLevel;
  if (disabilityLevel) {
    const rate = DISABILITY_COMPENSATION_RATES[disabilityLevel];
    if (rate !== undefined) {
      const years = getCompensationYears(claimantAge);
      const disabilityAmount = rate * years * std.urbanPerCapitaIncome;
      items.push({
        id: makeId(),
        category: "伤残赔偿金",
        itemName: disabilityLevel,
        originalAmount: parseFloat(disabilityAmount.toFixed(2)),
        approvedAmount: parseFloat(disabilityAmount.toFixed(2)),
        formula: `${rate * 100}% × ${years}年 × ¥${std.urbanPerCapitaIncome}/年`,
        basis: `依据《最高人民法院关于审理人身损害赔偿案件适用法律若干问题的解释》及${std.region}${std.year}年人均可支配收入`,
        sourceDocIds: [],
      });
    }
  }

  // 7. 鉴定费
  if (expenseAggregation?.assessmentFees > 0) {
    items.push({
      id: makeId(),
      category: "鉴定费",
      itemName: "司法/劳动鉴定费",
      originalAmount: expenseAggregation.assessmentFees,
      approvedAmount: expenseAggregation.assessmentFees,
      formula: "票据金额",
      basis: "依据鉴定费票据据实核定",
      sourceDocIds: expenseAggregation.sourceDocIds || [],
    });
  }

  // 8. 死亡赔偿相关
  if (deathProfile?.deathConfirmed) {
    const incomeBase = std.urbanPerCapitaIncome;
    const deathCompensation = getCompensationYears(claimantAge) * incomeBase;
    items.push({
      id: makeId(),
      category: "死亡赔偿金",
      itemName: "死亡赔偿金",
      originalAmount: parseFloat(deathCompensation.toFixed(2)),
      approvedAmount: parseFloat(deathCompensation.toFixed(2)),
      formula: `${getCompensationYears(claimantAge)}年 × ¥${incomeBase.toFixed(2)}/年`,
      basis: `参照${std.region}${std.year}年城镇居民人均可支配收入标准`,
      sourceDocIds: deathProfile.sourceDocIds || [],
    });

    const funeralStandard = std.funeralMonthlySalary * 6;
    const funeralAmount = deathProfile.funeralExpenseTotal > 0
      ? Math.min(deathProfile.funeralExpenseTotal, funeralStandard)
      : funeralStandard;
    items.push({
      id: makeId(),
      category: "丧葬费",
      itemName: "丧葬费",
      originalAmount: parseFloat(funeralAmount.toFixed(2)),
      approvedAmount: parseFloat(funeralAmount.toFixed(2)),
      formula: deathProfile.funeralExpenseTotal > 0
        ? `票据金额与法定上限孰低（上限 ¥${funeralStandard.toFixed(2)}）`
        : `¥${std.funeralMonthlySalary.toFixed(2)}/月 × 6个月`,
      basis: "依据丧葬费法定标准并结合实际票据核定",
      sourceDocIds: deathProfile.sourceDocIds || [],
    });

    const dependents = deathProfile.dependents || [];
    for (const dependent of dependents) {
      const dependentYears = Number(dependent.compensationYears);
      if (!Number.isFinite(dependentYears) || dependentYears <= 0) {
        continue;
      }

      const divisor = Math.max(1, (dependent.otherSupportersCount || 0) + 1);
      const dependentAmount =
        (std.urbanPerCapitaConsumptionExpenditure * dependentYears) / divisor;
      items.push({
        id: makeId(),
        category: "被扶养人生活费",
        itemName: dependent.dependentName || dependent.relationship || "被扶养人",
        originalAmount: parseFloat(dependentAmount.toFixed(2)),
        approvedAmount: parseFloat(dependentAmount.toFixed(2)),
        formula: `${dependentYears}年 × ¥${std.urbanPerCapitaConsumptionExpenditure.toFixed(2)}/年 ÷ ${divisor}`,
        basis: "依据扶养关系证明和已确认扶养年限试算",
        sourceDocIds: [dependent.sourceDocId].filter(Boolean),
      });
    }
  }

  return items;
}

/**
 * 生成 HTML 定损报告
 */
function generateReportHtml({ report, claimCase, summaries }) {
  const {
    items,
    subTotal,
    liabilityAdjustment,
    finalAmount,
    generatedAt,
    regionalStandards,
  } = report;

  const liabilityResult = report.liabilityResult;
  const injuryProfile = report.injuryProfile;
  const decisionSummary = buildDecisionSummary({
    report,
    aggregationResult: {
      deductionSummary: report.deductionSummary,
      regionalStandards: report.standardsSnapshot,
      manualReviewItems: report.manualReviewItems,
    },
    claimCase,
  });

  const rows = items.map((item) => `
    <tr>
      <td>${item.category}</td>
      <td>${item.itemName}</td>
      <td style="text-align:right">¥${item.originalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
      <td>${item.formula}</td>
      <td>${item.basis}</td>
    </tr>
  `).join("");
  const decisionTraceHtml = renderDecisionTraceHtml(report.decisionTrace?.stages);
  const manualActionHtml = Array.isArray(decisionSummary.manualActions) && decisionSummary.manualActions.length > 0
    ? decisionSummary.manualActions
        .map(
          (action) =>
            `<div class="summary-item"><label>${action.label}</label><span>${action.detail || "已处理"}${action.timestamp ? `（${new Date(action.timestamp).toLocaleString("zh-CN")}）` : ""}</span></div>`
        )
        .join("")
    : `<div class="summary-item"><label>人工动作</label><span>暂无人工确认或调整记录</span></div>`;
  const pendingItemsHtml = Array.isArray(decisionSummary.pendingItems) && decisionSummary.pendingItems.length > 0
    ? decisionSummary.pendingItems
        .map((item) => `<div class="conflict-item">⚠ ${item}</div>`)
        .join("")
    : `<div class="conflict-item">当前未识别到额外待核实事项</div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>定损报告 - ${claimCase?.reportNumber || report.claimCaseId}</title>
  <style>
    body { font-family: "SimSun", "宋体", serif; font-size: 14px; margin: 40px; color: #1a1a1a; }
    h1 { text-align: center; font-size: 20px; margin-bottom: 8px; }
    .subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 15px; font-weight: bold; border-left: 4px solid #1890ff; padding-left: 8px; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item label { color: #666; font-size: 12px; }
    .info-item span { font-size: 14px; }
    .summary-box { background: #f8fafc; border: 1px solid #dbe7f3; border-radius: 6px; padding: 14px 16px; }
    .summary-item { display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin-bottom: 8px; }
    .summary-item label { color: #667085; font-size: 12px; }
    .summary-item span { font-size: 13px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f0f5ff; padding: 8px 12px; text-align: left; font-size: 13px; border: 1px solid #d6e4ff; }
    td { padding: 8px 12px; border: 1px solid #e8ecf0; font-size: 13px; }
    tr:nth-child(even) td { background: #fafbfc; }
    .total-row td { font-weight: bold; background: #f0f5ff; }
    .final-row td { font-weight: bold; font-size: 15px; background: #e6f7ff; color: #0050b3; }
    .conflict-box { background: #fff7e6; border: 1px solid #ffd591; padding: 12px 16px; border-radius: 4px; }
    .conflict-item { color: #d46b08; margin: 4px 0; font-size: 13px; }
    .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #e8e8e8; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>人身伤害理赔定损报告</h1>
  <div class="subtitle">报告编号：${report.reportId} &nbsp;|&nbsp; 生成时间：${new Date(generatedAt).toLocaleString("zh-CN")}</div>

  <div class="section">
    <div class="section-title">一、基本信息</div>
    <div class="info-grid">
      <div class="info-item"><label>报案号：</label><span>${claimCase?.reportNumber || "-"}</span></div>
      <div class="info-item"><label>被保险人：</label><span>${claimCase?.insured || claimCase?.reporter || "-"}</span></div>
      <div class="info-item"><label>事故时间：</label><span>${claimCase?.accidentTime || "-"}</span></div>
      <div class="info-item"><label>事故原因：</label><span>${claimCase?.accidentReason || "-"}</span></div>
      <div class="info-item"><label>伤情描述：</label><span>${injuryProfile?.injuryDescription || "-"}</span></div>
      <div class="info-item"><label>伤残等级：</label><span>${injuryProfile?.disabilityLevel || "未评定"}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">二、责任认定</div>
    ${liabilityResult ? `
    <p>
      伤者责任比例：<strong>${liabilityResult.claimantLiabilityPct}%</strong>，
      第三方责任比例：<strong>${liabilityResult.thirdPartyLiabilityPct}%</strong><br>
      认定依据：${liabilityResult.basis || "-"}
    </p>
    ` : "<p>责任认定材料未提供，请补充交通事故责任认定书。</p>"}
  </div>

  <div class="section">
    <div class="section-title">三、决策摘要</div>
    <div class="summary-box">
      <div class="summary-item"><label>案件编号</label><span>${decisionSummary.claimNumber}</span></div>
      <div class="summary-item"><label>责任折算口径</label><span>${decisionSummary.liabilityRatioText}</span></div>
      <div class="summary-item"><label>责任依据</label><span>${decisionSummary.liabilitySourceText}</span></div>
      <div class="summary-item"><label>抵扣口径</label><span>${decisionSummary.deductionText}</span></div>
      <div class="summary-item"><label>地区标准</label><span>${decisionSummary.standardsText}</span></div>
      ${manualActionHtml}
    </div>
  </div>

  <div class="section">
    <div class="section-title">四、损失明细</div>
    <table>
      <thead>
        <tr>
          <th style="width:12%">类别</th>
          <th style="width:20%">项目</th>
          <th style="width:12%">金额</th>
          <th style="width:28%">计算方式</th>
          <th style="width:28%">核定依据</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="2">损失合计</td>
          <td style="text-align:right">¥${subTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">五、赔偿计算</div>
    <table>
      <tbody>
        <tr><td>损失总额</td><td style="text-align:right">¥${subTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>责任调整系数（第三方责任 ${liabilityResult ? liabilityResult.thirdPartyLiabilityPct : 100}%）</td>
            <td style="text-align:right">× ${((liabilityAdjustment) * 100).toFixed(0)}%</td></tr>
        <tr class="final-row"><td>应赔金额</td><td style="text-align:right">¥${finalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td></tr>
      </tbody>
    </table>
    <p style="font-size:12px; color:#666; margin-top:8px">
      赔偿标准参照：${regionalStandards}
    </p>
  </div>

  ${decisionTraceHtml ? `
  <div class="section">
    <div class="section-title">六、决策轨迹</div>
    ${decisionTraceHtml}
  </div>
  ` : ""}

  <div class="section">
    <div class="section-title">七、待核实事项</div>
    <div class="conflict-box">
      ${pendingItemsHtml}
      ${report.conflicts && report.conflicts.length > 0
        ? report.conflicts.map((c) => `<div class="conflict-item">⚠ ${c.description}</div>`).join("")
        : ""}
    </div>
  </div>

  <div class="footer">
    本报告由 AI 自动生成，仅供参考，最终赔偿金额以人工审核确认为准。<br>
    生成模型：Gemini 2.5 Flash &nbsp;|&nbsp; 报告状态：${report.status === "confirmed" ? "已确认" : "草稿"}
  </div>
</body>
</html>`;
}

function generateMedicalExpenseReportHtml({ report, claimCase }) {
  const decisionSummary = buildMedicalDecisionSummary({
    report,
    aggregationResult: {
      deductionSummary: report.deductionSummary,
      regionalStandards: report.standardsSnapshot,
    },
    claimCase,
  });
  const rows = report.items
    .map((item) => `
      <tr>
        <td>${item.category}</td>
        <td>${item.itemName}</td>
        <td style="text-align:right">¥${item.originalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
        <td>${item.formula}</td>
        <td>${item.basis}</td>
      </tr>
    `)
    .join("");
  const decisionTraceHtml = renderDecisionTraceHtml(report.decisionTrace?.stages);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>医疗费用审核报告 - ${claimCase?.reportNumber || report.claimCaseId}</title>
  <style>
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; margin: 40px; color: #1a1a1a; }
    h1 { text-align: center; font-size: 20px; margin-bottom: 8px; }
    .subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 15px; font-weight: bold; border-left: 4px solid #0f766e; padding-left: 8px; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .summary-box { background: #f8fafc; border: 1px solid #dbe7f3; border-radius: 6px; padding: 14px 16px; }
    .summary-item { display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #ecfeff; padding: 8px 12px; text-align: left; font-size: 13px; border: 1px solid #bae6fd; }
    td { padding: 8px 12px; border: 1px solid #e8ecf0; font-size: 13px; }
    tr:nth-child(even) td { background: #fafbfc; }
    .total-row td { font-weight: bold; background: #ecfeff; }
    .final-row td { font-weight: bold; font-size: 15px; background: #f0fdfa; color: #115e59; }
    .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #e8e8e8; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>医疗费用审核报告</h1>
  <div class="subtitle">报告编号：${report.reportId} &nbsp;|&nbsp; 生成时间：${new Date(report.generatedAt).toLocaleString("zh-CN")}</div>

  <div class="section">
    <div class="section-title">一、基本信息</div>
    <div class="info-grid">
      <div>报案号：${claimCase?.reportNumber || "-"}</div>
      <div>被保险人：${claimCase?.insured || claimCase?.reporter || "-"}</div>
      <div>就诊时间：${claimCase?.accidentTime || "-"}</div>
      <div>报案原因：${claimCase?.accidentReason || "-"}</div>
      <div>诊断摘要：${report.injuryProfile?.injuryDescription || "-"}</div>
      <div>住院天数：${report.injuryProfile?.hospitalizationDays || 0}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">二、审核摘要</div>
    <div class="summary-box">
      <div class="summary-item"><label>案件编号</label><span>${decisionSummary.claimNumber}</span></div>
      <div class="summary-item"><label>保单/规则</label><span>${decisionSummary.policyText}</span></div>
      <div class="summary-item"><label>承保匹配</label><span>${decisionSummary.insuredMatchText}</span></div>
      <div class="summary-item"><label>医疗费用</label><span>${decisionSummary.medicalExpenseText}</span></div>
      <div class="summary-item"><label>规则口径</label><span>${decisionSummary.deductibleText}</span></div>
      <div class="summary-item"><label>抵扣口径</label><span>${decisionSummary.deductionText}</span></div>
      <div class="summary-item"><label>医院核查</label><span>${decisionSummary.hospitalText}</span></div>
      <div class="summary-item"><label>目录核查</label><span>${decisionSummary.catalogText}</span></div>
      <div class="summary-item"><label>责任拆分</label><span>${decisionSummary.coverageText}</span></div>
      <div class="summary-item"><label>地区标准</label><span>${decisionSummary.standardsText}</span></div>
      <div class="summary-item"><label>审核口径</label><span>按医疗费用报销案件生成，不适用责任比例折算。</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">三、费用明细</div>
    <table>
      <thead>
        <tr>
          <th style="width:12%">类别</th>
          <th style="width:20%">项目</th>
          <th style="width:12%">金额</th>
          <th style="width:28%">计算方式</th>
          <th style="width:28%">核定依据</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="2">费用合计</td>
          <td style="text-align:right">¥${report.subTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
          <td colspan="2"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">四、结论</div>
    <table>
      <tbody>
        <tr><td>核定费用</td><td style="text-align:right">¥${report.subTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>规则免赔额</td><td style="text-align:right">¥${Number(report.settlementSnapshot?.deductible || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>已确认抵扣</td><td style="text-align:right">¥${report.deductionTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td></tr>
        <tr class="final-row"><td>报告结论金额</td><td style="text-align:right">¥${report.finalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td></tr>
      </tbody>
    </table>
  </div>

  ${decisionTraceHtml ? `
  <div class="section">
    <div class="section-title">五、决策轨迹</div>
    ${decisionTraceHtml}
  </div>
  ` : ""}

  <div class="footer">
    本报告由系统自动生成，仅供审核参考。医疗费用最终赔付金额以规则审核结果和人工确认结论为准。
  </div>
</body>
</html>`;
}

function generateBenefitAssessmentReportHtml({ report, claimCase }) {
  const deathProfile = report.deathProfile || {};
  const decisionTraceHtml = renderDecisionTraceHtml(report.decisionTrace?.stages);
  const rows = report.items
    .map((item) => `
      <tr>
        <td>${item.category}</td>
        <td>${item.itemName}</td>
        <td style="text-align:right">¥${item.approvedAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
        <td>${item.basis}</td>
      </tr>
    `)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>给付审核报告 - ${claimCase?.reportNumber || report.claimCaseId}</title>
  <style>
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; margin: 40px; color: #1a1a1a; }
    h1 { text-align: center; font-size: 20px; margin-bottom: 8px; }
    .subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 15px; font-weight: bold; border-left: 4px solid #7c3aed; padding-left: 8px; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .summary-box { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 14px 16px; }
    .summary-item { display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f5f3ff; padding: 8px 12px; text-align: left; font-size: 13px; border: 1px solid #ddd6fe; }
    td { padding: 8px 12px; border: 1px solid #e8ecf0; font-size: 13px; }
    .final-row td { font-weight: bold; font-size: 15px; background: #f5f3ff; color: #6d28d9; }
    .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #e8e8e8; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>给付审核报告</h1>
  <div class="subtitle">报告编号：${report.reportId} &nbsp;|&nbsp; 生成时间：${new Date(report.generatedAt).toLocaleString("zh-CN")}</div>

  <div class="section">
    <div class="section-title">一、基本信息</div>
    <div class="info-grid">
      <div>报案号：${claimCase?.reportNumber || "-"}</div>
      <div>被保险人：${claimCase?.insured || claimCase?.reporter || "-"}</div>
      <div>事故原因：${claimCase?.accidentReason || "-"}</div>
      <div>死亡日期：${deathProfile?.deathDate || "-"}</div>
      <div>死者姓名：${deathProfile?.deceasedName || "-"}</div>
      <div>受益人：${Array.isArray(deathProfile?.claimants) ? deathProfile.claimants.map((item) => item.name || item.relationship || "待确认").join("、") : "-"}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">二、审核摘要</div>
    <div class="summary-box">
      <div class="summary-item"><label>案件编号</label><span>${claimCase?.reportNumber || report.claimCaseId}</span></div>
      <div class="summary-item"><label>审核口径</label><span>按给付型案件生成，不适用责任比例折算。</span></div>
      <div class="summary-item"><label>核定金额</label><span>¥${Number(report.subTotal || 0).toFixed(2)}</span></div>
      <div class="summary-item"><label>给付结论金额</label><span>¥${Number(report.finalAmount || 0).toFixed(2)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">三、给付项目</div>
    <table>
      <thead>
        <tr>
          <th style="width:18%">类别</th>
          <th style="width:30%">项目</th>
          <th style="width:18%">核定金额</th>
          <th style="width:34%">核定依据</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="final-row">
          <td colspan="2">给付结论金额</td>
          <td style="text-align:right">¥${report.finalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${decisionTraceHtml ? `
  <div class="section">
    <div class="section-title">四、决策轨迹</div>
    ${decisionTraceHtml}
  </div>
  ` : ""}

  <div class="footer">
    本报告由系统自动生成，仅供审核参考。给付金额以最终审核结论为准。
  </div>
</body>
</html>`;
}

function generateAutoLossReportHtml({ report, claimCase }) {
  const liabilityResult = report.liabilityResult || null;
  const decisionTraceHtml = renderDecisionTraceHtml(report.decisionTrace?.stages);
  const rows = report.items
    .map((item) => `
      <tr>
        <td>${item.category}</td>
        <td>${item.itemName}</td>
        <td style="text-align:right">¥${item.originalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">¥${item.approvedAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
        <td>${item.basis}</td>
      </tr>
    `)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>车险损失审核报告 - ${claimCase?.reportNumber || report.claimCaseId}</title>
  <style>
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; margin: 40px; color: #1a1a1a; }
    h1 { text-align: center; font-size: 20px; margin-bottom: 8px; }
    .subtitle { text-align: center; font-size: 13px; color: #666; margin-bottom: 24px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 15px; font-weight: bold; border-left: 4px solid #2563eb; padding-left: 8px; margin-bottom: 12px; }
    .summary-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 16px; }
    .summary-item { display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #eff6ff; padding: 8px 12px; text-align: left; font-size: 13px; border: 1px solid #bfdbfe; }
    td { padding: 8px 12px; border: 1px solid #e8ecf0; font-size: 13px; }
    .final-row td { font-weight: bold; font-size: 15px; background: #dbeafe; color: #1d4ed8; }
    .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #e8e8e8; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>车险损失审核报告</h1>
  <div class="subtitle">报告编号：${report.reportId} &nbsp;|&nbsp; 生成时间：${new Date(report.generatedAt).toLocaleString("zh-CN")}</div>

  <div class="section">
    <div class="section-title">一、事故责任</div>
    <div class="summary-box">
      <div class="summary-item"><label>案件编号</label><span>${claimCase?.reportNumber || report.claimCaseId}</span></div>
      <div class="summary-item"><label>事故原因</label><span>${claimCase?.accidentReason || "-"}</span></div>
      <div class="summary-item"><label>责任比例</label><span>${liabilityResult ? `第三方责任 ${liabilityResult.thirdPartyLiabilityPct}% / 自身责任 ${liabilityResult.claimantLiabilityPct}%` : "待人工确认"}</span></div>
      <div class="summary-item"><label>责任依据</label><span>${liabilityResult?.basis || "未形成明确事故责任依据"}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">二、损失项目</div>
    <table>
      <thead>
        <tr>
          <th style="width:18%">类别</th>
          <th style="width:26%">项目</th>
          <th style="width:16%">申报金额</th>
          <th style="width:16%">核定金额</th>
          <th style="width:24%">核定依据</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="final-row">
          <td colspan="2">报告结论金额</td>
          <td style="text-align:right">¥${report.subTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
          <td style="text-align:right">¥${report.finalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${decisionTraceHtml ? `
  <div class="section">
    <div class="section-title">三、决策轨迹</div>
    ${decisionTraceHtml}
  </div>
  ` : ""}

  <div class="footer">
    本报告由系统自动生成，仅供审核参考。车险最终赔付金额以人工审核和险种分摊结果为准。
  </div>
</body>
</html>`;
}

/**
 * 生成完整定损报告
 *
 * @param {object} params
 * @param {string} params.claimCaseId
 * @param {object} params.aggregationResult - caseAggregator.aggregateCase() 的返回值
 * @param {object} [params.claimCase] - ClaimCase 基础信息（用于报告头部）
 * @param {object} [params.standards] - 赔偿标准参数（覆盖默认值）
 * @param {number} [params.claimantAge] - 伤者年龄（用于伤残赔偿年限计算）
 * @returns {object} DamageReport
 */
export function generateDamageReport({
  claimCaseId,
  aggregationResult,
  claimCase = {},
  standards = {},
  claimantAge = 35,
  reviewResult = null,
}) {
  const domainModel = resolveReportDomainModel({ claimCaseId, claimCase, aggregationResult });
  const presentation = getReportPresentationConfig(domainModel);
  const { injuryProfile, liabilityResult, expenseAggregation, conflictsDetected, deathProfile } = aggregationResult;
  const standardsSnapshot = {
    ...(aggregationResult?.regionalStandards || {}),
    ...standards,
  };
  const liabilityContext = resolveLiabilityContext(aggregationResult);

  const items = calculateDamageItems({
    injuryProfile,
    liabilityResult,
    expenseAggregation,
    deathProfile,
    standards: standardsSnapshot,
    claimantAge,
  });
  const medicalLedgerPresentation = domainModel?.isMedicalScenario
    ? buildMedicalReportItemsFromLedger(reviewResult)
    : null;

  const effectiveItems = medicalLedgerPresentation?.items || items;
  const subTotal = Number.isFinite(Number(medicalLedgerPresentation?.subTotal))
    ? Number(medicalLedgerPresentation.subTotal)
    : effectiveItems.reduce((sum, item) => sum + item.approvedAmount, 0);
  const hasLiabilityRatio =
    !domainModel?.isMedicalScenario &&
    liabilityContext &&
    Number.isFinite(liabilityContext.thirdPartyLiabilityPct);
  const liabilityFactor = hasLiabilityRatio
    ? liabilityContext.thirdPartyLiabilityPct / 100
    : 1;
  const adjustedAmount = parseFloat((subTotal * liabilityFactor).toFixed(2));
  const deductionTotal = parseFloat(((aggregationResult?.deductionSummary?.deductionTotal) || 0).toFixed(2));
  const computedFinalAmount = parseFloat(Math.max(0, adjustedAmount - deductionTotal).toFixed(2));
  const normalizedReviewAmount = Number(
    reviewResult?.payableAmount ??
      reviewResult?.amount?.finalAmount ??
      reviewResult?.amount?.settlementBreakdown?.totalPayableAmount,
  );
  const finalAmount =
    domainModel?.isMedicalScenario && Number.isFinite(normalizedReviewAmount)
      ? normalizedReviewAmount
      : computedFinalAmount;

  const std = { ...DEFAULT_STANDARDS, ...standardsSnapshot };

  const report = {
    reportId: `RPT-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    claimCaseId,
    generatedAt: new Date().toISOString(),
    generatedBy: "ai",
    items: effectiveItems,
    subTotal: parseFloat(subTotal.toFixed(2)),
    liabilityAdjustment: liabilityFactor,
    adjustedAmount,
    deductionTotal,
    finalAmount,
    calculationFormula: hasLiabilityRatio
      ? `损失合计 × 第三方责任比例${deductionTotal > 0 ? ` - 已确认抵扣` : ""}`
      : `损失合计${deductionTotal > 0 ? ` - 已确认抵扣` : "（责任比例待人工确认，未折减）"}`,
    regionalStandards: `${std.region} ${std.year}年，城镇居民人均可支配收入 ¥${std.urbanPerCapitaIncome.toLocaleString("zh-CN")}/年`,
    status: "draft",
    domainModel,
    reportKind: presentation.reportKind,
    reportTitle: presentation.reportTitle,
    amountLabels: presentation.amountLabels,
    detailSectionTitle: presentation.detailSectionTitle,
    // 附加聚合结果（用于 HTML 渲染）
    injuryProfile,
    liabilityResult: liabilityContext
      ? {
          claimantLiabilityPct: liabilityContext.claimantLiabilityPct,
          thirdPartyLiabilityPct: liabilityContext.thirdPartyLiabilityPct,
          basis: liabilityContext.basis,
          source: liabilityContext.source,
        }
      : liabilityResult,
    deathProfile,
    deductionSummary: aggregationResult?.deductionSummary || null,
    manualReviewItems: aggregationResult?.manualReviewItems || [],
    standardsSnapshot: aggregationResult?.regionalStandards || {},
    settlementSnapshot: reviewResult?.amount
      ? {
          deductible: Number(reviewResult.amount.deductible || 0),
          reimbursementRatio: Number(reviewResult.amount.reimbursementRatio ?? 1),
          payableAmount: Number.isFinite(normalizedReviewAmount) ? normalizedReviewAmount : finalAmount,
          settlementDecision: reviewResult.settlementDecision || null,
          medicalReview: reviewResult.amount.medicalReview || null,
          policyBinding: reviewResult.policyBinding || reviewResult.amount.policyBinding || null,
          coverageBreakdown: reviewResult.coverageResults || reviewResult.amount.coverageResults || [],
        }
      : null,
    decisionTrace: buildDecisionTraceForReport({ aggregationResult, report: {
      claimCaseId,
      generatedAt: new Date().toISOString(),
      subTotal: parseFloat(subTotal.toFixed(2)),
      liabilityAdjustment: liabilityFactor,
      deductionTotal,
      finalAmount,
    } }),
    conflicts: conflictsDetected,
  };

  if (domainModel?.isMedicalScenario) {
    report.reportHtml = generateMedicalExpenseReportHtml({ report, claimCase });
  } else if (domainModel?.isBenefitScenario) {
    report.reportHtml = generateBenefitAssessmentReportHtml({ report, claimCase });
  } else if (domainModel?.isAutoScenario) {
    report.reportHtml = generateAutoLossReportHtml({ report, claimCase });
  } else {
    report.reportHtml = generateReportHtml({ report, claimCase, summaries: [] });
  }

  return report;
}
