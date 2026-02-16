

# 索赔人用户操作日志系统实现计划

## Context

当前系统包含两个独立应用：

1.**智能理赔助手**（smartclaim-ai-agent/，端口8081）- C端索赔用户使用，处理报案、文件上传、AI对话

2.**后台管理系统**（主目录，端口8080）- 管理员使用，管理理赔案件和配置

**需求背景**：需要记录C端用户在智能理赔助手中的所有操作，包括：

- 用户输入（报案信息、上传文件、发送消息）
- 系统输出（AI回复、审核结果、状态变化）
- AI交互过程（模型调用、耗时、token使用量）
- 操作性能指标（总耗时、步骤耗时）

**目标**：在后台管理系统中增加"用户操作日志"页面，让管理员能够：

- 查看所有用户操作记录
- 筛选和搜索特定操作
- 查看完整的操作详情（包括入参、出参、AI交互）
- 分析用户行为和系统性能

## Implementation Plan

### 1. 数据结构设计

**文件**: `types.ts`

新增类型定义：

```typescript

// 操作类型枚举（涵盖所有用户操作）

exportenum UserOperationType {

LOGIN = 'LOGIN',                          // 用户登录

LOGOUT = 'LOGOUT',                        // 用户登出

REPORT_CLAIM = 'REPORT_CLAIM',            // 提交报案

UPLOAD_FILE = 'UPLOAD_FILE',              // 上传文件

DELETE_FILE = 'DELETE_FILE',              // 删除文件

VIEW_FILE = 'VIEW_FILE',                  // 查看文件

SEND_MESSAGE = 'SEND_MESSAGE',            // 发送消息

RECEIVE_MESSAGE = 'RECEIVE_MESSAGE',      // 接收消息

VIEW_PROGRESS = 'VIEW_PROGRESS',          // 查看进度

VIEW_CLAIM_DETAIL = 'VIEW_CLAIM_DETAIL',  // 查看赔案详情

SUBMIT_FORM = 'SUBMIT_FORM',              // 提交表单

UPDATE_PROFILE = 'UPDATE_PROFILE',        // 更新资料

ANALYZE_DOCUMENT = 'ANALYZE_DOCUMENT',    // 文档分析

QUICK_ANALYZE = 'QUICK_ANALYZE',          // 快速分析

VOICE_TRANSCRIPTION = 'VOICE_TRANSCRIPTION', // 语音转写

LIVE_AUDIO_SESSION = 'LIVE_AUDIO_SESSION',   // 实时语音会话

}


// 用户操作日志主类型

exportinterface UserOperationLog {

logId: string;// 格式: log-YYYYMMDDHHMMSS-random

timestamp: string;// ISO时间戳


// 用户标识

userName: string;// 用户名（来自登录）

userGender?: string;// 用户性别

sessionId?: string;// 浏览器会话ID（用于追踪匿名用户）


// 操作详情

operationType: UserOperationType;// 操作类型

operationLabel: string;// 操作描述（中文）


// 关联上下文

claimId?: string;// 关联的理赔案件ID

claimReportNumber?: string;// 理赔报案号

currentStatus?: string;// 案件当前状态


// 数据记录

inputData?: Record<string, any>;// 输入数据（表单、参数等）

outputData?: Record<string, any>;// 输出数据（结果、响应等）


// AI交互（如果涉及AI调用）

aiInteractions?: AIInteractionLog[];// AI调用记录数组


// 性能指标

duration?: number;// 操作总耗时（毫秒）

success: boolean;// 操作是否成功

errorMessage?: string;// 错误信息（如果失败）


// 技术信息

userAgent?: string;// 浏览器UA

deviceType?: 'mobile' | 'desktop' | 'tablet';


// 扩展字段

metadata?: Record<string, any>;// 其他元数据

}


// AI交互日志（增强现有类型）

exportinterface AIInteractionLog {

model: string;// 使用的模型名称

prompt: string;// 发送给AI的提示词

response: string;// AI返回的响应

duration: number;// 调用耗时（毫秒）

timestamp: string;// 时间戳

usageMetadata?: {// Token使用统计

    inputTokens?: number;

    outputTokens?: number;

    cacheReadTokens?: number;

    totalTokens?: number;

};

timing?: {// 分步耗时

    ocrDuration?: number;

    parsingDuration?: number;

    totalDuration?: number;

};

errorMessage?: string;// 错误信息

statusCode?: number;// HTTP状态码

}

```

**关键设计决策**：

-`sessionId`：用于追踪同一用户的多次会话

-`aiInteractions`数组：一次操作可能涉及多个AI调用（如多图分析）

- 敏感数据脱敏：logService会自动过滤password、token等字段

---

### 2. 前端日志记录服务

**新建文件**: `smartclaim-ai-agent/logService.ts`

**核心功能**：

- 生成唯一日志ID（时间戳+随机数）
- 识别设备类型（mobile/desktop/tablet）
- 管理会话ID（sessionStorage持久化）
- 日志队列和批量发送（2秒防抖或10条触发）
- 敏感数据脱敏（自动过滤password、token、idNumber等）
- 页面卸载时可靠投递（navigator.sendBeacon）

**主要API**：

```typescript

// 记录单个操作

logUserOperation(params: {

operationType: UserOperationType;

  operationLabel: string;

  userName: string;

  inputData?: Record<string, any>;

  outputData?: Record<string, any>;

  aiInteractions?: AIInteractionLog[];

  duration?: number;

  success?: boolean;

  errorMessage?: string;

// ... 其他字段

})


// 带计时的操作记录（高阶函数）

logOperationWithTiming<T>(

operationType: UserOperationType,

operationLabel: string,

userName: string,

operation: () =>Promise<T>,

context?: { claimId?, inputData? }

): Promise<T>

```

**性能优化**：

- 批量发送：累积10条或2秒后批量发送，减少HTTP请求
- 非阻塞：所有日志操作异步执行，不影响UI
- 错误隔离：日志记录失败不影响主流程

---

### 3. 前端集成点

**文件**: `smartclaim-ai-agent/App.tsx`

在以下关键操作点插入日志记录：

#### 3.1 用户登录（handleLogin）

```typescript

logUserOperation({

operationType: UserOperationType.LOGIN,

operationLabel:'用户登录',

userName: name,

userGender: gender,

inputData:{ invitationCode, name, gender },

success:true,

});

```

#### 3.2 报案提交（handleFormSubmit）

```typescript

constclaimId='CLM'+Date.now().toString().slice(-6);

logOperationWithTiming(

UserOperationType.REPORT_CLAIM,

'提交理赔报案',

userName,

async () => { /* 报案逻辑 */ },

  { claimId, inputData: reportInfo }

);

```

#### 3.3 文件上传（processFiles）

```typescript

// 批量上传后记录

logUserOperation({

operationType: UserOperationType.UPLOAD_FILE,

operationLabel:`上传${files.length}个文件`,

userName,

claimId: currentClaimId,

inputData:{

    fileCount: files.length,

    fileNames: files.map(f => f.name)

},

outputData:{

    successCount: results.filter(r => r.success).length,

    failedCount: results.filter(r =>!r.success).length

},

duration: Date.now() - startTime,

success: results.some(r => r.success),

});

```

#### 3.4 发送消息（handleSend）

```typescript

constaiInteractions: AIInteractionLog[] = [];


// 调用AI并收集日志

const { response,aiLog } =awaitgetAIResponseWithLog(...);

if (aiLog) aiInteractions.push(aiLog);


logUserOperation({

operationType: UserOperationType.SEND_MESSAGE,

operationLabel:'发送消息',

userName,

claimId: claimState.selectedClaimId,

inputData:{

    messageLength: input.length,

    hasAttachments: pendingFiles.length >0

},

outputData:{

    responseLength: response.length

},

aiInteractions,

duration: Date.now() - startTime,

success:true,

});

```

#### 3.5 文档分析（analyzeDocument）

```typescript

logUserOperation({

operationType: UserOperationType.ANALYZE_DOCUMENT,

operationLabel:`分析文档: ${document.name}`,

userName,

claimId: currentClaimId,

inputData:{ fileName: document.name, fileType: document.type },

outputData:{

    category: result.category,

    clarityScore: result.clarityScore,

    completenessScore: result.completenessScore,

},

aiInteractions: [result.aiLog],

duration: Date.now() - startTime,

success:true,

});

```

#### 3.6 查看进度（handleSend('记录')）

```typescript

logUserOperation({

operationType: UserOperationType.VIEW_PROGRESS,

operationLabel:'查看理赔进度',

userName,

outputData:{

    claimCount: historicalClaims.length

},

});

```

**注意事项**：

- 所有日志调用放在try-catch块外，确保即使主逻辑失败也能记录
- 不记录敏感信息（身份证号、密码等会自动脱敏）
- AI交互日志从geminiService返回值中获取

---

### 4. AI服务增强

**文件**: `smartclaim-ai-agent/geminiService.ts`

修改现有AI函数，返回AIInteractionLog：

```typescript

// 修改前：只返回结果

exportconstgetAIResponse=async (...) =>{

constresult=awaitmodel.generateContent(...);

return{text: result.text,...};

};


// 修改后：同时返回日志

exportconstgetAIResponse=async (...) =>{

conststartTime=Date.now();


try{

constresult=awaitmodel.generateContent(...);

constduration=Date.now() -startTime;


constaiLog: AIInteractionLog ={

model:'gemini-2.5-flash',

prompt: messages[messages.length -1].content,

response: result.text,

duration,

timestamp:newDate().toISOString(),

usageMetadata: result.usageMetadata,

};


return{text: result.text,...,aiLog };

}catch (error) {

constaiLog: AIInteractionLog ={

model:'gemini-2.5-flash',

prompt: messages[messages.length -1].content,

response:'',

duration: Date.now() - startTime,

timestamp:newDate().toISOString(),

errorMessage: error.message,

};


throw{...error,aiLog };

}

};

```

**需要修改的函数**：

-`getAIResponse()` - 聊天回复

-`analyzeDocument()` - 文档分析

-`quickAnalyze()` - 快速分析

-`performFinalAssessment()` - 最终评估（如果使用）

---

### 5. 后端API支持

**文件**: `server/apiHandler.js`

#### 5.1 添加资源类型（第194-213行）

```javascript

constallowedResources= [

'products',

'clauses',

// ... 其他资源 ...

'invoice-audits',

'user-operation-logs',// 新增

];

```

#### 5.2 批量插入支持（第597行POST处理后）

```javascript

elseif (req.method === 'POST') {

constnewItem=awaitparseBody(req);

constdata=readData(resource);


// 特殊处理：批量日志插入

if (resource === 'user-operation-logs' && newItem.logs && Array.isArray(newItem.logs)) {

data.push(...newItem.logs);

writeData(resource, data);

res.statusCode = 201;

res.end(JSON.stringify({ success:true, count: newItem.logs.length }));

  } else {

// 原有逻辑：单个插入

data.push(newItem);

writeData(resource, data);

res.statusCode = 201;

res.end(JSON.stringify({ success:true, data: newItem }));

  }

}

```

#### 5.3 初始化数据文件

创建空文件：`jsonlist/user-operation-logs.json`

```json

[]

```

**无需额外代码**：通用CRUD已支持所有操作（GET/POST/PUT/DELETE）

---

### 6. 后台管理UI - 日志查看页面

**新建文件**: `components/UserOperationLogsPage.tsx`

**主要功能模块**：

#### 6.1 日志列表表格

- 列字段：时间、用户、操作类型、操作说明、赔案编号、耗时、状态、AI调用次数、操作按钮
- 分页显示（可选，数据量大时启用）
- 操作类型用彩色标签展示
- 成功/失败用绿色/红色标签

#### 6.2 筛选条件

- 用户名（文本输入）
- 操作类型（下拉选择）
- 时间范围（开始日期-结束日期）
- 赔案编号（文本输入）
- 状态（成功/失败/全部）
- 关键词搜索（全文搜索）

#### 6.3 详情弹窗（LogDetailModal）

显示完整日志信息：

- 基本信息：日志ID、时间、用户、会话ID、设备类型、耗时
- 输入数据：JSON格式展示
- 输出数据：JSON格式展示
- AI交互记录（可展开）：
- 调用序号、模型名称、耗时
- Token使用量（输入/输出/总计）
- Prompt和Response（可折叠）
- 错误信息（如果失败）：红色高亮展示

#### 6.4 操作类型映射

```typescript

constgetOperationTypeLabel=(type: UserOperationType): string =>{

constlabels: Record<UserOperationType, string>={

LOGIN:'登录',

LOGOUT:'登出',

REPORT_CLAIM:'报案',

UPLOAD_FILE:'上传文件',

SEND_MESSAGE:'发送消息',

ANALYZE_DOCUMENT:'文档分析',

// ... 其他映射

};

returnlabels[type] ||type;

};

```

---

### 7. 后台导航集成

**文件**: `App.tsx`

#### 7.1 添加导航项（第88-99行）

```typescript

{

  name: '理赔管理',

  icon: <ProductMgmtIcon />,

  children: [

    { name:'理赔材料管理', id:'claims_material_management'},

    { name:'理赔项目配置', id:'claim_item_config'},

    { name:'赔案清单', id:'claim_case_list'},

    { name:'用户操作日志', id:'user_operation_logs'},  // 新增

    { name:'发票审核', id:'invoice_audit'},

    { name:'医保目录管理', id:'medical_catalog_management'},

    { name:'医院信息管理', id:'hospital_management'},

  ]

}

```

#### 7.2 更新AppView类型（第64行）

```typescript

type AppView = 'product_list' | 'product_config' | ... | 'user_operation_logs' | 'hospital_management';

```

#### 7.3 更新activeParentViews（第123行）

```typescript

constactiveParentViews: Record<string, AppView[]>={

'理赔管理': [

'claims_material_management',

'claim_item_config',

'claim_case_list',

'user_operation_logs',// 新增

'invoice_audit',

// ...

  ],

// ...

};

```

#### 7.4 添加路由渲染（renderContent函数）

```typescript

case'user_operation_logs':

return <UserOperationLogsPage onBack={()=> setView('claim_case_list')} />;

```

---

### 8. API服务层

**文件**: `services/api.ts`

添加日志API：

```typescript

exportconstapi={

// ... 现有API ...


userOperationLogs:{

list:async(): Promise<UserOperationLog[]>=>{

constresponse=awaitfetch('/api/user-operation-logs');

if (!response.ok) thrownewError('Failed to fetch logs');

return response.json();

},


getById:async(logId: string): Promise<UserOperationLog>=>{

constresponse=awaitfetch(`/api/user-operation-logs/${logId}`);

if (!response.ok) thrownewError('Failed to fetch log');

return response.json();

},


create:async(log: UserOperationLog): Promise<UserOperationLog>=>{

constresponse=awaitfetch('/api/user-operation-logs',{

method:'POST',

headers:{'Content-Type':'application/json'},

body: JSON.stringify(log),

});

if (!response.ok) thrownewError('Failed to create log');

return response.json();

},


createBatch:async(logs: UserOperationLog[]): Promise<{ count: number }>=>{

constresponse=awaitfetch('/api/user-operation-logs',{

method:'POST',

headers:{'Content-Type':'application/json'},

body: JSON.stringify({ logs }),

});

if (!response.ok) thrownewError('Failed to create logs');

return response.json();

},

},

};

```

---

## Critical Files

### 需要修改的文件（按优先级）：

1.**`types.ts`** - 添加所有日志相关类型定义

2.**`smartclaim-ai-agent/logService.ts`** - 新建，核心日志服务

3.**`smartclaim-ai-agent/App.tsx`** - 集成日志记录调用

4.**`smartclaim-ai-agent/geminiService.ts`** - 返回AI交互日志

5.**`server/apiHandler.js`** - 添加资源支持和批量插入

6.**`components/UserOperationLogsPage.tsx`** - 新建，后台查看页面

7.**`App.tsx`** - 添加导航和路由

8.**`services/api.ts`** - 添加日志API方法

9.**`jsonlist/user-operation-logs.json`** - 新建，初始化为空数组

### 关键实现点路径：

-**登录记录点**: `smartclaim-ai-agent/App.tsx:617-621` (handleLogin附近)

-**文件上传记录点**: `smartclaim-ai-agent/App.tsx:725-810` (processFiles函数)

-**消息发送记录点**: `smartclaim-ai-agent/App.tsx:1058-1200` (handleSend函数)

-**文档分析记录点**: `smartclaim-ai-agent/App.tsx:782-800` (analyzeDocument调用处)

-**查看进度记录点**: `smartclaim-ai-agent/App.tsx:677-690` (关键字'记录'触发处)

---

## Implementation Steps

### Phase 1: 基础架构（1-2天）

1. 在 `types.ts`添加类型定义
2. 修改 `server/apiHandler.js`添加资源支持
3. 创建 `jsonlist/user-operation-logs.json`空文件
4. 测试后端API的CRUD操作（Postman/curl）

### Phase 2: 前端日志服务（2-3天）

1. 创建 `smartclaim-ai-agent/logService.ts`
2. 实现日志队列、批量发送、脱敏功能
3. 在 `smartclaim-ai-agent/App.tsx`集成关键操作点：

- 登录/登出
- 文件上传
- 发送消息

4. 测试日志生成和发送，验证JSON文件内容

### Phase 3: AI日志集成（1天）

1. 修改 `smartclaim-ai-agent/geminiService.ts`主要函数
2. 让AI函数返回AIInteractionLog
3. 在操作日志中包含AI交互数组
4. 测试AI调用的完整链路记录

### Phase 4: 后台UI开发（2-3天）

1. 创建 `components/UserOperationLogsPage.tsx`
2. 实现日志列表表格和筛选功能
3. 实现详情弹窗（LogDetailModal）
4. 在 `App.tsx`添加导航和路由
5. 在 `services/api.ts`添加API方法

### Phase 5: 测试和优化（1天）

1. 端到端测试所有操作类型
2. 性能测试（批量日志、页面加载）
3. 边界测试（网络失败、大数据量）
4. 浏览器兼容性测试

**预计总工时**: 7-10天

---

## Verification

### 功能验证清单：

#### 前端日志记录

- [ ] 用户登录时生成LOGIN日志
- [ ] 上传5个文件时生成UPLOAD_FILE日志，包含文件名列表
- [ ] 发送消息时生成SEND_MESSAGE日志，包含AI交互
- [ ] 文档分析时生成ANALYZE_DOCUMENT日志，包含分析结果
- [ ] 查看进度时生成VIEW_PROGRESS日志
- [ ] 报案提交时生成REPORT_CLAIM日志，关联claimId

#### 后端存储

- [ ] 日志成功保存到 `user-operation-logs.json`
- [ ] 批量发送时一次POST包含多条日志
- [ ] 日志ID唯一且符合格式
- [ ] 敏感字段（password等）已脱敏

#### 后台查看

- [ ] 导航菜单显示"用户操作日志"
- [ ] 日志列表正确显示所有记录
- [ ] 按用户名筛选有效
- [ ] 按操作类型筛选有效
- [ ] 按时间范围筛选有效
- [ ] 关键词搜索有效
- [ ] 点击"查看详情"显示完整日志信息
- [ ] AI交互展示包含模型、耗时、Token统计
- [ ] JSON数据格式化显示

#### 性能和可靠性

- [ ] 日志记录不阻塞UI操作
- [ ] 网络失败时不影响主流程
- [ ] 页面关闭前日志通过sendBeacon发送
- [ ] 1000条日志的列表页面响应速度<2秒

#### 数据质量

- [ ] 所有日志包含必填字段（logId, timestamp, userName, operationType等）
- [ ] AI交互日志包含完整的prompt和response
- [ ] 耗时统计准确（与实际操作时间匹配）
- [ ] 成功/失败状态正确标记

---

## Key Design Decisions

1.**批量发送策略**：2秒防抖或10条触发，平衡实时性和性能

2.**敏感数据脱敏**：自动过滤password、token、idNumber、bankAccount等字段

3.**sessionId追踪**：使用sessionStorage存储会话ID，跨页面刷新持久化

4.**非阻塞设计**：所有日志操作异步执行，失败不影响主流程

5.**AI日志完整性**：记录完整prompt和response，便于问题排查和质量分析

6.**JSON文件存储**：与现有架构一致，无需引入数据库，部署简单

7.**数据保留**：建议90天保留期（可在后续实现清理脚本）

---

## Future Enhancements (Optional)

以下功能可在基础版本完成后考虑：

1.**日志统计仪表板**

- 操作类型分布饼图
- 用户活跃度趋势图
- AI调用量和耗时统计
- 成功率变化曲线

2.**日志导出功能**

- 导出CSV格式
- 导出JSON格式
- 按筛选条件导出

3.**实时日志监控**

- WebSocket实时推送新日志
- 错误日志实时告警

4.**日志清理策略**

- 定期清理90天前的日志
- 归档到备份存储

5.**高级搜索**

- 正则表达式搜索
- JSON路径查询
- 组合条件构建器

6.**用户行为分析**

- 常见操作路径分析
- 异常行为检测
- 用户画像构建
