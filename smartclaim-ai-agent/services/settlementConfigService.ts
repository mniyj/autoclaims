/**
 * 赔付计算服务 - 基于配置系统的赔付计算服务
 * 
 * 支持两种方式：
 * 1. 调用规则引擎进行精确计算（需要 claimCaseId + productCode）
 * 2. 使用计算公式进行估算（基于 claimType + 参数）
 */

import { configService, FormulaConfig, FormulaVariable } from './configService';

// 赔付计算结果
export interface SettlementResult {
  finalAmount: number;
  steps: CalculationStep[];
  breakdown?: Array<{
    category: string;
    amount: number;
    coveredAmount: number;
    deductible?: number;
    ratio?: number;
  }>;
  explanation: string;
  isEstimate: boolean;
  formulaName?: string;
}

// 计算步骤
export interface CalculationStep {
  name: string;
  expression: string;
  input: Record<string, number>;
  output: number;
  outputName: string;
}

// 估算参数
export interface EstimateParams {
  approvedExpenses?: number;      // 核准费用
  disabilityGrade?: number;       // 伤残等级 (1-10)
  sumInsured?: number;            // 保额
  hospitalDays?: number;          // 住院天数
  dailyAllowance?: number;        // 日津贴
  deductible?: number;            // 免赔额
  reimbursementRatio?: number;    // 赔付比例
  priorBenefit?: number;          // 已赔付金额
  [key: string]: number | undefined;
}

// 理赔案件（简化）
export interface Claim {
  id: string;
  productCode?: string;
  type: string;
  approvedExpenses?: number;
  disabilityGrade?: string;
  hospitalDays?: number;
  isDeath?: boolean;
  amount?: number;
}

// 险种类型到公式名称的映射
const CLAIM_TYPE_TO_FORMULA: Record<string, string | ((claim: Claim) => string)> = {
  '医疗险': 'HEALTH_MEDICAL',
  '住院医疗': 'HEALTH_MEDICAL',
  '门诊医疗': 'HEALTH_MEDICAL_OUTPATIENT',
  '重疾险': 'CRITICAL_ILLNESS',
  '意外险': (claim: Claim) => {
    if (claim.disabilityGrade) return 'ACC_DISABILITY';
    if (claim.isDeath) return 'ACC_DEATH';
    return 'ACC_MEDICAL';
  },
  '车险': 'AUTO_INSURANCE',
  '定期寿险': 'TERM_LIFE_DEATH',
  '终身寿险': 'WHOLE_LIFE_DEATH'
};

/**
 * 赔付计算服务类
 */
export class SettlementConfigService {
  constructor(private configSvc: typeof configService) {}

  /**
   * 调用规则引擎进行精确赔付计算
   * 
   * @param claimCaseId 理赔案件 ID
   * @param productCode 产品代码
   * @param ocrData OCR 数据（可选）
   */
  async calculateSettlement(
    claimCaseId: string,
    productCode: string,
    ocrData?: Record<string, any>
  ): Promise<SettlementResult | null> {
    try {
      // 调用后端规则引擎 API
      const response = await fetch('/api/claims/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          claimCaseId,
          productCode,
          ocrData: ocrData || {}
        })
      });

      if (!response.ok) {
        console.warn('[SettlementConfigService] Rule engine API failed:', response.status);
        return null;
      }

      const result = await response.json();

      return {
        finalAmount: result.totalAmount || 0,
        steps: result.calculationSteps || [],
        breakdown: result.itemBreakdown || [],
        explanation: result.explanation || `根据产品条款计算，赔付金额为 ${result.totalAmount?.toLocaleString()} 元`,
        isEstimate: false
      };
    } catch (error) {
      console.error('[SettlementConfigService] Calculate settlement failed:', error);
      return null;
    }
  }

  /**
   * 使用公式配置进行估算
   * 
   * @param claimType 险种类型
   * @param params 估算参数
   */
  async estimateSettlement(
    claimType: string,
    params: EstimateParams
  ): Promise<SettlementResult | null> {
    try {
      // 1. 确定使用的公式
      const formulaName = this.mapClaimTypeToFormula(claimType, params);
      if (!formulaName) {
        console.warn(`[SettlementConfigService] No formula for claim type: ${claimType}`);
        return null;
      }

      // 2. 加载公式配置
      const formulas = await this.configSvc.loadFormulas();
      const formula = formulas[formulaName];

      if (!formula) {
        console.warn(`[SettlementConfigService] Formula not found: ${formulaName}`);
        return null;
      }

      // 3. 提取变量值
      const variables = this.extractVariables(formula.variables, params);

      // 4. 应用查找表（如果有）
      const variablesWithLookup = this.applyLookupTables(formula, variables);

      // 5. 执行公式计算
      const steps = this.executeFormulaSteps(formula, variablesWithLookup);

      // 6. 获取最终结果
      const finalAmount = steps[steps.length - 1]?.output || 0;

      // 7. 生成说明
      const explanation = this.generateExplanation(formula, steps, finalAmount, claimType);

      return {
        finalAmount,
        steps,
        explanation,
        isEstimate: true,
        formulaName
      };
    } catch (error) {
      console.error('[SettlementConfigService] Estimate settlement failed:', error);
      return null;
    }
  }

  /**
   * 快速估算（简化接口）
   */
  async quickEstimate(
    claimType: string,
    amount: number
  ): Promise<number> {
    const result = await this.estimateSettlement(claimType, {
      approvedExpenses: amount,
      sumInsured: amount * 2 // 假设保额为费用的2倍
    });
    return result?.finalAmount || amount * 0.8; // 默认返回80%
  }

  /**
   * 生成赔付计算明细说明
   */
  generateExplanation(
    formula: FormulaConfig,
    steps: CalculationStep[],
    finalAmount: number,
    claimType: string
  ): string {
    const lines: string[] = [
      `📊 **${formula.description}**`,
      '',
      '**计算步骤**：',
      ...steps.map(step => 
        `• ${step.name}: ${step.expression} = ${step.output.toLocaleString()}元`
      ),
      '',
      `💰 **预估赔付金额**: ${finalAmount.toLocaleString()}元`,
      '',
      '💡 **说明**：',
      `此金额基于${claimType}产品条款的公式计算，仅为估算值。`,
      '最终赔付金额需经审核后确定，可能与估算值有所差异。'
    ];

    return lines.join('\\n');
  }

  /**
   * 映射险种类型到公式名称
   */
  private mapClaimTypeToFormula(
    claimType: string,
    params: EstimateParams
  ): string | null {
    const formula = CLAIM_TYPE_TO_FORMULA[claimType];
    
    if (!formula) {
      // 尝试标准化匹配
      const normalizedType = this.normalizeClaimType(claimType);
      const normalizedFormula = CLAIM_TYPE_TO_FORMULA[normalizedType];
      
      if (typeof normalizedFormula === 'function') {
        // 创建模拟 claim 对象
        const mockClaim: Claim = {
          id: 'estimate',
          type: claimType,
          disabilityGrade: params.disabilityGrade?.toString(),
          isDeath: false
        };
        return normalizedFormula(mockClaim);
      }
      
      return normalizedFormula || null;
    }

    if (typeof formula === 'function') {
      const mockClaim: Claim = {
        id: 'estimate',
        type: claimType,
        disabilityGrade: params.disabilityGrade?.toString(),
        isDeath: false
      };
      return formula(mockClaim);
    }

    return formula;
  }

  /**
   * 标准化险种类型
   */
  private normalizeClaimType(type: string): string {
    const aliases: Record<string, string> = {
      '医疗理赔': '医疗险',
      '住院理赔': '住院医疗',
      '门诊理赔': '门诊医疗',
      '重疾理赔': '重疾险',
      '重大疾病': '重疾险',
      '意外理赔': '意外险',
      '意外伤害理赔': '意外险',
      '车辆理赔': '车险',
      '汽车理赔': '车险',
      '身故理赔': '定期寿险',
      '寿险理赔': '定期寿险'
    };
    return aliases[type] || type;
  }

  /**
   * 提取变量值
   */
  private extractVariables(
    variableDefs: Record<string, FormulaVariable>,
    params: EstimateParams
  ): Record<string, number> {
    const variables: Record<string, number> = {};

    for (const [name, def] of Object.entries(variableDefs)) {
      const value = this.resolveVariable(def, params);
      variables[name] = value;
    }

    return variables;
  }

  /**
   * 解析变量值
   */
  private resolveVariable(def: FormulaVariable, params: EstimateParams): number {
    const source = def.source;

    // 直接映射到参数
    const paramMap: Record<string, keyof EstimateParams> = {
      'claim.approved_expenses': 'approvedExpenses',
      'coverage.deductible': 'deductible',
      'coverage.reimbursement_ratio': 'reimbursementRatio',
      'coverage.sum_insured': 'sumInsured',
      'claim.prior_benefit': 'priorBenefit',
      'claim.disability_grade': 'disabilityGrade',
      'claim.hospital_days': 'hospitalDays',
      'coverage.daily_allowance': 'dailyAllowance'
    };

    const paramKey = paramMap[source];
    if (paramKey) {
      return params[paramKey] || 0;
    }

    // 支持嵌套属性（简化处理）
    if (source.includes('.')) {
      const lastPart = source.split('.').pop();
      if (lastPart && params[lastPart] !== undefined) {
        return params[lastPart] || 0;
      }
    }

    return 0;
  }

  /**
   * 应用查找表
   */
  private applyLookupTables(
    formula: FormulaConfig,
    variables: Record<string, number>
  ): Record<string, number> {
    if (!formula.lookup_tables) {
      return variables;
    }

    const result = { ...variables };

    Object.entries(formula.lookup_tables).forEach(([tableName, table]) => {
      // 查找对应的变量（如 disability_grade_table 对应 disability_grade）
      const varName = tableName.replace('_table', '');
      const lookupKey = variables[varName];

      if (lookupKey !== undefined) {
        const keyStr = lookupKey.toString();
        if (table[keyStr] !== undefined) {
          result[tableName] = table[keyStr];
        }
      }
    });

    return result;
  }

  /**
   * 执行公式步骤
   */
  private executeFormulaSteps(
    formula: FormulaConfig,
    variables: Record<string, number>
  ): CalculationStep[] {
    const steps: CalculationStep[] = [];
    const stepOutputs: Record<string, number> = {};

    for (const step of formula.steps || []) {
      // 合并变量和步骤输出
      const stepVars = { ...variables, ...stepOutputs };

      // 执行表达式
      const result = this.evaluateExpression(step.expr, stepVars);

      // 保存输出
      stepOutputs[step.output] = result;

      steps.push({
        name: step.name,
        expression: step.expr,
        input: stepVars,
        output: result,
        outputName: step.output
      });
    }

    return steps;
  }

  /**
   * 求值表达式
   */
  private evaluateExpression(
    expr: string,
    variables: Record<string, number>
  ): number {
    // 替换变量
    let processedExpr = expr;
    
    // 按名称长度降序排序，避免短名称替换长名称的一部分
    const sortedVars = Object.entries(variables).sort((a, b) => 
      b[0].length - a[0].length
    );

    for (const [name, value] of sortedVars) {
      const regex = new RegExp(`\\\\b${name}\\\\b`, 'g');
      processedExpr = processedExpr.replace(regex, String(value));
    }

    // 处理 min 函数
    processedExpr = processedExpr.replace(/min\\s*\\(([^)]+)\\)/g, (match, args) => {
      const values = args.split(',').map((v: string) => {
        const trimmed = v.trim();
        const num = parseFloat(trimmed);
        return isNaN(num) ? 0 : num;
      });
      return String(Math.min(...values));
    });

    // 处理 max 函数
    processedExpr = processedExpr.replace(/max\\s*\\(([^)]+)\\)/g, (match, args) => {
      const values = args.split(',').map((v: string) => {
        const trimmed = v.trim();
        const num = parseFloat(trimmed);
        return isNaN(num) ? 0 : num;
      });
      return String(Math.max(...values));
    });

    // 安全求值
    try {
      // 只允许数学运算符和数字
      const safePattern = /^[\s\d.\+\-\*\/\(\)<>=%]+$/;
      if (!safePattern.test(processedExpr)) {
        console.warn('[SettlementConfigService] Unsafe expression:', processedExpr);
        return 0;
      }

      return new Function('return ' + processedExpr)();
    } catch (e) {
      console.error('[SettlementConfigService] Evaluation error:', e, 'Expression:', processedExpr);
      console.error('[SettlementConfigService] Evaluation error:', e, 'Expression:', processedExpr);
      return 0;
    }
  }
}

// 导出单例实例
export const settlementConfigService = new SettlementConfigService(configService);
