import express, { Request, Response } from 'express';

type DiagnosisWithDate = { code: string; diagnosisDate?: string };
type Policy = { id: string; effectiveDate?: string; coveredCodes?: string[] };
type ICD10CodeInfo = { code: string; description?: string; isChronic?: boolean };
type CoverageResult = {
  code: string;
  found?: boolean;
  info?: ICD10CodeInfo | null;
  covered?: boolean;
  congenitalExcluded?: boolean;
  waitingMonths?: number;
  malignantRestricted?: boolean;
  preExisting?: boolean;
  isChronic?: boolean;
  reimbursementRate?: number;
  estimatedReimbursement?: number;
};

const router = express.Router();

// Lightweight claim lookup: no external dependencies required
async function mockPolicyFromClaimCase(claimCaseId?: string): Promise<Policy | null> {
  if (!claimCaseId) return null;
  // Simple heuristic: policy id is prefix before a colon if provided
  const policyId = claimCaseId.includes(':') ? claimCaseId.split(':')[0] : claimCaseId;
  return {
    id: policyId,
    effectiveDate: new Date().toISOString(),
    coveredCodes: [],
  };
}

export async function validateClaimDiagnoses(claimCaseId: string, diagnosisCodes: string[]) {
  const policy = await mockPolicyFromClaimCase(claimCaseId);
  const results: CoverageResult[] = diagnosisCodes.map((code) => {
    const isValid = typeof code === 'string' && code.trim().length > 0;
    const info: ICD10CodeInfo | null = isValid ? { code, description: 'Mock ICD-10' } : null;
    const covered = policy?.coveredCodes?.includes(code) ?? false;
    return {
      code,
      found: isValid,
      info,
      covered,
      congenitalExcluded: false,
      waitingMonths: 0,
      malignantRestricted: false,
      preExisting: false,
      isChronic: info?.isChronic ?? false,
      reimbursementRate: 0.5,
      estimatedReimbursement: 500,
    } as CoverageResult;
  });

  const allCodesExist = results.every((r) => r.found);
  const invalidCodes = diagnosisCodes.filter((_, idx) => !results[idx]?.found);
  return {
    claimCaseId,
    diagnosisCodes,
    results,
    allCodesExist,
    invalidCodes,
  };
}

async function computeCoverageForCode(code: string, policyId?: string) {
  // Simple mock coverage
  return {
    code,
    policyId,
    covered: Boolean(policyId),
    congenitalExcluded: false,
    waitingMonths: 0,
    malignantRestricted: false,
    reimbursementRate: 0.5,
    estimatedReimbursement: 500,
  };
}

router.post('/validate-diagnoses', async (req: Request, res: Response) => {
  const { claimCaseId, diagnosisCodes } = req.body as { claimCaseId?: string; diagnosisCodes?: string[] };
  if (!claimCaseId || !Array.isArray(diagnosisCodes)) {
    return res.status(400).json({ error: 'Missing claimCaseId or diagnosisCodes' });
  }
  try {
    const result = await validateClaimDiagnoses(claimCaseId, diagnosisCodes);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal error during ICD-10 validation', detail: (err as any)?.message ?? '' });
  }
});

router.get('/disease-coverage/:code/:policyId', async (req: Request, res: Response) => {
  const { code, policyId } = req.params as { code: string; policyId: string };
  try {
    const coverage = await computeCoverageForCode(code, policyId);
    res.json(coverage);
  } catch (err) {
    res.status(500).json({ error: 'Internal error during coverage calculation', detail: (err as any)?.message ?? '' });
  }
});

export default router;
