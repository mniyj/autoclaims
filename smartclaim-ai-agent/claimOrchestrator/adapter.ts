import { IntentType, type IntentEntities } from "../types";
import { ClaimOrchestratorContext } from "./context";
import {
  cancelClaimReport,
  provideClaimInfo,
  selectPolicyForClaim,
  startClaimReport,
  submitClaimReport,
  type ClaimOrchestratorResult,
} from "./handlers";
import type { ClaimOrchestratorTools } from "./tools";

export function isClaimOrchestratorIntent(intent: IntentType): boolean {
  return [
    IntentType.REPORT_NEW_CLAIM,
    IntentType.RESUME_CLAIM_REPORT,
    IntentType.MODIFY_CLAIM_REPORT,
    IntentType.CANCEL_CLAIM,
  ].includes(intent);
}

export async function routeClaimIntent(
  intent: IntentType,
  entities: IntentEntities,
  context: ClaimOrchestratorContext,
  tools: ClaimOrchestratorTools,
): Promise<ClaimOrchestratorResult | null> {
  switch (intent) {
    case IntentType.REPORT_NEW_CLAIM:
    case IntentType.RESUME_CLAIM_REPORT:
      return startClaimReport(context, tools);
    case IntentType.MODIFY_CLAIM_REPORT:
      return provideClaimInfo(context, entities);
    case IntentType.CANCEL_CLAIM:
      return cancelClaimReport(context);
    default:
      return null;
  }
}

export async function continueClaimSubmission(
  context: ClaimOrchestratorContext,
  tools: ClaimOrchestratorTools,
  choiceIndex?: number,
): Promise<ClaimOrchestratorResult> {
  if (context.getState() === "SELECTING_POLICY" && choiceIndex) {
    return selectPolicyForClaim(context, tools, choiceIndex);
  }

  if (context.getState() === "CONFIRMING_SUBMISSION") {
    return submitClaimReport(context, tools);
  }

  return {
    success: false,
    message: "当前没有可继续推进的报案步骤。",
    state: context.getState(),
  };
}

export async function continueClaimFieldCollection(
  context: ClaimOrchestratorContext,
  entities: IntentEntities,
): Promise<ClaimOrchestratorResult> {
  return provideClaimInfo(context, entities);
}
