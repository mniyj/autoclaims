/**
 * 人工介入状态机引擎
 *
 * 管理三种介入点的子状态机：
 * 1. PARSE_LOW_CONFIDENCE - 材料识别置信度不足
 * 2. VALIDATION_GATE - 材料校验规则不通过
 * 3. RULE_MANUAL_ROUTE - 规则引擎转人工
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readData, writeData } from "../utils/fileStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "../../jsonlist");
const INTERVENTIONS_FILE = path.join(DATA_DIR, "claim-interventions.json");

// ============ 数据读写 ============

const readInterventions = () => {
  try {
    if (!fs.existsSync(INTERVENTIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(INTERVENTIONS_FILE, "utf-8"));
  } catch {
    return [];
  }
};

const writeInterventions = (data) => {
  fs.writeFileSync(INTERVENTIONS_FILE, JSON.stringify(data, null, 2));
};

// ============ 转移表定义 ============

/**
 * 介入点1：材料识别置信度不足
 */
const PARSE_LOW_CONFIDENCE_TRANSITIONS = {
  IDLE: {
    CONFIDENCE_BELOW_THRESHOLD: { toState: "REVIEW_CREATED" },
  },
  REVIEW_CREATED: {
    ADJUSTER_CLAIM_TASK: {
      toState: "REVIEW_IN_PROGRESS",
      guard: "hasReviewer",
    },
  },
  REVIEW_IN_PROGRESS: {
    ADJUSTER_SUBMIT_CORRECTIONS: {
      toState: "CORRECTION_SUBMITTED",
      guard: "hasManualInput",
    },
    ADJUSTER_ACCEPT_ORIGINAL: { toState: "RESOLVED_ACCEPT_AS_IS" },
  },
  CORRECTION_SUBMITTED: {
    REQUEST_RE_EXTRACTION: { toState: "RE_EXTRACTION_PENDING" },
    CORRECTIONS_FINALIZED: { toState: "RESOLVED_PROCEED" },
  },
  RE_EXTRACTION_PENDING: {
    RE_EXTRACTION_STARTED: { toState: "RE_EXTRACTION_RUNNING" },
  },
  RE_EXTRACTION_RUNNING: {
    RE_EXTRACTION_STILL_LOW_CONFIDENCE: { toState: "REVIEW_CREATED" },
    RE_EXTRACTION_SUCCEEDED: { toState: "RESOLVED_PROCEED" },
  },
};

/**
 * 介入点2：材料校验规则不通过
 */
const VALIDATION_GATE_TRANSITIONS = {
  IDLE: {
    VALIDATION_RULES_FAILED: { toState: "VALIDATION_FAILED" },
  },
  VALIDATION_FAILED: {
    ADJUSTER_ASSIGNED: { toState: "PENDING_ADJUSTER_REVIEW" },
  },
  PENDING_ADJUSTER_REVIEW: {
    ADJUSTER_OVERRIDE_DECISION: {
      toState: "ADJUSTER_OVERRIDE",
      guard: "hasOverrideReason",
    },
    ADJUSTER_REQUEST_REUPLOAD: {
      toState: "PENDING_REUPLOAD",
      guard: "hasReuploadSpec",
    },
  },
  ADJUSTER_OVERRIDE: {
    OVERRIDE_CONFIRMED: { toState: "RESOLVED_PROCEED" },
  },
  PENDING_REUPLOAD: {
    CUSTOMER_REUPLOAD_COMPLETE: { toState: "REUPLOAD_RECEIVED" },
  },
  REUPLOAD_RECEIVED: {
    RE_VALIDATION_STARTED: { toState: "RE_VALIDATION_RUNNING" },
  },
  RE_VALIDATION_RUNNING: {
    RE_VALIDATION_PASSED: { toState: "RESOLVED_PROCEED" },
    RE_VALIDATION_FAILED: { toState: "VALIDATION_FAILED" },
  },
};

/**
 * 介入点3：规则引擎转人工
 */
const RULE_MANUAL_ROUTE_TRANSITIONS = {
  IDLE: {
    RULE_ROUTE_MANUAL: { toState: "MANUAL_REVIEW_TRIGGERED" },
  },
  MANUAL_REVIEW_TRIGGERED: {
    TASK_QUEUED: { toState: "PENDING_ADJUSTER" },
  },
  PENDING_ADJUSTER: {
    ADJUSTER_CLAIM_TASK: {
      toState: "ADJUSTER_REVIEWING",
      guard: "hasReviewer",
    },
  },
  ADJUSTER_REVIEWING: {
    ADJUSTER_APPROVE: { toState: "DECISION_APPROVE" },
    ADJUSTER_REJECT: { toState: "DECISION_REJECT", guard: "hasReason" },
    ADJUSTER_ADJUST: { toState: "DECISION_ADJUST", guard: "hasAdjustment" },
    ADJUSTER_REQUEST_INFO: {
      toState: "DECISION_REQUEST_INFO",
      guard: "hasInfoRequest",
    },
  },
  DECISION_APPROVE: {
    DECISION_CONFIRMED: { toState: "RESOLVED_PROCEED" },
  },
  DECISION_REJECT: {
    DECISION_CONFIRMED: { toState: "RESOLVED_PROCEED" },
  },
  DECISION_ADJUST: {
    DECISION_CONFIRMED: { toState: "RESOLVED_PROCEED" },
  },
  DECISION_REQUEST_INFO: {
    INFO_REQUEST_SENT: { toState: "PENDING_ADDITIONAL_INFO" },
    ROLLBACK_TO_INTAKE: { toState: "RESOLVED_ROLLBACK" },
  },
  PENDING_ADDITIONAL_INFO: {
    CUSTOMER_PROVIDES_INFO: { toState: "INFO_RECEIVED" },
  },
  INFO_RECEIVED: {
    RE_REVIEW_WITH_NEW_INFO: { toState: "ADJUSTER_REVIEWING" },
  },
};

/** 按介入类型索引转移表 */
const TRANSITION_TABLES = {
  PARSE_LOW_CONFIDENCE: PARSE_LOW_CONFIDENCE_TRANSITIONS,
  VALIDATION_GATE: VALIDATION_GATE_TRANSITIONS,
  RULE_MANUAL_ROUTE: RULE_MANUAL_ROUTE_TRANSITIONS,
};

// ============ 守卫函数 ============

const GUARDS = {
  hasReviewer: (payload) =>
    Boolean(payload?.reviewerId || payload?.reviewerName),

  hasManualInput: (payload) =>
    payload?.manualInputData != null &&
    Object.keys(payload.manualInputData).length > 0,

  hasOverrideReason: (payload) =>
    typeof payload?.reason === "string" && payload.reason.trim().length > 0,

  hasReuploadSpec: (payload) =>
    Array.isArray(payload?.materialIds) && payload.materialIds.length > 0,

  hasReason: (payload) =>
    typeof payload?.reason === "string" && payload.reason.trim().length > 0,

  hasAdjustment: (payload) =>
    typeof payload?.adjustedAmount === "number" ||
    typeof payload?.adjustedRatio === "number",

  hasInfoRequest: (payload) =>
    typeof payload?.infoDescription === "string" &&
    payload.infoDescription.trim().length > 0,
};

// ============ 终态判断 ============

const RESOLVED_STATES = new Set([
  "RESOLVED_PROCEED",
  "RESOLVED_ACCEPT_AS_IS",
  "RESOLVED_ROLLBACK",
]);

const isResolved = (state) => RESOLVED_STATES.has(state);

const getResolution = (state) => {
  if (state === "RESOLVED_PROCEED") return "PROCEED";
  if (state === "RESOLVED_ACCEPT_AS_IS") return "ACCEPT_AS_IS";
  if (state === "RESOLVED_ROLLBACK") return "ROLLBACK";
  return undefined;
};

// ============ ID 生成 ============

const generateId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ============ 核心函数 ============

/**
 * 创建人工介入实例
 */
export function createIntervention({
  claimCaseId,
  stageKey,
  interventionType,
  reason,
  priority = "MEDIUM",
  reviewTaskId,
  validationRuleIds,
  triggeringRuleId,
}) {
  const all = readInterventions();

  // 去重：同一案件 + 同一阶段 + 同一触发规则，且尚未解决 → 返回已有的介入实例
  const existing = all.find(
    (iv) =>
      iv.claimCaseId === claimCaseId &&
      iv.stageKey === stageKey &&
      iv.interventionType === interventionType &&
      (triggeringRuleId
        ? iv.triggeringRuleId === triggeringRuleId
        : iv.reason?.code === reason?.code) &&
      !isResolved(iv.currentState),
  );
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const id = generateId("iv");

  const intervention = {
    id,
    claimCaseId,
    stageKey,
    interventionType,
    currentState: "IDLE",
    previousState: undefined,
    reason,
    priority,
    createdAt: now,
    updatedAt: now,
    resolvedAt: undefined,
    resolution: undefined,
    rollbackTargetStage: undefined,
    reviewTaskId: reviewTaskId || undefined,
    validationRuleIds: validationRuleIds || undefined,
    triggeringRuleId: triggeringRuleId || undefined,
    adjusterDecision: undefined,
    transitions: [],
  };

  all.push(intervention);
  writeInterventions(all);

  // 自动从 IDLE 转移到首个活跃状态
  const firstEvent = getFirstEvent(interventionType);
  if (firstEvent) {
    return transitionState(id, firstEvent, { _auto: true });
  }

  return intervention;
}

/**
 * 根据介入类型获取创建时自动触发的首个事件
 */
function getFirstEvent(interventionType) {
  const map = {
    PARSE_LOW_CONFIDENCE: "CONFIDENCE_BELOW_THRESHOLD",
    VALIDATION_GATE: "VALIDATION_RULES_FAILED",
    RULE_MANUAL_ROUTE: "RULE_ROUTE_MANUAL",
  };
  return map[interventionType];
}

/**
 * 执行状态转移
 */
export function transitionState(interventionId, event, payload = {}) {
  const all = readInterventions();
  const idx = all.findIndex((iv) => iv.id === interventionId);
  if (idx === -1) {
    throw new Error(`Intervention not found: ${interventionId}`);
  }

  const intervention = { ...all[idx] };
  const table = TRANSITION_TABLES[intervention.interventionType];
  if (!table) {
    throw new Error(
      `Unknown intervention type: ${intervention.interventionType}`,
    );
  }

  const stateTransitions = table[intervention.currentState];
  if (!stateTransitions || !stateTransitions[event]) {
    throw new Error(
      `Invalid transition: ${intervention.currentState} + ${event} (type: ${intervention.interventionType})`,
    );
  }

  const { toState, guard } = stateTransitions[event];

  // 执行守卫条件
  if (guard && GUARDS[guard]) {
    if (!GUARDS[guard](payload)) {
      throw new Error(`Guard failed: ${guard} for event ${event}`);
    }
  }

  const now = new Date().toISOString();
  const transition = {
    id: generateId("it"),
    interventionId,
    fromState: intervention.currentState,
    toState,
    event,
    timestamp: now,
    actorType: payload?.actorType || (payload?._auto ? "system" : "adjuster"),
    actorName: payload?.actorName,
    reason: payload?.reason,
    data: payload?._auto ? undefined : payload,
  };

  // 更新介入实例（不可变）
  const updated = {
    ...intervention,
    previousState: intervention.currentState,
    currentState: toState,
    updatedAt: now,
    transitions: [...intervention.transitions, transition],
  };

  // 处理终态
  if (isResolved(toState)) {
    updated.resolvedAt = now;
    updated.resolution = getResolution(toState);
    if (toState === "RESOLVED_ROLLBACK") {
      updated.rollbackTargetStage = payload?.rollbackTargetStage || "intake";
    }
  }

  // 处理介入点3的理赔员决策
  if (
    intervention.interventionType === "RULE_MANUAL_ROUTE" &&
    [
      "DECISION_APPROVE",
      "DECISION_REJECT",
      "DECISION_ADJUST",
      "DECISION_REQUEST_INFO",
    ].includes(toState)
  ) {
    const decisionTypeMap = {
      DECISION_APPROVE: "APPROVE",
      DECISION_REJECT: "REJECT",
      DECISION_ADJUST: "ADJUST",
      DECISION_REQUEST_INFO: "REQUEST_INFO",
    };
    updated.adjusterDecision = {
      type: decisionTypeMap[toState],
      adjustedAmount: payload?.adjustedAmount,
      adjustedRatio: payload?.adjustedRatio,
      reason: payload?.reason || "",
      decidedAt: now,
      decidedBy: payload?.actorName || payload?.reviewerName || "adjuster",
    };
  }

  all[idx] = updated;
  writeInterventions(all);

  // 同步父阶段状态
  syncStageFromIntervention(updated);

  return updated;
}

/**
 * 手动解决介入实例
 */
export function resolveIntervention(interventionId, resolution, payload = {}) {
  const resolvedStateMap = {
    PROCEED: "RESOLVED_PROCEED",
    ACCEPT_AS_IS: "RESOLVED_ACCEPT_AS_IS",
    ROLLBACK: "RESOLVED_ROLLBACK",
  };
  const targetState = resolvedStateMap[resolution];
  if (!targetState) {
    throw new Error(`Invalid resolution: ${resolution}`);
  }

  const all = readInterventions();
  const intervention = all.find((iv) => iv.id === interventionId);
  if (!intervention) {
    throw new Error(`Intervention not found: ${interventionId}`);
  }

  const now = new Date().toISOString();
  const transition = {
    id: generateId("it"),
    interventionId,
    fromState: intervention.currentState,
    toState: targetState,
    event: "MANUAL_RESOLVE",
    timestamp: now,
    actorType: payload?.actorType || "adjuster",
    actorName: payload?.actorName,
    reason: payload?.reason || `Manual resolution: ${resolution}`,
  };

  const updated = {
    ...intervention,
    previousState: intervention.currentState,
    currentState: targetState,
    updatedAt: now,
    resolvedAt: now,
    resolution,
    rollbackTargetStage:
      resolution === "ROLLBACK"
        ? payload?.rollbackTargetStage || "intake"
        : undefined,
    transitions: [...intervention.transitions, transition],
  };

  const idx = all.findIndex((iv) => iv.id === interventionId);
  all[idx] = updated;
  writeInterventions(all);

  syncStageFromIntervention(updated);

  return updated;
}

/**
 * 根据介入实例状态同步父阶段
 *
 * - 活跃状态 → 父阶段 awaiting_human
 * - RESOLVED_PROCEED / RESOLVED_ACCEPT_AS_IS → 父阶段 manual_completed
 * - RESOLVED_ROLLBACK → 目标阶段 processing，下游阶段 pending
 */
function syncStageFromIntervention(intervention) {
  const cases = readData("claim-cases");
  const caseIdx = cases.findIndex((c) => c.id === intervention.claimCaseId);
  if (caseIdx === -1) return;

  const claimCase = { ...cases[caseIdx] };
  const stageOrder = ["intake", "parse", "liability", "assessment"];

  if (isResolved(intervention.currentState)) {
    if (intervention.resolution === "ROLLBACK") {
      // 打回：目标阶段 → processing，下游阶段 → pending
      const targetStage = intervention.rollbackTargetStage || "intake";
      const targetIdx = stageOrder.indexOf(targetStage);
      for (let i = targetIdx; i < stageOrder.length; i++) {
        const key = stageOrder[i];
        const stageField = `${key}Status`;
        if (claimCase[stageField] !== undefined) {
          claimCase[stageField] = i === targetIdx ? "processing" : "pending";
        }
        // 清理阶段介入信息
        if (claimCase[`${key}ActiveInterventionId`]) {
          claimCase[`${key}ActiveInterventionId`] = undefined;
        }
      }
    } else {
      // 正常解决：父阶段 → manual_completed
      const stageField = `${intervention.stageKey}Status`;
      if (claimCase[stageField] !== undefined) {
        claimCase[stageField] = "manual_completed";
      }
      claimCase[`${intervention.stageKey}ActiveInterventionId`] = undefined;
    }

    // 从活跃介入列表中移除
    if (Array.isArray(claimCase.activeInterventions)) {
      claimCase.activeInterventions = claimCase.activeInterventions.filter(
        (id) => id !== intervention.id,
      );
    }
    // 添加到历史
    if (!Array.isArray(claimCase.interventionHistory)) {
      claimCase.interventionHistory = [];
    }
    if (!claimCase.interventionHistory.includes(intervention.id)) {
      claimCase.interventionHistory = [
        ...claimCase.interventionHistory,
        intervention.id,
      ];
    }
  } else if (intervention.currentState !== "IDLE") {
    // 活跃介入：父阶段 → awaiting_human
    const stageField = `${intervention.stageKey}Status`;
    if (claimCase[stageField] !== undefined) {
      claimCase[stageField] = "awaiting_human";
    }
    claimCase[`${intervention.stageKey}ActiveInterventionId`] = intervention.id;

    // 添加到活跃列表
    if (!Array.isArray(claimCase.activeInterventions)) {
      claimCase.activeInterventions = [];
    }
    if (!claimCase.activeInterventions.includes(intervention.id)) {
      claimCase.activeInterventions = [
        ...claimCase.activeInterventions,
        intervention.id,
      ];
    }
  }

  cases[caseIdx] = claimCase;
  writeData("claim-cases", cases);
}

// ============ 查询函数 ============

/**
 * 获取单个介入实例
 */
export function getIntervention(interventionId) {
  const all = readInterventions();
  return all.find((iv) => iv.id === interventionId) || null;
}

/**
 * 按案件ID查询介入实例
 */
export function listByClaimCase(claimCaseId) {
  const all = readInterventions();
  return all.filter((iv) => iv.claimCaseId === claimCaseId);
}

/**
 * 按筛选条件查询介入实例（工作台用）
 */
export function listInterventions(filters = {}) {
  let results = readInterventions();

  if (filters.claimCaseId) {
    results = results.filter((iv) => iv.claimCaseId === filters.claimCaseId);
  }
  if (filters.interventionType) {
    results = results.filter(
      (iv) => iv.interventionType === filters.interventionType,
    );
  }
  if (filters.priority) {
    results = results.filter((iv) => iv.priority === filters.priority);
  }
  if (filters.stageKey) {
    results = results.filter((iv) => iv.stageKey === filters.stageKey);
  }

  // 默认只返回未解决的（活跃的）
  if (filters.resolved === undefined || filters.resolved === false) {
    results = results.filter((iv) => !iv.resolvedAt);
  } else if (filters.resolved === true) {
    results = results.filter((iv) => iv.resolvedAt);
  }
  // filters.resolved === "all" → 不筛选

  // 按优先级和创建时间排序
  const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  results.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9;
    const pb = priorityOrder[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return results;
}

export const interventionStateMachine = {
  createIntervention,
  transitionState,
  resolveIntervention,
  getIntervention,
  listByClaimCase,
  listInterventions,
};
