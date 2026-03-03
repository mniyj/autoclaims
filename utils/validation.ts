import { ValidationRule } from '../types';

/**
 * 校验规则集合
 */
export const validationRules: Record<string, ValidationRule> = {
  required: (value: any) => {
    if (value === '' || value === null || value === undefined) {
      return '此项为必填';
    }
    return null;
  },

  id_number: (value: string) => {
    if (!value) return null;
    const idRegex = /^\d{17}[\dXx]$/;
    if (!idRegex.test(value)) {
      return '身份证号必须为18位数字或X结尾';
    }
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(value[i]) * weights[i];
    }
    const expectedCheckCode = checkCodes[sum % 11];
    const actualCheckCode = value[17].toUpperCase();
    if (actualCheckCode !== expectedCheckCode) {
      return '身份证校验码不正确';
    }
    return null;
  },

  date: (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '日期格式不正确';
    }
    if (date > new Date()) {
      return '日期不能晚于今天';
    }
    return null;
  },

  phone: (value: string) => {
    if (!value) return null;
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(value)) {
      return '手机号格式不正确';
    }
    return null;
  },

  bank_card: (value: string) => {
    if (!value) return null;
    const cleaned = value.replace(/\s/g, '');
    if (!/^\d{16,19}$/.test(cleaned)) {
      return '银行卡号应为16-19位数字';
    }
    return null;
  },

  email: (value: string) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return '邮箱格式不正确';
    }
    return null;
  },

  amount: (value: any) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseFloat(value);
    if (isNaN(num)) {
      return '金额必须为数字';
    }
    if (num < 0) {
      return '金额不能为负数';
    }
    return null;
  },

  positive_integer: (value: any) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) {
      return '必须为正整数';
    }
    return null;
  },
};

/**
 * 根据字段名推断应使用的校验规则
 */
export const inferValidations = (
  fieldKey: string,
  required: boolean
): string[] => {
  const rules: string[] = [];

  if (required) {
    rules.push('required');
  }

  const key = fieldKey.toLowerCase();

  if (
    key.includes('id_number') ||
    key.includes('身份证') ||
    key.includes('idnumber')
  ) {
    rules.push('id_number');
  }

  if (
    key.includes('phone') ||
    key.includes('手机') ||
    key.includes('电话') ||
    key.includes('mobile')
  ) {
    rules.push('phone');
  }

  if (
    key.includes('date') ||
    key.includes('日期') ||
    key.includes('time') ||
    key.includes('birth')
  ) {
    rules.push('date');
  }

  if (
    key.includes('email') ||
    key.includes('邮箱') ||
    key.includes('邮件')
  ) {
    rules.push('email');
  }

  if (
    key.includes('card_number') ||
    key.includes('银行卡') ||
    key.includes('account')
  ) {
    rules.push('bank_card');
  }

  if (
    key.includes('amount') ||
    key.includes('金额') ||
    key.includes('price') ||
    key.includes('money') ||
    key.includes('fee') ||
    key.includes('费用')
  ) {
    rules.push('amount');
  }

  return rules;
};

/**
 * 执行字段校验
 * @param value - 字段值
 * @param rules - 校验规则名数组
 * @returns 错误信息，无错误返回 null
 */
export const validateField = (
  value: any,
  rules: string[]
): string | null => {
  for (const ruleName of rules) {
    const rule = validationRules[ruleName];
    if (rule) {
      const error = rule(value);
      if (error) {
        return error;
      }
    }
  }
  return null;
};

/**
 * 批量校验多个字段
 * @param data - 字段数据对象
 * @param fieldRules - 字段到规则名的映射
 * @returns 错误信息映射
 */
export const validateForm = (
  data: Record<string, any>,
  fieldRules: Record<string, string[]>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [fieldKey, rules] of Object.entries(fieldRules)) {
    const value = data[fieldKey];
    const error = validateField(value, rules);
    if (error) {
      errors[fieldKey] = error;
    }
  }

  return errors;
};

/**
 * 构建字段规则映射
 * @param fields - 解析后的字段数组
 * @returns 字段到规则名的映射
 */
export const buildFieldRules = (
  fields: { key: string; required: boolean }[]
): Record<string, string[]> => {
  const rules: Record<string, string[]> = {};

  for (const field of fields) {
    rules[field.key] = inferValidations(field.key, field.required);
  }

  return rules;
};
