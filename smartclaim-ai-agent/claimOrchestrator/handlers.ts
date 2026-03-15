import type { IntentEntities, ToolResponse } from "../types";
import { ClaimOrchestratorContext } from "./context";
import type {
  ClaimOrchestratorTools,
  ClaimSubmissionPayload,
} from "./tools";

export interface ClaimOrchestratorResult {
  success: boolean;
  message: string;
  state: string;
  data?: Record<string, unknown>;
}

function formatPolicyList(policyCount: number): string {
  return policyCount > 0
    ? `为您找到${policyCount}张可选保单，请选择要报案的保单。`
    : "暂未查询到可用于报案的保单。";
}

function getFieldPrompt(fieldId: string): string {
  return `请补充${fieldId}。`;
}

export async function startClaimReport(
  context: ClaimOrchestratorContext,
  tools: ClaimOrchestratorTools,
): Promise<ClaimOrchestratorResult> {
  const policies = await tools.listUserPolicies(context.getClaimant());
  context.setAvailablePolicies(policies);
  context.setState("SELECTING_POLICY");

  const message = formatPolicyList(policies.length);
  context.setLastResponse(message);

  return {
    success: policies.length > 0,
    message,
    state: context.getState(),
    data: { policies },
  };
}

export async function selectPolicyForClaim(
  context: ClaimOrchestratorContext,
  tools: ClaimOrchestratorTools,
  index: number,
): Promise<ClaimOrchestratorResult> {
  const policies = context.getAvailablePolicies();
  const selected = policies[index - 1];

  if (!selected) {
    return {
      success: false,
      message: `抱歉，当前没有第${index}张保单可选。`,
      state: context.getState(),
    };
  }

  context.setSelectedPolicy(selected);
  context.setState("COLLECTING_FIELDS");

  if (selected.productCode) {
    const intakeConfig = await tools.getProductIntakeConfig(selected.productCode);
    context.setIntakeConfig(intakeConfig);
  }

  const nextField = context.getNextRequiredField();
  const message = nextField
    ? `已为您选择保单 ${selected.id}。请先补充：${nextField.label || nextField.field_id}`
    : `已为您选择保单 ${selected.id}，请继续描述报案信息。`;
  context.setLastResponse(message);

  return {
    success: true,
    message,
    state: context.getState(),
    data: { selectedPolicy: selected },
  };
}

export function provideClaimInfo(
  context: ClaimOrchestratorContext,
  entities: IntentEntities,
): ClaimOrchestratorResult {
  const nextFieldId = context.getPendingFieldId();
  const normalizedEntities = { ...entities };

  if (
    Object.keys(normalizedEntities).length === 0 &&
    nextFieldId &&
    typeof entities.rawValue === "string"
  ) {
    normalizedEntities[nextFieldId] = entities.rawValue;
  }

  Object.entries(normalizedEntities).forEach(([fieldId, value]) => {
    if (value !== undefined && value !== null) {
      context.updateField(fieldId, value);
    }
  });

  const nextField = context.getNextRequiredField();
  const message = nextField
    ? `已记录信息。${getFieldPrompt(nextField.label || nextField.field_id)}`
    : "报案信息已收集完成，请确认提交。";

  context.setState(nextField ? "COLLECTING_FIELDS" : "CONFIRMING_SUBMISSION");
  context.setLastResponse(message);

  return {
    success: true,
    message,
    state: context.getState(),
    data: { collectedFields: context.getCollectedFields() },
  };
}

export function cancelClaimReport(
  context: ClaimOrchestratorContext,
): ClaimOrchestratorResult {
  context.reset();
  context.setState("ENDED");
  const message = "好的，已取消本次报案。";
  context.setLastResponse(message);

  return {
    success: true,
    message,
    state: context.getState(),
  };
}

export async function submitClaimReport(
  context: ClaimOrchestratorContext,
  tools: ClaimOrchestratorTools,
): Promise<ClaimOrchestratorResult> {
  const selectedPolicy = context.getSelectedPolicy();
  if (!selectedPolicy) {
    return {
      success: false,
      message: "请先选择保单后再提交报案。",
      state: context.getState(),
    };
  }

  const payload: ClaimSubmissionPayload = {
    policyNumber: selectedPolicy.id,
    productCode: selectedPolicy.productCode,
    fieldData: context.getCollectedFields(),
  };

  context.setState("SUBMITTING");
  const result: ToolResponse = await tools.submitClaim(payload);
  context.setState(result.success ? "ENDED" : "ERROR");
  context.setLastResponse(result.message);

  return {
    success: result.success,
    message: result.message,
    state: context.getState(),
    data: { toolResponse: result },
  };
}
