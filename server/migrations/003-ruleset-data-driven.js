/**
 * Migration 003: 为规则集注入 binding、coverage_inference、pre_processors 字段
 *
 * 将硬编码的产品匹配、覆盖范围推断和预处理逻辑迁移为数据驱动配置。
 * 每个 product_line 对应不同的映射规则。
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RULESETS_PATH = join(__dirname, '../../jsonlist/rulesets.json');

// --- 按 product_line 定义迁移映射 ---

function getBindingForProductLine(productLine, productCode) {
  const productCodes = productCode ? [productCode] : [];

  const mappings = {
    ACCIDENT: {
      product_codes: productCodes,
      category_match: { primary: ['意外险'], secondary: [] },
      keywords: ['意外', '身故', '伤残'],
      match_priority: 10,
    },
    HEALTH: {
      product_codes: productCodes,
      category_match: { primary: ['健康险', '医疗险'], secondary: [] },
      keywords: ['健康', '医疗', '住院', '重疾'],
      match_priority: 10,
    },
    AUTO: {
      product_codes: productCodes,
      category_match: { primary: ['车险'], secondary: [] },
      keywords: ['车', '汽车', '机动车'],
      match_priority: 10,
    },
    LIABILITY: {
      product_codes: productCodes,
      category_match: { primary: ['责任险'], secondary: [] },
      keywords: ['责任', '雇主', '第三者', '工程机械'],
      match_priority: 10,
    },
  };

  return mappings[productLine] || {
    product_codes: productCodes,
    category_match: { primary: [], secondary: [] },
    keywords: [],
    match_priority: 0,
  };
}

function getCoverageInferenceForProductLine(productLine) {
  const mappings = {
    ACCIDENT: {
      rules: [
        {
          coverage_code: 'ACC_DEATH',
          label: '意外身故',
          condition: {
            all: [{ field: 'claim.death_confirmed', operator: 'IS_TRUE' }],
          },
        },
        {
          coverage_code: 'ACC_DISABILITY',
          label: '意外伤残',
          condition: {
            all: [{ field: 'claim.disability_grade', operator: 'GT', value: 0 }],
          },
        },
        {
          coverage_code: 'ACC_HOSPITAL_ALLOWANCE',
          label: '意外住院津贴',
          condition: {
            all: [
              { field: 'claim.hospital_days', operator: 'GT', value: 0 },
              { field: 'claim.expense_items.length', operator: 'EQ', value: 0 },
            ],
          },
        },
      ],
      default_coverage_code: 'ACC_MEDICAL',
      default_label: '意外医疗',
    },
    HEALTH: {
      rules: [],
      default_coverage_code: 'HLT_INPATIENT',
      default_label: '住院医疗',
    },
    AUTO: {
      rules: [
        {
          coverage_code: 'AUTO_COMPULSORY',
          label: '交强险',
          condition: {
            all: [
              {
                field: 'claim.auto_coverage_type',
                operator: 'IN',
                value: ['AUTO_COMPULSORY', 'COMPULSORY', '交强险', 'CTPL', 'JQX'],
              },
            ],
          },
        },
        {
          coverage_code: 'AUTO_THIRD_PARTY',
          label: '第三者责任险',
          condition: {
            any: [
              {
                field: 'claim.auto_coverage_type',
                operator: 'IN',
                value: ['AUTO_THIRD_PARTY', 'THIRD_PARTY', '三者险', 'TPL', 'SSX'],
              },
              { field: 'claim.third_party_loss_amount', operator: 'GT', value: 0 },
            ],
          },
        },
        {
          coverage_code: 'AUTO_DRIVER_PASSENGER',
          label: '车上人员责任险',
          condition: {
            any: [
              {
                field: 'claim.auto_coverage_type',
                operator: 'IN',
                value: ['AUTO_DRIVER_PASSENGER', 'DRIVER_PASSENGER', '座位险', 'DP', 'ZWX'],
              },
              { field: 'claim.passenger_injury_amount', operator: 'GT', value: 0 },
              { field: 'claim.injury_grade', operator: 'IS_NOT_NULL' },
            ],
          },
        },
      ],
      default_coverage_code: 'AUTO_VEHICLE_DAMAGE',
      default_label: '车辆损失险',
    },
    LIABILITY: {
      rules: [],
      default_coverage_code: null,
      default_label: null,
    },
  };

  return mappings[productLine] || { rules: [], default_coverage_code: null, default_label: null };
}

function getPreProcessorsForProductLine(productLine) {
  const mappings = {
    ACCIDENT: [],
    HEALTH: [
      {
        processor_id: 'pre_existing_condition',
        type: 'PRE_EXISTING_CONDITION',
        label: '既往症评估',
        enabled: true,
        config: {
          skip_when: {
            field: 'ocrData.pre_existing_condition',
            operator: 'IS_NOT_NULL',
          },
          output_field: 'pre_existing_condition',
          on_yes: true,
          on_no: false,
          on_uncertain: null,
        },
      },
    ],
    AUTO: [
      {
        processor_id: 'fault_ratio_cascade',
        type: 'FIELD_CASCADE',
        label: '责任比例字段级联',
        enabled: true,
        config: {
          field_cascade: [
            'claim.fault_ratio',
            'claim.faultRatio',
            'claim.insured_liability_ratio',
            'claim.insuredLiabilityRatio',
            'claim.third_party_liability_ratio',
            'claim.thirdPartyLiabilityRatio',
          ],
          normalize: 'RATIO_0_1',
          default_value: 1.0,
        },
      },
    ],
    LIABILITY: [],
  };

  return mappings[productLine] || [];
}

// --- 主迁移逻辑 ---

function migrate() {
  console.log('=== Migration 003: 规则集数据驱动迁移 ===\n');

  // 1. 读取 rulesets.json
  const raw = readFileSync(RULESETS_PATH, 'utf-8');
  const rulesets = JSON.parse(raw);
  console.log(`读取到 ${rulesets.length} 个规则集\n`);

  // 2. 为每个规则集注入新字段
  const migrated = rulesets.map((ruleset) => {
    const { product_line, policy_info, ruleset_id } = ruleset;
    const productCode = policy_info?.product_code || null;

    const binding = getBindingForProductLine(product_line, productCode);
    const coverage_inference = getCoverageInferenceForProductLine(product_line);
    const pre_processors = getPreProcessorsForProductLine(product_line);

    console.log(`✓ ${ruleset_id} (${product_line})`);
    console.log(`  binding.product_codes: [${binding.product_codes.join(', ')}]`);
    console.log(`  coverage_inference.rules: ${coverage_inference.rules.length} 条, default: ${coverage_inference.default_coverage_code}`);
    console.log(`  pre_processors: ${pre_processors.length} 个\n`);

    return {
      ...ruleset,
      binding,
      coverage_inference,
      pre_processors,
    };
  });

  // 3. 写回文件
  writeFileSync(RULESETS_PATH, JSON.stringify(migrated, null, 2), 'utf-8');
  console.log(`已写入 ${RULESETS_PATH}\n`);

  // 4. 验证
  const verification = JSON.parse(readFileSync(RULESETS_PATH, 'utf-8'));
  let allValid = true;
  for (const rs of verification) {
    const hasBinding = rs.binding && typeof rs.binding === 'object';
    const hasCoverage = rs.coverage_inference && typeof rs.coverage_inference === 'object';
    const hasPreProc = Array.isArray(rs.pre_processors);

    if (!hasBinding || !hasCoverage || !hasPreProc) {
      console.error(`✗ ${rs.ruleset_id} 缺少必要字段: binding=${hasBinding}, coverage_inference=${hasCoverage}, pre_processors=${hasPreProc}`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log(`=== 验证通过: 全部 ${verification.length} 个规则集已成功迁移 ===`);
  } else {
    console.error('=== 验证失败: 部分规则集缺少必要字段 ===');
    process.exit(1);
  }
}

migrate();
