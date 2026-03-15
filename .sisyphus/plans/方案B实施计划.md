# 方案B实施计划：完整知识库管理功能

## 项目概述

基于设计图要求，建设完全独立的知识库管理中心，不依赖现有医保目录和医院信息管理页面。

**预计工期**: 3-4周
**交付标准**: 完整的知识库主数据管理、规则配置、关系图谱功能

---

## 实施阶段划分

### 第一阶段：主数据管理页面（Week 1）

#### 1.1 药品管理页面
**文件**: `components/knowledge/DrugManagementPage.tsx`

**功能需求**:
- 药品列表（支持分页、搜索、筛选）
- 药品详情/编辑表单
- 字段：drug_id, generic_name, brand_name, aliases, dosage_form, spec, package, manufacturer, nhsa_code, nmpa_approval_no, reimbursement_flag, reimbursement_restriction, indications, dose_min, dose_max, course_min, course_max, route, status
- 别名管理（内联编辑）
- 批量导入/导出

**界面组件**:
- 搜索栏（名称、编码、厂家）
- 筛选器（医保类别、剂型）
- 数据表格（分页10条/页）
- 编辑模态框
- 批量操作按钮

#### 1.2 诊疗项目管理页面
**文件**: `components/knowledge/ServiceItemManagementPage.tsx`

**功能需求**:
- 项目列表（分页、搜索、筛选）
- 项目详情/编辑表单
- 字段：item_id, standard_name, aliases, local_names, item_category, sub_category, local_item_code, price_low, price_high, unit, applicable_conditions, frequency_min, frequency_max, course_min, course_max, department, inpatient_flag, outpatient_flag, status
- 别名管理

**界面组件**:
- 搜索栏（标准名称、地方名称）
- 筛选器（类别、门诊/住院）
- 数据表格
- 编辑模态框

#### 1.3 疾病管理页面
**文件**: `components/knowledge/DiseaseManagementPage.tsx`

**功能需求**:
- 疾病列表（分页、搜索）
- 疾病详情/编辑表单
- 字段：disease_id, standard_name, aliases, icd_code, severity_level, common_tests, common_treatments, common_drugs, typical_los_min, typical_los_max, inpatient_necessity_flag, status
- ICD编码校验

**界面组件**:
- 搜索栏（名称、ICD编码）
- 严重程度标签
- 住院必要性标识
- 数据表格
- 编辑模态框

#### 1.4 医院管理页面
**文件**: `components/knowledge/HospitalManagementPage.tsx`

**功能需求**:
- 医院列表（分页、搜索、地图筛选）
- 医院详情/编辑表单
- 字段：hospital_id, standard_name, aliases, province, city, district, level, ownership_type, contract_flag, risk_score, address, phone, status
- 别名管理

**界面组件**:
- 搜索栏（名称、地址）
- 省市筛选器
- 等级筛选器
- 数据表格
- 编辑模态框

---

### 第二阶段：别名映射管理（Week 1-2）

#### 2.1 别名映射页面
**文件**: `components/knowledge/AliasMappingPage.tsx`

**功能需求**:
- 别名列表（分页、搜索、筛选）
- 创建/编辑别名映射
- 字段：alias_id, alias_text, entity_type, entity_id, entity_name, source, confidence, status, created_by
- 批量导入（CSV/Excel）
- 审核流程（待审核/已通过/已驳回）
- 自动标准化测试

**界面组件**:
- 搜索栏（别名文本）
- 实体类型筛选
- 置信度排序
- 状态筛选（待审核/已通过）
- 数据表格
- 编辑模态框
- 批量导入对话框

**特色功能**:
- 输入测试文本，查看标准化结果
- 相似度检测（防止重复映射）

---

### 第三阶段：规则管理（Week 2）

#### 3.1 诊断-药品规则管理
**文件**: `components/knowledge/DiseaseDrugRulePage.tsx`

**功能需求**:
- 规则列表（按疾病分类）
- 创建规则：选择疾病 → 选择药品 → 设置关系类型（推荐/可选/不推荐/禁忌）
- 字段：rule_id, subject_id(disease), object_id(drug), rule_type, action, reason_code, priority, threshold

#### 3.2 诊断-项目规则管理
**文件**: `components/knowledge/DiseaseServiceRulePage.tsx`

**功能需求**:
- 类似诊断-药品规则
- 选择疾病 → 选择诊疗项目 → 设置关系类型

#### 3.3 剂量/疗程规则管理
**文件**: `components/knowledge/DosageRulePage.tsx`

**功能需求**:
- 按药品查看/设置剂量规则
- 字段：dose_min, dose_max, course_min, course_max, action, reason_code
- 超出范围时的处理建议

#### 3.4 频次规则管理
**文件**: `components/knowledge/FrequencyRulePage.tsx`

**功能需求**:
- 按诊疗项目设置频次规则
- 字段：frequency_min, frequency_max, action, reason_code

#### 3.5 住院必要性规则管理
**文件**: `components/knowledge/HospitalizationRulePage.tsx`

**功能需求**:
- 按疾病设置住院必要性
- 字段：los_min, los_max, not_necessity, action, reason_code

---

### 第四阶段：关系图谱管理（Week 3）

#### 4.1 疾病-药品关系管理
**文件**: `components/knowledge/DiseaseDrugRelPage.tsx`

**功能需求**:
- 关系列表
- 创建关系：disease_id, drug_id, rel_type(recommended/optional/not_recommended/contraindicated), evidence_level
- 批量导入

#### 4.2 疾病-项目关系管理
**文件**: `components/knowledge/DiseaseServiceRelPage.tsx`

**功能需求**:
- 类似疾病-药品关系

#### 4.3 手术组合关系管理
**文件**: `components/knowledge/SurgeryComboPage.tsx`

**功能需求**:
- 手术与配套项目的关系
- 字段：surgery_item_id, related_item_id, combo_type, required_flag, confidence

#### 4.4 产品覆盖关系管理
**文件**: `components/knowledge/PolicyCoverageRelPage.tsx`

**功能需求**:
- 产品与药品/项目的覆盖关系
- 字段：product_id, coverage_type, entity_type, entity_id, coverage_action(cover/exclude/limit)

---

### 第五阶段：版本管理与系统集成（Week 3-4）

#### 5.1 版本管理页面
**文件**: `components/knowledge/VersionManagementPage.tsx`

**功能需求**:
- 版本列表（按表分类）
- 版本比对（diff视图）
- 一键发布
- 一键回滚
- 版本历史

#### 5.2 知识库管理中心整合
**文件**: `components/knowledge/KnowledgeManagementPage.tsx`

**功能需求**:
- 左侧导航菜单（树形结构）
- 主内容区域动态加载
- 面包屑导航
- 快捷操作按钮

**导航结构**:
```
知识库管理中心
├── 主数据管理
│   ├── 药品管理
│   ├── 诊疗项目管理
│   ├── 疾病管理
│   └── 医院管理
├── 别名映射
├── 规则管理
│   ├── 诊断-药品规则
│   ├── 诊断-项目规则
│   ├── 剂量/疗程规则
│   ├── 项目频次规则
│   └── 住院必要性规则
├── 关系图谱
│   ├── 疾病-药品关系
│   ├── 疾病-项目关系
│   ├── 手术组合关系
│   └── 产品覆盖关系
└── 版本管理
```

#### 5.3 系统集成
- 在理赔审核流程中调用知识库服务
- 审核结果页面显示Evidence Graph
- 人工审核工作台显示合理性评估建议

---

## 技术实现要点

### 数据表格组件
建议复用或基于现有组件增强：
```tsx
// 通用表格组件
<DataTable
  columns={columns}
  data={data}
  pagination={true}
  pageSize={10}
  onEdit={handleEdit}
  onDelete={handleDelete}
  bulkActions={['delete', 'export']}
/>
```

### 表单组件
```tsx
// 通用表单
<EntityForm
  fields={formFields}
  initialData={editingItem}
  onSubmit={handleSubmit}
  validationSchema={schema}
/>
```

### API封装
```typescript
// services/knowledgeApi.ts
export const knowledgeApi = {
  drugs: {
    list: (params) => api.get('/api/knowledge/drugs', params),
    getById: (id) => api.get(`/api/knowledge/drugs/${id}`),
    create: (data) => api.post('/api/knowledge/drugs', data),
    update: (id, data) => api.put(`/api/knowledge/drugs/${id}`, data),
    delete: (id) => api.delete(`/api/knowledge/drugs/${id}`),
  },
  // ... 其他实体
};
```

---

## 验收标准

### 功能验收
- [ ] 药品CRUD完整可用
- [ ] 诊疗项目CRUD完整可用
- [ ] 疾病CRUD完整可用（含ICD编码）
- [ ] 医院CRUD完整可用
- [ ] 别名映射CRUD完整可用（含审核流程）
- [ ] 5类规则CRUD完整可用
- [ ] 4类关系CRUD完整可用
- [ ] 版本管理（比对、发布、回滚）

### 性能验收
- [ ] 列表页加载 < 2秒
- [ ] 编辑页加载 < 1秒
- [ ] 支持10000条数据分页

### 体验验收
- [ ] 表单验证实时反馈
- [ ] 操作成功/失败提示
- [ ] 批量操作进度显示
- [ ] 移动端适配（可选）

---

## 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| 数据量大导致性能问题 | 高 | 分页+虚拟滚动，后端分页 |
| 表单字段多导致用户困惑 | 中 | 分组显示，分步表单 |
| 与现有医保目录数据冲突 | 高 | 数据同步机制，定期比对 |
| 规则配置复杂 | 中 | 提供模板，可视化配置 |

---

## 下一步行动

1. **确认实施计划** - 确认各阶段优先级和时间安排
2. **准备开发环境** - 确保后端API已就绪
3. **开始第一阶段** - 主数据管理页面开发

**是否确认此计划，开始执行第一阶段？**
