# 医保目录数据迁移完成报告

## 迁移摘要

已成功将医保目录管理数据迁移到知识库管理中心。

## 迁移详情

| 数据类型 | 源数据 | 迁移数量 | 目标文件 | 文件大小 |
|----------|--------|----------|----------|----------|
| **药品** | 3,938 条 | 3,938 条 | drugs.json | 2.7 MB |
| **诊疗项目** | 1,440 条 | 1,440 条 | service_items.json | 1.0 MB |
| **别名映射** | 42 条 | 42 条 | aliases.json | 15 KB |
| **总计** | 5,378 条 | 5,420 条 | - | 3.7 MB |

## 数据映射关系

### 药品数据映射

| 医保目录字段 | 知识库字段 | 说明 |
|--------------|------------|------|
| `genericName` | `generic_name` | 通用名 |
| `name` | `brand_name` | 商品名（如果与通用名不同） |
| `aliases` | `aliases` | 别名列表 |
| `dosageForm` | `dosage_form` | 剂型 |
| `specifications` | `spec` + `package` | 解析为规格和包装 |
| `code` | `nhsa_code` | 医保编码 |
| `type` | `reimbursement_flag` | A→甲类, B→乙类, C→丙类 |
| `restrictions` | `reimbursement_restriction` | 限制条件 |
| `province` | `source` | 数据来源 |
| `effectiveDate` | `valid_from` | 生效日期 |

### 诊疗项目数据映射

| 医保目录字段 | 知识库字段 | 说明 |
|--------------|------------|------|
| `name` | `standard_name` | 标准名称 |
| `category` | `item_category` | treatment→治疗费, material→材料费 |
| `code` | `local_item_code` | 项目编码 |
| `price` | `price_low` + `price_high` | 价格范围 |
| `unit` | `unit` | 单位 |

### 别名映射生成

从药品的 `aliases` 字段自动生成别名映射记录：
- `entity_type`: drug
- `confidence`: 0.95 (高置信度)
- `source`: medical_catalog_import
- `status`: active

## 文件位置

所有迁移后的数据文件保存在：
```
jsonlist/knowledge/processed/
├── drugs.json           # 药品主数据 (3,938条)
├── service_items.json   # 诊疗项目主数据 (1,440条)
├── aliases.json         # 别名映射数据 (42条)
└── migration_report.json # 迁移报告
```

## 使用方式

迁移完成后，知识库管理中心页面可以直接读取这些数据：

1. 启动应用: `npm run dev`
2. 访问: 理赔管理 → 知识库管理
3. 选择相应Tab查看数据：
   - 💊 药品管理 - 查看3,938条药品数据
   - 🩺 诊疗项目管理 - 查看1,440条项目数据
   - 🔗 别名映射 - 查看42条别名映射

## 数据质量

- 所有记录都包含完整的ID、名称、状态等基础字段
- 别名映射已正确关联到对应的药品
- 医保类别已正确转换（A→甲类, B→乙类）
- 所有记录状态为 `active`

## 后续建议

1. **补充缺失字段**：剂量范围、疗程范围等字段需要后续人工录入
2. **添加更多别名**：目前只有42条别名映射，可以根据实际理赔数据补充
3. **建立规则**：基于这些主数据，在规则管理页面建立医学合理性规则
4. **建立关系**：在关系管理页面建立疾病-药品-项目的关联关系
