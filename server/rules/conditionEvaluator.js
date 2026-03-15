/**
 * 条件求值器 - 评估规则条件是否满足
 * 支持所有 ConditionOperator 和嵌套条件组
 */

/**
 * 从上下文中获取字段值，支持嵌套路径如 "claim.accident_date"
 * @param {object} context - 执行上下文
 * @param {string} fieldPath - 字段路径
 * @returns {any} 字段值
 */
export function getFieldValue(context, fieldPath) {
  if (!fieldPath || typeof fieldPath !== 'string') return undefined;
  
  const parts = fieldPath.split('.');
  let value = context;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  
  return value;
}

/**
 * 解析值中的变量引用，如 "${policy.effective_date}"
 * @param {any} value - 原始值
 * @param {object} context - 执行上下文
 * @returns {any} 解析后的值
 */
export function resolveValue(value, context) {
  if (typeof value !== 'string') return value;
  
  // 检查是否是变量引用 ${...}
  const varMatch = value.match(/^\$\{(.+)\}$/);
  if (varMatch) {
    const expression = varMatch[1].trim();
    const offsetMatch = expression.match(/^([a-zA-Z0-9_.]+)\s*([+-])\s*(\d+)\s*d$/);
    if (offsetMatch) {
      const [, fieldPath, operator, daysText] = offsetMatch;
      const baseValue = getFieldValue(context, fieldPath);
      const baseDate = new Date(baseValue);
      if (Number.isNaN(baseDate.getTime())) {
        return undefined;
      }
      const deltaDays = Number(daysText) * (operator === '-' ? -1 : 1);
      baseDate.setDate(baseDate.getDate() + deltaDays);
      return baseDate.toISOString().split('T')[0];
    }

    return getFieldValue(context, expression);
  }
  
  return value;
}

function isDateOnlyString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function compareValues(fieldValue, targetValue) {
  if (isDateOnlyString(fieldValue) && isDateOnlyString(targetValue)) {
    if (fieldValue === targetValue) return 0;
    return fieldValue > targetValue ? 1 : -1;
  }

  const left = Number(fieldValue);
  const right = Number(targetValue);
  if (Number.isFinite(left) && Number.isFinite(right)) {
    if (left === right) return 0;
    return left > right ? 1 : -1;
  }

  if (fieldValue === targetValue) return 0;
  if (fieldValue === undefined || fieldValue === null || targetValue === undefined || targetValue === null) {
    return NaN;
  }
  return String(fieldValue).localeCompare(String(targetValue), 'zh-CN');
}

/**
 * 评估单个叶子条件
 * @param {object} condition - LeafCondition
 * @param {object} context - 执行上下文
 * @returns {boolean} 条件是否满足
 */
export function evaluateLeafCondition(condition, context) {
  const { field, operator, value } = condition;
  
  const fieldValue = getFieldValue(context, field);
  const targetValue = resolveValue(value, context);
  
  switch (operator) {
    case 'EQ':
      return fieldValue === targetValue;
      
    case 'NE':
      return fieldValue !== targetValue;
      
    case 'GT':
      return compareValues(fieldValue, targetValue) > 0;
      
    case 'GTE':
      return compareValues(fieldValue, targetValue) >= 0;
      
    case 'LT':
      return compareValues(fieldValue, targetValue) < 0;
      
    case 'LTE':
      return compareValues(fieldValue, targetValue) <= 0;
      
    case 'IN':
      if (!Array.isArray(targetValue)) return false;
      return targetValue.includes(fieldValue);
      
    case 'NOT_IN':
      if (!Array.isArray(targetValue)) return true;
      return !targetValue.includes(fieldValue);
      
    case 'CONTAINS':
      if (typeof fieldValue !== 'string') return false;
      return fieldValue.includes(String(targetValue));
      
    case 'NOT_CONTAINS':
      if (typeof fieldValue !== 'string') return true;
      return !fieldValue.includes(String(targetValue));
      
    case 'STARTS_WITH':
      if (typeof fieldValue !== 'string') return false;
      return fieldValue.startsWith(String(targetValue));
      
    case 'BETWEEN':
      if (!Array.isArray(targetValue) || targetValue.length !== 2) return false;
      const numValue = Number(fieldValue);
      return numValue >= Number(targetValue[0]) && numValue <= Number(targetValue[1]);
      
    case 'IS_NULL':
      return fieldValue === null || fieldValue === undefined;
      
    case 'IS_NOT_NULL':
      return fieldValue !== null && fieldValue !== undefined;
      
    case 'IS_TRUE':
      return fieldValue === true || fieldValue === 'true' || fieldValue === 1;
      
    case 'IS_FALSE':
      return fieldValue === false || fieldValue === 'false' || fieldValue === 0;
      
    case 'MATCHES_REGEX':
      if (typeof fieldValue !== 'string') return false;
      try {
        const regex = new RegExp(String(targetValue));
        return regex.test(fieldValue);
      } catch {
        return false;
      }
      
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * 判断是否为组条件（GroupCondition）
 * @param {object} expr - 表达式
 * @returns {boolean}
 */
function isGroupCondition(expr) {
  return 'logic' in expr && 'expressions' in expr && !('field' in expr);
}

/**
 * 评估条件组（递归）
 * @param {object} group - GroupCondition 或 RuleConditions
 * @param {object} context - 执行上下文
 * @returns {boolean} 条件组是否满足
 */
export function evaluateConditionGroup(group, context) {
  const { logic, expressions } = group;
  
  // 特殊逻辑：始终为真
  if (logic === 'ALWAYS_TRUE') {
    return true;
  }
  
  // 空表达式列表
  if (!expressions || expressions.length === 0) {
    return logic === 'AND' || logic === 'ALWAYS_TRUE';
  }
  
  switch (logic) {
    case 'AND':
      return expressions.every(expr => {
        if (isGroupCondition(expr)) {
          return evaluateConditionGroup(expr, context);
        }
        return evaluateLeafCondition(expr, context);
      });
      
    case 'OR':
      return expressions.some(expr => {
        if (isGroupCondition(expr)) {
          return evaluateConditionGroup(expr, context);
        }
        return evaluateLeafCondition(expr, context);
      });

    case 'SINGLE':
      if (expressions.length === 0) return false;
      if (isGroupCondition(expressions[0])) {
        return evaluateConditionGroup(expressions[0], context);
      }
      return evaluateLeafCondition(expressions[0], context);
      
    case 'NOT':
      // NOT 逻辑：所有子表达式都不满足才返回 true
      return !expressions.some(expr => {
        if (isGroupCondition(expr)) {
          return evaluateConditionGroup(expr, context);
        }
        return evaluateLeafCondition(expr, context);
      });
      
    default:
      console.warn(`Unknown logic: ${logic}`);
      return false;
  }
}

/**
 * 评估规则条件（主入口）
 * @param {object} conditions - RuleConditions
 * @param {object} context - 执行上下文
 * @returns {boolean} 条件是否满足
 */
export function evaluateConditions(conditions, context) {
  if (!conditions) return true;
  return evaluateConditionGroup(conditions, context);
}
