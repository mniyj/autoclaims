export interface ClaimLike {
  id: string;
  reportNumber?: string;
  type?: string;
  claimType?: string;
  incidentType?: string;
  productCode?: string;
}

export type ClaimSelectionResult<T extends ClaimLike> =
  | { kind: "missing" }
  | { kind: "resolved"; claim: T }
  | { kind: "selection"; claims: T[] };

export function normalizeClaimType(claimType?: string): string {
  if (!claimType) return "意外险";
  if (claimType.includes("医疗")) return "医疗险";
  if (claimType.includes("重疾") || claimType.includes("疾病")) return "重疾险";
  if (claimType.includes("车")) return "车险";
  if (claimType.includes("意外")) return "意外险";
  return claimType;
}

export function resolveClaimSelection<T extends ClaimLike>(
  claims: T[],
  claimId?: string,
): ClaimSelectionResult<T> {
  if (claims.length === 0) {
    return { kind: "missing" };
  }

  if (claimId) {
    const matched = claims.find((claim) => {
      return (
        claim.id === claimId ||
        claim.id.includes(claimId) ||
        claim.reportNumber === claimId ||
        Boolean(claim.reportNumber && claim.reportNumber.includes(claimId))
      );
    });

    if (matched) {
      return { kind: "resolved", claim: matched };
    }
  }

  if (claims.length === 1) {
    return { kind: "resolved", claim: claims[0] };
  }

  return { kind: "selection", claims };
}

export function resolveClaimTypeAndProductCode<T extends ClaimLike>(options: {
  explicitClaimType?: string;
  explicitProductCode?: string;
  claim?: T;
  fallbackClaimType?: string;
}): { claimType: string; productCode?: string } {
  const rawClaimType =
    options.explicitClaimType ||
    options.claim?.type ||
    options.claim?.claimType ||
    options.claim?.incidentType ||
    options.fallbackClaimType;

  return {
    claimType: normalizeClaimType(rawClaimType),
    productCode: options.explicitProductCode || options.claim?.productCode,
  };
}
