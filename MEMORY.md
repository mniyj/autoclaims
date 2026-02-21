# Project Memory - 保险产品配置页面

## 项目概述

**项目名称**: 保险产品配置页面 - 理赔
**技术栈**: React 19 + TypeScript + Vite + Tailwind CSS
**后端**: Express + PM2 + JSON文件存储
**主要功能**: 智能保顾配置、理赔管理、询价及保单管理

---

## 开发规范

### 导入规范
```typescript
// 类型导入使用 type 关键字
import { type QuoteRequest, type InsuranceProduct } from './types';

// 命名导入用于组件和工具
import React, { useState } from 'react';
import { api } from './services/api';
```

### 命名规范
- **组件**: PascalCase (`QuoteDetailPage`, `PolicyListPage`)
- **函数/方法**: camelCase (`handleSave`, `calculatePremium`)
- **常量**: UPPER_SNAKE_CASE (`MOCK_CLAUSES`)
- **接口/类型**: PascalCase (`QuoteRequest`, `InsurancePolicy`)

### 组件模式
- 函数组件使用显式 TypeScript 接口
- 使用 `React.FC<ComponentProps>` 进行类型注解
- 默认导出用于主组件
- 延迟初始化：`useState(() => initialValue())`

### 样式规范（Tailwind）
- 常用卡片样式：`bg-white p-6 rounded-lg shadow-sm border border-gray-200`
- 常用输入框样式：`h-9 px-2 py-1 border border-gray-300 rounded-md text-sm`
- 常用按钮样式：`px-4 py-2 bg-brand-blue-600 text-white rounded-md hover:bg-brand-blue-700`

---

## 项目结构

```
保险产品配置页面 -理赔/
├── components/              # React 组件
│   ├── ui/                 # 可复用 UI 组件（Input, Select, Modal 等）
│   ├── product-form/        # 产品配置表单组件
│   ├── product-preview/      # 产品预览组件
│   ├── QuoteListPage.tsx    # 询价单列表页（新增）
│   ├── QuoteDetailPage.tsx   # 询价单详情/编辑页（新增）
│   ├── PolicyListPage.tsx    # 保单列表页（新增）
│   └── PolicyDetailPage.tsx   # 保单详情/编辑页（新增）
├── services/                # 业务逻辑和 API 服务
│   ├── api.ts               # API 资源定义
│   └── ai/                 # AI 相关服务
├── schemas/                 # JSON schemas
├── jsonlist/                # Mock 数据存储
│   ├── quotes.json           # 询价单数据（新增）
│   └── policies.json         # 保单数据（新增）
├── server/                  # 后端服务
│   └── apiHandler.js        # API 处理器
├── types.ts                 # TypeScript 类型定义
├── constants.ts             # 常量和 Mock 数据
└── App.tsx                  # 主应用入口
```

---

## 类型定义

### 新增枚举（types.ts）

```typescript
// 询价单状态
export enum QuoteStatus {
  DRAFT = '草稿',
  PENDING = '待报价',
  QUOTED = '已报价',
  ACCEPTED = '已接受',
  REJECTED = '已拒绝',
  EXPIRED = '已过期',
  CONVERTED = '已转保单',
}

// 保单状态
export enum PolicyStatus {
  DRAFT = '草稿',
  PENDING_PAYMENT = '待支付',
  EFFECTIVE = '生效中',
  LAPSED = '失效',
  SURRENDERED = '已退保',
  EXPIRED = '已满期',
  CANCELLED = '已注销',
}

// 询价类型
export enum QuoteType {
  INDIVIDUAL = '个人询价',
  GROUP = '团体询价',
}
```

### 新增核心类型

```typescript
// 投保人信息
export interface QuotePolicyholder {
  name: string;
  idType: '身份证' | '护照' | '港澳通行证' | '其他';
  idNumber: string;
  gender: '男' | '女';
  birthDate: string;
  phone: string;
  email?: string;
  address?: string;
}

// 询价单
export interface QuoteRequest {
  id: string;
  quoteNumber: string;
  type: QuoteType;
  status: QuoteStatus;
  policyholder: QuotePolicyholder;
  insureds: QuoteInsured[];
  plans: QuotePlan[];
  selectedPlanId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  operator: string;
  notes?: string;
}

// 保单
export interface InsurancePolicy {
  id: string;
  policyNumber: string;
  quoteId?: string;
  quoteNumber?: string;
  status: PolicyStatus;
  // 产品信息
  productCode: string;
  productName: string;
  companyName: string;
  // 当事人信息
  policyholder: QuotePolicyholder;
  insureds: QuoteInsured[];
  // 条款配置
  mainClause: PolicyClause;
  riderClauses: PolicyClause[];
  // 特别约定与免赔
  specialAgreements: SpecialAgreement[];
  deductionRules: DeductionRule[];
  // 保单明细表
  schedule?: PolicySchedule;
  // 日期信息
  effectiveDate: string;
  expiryDate: string;
  issueDate: string;
  paymentDueDate?: string;
  // 金额信息
  totalPremium: number;
  paymentFrequency: '年缴' | '半年缴' | '季缴' | '月缴';
  paidPremium?: number;
  // 理赔统计
  claimCount: number;
  totalClaimAmount: number;
  // 元数据
  createdAt: string;
  updatedAt: string;
  operator: string;
  notes?: string;
}
```

---

## API 资源

### 新增 API 资源（services/api.ts）

```typescript
export const api = {
  // ... 其他资源
  quotes: buildResource('quotes'),
  policies: buildResource('policies'),

  // 专用 API
  calculatePremium: async (quoteData: any) => { ... },     // 保费计算
  convertQuoteToPolicy: async (quoteId: string) => { ... }, // 询价单转保单
  generatePolicySchedule: async (policyId: string) => { ... }, // 生成保单明细表
};
```

### 后端资源配置（server/apiHandler.js）

```javascript
const allowedResources = [
  // ... 其他资源
  'quotes',      // 询价单数据
  'policies',    // 保单数据
];

// 专用 API 端点
// POST /api/calculate-premium        - 保费计算
// POST /api/quotes/:id/convert      - 询价单转保单
// POST /api/policies/:id/schedule    - 生成保单明细表
```

---

## 导航配置

### 导航分组（App.tsx）

```typescript
const navItems: NavItemData[] = [
  {
    name: '智能保顾配置',
    icon: <StrategyIcon />,
    children: [ ... ]
  },
  {
    name: '询价及保单管理',    // 新增分组
    icon: <QuoteMgmtIcon />,
    children: [
      { name: '询价单管理', id: 'quote_list' },
      { name: '保单管理', id: 'policy_list' },
    ]
  },
  {
    name: '理赔管理',
    icon: <ProductMgmtIcon />,
    children: [ ... ]
  },
  {
    name: '系统管理',
    icon: <SettingsIcon />,
    children: [ ... ]
  },
];
```

### AppView 类型扩展

```typescript
type AppView =
  | 'product_list' | 'product_config' | 'add_product' | ...
  | 'quote_list' | 'quote_detail' | 'quote_create' | 'quote_edit'      // 新增
  | 'policy_list' | 'policy_detail' | 'policy_create' | 'policy_edit'; // 新增
```

---

## 业务流程

### 业务链路

```
产品 → 询价单 → 保单 → 理赔案件
```

### 询价单状态流转

```
草稿 → 待报价 → 已报价 → 已接受 → 已转保单
                     ↓
                  已拒绝
                     ↓
                  已过期
```

### 保单状态流转

```
草稿 → 待支付 → 生效中 → 已满期 / 已失效 / 已退保 / 已注销
```

---

## 关联关系

### 询价单 → 保单

```typescript
// 询价单转保单时关联
policy.quoteId = quote.id;
policy.quoteNumber = quote.quoteNumber;
```

### 保单 → 理赔

```typescript
// ClaimCase 扩展字段（待实现）
interface ClaimCase {
  // ... 现有字段
  policyId?: string;    // 关联保单ID
  policyNumber?: string; // 关联保单号
}
```

---

## Mock 数据文件

### jsonlist/quotes.json

示例数据结构：
- 个人询价（已报价状态）
- 团体询价（草稿状态）

### jsonlist/policies.json

示例数据结构：
- 标准保单（生效中）
- 带明细表的保单（已理赔）

---

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 启动生产服务器（PM2）
pm2 restart ecosystem.config.cjs
```

---

## 环境变量（.env.local）

```bash
GEMINI_API_KEY=your_api_key_here
DEV_PORT=8080                          # 开发服务器端口
PREVIEW_PORT=4173                       # 预览服务器端口
BASE_PATH=/                              # 部署路径
PORT=3000                                # 生产 Express 服务器端口
```

---

## 部署配置

### PM2 配置（ecosystem.config.cjs）

- **Instance 1**: 端口 3005，实例名 `insurance-config-page`
- **Instance 2**: 端口 3008，实例名 `insurance-config-page-3008`

### 部署脚本

```bash
./deploy.sh <SERVER_IP> [SERVER_USER] [SSH_KEY_PATH] [PORT]
```

---

## 常用文件路径

```
类型定义:           types.ts
API 配置:           services/api.ts
后端处理器:         server/apiHandler.js
主应用:             App.tsx
询价单列表:         components/QuoteListPage.tsx
询价单详情:         components/QuoteDetailPage.tsx
保单列表:           components/PolicyListPage.tsx
保单详情:           components/PolicyDetailPage.tsx
询价单数据:         jsonlist/quotes.json
保单数据:           jsonlist/policies.json
```

---

## AI 服务

### AI 提供商
- Gemini（默认）
- Claude

### AI 功能
- 发票 OCR 识别
- 发票结构化提取
- 理赔智能审核

---

## 最近更新（2026-02-17）

### 新增模块：询价及保单管理

1. **类型定义**（types.ts）
   - QuoteStatus, PolicyStatus, QuoteType 枚举
   - QuoteRequest, InsurancePolicy 及相关类型

2. **组件**（components/）
   - QuoteListPage - 询价单列表
   - QuoteDetailPage - 询价单详情/编辑
   - PolicyListPage - 保单列表
   - PolicyDetailPage - 保单详情/编辑（Tab 布局）

3. **API 扩展**
   - quotes, policies 资源
   - calculatePremium, convertQuoteToPolicy, generatePolicySchedule 专用 API

4. **后端扩展**（server/apiHandler.js）
   - quotes, policies 资源支持
   - 专用 API 端点实现

5. **导航集成**（App.tsx）
   - 新增"询价及保单管理"导航分组
   - 扩展 AppView 类型
   - 添加 state 和 handlers

---

## 注意事项

1. **Strict Mode**: tsconfig.json 中 strict mode 未启用，类型检查相对宽松
2. **Mock 数据**: 首次运行时自动初始化 mock 数据
3. **样式**: 全部使用 Tailwind CSS，无单独 CSS 文件
4. **路由**: 使用自定义视图切换系统，未使用 react-router
5. **状态管理**: 使用 React 内置 useState，无外部状态管理库
