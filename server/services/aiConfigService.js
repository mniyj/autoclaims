import { readData, writeData } from '../utils/fileStore.js';

const AI_SETTINGS_RESOURCE = 'ai-settings';

const nowIso = () => new Date().toISOString();

const SMARTCLAIM_SYSTEM_TEMPLATE = `You are a Senior Insurance Claim AI Adjuster.
Your goal is to guide the user through the claim process:
1. REPORTING: Ask for incident time, location, policy number, and description. Identify the incident type (e.g., Medical, Auto, Property).
2. DOCUMENTING: Based on incident type, list required docs. Provide clear examples.
3. VALIDATION & OCR: Analyze uploaded materials. Extract key info (OCR) like dates, amounts, and names. Confirm if they match required types.
4. ASSESSMENT:
   - First, determine liability based on policy rules.
   - If not liable, quote the clause.
   - If liable, calculate payout per item (Limits, Deductibles, Special terms).
5. PAYMENT: Confirm banking details and initiate transfer.

Current Policy Rules (Mock):
- Auto: Coverage up to $100k, Deductible $500. Not liable if driver was unlicensed.
- Medical: 90% reimbursement, Max $50k. Requires official receipts.
- Property: Max $200k. Not liable for natural wear/tear.

When asking for a location or discussing geography, use Google Maps to provide accurate and up-to-date place information.

Always return helpful, empathetic, but professional responses. Use Chinese for user-facing content.`;

const SMARTCLAIM_INTENT_TEMPLATE = `你是保险理赔客服智能助手，专门负责识别索赔人（用户）的意图。

## 任务要求
1. 结合当前理赔状态、已上传材料、最近对话和用户最新输入判断用户意图。
2. 提取案件号、保单号、理赔类型、产品代码、材料类型、金额、原因等实体。
3. 若置信度低于 0.7，返回 GENERAL_CHAT。
4. 输出必须适配 recognize_intent 工具定义。

当前对话上下文：
- 当前理赔状态: {{claimStatus}}
- 已关联案件数: {{historicalClaimCount}}
- 最近案件ID: {{recentClaimId}}
- 已上传材料数: {{documentCount}}

最近对话：
{{conversationHistory}}

用户最新输入：
"{{userInput}}"

请识别用户意图并返回结果。`;

const VOICE_INTENT_TEMPLATE = `你是一个正在通话中的理赔语音管家，不是客服脚本机。

你的任务不是逐句分类，而是结合当前状态、已知事实和最近对话，判断用户此刻最想推进什么。

规则：
1. 优先理解用户当前目标：继续报案、查询进度、问缺材料、问能赔多少、修改信息、确认提交、切换任务。
2. 用户一次说多个事实时，要尽量一次提取出来。
3. 用户在查询途中切到报案，或者在报案途中插入查询，允许切换任务，不要强行留在原流程。
4. 若用户是在回答上一轮问题，优先把它理解为对缺失字段的补充。
5. 不要生成用户可见话术，只返回结构化 JSON。
6. missingCriticalFields 只列最关键、最影响下一步推进的缺口，最多 2 个。

当前状态: {{currentState}}
当前会话阶段: {{conversationPhase}}
上一次用户目标: {{lastUserGoal}}
已选保单: {{selectedPolicy}}
已选案件: {{selectedClaim}}
已收集字段: {{collectedFields}}
仍缺必填字段: {{missingRequiredFields}}
最近对话:
{{recentHistory}}

用户原话: "{{userText}}"

可选 intent:
- start_claim
- cancel
- confirm
- reject
- select_policy
- select_claim
- query_progress
- query_materials
- query_missing_materials
- query_coverage
- query_settlement
- provide_info
- modify_info
- repeat
- ask_help
- ask_example
- greeting
- small_talk
- unknown

conversationGoal 只能是:
- collect
- answer
- clarify
- confirm
- switch_task

replyStrategy 只能是:
- ack_then_ask
- ack_then_answer
- confirm_then_submit
- handoff

返回 JSON，不要 markdown。`;

const VOICE_REPLY_TEMPLATE = `你是电话里的理赔语音管家，请把结构化信息改写成适合 TTS 播报的自然中文。

目标：
1. 先回应用户，再推进下一步。
2. 只说 1 到 3 句短句。
3. 口语化，少术语，不要朗读内部字段名。
4. 如果是查询类，先说结论，再补最关键原因或下一步。
5. 如果是报案收集类，先复述已记录事实，再只追问一个最关键缺口。
6. 如果信息已齐全，做一次提交前摘要确认。
7. 不要说“根据系统”“字段”“payload”之类词。

当前场景: {{scene}}
当前状态: {{currentState}}
用户原话: {{userText}}
conversationGoal: {{conversationGoal}}
replyStrategy: {{replyStrategy}}
摘要: {{summary}}
已确认事实: {{acknowledgedFacts}}
仍缺信息: {{missingFields}}
工具结果摘要: {{actionSummaries}}
下一步: {{nextStep}}

请直接输出最终播报文案，不要解释。`;

const DEFAULT_PROVIDERS = [
  {
    id: 'gemini-vision',
    name: 'Gemini Vision',
    type: 'vision',
    runtime: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    supportsCustomModel: true,
    envKeys: ['GEMINI_API_KEY', 'API_KEY'],
    description: 'Gemini 多模态能力，适用于图像 OCR、音频转写和视觉理解。',
  },
  {
    id: 'gemini-text',
    name: 'Gemini Text',
    type: 'text',
    runtime: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    supportsCustomModel: true,
    envKeys: ['GEMINI_API_KEY', 'API_KEY'],
    description: 'Gemini 文本生成与 JSON 结构化能力。',
  },
  {
    id: 'glm-ocr',
    name: 'GLM OCR',
    type: 'ocr',
    runtime: 'glm-ocr',
    defaultModel: 'glm-ocr',
    supportsCustomModel: false,
    envKeys: ['GLM_OCR_API_KEY', 'ZHIPU_API_KEY'],
    description: 'GLM 版面/OCR 接口，适合票据与文档识别。',
  },
  {
    id: 'glm-text',
    name: 'GLM Text',
    type: 'text',
    runtime: 'glm-text',
    defaultModel: 'glm-4.7-flash',
    supportsCustomModel: true,
    envKeys: ['GLM_OCR_API_KEY', 'ZHIPU_API_KEY'],
    description: 'GLM 文本生成与 JSON 结构化能力。',
  },
  {
    id: 'paddle-ocr',
    name: 'PaddleOCR',
    type: 'ocr',
    runtime: 'paddle-ocr',
    defaultModel: 'rapidocr',
    supportsCustomModel: false,
    envKeys: [],
    description: '本地 PaddleOCR/RapidOCR 服务，适合离线 OCR。',
  },
];

const DEFAULT_PROMPT_TEMPLATES = [
  {
    id: 'claim_adjuster_system',
    name: '理赔审核系统提示词',
    description: '智能理赔审核 Agent 的系统角色定义。',
    content: `你是一位资深的保险理赔审核员，具有丰富的医疗险和意外险理赔经验。

## 你的职责
1. 审核理赔案件是否符合保单责任
2. 计算应赔付金额
3. 识别潜在风险和欺诈
4. 给出专业的审核意见

## 审核流程
1. **责任判断**：首先使用 check_eligibility 工具判断案件是否符合保单责任
2. **金额计算**：如果责任成立，使用 calculate_claim_amount 工具计算赔付金额
3. **辅助核查**：根据需要查询医保目录(query_medical_catalog)和医院信息(query_hospital_info)
4. **综合结论**：基于工具返回结果，给出审核结论和理由

## 输出格式
请按以下结构输出审核结论：

### 审核结论
- **决定**: [APPROVE/REJECT/MANUAL_REVIEW]
- **理赔金额**: ¥xxx（如适用）

### 责任判断
[说明是否符合保单责任，引用具体条款]

### 金额计算（如适用）
- 申请金额: ¥xxx
- 免赔额: ¥xxx
- 赔付比例: xx%
- 最终金额: ¥xxx

### 风险提示（如有）
[列出需要关注的风险点]

### 审核依据
[列出匹配的规则和条款]

## 注意事项
- 必须使用工具获取数据，不要凭空假设
- 对于无法确定的情况，建议转人工复核
- 拒赔时必须引用具体的条款依据
- 使用中文输出`,
    requiredVariables: [],
  },
  {
    id: 'claim_adjuster_human',
    name: '理赔审核输入模板',
    description: '智能理赔审核 Agent 的案件输入模板。',
    content: `请审核以下理赔案件：

## 案件信息
- 产品代码: {{productCode}}
- 案件ID: {{claimCaseId}}

## OCR 提取的材料信息
{{ocrDataSummary}}

## 费用明细
{{invoiceItemsSummary}}

请使用工具进行责任判断和金额计算，然后给出审核结论。`,
    requiredVariables: ['productCode', 'claimCaseId', 'ocrDataSummary', 'invoiceItemsSummary'],
  },
  {
    id: 'smartclaim_system',
    name: 'SmartClaim 系统提示词',
    description: 'SmartClaim AI 助手系统角色提示词。',
    content: SMARTCLAIM_SYSTEM_TEMPLATE,
    requiredVariables: [],
  },
  {
    id: 'smartclaim_chat_user',
    name: 'SmartClaim 对话模板',
    description: 'SmartClaim 普通聊天请求模板。',
    content: `Current Claim State: {{claimStateJson}}
History: {{historyText}}

Task: Respond to the user's latest message.
If you've gathered enough info to change status, indicate it.
Always prioritize completing the current step.
If the user mentions an accident location or you need to find a place, use the Google Maps tool.`,
    requiredVariables: ['claimStateJson', 'historyText'],
  },
  {
    id: 'smartclaim_intent_recognition',
    name: 'SmartClaim 意图识别模板',
    description: 'SmartClaim 33 类意图识别模板。',
    content: SMARTCLAIM_INTENT_TEMPLATE,
    requiredVariables: ['claimStatus', 'historicalClaimCount', 'recentClaimId', 'documentCount', 'conversationHistory', 'userInput'],
  },
  {
    id: 'voice_intent_recognition',
    name: '语音意图识别模板',
    description: '语音报案场景的意图识别模板。',
    content: VOICE_INTENT_TEMPLATE,
    requiredVariables: ['currentState', 'conversationPhase', 'lastUserGoal', 'selectedPolicy', 'selectedClaim', 'collectedFields', 'missingRequiredFields', 'recentHistory', 'userText'],
  },
  {
    id: 'voice_reply_planner',
    name: '语音回复规划模板',
    description: '语音报案 TTS 回复规划模板。',
    content: VOICE_REPLY_TEMPLATE,
    requiredVariables: ['scene', 'currentState', 'userText', 'conversationGoal', 'replyStrategy', 'summary', 'acknowledgedFacts', 'missingFields', 'actionSummaries', 'nextStep'],
  },
  {
    id: 'invoice_structuring',
    name: '发票结构化模板',
    description: 'OCR 结果二次结构化提取模板。',
    content: `以下是中国医疗发票的 OCR 识别结果。请从中提取结构化信息。

## 重要规则
1. 只提取 OCR 文本中**明确存在**的信息，严禁补充或编造
2. 费用明细项目**不要重复**，同一项目只提取一次
3. 注意区分"个人自付"(personalSelfPayment)和"个人自费"(personalSelfExpense)
4. 医院名称优先从票面印刷文字提取
5. 只返回 JSON，不要使用代码块或多余文字

## OCR 原文
{{ocrText}}

## 输出 JSON 格式
{{schemaText}}

## 输出规范
- 日期格式：YYYY-MM-DD
- 数字字段：纯数字，不含货币符号或千分位逗号
- 无法识别的字段：字符串用 ""，数字用 0`,
    requiredVariables: ['ocrText', 'schemaText'],
  },
  {
    id: 'material_classifier',
    name: '材料分类模板',
    description: '理赔材料自动分类模板。',
    content: `你是保险理赔材料分类专家。你必须严格从材料目录中选择一个最匹配项，若无法确定再返回 unknown。

【OCR 文字】
{{ocrText}}

【文件名参考】
{{fileName}}

【材料目录（格式: id|名称|说明摘要）】
{{catalog}}

请仅返回 JSON：{"materialId":"...","materialName":"...","confidence":0到1的小数,"reason":"简短说明"}。
要求：
1) materialId 必须来自目录；
2) 若不确定，返回 unknown/未识别/0；
3) 禁止输出 markdown。`,
    requiredVariables: ['ocrText', 'fileName', 'catalog'],
  },
  {
    id: 'catalog_semantic_match',
    name: '医保目录语义匹配模板',
    description: '医保目录语义匹配模板，支持单项和批量匹配。',
    content: `你是一位中国医保药品/诊疗项目专家。请从以下医保目录中找出与给定项目最匹配的条目。

注意事项：
1. 药品可能使用商品名、通用名或别名，需要识别它们之间的对应关系
2. 如"泰诺林"="对乙酰氨基酚"，"芬必得"="布洛芬缓释胶囊"
3. 注意规格表述差异：如"500mg"="0.5g"
4. 注意简称缩写：如"MRI"="核磁共振检查"
5. 考虑剂型差异：同通用名不同剂型也算匹配（如胶囊vs片剂）

医保目录：
{{catalogList}}

待匹配项目：
{{itemList}}

请返回 JSON{{resultShape}}

规则：
- 置信度低于 {{aiConfidenceThreshold}} 时 matchedCode 必须为 null
- 必须为每个待匹配项目返回一条结果`,
    requiredVariables: ['catalogList', 'itemList', 'resultShape', 'aiConfidenceThreshold'],
  },
  {
    id: 'injury_assessment',
    name: '伤残等级辅助判断模板',
    description: '根据诊断与伤情描述辅助判断伤残等级。',
    content: `请根据以下诊断和伤害描述，判断适用的伤残等级（1-10级，1级最高，10级最低）：

诊断：{{diagnosisText}}
伤害描述：{{injuryDescription}}

参考标准：
- 1级：颅脑损伤导致植物生存状态、四肢完全缺失等
- 2-3级：双目失明、双耳失聪、重要器官功能完全丧失
- 4-5级：单目失明、单耳失聪、肢体功能部分丧失
- 6-7级：拇指指间关节离断、听力部分丧失
- 8-10级：手指离断、轻微软组织损伤等

请按以下JSON格式返回（仅返回JSON，不要其他文字）：
{
  "suggestedGrade": 数字,
  "confidence": 0-1之间的数,
  "reasoning": "判断理由（简要）"
}`,
    requiredVariables: ['diagnosisText', 'injuryDescription'],
  },
];

const DEFAULT_CAPABILITIES = [
  {
    id: 'admin.invoice_ocr.raw_engine',
    name: '发票 OCR 原始识别',
    group: '主后台',
    description: '票据/材料图像的第一阶段 OCR 识别引擎。',
    binding: { provider: 'gemini-vision', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-vision', 'glm-ocr', 'paddle-ocr'],
    promptSourceType: 'runtime_only',
    promptTemplateId: null,
    editable: true,
    codeLocations: ['services/invoiceOcrService.ts', 'server/apiHandler.js'],
  },
  {
    id: 'admin.invoice_ocr.structuring',
    name: '发票 OCR 结构化解析',
    group: '主后台',
    description: '对 OCR 文本进行 JSON 结构化提取。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text', 'glm-text'],
    promptSourceType: 'template',
    promptTemplateId: 'invoice_structuring',
    editable: true,
    codeLocations: ['services/invoiceOcrService.ts', 'server/apiHandler.js'],
  },
  {
    id: 'admin.material.classification',
    name: '材料分类',
    group: '主后台',
    description: '理赔材料自动分类与材料目录匹配。',
    binding: { provider: 'gemini-vision', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-vision'],
    promptSourceType: 'template',
    promptTemplateId: 'material_classifier',
    editable: true,
    codeLocations: ['services/material/materialClassifier.ts', 'server/taskQueue/worker.js', 'server/apiHandler.js'],
  },
  {
    id: 'admin.material.structured_extraction',
    name: '结构化材料抽取',
    group: '主后台',
    description: '基于材料 schema 的 OCR+字段抽取。',
    binding: { provider: 'gemini-vision', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-vision'],
    promptSourceType: 'material_config',
    promptTemplateId: null,
    editable: false,
    lockReason: '材料级模板来自 claims-materials 配置。',
    codeLocations: ['services/material/strategies/structuredDocStrategy.ts', 'services/invoiceOcrService.ts'],
  },
  {
    id: 'admin.material.general_analysis',
    name: '通用材料分析',
    group: '主后台',
    description: '无固定 schema 的通用文档分析与摘要。',
    binding: { provider: 'gemini-vision', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-vision'],
    promptSourceType: 'runtime_only',
    promptTemplateId: null,
    editable: true,
    codeLocations: ['services/material/strategies/generalDocStrategy.ts', 'server/services/fileProcessor.js', 'server/services/summaryExtractors/index.js'],
  },
  {
    id: 'admin.catalog.semantic_match',
    name: '医保目录语义匹配',
    group: '主后台',
    description: '费用项目与医保目录之间的 AI 语义匹配。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text', 'glm-text'],
    promptSourceType: 'template',
    promptTemplateId: 'catalog_semantic_match',
    editable: true,
    codeLocations: ['services/catalogMatchService.ts'],
  },
  {
    id: 'admin.claim.review_agent',
    name: '理赔审核 Agent',
    group: '主后台',
    description: '智能理赔审核 Agent 的工具调用主模型。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text'],
    promptSourceType: 'template',
    promptTemplateId: 'claim_adjuster_system',
    secondaryPromptTemplateId: 'claim_adjuster_human',
    editable: true,
    codeLocations: ['server/ai/agent.js'],
  },
  {
    id: 'admin.claim.risk_assessment',
    name: '理赔风险评估',
    group: '主后台',
    description: '智能理赔审核流程中的风险评估模型。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text', 'glm-text'],
    promptSourceType: 'runtime_only',
    promptTemplateId: null,
    editable: true,
    codeLocations: ['server/ai/graph.js', 'server/services/injuryAssessment.js'],
  },
  {
    id: 'smartclaim.chat',
    name: 'SmartClaim 对话',
    group: 'SmartClaim',
    description: 'SmartClaim 对话主模型（含地图 grounding）。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text'],
    promptSourceType: 'template',
    promptTemplateId: 'smartclaim_chat_user',
    secondaryPromptTemplateId: 'smartclaim_system',
    editable: false,
    lockReason: '当前依赖 Google Maps grounding，仅支持 Gemini。',
    codeLocations: ['smartclaim-ai-agent/geminiService.ts'],
  },
  {
    id: 'smartclaim.intent',
    name: 'SmartClaim 意图识别',
    group: 'SmartClaim',
    description: 'SmartClaim 33 类意图识别模型。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text'],
    promptSourceType: 'template',
    promptTemplateId: 'smartclaim_intent_recognition',
    editable: true,
    codeLocations: ['smartclaim-ai-agent/intentService.ts'],
  },
  {
    id: 'smartclaim.document_analysis',
    name: 'SmartClaim 文档分析',
    group: 'SmartClaim',
    description: 'SmartClaim 上传材料的 OCR/分析能力。',
    binding: { provider: 'gemini-vision', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-vision'],
    promptSourceType: 'runtime_only',
    promptTemplateId: null,
    editable: true,
    codeLocations: ['smartclaim-ai-agent/geminiService.ts'],
  },
  {
    id: 'smartclaim.final_assessment',
    name: 'SmartClaim 最终理算',
    group: 'SmartClaim',
    description: 'SmartClaim 最终赔付评估模型。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text', 'glm-text'],
    promptSourceType: 'runtime_only',
    promptTemplateId: null,
    editable: true,
    codeLocations: ['smartclaim-ai-agent/geminiService.ts'],
  },
  {
    id: 'shared.audio_transcription',
    name: '共享音频转写',
    group: '共享能力',
    description: '音频/视频转写能力。',
    binding: { provider: 'gemini-vision', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-vision'],
    promptSourceType: 'runtime_only',
    promptTemplateId: null,
    editable: false,
    lockReason: '当前依赖 Gemini 多模态音频能力。',
    codeLocations: ['smartclaim-ai-agent/geminiService.ts', 'server/services/videoProcessor.js'],
  },
  {
    id: 'voice.intent',
    name: '语音意图识别',
    group: '语音报案',
    description: '语音报案场景下的意图识别模型。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text', 'glm-text'],
    promptSourceType: 'template',
    promptTemplateId: 'voice_intent_recognition',
    editable: true,
    codeLocations: ['server/voice/intents/IntentRecognizer.ts'],
  },
  {
    id: 'voice.reply_planner',
    name: '语音回复规划',
    group: '语音报案',
    description: '将结构化结果改写为适合 TTS 播报的话术。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text', 'glm-text'],
    promptSourceType: 'template',
    promptTemplateId: 'voice_reply_planner',
    editable: true,
    codeLocations: ['server/voice/responders/voiceReplyBuilder.ts'],
  },
  {
    id: 'voice.chat',
    name: '语音对话主模型',
    group: '语音报案',
    description: '语音管线中的普通对话 fallback 模型。',
    binding: { provider: 'gemini-text', model: 'gemini-2.5-flash' },
    supportedProviders: ['gemini-text', 'glm-text'],
    promptSourceType: 'runtime_only',
    promptTemplateId: null,
    editable: true,
    codeLocations: ['server/voice/VoicePipeline.ts'],
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function indexById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function normalizeText(value) {
  return value === undefined || value === null ? '' : String(value);
}

function getProviderAvailability(provider) {
  if (provider.id === 'paddle-ocr') {
    return {
      available: true,
      missingEnvKeys: [],
    };
  }
  const missingEnvKeys = (provider.envKeys || []).filter((key) => !process.env[key]);
  return {
    available: missingEnvKeys.length < (provider.envKeys || []).length,
    missingEnvKeys,
  };
}

function getDefaultSettings() {
  return {
    version: 1,
    providers: clone(DEFAULT_PROVIDERS),
    capabilities: clone(DEFAULT_CAPABILITIES),
    promptTemplates: clone(DEFAULT_PROMPT_TEMPLATES),
    metadata: {
      updatedAt: nowIso(),
      updatedBy: 'system',
      version: 1,
    },
  };
}

function readStoredSettings() {
  const saved = readData(AI_SETTINGS_RESOURCE);
  if (!saved || Array.isArray(saved) || typeof saved !== 'object') {
    return null;
  }
  return saved;
}

function mergeSettings(defaults, saved) {
  if (!saved) return defaults;
  const providerMap = indexById(defaults.providers);
  const capabilityMap = indexById(defaults.capabilities);
  const templateMap = indexById(defaults.promptTemplates);

  const providers = defaults.providers.map((provider) => ({
    ...provider,
    ...(saved.providers || []).find((item) => item.id === provider.id),
  }));

  const capabilities = defaults.capabilities.map((capability) => {
    const savedCapability = (saved.capabilities || []).find((item) => item.id === capability.id);
    return {
      ...capability,
      ...(savedCapability || {}),
      binding: {
        ...capability.binding,
        ...(savedCapability?.binding || {}),
      },
    };
  });

  const promptTemplates = defaults.promptTemplates.map((template) => ({
    ...template,
    ...(saved.promptTemplates || []).find((item) => item.id === template.id),
  }));

  return {
    ...defaults,
    ...saved,
    providers: providers.filter((provider) => providerMap.has(provider.id)),
    capabilities: capabilities.filter((capability) => capabilityMap.has(capability.id)),
    promptTemplates: promptTemplates.filter((template) => templateMap.has(template.id)),
    metadata: {
      ...defaults.metadata,
      ...(saved.metadata || {}),
    },
  };
}

function applyAvailability(snapshot) {
  return {
    ...snapshot,
    providers: snapshot.providers.map((provider) => {
      const availability = getProviderAvailability(provider);
      return {
        ...provider,
        available: availability.available,
        missingEnvKeys: availability.missingEnvKeys,
      };
    }),
  };
}

export function getAISettingsSnapshot() {
  const defaults = getDefaultSettings();
  const merged = mergeSettings(defaults, readStoredSettings());
  return applyAvailability(merged);
}

export function getProviderCatalog() {
  return getAISettingsSnapshot().providers;
}

export function getPromptTemplate(templateId) {
  return getAISettingsSnapshot().promptTemplates.find((item) => item.id === templateId) || null;
}

export function renderPromptTemplate(templateId, variables = {}) {
  const template = getPromptTemplate(templateId);
  if (!template) {
    throw new Error(`Prompt template not found: ${templateId}`);
  }

  return template.content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) =>
    normalizeText(variables[key]),
  );
}

export function getCapabilityDefinition(capabilityId) {
  return getAISettingsSnapshot().capabilities.find((item) => item.id === capabilityId) || null;
}

export function resolveAICapability(capabilityId) {
  const snapshot = getAISettingsSnapshot();
  const capability = snapshot.capabilities.find((item) => item.id === capabilityId);
  if (!capability) {
    throw new Error(`AI capability not found: ${capabilityId}`);
  }

  const provider = snapshot.providers.find((item) => item.id === capability.binding.provider);
  if (!provider) {
    throw new Error(`AI provider not found: ${capability.binding.provider}`);
  }

  return {
    capability,
    provider,
    binding: capability.binding,
    promptTemplate: capability.promptTemplateId ? getPromptTemplate(capability.promptTemplateId) : null,
    secondaryPromptTemplate: capability.secondaryPromptTemplateId ? getPromptTemplate(capability.secondaryPromptTemplateId) : null,
  };
}

function validatePromptTemplates(promptTemplates) {
  const defaults = getDefaultSettings().promptTemplates;
  const defaultMap = indexById(defaults);

  return promptTemplates.map((template) => {
    const baseTemplate = defaultMap.get(template.id);
    if (!baseTemplate) {
      throw new Error(`Unknown prompt template: ${template.id}`);
    }

    const content = normalizeText(template.content);
    for (const variable of baseTemplate.requiredVariables || []) {
      const regex = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`);
      if (!regex.test(content)) {
        throw new Error(`Prompt template '${template.id}' missing required variable '{{${variable}}}'`);
      }
    }

    return {
      ...baseTemplate,
      ...template,
      content,
    };
  });
}

function validateCapabilities(capabilities, providers) {
  const defaults = getDefaultSettings().capabilities;
  const defaultMap = indexById(defaults);
  const providerMap = indexById(providers);

  return capabilities.map((capability) => {
    const baseCapability = defaultMap.get(capability.id);
    if (!baseCapability) {
      throw new Error(`Unknown AI capability: ${capability.id}`);
    }

    const nextBinding = {
      ...baseCapability.binding,
      ...(capability.binding || {}),
    };

    if (baseCapability.editable === false && (
      nextBinding.provider !== baseCapability.binding.provider ||
      nextBinding.model !== baseCapability.binding.model
    )) {
      throw new Error(`Capability '${capability.id}' is locked and cannot be changed`);
    }

    if (!baseCapability.supportedProviders.includes(nextBinding.provider)) {
      throw new Error(`Capability '${capability.id}' does not support provider '${nextBinding.provider}'`);
    }

    const provider = providerMap.get(nextBinding.provider);
    if (!provider) {
      throw new Error(`Unknown provider '${nextBinding.provider}'`);
    }
    if (!provider.available) {
      throw new Error(`Provider '${nextBinding.provider}' is unavailable. Missing env: ${(provider.missingEnvKeys || []).join(', ')}`);
    }

    if (!normalizeText(nextBinding.model)) {
      throw new Error(`Capability '${capability.id}' must have a model`);
    }

    return {
      ...baseCapability,
      ...capability,
      binding: nextBinding,
    };
  });
}

export function updateAISettings(payload = {}, updatedBy = 'unknown') {
  const current = getAISettingsSnapshot();
  const defaults = getDefaultSettings();

  const nextPromptTemplates = validatePromptTemplates(
    (payload.promptTemplates || current.promptTemplates).map((template) => ({
      ...template,
      content: normalizeText(template.content),
    })),
  );

  const providerCatalog = current.providers.map((provider) => {
    const baseProvider = defaults.providers.find((item) => item.id === provider.id) || provider;
    const availability = getProviderAvailability(baseProvider);
    return {
      ...baseProvider,
      available: availability.available,
      missingEnvKeys: availability.missingEnvKeys,
    };
  });

  const nextCapabilities = validateCapabilities(
    payload.capabilities || current.capabilities,
    providerCatalog,
  );

  const snapshot = {
    version: current.version || 1,
    providers: providerCatalog.map(({ available, missingEnvKeys, ...provider }) => provider),
    capabilities: nextCapabilities,
    promptTemplates: nextPromptTemplates,
    metadata: {
      ...(current.metadata || {}),
      updatedAt: nowIso(),
      updatedBy,
      version: (current.metadata?.version || 0) + 1,
    },
  };

  writeData(AI_SETTINGS_RESOURCE, snapshot);
  return getAISettingsSnapshot();
}

export function getAIInventory() {
  const snapshot = getAISettingsSnapshot();
  const providerMap = indexById(snapshot.providers);

  return snapshot.capabilities.map((capability) => ({
    ...capability,
    currentProvider: capability.binding.provider,
    currentModel: capability.binding.model,
    providerAvailable: providerMap.get(capability.binding.provider)?.available || false,
    providerMissingEnvKeys: providerMap.get(capability.binding.provider)?.missingEnvKeys || [],
    supportMatrix: capability.supportedProviders.map((providerId) => {
      const provider = providerMap.get(providerId);
      return {
        providerId,
        providerName: provider?.name || providerId,
        available: provider?.available || false,
        missingEnvKeys: provider?.missingEnvKeys || [],
        supportsCustomModel: Boolean(provider?.supportsCustomModel),
        defaultModel: provider?.defaultModel || null,
      };
    }),
    promptSource: {
      type: capability.promptSourceType,
      promptTemplateId: capability.promptTemplateId || null,
      secondaryPromptTemplateId: capability.secondaryPromptTemplateId || null,
      editable: capability.promptSourceType === 'template',
    },
  }));
}

