
export interface PensionGapParams {
  currentAge: number;
  monthlyIncome: number;
  retirementAge?: number; // Default 60
  lifeExpectancy?: number; // Default 85
  idealReplacementRate?: number; // Default 0.7 (70%)
  socialSecurityReplacementRate?: number; // Default 0.3 (30%)
}

export interface PensionGapResult {
  idealMonthlyPension: number;
  estimatedSocialSecurity: number;
  monthlyGap: number;
  totalGap: number;
}

/**
 * Calculates the pension gap based on income and age parameters.
 * 
 * Logic:
 * 1. Ideal Monthly Pension = Monthly Income * Ideal Replacement Rate
 * 2. Estimated Social Security = Monthly Income * Social Security Rate
 * 3. Monthly Gap = Ideal Monthly Pension - Estimated Social Security
 * 4. Total Gap = Monthly Gap * 12 * (Life Expectancy - Retirement Age)
 */
export const calculatePensionGap = (params: PensionGapParams): PensionGapResult => {
  const {
    currentAge,
    monthlyIncome,
    retirementAge = 60,
    lifeExpectancy = 85,
    idealReplacementRate = 0.7,
    socialSecurityReplacementRate = 0.3
  } = params;

  // Basic validation
  if (monthlyIncome <= 0) {
    return {
      idealMonthlyPension: 0,
      estimatedSocialSecurity: 0,
      monthlyGap: 0,
      totalGap: 0
    };
  }

  // If already retired, calculation might differ, but assuming planning phase for now
  const yearsInRetirement = Math.max(0, lifeExpectancy - retirementAge);

  const idealMonthlyPension = monthlyIncome * idealReplacementRate;
  const estimatedSocialSecurity = monthlyIncome * socialSecurityReplacementRate;
  
  const monthlyGap = Math.max(0, idealMonthlyPension - estimatedSocialSecurity);
  const totalGap = monthlyGap * 12 * yearsInRetirement;

  return {
    idealMonthlyPension,
    estimatedSocialSecurity,
    monthlyGap,
    totalGap
  };
};

/**
 * Formats a large number into "Wan" (Ten Thousand) string
 */
export const formatCurrencyWan = (amount: number): string => {
  if (amount === 0) return '-';
  return `${(amount / 10000).toFixed(0)}万`;
};
