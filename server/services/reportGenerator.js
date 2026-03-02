/**
 * 定损报告生成服务
 *
 * 根据案件聚合数据（InjuryProfile、LiabilityResult、ExpenseAggregation）
 * 结合各地赔偿标准，计算各项赔偿，生成 HTML 格式的定损报告。
 */

import crypto from "crypto";

// 默认赔偿参数（当无法获取当地标准时使用，需管理员配置实际值）
const DEFAULT_STANDARDS = {
  region: "上海市",
  year: 2024,
  // 上一年度城镇居民人均可支配收入（元/年）
  urbanPerCapitaIncome: 79610,
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

/**
 * 计算各项赔偿条目
 */
function calculateDamageItems({ injuryProfile, liabilityResult, expenseAggregation, standards, claimantAge = 35, summaries = [] }) {
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

  const rows = items.map((item) => `
    <tr>
      <td>${item.category}</td>
      <td>${item.itemName}</td>
      <td style="text-align:right">¥${item.originalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</td>
      <td>${item.formula}</td>
      <td>${item.basis}</td>
    </tr>
  `).join("");

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
    <div class="section-title">三、损失明细</div>
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
    <div class="section-title">四、赔偿计算</div>
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

  ${report.conflicts && report.conflicts.length > 0 ? `
  <div class="section">
    <div class="section-title">五、待核实事项</div>
    <div class="conflict-box">
      ${report.conflicts.map((c) => `<div class="conflict-item">⚠ ${c.description}</div>`).join("")}
    </div>
  </div>
  ` : ""}

  <div class="footer">
    本报告由 AI 自动生成，仅供参考，最终赔偿金额以人工审核确认为准。<br>
    生成模型：Gemini 2.5 Flash &nbsp;|&nbsp; 报告状态：${report.status === "confirmed" ? "已确认" : "草稿"}
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
}) {
  const { injuryProfile, liabilityResult, expenseAggregation, conflictsDetected } = aggregationResult;

  const items = calculateDamageItems({
    injuryProfile,
    liabilityResult,
    expenseAggregation,
    standards,
    claimantAge,
  });

  const subTotal = items.reduce((sum, item) => sum + item.approvedAmount, 0);
  const liabilityFactor = liabilityResult
    ? liabilityResult.thirdPartyLiabilityPct / 100
    : 1;
  const finalAmount = parseFloat((subTotal * liabilityFactor).toFixed(2));

  const std = { ...DEFAULT_STANDARDS, ...standards };

  const report = {
    reportId: `RPT-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    claimCaseId,
    generatedAt: new Date().toISOString(),
    generatedBy: "ai",
    items,
    subTotal: parseFloat(subTotal.toFixed(2)),
    liabilityAdjustment: liabilityFactor,
    finalAmount,
    calculationFormula: `损失合计 × 第三方责任比例`,
    regionalStandards: `${std.region} ${std.year}年，城镇居民人均可支配收入 ¥${std.urbanPerCapitaIncome.toLocaleString("zh-CN")}/年`,
    status: "draft",
    // 附加聚合结果（用于 HTML 渲染）
    injuryProfile,
    liabilityResult,
    conflicts: conflictsDetected,
  };

  report.reportHtml = generateReportHtml({ report, claimCase, summaries: [] });

  return report;
}
