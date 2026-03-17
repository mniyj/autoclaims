import express from 'express';

// ICD-10 underwriting integration for risk assessment

export type Severity = 'minor'|'moderate'|'severe'|'critical';

export type DiseaseInput = {
  code: string;
  name?: string;
  severity?: Severity;
  isChronic?: boolean;
  isCongenital?: boolean;
};

export type ApplicantInfo = {
  age?: number;
  gender?: string;
  [key: string]: any;
};

export type UnderwritingResult = {
  applicationId: string;
  maxSeverity: Severity;
  riskLevel: Severity;
  decision: 'decline' | 'approve';
  premiumModifier?: string;
  exclusions: string[];
  examRequired: boolean;
  examRecommendation?: string;
  perDisease?: DiseaseInput[];
  timestamp: string;
};

type ICDEntry = {
  code: string;
  name: string;
  typicalSeverity: Severity;
  isChronic?: boolean;
  isCongenital?: boolean;
};

// Minimal in-memory ICD-10 reference for disease assessment endpoint
const ICD10_REFERENCE: ICDEntry[] = [
  { code: 'I10', name: 'Essential (primary) hypertension', typicalSeverity: 'moderate', isChronic: true },
  { code: 'E11', name: 'Type 2 diabetes mellitus', typicalSeverity: 'moderate', isChronic: true },
  { code: 'C50', name: 'Malignant neoplasm of breast', typicalSeverity: 'severe' },
  { code: 'J45', name: 'Asthma', typicalSeverity: 'minor', isChronic: true },
  { code: 'Q890', name: 'Congenital malformations of heart', typicalSeverity: 'critical', isCongenital: true },
];

function severityRank(s: Severity): number {
  switch (s) {
    case 'minor': return 0;
    case 'moderate': return 1;
    case 'severe': return 2;
    case 'critical': return 3;
  }
}

function maxSeverityFromDiseases(diseases: DiseaseInput[]): Severity {
  let max: Severity = 'minor';
  for (const d of diseases) {
    const sev = d.severity ?? 'minor';
    if (severityRank(sev) > severityRank(max)) max = sev;
  }
  return max;
}

function computePremiumModifier(maxSeverity: Severity): string | undefined {
  switch (maxSeverity) {
    case 'severe': return '+50%';
    case 'moderate': return '+25%';
    case 'minor': return '0%';
    case 'critical': return undefined;
  }
}

export function assessUnderwritingRisk(
  applicationId: string,
  disclosedDiseases: DiseaseInput[],
  applicantInfo: ApplicantInfo
): UnderwritingResult {
  const diseases = disclosedDiseases ?? [];
  const maxSeverity = maxSeverityFromDiseases(diseases);
  const riskLevel = maxSeverity;

  // Decision logic: critical -> decline, others -> approve
  const decision = riskLevel === 'critical' ? 'decline' : 'approve';

  // Premium modifier based on risk level
  const premiumModifier = riskLevel === 'critical' ? undefined : computePremiumModifier(riskLevel);

  // Exclusions for chronic / congenital diseases
  const exclusions: string[] = [];
  for (const d of diseases) {
    if (d.isChronic) {
      exclusions.push(`除外相关疾病: ${d.code}${d.name ? ' (' + d.name + ')' : ''}`);
    }
    if (d.isCongenital) {
      exclusions.push(`除外先天性疾病: ${d.code}${d.name ? ' (' + d.name + ')' : ''}`);
    }
  }

  // Medical exam recommendations
  const moderateCount = diseases.filter((d) => (d.severity ?? 'minor') === 'moderate').length;
  const examRequired = maxSeverity === 'critical' || maxSeverity === 'severe';
  const examRecommendation = examRequired
    ? '需要体检'
    : moderateCount >= 2
      ? '建议体检'
      : undefined;

  const timestamp = new Date().toISOString();
  return {
    applicationId,
    maxSeverity,
    riskLevel,
    decision,
    premiumModifier,
    exclusions,
    examRequired,
    examRecommendation,
    perDisease: diseases,
    timestamp,
  };
}

export function getDiseaseAssessment(code: string) {
  const entry = ICD10_REFERENCE.find((e) => e.code.toLowerCase() === code.toLowerCase());
  if (entry) {
    return {
      code: entry.code,
      name: entry.name,
      typicalSeverity: entry.typicalSeverity,
      isChronic: !!entry.isChronic,
      isCongenital: !!entry.isCongenital,
    };
  }
  // Fallback for unknown codes
  return {
    code,
    name: 'Unknown disease',
    typicalSeverity: 'minor',
    isChronic: false,
    isCongenital: false,
  };
}

const router = express.Router();

// POST /api/underwriting/assess-risk
router.post('/api/underwriting/assess-risk', (req, res) => {
  const { applicationId, disclosedDiseases, applicantInfo } = req.body;
  if (!applicationId) {
    res.status(400).json({ error: 'applicationId is required' });
    return;
  }
  const result = assessUnderwritingRisk(
    applicationId,
    Array.isArray(disclosedDiseases) ? disclosedDiseases : [],
    applicantInfo || {}
  );
  res.json(result);
});

// GET /api/underwriting/disease-assessment/:code
router.get('/api/underwriting/disease-assessment/:code', (req, res) => {
  const code = req.params.code;
  res.json(getDiseaseAssessment(code));
});

export default router;
