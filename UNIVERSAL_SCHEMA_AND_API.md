# 通用保险产品 Schema 与 API 接口文档

本文档定义了覆盖所有保险类型（医疗险、意外险、重疾险、定期寿险、增额终身寿险、年金险）的通用数据结构（Schema），以及配套的 RESTful API 接口规范。

## 1. 通用产品 Schema (Universal Product Schema)

该 Schema 使用 JSON Schema Draft 07 标准，通过 `oneOf` 机制支持不同类型的保险产品差异化配置。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "通用保险产品数据结构 (Universal Insurance Product Schema)",
  "description": "适用于所有保险类型的通用产品定义，包含公共字段和各险种特有字段。",
  "type": "object",
  "allOf": [
    { "$ref": "#/definitions/BaseProduct" },
    {
      "oneOf": [
        { "$ref": "#/definitions/HealthProduct" },
        { "$ref": "#/definitions/AccidentProduct" },
        { "$ref": "#/definitions/CriticalIllnessProduct" },
        { "$ref": "#/definitions/TermLifeProduct" },
        { "$ref": "#/definitions/WholeLifeProduct" },
        { "$ref": "#/definitions/AnnuityProduct" }
      ]
    }
  ],
  "definitions": {
    "BaseProduct": {
      "type": "object",
      "properties": {
        "productCode": { "type": "string", "description": "产品唯一标识码" },
        "regulatoryName": { "type": "string", "description": "监管备案名称" },
        "marketingName": { "type": "string", "description": "市场推广名称" },
        "productSummery": { "type": "string", "description": "产品摘要" },
        "onlineClaimFlag": { "type": "boolean", "description": "是否支持在线理赔" },
        "insurerName": { "type": "string", "description": "保险公司名称" },
        "version": { "type": "string", "description": "产品版本号" },
        "salesRegions": { "type": "string", "description": "销售区域" },
        "effectiveDate": { "type": "string", "format": "date", "description": "生效日期" },
        "expiryDate": { "type": ["string", "null"], "format": "date", "description": "停售日期" },
        "status": { "type": "string", "enum": ["生效", "失效", "草稿"], "description": "状态" },
        "primaryCategory": { "type": "string", "description": "一级分类名称" },
        "primaryCategoryCode": { "type": "string", "description": "一级分类代码" },
        "secondaryCategory": { "type": "string", "description": "二级分类名称" },
        "secondaryCategoryCode": { "type": "string", "description": "二级分类代码" },
        "racewayId": { "type": "string", "description": "三级赛道编码" },
        "racewayName": { "type": "string", "description": "三级赛道名称" },
        "salesUrl": { "type": "string", "format": "uri", "description": "销售落地页URL" },
        "underwritingAge": { "type": "string", "description": "投保年龄范围" },
        "coveragePeriod": { "type": "string", "description": "保障期限" },
        "waitingPeriod": { "type": "string", "description": "等待期" },
        "productHeroImage": { "type": "string", "format": "uri", "description": "头图URL" },
        "productLongImage": { "type": "array", "items": { "type": "string" }, "description": "详情长图" },
        "productAttachment": { "type": "array", "items": { "type": "string" }, "description": "附件列表" },
        "clausesCode": { "type": "array", "items": { "type": "string" }, "description": "条款代码" },
        "productIntroduction": { "type": "string", "description": "详细介绍" },
        "productAdvantages": { "type": "string", "description": "产品优势" },
        "precautions": { "type": "string", "description": "注意事项" },
        "crowd": { "type": "string", "description": "适用人群" },
        "generalComment": { "type": "string", "description": "专家点评" },
        "tags": { "type": "string", "description": "产品标签" },
        "annualPremium": { "type": "number", "description": "起保保费 (通用字段)" },
        "valueAddedServices": {
          "type": "array",
          "items": { "$ref": "#/definitions/ValueAddedServiceItem" },
          "description": "增值服务"
        }
      },
      "required": [
        "productCode", "regulatoryName", "marketingName", "insurerName", 
        "primaryCategoryCode", "secondaryCategoryCode", "status"
      ]
    },
    
    "HealthProduct": {
      "title": "医疗险",
      "properties": {
        "deductible": { "type": "string", "description": "免赔额" },
        "hospitalScope": { "type": "string", "description": "医院范围" },
        "claimScope": { "type": "string", "description": "赔付范围" },
        "occupationScope": { "type": "string", "description": "职业范围" },
        "hesitationPeriod": { "type": "string", "description": "犹豫期" },
        "policyEffectiveDate": { "type": "string", "description": "生效规则" },
        "purchaseLimit": { "type": "integer", "description": "限购份数" },
        "renewalWarranty": { "type": "string", "description": "续保规则" },
        "outHospitalMedicine": { "type": "string", "description": "院外特药" },
        "healthConditionNotice": { "type": "string", "description": "健康告知" },
        "coveragePlans": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "planType": { "type": "string" },
              "annualLimit": { "type": "number" },
              "guaranteedRenewalYears": { "type": "integer" },
              "coverageDetails": { "type": "array", "items": { "$ref": "#/definitions/CoverageDetailItem" } }
            },
            "required": ["planType", "coverageDetails"]
          }
        },
        "cardMetric1Label": { "type": "string" }, "cardMetric1Value": { "type": "string" },
        "cardMetric2Label": { "type": "string" }, "cardMetric2Value": { "type": "string" },
        "cardMetric3Label": { "type": "string" }, "cardMetric3Value": { "type": "string" }
      }
    },

    "AccidentProduct": {
      "title": "意外险",
      "properties": {
        "coverageArea": { "type": "string", "description": "保障区域" },
        "occupationScope": { "type": "string", "description": "职业范围" },
        "coveragePlans": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "planType": { "type": "string" },
              "annualLimit": { "type": ["number", "null"] },
              "coverageDetails": { "type": "array", "items": { "$ref": "#/definitions/CoverageDetailItem" } }
            },
            "required": ["planType", "coverageDetails"]
          }
        }
      }
    },

    "CriticalIllnessProduct": {
      "title": "重疾险",
      "properties": {
        "healthConditionNotice": { "type": "string", "description": "健康告知" },
        "coveragePlans": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "planType": { "type": "string" },
              "coverageDetails": { "type": "array", "items": { "$ref": "#/definitions/CoverageDetailItem" } }
            },
            "required": ["planType", "coverageDetails"]
          }
        }
      }
    },

    "TermLifeProduct": {
      "title": "定期寿险",
      "properties": {
        "basicSumAssured": { "type": "string", "description": "基本保额范围" },
        "paymentPeriod": { "type": "string", "description": "缴费年限" },
        "underwritingOccupation": { "type": "string", "description": "承保职业" },
        "coveragePlans": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "planType": { "type": "string" },
              "coverageDetails": { "type": "array", "items": { "$ref": "#/definitions/CoverageDetailItem" } }
            },
            "required": ["planType", "coverageDetails"]
          }
        }
      }
    },

    "WholeLifeProduct": {
      "title": "增额终身寿险",
      "properties": {
        "effectiveAmountGrowthRate": { "type": "number", "description": "保额增长率" },
        "paymentFrequency": { "type": "string", "description": "缴费频率" },
        "paymentPeriod": { "type": "string", "description": "缴费年限" },
        "partialSurrenderRules": {
          "type": ["object", "null"],
          "properties": {
            "is_available": { "type": "boolean" },
            "start_policy_year": { "type": "integer" },
            "frequency_per_year": { "type": "integer" },
            "min_amount_per_request": { "type": "number" },
            "max_ratio_per_request": { "type": "number" },
            "min_remaining_premium": { "type": "number" },
            "description": { "type": "string" }
          }
        },
        "coverageDetails": { "type": "array", "items": { "$ref": "#/definitions/CoverageDetailItem" } }
      }
    },

    "AnnuityProduct": {
      "title": "年金险",
      "properties": {
        "paymentMethod": { "type": "string", "description": "缴费方式" },
        "paymentPeriod": { "type": "string", "description": "缴费年限" },
        "payoutStartAge": { "type": "string", "description": "起领年龄" },
        "payoutFrequency": { "type": "string", "description": "领取频率" },
        "underwritingOccupation": { "type": "string", "description": "承保职业" },
        "coveragePlans": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "planType": { "type": "string" },
              "coverageDetails": { "type": "array", "items": { "$ref": "#/definitions/CoverageDetailItem" } }
            },
            "required": ["planType", "coverageDetails"]
          }
        }
      }
    },

    "CoverageDetailItem": {
      "type": "object",
      "properties": {
        "item_code": { "type": "string", "description": "责任编码" },
        "item_name": { "type": "string", "description": "责任名称" },
        "description": { "type": "string", "description": "责任描述" },
        "mandatory": { "type": "boolean", "description": "是否必选" },
        "amount": { "type": "string", "description": "保额描述(简易)" },
        "details": {
          "type": "object",
          "description": "详细参数 (结构随 item_code 变化)",
          "additionalProperties": true
        }
      },
      "required": ["item_code", "item_name"]
    },

    "ValueAddedServiceItem": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "description": { "type": "string" }
      },
      "required": ["id", "name"]
    }
  }
}
```

## 2. API 接口文档 (API Documentation)

### 基础信息
- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: Bearer Token (Authorization header)

### 2.1 获取产品列表
**GET** `/products`

#### 请求参数 (Request Parameters)

| 参数名 | 类型 | 必选 | 描述 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `page` | Integer | 否 | 页码，默认为 1 | `1` |
| `pageSize` | Integer | 否 | 每页数量，默认为 20 | `20` |
| `category` | String | 否 | 一级分类代码 (如 A, B, C) | `A` |
| `status` | String | 否 | 产品状态 (生效/失效/草稿) | `生效` |
| `keyword` | String | 否 | 搜索关键字，模糊匹配名称 | `尊享` |

#### 响应参数 (Response Parameters)

| 参数名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `code` | Integer | 状态码 (200 表示成功) |
| `message` | String | 响应消息 |
| `data` | Object | 数据主体 |
| `data.total` | Integer | 总记录数 |
| `data.list` | Array | 产品列表 |

**List Item 结构:**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `productCode` | String | 产品唯一标识码 |
| `marketingName` | String | 市场推广名称 |
| `primaryCategory` | String | 一级分类名称 |
| `annualPremium` | Number | 起保保费 |
| `status` | String | 状态 |
| `productHeroImage` | String | 产品头图 URL |

**Response Example:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 100,
    "list": [
      {
        "productCode": "MED-001",
        "marketingName": "尊享e生2024",
        "primaryCategory": "健康保险",
        "annualPremium": 198,
        "status": "生效"
      }
    ]
  }
}
```

### 2.2 获取产品详情
**GET** `/products/{productCode}`

#### 请求参数 (Request Parameters)

| 参数名 | 类型 | 必选 | 位置 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `productCode` | String | 是 | Path | 产品唯一标识码 |

#### 响应参数 (Response Parameters)

返回的数据结构为完整的通用产品对象，包含 **公共字段** 和 **险种专属字段**。

**公共字段 (Common Fields)**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `productCode` | String | 产品唯一标识码 |
| `regulatoryName` | String | 监管备案名称 |
| `marketingName` | String | 市场推广名称 |
| `productSummery` | String | 产品摘要 |
| `onlineClaimFlag` | Boolean | 是否支持在线理赔 |
| `insurerName` | String | 保险公司名称 |
| `version` | String | 产品版本号 |
| `salesRegions` | String | 销售区域 |
| `effectiveDate` | String | 生效日期 (YYYY-MM-DD) |
| `expiryDate` | String | 停售日期 (YYYY-MM-DD) |
| `status` | String | 状态 (生效/失效/草稿) |
| `primaryCategory` | String | 一级分类名称 |
| `primaryCategoryCode` | String | 一级分类代码 |
| `secondaryCategory` | String | 二级分类名称 |
| `secondaryCategoryCode` | String | 二级分类代码 |
| `racewayId` | String | 三级赛道编码 |
| `racewayName` | String | 三级赛道名称 |
| `salesUrl` | String | 销售落地页 URL |
| `underwritingAge` | String | 投保年龄范围 |
| `coveragePeriod` | String | 保障期限 |
| `waitingPeriod` | String | 等待期 |
| `annualPremium` | Number | 起保保费 |
| `productIntroduction` | String | 详细介绍 |
| `productAdvantages` | String | 产品优势 |
| `precautions` | String | 注意事项 |
| `crowd` | String | 适用人群 |
| `tags` | String | 产品标签 |
| `valueAddedServices` | Array | 增值服务列表 |

**险种专属字段 (Specific Fields)**

根据 `primaryCategoryCode` 或 `secondaryCategoryCode` 的不同，包含以下特定字段：

**1. 医疗险 (HealthProduct)**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `deductible` | String | 免赔额描述 |
| `hospitalScope` | String | 医院范围 |
| `claimScope` | String | 赔付范围 |
| `occupationScope` | String | 职业范围 |
| `hesitationPeriod` | String | 犹豫期 |
| `renewalWarranty` | String | 续保规则 |
| `outHospitalMedicine` | String | 院外特药 |
| `healthConditionNotice` | String | 健康告知 |

**2. 意外险 (AccidentProduct)**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `coverageArea` | String | 保障区域 |
| `occupationScope` | String | 职业范围 |

**3. 重疾险 (CriticalIllnessProduct)**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `healthConditionNotice` | String | 健康告知 |

**4. 定期寿险 (TermLifeProduct)**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `basicSumAssured` | String | 基本保额范围 |
| `paymentPeriod` | String | 缴费年限 |
| `underwritingOccupation` | String | 承保职业 |

**5. 增额终身寿险 (WholeLifeProduct)**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `effectiveAmountGrowthRate` | Number | 保额增长率 (如 0.035) |
| `paymentFrequency` | String | 缴费频率 |
| `paymentPeriod` | String | 缴费年限 |
| `partialSurrenderRules` | Object | 减保规则 |

**6. 年金险 (AnnuityProduct)**

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `paymentMethod` | String | 缴费方式 |
| `paymentPeriod` | String | 缴费年限 |
| `payoutStartAge` | String | 起领年龄 |
| `payoutFrequency` | String | 领取频率 |

**7. 多方案与保障责任 (Coverage Plans & Details)**

大多数险种（医疗、意外、重疾、定期寿险、年金）支持多方案配置。`coveragePlans` 字段是一个数组，每个元素代表一个保障计划。

**Plan Item 结构:**

| 字段名 | 类型 | 必选 | 描述 |
| :--- | :--- | :--- | :--- |
| `planType` | String | 是 | 计划名称 (如: 基础版, 尊享版) |
| `annualLimit` | Number | 否 | 年度保额上限 (医疗/意外险常用) |
| `guaranteedRenewalYears` | Integer | 否 | 保证续保年限 (医疗险常用) |
| `coverageDetails` | Array | 是 | 该计划下的具体保障责任列表 |

**Coverage Detail Item 结构 (保障责任):**

| 字段名 | 类型 | 必选 | 描述 |
| :--- | :--- | :--- | :--- |
| `item_code` | String | 是 | 责任内部编码 (系统识别用) |
| `item_name` | String | 是 | 责任名称 (展示用) |
| `description` | String | 是 | 责任简述 |
| `mandatory` | Boolean | 否 | 是否为必选责任 |
| `amount` | String | 否 | 保额简述 (如: 100万) |
| `details` | Object | 否 | 责任详细参数 (见下表 7.1) |

**7.1 责任详情结构说明 (Details Field Structure)**

`details` 对象的结构根据 `item_code`（责任类型）的不同而变化。以下是常见的几类结构：

**A. 医疗与津贴类 (Medical & Allowance)**
*适用：一般医疗、意外医疗、住院津贴*

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `limit` | Integer | 保额上限 (元) |
| `deductible` | Number | 免赔额 (元) |
| `reimbursement_ratio` | Number | 赔付比例 (0-1) |
| `hospital_requirements` | String | 医院要求 (如: 二级及以上公立) |
| `coverage_scope` | String | 费用范围 (如: 社保内/外) |
| `amount_per_day` | Number | 每日津贴金额 (津贴类专用) |
| `deductible_days` | Integer | 免赔天数 (津贴类专用) |
| `max_days` | Integer | 最高赔付天数 (津贴类专用) |

**B. 重疾与特疾类 (Critical Illness & Disease)**
*适用：重疾、中症、轻症、癌症多次赔*

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `illness_count` | Integer | 覆盖疾病数量 |
| `payout_type` | String | 赔付类型 (`SINGLE`单次, `MULTIPLE_GROUPED`分组多次, `MULTIPLE_UNGROUPED`不分组多次) |
| `payout_ratio` | Number | 单次赔付比例 (如 1.0) |
| `payout_ratios` | Array | 多次赔付比例数组 (如 `[1.0, 1.2]`) |
| `interval_days` | Integer | 多次赔付间隔期 (天) |
| `age_limit_before` | Integer | 额外赔付年龄限制 (如 60岁前) |
| `extra_payout_ratio` | Number | 额外赔付比例 |
| `group_details` | Object | 分组详情 (包含 `groups` 数组) |

**C. 身故与定额类 (Death & Fixed Amount)**
*适用：身故全残、猝死、特定意外*

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `payout_logic` | String | 赔付逻辑描述 (如: 现金价值与保费取大) |
| `scenario` | String | 特定场景描述 (如: 航空意外) |
| `payout_multiplier` | Number | 赔付倍数 |
| `additional_limit` | Integer | 额外赔付限额 |

**D. 年金领取类 (Annuity Payout)**
*适用：年金、生存金*

| 字段名 | 类型 | 描述 |
| :--- | :--- | :--- |
| `start_age_options` | Array | 可选起领年龄 (如 `[60, 65]`) |
| `frequency_options` | Array | 可选领取频率 (如 `["ANNUALLY", "MONTHLY"]`) |
| `guaranteed_period_years` | Integer | 保证领取年限 |
| `amount_logic` | String | 领取金额计算逻辑 |

**Response Example:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "productCode": "MED-001",
    "marketingName": "尊享e生2024",
    "primaryCategoryCode": "A",
    "annualPremium": 198,
    "deductible": "1万元",
    "hospitalScope": "二级及以上公立医院",
    "coveragePlans": [
      {
        "planType": "基础版",
        "annualLimit": 3000000,
        "coverageDetails": [
          {
            "item_code": "GENERAL_MEDICAL",
            "item_name": "一般医疗保险金",
            "description": "一般医疗费用",
            "amount": "300万",
            "mandatory": true
          }
        ]
      },
      {
        "planType": "尊享版",
        "annualLimit": 6000000,
        "coverageDetails": [
           // ... 更多责任
        ]
      }
    ]
  }
}
```

### 2.3 创建产品
**POST** `/products`

#### 请求参数 (Request Parameters)

Body 为 JSON 对象，字段定义同 **2.2 获取产品详情** 中的响应字段。

**必填字段说明:**

| 字段名 | 描述 |
| :--- | :--- |
| `productCode` | 产品唯一标识码 |
| `regulatoryName` | 监管备案名称 |
| `marketingName` | 市场推广名称 |
| `insurerName` | 保险公司名称 |
| `primaryCategoryCode` | 一级分类代码 |
| `secondaryCategoryCode` | 二级分类代码 |
| `status` | 状态 |

**Response:**
```json
{
  "code": 201,
  "message": "Product created successfully",
  "data": {
    "productCode": "MED-001"
  }
}
```

### 2.4 更新产品
**PUT** `/products/{productCode}`

#### 请求参数 (Request Parameters)

| 参数名 | 类型 | 必选 | 位置 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `productCode` | String | 是 | Path | 产品唯一标识码 |
| `Body` | Object | 是 | Body | 完整的通用产品对象 (全量更新) |

**Response:**
```json
{
  "code": 200,
  "message": "Product updated successfully"
}
```

### 2.5 删除产品
**DELETE** `/products/{productCode}`

#### 请求参数 (Request Parameters)

| 参数名 | 类型 | 必选 | 位置 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| `productCode` | String | 是 | Path | 产品唯一标识码 |

**Response:**
```json
{
  "code": 200,
  "message": "Product deleted successfully"
}
```

### 2.6 获取通用 Schema
**GET** `/products/schema`

#### 描述
获取当前系统使用的通用 JSON Schema 定义，用于前端动态表单渲染或校验。

**Response:**
```json
{
  "code": 200,
  "data": {
    // 返回本文档第 1 部分定义的 JSON Schema
  }
}
```
