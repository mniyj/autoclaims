# 理赔材料元数据管理模块

## Context

当前"理赔材料管理"页面新增材料时，材料类型下拉框从 `material-type-catalog.json` 读取数据。但该目录没有管理 UI，只能手动编辑 JSON 文件。需要在理赔材料管理页面内新增一个 Tab，提供材料元数据（材料名称 + 材料代码）的增删改查功能。

## 实现方案

### 1. 页面结构改造：添加 Tab 切换

**文件**: `components/ClaimsMaterialManagementPage.tsx`

在页面标题下方新增 Tab 栏，包含两个 Tab：
- **材料配置**（默认）— 现有的材料列表和编辑功能
- **材料元数据** — 新增的元数据管理功能

新增 state：
```typescript
const [activeTab, setActiveTab] = useState<'materials' | 'metadata'>('materials');
```

将现有的搜索、表格、分页等内容包裹在 `activeTab === 'materials'` 条件下。

### 2. 元数据管理 Tab 内容

UI 结构：
- 顶部：搜索框 + "新增元数据"按钮
- 表格列：材料名称(type_name)、材料代码(type_code)、状态(status)、操作(编辑/删除)
- 底部：分页
- Modal：新增/编辑表单，字段为材料名称和材料代码

### 3. 元数据 CRUD 逻辑

数据源复用现有 `materialTypeCatalog` state（已从 `api.materialTypeCatalog.list()` 加载）。

- **新增**: 校验 type_code 唯一性，构造 `MaterialTypeCatalogItem` 对象（其余字段给默认值），调用 `api.materialTypeCatalog.saveAll()` 保存
- **编辑**: 仅允许修改 type_name，type_code 创建后不可修改
- **删除**: 检查是否有材料引用该 type_code，有引用则阻止删除

新增元数据时的默认值：
```typescript
{
  type_code: "",        // 用户输入
  type_name: "",        // 用户输入
  category: "other",    // 默认分类
  description: "",
  default_processing_strategy: "general_doc",
  default_confidence_threshold: 0.9,
  recommended_facts: [],
  status: "ACTIVE"
}
```

### 4. 关键文件

| 文件 | 修改内容 |
|------|---------|
| `components/ClaimsMaterialManagementPage.tsx` | 添加 Tab 切换、元数据管理 UI 和逻辑 |

不需要修改其他文件 — API 层(`api.materialTypeCatalog`)和类型定义(`MaterialTypeCatalogItem`)已经存在。

## 验证

1. 启动开发服务器 `npm run dev`
2. 进入"理赔材料管理"页面
3. 验证 Tab 切换正常，"材料配置" Tab 功能不受影响
4. 在"材料元数据" Tab 中新增一条元数据
5. 切回"材料配置" Tab，新增材料时确认下拉框中出现刚添加的元数据
6. 验证编辑和删除功能正常
7. 验证删除被引用的元数据时会提示阻止
