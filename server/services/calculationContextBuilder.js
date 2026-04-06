/**
 * 理算上下文构建器
 * 将 factSchema 提取的事实值映射到 calculationEngine 需要的 context 路径
 *
 * 解决问题：handling-profiles.json 中 factSchema 定义了 deductible、reimbursementRatio 等字段，
 * 但这些值不会自动流入 calculationEngine 的公式变量。
 * 本模块将两者关联起来。
 */

/**
 * 场景 → 公式类型映射
 */
const SCENARIO_FORMULA_MAP = {
  medical_expense: ["ACC_MEDICAL", "HEALTH_MEDICAL"],
  accident_benefit: ["ACC_DEATH", "ACC_DISABILITY", "ACC_HOSPITAL_ALLOWANCE"],
  accident_medical: ["ACC_MEDICAL", "ACC_DISABILITY"],
  liability_death: ["LIABILITY_DEATH"],
  liability_injury: ["LIABILITY_INJURY"],
  auto_property_damage: ["AUTO_DAMAGE"],
  auto_injury: ["AUTO_INJURY", "ACC_MEDICAL"],
};

/**
 * 产品线 + 覆盖码 → 公式类型映射
 */
const COVERAGE_FORMULA_MAP = {
  ACC_MEDICAL: "ACC_MEDICAL",
  ACC_DISABILITY: "ACC_DISABILITY",
  ACC_DEATH: "ACC_DEATH",
  ACC_HOSPITAL_ALLOWANCE: "ACC_HOSPITAL_ALLOWANCE",
  HLT_INPATIENT: "HEALTH_MEDICAL",
  HLT_OUTPATIENT: "HEALTH_MEDICAL",
  HLT_CRITICAL_ILLNESS: "HEALTH_CI",
  AUTO_VEHICLE_DAMAGE: "AUTO_DAMAGE",
  AUTO_DRIVER_PASSENGER: "AUTO_INJURY",
  AUTO_THIRD_PARTY: "AUTO_DAMAGE",
  AUTO_COMPULSORY: "AUTO_DAMAGE",
  LIABILITY_DEATH: "LIABILITY_DEATH",
  LIABILITY_INJURY: "LIABILITY_INJURY",
  LIABILITY_PROPERTY: "LIABILITY_PROPERTY",
};

/**
 * 从 aggregation 和 facts 中构建理算上下文
 *
 * @param {object} options
 * @param {object} options.facts - 从 factSchema 提取的事实键值对
 * @param {object} options.coverage - 保单覆盖信息（deductible, reimbursementRatio, sumInsured 等）
 * @param {object} options.aggregation - 案件聚合数据
 * @param {object} options.domainModel - 领域模型（来自 claimDomainService）
 * @returns {object} calculationEngine 所需的 context 对象
 */
export function buildCalculationContext({
  facts = {},
  coverage = {},
  aggregation = {},
  domainModel = {},
} = {}) {
  const expenseAgg = aggregation.expenseAggregation || {};
  const deathProfile = aggregation.deathProfile || {};
  const liabilityResult =
    aggregation.liabilityApportionment || aggregation.liabilityResult || {};
  const paymentSummary = aggregation.paymentSummary || {};

  return {
    claim: {
      // 医疗费用类
      approved_expenses:
        facts.catalogMatchedAmount ??
        facts.medicalExpense ??
        Number(expenseAgg.approvedTotal || 0),
      prior_benefit: facts.priorBenefit ?? Number(expenseAgg.priorBenefit || 0),
      hospital_days:
        facts.hospitalizationDays ??
        Number(aggregation.medicalFacts?.hospitalizationDays || 0),

      // 伤残类
      disability_grade:
        facts.disabilityGrade ??
        aggregation.injuryAssessment?.suggestedGrade ??
        null,

      // 重疾类
      ci_stage:
        facts.ciStage ?? aggregation.diseaseAssessment?.suggestedStage ?? null,

      // 责任死亡类
      death_compensation:
        facts.deathCompensation ?? Number(deathProfile.deathCompensation || 0),
      funeral_expense:
        facts.funeralExpense ?? Number(deathProfile.funeralExpense || 0),
      dependent_expense:
        facts.dependentExpense ?? Number(deathProfile.dependentExpense || 0),
      medical_expense:
        facts.medicalExpense ?? Number(expenseAgg.medicalTotal || 0),
      liability_ratio:
        facts.liabilityRatio ??
        Number(liabilityResult.thirdPartyLiabilityPct || 0) / 100,
      paid_offset:
        facts.paidAmountRecognized ??
        Number(paymentSummary.confirmedPaidAmount || 0),

      // 车险类
      repair_estimate: facts.repairEstimate ?? 0,
      injury_grade: facts.injuryGrade ?? null,

      // 财产损失类
      property_loss: facts.propertyLoss ?? 0,
    },
    coverage: {
      deductible: facts.deductible ?? Number(coverage.deductible || 0),
      reimbursement_ratio:
        facts.reimbursementRatio ?? Number(coverage.reimbursementRatio || 1),
      sum_insured: facts.sumInsured ?? Number(coverage.sumInsured || 0),
      daily_allowance: Number(coverage.dailyAllowance || 0),
      per_seat_sum_insured: Number(coverage.perSeatSumInsured || 0),
      per_incident_limit: Number(coverage.perIncidentLimit || 0),
    },
    vehicle: {
      actual_value:
        facts.vehicleActualValue ?? Number(coverage.vehicleActualValue || 0),
    },
  };
}

/**
 * 根据场景推断适用的公式类型列表
 *
 * @param {object} options
 * @param {string} options.claimScenario - 理赔场景
 * @param {string} options.coverageCode - 覆盖码（可选，更精确）
 * @returns {string[]} 公式类型列表
 */
export function inferFormulaTypes({ claimScenario, coverageCode } = {}) {
  // 优先使用精确的覆盖码映射
  if (coverageCode && COVERAGE_FORMULA_MAP[coverageCode]) {
    return [COVERAGE_FORMULA_MAP[coverageCode]];
  }

  // 回退到场景映射
  if (claimScenario && SCENARIO_FORMULA_MAP[claimScenario]) {
    return SCENARIO_FORMULA_MAP[claimScenario];
  }

  return [];
}

/**
 * 一站式理算：从事实 + 覆盖信息直接执行理算
 *
 * @param {object} options
 * @param {object} options.facts - 事实键值对
 * @param {object} options.coverage - 覆盖信息
 * @param {object} options.aggregation - 聚合数据
 * @param {object} options.domainModel - 领域模型
 * @param {Function} options.executeCalculation - calculationEngine.executeCalculation 引用
 * @returns {Array<object>} 每个公式的理算结果
 */
export function executeAllFormulas({
  facts = {},
  coverage = {},
  aggregation = {},
  domainModel = {},
  executeCalculation,
} = {}) {
  if (typeof executeCalculation !== "function") {
    throw new Error("executeCalculation 函数未提供");
  }

  const context = buildCalculationContext({
    facts,
    coverage,
    aggregation,
    domainModel,
  });
  const formulaTypes = inferFormulaTypes({
    claimScenario: domainModel.claimScenario,
    coverageCode: facts.coverageCode || coverage.coverageCode,
  });

  const results = [];
  for (const formulaType of formulaTypes) {
    try {
      const result = executeCalculation(formulaType, context);
      results.push(result);
    } catch (error) {
      console.error(`公式 ${formulaType} 执行失败:`, error.message);
      results.push({
        formulaType,
        error: error.message,
        finalAmount: 0,
      });
    }
  }

  return results;
}

export default {
  buildCalculationContext,
  inferFormulaTypes,
  executeAllFormulas,
  SCENARIO_FORMULA_MAP,
  COVERAGE_FORMULA_MAP,
};
