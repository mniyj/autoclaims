# 设计分析：AI 后台提示词管理模块 + Jinja 支持方案

## 一、当前设计的问题诊断

### 现状描述

当前 `AIPromptTemplate` 数据结构：

```typescript
interface AIPromptTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;            // 纯文本字符串，无结构
  requiredVariables?: string[]; // 仅变量名列表，无任何元数据
}
```

UI 层面：带黑色背景的 `<textarea>`，仅展示"必需占位变量：xxx, yyy"这样的平铺文字。

### 核心问题

| 问题 | 现状 | 影响 |
|------|------|------|
| 变量是"装饰性"的 | `requiredVariables` 只是名称数组，没有类型、来源、说明 | 运行时变量名拼错无法发现，静默失败 |
| 没有变量注入契约 | 前端不知道每个 capability 在运行时能提供哪些变量 | 编辑者无法知道"我能用什么变量" |
| 没有模板引擎 | 变量如何在运行时被替换，前端完全不定义 | 后端如何渲染完全黑盒 |
| 无法做条件/循环逻辑 | 纯文本无法写 `if 被保险人有糖尿病 then...` | 复杂理赔场景无法表达 |
| 编辑体验原始 | 普通 textarea，无语法高亮，无变量提示 | 提示词质量依赖编辑者的记忆力 |

### 结论：设计是合理的 v1 原型，但有明确的生产级改造空间

---

## 二、是否支持 Jinja？答案是：是，而且应该作为默认格式

### 为什么 Jinja 适合这个场景

1. **业务需求天然需要动态注入**
   - 理赔材料审核提示词需要注入：`{{ document_text }}`、`{{ claim_id }}`
   - 既往症评估提示词需要注入：`{{ patient_history }}`、`{{ diagnosis_codes }}`
   - 保障推断提示词需要注入：`{{ policy_coverage_rules }}`、`{{ claim_description }}`

2. **行业标准**：LangChain、LlamaIndex、Dify 等所有主流 AI 框架均使用 Jinja2 或其子集作为提示词模板语言

3. **现有 `requiredVariables` 字段已暗示这是设计意图**，只是没有完整实现

4. **Jinja2 在 Python 后端无需引入额外依赖**（Python 标准 AI 生态已包含）

### Jinja 格式样例（理赔材料审核）

```jinja2
你是一名专业的保险理赔审核员。请对以下上传的理赔材料进行审核。

**材料类型**: {{ material_type }}
**被保险人**: {{ insured_name }}（证件号：{{ insured_id_masked }}）
**案件编号**: {{ claim_case_id }}

**材料内容**:
{{ document_extracted_text }}

{% if additional_context %}
**补充信息**:
{{ additional_context }}
{% endif %}

请按照以下 JSON Schema 提取关键信息，并给出材料真实性评估（0-1 分）：
{{ json_schema }}
```

---

## 三、Jinja 与元数据的联动设计

### 核心思路：为每个 Capability 定义"变量上下文契约"

```typescript
// 新增：单个变量的完整元数据定义
interface AIPromptVariable {
  name: string;                          // 变量名，对应 {{ name }}
  jinjaPath: string;                     // Jinja 路径，如 {{ case.claim_id }}
  type: "string" | "number" | "object" | "array" | "boolean";
  description: string;                   // 业务含义说明
  example: string;                       // 样例值，用于预览渲染
  required: boolean;                     // 是否必须提供
  source: "claim_case" | "policy" | "document" | "system"; // 数据来源
}

// 每个 Capability 声明它在运行时能提供哪些变量
interface CapabilityVariableContext {
  capabilityId: string;
  variables: AIPromptVariable[];
}

// 升级后的模板定义
interface AIPromptTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  templateEngine: "plain" | "jinja2";   // 新增：明确模板格式
  variables?: AIPromptVariable[];        // 从 string[] 升级为完整元数据
}
```

### 变量目录示例（以"材料审核"能力为例）

| 变量名 | 来源 | 类型 | 说明 |
|--------|------|------|------|
| `material_type` | claim_case | string | 材料类型名称（如"出院小结"） |
| `insured_name` | policy | string | 被保险人姓名 |
| `insured_id_masked` | policy | string | 脱敏后的证件号 |
| `claim_case_id` | claim_case | string | 案件编号 |
| `document_extracted_text` | document | string | OCR/解析后的文件文本 |
| `json_schema` | system | string | 当前材料类型的 JSON Schema |
| `additional_context` | claim_case | string | 案件备注（可选） |

---

## 四、UI 改造方案

### 模板编辑器升级

**改造目标**（在当前 `components/AIConfigCenterPage.tsx:1154` 的 textarea 区域）：

```
┌──────────────────────────────────────────────────────────────┐
│  📋 出院小结审核模板                                           │
├──────────────────────────────────────────────────────────────┤
│  可用变量 (按数据来源分组)     │  模板内容编辑区               │
│  ──────────────────           │  ─────────────────────────  │
│  📁 理赔案件                   │  你是一名专业的保险理赔审核员。 │
│    {{ material_type }}  [插入] │                              │
│    {{ claim_case_id }}  [插入] │  材料类型:                   │
│    {{ additional_context }}   │  {{ material_type }}  ← 高亮 │
│  📁 保单信息                   │                              │
│    {{ insured_name }}  [插入]  │  {% if additional_context %} │
│    {{ insured_id_masked }}     │    {{ additional_context }}  │
│  📁 文档内容                   │  {% endif %}                 │
│    {{ document_extracted_text }}                              │
│  📁 系统                       │                              │
│    {{ json_schema }}           │                              │
├──────────────────────────────────────────────────────────────┤
│  [预览渲染效果]  [验证语法]  变量覆盖率: 5/6 ✓               │
└──────────────────────────────────────────────────────────────┘
```

**具体功能点：**
1. **Jinja 语法高亮**：`{{ }}` 显示为蓝色，`{% %}` 显示为橙色
2. **变量目录侧边栏**：按数据来源分组，点击 `[插入]` 在光标处插入 `{{ var_name }}`，hover 显示类型和样例值
3. **变量覆盖率检测**：自动扫描模板内的 `{{ }}` 变量，对比 capability 变量上下文，标红未定义变量
4. **模板预览**：用 `example` 字段的样例值渲染模板，展示最终发给 LLM 的文本（使用 `nunjucks` JS 库）
5. **语法验证**：检测括号未闭合、未知变量引用等错误

---

## 五、渐进实施计划

### Phase 1：类型升级 + 变量目录侧栏 + Jinja 高亮（主要工作）

**修改文件：**
- `types.ts:1489` — 升级 `AIPromptTemplate`，新增 `AIPromptVariable`、`CapabilityVariableContext` 接口
- `constants.ts` — 为现有 promptTemplates mock 数据补充 `variables` 元数据和 `templateEngine: "jinja2"`
- `components/AIConfigCenterPage.tsx:1154` — 将 textarea 区域改为 左侧变量目录 + 右侧高亮编辑器的双栏布局

**Jinja 高亮实现方式（无需引入重型库）：**
```tsx
// 用正则替换 + dangerouslySetInnerHTML 实现轻量高亮展示
// 编辑仍用 textarea（叠加在高亮层下方，透明文字）
// 这是 CodeMirror/Monaco 的简化替代方案
function highlightJinja(text: string): string {
  return text
    .replace(/\{\{.*?\}\}/g, m => `<span class="text-sky-400">${m}</span>`)
    .replace(/\{%.*?%\}/g, m => `<span class="text-amber-400">${m}</span>`);
}
```

### Phase 2：变量覆盖检测 + 预览渲染（可后续完善）

- 引入 `nunjucks`（JS 版 Jinja2 渲染库，~40KB gzip）
- 扫描模板 `{{ varName }}` 集合，与 capability 变量上下文对比
- "预览"按钮用样例值渲染模板

---

## 六、不需要做的事（避免过度设计）

- **不需要完整 Jinja 解析器**：只需高亮 `{{ }}` 和 `{% %}` 语法，预览用 nunjucks
- **不需要变量的 UI 管理界面**：变量目录静态定义在 constants 中即可
- **不需要后端变更**：这是纯前端编辑体验升级，后端渲染逻辑不在范围内
- **不需要重写 API 层**：`content: string` 字段不变，Jinja 模板仍存储为字符串

---

## 七、关键文件

| 文件 | 变更内容 |
|------|---------|
| `types.ts:1489` | 升级 `AIPromptTemplate`，新增 `AIPromptVariable`、`CapabilityVariableContext` 接口 |
| `constants.ts` | 为现有 promptTemplates mock 数据补充 `variables` 元数据和 `templateEngine: "jinja2"` |
| `components/AIConfigCenterPage.tsx:1154` | 替换 textarea 为 Jinja 高亮编辑器 + 变量目录侧栏 |

---

## 八、验证方法

1. 打开 AI 配置中心 → 模板中心 Tab
2. 点击任一模板，确认 `{{ variable }}` 语法高亮显示（蓝色）、`{% if %}` 高亮显示（橙色）
3. 左侧变量目录中点击 `[插入]`，确认变量插入到光标位置
4. 修改模板引入一个目录中不存在的变量，确认显示红色警告提示
5. 点击"预览渲染"，确认用样例值替换后的文本正确展示
