import type {
  MaterialAuditConclusion,
  AuditChecklistItem,
  AuditIssue,
  ExtractionConfig,
} from '../types';

/**
 * 材料验证服务
 * 验证提取的数据并生成审核结论
 */
export class MaterialValidator {
  /**
   * 验证提取的数据
   * @param extractedData - 提取的数据
   * @param extractionConfig - 提取配置（包含schema和验证规则）
   * @returns 审核结论
   */
  validate(
    extractedData: Record<string, any>,
    extractionConfig?: ExtractionConfig
  ): MaterialAuditConclusion {
    const checklist: AuditChecklistItem[] = [];
    const issues: AuditIssue[] = [];

    // 1. Schema 验证
    if (extractionConfig?.jsonSchema) {
      const schemaIssues = this.validateAgainstSchema(
        extractedData,
        extractionConfig.jsonSchema
      );
      issues.push(...schemaIssues);
      
      checklist.push({
        item: 'Schema验证',
        status: schemaIssues.length === 0 ? 'pass' : 'fail',
        message: schemaIssues.length === 0 ? '数据符合Schema定义' : `发现 ${schemaIssues.length} 个问题`,
      });
    }

    // 2. 必填字段验证
    const requiredIssues = this.validateRequiredFields(
      extractedData,
      extractionConfig?.jsonSchema
    );
    issues.push(...requiredIssues);
    
    checklist.push({
      item: '必填字段检查',
      status: requiredIssues.length === 0 ? 'pass' : 'fail',
      message: requiredIssues.length === 0 ? '所有必填字段已填写' : `${requiredIssues.length} 个必填字段缺失`,
    });

    // 3. 自定义规则验证
    if (extractionConfig?.validationRules) {
      const ruleIssues = this.applyValidationRules(
        extractedData,
        extractionConfig.validationRules
      );
      issues.push(...ruleIssues);
      
      checklist.push({
        item: '自定义规则检查',
        status: ruleIssues.length === 0 ? 'pass' : 'fail',
        message: ruleIssues.length === 0 ? '通过所有自定义规则' : `${ruleIssues.length} 个规则未通过`,
      });
    }

    // 生成结论
    return this.generateConclusion(checklist, issues, extractedData);
  }

  /**
   * 根据JSON Schema验证数据
   */
  private validateAgainstSchema(
    data: Record<string, any>,
    schema: Record<string, any>
  ): AuditIssue[] {
    const issues: AuditIssue[] = [];

    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data) || data[field] === '' || data[field] === null || data[field] === undefined) {
          issues.push({
            severity: 'error',
            field,
            message: `必填字段 "${field}" 缺失或为空`,
            suggestion: `请补充 "${field}" 字段的信息`,
          });
        }
      }
    }

    if (schema.properties) {
      for (const [field, propSchema] of Object.entries(schema.properties)) {
        const value = data[field];
        
        // 类型验证
        if (value !== undefined && value !== null && value !== '') {
          const expectedType = (propSchema as any).type;
          if (expectedType && !this.checkType(value, expectedType)) {
            issues.push({
              severity: 'warning',
              field,
              message: `字段 "${field}" 类型不匹配，期望 ${expectedType}`,
              suggestion: `请检查 "${field}" 的值格式`,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * 验证必填字段
   */
  private validateRequiredFields(
    data: Record<string, any>,
    schema?: Record<string, any>
  ): AuditIssue[] {
    const issues: AuditIssue[] = [];
    
    // 通用必填字段检查
    const commonRequired = ['name', 'id_number', 'date'];
    
    for (const field of commonRequired) {
      if (field in data && !data[field]) {
        issues.push({
          severity: 'info',
          field,
          message: `通用字段 "${field}" 为空`,
          suggestion: `建议补充 "${field}" 信息`,
        });
      }
    }

    return issues;
  }

  /**
   * 应用自定义验证规则
   */
  private applyValidationRules(
    data: Record<string, any>,
    rules: any[]
  ): AuditIssue[] {
    const issues: AuditIssue[] = [];

    for (const rule of rules) {
      const value = data[rule.field];
      
      if (rule.required && !value) {
        issues.push({
          severity: rule.severity || 'error',
          field: rule.field,
          message: rule.message || `字段 "${rule.field}" 为必填项`,
          suggestion: rule.suggestion || `请填写 "${rule.field}"`,
        });
      }

      if (value && rule.pattern) {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(String(value))) {
          issues.push({
            severity: rule.severity || 'warning',
            field: rule.field,
            message: rule.message || `字段 "${rule.field}" 格式不正确`,
            suggestion: rule.suggestion || `请按正确格式填写 "${rule.field}"`,
          });
        }
      }
    }

    return issues;
  }

  /**
   * 生成审核结论
   */
  private generateConclusion(
    checklist: AuditChecklistItem[],
    issues: AuditIssue[],
    data: Record<string, any>
  ): MaterialAuditConclusion {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    
    let conclusion: MaterialAuditConclusion['conclusion'];
    let conclusionLabel: string;
    let recommendation: string;

    if (errorCount === 0 && warningCount === 0) {
      conclusion = 'passed';
      conclusionLabel = '审核通过';
      recommendation = '材料完整，无需补充';
    } else if (errorCount === 0) {
      conclusion = 'suspicious';
      conclusionLabel = '存疑待核';
      recommendation = `存在 ${warningCount} 个警告，建议人工复核`;
    } else {
      conclusion = 'incomplete';
      conclusionLabel = '材料不完整';
      recommendation = `存在 ${errorCount} 个错误，需要补充材料`;
    }

    return {
      conclusion,
      conclusionLabel,
      details: `共检查 ${checklist.length} 项，通过 ${checklist.filter(c => c.status === 'pass').length} 项`,
      checklist,
      issues: issues.length > 0 ? issues : undefined,
      recommendation,
    };
  }

  /**
   * 检查值类型
   */
  private checkType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      default:
        return true;
    }
  }
}

/**
 * 全局验证服务实例
 */
export const materialValidator = new MaterialValidator();
