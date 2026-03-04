# 保险配置系统 - 技术文档

## 目录
1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [架构设计](#3-架构设计)
4. [项目结构详解](#4-项目结构详解)
5. [开发环境搭建](#5-开发环境搭建)
6. [核心模块说明](#6-核心模块说明)
7. [API架构](#7-api架构)
8. [AI功能模块](#8-ai功能模块)
9. [部署运维](#9-部署运维)

---

## 1. 项目概述

### 1.1 系统简介

本项目是一个**保险产品配置与智能理赔系统**，采用单一代码库维护两个独立应用：

| 应用 | 功能定位 | 技术特点 | 端口 |
|------|----------|----------|------|
| **管理后台** | 保险产品/条款/公司/理赔案件管理 | React SPA + Express API | 8080 (dev) |
| **SmartClaim AI** | AI智能理赔助手 | 独立子项目，对话式交互 | 8081 (dev) |

### 1.2 业务领域

- **保险产品管理**: 健康险、意外险、重疾险、定期寿险、终身寿险、年金险、车险
- **条款库管理**: 主险/附加险条款维护
- **理赔案件处理**: 报案→材料收集→审核→理算→结案全流程
- **AI智能审核**: OCR识别、规则引擎、AI辅助决策
- **数据看板**: 业务数据可视化

### 1.3 核心流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        理赔案件处理流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   报案录入 ──→ 材料收集 ──→ AI初审 ──→ 人工审核 ──→ 理算 ──→ 结案  │
│      │           │          │          │        │       │      │
│      ▼           ▼          ▼          ▼        ▼       ▼      │
│   [Intake]   [Upload]   [AI/OCR]   [Review]  [Calc]  [Close]   │
│                                                                 │
│   关键特性:                                                      │
│   - 多类型材料支持(图片/PDF/视频)                                  │
│   - AI自动分类与信息提取                                          │
│   - 规则引擎自动审核                                              │
│   - 人伤定损智能计算                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

### 2.1 前端技术栈

```
┌────────────────────────────────────────────────────────────┐
│                      前端技术架构                            │
├────────────────────────────────────────────────────────────┤
│  UI框架:      React 19.1.1                                  │
│  语言:        TypeScript 5.8.2 (target: ES2022)             │
│  构建工具:    Vite 6.2.0                                    │
│  样式:        Tailwind CSS (CDN)                            │
│  状态管理:    React useState/useContext (无Redux)           │
│  路由:        自定义视图切换 (非react-router)                │
└────────────────────────────────────────────────────────────┘
```

**核心依赖:**
- `@google/genai` - Gemini AI SDK
- `@langchain/core` + `@langchain/langgraph` - AI Agent框架
- `zod` - Schema验证
- `ws` - WebSocket通信

### 2.2 后端技术栈

```
┌────────────────────────────────────────────────────────────┐
│                      后端技术架构                            │
├────────────────────────────────────────────────────────────┤
│  运行时:      Node.js 20+ (ES Modules)                      │
│  Web框架:     Express.js 5.2.0                              │
│  数据存储:    JSON文件 (jsonlist/)                          │
│  文件存储:    阿里云OSS                                     │
│  任务队列:    内存队列 + 定时调度器                          │
│  限流:        express-rate-limit                            │
└────────────────────────────────────────────────────────────┘
```

### 2.3 AI/OCR服务

| 服务 | 用途 | 说明 |
|------|------|------|
| **Gemini API** | 主要AI能力 | 文本生成、图像理解、OCR |
| **GLM OCR** | 备用OCR | 发票识别 |
| **PaddleOCR** | 本地OCR | `server/paddle_ocr_server.py` |
| **阿里云NLS** | 语音交互 | 语音识别与合成 |

---

## 3. 架构设计

### 3.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              客户端层                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   管理后台 Web    │    │  SmartClaim AI   │    │    微信小程序     │  │
│  │   (React SPA)    │    │   (独立应用)      │    │   (wechat-miniprogram)│
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘  │
└───────────┼──────────────────────┼──────────────────────┼────────────┘
            │                      │                      │
            └──────────────────────┼──────────────────────┘
                                   │ HTTPS/WebSocket
┌──────────────────────────────────▼──────────────────────────────────────┐
│                              接入层                                       │
│                    Express Server (Node.js)                              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  中间件: CORS / JSON解析 / 限流 / 静态资源服务                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼────────────────────────────────────┐
│                              API层                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ 产品管理API   │ │ 理赔案件API   │ │ 文件处理API   │ │ AI审核API    │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ 规则引擎API   │ │ 定损理算API   │ │ 任务队列API   │ │ 消息中心API   │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼────────────────────────────────────┐
│                            服务层                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │ FileProcess │ │  Assessment │ │ Calculation │ │   AI Agent  │      │
│  │   (文件)     │ │   (定损)     │ │   (理算)     │ │  (智能审核)  │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼────────────────────────────────────┐
│                            数据层                                       │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐ │
│  │  JSON文件存储     │    │   阿里云OSS      │    │   AI服务         │ │
│  │  (jsonlist/)     │    │  (文件/图片)      │    │ Gemini/GLM/Claude│ │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流架构

```
                        ┌─────────────┐
                        │   用户操作    │
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ 表单提交  │    │ 文件上传  │    │ AI交互    │
        └────┬─────┘    └────┬─────┘    └────┬─────┘
             │               │               │
             ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │  API请求  │    │  OSS存储  │    │  LLM调用  │
        │ /api/xxx │    │ + AI OCR │    │  Gemini  │
        └────┬─────┘    └────┬─────┘    └────┬─────┘
             │               │               │
             └───────────────┼───────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  业务逻辑处理    │
                    │  (server/services)│
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ JSON文件  │ │ 任务队列  │ │ 消息推送  │
        │ 持久化    │ │ 异步处理  │ │ WebSocket│
        └──────────┘ └──────────┘ └──────────┘
```

---

## 4. 项目结构详解

### 4.1 根目录结构

```
insurance-config/
├── components/                 # 105个React组件
│   ├── ui/                    # 基础UI组件 (10个)
│   ├── product-form/          # 产品表单组件 (11个)
│   ├── product-preview/       # 产品预览组件 (6个)
│   ├── ruleset/               # 规则引擎组件 (11个)
│   ├── document-review/       # 文档审核组件 (4个)
│   ├── material-review/       # 材料审核组件 (5个)
│   └── voice/                 # 语音交互组件 (4个)
├── services/                   # 业务服务层 (6个)
│   ├── api.ts                 # REST API封装
│   ├── invoiceOcrService.ts   # 发票OCR服务
│   ├── invoiceAuditService.ts # 发票审核服务
│   ├── ossService.ts          # 阿里云OSS服务
│   ├── clauseService.ts       # 条款搜索服务
│   ├── catalogMatchService.ts # 医保目录匹配
│   └── ai/                    # AI提供商抽象
│       ├── aiService.ts       # AI服务主入口
│       └── providers/         # 各AI提供商实现
├── server/                     # 后端服务 (42个JS文件)
│   ├── apiHandler.js          # API请求主处理器
│   ├── ai/                    # AI Agent实现
│   │   ├── agent.js           # LangGraph智能体
│   │   ├── graph.js           # 状态机图定义
│   │   ├── tools/             # AI工具集
│   │   └── prompts/           # 提示词模板
│   ├── services/              # 业务逻辑服务
│   │   ├── fileProcessor.js   # 文件处理服务
│   │   ├── calculationEngine.js # 理算引擎
│   │   ├── assessmentFactory.js # 定损工厂
│   │   └── ...
│   ├── rules/                 # 规则引擎
│   │   ├── engine.js          # 规则执行引擎
│   │   ├── conditionEvaluator.js # 条件评估器
│   │   └── actionExecutor.js  # 动作执行器
│   └── taskQueue/             # 任务队列
│       ├── queue.js           # 队列管理
│       ├── scheduler.js       # 定时调度器
│       └── worker.js          # 任务处理器
├── schemas/                    # JSON Schema验证 (7个)
├── jsonlist/                   # JSON数据持久化目录
├── types.ts                    # TypeScript类型定义 (~1500行)
├── constants.ts                # 常量与Mock数据 (~4200行)
├── App.tsx                     # 主应用组件 (~1000行)
├── server.js                   # Express生产服务器入口
└── smartclaim-ai-agent/        # 智能理赔助手子项目
    ├── App.tsx                # AI助手主入口
    ├── geminiService.ts       # Gemini集成
    └── ...
```

### 4.2 组件架构

```
┌─────────────────────────────────────────────────────────────┐
│                        组件分层架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    页面层 (Pages)                     │   │
│  │  ProductListPage | ClaimCaseListPage | LoginPage     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────────┐ │
│  │                  业务组件层 (Business)                  │ │
│  │  ProductForm | ClaimWorkbench | InvoiceAuditPage      │ │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────────┐ │
│  │                  功能组件层 (Feature)                   │ │
│  │  ClauseSearch | HospitalSelector | FileUpload         │ │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼───────────────────────────────┐ │
│  │                  基础UI层 (Primitive)                   │ │
│  │  Button | Input | Modal | Select | Pagination         │ │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 开发环境搭建

### 5.1 环境要求

| 项目 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 20.0.0 | 必需 |
| npm | >= 10.0.0 | 随Node.js安装 |
| Git | 任意版本 | 版本控制 |

### 5.2 快速启动

```bash
# 1. 克隆项目
git clone <repository-url>
cd insurance-config

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入必要的API密钥

# 4. 启动开发服务器
npm run dev

# 5. 访问应用
# 管理后台: http://localhost:8080
```

### 5.3 环境变量配置

创建 `.env.local` 文件：

```bash
# ===== AI服务配置 =====
GEMINI_API_KEY=your_gemini_api_key_here
GLM_OCR_API_KEY=your_glm_ocr_key_here

# ===== 开发端口配置 =====
DEV_PORT=8080
PREVIEW_PORT=4173

# ===== 阿里云OSS配置 =====
ALIYUN_OSS_REGION=oss-cn-beijing
ALIYUN_OSS_ACCESS_KEY_ID=your_access_key
ALIYUN_OSS_ACCESS_KEY_SECRET=your_secret
ALIYUN_OSS_BUCKET=your_bucket_name

# ===== 阿里云语音服务 =====
ALIYUN_ACCESS_KEY_ID=your_key
ALIYUN_ACCESS_KEY_SECRET=your_secret
ALIYUN_NLS_APP_KEY=your_app_key
ALIYUN_TTS_APP_KEY=your_app_key

# ===== 生产部署配置 =====
BASE_PATH=/                    # 子路径部署，默认根路径
PORT=3000                      # Express服务端口
```

### 5.4 开发命令

```bash
# 开发模式 (Vite dev server + Express API)
npm run dev

# 生产构建
npm run build

# 预览生产构建
npm run preview

# 启动生产服务器
npm start
```

### 5.5 SmartClaim AI 子项目

```bash
cd smartclaim-ai-agent
npm install
npm run dev    # 端口 8081
```

---

## 6. 核心模块说明

### 6.1 产品管理模块

**文件位置:**
- `components/ProductListPage.tsx` - 产品列表
- `components/AddProductPage.tsx` - 添加产品
- `components/product-form/` - 各类型产品表单

**产品类型体系:**

```typescript
// types.ts 中的产品类型定义
enum PrimaryCategory {
  HEALTH = "医疗保险",
  ACCIDENT = "意外保险", 
  CRITICAL_ILLNESS = "重大疾病保险",
  TERM_LIFE = "定期寿险",
  WHOLE_LIFE = "终身寿险",
  ANNUITY = "年金保险",
  CAR_INSURANCE = "车险",
}

// 产品类型使用联合类型精确定义
type InsuranceProduct =
  | HealthAccidentCriticalIllnessProduct
  | TermLifeProduct
  | WholeLifeProduct
  | AnnuityProduct
  | CarInsuranceProduct;
```

**产品分类三级体系:**
```
一级分类 (primaryCategory)        二级分类 (secondaryCategory)       三级赛道 (raceway)
    │                                    │                               │
    ├── 医疗保险                          ├── 百万医疗                      ├── 普通百万医疗
    ├── 意外保险                          ├── 小额医疗                      ├── 防癌医疗
    ├── 重大疾病保险                       ├── 门诊医疗                      └── ...
    ├── 定期寿险                          └── ...
    └── ...
```

### 6.2 理赔案件模块

**核心流程状态机:**

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  待报案  │───→│  待审核  │───→│ 审核中  │───→│ 待理算  │───→│  已结案  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  [NEW]        [PENDING]      [REVIEWING]    [CALCULATING]  [CLOSED]
```

**关键组件:**
- `ClaimCaseListPage.tsx` - 案件列表视图
- `ClaimCaseDetailPage.tsx` - 案件详情页
- `ClaimWorkbenchPage.tsx` - 理赔工作台
- `components/material-review/` - 材料审核组件集

### 6.3 规则引擎模块

**架构图:**

```
┌─────────────────────────────────────────────────────────────┐
│                        规则引擎架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                  Ruleset (规则集)                    │  │
│   │  - 规则集ID、名称、版本、状态                          │  │
│   │  - 包含多条Rule规则                                   │  │
│   └─────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│   ┌─────────────────────▼───────────────────────────────┐  │
│   │                   Rule (单条规则)                     │  │
│   │  - 触发条件 (Condition Tree)                         │  │
│   │  - 执行动作 (Actions)                                │  │
│   │  - 优先级、生效时间                                   │  │
│   └─────────────────────┬───────────────────────────────┘  │
│                         │                                   │
│          ┌──────────────┴──────────────┐                   │
│          │                             │                   │
│   ┌──────▼──────┐              ┌───────▼───────┐          │
│   │  Condition  │              │    Action     │          │
│   │  (条件树)    │              │   (动作列表)   │          │
│   │             │              │               │          │
│   │ - 字段比较   │              │ - 设置字段值   │          │
│   │ - 逻辑运算   │              │ - 计算结果     │          │
│   │ - 正则匹配   │              │ - 触发事件     │          │
│   │ - 范围检查   │              │ - 调用API      │          │
│   └─────────────┘              └───────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**核心文件:**
- `server/rules/engine.js` - 规则执行引擎
- `server/rules/conditionEvaluator.js` - 条件评估
- `server/rules/actionExecutor.js` - 动作执行
- `components/ruleset/` - 规则集管理UI

**使用示例:**

```javascript
// 执行规则审核
const result = await executeFullReview({
  rulesetId: 'medical_claim_rules',
  context: {
    claimAmount: 5000,
    hospitalLevel: '三级甲等',
    diagnosisCode: 'J44.1',
    policyStatus: '有效'
  }
});

// result: { approved: boolean, decision: string, actions: [] }
```

### 6.4 定损理算模块

**定损流程:**

```
材料上传 → 文件分类 → 信息提取 → 损伤评估 → 费用计算 → 报告生成
    │         │          │          │          │          │
    ▼         ▼          ▼          ▼          ▼          ▼
[Upload] [Classifier] [Extractor] [Assessor] [Calculator] [Reporter]
```

**核心服务:**

| 服务 | 文件 | 功能 |
|------|------|------|
| 定损工厂 | `assessmentFactory.js` | 根据险种创建对应定损器 |
| 理算引擎 | `calculationEngine.js` | 执行计算公式 |
| 费用分类 | `expenseClassifier.js` | 费用项目自动分类 |
| 人伤评估 | `injuryAssessment.js` | 伤残等级评定 |

**计算公式示例:**

```javascript
// 医疗费用理算公式
const medicalFormula = {
  type: 'MEDICAL_EXPENSE',
  expression: `
    社保内费用 = 总费用 - 自费金额 - 部分自付;
    社保报销 = min(社保内费用, 社保限额) * 社保比例;
    商保赔付 = (社保内费用 - 社保报销) * 赔付比例;
    return 商保赔付;
  `,
  variables: ['总费用', '自费金额', '部分自付', '社保限额', '社保比例', '赔付比例']
};
```

### 6.5 文件处理模块

**文件处理流水线:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          文件处理流程                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  上传文件 ──→ 格式检测 ──→ 预处理 ──→ AI分析 ──→ 结果存储 ──→ 消息通知   │
│     │           │          │         │          │          │           │
│     ▼           ▼          ▼         ▼          ▼          ▼           │
│  ┌─────┐   ┌────────┐  ┌──────┐  ┌─────┐   ┌──────┐   ┌──────┐       │
│  │接收 │   │类型检测 │  │压缩/ │  │OCR/ │   │结构化 │   │Web- │       │
│  │保存 │   │格式验证 │  │转码  │  │AI   │   │存储   │   │Socket│      │
│  └─────┘   └────────┘  └──────┘  └─────┘   └──────┘   └──────┘       │
│                                                                         │
│  支持格式: JPEG/PNG/PDF/MP4/AVI/MOV/ZIP/RAR/DICOM                      │
│  存储位置: 本地uploads/ + 阿里云OSS                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**核心文件:**
- `server/services/fileProcessor.js` - 文件处理主逻辑
- `server/services/multiFileAnalyzer.js` - 多文件联合分析
- `server/services/preprocessor.js` - 文件预处理

---

## 7. API架构

### 7.1 API设计规范

所有API遵循RESTful设计，通过 `/api/{resource}` 路径访问。

**URL结构:**
```
GET    /api/{resource}           # 列表查询
GET    /api/{resource}/{id}      # 单条查询
POST   /api/{resource}           # 创建
PUT    /api/{resource}/{id}      # 更新
DELETE /api/{resource}/{id}      # 删除
```

### 7.2 API客户端封装

**文件:** `services/api.ts`

```typescript
// 统一API资源封装
const buildResource = (resource: string) => ({
  list: () => getList(resource),
  getById: (id: string) => getById(resource, id),
  add: (item: any) => addItem(resource, item),
  update: (id: string, data: any) => updateItem(resource, id, data),
  delete: (id: string) => deleteItem(resource, id),
});

// 导出各资源API
export const api = {
  products: buildResource("products"),
  claimCases: buildResource("claim-cases"),
  // ... 其他资源
};
```

### 7.3 核心API资源

| 资源名 | 数据文件 | 说明 |
|--------|----------|------|
| products | `jsonlist/products.json` | 保险产品 |
| clauses | `jsonlist/clauses.json` | 保险条款 |
| claim-cases | `jsonlist/claim-cases.json` | 理赔案件 |
| companies | `jsonlist/companies.json` | 保险公司 |
| rulesets | `jsonlist/rulesets.json` | 规则集 |
| users | `jsonlist/users.json` | 系统用户 |

### 7.4 专用API端点

```typescript
// 发票审核
POST /api/audit-invoice
body: { ocrData, ossUrl, province }

// 保费计算
POST /api/calculate-premium
body: quoteData

// 询价转保单
POST /api/quotes/{id}/convert

// 执行定损
POST /api/assess-damage
body: { claimId, files, assessmentType }

// 执行理算
POST /api/calculate
body: { formulaType, context }

// 文件处理任务
POST /api/tasks/create
GET  /api/tasks/{taskId}
```

### 7.5 API处理器

**文件:** `server/apiHandler.js`

```javascript
// 主API路由处理器
export const handleApiRequest = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/', '').split('/');
  const resource = pathParts[0];
  const id = pathParts[1];
  
  // 根据HTTP方法和资源路由到对应处理函数
  switch (req.method) {
    case 'GET':
      return id ? handleGetById(resource, id) : handleList(resource);
    case 'POST':
      return handleCreate(resource, body);
    case 'PUT':
      return handleUpdate(resource, id, body);
    case 'DELETE':
      return handleDelete(resource, id);
  }
};
```

---

## 8. AI功能模块

### 8.1 AI架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI能力架构                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     AI Service Layer                     │   │
│  │              services/ai/aiService.ts                    │   │
│  │  - 统一AI接口抽象                                        │   │
│  │  - 多提供商管理 (Gemini/Claude)                          │   │
│  │  - 模型切换与容错                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│          ┌───────────────────┼───────────────────┐              │
│          │                   │                   │              │
│          ▼                   ▼                   ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   Gemini     │   │    Claude    │   │  其他提供商   │        │
│  │   Provider   │   │   Provider   │   │   Provider   │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     AI应用场景                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │  发票OCR  │ │ 智能审核  │ │ 语音交互  │ │ 文档解析  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 AI Agent (LangGraph)

**文件:** `server/ai/`

```
server/ai/
├── agent.js                 # 主Agent定义
├── graph.js                 # 状态图配置
├── graph-with-checkpointer.js # 持久化状态图
├── state.js                 # 状态定义
├── prompts/
│   └── claimAdjuster.js     # 理赔员角色提示词
└── tools/
    ├── index.js             # 工具导出
    ├── checkEligibilityTool.js   # 资格审核工具
    ├── calculateAmountTool.js    # 金额计算工具
    ├── queryHospitalInfoTool.js  # 医院查询工具
    └── queryMedicalCatalogTool.js # 医保目录查询工具
```

**Agent执行流程:**

```
用户输入 → 意图识别 → 工具选择 → 工具执行 → 结果整合 → 响应生成
    │         │          │          │          │          │
    ▼         ▼          ▼          ▼          ▼          ▼
  [Input]  [Router]  [Select]   [Execute]  [Synthesize] [Output]
                              │
                              ▼
                    ┌─────────────────┐
                    │    工具集        │
                    │  • 资格检查      │
                    │  • 金额计算      │
                    │  • 医院查询      │
                    │  • 目录查询      │
                    └─────────────────┘
```

### 8.3 OCR发票识别

**服务文件:** `services/invoiceOcrService.ts`

**支持的OCR引擎:**

| 引擎 | 优先级 | 适用场景 |
|------|--------|----------|
| Gemini Vision | 1 | 通用发票识别，多语言支持 |
| GLM OCR | 2 | 中文发票优化 |
| PaddleOCR | 3 | 本地部署，无网络依赖 |

**发票数据结构:**

```typescript
interface MedicalInvoiceData {
  invoiceNo: string;           // 发票号码
  invoiceCode: string;         // 发票代码
  invoiceDate: string;         // 开票日期
  hospitalName: string;        // 医院名称
  totalAmount: number;         // 总金额
  selfPayAmount: number;       // 自费金额
  partialSelfPay: number;      // 部分自付
  socialSecurityPay: number;   // 社保支付
  items: InvoiceItem[];        // 明细项目
}
```

### 8.4 语音交互

**架构:**

```
┌─────────────┐      WebSocket       ┌─────────────────┐
│   前端语音    │◄───────────────────►│   VoiceGateway  │
│   组件      │      (ws://)         │  (server/voice) │
└──────┬──────┘                      └────────┬────────┘
       │                                       │
       │ 音频流                                │ API调用
       ▼                                       ▼
┌─────────────┐                      ┌─────────────────┐
│ 阿里云NLS    │◄────────────────────►│   业务逻辑处理   │
│ (语音服务)   │    语音识别/合成      │   智能对话管理   │
└─────────────┘                      └─────────────────┘
```

---

## 9. 部署运维

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        生产部署架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐    │
│   │                  阿里云ECS                             │    │
│   │  ┌─────────────────────────────────────────────────┐  │    │
│   │  │              PM2 Process Manager                │  │    │
│   │  │  ┌─────────────┐        ┌─────────────┐         │  │    │
│   │  │  │  App:3005   │        │  App:3008   │         │  │    │
│   │  │  │ (Instance 1)│        │ (Instance 2)│         │  │    │
│   │  │  └─────────────┘        └─────────────┘         │  │    │
│   │  └─────────────────────────────────────────────────┘  │    │
│   │                           │                          │    │
│   │                    ┌──────┴──────┐                   │    │
│   │                    │   Nginx     │                   │    │
│   │                    │ (反向代理)   │                   │    │
│   │                    └──────┬──────┘                   │    │
│   └───────────────────────────┼───────────────────────────┘    │
│                               │                                 │
│   ┌───────────────────────────┼───────────────────────────┐    │
│   │              阿里云OSS    │                           │    │
│   │         (静态资源/上传文件) ▼                           │    │
│   └───────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 部署脚本

**文件:** `deploy.sh`

```bash
# 部署命令
./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH] [PORT]

# 示例
./deploy.sh 121.43.159.216                    # 使用默认配置
./deploy.sh 121.43.159.216 root ~/.ssh/key.pem 3008
```

**部署流程:**

```
1. 本地构建 (npm run build)
2. 打包文件 (dist/, server/, jsonlist/, package.json)
3. 上传到服务器 (scp)
4. 解压并安装依赖
5. PM2重启应用
6. 配置防火墙
```

### 9.3 PM2配置

**文件:** `ecosystem.config.cjs`

```javascript
module.exports = {
  apps: [
    {
      name: 'insurance-config-3005',
      script: './server.js',
      instances: 1,
      env: {
        PORT: 3005,
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
    },
    {
      name: 'insurance-config-3008',
      script: './server.js',
      instances: 1,
      env: {
        PORT: 3008,
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### 9.4 Docker部署

**文件:** `Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
```

**Docker命令:**

```bash
docker build -t insurance-config .
docker run -p 3000:3000 \
  -e GEMINI_API_KEY=xxx \
  -e ALIYUN_OSS_ACCESS_KEY_ID=xxx \
  insurance-config
```

### 9.5 监控与日志

**日志文件位置:**

| 日志类型 | 路径 | 说明 |
|----------|------|------|
| 应用日志 | `logs/out.log` | 标准输出 |
| 错误日志 | `logs/err.log` | 错误信息 |
| API审计 | `logs/audit/` | AI调用审计 |
| 操作日志 | `jsonlist/user-operation-logs.json` | 用户操作记录 |

**查看日志:**

```bash
# PM2日志
pm2 logs insurance-config-3005

# 文件日志
tail -f logs/out.log
tail -f logs/err.log
```

---

## 附录

### A. 开发规范

#### 代码风格

```typescript
// ✅ 正确: 中文业务语义 + 英文技术命名
const fetchProducts = async () => {
  const products = await api.products.list();
  return products; // 返回产品列表
};

// 组件中使用中文标签
const StatusBadge = () => (
  <span className="badge">生效</span>
);
```

#### 样式规范

```typescript
// ✅ 正确: 仅使用Tailwind，不创建单独CSS文件
const Card = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <h2 className="text-lg font-semibold text-gray-800">标题</h2>
  </div>
);

// ❌ 错误: 不使用CSS Modules或单独CSS文件
```

### B. 调试技巧

#### 前端调试

```typescript
// 在浏览器控制台查看API调用
fetch('/api/products').then(r => r.json()).then(console.log)

// 检查当前用户状态
localStorage.getItem('currentUser')
```

#### 后端调试

```javascript
// 在apiHandler.js中添加调试日志
console.log('[API]', req.method, req.url, body);

// 查看JSON数据文件
cat jsonlist/products.json | jq '.[0]'
```

### C. 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 端口被占用 | 3000端口被占用 | 修改.env.local中的PORT |
| OSS上传失败 | 密钥配置错误 | 检查ALIYUN_OSS_*环境变量 |
| AI调用失败 | API Key无效 | 验证GEMINI_API_KEY |
| 构建失败 | 类型错误 | 运行 `npx tsc --noEmit` 检查 |

### D. 相关文档

- `AGENTS.md` - AI开发代理指南
- `README.md` - 项目快速入门
- `CHANGELOG-sample-url-fix.md` - 变更日志示例
- `STATEMENT_OF_WORK.md` - 工作说明书

---

**文档版本:** v1.0  
**最后更新:** 2026-03-05  
**维护者:** 技术团队
