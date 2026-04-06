/**
 * 通用化理算公式引擎
 * 支持多险种、多公式类型的配置化理算
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 缓存已加载的公式配置
let formulasCache = null;

/**
 * 加载公式配置文件
 */
function loadFormulas() {
  if (formulasCache) {
    return formulasCache;
  }

  const configPath = join(
    __dirname,
    "../../jsonlist/calculation-formulas.json",
  );
  if (!existsSync(configPath)) {
    throw new Error("公式配置文件不存在: calculation-formulas.json");
  }

  const content = readFileSync(configPath, "utf-8");
  formulasCache = JSON.parse(content);
  return formulasCache;
}

/**
 * 根据点路径从上下文中获取值
 * @param {string} path - 点路径，如 'claim.approved_expenses'
 * @param {object} context - 执行上下文
 * @returns {any} 对应的值
 */
function getFieldValue(path, context) {
  const parts = path.split(".");
  let value = context;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[part];
  }

  return value;
}

/**
 * 解析变量值
 * @param {object} variables - 变量定义
 * @param {object} context - 执行上下文
 * @param {object} lookupTables - 查表数据
 * @returns {object} 解析后的变量键值对
 */
function resolveVariables(variables, context, lookupTables = {}) {
  const resolved = {};

  for (const [name, def] of Object.entries(variables)) {
    if (def.source === "lookup" && def.lookup_table) {
      // 查表类型变量
      const table = lookupTables[def.lookup_table];
      const key = getFieldValue(def.lookup_key, context);
      if (table && key !== undefined) {
        resolved[name] = table[key];
      } else {
        resolved[name] = 0;
        console.warn(
          `[calculationEngine] 变量 "${name}" 查找表 "${def.lookup_table}" 不存在或键 "${key}" 未匹配，默认值 0`,
        );
      }
    } else if (typeof def.source === "string" && def.source.startsWith("{")) {
      // 上下文变量，如 '{claim.approved_expenses}'
      const path = def.source.slice(1, -1);
      resolved[name] = getFieldValue(path, context);
      if (resolved[name] === undefined) {
        console.warn(
          `[calculationEngine] 变量 "${name}" 的上下文路径 "${path}" 值为 undefined，公式可能产出 NaN`,
        );
      }
    } else {
      // 静态值或直接值
      resolved[name] = def.value !== undefined ? def.value : def.source;
    }
  }

  return resolved;
}

/**
 * 应用查表
 * @param {object} formula - 公式配置
 * @param {object} variables - 已解析的变量
 * @param {object} context - 执行上下文
 */
function applyLookupTables(formula, variables, context) {
  if (!formula.lookup_tables) return;

  for (const [tableName, table] of Object.entries(formula.lookup_tables)) {
    // 查表已经在 resolveVariables 中处理
    // 这里可以添加动态查表逻辑
  }
}

/**
 * 内置函数
 */
const BUILT_IN_FUNCTIONS = {
  min: Math.min,
  max: Math.max,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  sum: (arr) => (Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) : arr),
  avg: (arr) =>
    Array.isArray(arr) ? arr.reduce((a, b) => a + b, 0) / arr.length : arr,
  if: (cond, trueVal, falseVal) => (cond ? trueVal : falseVal),
};

// 表达式安全校验：仅允许数字、运算符、变量名、函数名、括号、逗号、空格
const SAFE_EXPR_PATTERN = /^[\w\s+\-*/().,%<>=!?:]+$/;
// 禁止的危险标识符
const DANGEROUS_PATTERN =
  /(__proto__|constructor|prototype|eval|Function|import|require|process|global|window|globalThis|Proxy|Reflect)/i;
// 已验证表达式缓存
const validatedExprCache = new Set();

/**
 * 安全执行表达式（不使用 eval）
 * 使用 Function 构造器 + 白名单校验替代 eval，确保：
 * 1. 表达式只包含合法字符
 * 2. 不包含危险标识符
 * 3. 在严格模式独立作用域中执行
 *
 * @param {string} expr - 表达式字符串
 * @param {object} scope - 变量作用域
 * @returns {number|string} 计算结果
 */
function safeEval(expr, scope) {
  try {
    // 1. 校验表达式安全性（利用缓存避免重复校验）
    if (!validatedExprCache.has(expr)) {
      if (!SAFE_EXPR_PATTERN.test(expr)) {
        throw new Error(`表达式包含不允许的字符: ${expr}`);
      }
      if (DANGEROUS_PATTERN.test(expr)) {
        throw new Error(`表达式包含禁止的标识符: ${expr}`);
      }
      validatedExprCache.add(expr);
    }

    // 2. 收集所有参数名和值（变量 + 内置函数）
    const scopeNames = Object.keys(scope);
    const scopeValues = Object.values(scope);
    const funcNames = Object.keys(BUILT_IN_FUNCTIONS);
    const funcValues = Object.values(BUILT_IN_FUNCTIONS);

    const paramNames = [...scopeNames, ...funcNames];
    const paramValues = [...scopeValues, ...funcValues];

    // 3. 使用 Function 构造器在独立严格模式作用域中执行
    // Function 构造器比 eval 更安全：无法访问局部变量，仅能访问显式传入的参数和全局对象
    // "use strict" 进一步限制：禁止 with、禁止隐式全局变量
    const fn = new Function(...paramNames, `"use strict"; return (${expr});`);
    const result = fn(...paramValues);
    return result;
  } catch (error) {
    console.error(`表达式执行错误: ${expr}`, error);
    throw new Error(`公式计算失败: ${error.message}`);
  }
}

/**
 * 执行计算步骤
 * @param {Array} steps - 计算步骤定义
 * @param {object} variables - 已解析的变量
 * @returns {Array} 每步的结果
 */
function executeSteps(steps, variables) {
  if (!steps || steps.length === 0) {
    // 没有步骤，直接计算公式
    return variables;
  }

  const results = [];

  for (const step of steps) {
    const { name, expr, output } = step;

    // 将步骤变量合并到作用域
    const scope = { ...variables, ...results };

    try {
      const value = safeEval(expr, scope);
      results[output] = value;
      results.push({ step: name, value, expr });
    } catch (error) {
      console.error(`步骤执行失败: ${name}`, error);
      throw error;
    }
  }

  return results;
}

/**
 * 执行理算公式
 * @param {string} formulaType - 公式类型（如 ACC_MEDICAL, ACC_DISABILITY）
 * @param {object} context - 执行上下文（claim, coverage, policy 等）
 * @returns {object} 理算结果
 */
export function executeCalculation(formulaType, context = {}) {
  // 1. 加载公式配置
  const formulas = loadFormulas();
  const formula = formulas[formulaType];

  if (!formula) {
    throw new Error(`未找到公式类型: ${formulaType}`);
  }

  // 2. 解析变量值
  const variables = resolveVariables(
    formula.variables,
    context,
    formula.lookup_tables,
  );

  // 3. 应用查表（如有）
  applyLookupTables(formula, variables, context);

  // 4. 执行计算步骤
  const steps = executeSteps(formula.steps, variables);

  // 5. 获取最终结果
  let finalAmount = 0;
  if (steps.length > 0) {
    // 从步骤中获取最后的结果
    const lastStep = steps[steps.length - 1];
    finalAmount = lastStep.value;
  } else if (formula.formula) {
    // 直接计算公式
    finalAmount = safeEval(formula.formula, variables);
  }

  return {
    formulaType,
    description: formula.description,
    insuranceType: formula.insuranceType,
    variables,
    steps: steps
      .filter((s) => s.step)
      .map((s) => ({
        name: s.step,
        value: s.value,
        expression: s.expr,
      })),
    finalAmount: Number(finalAmount),
  };
}

/**
 * 获取所有可用公式类型
 * @returns {Array<{code, description, insuranceType, formula, variables, steps, output}>} 公式列表
 */
export function getAvailableFormulas() {
  const formulas = loadFormulas();
  return Object.entries(formulas).map(([code, formula]) => ({
    code,
    description: formula.description,
    insuranceType: formula.insuranceType,
    formula: formula.formula,
    variables: formula.variables,
    steps: formula.steps,
    output: formula.output,
  }));
}

/**
 * 获取公式配置详情（用于管理页面编辑）
 * @param {string} formulaType - 公式类型
 * @returns {object} 公式完整配置
 */
export function getFormulaDetail(formulaType) {
  const formulas = loadFormulas();
  return formulas[formulaType];
}

/**
 * 保存公式配置（用于管理页面）
 * @param {string} formulaType - 公式类型
 * @param {object} config - 公式配置
 * @returns {boolean} 是否保存成功
 */
export function saveFormula(formulaType, config) {
  // 注意：实际生产环境应写入数据库，这里仅为演示
  console.log(`保存公式配置: ${formulaType}`, config);
  return true;
}

/**
 * 清空缓存（用于热重载配置）
 */
export function clearCache() {
  formulasCache = null;
}

export default {
  executeCalculation,
  getAvailableFormulas,
  getFormulaDetail,
  saveFormula,
  clearCache,
};
