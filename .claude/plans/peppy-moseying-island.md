# 既往史解析鲁棒性优化

## Context

`parsePastHistoryCertainty`（`preExistingConditionAssessor.js:26`）当前用 6 个词做精确匹配来判断既往史的语义确定性，存在两类漏判风险：

- **CLEAR 漏判**：病历里"既往体健"、"无特殊既往史"、"否认高血压病史"等常见写法均被归入 `HAS_CONTENT`，错误投 YES × 0.5 票，可能把无既往症的案件推向拒赔或升级。
- **UNKNOWN 漏判**："既往史不详"、"家属代述不清"等变体也被归入 `HAS_CONTENT`，同样投 YES 票，而非触发转人工。

根本原因是关键词规则过于脆弱，而上游 AI 提取（`summaryExtractors/index.js`）虽然已要求输出"无"/"不详"/原文三类，但未给出足够例子约束 AI 的输出边界，导致 AI 实际可能输出多种自然语言变体。

## 修改点

### Fix 1：强化 summaryExtractor 提取 Prompt（根治源头）

**文件**：`server/services/summaryExtractors/index.js`（第 153-157 行）

在 `inpatient_record` 的 `pastHistory` 提取指令中，将现有三行说明扩展为带有具体例子的规则：

```
9. 既往史（pastHistory）：病历中"既往史"段落的语义规范化结果。
   输出规则（只能三选一）：
   - 填 "无" 的情形：原文含"既往体健"、"无特殊既往史"、"无慢性病史"、
     "否认高血压冠心病等病史"、"平素体健"等否定/无病史表述
   - 填 "不详" 的情形：原文含"既往史不详"、"既往史欠详"、
     "家属代述不清"、"病史不明"，或病历中完全未提及既往史
   - 其他情形：填写原文段落（保留关键疾病名称和时间描述）
```

**目标**：让 AI 提取时就输出规范值，减少后续关键词规则的压力。

---

### Fix 2：parsePastHistoryCertainty 改用正则模式匹配（防御纵深）

**文件**：`server/services/preExistingConditionAssessor.js`（第 26-38 行）

将精确匹配改为正则，覆盖常见自然语言变体：

```javascript
// CLEAR 模式：否定 / 无病史表述
const CLEAR_PATTERNS = [
  /^无$/,
  /^否认既往病史$/,
  /^无特殊$/,
  /既往体健/,
  /无特殊既往史/,
  /否认.{0,10}病史/,
  /无慢性病/,
  /平素体健/,
  /无重大.{0,5}病史/,
];

// UNKNOWN 模式：不详 / 不清 / 缺失表述
const UNKNOWN_PATTERNS = [
  /^不详$/,
  /^不明$/,
  /不详/,
  /不清/,
  /欠详/,
  /代述/,
  /未提及/,
  /无法提供/,
];
```

判断逻辑改为：遍历 CLEAR_PATTERNS，有匹配 → CLEAR；遍历 UNKNOWN_PATTERNS，有匹配 → UNKNOWN；否则 → HAS_CONTENT。

**注意**：CLEAR 优先级高于 UNKNOWN（先判 CLEAR，再判 UNKNOWN）。

---

## 关键文件

| 文件 | 行号 | 修改内容 |
|------|------|--------|
| `server/services/summaryExtractors/index.js` | 153-157 | 强化 pastHistory 提取规则，增加分类示例 |
| `server/services/preExistingConditionAssessor.js` | 26-38 | `parsePastHistoryCertainty` 改用正则 |

无需修改其他文件（caseAggregator、context.js、engine.js 均不受影响）。

---

## 验证方式

构造以下 `past_medical_history` 输入，验证 `parsePastHistoryCertainty` 返回的 `certainty`：

| 输入值 | 期望 certainty |
|--------|---------------|
| `"既往体健"` | CLEAR |
| `"否认高血压冠心病等病史"` | CLEAR |
| `"平素体健，无特殊既往史"` | CLEAR |
| `"既往史不详"` | UNKNOWN |
| `"家属代述不清"` | UNKNOWN |
| `"既往史欠详，无法核实"` | UNKNOWN |
| `"高血压病史5年，服用降压药"` | HAS_CONTENT |
| `"2型糖尿病史"` | HAS_CONTENT |
| `null` | UNKNOWN |
