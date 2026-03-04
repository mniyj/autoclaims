# 索赔人端意图体系设计

> 完整版 - 用于智能体基于意图的工具调用
> 
> 版本: 1.0
> 日期: 2025-03-03

---

## 1. 意图体系概览

### 1.1 意图分类架构

```
索赔人端意图体系
├── 信息查询类 (Query)
│   ├── 理赔进度查询
│   ├── 材料清单查询
│   ├── 缺失材料查询
│   ├── 保费影响查询
│   ├── 赔付金额预估
│   ├── 理赔规则查询
│   └── 历史理赔查询
├── 材料提交类 (Document)
│   ├── 上传材料
│   ├── 材料补传
│   ├── 材料预览
│   ├── 材料删除
│   └── 材料分类确认
├── 理赔操作类 (Action)
│   ├── 提交报案
│   ├── 撤销报案
│   ├── 修改报案信息
│   ├── 申请加急
│   └── 转人工服务
├── 智能服务类 (AI Service)
│   ├── 文档分析
│   ├── 医疗发票审核
│   ├── 材料完整性检查
│   ├── 理赔资格自检
│   └── 智能客服对话
├── 账户服务类 (Account)
│   ├── 保单查询
│   ├── 个人信息查看
│   ├── 收款账户管理
│   └── 联系方式更新
└── 系统服务类 (System)
    ├── 帮助
    ├── 意见反馈
    ├── 操作引导
    └── 会话结束
```

---

## 2. 意图详细定义

### 2.1 信息查询类 (Query Intents)

#### `QUERY_PROGRESS` - 查询理赔进度
**描述**: 用户查询当前理赔案件的处理进度和状态

**触发场景**:
- 用户询问"我的理赔到哪一步了"
- 用户询问"审核还要多久"
- 用户询问"理赔结果出来了吗"
- 用户询问"什么时候能打款"

**实体参数**:
```typescript
{
  claimId?: string;      // 案件号
  policyId?: string;     // 保单号
  timeRange?: string;    // 时间范围
}
```

**对应工具**: `getClaimProgressTool`

**工具参数**:
```typescript
{
  claimId: string;
  includeTimeline?: boolean;  // 是否包含时间线
  includeDetails?: boolean;   // 是否包含详细信息
}
```

**返回数据** (ClaimProgressInfo):
```typescript
{
  claimId: string;
  status: ClaimStatus;
  statusLabel: string;
  progress: number;           // 进度百分比
  currentStage: string;       // 当前阶段
  estimatedCompletion?: string; // 预计完成时间
  timeline: ClaimEvent[];     // 事件时间线
  nextSteps?: string[];       // 下一步操作
}
```

**UI组件**: `ClaimProgressCard`

---

#### `QUERY_MATERIALS_LIST` - 查询理赔材料清单
**描述**: 用户查询特定理赔类型需要准备的材料清单

**触发场景**:
- 用户询问"理赔需要准备什么材料"
- 用户询问"都需要什么资料"
- 用户询问"材料要求是什么"

**实体参数**:
```typescript
{
  claimType?: string;      // 理赔类型(医疗/车险/意外险等)
  productCode?: string;    // 产品代码
  accidentType?: string;   // 事故类型
}
```

**对应工具**: `getMaterialsListTool`

**工具参数**:
```typescript
{
  claimType: string;
  productCode?: string;
  accidentCauseId?: string;  // 事故原因ID
}
```

**返回数据** (MaterialsListInfo):
```typescript
{
  claimType: string;
  materials: MaterialItem[];
  categories: {
    required: MaterialItem[];    // 必需材料
    optional: MaterialItem[];    // 可选材料
    conditional: MaterialItem[]; // 条件材料
  };
}
```

**UI组件**: `MaterialsChecklist`

---

#### `QUERY_MISSING_MATERIALS` - 查询缺失材料
**描述**: 用户查询当前案件还缺少哪些材料

**触发场景**:
- 用户询问"我还缺什么材料"
- 用户询问"还需要补充什么"
- 系统提醒材料不全时用户询问详情

**实体参数**:
```typescript
{
  claimId: string;         // 案件号（必需）
}
```

**对应工具**: `getMissingMaterialsTool`

**返回数据** (MissingMaterialsInfo):
```typescript
{
  claimId: string;
  missingItems: MaterialItem[];
  deadline?: string;       // 补交截止日期
  urgency: "low" | "medium" | "high";
  consequences?: string;   // 不补交的后果
}
```

**UI组件**: `MissingMaterialsAlert`

---

#### `QUERY_PREMIUM_IMPACT` - 查询保费影响
**描述**: 用户关心本次理赔对未来保费的影响

**触发场景**:
- 用户询问"理赔会影响明年保费吗"
- 用户询问"报了案明年保费会涨吗"
- 用户询问"NCD折扣还有吗"

**实体参数**:
```typescript
{
  policyId?: string;       // 保单号
  claimType?: string;      // 理赔类型
  claimAmount?: number;    // 理赔金额
}
```

**对应工具**: `getPremiumImpactTool`

**返回数据** (PremiumImpactInfo):
```typescript
{
  currentNCD: number;      // 当前无赔款优待系数
  nextYearNCD: number;     // 明年系数
  premiumChange: {
    amount: number;        // 金额变化
    percentage: number;    // 百分比变化
    direction: "increase" | "decrease" | "no_change";
  };
  explanation: string;     // 说明
  suggestions: string[];   // 建议
}
```

**UI组件**: `PremiumImpactInfo`

---

#### `QUERY_ESTIMATED_AMOUNT` - 查询预估赔付金额
**描述**: 用户希望在正式提交前了解大概能赔多少钱

**触发场景**:
- 用户询问"这种情况能赔多少"
- 用户询问"预估赔付金额是多少"
- 用户上传发票后询问赔付额

**实体参数**:
```typescript
{
  policyId: string;        // 保单号
  invoiceAmount?: number;  // 发票金额
  medicalData?: MedicalInvoiceData;
}
```

**对应工具**: `calculateEstimatedAmountTool`

**返回数据**:
```typescript
{
  estimatedAmount: number;     // 预估金额
  maxAmount: number;           // 最高赔付
  minAmount: number;           // 最低赔付
  calculationBasis: string;    // 计算依据
  factors: {
    deductible: number;        // 免赔额
    reimbursementRatio: number; // 报销比例
    capAmount?: number;        // 封顶金额
  };
}
```

**UI组件**: `EstimatedAmountCard`

---

#### `QUERY_CLAIM_RULES` - 查询理赔规则
**描述**: 用户想了解具体的理赔规则和条款

**触发场景**:
- 用户询问"什么情况下可以理赔"
- 用户询问"免赔额是多少"
- 用户询问"报销比例是多少"

**实体参数**:
```typescript
{
  productCode?: string;    // 产品代码
  ruleType?: string;       // 规则类型
}
```

**对应工具**: `getClaimRulesTool`

---

#### `QUERY_HISTORICAL_CLAIMS` - 查询历史理赔
**描述**: 用户查询过往理赔记录

**触发场景**:
- 用户询问"我以前理赔过哪些"
- 用户询问"去年的理赔记录"

**实体参数**:
```typescript
{
  timeRange?: string;      // 时间范围
  status?: ClaimStatus;    // 状态筛选
}
```

**对应工具**: `getHistoricalClaimsTool`

---

### 2.2 材料提交类 (Document Intents)

#### `UPLOAD_DOCUMENT` - 上传材料
**描述**: 用户上传理赔相关材料

**触发场景**:
- 用户点击上传按钮
- 用户发送图片/文件
- 用户拍照上传

**实体参数**:
```typescript
{
  claimId?: string;        // 案件号
  materialType?: string;   // 材料类型
  fileType?: string;       // 文件类型
}
```

**对应工具**: `uploadDocumentTool`

**工具参数**:
```typescript
{
  claimId: string;
  file: File;
  materialTypeId?: string;  // 材料类型ID
  autoClassify?: boolean;   // 是否自动分类
}
```

**返回数据**:
```typescript
{
  documentId: string;
  ossKey: string;
  ossUrl: string;
  status: "uploaded" | "processing" | "completed";
  classification?: {
    materialId: string;
    materialName: string;
    confidence: number;
  };
}
```

---

#### `UPLOAD_SUPPLEMENT` - 补传材料
**描述**: 用户补充上传缺失的材料

**触发场景**:
- 系统提示缺材料后用户上传
- 用户主动补充材料

**实体参数**:
```typescript
{
  claimId: string;         // 案件号
  missingMaterialId: string; // 缺失材料ID
}
```

**对应工具**: `uploadSupplementTool`

---

#### `CLASSIFY_DOCUMENT` - 材料分类确认
**描述**: AI自动分类后需要用户确认

**触发场景**:
- AI识别材料类型后询问用户
- 用户纠正AI的分类

**实体参数**:
```typescript
{
  documentId: string;
  suggestedType: string;
  userConfirmed: boolean;
  correctType?: string;
}
```

**对应工具**: `classifyDocumentTool`

---

#### `PREVIEW_DOCUMENT` - 预览材料
**描述**: 用户查看已上传的材料

**实体参数**:
```typescript
{
  documentId: string;
}
```

**对应工具**: `previewDocumentTool`

---

#### `DELETE_DOCUMENT` - 删除材料
**描述**: 用户删除已上传的材料

**实体参数**:
```typescript
{
  documentId: string;
  claimId: string;
}
```

**对应工具**: `deleteDocumentTool`

---

### 2.3 理赔操作类 (Action Intents)

#### `SUBMIT_CLAIM` - 提交报案
**描述**: 用户正式提交理赔申请

**触发场景**:
- 用户填写完报案信息后提交
- 用户确认材料齐全后提交

**实体参数**:
```typescript
{
  policyId: string;        // 保单号
  incidentType: string;    // 事故类型
  incidentTime: string;    // 事故时间
  incidentLocation?: string; // 事故地点
  description: string;     // 事故描述
  claimAmount?: number;    // 索赔金额
}
```

**对应工具**: `submitClaimTool`

**返回数据**:
```typescript
{
  success: boolean;
  claimId: string;         // 案件号
  reportNumber: string;    // 报案号
  status: ClaimStatus;
  nextSteps: string[];
  estimatedProcessingTime: string;
}
```

---

#### `CANCEL_CLAIM` - 撤销报案
**描述**: 用户撤销已提交的理赔申请

**触发场景**:
- 用户改变主意不想理赔了
- 用户发现不符合理赔条件

**实体参数**:
```typescript
{
  claimId: string;
  reason?: string;         // 撤销原因
}
```

**对应工具**: `cancelClaimTool`

---

#### `MODIFY_CLAIM` - 修改报案信息
**描述**: 用户修改已提交的报案信息

**实体参数**:
```typescript
{
  claimId: string;
  fields: Record<string, any>; // 要修改的字段
}
```

**对应工具**: `modifyClaimTool`

---

#### `REQUEST_EXPEDITE` - 申请加急
**描述**: 用户申请加快处理速度

**触发场景**:
- 用户急需用钱
- 特殊情况需要加急

**实体参数**:
```typescript
{
  claimId: string;
  reason: string;          // 加急原因
  urgencyLevel: "high" | "urgent" | "critical";
}
```

**对应工具**: `requestExpediteTool`

---

#### `REQUEST_MANUAL_SERVICE` - 转人工服务
**描述**: 用户要求转接人工客服

**触发场景**:
- AI无法解决问题
- 用户主动要求人工
- 复杂情况需要人工介入

**实体参数**:
```typescript
{
  claimId?: string;
  reason: string;          // 转人工原因
  priority?: "normal" | "high" | "urgent";
}
```

**对应工具**: `requestManualServiceTool`

---

### 2.4 智能服务类 (AI Service Intents)

#### `ANALYZE_DOCUMENT` - 文档分析
**描述**: 用户要求AI分析上传的文档

**触发场景**:
- 用户上传发票后询问"这是什么"
- 用户询问"这张发票能理赔吗"

**实体参数**:
```typescript
{
  documentId: string;
  documentType?: string;   // 文档类型
}
```

**对应工具**: `analyzeDocumentTool`

**返回数据** (DocumentAnalysis):
```typescript
{
  category: string;
  isRelevant: boolean;     // 是否与理赔相关
  relevanceReasoning: string;
  clarityScore: number;    // 清晰度评分
  completenessScore: number; // 完整性评分
  summary: string;         // 摘要
  missingFields: string[]; // 缺失字段
  ocr: OCRData;
  medicalData?: MedicalInvoiceData;
}
```

---

#### `AUDIT_INVOICE` - 医疗发票审核
**描述**: 用户要求AI审核医疗发票

**实体参数**:
```typescript
{
  documentId: string;
  policyId?: string;
  productCode?: string;
}
```

**对应工具**: `auditInvoiceTool`

**返回数据** (InvoiceAuditResult):
```typescript
{
  invoiceId: string;
  ocrData: MedicalInvoiceData;
  hospitalValidation: {
    hospitalName: string;
    isQualified: boolean;
    reason?: string;
  };
  itemAudits: InvoiceItemAudit[];
  summary: {
    totalAmount: number;
    qualifiedAmount: number;
    unqualifiedAmount: number;
    estimatedReimbursement: number;
  };
}
```

---

#### `CHECK_COMPLETENESS` - 材料完整性检查
**描述**: 用户询问材料是否齐全

**实体参数**:
```typescript
{
  claimId: string;
}
```

**对应工具**: `checkCompletenessTool`

**返回数据** (DocumentCompletenessResult):
```typescript
{
  isComplete: boolean;
  completenessScore: number;
  requiredMaterials: string[];
  providedMaterials: string[];
  missingMaterials: string[];
  optionalMaterials: string[];
}
```

---

#### `CHECK_ELIGIBILITY` - 理赔资格自检
**描述**: 用户在正式报案前自检是否符合理赔条件

**触发场景**:
- 用户询问"我这个情况能理赔吗"
- 用户想确认是否符合理赔条件

**实体参数**:
```typescript
{
  policyId: string;
  incidentType: string;
  incidentTime: string;
  description: string;
}
```

**对应工具**: `checkEligibilityTool`

**返回数据**:
```typescript
{
  eligible: boolean;       // 是否符合条件
  confidence: number;      // 置信度
  matchedRules: string[];  // 匹配的规则
  rejectionReasons?: string[]; // 拒赔原因
  warnings?: string[];     // 警告信息
  suggestions?: string[];  // 建议
}
```

---

#### `GENERAL_CHAT` - 普通对话
**描述**: 无法归类为特定意图的一般性对话

**触发场景**:
- 闲聊、问候
- 模糊的表达
- 无法识别的意图

**实体参数**: `{}`

**对应工具**: `generalChatTool`

---

### 2.5 账户服务类 (Account Intents)

#### `QUERY_POLICIES` - 查询保单
**描述**: 用户查询自己的保单列表

**实体参数**:
```typescript
{
  status?: PolicyStatus;   // 保单状态筛选
}
```

**对应工具**: `getPoliciesTool`

---

#### `VIEW_PROFILE` - 查看个人信息
**描述**: 用户查看或管理个人信息

**对应工具**: `getProfileTool`

---

#### `MANAGE_PAYMENT_ACCOUNT` - 管理收款账户
**描述**: 用户管理理赔收款账户

**实体参数**:
```typescript
{
  action: "add" | "update" | "delete" | "query";
  accountInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
}
```

**对应工具**: `managePaymentAccountTool`

---

### 2.6 系统服务类 (System Intents)

#### `GET_HELP` - 获取帮助
**描述**: 用户寻求帮助或操作指南

**实体参数**:
```typescript
{
  topic?: string;          // 帮助主题
}
```

**对应工具**: `getHelpTool`

---

#### `SUBMIT_FEEDBACK` - 提交反馈
**描述**: 用户提交意见或反馈

**实体参数**:
```typescript
{
  type: "suggestion" | "complaint" | "bug" | "praise";
  content: string;
  rating?: number;         // 评分
}
```

**对应工具**: `submitFeedbackTool`

---

#### `GET_GUIDANCE` - 操作引导
**描述**: 用户需要系统引导如何操作

**实体参数**:
```typescript
{
  currentStep?: string;    // 当前步骤
  targetStep?: string;     // 目标步骤
}
```

**对应工具**: `getGuidanceTool`

---

#### `END_SESSION` - 结束会话
**描述**: 用户结束当前对话

**对应工具**: `endSessionTool`

---

## 3. 意图识别配置

### 3.1 Gemini Function Calling 配置

```typescript
const INTENT_RECOGNITION_TOOL = {
  name: "recognize_intent",
  description: "识别用户的意图并提取相关实体参数",
  parameters: {
    type: Type.OBJECT,
    properties: {
      intent: {
        type: Type.STRING,
        enum: [
          // 信息查询类
          "QUERY_PROGRESS",
          "QUERY_MATERIALS_LIST", 
          "QUERY_MISSING_MATERIALS",
          "QUERY_PREMIUM_IMPACT",
          "QUERY_ESTIMATED_AMOUNT",
          "QUERY_CLAIM_RULES",
          "QUERY_HISTORICAL_CLAIMS",
          // 材料提交类
          "UPLOAD_DOCUMENT",
          "UPLOAD_SUPPLEMENT",
          "CLASSIFY_DOCUMENT",
          "PREVIEW_DOCUMENT",
          "DELETE_DOCUMENT",
          // 理赔操作类
          "SUBMIT_CLAIM",
          "CANCEL_CLAIM",
          "MODIFY_CLAIM",
          "REQUEST_EXPEDITE",
          "REQUEST_MANUAL_SERVICE",
          // 智能服务类
          "ANALYZE_DOCUMENT",
          "AUDIT_INVOICE",
          "CHECK_COMPLETENESS",
          "CHECK_ELIGIBILITY",
          // 账户服务类
          "QUERY_POLICIES",
          "VIEW_PROFILE",
          "MANAGE_PAYMENT_ACCOUNT",
          // 系统服务类
          "GET_HELP",
          "SUBMIT_FEEDBACK",
          "GET_GUIDANCE",
          "END_SESSION",
          // 兜底
          "GENERAL_CHAT"
        ],
        description: "识别出的用户意图类型"
      },
      confidence: {
        type: Type.NUMBER,
        description: "意图识别的置信度 (0-1)"
      },
      entities: {
        type: Type.OBJECT,
        description: "从用户输入中提取的实体参数"
      },
      reasoning: {
        type: Type.STRING,
        description: "意图识别的推理过程简述"
      }
    },
    required: ["intent", "confidence", "entities"]
  }
};
```

### 3.2 意图识别 Prompt

```typescript
const INTENT_RECOGNITION_PROMPT = `你是保险理赔客服智能助手，专门负责识别用户意图。

## 可识别的意图类型

### 信息查询类
1. **QUERY_PROGRESS** - 查询理赔进度
   - 关键词：进度、状态、进展、到哪了、多久了、审核、结果、什么时候
   - 示例："我的理赔进度怎么样了？" "还要多久能审核完？"

2. **QUERY_MATERIALS_LIST** - 查询理赔材料清单
   - 关键词：需要什么、材料清单、都要什么、材料要求、准备什么
   - 示例："理赔需要什么材料？" "我要准备哪些资料？"

3. **QUERY_MISSING_MATERIALS** - 查询缺失材料
   - 关键词：还缺什么、补充什么、差什么、哪些没交、缺少、遗漏
   - 示例："我还需要补充什么材料？"

4. **QUERY_PREMIUM_IMPACT** - 查询保费影响
   - 关键词：保费、涨价、下年、NCD、无赔款优待、影响、上浮
   - 示例："这次理赔会影响明年的保费吗？"

5. **QUERY_ESTIMATED_AMOUNT** - 查询预估赔付
   - 关键词：能赔多少、预估、大概赔多少、赔付金额
   - 示例："这种情况能赔多少钱？"

### 材料提交类
6. **UPLOAD_DOCUMENT** - 上传材料
   - 场景：用户上传图片、文件、拍照
   
7. **UPLOAD_SUPPLEMENT** - 补传材料
   - 场景：用户补充上传缺失的材料

### 理赔操作类
8. **SUBMIT_CLAIM** - 提交报案
   - 场景：用户正式提交理赔申请

9. **CANCEL_CLAIM** - 撤销报案
   - 场景：用户撤销理赔申请

10. **REQUEST_EXPEDITE** - 申请加急
    - 场景：用户申请加快处理

11. **REQUEST_MANUAL_SERVICE** - 转人工服务
    - 场景：用户要求人工客服

### 智能服务类
12. **ANALYZE_DOCUMENT** - 文档分析
    - 场景：用户要求分析上传的文档

13. **AUDIT_INVOICE** - 发票审核
    - 场景：用户要求审核医疗发票

14. **CHECK_COMPLETENESS** - 完整性检查
    - 场景：用户询问材料是否齐全

15. **CHECK_ELIGIBILITY** - 资格自检
    - 场景：用户询问是否符合理赔条件

### 账户服务类
16. **QUERY_POLICIES** - 查询保单
    - 场景：用户查看自己的保单

### 兜底
17. **GENERAL_CHAT** - 普通对话
    - 场景：闲聊、问候、无法归类的内容

## 识别规则

1. 仔细分析用户的自然语言输入
2. 提取案件号、保单号、理赔类型等实体信息
3. 如果置信度低于 0.7，归类为 GENERAL_CHAT
4. 如果用户表达模糊，优先归类为 GENERAL_CHAT
5. 结合对话上下文理解用户意图

## 返回格式

使用 recognize_intent 工具返回识别结果。`;
```

---

## 4. 工具注册表

### 4.1 工具处理器映射

```typescript
// intentTools.ts
import {
  IntentType,
  IntentEntities,
  ClaimState,
  ToolResponse
} from "./types";

// 工具处理器类型定义
type ToolHandler = (
  entities: IntentEntities,
  claimState: ClaimState
) => Promise<ToolResponse>;

// 工具注册表
const TOOL_REGISTRY: Record<IntentType, ToolHandler> = {
  // 信息查询类
  [IntentType.QUERY_PROGRESS]: handleQueryProgress,
  [IntentType.QUERY_MATERIALS_LIST]: handleQueryMaterialsList,
  [IntentType.QUERY_MISSING_MATERIALS]: handleQueryMissingMaterials,
  [IntentType.QUERY_PREMIUM_IMPACT]: handleQueryPremiumImpact,
  [IntentType.QUERY_ESTIMATED_AMOUNT]: handleQueryEstimatedAmount,
  [IntentType.QUERY_CLAIM_RULES]: handleQueryClaimRules,
  [IntentType.QUERY_HISTORICAL_CLAIMS]: handleQueryHistoricalClaims,
  
  // 材料提交类
  [IntentType.UPLOAD_DOCUMENT]: handleUploadDocument,
  [IntentType.UPLOAD_SUPPLEMENT]: handleUploadSupplement,
  [IntentType.CLASSIFY_DOCUMENT]: handleClassifyDocument,
  [IntentType.PREVIEW_DOCUMENT]: handlePreviewDocument,
  [IntentType.DELETE_DOCUMENT]: handleDeleteDocument,
  
  // 理赔操作类
  [IntentType.SUBMIT_CLAIM]: handleSubmitClaim,
  [IntentType.CANCEL_CLAIM]: handleCancelClaim,
  [IntentType.MODIFY_CLAIM]: handleModifyClaim,
  [IntentType.REQUEST_EXPEDITE]: handleRequestExpedite,
  [IntentType.REQUEST_MANUAL_SERVICE]: handleRequestManualService,
  
  // 智能服务类
  [IntentType.ANALYZE_DOCUMENT]: handleAnalyzeDocument,
  [IntentType.AUDIT_INVOICE]: handleAuditInvoice,
  [IntentType.CHECK_COMPLETENESS]: handleCheckCompleteness,
  [IntentType.CHECK_ELIGIBILITY]: handleCheckEligibility,
  
  // 账户服务类
  [IntentType.QUERY_POLICIES]: handleQueryPolicies,
  [IntentType.VIEW_PROFILE]: handleViewProfile,
  [IntentType.MANAGE_PAYMENT_ACCOUNT]: handleManagePaymentAccount,
  
  // 系统服务类
  [IntentType.GET_HELP]: handleGetHelp,
  [IntentType.SUBMIT_FEEDBACK]: handleSubmitFeedback,
  [IntentType.GET_GUIDANCE]: handleGetGuidance,
  [IntentType.END_SESSION]: handleEndSession,
  
  // 兜底
  [IntentType.GENERAL_CHAT]: handleGeneralChat
};

/**
 * 执行意图对应的工具
 */
export async function executeTool(
  intent: IntentType,
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  const handler = TOOL_REGISTRY[intent];
  
  if (!handler) {
    return {
      success: false,
      data: null,
      message: "暂不支持此功能"
    };
  }
  
  try {
    return await handler(entities, claimState);
  } catch (error) {
    console.error(`[Tool Execution Error] ${intent}:`, error);
    return {
      success: false,
      data: null,
      message: "执行失败，请稍后重试"
    };
  }
}
```

---

## 5. UI组件映射

### 5.1 意图与UI组件对应关系

| 意图 | UI组件 | 说明 |
|------|--------|------|
| QUERY_PROGRESS | `ClaimProgressCard` | 理赔进度卡片 |
| QUERY_MATERIALS_LIST | `MaterialsChecklist` | 材料清单检查表 |
| QUERY_MISSING_MATERIALS | `MissingMaterialsAlert` | 缺失材料提醒 |
| QUERY_PREMIUM_IMPACT | `PremiumImpactInfo` | 保费影响说明 |
| QUERY_ESTIMATED_AMOUNT | `EstimatedAmountCard` | 预估金额卡片 |
| UPLOAD_DOCUMENT | `DocumentUploader` | 文档上传组件 |
| SUBMIT_CLAIM | `ClaimSubmissionForm` | 报案提交表单 |
| ANALYZE_DOCUMENT | `DocumentAnalysisResult` | 文档分析结果 |
| AUDIT_INVOICE | `InvoiceAuditResult` | 发票审核结果 |
| CHECK_COMPLETENESS | `CompletenessCheckResult` | 完整性检查结果 |
| GENERAL_CHAT | `ChatMessage` | 普通聊天消息 |

---

## 6. 快速意图检测（前端预判）

### 6.1 关键词映射表

```typescript
export function quickIntentDetection(userInput: string): IntentType | null {
  const text = userInput.toLowerCase();
  
  // 进度查询
  const progressKeywords = ['进度', '状态', '进展', '到哪', '多久', '审核', '结果', '什么时候', '好了吗'];
  if (progressKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_PROGRESS;
  }
  
  // 材料清单
  const materialsKeywords = ['需要什么', '材料', '清单', '准备', '提交', '资料', '要哪些'];
  if (materialsKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_MATERIALS_LIST;
  }
  
  // 缺失材料
  const missingKeywords = ['还缺', '还差', '补充', '没交', '遗漏', '缺少', '不齐'];
  if (missingKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_MISSING_MATERIALS;
  }
  
  // 保费影响
  const premiumKeywords = ['保费', '涨价', '上浮', '下年', '明年', 'ncd', '折扣', '无赔款', '影响'];
  if (premiumKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_PREMIUM_IMPACT;
  }
  
  // 预估金额
  const estimateKeywords = ['能赔多少', '预估', '大概', '赔付金额', '赔多少'];
  if (estimateKeywords.some(k => text.includes(k))) {
    return IntentType.QUERY_ESTIMATED_AMOUNT;
  }
  
  // 资格检查
  const eligibilityKeywords = ['能理赔吗', '符合条件', '可以报吗', '能报吗', '能不能赔'];
  if (eligibilityKeywords.some(k => text.includes(k))) {
    return IntentType.CHECK_ELIGIBILITY;
  }
  
  // 人工服务
  const manualKeywords = ['人工', '客服', '找人工', '转人工', '人工客服'];
  if (manualKeywords.some(k => text.includes(k))) {
    return IntentType.REQUEST_MANUAL_SERVICE;
  }
  
  // 帮助
  const helpKeywords = ['帮助', '怎么用', '不会', '教教我', '怎么操作'];
  if (helpKeywords.some(k => text.includes(k))) {
    return IntentType.GET_HELP;
  }
  
  return null;
}
```

---

## 7. 意图实现优先级

### 7.1 优先级划分

| 优先级 | 意图 | 说明 |
|--------|------|------|
| **P0 - 核心** | QUERY_PROGRESS | 最常用，必须实现 |
| **P0 - 核心** | QUERY_MATERIALS_LIST | 高频需求 |
| **P0 - 核心** | QUERY_MISSING_MATERIALS | 高频需求 |
| **P0 - 核心** | UPLOAD_DOCUMENT | 核心功能 |
| **P0 - 核心** | SUBMIT_CLAIM | 核心功能 |
| **P0 - 核心** | GENERAL_CHAT | 兜底能力 |
| **P1 - 重要** | QUERY_PREMIUM_IMPACT | 用户关心 |
| **P1 - 重要** | QUERY_ESTIMATED_AMOUNT | 实用功能 |
| **P1 - 重要** | ANALYZE_DOCUMENT | AI特色功能 |
| **P1 - 重要** | CHECK_ELIGIBILITY | 实用功能 |
| **P1 - 重要** | REQUEST_MANUAL_SERVICE | 服务保障 |
| **P2 - 增强** | AUDIT_INVOICE | 深度AI功能 |
| **P2 - 增强** | CHECK_COMPLETENESS | 实用功能 |
| **P2 - 增强** | QUERY_POLICIES | 账户服务 |
| **P2 - 增强** | CANCEL_CLAIM | 完整流程 |
| **P3 - 完善** | 其他所有意图 | 锦上添花 |

---

## 8. 扩展示例

### 8.1 如何添加新意图

以添加 `QUERY_CLAIM_RULES` 为例：

#### 步骤 1: 在 IntentType 枚举中添加

```typescript
// types.ts
export enum IntentType {
  // ... 现有意图
  QUERY_CLAIM_RULES = "QUERY_CLAIM_RULES",  // 新增
  GENERAL_CHAT = "GENERAL_CHAT"
}
```

#### 步骤 2: 在 intentTools.ts 中添加处理器

```typescript
// intentTools.ts
const TOOL_REGISTRY: Record<IntentType, ToolHandler> = {
  // ... 现有映射
  [IntentType.QUERY_CLAIM_RULES]: handleQueryClaimRules,  // 新增
  [IntentType.GENERAL_CHAT]: handleGeneralChat
};

// 实现处理器
async function handleQueryClaimRules(
  entities: IntentEntities,
  claimState: ClaimState
): Promise<ToolResponse> {
  // 1. 获取产品代码
  const productCode = entities.productCode || claimState.selectedPolicyId;
  
  // 2. 调用 API 获取规则
  const rules = await fetchClaimRules(productCode);
  
  // 3. 返回结果
  return {
    success: true,
    data: rules,
    message: `为您查询到以下理赔规则...`,
    uiComponent: UIComponentType.CLAIM_RULES,
    uiData: rules
  };
}
```

#### 步骤 3: 添加 UI 组件类型

```typescript
// types.ts
export enum UIComponentType {
  // ... 现有组件
  CLAIM_RULES = "CLAIM_RULES",  // 新增
}
```

#### 步骤 4: 更新意图识别 Prompt

```typescript
// intentService.ts
const INTENT_RECOGNITION_PROMPT = `
## 可识别的意图类型

// ... 现有意图说明

18. **QUERY_CLAIM_RULES** - 查询理赔规则
    - 关键词：规则、条款、免赔额、报销比例、条件
    - 示例："免赔额是多少？" "什么情况下能理赔？"

// ... 其他内容
`;

// 更新工具定义中的 enum
const INTENT_RECOGNITION_TOOL = {
  // ...
  parameters: {
    properties: {
      intent: {
        enum: [
          // ... 现有意图
          "QUERY_CLAIM_RULES",  // 新增
          "GENERAL_CHAT"
        ]
      }
    }
  }
};
```

#### 步骤 5: 添加关键词检测（可选）

```typescript
// intentService.ts - quickIntentDetection
const rulesKeywords = ['规则', '条款', '免赔额', '报销比例', '条件'];
if (rulesKeywords.some(k => text.includes(k))) {
  return IntentType.QUERY_CLAIM_RULES;
}
```

#### 步骤 6: 添加中文标签

```typescript
// intentService.ts - getIntentLabel
const labels: Record<IntentType, string> = {
  // ... 现有标签
  [IntentType.QUERY_CLAIM_RULES]: "查询理赔规则",  // 新增
  [IntentType.GENERAL_CHAT]: "普通对话"
};
```

---

## 9. 总结

本文档完整定义了索赔人端意图体系，包含：

1. **6大类意图**：信息查询、材料提交、理赔操作、智能服务、账户服务、系统服务
2. **30+个具体意图**：覆盖索赔人全场景需求
3. **完整的工具映射**：每个意图对应具体的工具函数
4. **UI组件映射**：每个意图对应前端展示组件
5. **扩展指南**：清晰说明如何添加新意图

这套意图体系可作为智能体设计的完整规范，支持：
- 基于 Gemini Function Calling 的意图识别
- 意图到工具的自动路由
- 意图到UI组件的自动渲染
- 快速意图检测的前端优化
