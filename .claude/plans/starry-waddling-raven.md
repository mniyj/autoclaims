# 合并 summaryExtractors 到材料管线

## Context

`summaryExtractors/index.js` 和 `claimMaterialPipeline.js` 对同一份文档各调一次 AI，提取几乎相同的字段。两条管线的输出分别被不同下游消费：
- `extractedData`（材料管线）→ fact 绑定 → canonicalFacts → 规则/理算
- `documentSummary`（摘要提取器）→ caseAggregator 的 5 个聚合函数

**问题**：每份文档浪费一次 AI 调用，且 12 套硬编码 Prompt 无法在 UI 维护。

**目标**：干掉 summaryExtractors，让材料管线的 extractedData 同时服务于 fact 绑定和案件聚合。

---

## 核心思路

不改聚合函数的接口（它们依赖 `summaryType` 过滤 + 特定字段名），而是在材料管线出口处，用 `extractedData` + `materialId` **构造出兼容的 summary 对象**，替代原来的独立 AI 提取。

```
之前：文档 → 材料管线(extractedData) + 摘要提取器(summary) → 各自下游
之后：文档 → 材料管线(extractedData) → buildSummaryFromExtraction() → summary → 聚合下游
```

---

## Step 1: 新建 summary 构造函数

**新文件**: `server/services/summaryBuilder.js`

从 `extractedData` + `materialId` 构造出与 summaryExtractors 兼容的 summary 对象：

```javascript
// 复用 summaryExtractors 的 MATERIAL_TO_SUMMARY_TYPE 映射
import { MATERIAL_TO_SUMMARY_TYPE } from "./summaryExtractors/index.js";

function buildSummaryFromExtraction({ docId, materialId, extractedData, confidence }) {
  const summaryType = MATERIAL_TO_SUMMARY_TYPE[materialId];
  if (!summaryType) return null;

  return {
    docId,
    summaryType,
    extractedAt: new Date().toISOString(),
    confidence: confidence || 0.5,
    sourceAnchors: extractedData?.sourceAnchors || {},
    ...extractedData,  // 字段名需要与聚合函数期望的一致
  };
}
```

**关键**：extractedData 的字段名（来自 schemaFields 的 field_key）必须与聚合函数期望的字段名匹配。需要逐类型建立映射。

### 字段映射表

每个 summaryType 对应的聚合函数期望的字段名 vs 当前 schemaFields 的 field_key：

| summaryType | 聚合函数期望字段 | 材料 schemaFields field_key | 需要映射？ |
|---|---|---|---|
| accident_liability (mat-8) | accidentDate, accidentLocation, parties[], liabilityBasis, documentNumber | accident_date, accident_location, parties[], liability_basis, document_number | YES (camelCase vs snake_case) |
| inpatient_record (mat-12) | admissionDate, dischargeDate, hospitalizationDays, diagnoses[], surgeries[], pastHistory, firstDiagnosisDate | admission_date, discharge_date, hospital_days, diagnoses[], surgeries[], past_history, first_diagnosis_date | YES |
| diagnosis_proof (mat-13) | diagnoses[], issueDate, issuingDoctor, institution, restDays | diagnoses[], issue_date, doctor_name, hospital_name, rest_days | YES |
| expense_invoice (mat-20) | invoiceNumber, invoiceDate, totalAmount, institution, breakdown[] | invoice_number, invoice_date, totalAmount, hospital_name, breakdown[] | PARTIAL |
| disability_assessment (mat-35) | disabilityLevel, assessmentDate, assessmentInstitution | disability_grade, appraisal_date, appraisal_institution | YES |
| income_lost (mat-29) | monthlyIncome, incomeType, lostWorkDays, employer | monthly_income, income_type, lost_work_days, employer_name | YES |
| death_record (mat-43) | deceasedName, deathDate, deathCause, deathLocation | deceased_name, death_date, death_cause, death_location | YES |
| household_proof (mat-7) | residentName, householdType, householdAddress | resident_name, household_type, household_address | YES |
| case_report | victimName, accidentDate, incidentSummary, deathConfirmed, claimants[] | victim_name, accident_date, incident_summary, death_confirmed, claimants[] | YES |

**结论**：主要是 snake_case → camelCase 的转换。在 `buildSummaryFromExtraction` 中按 summaryType 做字段名映射。

---

## Step 2: 材料 aiAuditPrompt 补充 sourceAnchors 输出要求

summaryExtractors 的唯一独有价值是 `sourceAnchors`（原文定位）。需要在相关材料模板的 `aiAuditPrompt` 中追加 sourceAnchors 输出要求。

**影响的材料**：MATERIAL_TO_SUMMARY_TYPE 映射的 ~20 个材料模板

在每个材料的 `aiAuditPrompt` 末尾追加：
```
另外，对每个提取的关键字段，请提供 sourceAnchors，格式：
"sourceAnchors": {
  "字段名": {"pageIndex": 0, "rawText": "原文片段", "highlightLevel": "text_search"}
}
```

**实现方式**：写一个迁移脚本批量更新 `claims-materials.json` 中对应材料的 aiAuditPrompt。

---

## Step 3: 替换调用点

### 3.1 scheduler.js（~line 340）

当前：
```javascript
const summaries = await extractDocumentSummaries(completedDocs, { skipImages: true });
completedDocs.forEach((doc, i) => { doc.documentSummary = summaries[i]; });
```

改为：
```javascript
const summaries = completedDocs.map(doc => buildSummaryFromExtraction({
  docId: doc.documentId,
  materialId: doc.classification?.materialId,
  extractedData: doc.structuredData || doc.extractedData,
  confidence: doc.confidence,
})).filter(Boolean);
completedDocs.forEach((doc, i) => {
  const summary = summaries.find(s => s.docId === doc.documentId);
  if (summary) doc.documentSummary = summary;
});
```

### 3.2 apiHandler.js（~line 4977, 5622）

同样替换 `extractDocumentSummaries()` 调用为 `buildSummaryFromExtraction()` 的批量调用。

---

## Step 4: 移除 summaryExtractors 的 AI 调用

不立即删除 `summaryExtractors/index.js`，而是：
1. 保留 `MATERIAL_TO_SUMMARY_TYPE` 映射（被 summaryBuilder 复用）
2. 将 `extractDocumentSummaries` / `extractDocumentSummary` 标记为 deprecated
3. `extractSummaryWithGemini` 不再被调用

后续可安全删除 `EXTRACTION_PROMPTS` 和 `extractSummaryWithGemini`。

---

## Step 5: caseAggregator 中 documentSummary fallback 清理

**文件**: `server/services/caseAggregator.js`（~line 110-127）

当前 fact 提取的 3 级 fallback：
```javascript
const sources = [structuredData, ocrData, documentSummary]
```

合并后 `documentSummary` 本质上就是 `structuredData` 的重新包装，fallback 可简化为：
```javascript
const sources = [structuredData, ocrData].filter(Boolean);
```

---

## 关键文件清单

| 文件 | 改动 |
|------|------|
| `server/services/summaryBuilder.js` | **新建** — 从 extractedData 构造 summary |
| `server/taskQueue/scheduler.js` | 替换 extractDocumentSummaries 调用 |
| `server/apiHandler.js` | 替换 extractDocumentSummaries 调用（2处） |
| `server/services/caseAggregator.js` | 移除 documentSummary fallback |
| `jsonlist/claims-materials.json` | ~20 个材料的 aiAuditPrompt 追加 sourceAnchors 要求 |
| `server/services/summaryExtractors/index.js` | 保留映射，deprecate AI 调用函数 |

---

## 不改的文件

- `caseAggregator.js` 的 5 个聚合函数（aggregateInjuryProfile 等）— 接口不变，接收的 summary 对象结构兼容
- `claimReviewService.js` — 读 documentSummary，结构兼容
- `decisionTraceService.js` — 读 summaryType，字段保持
- `claimMaterialPipeline.js` — 不改，它已经在做提取工作

---

## 验证方式

1. 启动 dev server，上传一份医疗费发票到理赔案件
2. 检查 `claim-materials` 记录中 `documentSummary` 字段存在且包含 `summaryType: "expense_invoice"`
3. 检查 console **没有** `[summaryExtractor]` 的 AI 调用日志
4. 触发案件聚合（通过理赔工作台），确认聚合结果正常（费用汇总、伤情汇总等）
5. 检查 `sourceAnchors` 字段存在于 documentSummary 中
