# 规则集数据驱动重构设计

> 日期：2026-03-30
> 分支：feature/ruleset-data-driven-refactor
> 方案：方案 A（规则集内联扩展）

## 目标

将当前散落在后端代码中的三类硬编码逻辑抽象为规则集 JSON 中的声明式配置，使新增险种无需改后端代码，前端可完整配置。

### 三类硬编码

| 层面 | 当前实现 | 问题 |
|------|---------|------|
| 产品→规则集匹配 | `context.js` 正则推断 | 脆弱、不可配置 |
| 案件→覆盖范围推断 | 3 个 engine 文件各自硬编码 | 每新增险种要加文件 |
| 险种前处理逻辑 | `engine.js` 硬编码 if HEALTH | 每新增前处理要改引擎 |

## 约束

- 三层全做，含前端编辑界面
- 一次性迁移，旧逻辑直接删除
- 每阶段单独 commit，支持按阶段回退

---

## 一、数据结构

在每个规则集对象内新增三个顶层段。

### 1.1 binding — 规则集绑定配置

取代 `context.js:462-470` 的正则推断。

```jsonc
{
  "binding": {
    "product_codes": ["ZA-002", "ZA-003"],
    "category_match": {
      "primary": ["意外险"],
      "secondary": ["综合意外", "交通意外"]
    },
    "keywords": ["意外", "身故", "伤残"],
    "match_priority": 10
  }
}
```

**匹配算法**（优先级递减）：
1. `rulesetOverride` 直接使用
2. `binding.product_codes` 精确匹配
3. `binding.category_match` 分类匹配 → 多命中取 `match_priority` 最小
4. `binding.keywords` 关键词匹配 → 多命中取 `match_priority` 最小
5. 全部未命中 → 返回 null

### 1.2 coverage_inference — 覆盖范围推断配置

取代 `accident/engine.js`、`auto/engine.js`、`medical/engine.js` 的推断函数。

```jsonc
{
  "coverage_inference": {
    "rules": [
      {
        "coverage_code": "ACC_DEATH",
        "label": "意外身故",
        "condition": {
          "field": "claim.death_confirmed",
          "operator": "IS_TRUE"
        }
      },
      {
        "coverage_code": "ACC_DISABILITY",
        "label": "意外伤残",
        "condition": {
          "field": "claim.disability_grade",
          "operator": "GT",
          "value": 0
        }
      },
      {
        "coverage_code": "ACC_HOSPITAL_ALLOWANCE",
        "label": "住院津贴",
        "condition": {
          "logic": "AND",
          "expressions": [
            { "field": "claim.hospital_days", "operator": "GT", "value": 0 },
            { "field": "claim.expense_items.length", "operator": "EQ", "value": 0 }
          ]
        }
      }
    ],
    "default_coverage_code": "ACC_MEDICAL",
    "default_label": "意外医疗"
  }
}
```

条件表达式复用 `conditionEvaluator` 的全部 17 种操作符。

### 1.3 pre_processors — 前处理器配置

取代 `engine.js` 的 `enrichPreExistingFact` 和 `auto/engine.js` 的 `getAutoFaultRatio`。

```jsonc
{
  "pre_processors": [
    {
      "processor_id": "pre_existing_condition",
      "type": "PRE_EXISTING_CONDITION",
      "label": "既往症自动评估",
      "enabled": true,
      "config": {
        "skip_when": {
          "field": "ocrData.pre_existing_condition",
          "operator": "IS_NOT_NULL"
        },
        "output_field": "pre_existing_condition",
        "on_yes": true,
        "on_no": false,
        "on_uncertain": null
      }
    },
    {
      "processor_id": "fault_ratio",
      "type": "FIELD_CASCADE",
      "label": "故障比例解析",
      "enabled": true,
      "config": {
        "output_field": "fault_ratio",
        "field_cascade": [
          "claim.fault_ratio",
          "claim.insured_liability_ratio",
          "claim.third_party_liability_ratio"
        ],
        "normalize": "RATIO_0_1",
        "default_value": 1.0
      }
    }
  ]
}
```

**前处理器类型枚举**：

| type | 作用 | 适用险种 |
|------|------|---------|
| `PRE_EXISTING_CONDITION` | 调用既往症评估服务 | HEALTH |
| `FIELD_CASCADE` | 从多个字段取第一个有值的 | AUTO |
| `COVERAGE_ALIAS_RESOLVE` | 中英文别名→标准 code | AUTO |

---

## 二、后端引擎改造

### 2.1 getRuleset 改造（context.js）

删除正则推断，改为读取 `binding` 配置做三轮匹配。

### 2.2 覆盖范围推断统一化

新增 `server/claims/coverageInference.js`（~40 行），遍历 `coverage_inference.rules`，复用 `conditionEvaluator` 求值，第一个命中即返回。

删除：
- `accident/engine.js` — `inferAccidentCoverageCode`
- `auto/engine.js` — `inferAutoCoverageCode`、`AUTO_COVERAGE_ALIASES`、`AUTO_INJURY_GRADE_RATIO`
- `medical/engine.js` — `inferMedicalCoverageCode`
- `calculator.js` — `getCoverageConfigByClaimType` if/else 链

### 2.3 前处理器执行器

新增 `server/claims/preProcessorRunner.js`（~80 行），注册表模式：`type → handler`。

删除：
- `engine.js` — `enrichPreExistingFact`（~80 行）
- `engine.js` — `executeFullReview` 中的 `if HEALTH` 分支

### 2.4 变更汇总

| 文件 | 操作 | 行数估算 |
|------|------|---------|
| `server/rules/context.js` | 改造 `getRuleset` | -20, +40 |
| `server/claims/coverageInference.js` | **新增** | +40 |
| `server/claims/preProcessorRunner.js` | **新增** | +80 |
| `server/rules/engine.js` | 删除硬编码，调用新模块 | -80, +10 |
| `server/claims/settlement/calculator.js` | 删除分发链 | -20, +5 |
| `server/claims/accident/engine.js` | 删除推断函数 | -30 |
| `server/claims/auto/engine.js` | 删除推断函数和别名表 | -70 |
| `server/claims/medical/engine.js` | 删除推断函数 | -5 |

净变化：新增 ~175 行，删除 ~225 行。

---

## 三、前端组件设计

### 3.1 RulesetDetailView 新增 3 个 Tab

现有：规则列表 | 执行管道 | 覆盖链 | 字段字典

新增：规则列表 | **产品绑定** | **覆盖推断** | **前处理器** | 执行管道 | 覆盖链 | 字段字典

### 3.2 BindingConfigTab.tsx（~200 行）

- 上区：精确绑定（产品选择器 + Tag 列表）
- 中区：分类匹配（一级/二级分类 Tag 输入）
- 下区：关键词匹配（Tag 输入）+ 匹配优先级数字输入
- 校验：同一 product_code 不能出现在多个规则集中

### 3.3 CoverageInferenceTab.tsx（~250 行）

- 有序规则卡片列表，支持上下排序
- 每条规则：coverage_code + label + 条件表达式
- 条件编辑复用 `ConditionTreeBuilder`
- 底部：默认 coverage_code 和 label

### 3.4 PreProcessorConfigTab.tsx（~300 行）

- 处理器卡片列表，支持启用/禁用开关
- 添加时先选类型，再展示类型特定的配置表单：
  - PRE_EXISTING_CONDITION：跳过条件 + 输出字段 + 结果映射
  - FIELD_CASCADE：字段列表（可排序）+ 归一化方式 + 默认值
  - COVERAGE_ALIAS_RESOLVE：标准 code → 别名列表的可编辑表格

### 3.5 其他改动

- `RulesetListView`：增加"绑定产品"列
- `RulesetValidationWorkspace`：适配新流程（推断结果 + 前处理器结果展示）

### 3.6 前端文件汇总

| 文件 | 行数估算 |
|------|---------|
| `components/ruleset/BindingConfigTab.tsx` | ~200 |
| `components/ruleset/CoverageInferenceTab.tsx` | ~250 |
| `components/ruleset/PreProcessorConfigTab.tsx` | ~300 |
| `RulesetDetailView.tsx` 修改 | ~+30 |
| `RulesetListView.tsx` 修改 | ~+20 |
| `RulesetValidationWorkspace.tsx` 修改 | ~+40 |

---

## 四、迁移方案

### 4.1 迁移脚本

`server/migrations/003-ruleset-data-driven.js`

对 6 个规则集按 product_line 注入对应配置：

| product_line | coverage_inference | pre_processors |
|---|---|---|
| ACCIDENT | 4 条推断规则（death→disability→allowance→medical） | 无 |
| AUTO | ~5 条推断规则 + IN 别名表达式 | FIELD_CASCADE + COVERAGE_ALIAS_RESOLVE |
| HEALTH | 1 条规则（→ HLT_INPATIENT） | PRE_EXISTING_CONDITION |
| LIABILITY | 空（使用 coverages[0]） | 无 |

### 4.2 迁移验证

脚本内置验证：对每个规则集构造测试 context，分别用新旧逻辑执行，比对结果一致。

---

## 五、Git 策略

分支：`feature/ruleset-data-driven-refactor`

| # | Commit 消息 | 内容 |
|---|------------|------|
| 1 | `feat: add binding/inference/preprocessor schema to rulesets` | 迁移脚本 + 数据升级 |
| 2 | `refactor: replace getRuleset regex with binding-based matching` | context.js 改造 |
| 3 | `refactor: unify coverage inference from ruleset config` | coverageInference.js + 删除 3 个推断函数 |
| 4 | `refactor: replace hardcoded pre-processors with config-driven runner` | preProcessorRunner.js + 删除 enrichPreExistingFact |
| 5 | `feat: add BindingConfigTab for ruleset product binding` | 前端 Tab 1 |
| 6 | `feat: add CoverageInferenceTab for coverage inference config` | 前端 Tab 2 |
| 7 | `feat: add PreProcessorConfigTab for pre-processor config` | 前端 Tab 3 |
| 8 | `chore: adapt validation workspace and list view` | 前端收尾 |

每个 commit 独立可回退。
