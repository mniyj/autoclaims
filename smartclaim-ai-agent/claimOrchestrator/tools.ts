import type { IntakeConfig, Policy, ToolResponse } from "../types";
import type { ClaimantIdentity } from "./context";

export interface ClaimSubmissionPayload {
  policyNumber: string;
  productCode?: string;
  fieldData: Record<string, unknown>;
}

export interface ClaimOrchestratorTools {
  listUserPolicies: (claimant: ClaimantIdentity) => Promise<Policy[]>;
  getProductIntakeConfig: (productCode: string) => Promise<IntakeConfig | null>;
  submitClaim: (payload: ClaimSubmissionPayload) => Promise<ToolResponse>;
}

type BackendPolicy = {
  id?: string;
  policyNumber?: string;
  productName?: string;
  productCode?: string;
  insureds?: Array<{ name?: string }>;
  policyholder?: { name?: string };
  effectiveDate?: string;
  issueDate?: string;
  expiryDate?: string;
};

function mapBackendPolicy(policy: BackendPolicy): Policy | null {
  const id = policy.policyNumber || policy.id || "";
  if (!id) {
    return null;
  }

  return {
    id,
    policyholderName: policy.policyholder?.name || "",
    insuredName: policy.insureds?.[0]?.name || policy.policyholder?.name || "",
    type: policy.productName || policy.productCode || "未知险种",
    validFrom: policy.effectiveDate || policy.issueDate || "",
    validUntil: policy.expiryDate || "",
    productCode: policy.productCode || "",
  };
}

export function createClaimOrchestratorTools(): ClaimOrchestratorTools {
  return {
    async listUserPolicies(claimant) {
      const response = await fetch("/api/policies");
      if (!response.ok) {
        throw new Error("Failed to load policies");
      }

      const rawPolicies = await response.json();
      const policies = (Array.isArray(rawPolicies) ? rawPolicies : [])
        .map(mapBackendPolicy)
        .filter((policy): policy is Policy => Boolean(policy));

      if (!claimant.username) {
        return policies;
      }

      const matchedPolicies = policies.filter((policy) => {
        return (
          policy.policyholderName === claimant.username ||
          policy.insuredName === claimant.username
        );
      });

      return matchedPolicies.length > 0 ? matchedPolicies : policies;
    },
    async getProductIntakeConfig(productCode) {
      const response = await fetch(`/api/products/${encodeURIComponent(productCode)}`);
      if (!response.ok) {
        return null;
      }

      const product = await response.json();
      return (product?.intakeConfig as IntakeConfig | null) || null;
    },
    async submitClaim(payload) {
      const newClaimId = `CLM${Date.now().toString().slice(-6)}`;
      const response = await fetch("/api/claim-cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: newClaimId,
          reportNumber: newClaimId,
          policyNumber: payload.policyNumber,
          productCode: payload.productCode,
          intakeFormData: payload.fieldData,
          accidentTime: payload.fieldData.accident_date || payload.fieldData.accidentTime || "",
          accidentLocation:
            payload.fieldData.accident_location || payload.fieldData.accidentLocation || "",
          accidentReason:
            payload.fieldData.accident_reason || payload.fieldData.accidentReason || "",
          claimAmount: payload.fieldData.claim_amount || payload.fieldData.claimAmount || 0,
          status: "已报案",
          source: "smartclaim-voice-orchestrator",
          reportTime: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: "报案提交失败，请稍后重试。",
        };
      }

      return {
        success: true,
        data: {
          claimId: newClaimId,
          reportNumber: newClaimId,
          payload,
        },
        message: `报案成功！案件编号: ${newClaimId}`,
      };
    },
  };
}
