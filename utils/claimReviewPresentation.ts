export interface ManualReviewReasonView {
  code: string;
  stage: string;
  source: string;
  category: string;
  message: string;
}

export interface CoverageResultView {
  coverageCode: string;
  claimedAmount: number;
  approvedAmount: number;
  reimbursementRatio?: number | null;
  sumInsured?: number | null;
  status?: string;
}

export interface SmartReviewResultView {
  decision: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  amount: number | null;
  reasoning: string;
  intakeDecision?: string;
  liabilityDecision?: string;
  assessmentDecision?: string;
  settlementDecision?: string;
  payableAmount?: number | null;
  missingMaterials?: string[];
  manualReviewReasons?: ManualReviewReasonView[];
  coverageResults?: CoverageResultView[];
  eligibility?: {
    eligible: boolean;
    matchedRules: string[];
    rejectionReasons: any[];
    warnings: any[];
    manualReviewReasons?: ManualReviewReasonView[];
  };
  calculation?: {
    totalClaimable: number;
    deductible: number;
    reimbursementRatio: number;
    finalAmount: number;
    settlementMode?: 'LOSS' | 'BENEFIT' | 'HYBRID';
    lossLedger?: Array<{
      itemKey: string;
      itemName: string;
      claimedAmount: number;
      payableAmount: number;
      status: 'PAYABLE' | 'ZERO_PAY' | 'MANUAL_REVIEW';
      coverageCode?: string;
      entries: Array<{
        step: string;
        beforeAmount: number;
        afterAmount: number;
        reasonCode?: string;
        message?: string;
        ruleId?: string;
      }>;
      manualReviewReasons?: Array<{ code: string; message: string }>;
      flags?: string[];
    }>;
    benefitLedger?: Array<{
      coverageCode: string;
      claimedAmount: number;
      payableAmount: number;
      status: 'PAYABLE' | 'ZERO_PAY' | 'MANUAL_REVIEW';
      entries: Array<{
        step: string;
        beforeAmount: number;
        afterAmount: number;
        reasonCode?: string;
        message?: string;
        ruleId?: string;
      }>;
      manualReviewReasons?: Array<{ code: string; message: string }>;
    }>;
    settlementBreakdown?: {
      lossPayableAmount: number;
      benefitPayableAmount: number;
      totalPayableAmount: number;
    };
    coverageResults?: CoverageResultView[];
    manualReviewReasons?: ManualReviewReasonView[];
    itemBreakdown: Array<{
      item: string;
      claimed: number;
      approved: number;
      reason: string;
    }>;
  };
  ruleTrace: string[];
  duration: number;
  completeness?: {
    missingMaterials?: string[];
  };
  [key: string]: unknown;
}

export interface ReviewStageCard {
  key: 'intake' | 'liability' | 'assessment' | 'settlement';
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  helper: string;
}

export interface ReviewSummaryView {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  accentClass: string;
  panelClass: string;
}

export interface ReviewOutcomeView extends ReviewSummaryView {
  detail: string;
  nextAction: string;
  amountLabel: string;
  showEstimatedAmount: boolean;
  highlightAmount: boolean;
}

export interface ReviewExplanationCard {
  id: string;
  title: string;
  tone: 'warning' | 'danger' | 'neutral';
  items: Array<{
    label: string;
    actionType?: 'material_import' | 'open_ruleset';
    materialName?: string;
    coverageCode?: string;
    targetTab?: 'overview' | 'liability' | 'settlement';
  }>;
}

const STAGE_ORDER = ['INTAKE', 'LIABILITY', 'SETTLEMENT'];

const MANUAL_REVIEW_CODE_LABELS: Record<string, string> = {
  MISSING_REQUIRED_MATERIALS: '缺少必要材料',
  UNSUPPORTED_RULE_EXPRESSION: '规则暂不支持自动判定',
  MISSING_LIABILITY_FIELDS: '关键责任字段缺失',
  COVERAGE_CONFIG_MISSING: '保障责任映射缺失',
  LIABILITY_RULE_REVIEW: '责任规则需人工复核',
};

const COVERAGE_CODE_LABELS: Record<string, string> = {
  AUTO_COMPULSORY: '交强险',
  AUTO_THIRD_PARTY: '商业三者',
  AUTO_VEHICLE_DAMAGE: '车损险',
  AUTO_DRIVER_PASSENGER: '车上人员责任险',
  ACC_MEDICAL: '意外医疗',
  ACC_DISABILITY: '意外伤残',
  ACC_DEATH: '意外身故',
  HLT_INPATIENT: '住院医疗',
};

function countByStage(reasons: ManualReviewReasonView[] = [], stage: string) {
  return reasons.filter(reason => reason.stage === stage).length;
}

export function formatManualReviewCode(code?: string) {
  if (!code) return '人工复核';
  return MANUAL_REVIEW_CODE_LABELS[code] || code;
}

export function formatCoverageCode(code?: string) {
  if (!code) return '未识别责任';
  return COVERAGE_CODE_LABELS[code] || code;
}

export function groupManualReviewReasons(reasons: ManualReviewReasonView[] = []) {
  const groups = STAGE_ORDER.map(stage => ({
    stage,
    label: stage === 'INTAKE' ? '受理' : stage === 'LIABILITY' ? '定责' : '赔付',
    reasons: reasons.filter(reason => reason.stage === stage),
  })).filter(group => group.reasons.length > 0);

  const otherReasons = reasons.filter(reason => !STAGE_ORDER.includes(reason.stage));
  if (otherReasons.length > 0) {
    groups.push({
      stage: 'OTHER',
      label: '其他',
      reasons: otherReasons,
    });
  }

  return groups;
}

export function getStageCards(reviewResult: SmartReviewResultView): ReviewStageCard[] {
  const reasons = reviewResult.manualReviewReasons || [];
  const missingMaterials = reviewResult.missingMaterials || [];

  const intakeDecision = reviewResult.intakeDecision || (missingMaterials.length > 0 ? 'PENDING_MATERIAL' : 'PASS');
  const liabilityDecision = reviewResult.liabilityDecision || (
    reviewResult.decision === 'REJECT'
      ? 'REJECT'
      : reviewResult.decision === 'MANUAL_REVIEW'
        ? 'MANUAL_REVIEW'
        : (reviewResult.eligibility?.eligible ? 'ACCEPT' : 'MANUAL_REVIEW')
  );
  const assessmentDecision = reviewResult.assessmentDecision || (
    reviewResult.calculation
      ? (reviewResult.decision === 'MANUAL_REVIEW' ? 'PARTIAL_ASSESSED' : 'ASSESSED')
      : 'UNABLE_TO_ASSESS'
  );
  const settlementDecision = reviewResult.settlementDecision || (
    reviewResult.decision === 'APPROVE'
      ? 'PAY'
      : reviewResult.decision === 'REJECT'
        ? 'ZERO_PAY'
        : 'MANUAL_REVIEW'
  );

  const intakeBlocked = intakeDecision === 'PENDING_MATERIAL';
  const liabilityBlocked = intakeBlocked;
  const assessmentBlocked = intakeBlocked || liabilityDecision !== 'ACCEPT';
  const settlementBlocked =
    intakeBlocked ||
    liabilityDecision !== 'ACCEPT' ||
    !['ASSESSED', 'PARTIAL_ASSESSED'].includes(assessmentDecision);

  return [
    {
      key: 'intake',
      label: '受理',
      value: intakeDecision === 'PENDING_MATERIAL' ? '待补件' : '通过',
      tone: intakeDecision === 'PENDING_MATERIAL' ? 'warning' : 'success',
      helper: missingMaterials.length > 0 ? `缺 ${missingMaterials.length} 项材料` : '材料完整',
    },
    {
      key: 'liability',
      label: '定责',
      value: liabilityBlocked
        ? '待受理'
        : liabilityDecision === 'ACCEPT'
          ? '通过'
          : liabilityDecision === 'REJECT'
            ? '拒赔'
            : '人工复核',
      tone: liabilityBlocked
        ? 'neutral'
        : liabilityDecision === 'ACCEPT'
          ? 'success'
          : liabilityDecision === 'REJECT'
            ? 'danger'
            : 'warning',
      helper: liabilityBlocked
        ? '补齐材料后进入定责'
        : countByStage(reasons, 'LIABILITY') > 0
          ? `${countByStage(reasons, 'LIABILITY')} 条复核原因`
          : '责任已判定',
    },
    {
      key: 'assessment',
      label: '定损',
      value: assessmentBlocked
        ? '待定责'
        : assessmentDecision === 'ASSESSED'
          ? '已核定'
          : assessmentDecision === 'PARTIAL_ASSESSED'
            ? '部分核定'
            : '无法核定',
      tone: assessmentBlocked
        ? 'neutral'
        : assessmentDecision === 'ASSESSED'
          ? 'success'
          : assessmentDecision === 'PARTIAL_ASSESSED'
            ? 'warning'
            : 'danger',
      helper: assessmentBlocked
        ? liabilityDecision === 'REJECT'
          ? '责任未通过，不进入定损'
          : liabilityDecision === 'MANUAL_REVIEW'
            ? '定责完成后进入定损'
            : '待责任判断完成'
        : reviewResult.calculation?.itemBreakdown?.length
          ? `${reviewResult.calculation.itemBreakdown.length} 项明细`
          : '无明细核定',
    },
    {
      key: 'settlement',
      label: '赔付',
      value: settlementBlocked
        ? '待定损'
        : settlementDecision === 'PAY'
          ? '可赔付'
          : settlementDecision === 'PARTIAL_PAY'
            ? '部分赔付'
            : settlementDecision === 'ZERO_PAY'
              ? '不赔付'
              : '人工复核',
      tone: settlementBlocked
        ? 'neutral'
        : settlementDecision === 'PAY'
          ? 'success'
          : settlementDecision === 'ZERO_PAY'
            ? 'danger'
            : 'warning',
      helper: settlementBlocked
        ? assessmentBlocked
          ? '定损完成后进入赔付'
          : '待赔付试算'
        : reviewResult.amount !== null
          ? `¥${Number(reviewResult.amount || 0).toLocaleString()}`
          : '待人工确认',
    },
  ];
}

export function getReviewSummary(reviewResult: SmartReviewResultView): ReviewSummaryView {
  const outcome = getReviewOutcome(reviewResult);
  return {
    label: outcome.label,
    tone: outcome.tone,
    accentClass: outcome.accentClass,
    panelClass: outcome.panelClass,
  };
}

export function getReviewOutcome(reviewResult: SmartReviewResultView): ReviewOutcomeView {
  const missingMaterials = reviewResult.missingMaterials || [];
  const intakeDecision =
    reviewResult.intakeDecision ||
    (missingMaterials.length > 0 ? 'PENDING_MATERIAL' : 'PASS');
  const liabilityDecision = reviewResult.liabilityDecision || (
    reviewResult.decision === 'REJECT'
      ? 'REJECT'
      : reviewResult.decision === 'MANUAL_REVIEW'
        ? 'MANUAL_REVIEW'
        : (reviewResult.eligibility?.eligible ? 'ACCEPT' : 'MANUAL_REVIEW')
  );
  const assessmentDecision =
    reviewResult.assessmentDecision ||
    (reviewResult.calculation
      ? (reviewResult.decision === 'MANUAL_REVIEW' ? 'PARTIAL_ASSESSED' : 'ASSESSED')
      : 'UNABLE_TO_ASSESS');
  const hasAmount = reviewResult.amount != null;
  const hasEstimatedAmount =
    hasAmount &&
    liabilityDecision === 'ACCEPT' &&
    ['ASSESSED', 'PARTIAL_ASSESSED'].includes(assessmentDecision);
  const missingCount = missingMaterials.length;
  const missingLabel = missingCount > 0 ? `缺 ${missingCount} 项材料` : '材料待确认';

  if (intakeDecision === 'PENDING_MATERIAL' && hasEstimatedAmount) {
    return {
      label: '已初算待补件',
      tone: 'warning',
      accentClass: 'text-amber-700',
      panelClass: 'text-amber-700 bg-amber-50 border-amber-200',
      detail: `责任已通过，金额已初算，当前仍需补齐材料后进入终审。${missingLabel}`,
      nextAction: '优先补齐死亡材料包后复核终审',
      amountLabel: '预估给付',
      showEstimatedAmount: true,
      highlightAmount: true,
    };
  }

  if (intakeDecision === 'PENDING_MATERIAL') {
    return {
      label: '补充材料',
      tone: 'warning',
      accentClass: 'text-amber-600',
      panelClass: 'text-amber-600 bg-amber-50 border-amber-200',
      detail: `${missingLabel}，补齐后继续自动审核。`,
      nextAction: '先补件，再继续审核',
      amountLabel: '建议金额',
      showEstimatedAmount: hasAmount,
      highlightAmount: false,
    };
  }

  if (liabilityDecision === 'REJECT' || reviewResult.decision === 'REJECT') {
    return {
      label: '建议拒赔',
      tone: 'danger',
      accentClass: 'text-red-600',
      panelClass: 'text-red-600 bg-red-50 border-red-200',
      detail: '责任不成立，当前不进入赔付流程。',
      nextAction: '复核拒赔依据并确认通知动作',
      amountLabel: '建议金额',
      showEstimatedAmount: false,
      highlightAmount: false,
    };
  }

  if (reviewResult.decision === 'APPROVE' && reviewResult.settlementDecision === 'PAY') {
    return {
      label: '建议通过',
      tone: 'success',
      accentClass: 'text-green-600',
      panelClass: 'text-green-600 bg-green-50 border-green-200',
      detail: '责任、金额与赔付结论已形成，可进入给付处理。',
      nextAction: '确认给付信息后进入付款',
      amountLabel: '建议金额',
      showEstimatedAmount: hasAmount,
      highlightAmount: true,
    };
  }

  return {
    label: '需人工复核',
    tone: 'warning',
    accentClass: 'text-amber-600',
    panelClass: 'text-amber-600 bg-amber-50 border-amber-200',
    detail: '自动审核未能完成闭环，需要人工确认关键事实或规则结果。',
    nextAction: '查看复核原因并补齐关键字段',
    amountLabel: '建议金额',
    showEstimatedAmount: hasAmount,
    highlightAmount: false,
  };
}

export function getCoverageResults(reviewResult: SmartReviewResultView) {
  return reviewResult.coverageResults || reviewResult.calculation?.coverageResults || [];
}

export function getReviewExplanationCards(reviewResult: SmartReviewResultView): ReviewExplanationCard[] {
  const manualReviewReasons = reviewResult.manualReviewReasons || [];
  const missingMaterials = reviewResult.missingMaterials || [];

  const materialItems = [
    ...missingMaterials.map((item) => ({
      label: `缺少材料：${item}`,
      actionType: 'material_import' as const,
      materialName: item,
    })),
    ...manualReviewReasons
      .filter((reason) => reason.code === 'MISSING_REQUIRED_MATERIALS')
      .map((reason) => ({
        label: reason.message,
        actionType: 'material_import' as const,
      })),
  ];
  const coverageItems = manualReviewReasons
    .filter((reason) => reason.code === 'COVERAGE_CONFIG_MISSING')
    .map((reason) => {
      const metadata = (reason as ManualReviewReasonView & { metadata?: { coverageCode?: string } }).metadata;
      const coverageCode =
        metadata?.coverageCode ||
        (reason.source && reason.source !== 'UNKNOWN_COVERAGE' ? reason.source : undefined);
      return {
        label: reason.message,
        actionType: 'open_ruleset' as const,
        coverageCode,
        targetTab: 'overview' as const,
      };
    });
  const fieldItems = manualReviewReasons
    .filter((reason) =>
      [
        'MISSING_FACT',
        'MISSING_LIABILITY_FIELDS',
        'CRITICAL_ILLNESS_DIAGNOSIS_MISSING',
        'CRITICAL_ILLNESS_DIAGNOSIS_DATE_MISSING',
        'DISABILITY_GRADE_MISSING',
        'HOSPITAL_DAYS_MISSING',
      ].includes(reason.code),
    )
    .map((reason) => ({ label: reason.message }));

  const cards: ReviewExplanationCard[] = [];

  if (materialItems.length > 0) {
    cards.push({
      id: 'missing-materials',
      title: '材料缺口',
      tone: 'danger',
      items: materialItems.filter(
        (item, index, array) =>
          array.findIndex((candidate) => candidate.label === item.label) === index,
      ),
    });
  }

  if (coverageItems.length > 0) {
    cards.push({
      id: 'coverage-mapping',
      title: '保障映射缺口',
      tone: 'warning',
      items: coverageItems.filter(
        (item, index, array) =>
          array.findIndex(
            (candidate) =>
              candidate.label === item.label && candidate.coverageCode === item.coverageCode,
          ) === index,
      ),
    });
  }

  if (fieldItems.length > 0) {
    cards.push({
      id: 'missing-fields',
      title: '关键字段缺口',
      tone: 'warning',
      items: fieldItems.filter(
        (item, index, array) =>
          array.findIndex((candidate) => candidate.label === item.label) === index,
      ),
    });
  }

  return cards;
}

export function mergeSmartReviewResults(
  smartReviewResult: Partial<SmartReviewResultView> = {},
  fullReviewResult: Partial<SmartReviewResultView> = {},
): SmartReviewResultView {
  const mergedCalculation = {
    ...(fullReviewResult.calculation || {}),
    ...(smartReviewResult.calculation || {}),
    settlementMode:
      smartReviewResult.calculation?.settlementMode ||
      fullReviewResult.calculation?.settlementMode ||
      (fullReviewResult as { amount?: { settlementMode?: 'LOSS' | 'BENEFIT' | 'HYBRID' } }).amount?.settlementMode,
    lossLedger:
      smartReviewResult.calculation?.lossLedger ||
      fullReviewResult.calculation?.lossLedger ||
      (fullReviewResult as { amount?: { lossLedger?: SmartReviewResultView['calculation']['lossLedger'] } }).amount?.lossLedger ||
      [],
    benefitLedger:
      smartReviewResult.calculation?.benefitLedger ||
      fullReviewResult.calculation?.benefitLedger ||
      (fullReviewResult as { amount?: { benefitLedger?: SmartReviewResultView['calculation']['benefitLedger'] } }).amount?.benefitLedger ||
      [],
    settlementBreakdown:
      smartReviewResult.calculation?.settlementBreakdown ||
      fullReviewResult.calculation?.settlementBreakdown ||
      (fullReviewResult as { amount?: { settlementBreakdown?: SmartReviewResultView['calculation']['settlementBreakdown'] } }).amount?.settlementBreakdown,
    coverageResults:
      smartReviewResult.calculation?.coverageResults ||
      fullReviewResult.calculation?.coverageResults ||
      fullReviewResult.coverageResults ||
      [],
    manualReviewReasons:
      smartReviewResult.calculation?.manualReviewReasons ||
      fullReviewResult.calculation?.manualReviewReasons ||
      fullReviewResult.manualReviewReasons ||
      [],
    itemBreakdown:
      smartReviewResult.calculation?.itemBreakdown ||
      fullReviewResult.calculation?.itemBreakdown ||
      [],
  };

  const missingMaterials =
    (fullReviewResult.missingMaterials as string[]) ||
    (smartReviewResult.missingMaterials as string[]) ||
    (smartReviewResult.completeness?.missingMaterials as string[]) ||
    [];

  const manualReviewReasons =
    (fullReviewResult.manualReviewReasons as ManualReviewReasonView[]) ||
    (smartReviewResult.manualReviewReasons as ManualReviewReasonView[]) ||
    [];

  const coverageResults =
    (fullReviewResult.coverageResults as CoverageResultView[]) ||
    (smartReviewResult.coverageResults as CoverageResultView[]) ||
    [];

  const eligibility = {
    ...(fullReviewResult.eligibility || {}),
    ...(smartReviewResult.eligibility || {}),
    manualReviewReasons:
      smartReviewResult.eligibility?.manualReviewReasons ||
      fullReviewResult.eligibility?.manualReviewReasons ||
      manualReviewReasons,
  };

  return {
    ...fullReviewResult,
    ...smartReviewResult,
    decision:
      (smartReviewResult.decision as SmartReviewResultView['decision']) ||
      (fullReviewResult.decision as SmartReviewResultView['decision']) ||
      'MANUAL_REVIEW',
    amount:
      smartReviewResult.amount ??
      fullReviewResult.payableAmount ??
      fullReviewResult.amount ??
      fullReviewResult.calculation?.finalAmount ??
      null,
    reasoning:
      (smartReviewResult.reasoning as string) ||
      (fullReviewResult.reasoning as string) ||
      '未返回审核意见',
    intakeDecision: (fullReviewResult.intakeDecision as string) || undefined,
    liabilityDecision: (fullReviewResult.liabilityDecision as string) || undefined,
    assessmentDecision: (fullReviewResult.assessmentDecision as string) || undefined,
    settlementDecision: (fullReviewResult.settlementDecision as string) || undefined,
    payableAmount:
      fullReviewResult.payableAmount ??
      smartReviewResult.payableAmount ??
      null,
    missingMaterials,
    manualReviewReasons,
    coverageResults,
    eligibility,
    calculation: mergedCalculation,
    ruleTrace:
      (smartReviewResult.ruleTrace as string[]) ||
      (fullReviewResult.ruleTrace as string[]) ||
      [],
    duration:
      (smartReviewResult.duration as number) ||
      (fullReviewResult.duration as number) ||
      0,
    completeness:
      (smartReviewResult.completeness as { missingMaterials?: string[] }) ||
      (fullReviewResult.completeness as { missingMaterials?: string[] }) ||
      undefined,
  };
}

export function getStageToneClasses(tone: ReviewStageCard['tone']) {
  switch (tone) {
    case 'success':
      return 'border-green-200 bg-green-50 text-green-700';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
}
