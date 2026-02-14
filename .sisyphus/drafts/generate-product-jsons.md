# 生成中意保险产品 JSON 文件

## 任务概述
为 generali_products 文件夹下所有包含"条款"的 PDF 文件生成符合对应 schema 要求的 JSON 文件，保存到 projson 文件夹。

## 原始数据
- 总共 103 个包含"条款"的产品文件
- 文件位置: `/generali_products/*/包含条款的文件.pdf`
- 输出位置: `/projson/产品名称.json`

## 产品类型分类规则

### 1. 医疗险 (health_product_schema.json)
**匹配规则**: 文件名包含"医疗保险"
**示例**:
- 中意e药保医疗保险（互联网专属）- 条款.pdf
- 中意e民保医疗保险（互联网专属）- 条款.pdf
- 中意悦享百万医疗保险（2021）- 条款.pdf

### 2. 意外险 (accident.json)
**匹配规则**: 文件名包含"意外伤害保险"但不包含"附加"
**示例**:
- 中意e外保意外伤害保险 - 条款.pdf
- 中意e路保航空意外伤害保险 - 条款.pdf
- 中意中e行意外伤害保险（互联网专属）- 条款.pdf

### 3. 重疾险 (critical_illness_product_schema.json)
**匹配规则**: 文件名包含"重大疾病保险"或"恶性肿瘤疾病保险"
**示例**:
- 中意宝贝无忧2.0少儿重大疾病保险-条款.pdf
- 中意优享恶性肿瘤疾病保险 - 条款.pdf
- 中意悦享一生（焕新版）重大疾病保险-条款.pdf

### 4. 定期寿险 (term_life_product_schema.json)
**匹配规则**: 文件名包含"定期寿险"
**示例**:
- 中意守护挚爱2.0定期寿险（互联网专属）- 条款.pdf

### 5. 终身寿险 (whole_life_product_schema.json)
**匹配规则**: 文件名包含"终身寿险"
**示例**:
- 中意一生中意（甄享版）终身寿险（分红型）- 条款.pdf
- 中意臻享一生（传世版）终身寿险（分红型）- 条款.pdf

### 6. 年金险 (annuity_product_schema.json)
**匹配规则**: 文件名包含"养老年金保险"或"年金保险"
**示例**:
- 中意一生中意年金保险（分红型）- 条款.pdf
- 中意悠然鑫瑞养老年金保险（分红型）- 条款.pdf
- 中意裕享金生养老年金保险 - 条款.pdf

### 7. 两全保险 (使用 health_product_schema.json 结构)
**匹配规则**: 文件名包含"两全保险"
**示例**:
- 中意优选两全保险（分红型）- 条款.pdf
- 中意幸福颐养两全保险（分红型）- 条款.pdf

### 8. 护理保险 (使用 health_product_schema.json 结构)
**匹配规则**: 文件名包含"护理保险"
**示例**:
- 中意岁岁守护（惠选版）护理保险- 条款.pdf
- 中意颐养岁悠2.0终身护理保险（互联网专属）- 条款.pdf

### 9. 失能保险 (使用 health_product_schema.json 结构)
**匹配规则**: 文件名包含"失能收入损失保险"
**示例**:
- 中意守护安康失能收入损失保险（互联网专属）- 条款.pdf
- 中意鑫意无忧2.0失能收入损失保险-条款.pdf

### 10. 附加险（跳过）
**匹配规则**: 文件名包含"附加"
**说明**: 附加险不生成独立 JSON

## 工作流程

### 步骤 1: 读取并分析每个条款 PDF
- 使用 PDF 解析工具读取条款内容
- 提取关键信息：产品代码、投保年龄、保障期限、等待期、保障责任等
- 根据文件名确定产品类型

### 步骤 2: 匹配对应的 schema
- 根据产品类型选择正确的 schema
- 参考 schemas 文件夹下的对应文件

### 步骤 3: 生成 JSON 文件
- 按照 schema 结构填充数据
- 使用默认值填充无法从 PDF 提取的字段
- 确保所有 required 字段都有值
- 文件命名：去除" - 条款"或"- 条款"后缀，添加 .json 扩展名

### 步骤 4: 验证 JSON 格式
- 验证 JSON 语法正确性
- 验证符合 schema 要求
- 检查必填字段完整性

## 默认值策略

对于无法从 PDF 提取的字段，使用以下默认值：

| 字段 | 默认值 |
|------|--------|
| productCode | 使用文件名生成唯一编码 |
| insurerName | "中意人寿保险有限公司" |
| onlineClaimFlag | true |
| status | "生效" |
| salesRegions | "全国（不含港澳台）" |
| effectiveDate | "2024-01-01" |
| expiryDate | null |
| version | "1.0" |
| salesUrl | "" |
| productHeroImage | "" |
| productLongImage | [] |
| productAttachment | [] |
| clausesCode | [productCode] |
| productIntroduction | "" |
| productAdvantages | "" |
| precautions | "" |
| crowd | "" |
| generalComment | "" |
| tags | "" |
| annualPremium | 0 |
| purchaseLimit | 1 |

## 产品类型到 Schema 映射表

| 产品类型 | Schema 文件 |
|---------|------------|
| 医疗险 | schemas/health_product_schema.json |
| 意外险 | schemas/accident.json |
| 重疾险 | schemas/critical_illness_product_schema.json |
| 定期寿险 | schemas/term_life_product_schema.json |
| 终身寿险 | schemas/whole_life_product_schema.json |
| 年金险 | schemas/annuity_product_schema.json |
| 两全保险 | schemas/health_product_schema.json (参考结构) |
| 护理保险 | schemas/health_product_schema.json (参考结构) |
| 失能保险 | schemas/health_product_schema.json (参考结构) |

## 示例输出文件名

| 输入文件 | 输出文件 |
|---------|---------|
| 中意e药保医疗保险（互联网专属）- 条款.pdf | 中意e药保医疗保险（互联网专属）.json |
| 中意e外保意外伤害保险 - 条款.pdf | 中意e外保意外伤害保险.json |
| 中意守护挚爱2.0定期寿险（互联网专属）- 条款.pdf | 中意守护挚爱2.0定期寿险（互联网专属）.json |

## 注意事项

1. **跳过附加险**: 文件名包含"附加"的产品不生成 JSON
2. **UTF-8 编码**: 确保 JSON 文件使用 UTF-8 编码
3. **日期格式**: 所有日期字段使用 YYYY-MM-DD 格式
4. **类型准确性**: 严格遵守 schema 中定义的类型（string, number, integer, boolean, array）
5. **必填字段**: 确保所有 required 字段都有有效值
6. **中文内容**: 保持原始中文内容，不要翻译

## 验证清单

对于每个生成的 JSON 文件，验证：
- [ ] JSON 语法正确
- [ ] 所有 required 字段存在
- [ ] 字段类型与 schema 一致
- [ ] 枚举值在允许范围内
- [ ] 数组和对象结构正确
- [ ] 文件名正确（去除了"条款"后缀）

## 预期输出

生成约 80-90 个 JSON 文件（排除附加险后）到 projson 文件夹。
