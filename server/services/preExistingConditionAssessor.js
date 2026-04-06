/**
 * 既往症评估服务
 *
 * 基于三步递进算法判断本次理赔是否涉及投保前既往症：
 *   Step A：既往史文本解析（明确"无" → NO，"不详"/null → UNCERTAIN）
 *   Step B：时间逻辑判断（首诊日期 < 生效日 / 在等待期内 → SUSPICIOUS）
 *   Step C：AI 辅助综合判断（仅当 A/B 无法单独确定时调用）
 *
 * 输出三态：
 *   YES       → 存在既往症（pre_existing_condition = true）
 *   NO        → 无既往症（pre_existing_condition = false）
 *   UNCERTAIN → 无法确定（pre_existing_condition = null，触发转人工）
 */

import { invokeAICapability } from "./aiRuntime.js";
import { renderPromptTemplate } from "./aiConfigService.js";

const DEFAULT_CONFIDENCE_THRESHOLD =
  Number(process.env.PRE_EXISTING_CONFIDENCE_THRESHOLD) || 0.65;

// 明确无既往症的正则模式（CLEAR）
const CLEAR_PATTERNS = [
  /^无$/,
  /^否认既往病史$/,
  /^无特殊$/,
  /既往体健/,
  /无特殊既往史/,
  /否认.{0,15}病史/,
  /无慢性病/,
  /平素体健/,
  /无重大.{0,8}病史/,
  /无既往.{0,8}病史/,
];

// 信息不详/缺失的正则模式（UNKNOWN）
const UNKNOWN_PATTERNS = [
  /不详/,
  /不清/,
  /欠详/,
  /代述/,
  /未提及/,
  /无法提供/,
  /不明/,
];

/**
 * 解析既往史文本，返回语义确定性
 * @param {string|null} pastHistory
 * @returns {{ certainty: 'CLEAR'|'HAS_CONTENT'|'UNKNOWN', text: string|null }}
 */
function parsePastHistoryCertainty(pastHistory) {
  if (!pastHistory) {
    return { certainty: "UNKNOWN", text: null };
  }
  const trimmed = pastHistory.trim();
  // CLEAR 优先于 UNKNOWN
  if (CLEAR_PATTERNS.some((re) => re.test(trimmed))) {
    return { certainty: "CLEAR", text: trimmed };
  }
  if (UNKNOWN_PATTERNS.some((re) => re.test(trimmed))) {
    return { certainty: "UNKNOWN", text: trimmed };
  }
  return { certainty: "HAS_CONTENT", text: trimmed };
}

/**
 * 时间逻辑判断
 * @param {object} claimContext - 含 first_diagnosis_date / admission_date / diagnosis_date
 * @param {object} policyInfo   - 含 effective_date / waiting_period_days
 * @returns {{ verdict: 'SUSPICIOUS'|'CLEAR'|'UNKNOWN', reason: string, firstDiagnosisDate: string|null }}
 */
function evaluateTimeLogic(claimContext, policyInfo) {
  const effectiveDate = policyInfo?.effective_date;
  if (!effectiveDate) {
    return {
      verdict: "UNKNOWN",
      reason: "保单生效日缺失",
      firstDiagnosisDate: null,
    };
  }

  const firstDiagnosisDate =
    claimContext.first_diagnosis_date ||
    claimContext.firstDiagnosisDate ||
    claimContext.diagnosis_date ||
    claimContext.diagnosisDate ||
    claimContext.admission_date ||
    claimContext.admissionDate ||
    null;

  if (!firstDiagnosisDate) {
    return {
      verdict: "UNKNOWN",
      reason: "首诊日期缺失",
      firstDiagnosisDate: null,
    };
  }

  if (firstDiagnosisDate < effectiveDate) {
    return {
      verdict: "SUSPICIOUS",
      reason: `首诊日期(${firstDiagnosisDate})早于保单生效日(${effectiveDate})`,
      firstDiagnosisDate,
    };
  }

  const waitingPeriodDays = Number(policyInfo?.waiting_period_days) || 0;
  if (waitingPeriodDays > 0) {
    const waitingEnd = addDays(effectiveDate, waitingPeriodDays);
    if (firstDiagnosisDate < waitingEnd) {
      return {
        verdict: "SUSPICIOUS",
        reason: `首诊日期(${firstDiagnosisDate})在等待期内（等待期至${waitingEnd}）`,
        firstDiagnosisDate,
      };
    }
  }

  return { verdict: "CLEAR", reason: "时间逻辑无异常", firstDiagnosisDate };
}

/**
 * 日期加天数（ISO 字符串 YYYY-MM-DD）
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * 调用 AI 进行综合判断
 */
async function invokeAIAssessment({
  historyText,
  currentDiagnosis,
  diagnosisNames,
  firstDiagnosisDate,
  policyEffectiveDate,
  waitingPeriodDays,
}) {
  try {
    const prompt = renderPromptTemplate("pre_existing_condition_assessment", {
      historyText: historyText || "不详",
      currentDiagnosis: currentDiagnosis || "未知",
      diagnosisNames: Array.isArray(diagnosisNames)
        ? diagnosisNames.join("、")
        : diagnosisNames || "未知",
      firstDiagnosisDate: firstDiagnosisDate || "未知",
      policyEffectiveDate: policyEffectiveDate || "未知",
      waitingPeriodDays: String(waitingPeriodDays || 0),
    });

    const { response } = await invokeAICapability({
      capabilityId: "admin.claim.pre_existing_assessment",
      request: { contents: { parts: [{ text: prompt }] } },
      meta: {
        sourceApp: "admin-system",
        module: "preExistingConditionAssessor",
        operation: "pre_existing_assessment",
        context: { currentDiagnosis, policyEffectiveDate },
      },
    });

    const responseText = response?.text || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // 规范化 result 字段
      const result = String(parsed.result || "").toUpperCase();
      if (["YES", "NO", "UNCERTAIN"].includes(result)) {
        return {
          result,
          confidence: Number(parsed.confidence) || 0.5,
          reasoning: parsed.reasoning || "",
        };
      }
    }
  } catch (error) {
    console.error("[preExistingConditionAssessor] AI 判断失败:", error.message);
  }
  return null;
}

/**
 * 综合多路信号得出最终判断
 */
function synthesizeResult(signals, confidenceThreshold) {
  let yesScore = 0;
  let noScore = 0;

  for (const { vote, weight } of signals) {
    if (vote === "YES") yesScore += weight;
    else if (vote === "NO") noScore += weight;
  }

  const total = yesScore + noScore;
  if (total === 0) {
    return { result: "UNCERTAIN", confidence: 0 };
  }

  const winScore = Math.max(yesScore, noScore);
  const confidence = Number((winScore / total).toFixed(2));

  if (confidence < confidenceThreshold) {
    return { result: "UNCERTAIN", confidence };
  }

  return {
    result: yesScore > noScore ? "YES" : "NO",
    confidence,
  };
}

/**
 * 评估既往症
 *
 * @param {object} claimContext  - 标准化后的理赔上下文
 * @param {object} policyInfo    - 保单信息：{ effective_date, waiting_period_days }
 * @param {object} [options]
 * @param {boolean} [options.useAI=true]
 * @param {number}  [options.confidenceThreshold]
 * @returns {Promise<{
 *   result: 'YES'|'NO'|'UNCERTAIN',
 *   confidence: number,
 *   evidence: string[],
 *   reasoning: string,
 *   historyText: string|null,
 *   evaluatedAt: string
 * }>}
 */
export async function assessPreExistingCondition(
  claimContext = {},
  policyInfo = {},
  options = {},
) {
  const { useAI = true, confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD } =
    options;

  const evidence = [];
  const signals = [];

  // Step A：既往史文本解析
  const historyParsed = parsePastHistoryCertainty(
    claimContext.past_medical_history,
  );
  const stepHistory = {
    certainty: historyParsed.certainty,
    text: historyParsed.text,
    vote: null,
    weight: 0,
  };

  if (historyParsed.certainty === "CLEAR") {
    signals.push({ vote: "NO", weight: 0.6 });
    evidence.push(`既往史记录为"${historyParsed.text}"，无既往病史`);
    stepHistory.vote = "NO";
    stepHistory.weight = 0.6;
  } else if (historyParsed.certainty === "HAS_CONTENT") {
    signals.push({ vote: "YES", weight: 0.5 });
    evidence.push(`既往史记录：${historyParsed.text}`);
    stepHistory.vote = "YES";
    stepHistory.weight = 0.5;
  }
  // UNKNOWN 不投票，等待后续步骤

  // Step B：时间逻辑判断
  const timeResult = evaluateTimeLogic(claimContext, policyInfo);
  const stepTimeLogic = {
    verdict: timeResult.verdict,
    reason: timeResult.reason,
    firstDiagnosisDate: timeResult.firstDiagnosisDate,
    vote: null,
    weight: 0,
  };

  if (timeResult.verdict === "SUSPICIOUS") {
    signals.push({ vote: "YES", weight: 0.7 });
    evidence.push(timeResult.reason);
    stepTimeLogic.vote = "YES";
    stepTimeLogic.weight = 0.7;
  } else if (timeResult.verdict === "CLEAR") {
    signals.push({ vote: "NO", weight: 0.4 });
    evidence.push(timeResult.reason);
    stepTimeLogic.vote = "NO";
    stepTimeLogic.weight = 0.4;
  }

  // 尝试先综合 A+B 的结果，判断是否需要 AI
  const preAiResult = synthesizeResult(signals, confidenceThreshold);

  // Step C：AI 辅助（仅当 A+B 置信度不足，且既往史有内容时调用）
  let aiResult = null;
  const needsAI =
    useAI &&
    preAiResult.result === "UNCERTAIN" &&
    historyParsed.certainty !== "UNKNOWN";
  const stepAI = {
    invoked: needsAI,
    skippedReason: needsAI
      ? null
      : !useAI
        ? "AI 已禁用"
        : historyParsed.certainty === "UNKNOWN"
          ? "既往史缺失或不详，不触发 AI"
          : preAiResult.result !== "UNCERTAIN"
            ? "文本与时间逻辑已足够确定"
            : "未满足 AI 触发条件",
    result: null,
    confidence: null,
    reasoning: "",
    voteWeight: 0,
  };

  if (needsAI) {
    aiResult = await invokeAIAssessment({
      historyText: historyParsed.text,
      currentDiagnosis: claimContext.diagnosis,
      diagnosisNames: claimContext.diagnosis_names,
      firstDiagnosisDate: timeResult.firstDiagnosisDate,
      policyEffectiveDate: policyInfo.effective_date,
      waitingPeriodDays: policyInfo.waiting_period_days,
    });

    if (aiResult) {
      signals.push({
        vote: aiResult.result,
        weight: aiResult.confidence * 0.8,
      });
      evidence.push(`AI 判断：${aiResult.reasoning}`);
      stepAI.result = aiResult.result;
      stepAI.confidence = aiResult.confidence;
      stepAI.reasoning = aiResult.reasoning;
      stepAI.voteWeight = Number((aiResult.confidence * 0.8).toFixed(2));
    } else {
      stepAI.skippedReason = "AI 返回为空或解析失败";
    }
  }

  const finalResult = synthesizeResult(signals, confidenceThreshold);
  const yesScore = Number(
    signals
      .filter((item) => item.vote === "YES")
      .reduce((sum, item) => sum + item.weight, 0)
      .toFixed(2),
  );
  const noScore = Number(
    signals
      .filter((item) => item.vote === "NO")
      .reduce((sum, item) => sum + item.weight, 0)
      .toFixed(2),
  );

  return {
    result: finalResult.result,
    confidence: finalResult.confidence,
    evidence,
    reasoning:
      aiResult?.reasoning ||
      (finalResult.result === "UNCERTAIN"
        ? "信息不足，无法自动判断"
        : evidence.join("；")),
    historyText: historyParsed.text,
    evaluatedAt: new Date().toISOString(),
    steps: {
      history: stepHistory,
      timeLogic: stepTimeLogic,
      ai: stepAI,
      synthesis: {
        preAiResult,
        finalResult,
        yesScore,
        noScore,
        threshold: confidenceThreshold,
      },
    },
  };
}

export default { assessPreExistingCondition };
