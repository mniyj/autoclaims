import { ParsedSchemaField } from '../types';

/**
 * 解析 JSON Schema 并提取字段定义
 * @param schema - JSON Schema 对象
 * @returns 解析后的字段数组
 */
export const parseJsonSchema = (schema: any): ParsedSchemaField[] => {
  const fields: ParsedSchemaField[] = [];

  const parseProperties = (
    properties: any,
    required: string[] = [],
    parentKey = ''
  ) => {
    if (!properties) return;

    Object.entries(properties).forEach(([key, prop]: [string, any]) => {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;

      if (prop.type === 'object' && prop.properties) {
        // 递归解析嵌套对象
        parseProperties(prop.properties, prop.required || [], fullKey);
      } else {
        fields.push({
          key: fullKey,
          label: prop.description || key,
          type: mapSchemaType(prop.type, prop.format),
          required: required.includes(key),
          format: prop.format,
          description: prop.description,
          group: inferGroup(fullKey),
        });
      }
    });
  };

  parseProperties(schema.properties, schema.required);
  return fields;
};

/**
 * 将 Schema 类型映射为字段类型
 */
const mapSchemaType = (
  type: string,
  format?: string
): ParsedSchemaField['type'] => {
  if (format === 'date') return 'date';
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'integer') return 'number';
  return 'string';
};

/**
 * 根据字段名推断所属分组
 */
const inferGroup = (key: string): string => {
  const lowerKey = key.toLowerCase();

  // 基本信息分组
  if (
    lowerKey.includes('name') ||
    lowerKey.includes('姓名') ||
    lowerKey.includes('gender') ||
    lowerKey.includes('性别') ||
    lowerKey.includes('age') ||
    lowerKey.includes('年龄') ||
    lowerKey.includes('birth') ||
    lowerKey.includes('出生') ||
    lowerKey.includes('id_number') ||
    lowerKey.includes('身份证') ||
    lowerKey.includes('ethnicity') ||
    lowerKey.includes('民族') ||
    lowerKey.includes('address') ||
    lowerKey.includes('地址') ||
    lowerKey.includes('phone') ||
    lowerKey.includes('电话')
  ) {
    return '基本信息';
  }

  // 医院信息分组
  if (
    lowerKey.includes('hospital') ||
    lowerKey.includes('医院') ||
    lowerKey.includes('department') ||
    lowerKey.includes('科室') ||
    lowerKey.includes('doctor') ||
    lowerKey.includes('医生') ||
    lowerKey.includes('bed') ||
    lowerKey.includes('床号')
  ) {
    return '医院信息';
  }

  // 日期信息分组
  if (
    lowerKey.includes('date') ||
    lowerKey.includes('日期') ||
    lowerKey.includes('time') ||
    lowerKey.includes('时间') ||
    lowerKey.includes('period') ||
    lowerKey.includes('期限')
  ) {
    return '日期信息';
  }

  // 诊断信息分组
  if (
    lowerKey.includes('diagnosis') ||
    lowerKey.includes('诊断') ||
    lowerKey.includes('disease') ||
    lowerKey.includes('疾病') ||
    lowerKey.includes('symptom') ||
    lowerKey.includes('症状') ||
    lowerKey.includes('injury') ||
    lowerKey.includes('伤情') ||
    lowerKey.includes('illness') ||
    lowerKey.includes('病情')
  ) {
    return '诊断信息';
  }

  // 费用信息分组
  if (
    lowerKey.includes('amount') ||
    lowerKey.includes('金额') ||
    lowerKey.includes('price') ||
    lowerKey.includes('价格') ||
    lowerKey.includes('fee') ||
    lowerKey.includes('费用') ||
    lowerKey.includes('cost') ||
    lowerKey.includes('payment') ||
    lowerKey.includes('支付') ||
    lowerKey.includes('total') ||
    lowerKey.includes('合计') ||
    lowerKey.includes('money') ||
    lowerKey.includes('钱')
  ) {
    return '费用信息';
  }

  // 证件信息分组
  if (
    lowerKey.includes('license') ||
    lowerKey.includes('证件') ||
    lowerKey.includes('certificate') ||
    lowerKey.includes('证书') ||
    lowerKey.includes('number') ||
    lowerKey.includes('号码') ||
    lowerKey.includes('code') ||
    lowerKey.includes('代码')
  ) {
    return '证件信息';
  }

  // 车辆信息分组
  if (
    lowerKey.includes('vehicle') ||
    lowerKey.includes('车辆') ||
    lowerKey.includes('car') ||
    lowerKey.includes('车') ||
    lowerKey.includes('plate') ||
    lowerKey.includes('号牌') ||
    lowerKey.includes('vin') ||
    lowerKey.includes('engine') ||
    lowerKey.includes('发动机')
  ) {
    return '车辆信息';
  }

  // 事故信息分组
  if (
    lowerKey.includes('accident') ||
    lowerKey.includes('事故') ||
    lowerKey.includes('incident') ||
    lowerKey.includes('事件') ||
    lowerKey.includes('location') ||
    lowerKey.includes('地点')
  ) {
    return '事故信息';
  }

  // 保险信息分组
  if (
    lowerKey.includes('insurance') ||
    lowerKey.includes('保险') ||
    lowerKey.includes('policy') ||
    lowerKey.includes('保单')
  ) {
    return '保险信息';
  }

  return '其他信息';
};

/**
 * 按分组组织字段
 */
export const groupFields = (
  fields: ParsedSchemaField[]
): Record<string, ParsedSchemaField[]> => {
  return fields.reduce((acc, field) => {
    const group = field.group || '其他信息';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(field);
    return acc;
  }, {} as Record<string, ParsedSchemaField[]>);
};

/**
 * 提取嵌套字段值
 * @param data - 嵌套数据对象
 * @param path - 字段路径，如 "basicInfo.name"
 * @returns 字段值
 */
export const getNestedValue = (data: any, path: string): any => {
  const keys = path.split('.');
  let value = data;
  for (const key of keys) {
    if (value == null) return null;
    value = value[key];
  }
  return value;
};

/**
 * 设置嵌套字段值
 * @param data - 数据对象
 * @param path - 字段路径
 * @param value - 要设置的值
 * @returns 新的数据对象
 */
export const setNestedValue = (
  data: any,
  path: string,
  value: any
): any => {
  const keys = path.split('.');
  const result = { ...data };
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    } else {
      current[key] = { ...current[key] };
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return result;
};
