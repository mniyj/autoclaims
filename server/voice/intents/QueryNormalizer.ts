import type {
  Intent,
  IntentType,
  NormalizedQuery,
  VoiceClaimInfo,
  VoicePolicyInfo,
} from "./IntentTypes.js";
import { VoiceSessionContext } from "../state/VoiceSessionContext.js";

function isQueryIntent(type: IntentType): boolean {
  return [
    "query_progress",
    "query_materials",
    "query_missing_materials",
    "query_coverage",
    "query_settlement",
  ].includes(type);
}

function detectSubFocus(intent: Intent): string | undefined {
  const text = String(intent.originalText || "");

  if (/门诊|急诊/.test(text)) return "outpatient";
  if (/住院|住院费|住院医疗/.test(text)) return "inpatient";
  if (/交强险|交强/.test(text)) return "compulsory";
  if (/三者险|第三者|三责险/.test(text)) return "third_party";
  if (/车损|车辆损失|修车/.test(text)) return "vehicle_damage";
  if (/驾乘|车上人员|司机|乘客/.test(text)) return "driver_passenger";
  if (/材料|资料/.test(text)) return "materials";

  return undefined;
}

function getExplicitClaimIdentifier(intent: Intent): string | null {
  const entities = intent.entities || {};
  return (
    entities.claimId ||
    entities.reportNumber ||
    entities.claim_id ||
    entities.report_number ||
    null
  );
}

function getExplicitProductCode(intent: Intent): string | null {
  const entities = intent.entities || {};
  return entities.productCode || entities.product_code || null;
}

function getExplicitClaimType(intent: Intent): string | null {
  const entities = intent.entities || {};
  return entities.claimType || entities.claim_type || null;
}

function resolveClaimByIdentifier(
  claims: VoiceClaimInfo[],
  identifier: string | null,
): VoiceClaimInfo | null {
  if (!identifier) return null;
  return (
    claims.find(
      (claim) =>
        claim.claimId === identifier ||
        claim.reportNumber === identifier ||
        claim.claimId?.includes(identifier) ||
        claim.reportNumber?.includes(identifier),
    ) || null
  );
}

function resolvePolicyByProductCode(
  policies: VoicePolicyInfo[],
  productCode: string | null,
): VoicePolicyInfo | null {
  if (!productCode) return null;
  return policies.find((policy) => policy.productCode === productCode) || null;
}

function normalizeClaimBoundQuery(options: {
  focus: NormalizedQuery["focus"];
  selectedClaim: VoiceClaimInfo | null;
  availableClaims: VoiceClaimInfo[];
  explicitClaimId: string | null;
  explicitProductCode: string | null;
  explicitClaimType: string | null;
}): NormalizedQuery | null {
  const {
    focus,
    selectedClaim,
    availableClaims,
    explicitClaimId,
    explicitProductCode,
    explicitClaimType,
  } = options;
  const explicitClaim = resolveClaimByIdentifier(availableClaims, explicitClaimId);

  if (explicitClaim) {
    return {
      focus,
      scope: "selected_claim",
      claimId: explicitClaim.claimId,
      productCode: explicitClaim.productCode,
      claimType: explicitClaim.claimType,
      rewriteReason: "使用用户明确提到的案件标识绑定查询对象",
    };
  }

  if (selectedClaim) {
    return {
      focus,
      scope: "selected_claim",
      claimId: selectedClaim.claimId,
      productCode: explicitProductCode || selectedClaim.productCode,
      claimType: explicitClaimType || selectedClaim.claimType,
      rewriteReason: "使用当前已选案件作为查询对象",
    };
  }

  if (availableClaims.length === 1) {
    const onlyClaim = availableClaims[0];
    return {
      focus,
      scope: "single_claim",
      claimId: onlyClaim.claimId,
      productCode: explicitProductCode || onlyClaim.productCode,
      claimType: explicitClaimType || onlyClaim.claimType,
      rewriteReason: "当前只有一个可用案件，自动绑定该案件",
    };
  }

  if (availableClaims.length > 1) {
    return {
      focus,
      scope: "ambiguous",
      needsClaimSelection: true,
      productCode: explicitProductCode || undefined,
      claimType: explicitClaimType || undefined,
      rewriteReason: "当前存在多个可用案件，需要用户先确认查询对象",
    };
  }

  return null;
}

function normalizePolicyBoundQuery(options: {
  focus: NormalizedQuery["focus"];
  selectedPolicy: VoicePolicyInfo | null;
  selectedClaim: VoiceClaimInfo | null;
  availablePolicies: VoicePolicyInfo[];
  explicitProductCode: string | null;
  explicitClaimType: string | null;
}): NormalizedQuery | null {
  const {
    focus,
    selectedPolicy,
    selectedClaim,
    availablePolicies,
    explicitProductCode,
    explicitClaimType,
  } = options;
  const explicitPolicy = resolvePolicyByProductCode(
    availablePolicies,
    explicitProductCode,
  );

  if (explicitPolicy) {
    return {
      focus,
      scope: "selected_policy",
      productCode: explicitPolicy.productCode,
      claimType: explicitClaimType || explicitPolicy.productName,
      rewriteReason: "使用用户明确提到的产品代码绑定保单对象",
    };
  }

  if (selectedPolicy) {
    return {
      focus,
      scope: "selected_policy",
      productCode: selectedPolicy.productCode,
      claimType: explicitClaimType || selectedPolicy.productName,
      rewriteReason: "使用当前已选保单作为查询对象",
    };
  }

  if (availablePolicies.length === 1) {
    const onlyPolicy = availablePolicies[0];
    return {
      focus,
      scope: "single_policy",
      productCode: onlyPolicy.productCode,
      claimType: explicitClaimType || onlyPolicy.productName,
      rewriteReason: "当前只有一张可用保单，自动绑定该保单",
    };
  }

  if (selectedClaim?.productCode) {
    return {
      focus,
      scope: "selected_claim",
      claimId: selectedClaim.claimId,
      productCode: selectedClaim.productCode,
      claimType: explicitClaimType || selectedClaim.claimType,
      rewriteReason: "从当前已选案件回推产品信息作为查询对象",
    };
  }

  if (availablePolicies.length > 1) {
    return {
      focus,
      scope: "ambiguous",
      needsPolicySelection: true,
      claimType: explicitClaimType || undefined,
      rewriteReason: "当前存在多张可用保单，需要用户先确认查询对象",
    };
  }

  return explicitProductCode || explicitClaimType
    ? {
        focus,
        scope: "global",
        productCode: explicitProductCode || undefined,
        claimType: explicitClaimType || undefined,
        rewriteReason: "缺少具体保单对象，保留用户显式提供的产品/险种口径",
      }
    : null;
}

function normalizeSettlementQuery(options: {
  selectedClaim: VoiceClaimInfo | null;
  selectedPolicy: VoicePolicyInfo | null;
  availableClaims: VoiceClaimInfo[];
  availablePolicies: VoicePolicyInfo[];
  explicitClaimId: string | null;
  explicitProductCode: string | null;
  explicitClaimType: string | null;
}): NormalizedQuery | null {
  const claimBound = normalizeClaimBoundQuery({
    focus: "settlement",
    selectedClaim: options.selectedClaim,
    availableClaims: options.availableClaims,
    explicitClaimId: options.explicitClaimId,
    explicitProductCode: options.explicitProductCode,
    explicitClaimType: options.explicitClaimType,
  });

  if (claimBound?.claimId || claimBound?.needsClaimSelection) {
    return claimBound;
  }

  return normalizePolicyBoundQuery({
    focus: "settlement",
    selectedPolicy: options.selectedPolicy,
    selectedClaim: options.selectedClaim,
    availablePolicies: options.availablePolicies,
    explicitProductCode: options.explicitProductCode,
    explicitClaimType: options.explicitClaimType,
  });
}

export function normalizeQueryIntent(
  intent: Intent,
  context: VoiceSessionContext,
): Intent {
  if (!isQueryIntent(intent.type)) {
    return intent;
  }

  const selectedClaim = context.getSelectedClaim();
  const selectedPolicy = context.getSelectedPolicy();
  const availableClaims = context.getAvailableClaims();
  const availablePolicies = context.getAvailablePolicies();
  const explicitClaimId = getExplicitClaimIdentifier(intent);
  const explicitProductCode = getExplicitProductCode(intent);
  const explicitClaimType = getExplicitClaimType(intent);
  const subFocus = detectSubFocus(intent);

  let normalizedQuery: NormalizedQuery | null = null;

  switch (intent.type) {
    case "query_progress":
      normalizedQuery = normalizeClaimBoundQuery({
        focus: "progress",
        selectedClaim,
        availableClaims,
        explicitClaimId,
        explicitProductCode,
        explicitClaimType,
      });
      break;
    case "query_missing_materials":
      normalizedQuery = normalizeClaimBoundQuery({
        focus: "missing_materials",
        selectedClaim,
        availableClaims,
        explicitClaimId,
        explicitProductCode,
        explicitClaimType,
      });
      break;
    case "query_materials":
      normalizedQuery = normalizePolicyBoundQuery({
        focus: "materials",
        selectedPolicy,
        selectedClaim,
        availablePolicies,
        explicitProductCode,
        explicitClaimType,
      });
      break;
    case "query_coverage":
      normalizedQuery = normalizePolicyBoundQuery({
        focus: "coverage",
        selectedPolicy,
        selectedClaim,
        availablePolicies,
        explicitProductCode,
        explicitClaimType,
      });
      break;
    case "query_settlement":
      normalizedQuery = normalizeSettlementQuery({
        selectedClaim,
        selectedPolicy,
        availableClaims,
        availablePolicies,
        explicitClaimId,
        explicitProductCode,
        explicitClaimType,
      });
      break;
    default:
      break;
  }

  return {
    ...intent,
    entities: {
      ...(intent.entities || {}),
      ...(normalizedQuery
        ? { normalizedQuery: { ...normalizedQuery, ...(subFocus ? { subFocus } : {}) } }
        : {}),
    },
  };
}
