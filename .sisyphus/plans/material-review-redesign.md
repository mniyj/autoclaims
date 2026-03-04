# Work Plan: 材料审核Tab多视图展示系统

## TL;DR

重构理赔员后台的"材料审核"Tab，支持四种视图模式：按材料类型分类展示、按上传时间轴展示、按材料清单列表展示，以及保留现有的"AI提取+文件查看器"双栏审核视图。**点击材料后弹出审核Drawer，复用现有的DocumentReviewPage组件提供完整的字段编辑和审核功能**。

**Estimated Effort**: Large (预计8-10个任务)
**Parallel Execution**: YES - 4 waves
**Critical Path**: 类型定义 → 基础组件 → 视图实现 → 集成测试

---

## Context

### 原始需求
用户希望理赔员后台的赔案详情页面中的"材料审核"tab，能够：
1. 按材料类型分类展示
2. 按上传时间轴展示
3. 按材料清单列表展示
4. 点击任一材料后进入详情页面

### 当前现状
- `ClaimCaseDetailPage.tsx` 第1300-1972行已有材料审核tab的基础实现
- 现有实现：左栏(380px)展示AI提取结果，右栏展示文件查看器
- 数据结构：`ProcessedFile` + `AnyDocumentSummary`（6种文档类型）
- 已存在`DocumentReviewPage`组件用于单材料审核

### 设计决策（已确认）
- **视图切换**：顶部Tab切换（分类展示 | 时间轴 | 清单 | AI审核）
- **详情页面**：弹窗Modal形式（复用DocumentReviewPage）
- **现有布局**：作为第四种"AI审核视图"保留
- **卡片信息**：完整信息（缩略图、文件名、类型标签、时间、状态、置信度）
- **审核体验**：方案B - 统一审核体验（所有视图点击卡片后都可编辑字段）

---

## Work Objectives

### Core Objective
在`ClaimCaseDetailPage`的材料审核tab中实现多视图展示系统，支持理赔材料的高效审核和浏览。

### Concrete Deliverables
1. 类型定义扩展 (`types.ts` 补充或新文件)
2. 材料审核主面板组件 (`MaterialReviewPanel.tsx`)
3. 视图切换组件 (`ViewSwitcher.tsx`)
4. 分类展示视图组件 (`CategoryView.tsx`)
5. 时间轴展示视图组件 (`TimelineView.tsx`)
6. 清单列表视图组件 (`ListView.tsx`)
7. 材料卡片组件 (`MaterialCard.tsx`)
8. **材料审核抽屉组件** (`MaterialReviewDrawer.tsx`) - 复用DocumentReviewPage
9. 集成到`ClaimCaseDetailPage`的材料审核tab
10. 工具函数和辅助类型

### Definition of Done
- [ ] 四种视图均可正常切换和展示
- [ ] 点击材料卡片弹出审核抽屉（复用DocumentReviewPage）
- [ ] 审核抽屉支持字段编辑、保存、批量通过
- [ ] 分类视图按材料类型正确分组
- [ ] 时间轴视图按上传时间正确排序
- [ ] 清单视图支持排序和筛选
- [ ] AI审核视图（原有功能）正常工作
- [ ] 所有组件使用TypeScript类型安全
- [ ] UI风格与现有项目保持一致（Tailwind）

### Must Have
- 四种视图切换功能
- 材料卡片完整信息展示
- 材料详情弹窗
- 响应式布局
- 空状态处理

### Must NOT Have (Guardrails)
- 不修改现有`DocumentReviewPage`组件
- 不删除现有AI审核双栏布局
- 不引入新的CSS框架
- 不修改后端API

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (项目无测试框架)
- **Automated tests**: NO (不需要添加单元测试)
- **Agent-Executed QA**: YES - 每个任务包含Playwright验证步骤

### QA Policy
每个任务包含Agent-Executed QA场景：
- **Frontend/UI**: Playwright导航、交互、断言DOM、截图
- **测试数据**: 使用现有mock数据或添加必要的mock
- **验证项**: 视图切换、材料展示、弹窗交互

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (基础类型和工具):
├── Task 1: 创建材料视图类型定义和工具函数
└── Task 2: 创建ViewSwitcher组件

Wave 2 (核心展示组件):
├── Task 3: 实现MaterialCard材料卡片组件
├── Task 4: 实现CategoryView分类展示视图
├── Task 5: 实现TimelineView时间轴展示视图
└── Task 6: 实现ListView清单列表视图

Wave 3 (详情和主面板):
├── Task 7: 实现MaterialDetailModal材料详情弹窗
└── Task 8: 实现MaterialReviewPanel主面板

Wave 4 (集成和QA):
├── Task 9: 集成到ClaimCaseDetailPage
└── Task 10: 最终QA验证

Critical Path: Task 1 → Task 3 → Task 4/5/6 → Task 8 → Task 9 → Task 10
Parallel Speedup: ~60% faster than sequential
```

---

## TODOs

### Task 1: 创建材料视图类型定义和工具函数

**What to do**:
- 在`types.ts`中补充或新建`material-review.ts`类型文件
- 定义`MaterialViewItem`扩展类型
- 定义`MaterialViewMode`联合类型
- 定义`MaterialCategory`枚举/类型
- 创建材料分类映射工具函数
- 创建时间排序工具函数

**Must NOT do**:
- 不修改现有的`ProcessedFile`或`ProcessedFileExtended`类型
- 不修改`AnyDocumentSummary`相关类型

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: []
- **Reason**: 纯类型定义和工具函数，无复杂逻辑

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1
- **Blocks**: Task 4, 5, 6, 7, 8
- **Blocked By**: None

**References**:
- `types.ts:557-571` - ProcessedFile 定义
- `types.ts:1758-1798` - ProcessedFileExtended 定义
- `types.ts:1803-1897` - AnyDocumentSummary 相关类型

**Acceptance Criteria**:
- [ ] 新类型定义编译通过
- [ ] 工具函数有完整JSDoc注释
- [ ] 类型与现有数据结构兼容

**QA Scenarios**:

```
Scenario: 类型定义编译检查
  Tool: Bash (tsc)
  Preconditions: cd /Users/pegasus/Documents/trae_projects/保险产品配置页面 -理赔
  Steps:
    1. Run "npx tsc --noEmit types.ts"
  Expected Result: 无类型错误
  Evidence: .sisyphus/evidence/task-1-tsc-check.txt
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 2: 创建ViewSwitcher视图切换组件

**What to do**:
- 创建`components/material-review/ViewSwitcher.tsx`
- 实现顶部Tab切换UI
- 支持四种视图：category, timeline, list, ai_review
- 显示材料数量徽章
- 使用项目现有UI风格（Tailwind）

**Must NOT do**:
- 不实现视图内容，仅实现切换器UI
- 不使用外部UI库

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: []
- **Reason**: UI组件，需要匹配项目现有视觉风格

**Parallelization**:
- **Can Run In Parallel**: YES (与Task 1并行)
- **Parallel Group**: Wave 1
- **Blocks**: Task 8
- **Blocked By**: None

**References**:
- `ClaimCaseDetailPage.tsx:540-572` - 现有Tab切换实现参考
- `components/ui/AnchoredField.tsx:174-229` - AnchoredSection样式参考

**Acceptance Criteria**:
- [ ] 组件可接收currentView和onViewChange props
- [ ] 四种视图Tab正确显示
- [ ] 当前视图高亮样式正确
- [ ] 响应式布局（移动端适配）

**QA Scenarios**:

```
Scenario: Tab切换交互测试
  Tool: Playwright
  Preconditions: 组件已渲染在测试页面
  Steps:
    1. Navigate to test page
    2. Click "分类展示" tab
    3. Assert "分类展示" tab has active class
    4. Click "时间轴" tab
    5. Assert onViewChange callback fired with 'timeline'
  Expected Result: Tab切换正常工作，回调触发正确
  Evidence: .sisyphus/evidence/task-2-tab-switch.png
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 3: 实现MaterialCard材料卡片组件

**What to do**:
- 创建`components/material-review/MaterialCard.tsx`
- 展示：缩略图（或文件类型图标）、文件名、材料类型标签
- 展示：上传时间、识别状态徽章、AI置信度进度条
- 支持hover效果
- 支持点击事件

**Must NOT do**:
- 不实现缩略图生成功能（使用占位图或文件类型图标）
- 不实现右键菜单

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: []
- **Reason**: 核心UI组件，需要精心设计视觉效果

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Task 4, 5, 6
- **Blocked By**: Task 1 (类型定义)

**References**:
- `ClaimCaseDetailPage.tsx:1100-1144` - 现有文档列表项样式参考
- `components/ui/AnchoredField.tsx:39-86` - 置信度颜色系统参考

**Acceptance Criteria**:
- [ ] 卡片展示所有必需信息
- [ ] 不同状态（已完成/处理中/失败）有不同颜色标识
- [ ] 置信度用进度条可视化（≥90%绿色，70-90%蓝色，<70%黄色）
- [ ] 支持onClick回调
- [ ] 支持hover状态

**QA Scenarios**:

```
Scenario: 卡片渲染和交互测试
  Tool: Playwright
  Preconditions: 组件已渲染，传入mock数据
  Steps:
    1. Verify card displays file name
    2. Verify card displays material type tag
    3. Verify card displays upload time
    4. Verify confidence bar is visible with correct color
    5. Hover over card and verify hover effect
    6. Click card and verify onClick callback fired
  Expected Result: 卡片正确渲染，交互正常
  Evidence: .sisyphus/evidence/task-3-card-test.png

Scenario: 不同状态卡片测试
  Tool: Playwright
  Preconditions: 组件已渲染
  Steps:
    1. Render card with status 'completed'
    2. Verify green status badge
    3. Render card with status 'processing'
    4. Verify blue/yellow status indicator
    5. Render card with status 'failed'
    6. Verify red status badge
  Expected Result: 不同状态正确显示对应样式
  Evidence: .sisyphus/evidence/task-3-status-test.png
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 4: 实现CategoryView分类展示视图

**What to do**:
- 创建`components/material-review/CategoryView.tsx`
- 按材料类型分组展示（身份/医疗/事故/收入/其他）
- 每组使用可折叠面板
- 使用MaterialCard展示每个材料
- 显示每组的材料数量

**Must NOT do**:
- 不实现拖拽排序功能
- 不实现分组编辑功能

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: []
- **Reason**: 需要实现分组布局和折叠面板

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Task 8
- **Blocked By**: Task 1, Task 3

**References**:
- `ClaimCaseDetailPage.tsx:1006-1080` - 现有文件分类折叠面板参考
- `components/ui/AnchoredField.tsx:174-229` - AnchoredSection折叠实现

**Acceptance Criteria**:
- [ ] 材料按类型正确分组
- [ ] 每组显示材料数量
- [ ] 组可展开/折叠
- [ ] 空组显示提示信息
- [ ] 点击材料触发onSelect回调

**QA Scenarios**:

```
Scenario: 分类视图功能测试
  Tool: Playwright
  Preconditions: 组件已渲染，传入多类型mock数据
  Steps:
    1. Verify materials are grouped by type
    2. Verify group headers show correct counts
    3. Click group header to collapse
    4. Verify group content is hidden
    5. Click group header to expand
    6. Verify group content is visible
    7. Click material card
    8. Verify onSelect callback fired with correct material
  Expected Result: 分类展示和交互正常
  Evidence: .sisyphus/evidence/task-4-category-view.png
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 5: 实现TimelineView时间轴展示视图

**What to do**:
- 创建`components/material-review/TimelineView.tsx`
- 按上传时间倒序排列（最新的在前）
- 使用时间轴视觉设计（左侧线条+时间点）
- 按日期分组（今天、昨天、更早）
- 使用MaterialCard展示每个材料

**Must NOT do**:
- 不实现时间筛选器
- 不实现日期范围选择

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: []
- **Reason**: 时间轴需要特殊的视觉布局

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Task 8
- **Blocked By**: Task 1, Task 3

**References**:
- `ClaimCaseDetailPage.tsx:2231-2299` - 现有时间轴样式参考（操作日志）

**Acceptance Criteria**:
- [ ] 材料按上传时间倒序排列
- [ ] 时间轴视觉正确显示
- [ ] 日期分组标签正确（今天/昨天/具体日期）
- [ ] 点击材料触发onSelect回调
- [ ] 空状态显示提示

**QA Scenarios**:

```
Scenario: 时间轴视图功能测试
  Tool: Playwright
  Preconditions: 组件已渲染，传入带不同时间的mock数据
  Steps:
    1. Verify materials are sorted by upload time (newest first)
    2. Verify timeline visual elements are present
    3. Verify date grouping labels are correct
    4. Verify materials from same date are grouped together
    5. Click material card
    6. Verify onSelect callback fired
  Expected Result: 时间轴展示和排序正常
  Evidence: .sisyphus/evidence/task-5-timeline-view.png
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 6: 实现ListView清单列表视图

**What to do**:
- 创建`components/material-review/ListView.tsx`
- 表格形式展示材料清单
- 列：序号、材料名称、类型、上传时间、状态、置信度、操作
- 支持表头点击排序
- 支持简单筛选（按类型/状态）

**Must NOT do**:
- 不实现分页（材料数量通常不多）
- 不实现复杂筛选器

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: []
- **Reason**: 表格组件，需要实现排序和筛选

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2
- **Blocks**: Task 8
- **Blocked By**: Task 1, Task 3

**References**:
- `ClaimCaseDetailPage.tsx:804-994` - 现有理赔计算表格样式参考
- `components/ClaimsMaterialManagementPage.tsx` - 材料管理页面表格参考

**Acceptance Criteria**:
- [ ] 表格展示所有列
- [ ] 表头点击可排序
- [ ] 支持按类型筛选
- [ ] 支持按状态筛选
- [ ] 点击行触发onSelect回调
- [ ] 空状态显示提示

**QA Scenarios**:

```
Scenario: 列表视图功能测试
  Tool: Playwright
  Preconditions: 组件已渲染，传入mock数据
  Steps:
    1. Verify all columns are displayed
    2. Click column header to sort
    3. Verify rows are re-sorted
    4. Select type filter
    5. Verify only matching materials are shown
    6. Clear filter
    7. Verify all materials are shown
    8. Click row
    9. Verify onSelect callback fired
  Expected Result: 列表展示、排序、筛选正常
  Evidence: .sisyphus/evidence/task-6-list-view.png
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 7: 实现MaterialReviewDrawer材料审核抽屉

**What to do**:
- 创建`components/material-review/MaterialReviewDrawer.tsx`
- **复用`DocumentReviewPage`组件**作为核心审核界面
- 使用Drawer/Modal容器包装DocumentReviewPage
- 适配DocumentReviewPage的props：
  - `documentId`: 材料ID
  - `imageUrl`: OSS文件URL
  - `ocrResult`: OCR识别结果（从documentSummary转换）
  - `materialConfig`: 材料配置（从classification映射）
  - `onSaveCorrections`: 保存修正回调
  - `onApproveAll`: 批量通过回调
- 处理Drawer的打开/关闭动画
- 响应式：桌面端右侧抽屉，移动端全屏Modal

**必须复用的功能**：
- ✅ **字段展示**：DocumentReviewPage的字段分组展示
- ✅ **字段编辑**：DynamicFieldInput的编辑功能
- ✅ **置信度显示**：低置信度字段高亮
- ✅ **批量通过**：一键通过高置信度字段
- ✅ **保存修正**：保存编辑后的字段值
- ✅ **源文件跳转**：点击字段跳转到源文件位置
- ✅ **统计面板**：显示字段审核统计

**Must NOT do**:
- 不修改`DocumentReviewPage`组件本身（仅作为黑盒使用）
- 不重新实现字段编辑逻辑
- 不复制定DocumentReviewPage的代码

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []
- **Reason**: 需要理解和适配DocumentReviewPage的接口

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 3
- **Blocks**: Task 8
- **Blocked By**: Task 1

**References**:
- `components/document-review/DocumentReviewPage.tsx` - **核心复用组件**
- `components/document-review/DynamicFieldInput.tsx` - 字段输入组件
- `components/document-review/FieldGroupPanel.tsx` - 字段分组面板
- `ClaimCaseDetailPage.tsx:1434-1936` - 现有审核逻辑参考

**Acceptance Criteria**:
- [ ] Drawer/Modal正确显示DocumentReviewPage
- [ ] 字段编辑功能正常工作（修改、保存）
- [ ] 批量通过功能正常工作
- [ ] 点击字段跳转到源文件位置
- [ ] 统计面板显示正确
- [ ] Drawer可正常关闭
- [ ] 响应式布局（桌面端抽屉/移动端全屏）

**QA Scenarios**:

```
Scenario: 审核抽屉功能测试
  Tool: Playwright
  Preconditions: 组件已渲染，传入mock材料数据
  Steps:
    1. Open drawer with mock material
    2. Verify DocumentReviewPage is rendered inside drawer
    3. Verify file preview is displayed
    4. Verify extracted fields are shown with confidence indicators
    5. Edit a low-confidence field
    6. Verify field value is updated
    7. Click "保存修正" button
    8. Verify onSaveCorrections callback fired with corrections
    9. Click "全部通过" button
    10. Verify high-confidence fields are marked as approved
    11. Click close button
    12. Verify drawer is closed
  Expected Result: 审核抽屉完整功能正常工作
  Evidence: .sisyphus/evidence/task-7-drawer-full.png

Scenario: 字段跳转测试
  Tool: Playwright
  Preconditions: 审核抽屉已打开
  Steps:
    1. Click on a field with source anchor
    2. Verify onJumpTo callback fired with correct anchor
    3. Verify parent component receives jump event
  Expected Result: 字段跳转功能正常工作
  Evidence: .sisyphus/evidence/task-7-field-jump.png

Scenario: 不同类型材料审核测试
  Tool: Playwright
  Preconditions: 组件已渲染
  Steps:
    1. Open drawer with expense_invoice type material
    2. Verify invoice-specific fields (开票日期, 发票金额, etc.) are editable
    3. Open drawer with inpatient_record type material
    4. Verify medical-specific fields (入院日期, 诊断, etc.) are editable
  Expected Result: 不同类型材料显示对应可编辑字段
  Evidence: .sisyphus/evidence/task-7-type-specific.png
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 8: 实现MaterialReviewPanel主面板

**What to do**:
- 创建`components/material-review/MaterialReviewPanel.tsx`
- 整合ViewSwitcher和所有视图组件
- 管理当前视图状态
- 处理材料选择事件
- **控制审核Drawer显示**（调用MaterialReviewDrawer）
- 保留AI审核视图（导入现有双栏布局代码）
- 传递必要的props和回调给子组件

**Must NOT do**:
- 不修改数据获取逻辑（使用父组件传入的数据）
- 不添加新的状态管理

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []
- **Reason**: 需要整合多个组件，逻辑较复杂

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3
- **Blocks**: Task 9
- **Blocked By**: Task 2, 3, 4, 5, 6, 7

**References**:
- `ClaimCaseDetailPage.tsx:1300-1972` - 现有材料审核tab实现
- `ClaimCaseDetailPage.tsx:183-315` - 相关处理函数参考

**Acceptance Criteria**:
- [ ] 四种视图可正常切换
- [ ] 每种视图正确渲染
- [ ] 点击材料弹出审核Drawer（复用DocumentReviewPage）
- [ ] 审核Drawer支持完整的字段编辑和保存
- [ ] AI审核视图（原有功能）正常工作
- [ ] 空状态正确处理
- [ ] Props设计合理，与父组件集成顺畅

**QA Scenarios**:

```
Scenario: 视图切换集成测试
  Tool: Playwright
  Preconditions: 组件已渲染，有mock数据
  Steps:
    1. Verify default view is 'category'
    2. Click 'timeline' tab
    3. Verify TimelineView is rendered
    4. Click 'list' tab
    5. Verify ListView is rendered
    6. Click 'ai_review' tab
    7. Verify AI review view (dual panel) is rendered
    8. Click 'category' tab
    9. Verify CategoryView is rendered
  Expected Result: 视图切换正常，各视图正确渲染
  Evidence: .sisyphus/evidence/task-8-view-switch.gif

Scenario: 材料选择和审核Drawer测试
  Tool: Playwright
  Preconditions: 组件已渲染，有mock数据
  Steps:
    1. Click on a material card
    2. Verify MaterialReviewDrawer opens
    3. Verify DocumentReviewPage is rendered inside drawer
    4. Verify file preview is displayed
    5. Verify extracted fields are editable
    6. Edit a field value
    7. Click "保存修正" button
    8. Verify save callback is triggered
    9. Click close button
    10. Verify drawer closes
  Expected Result: 材料选择和审核Drawer正常工作，支持字段编辑
  Evidence: .sisyphus/evidence/task-8-drawer-flow.png
```

**Commit**: NO (作为Task 9一起提交)

---

### Task 9: 集成到ClaimCaseDetailPage

**What to do**:
- 修改`ClaimCaseDetailPage.tsx`的材料审核tab部分（第1300-1972行）
- 引入MaterialReviewPanel组件
- 将原有的双栏布局作为AI审核视图保留
- 确保数据和回调正确传递
- 添加必要的mock数据（如需要）

**Must NOT do**:
- 不修改其他tab的实现
- 不修改数据加载逻辑
- 不删除现有处理函数

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []
- **Reason**: 需要小心修改现有代码，确保兼容性

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4
- **Blocks**: Task 10
- **Blocked By**: Task 8

**References**:
- `ClaimCaseDetailPage.tsx:1300-1972` - 现有材料审核tab代码

**Acceptance Criteria**:
- [ ] 材料审核Tab正常加载
- [ ] 四种视图可正常切换
- [ ] 点击材料弹出详情Modal
- [ ] AI智能审核等功能正常工作
- [ ] 无TypeScript编译错误
- [ ] 无运行时错误

**QA Scenarios**:

```
Scenario: 完整集成测试
  Tool: Playwright
  Preconditions: 应用已启动，有测试赔案数据
  Steps:
    1. Navigate to claim case detail page
    2. Click '材料审核' tab
    3. Verify MaterialReviewPanel is rendered
    4. Verify ViewSwitcher shows 4 tabs
    5. Switch between all 4 views
    6. In category view, click a material
    7. Verify MaterialReviewDrawer opens
    8. Verify DocumentReviewPage is rendered with editable fields
    9. Test field editing and save
    10. Close drawer
    11. In ai_review view, verify dual panel layout works
  Expected Result: 集成正常工作，审核Drawer支持完整字段编辑
  Evidence: .sisyphus/evidence/task-9-integration.png

Scenario: 现有功能兼容性测试
  Tool: Playwright
  Preconditions: 应用已启动
  Steps:
    1. Click 'AI智能审核' button
    2. Verify AI review result is displayed
    3. Click '生成定损报告' button
    4. Verify report generation works
    5. Verify existing smart review features still work
  Expected Result: 现有功能未受影响
  Evidence: .sisyphus/evidence/task-9-compatibility.png
```

**Commit**: YES
- Message: `feat(claim): 重构材料审核tab，支持多视图展示`
- Files: 
  - types.ts (或新文件)
  - components/material-review/*.tsx (8个新文件)
  - ClaimCaseDetailPage.tsx
- Pre-commit: `npm run build` 成功

**复用的现有组件**:
- `components/document-review/DocumentReviewPage.tsx` - 核心审核界面
- `components/document-review/DynamicFieldInput.tsx` - 字段编辑
- `components/document-review/FieldGroupPanel.tsx` - 字段分组
- `components/document-review/DocumentPreviewPanel.tsx` - 文档预览
- `components/ui/AnchoredField.tsx` - 字段展示（AI审核视图）
- `components/ui/DocumentViewer.tsx` - 文件查看器（AI审核视图）

---

### Task 10: 最终QA验证

**What to do**:
- 使用Playwright进行端到端测试
- 验证所有四种视图
- 验证材料审核Drawer（复用DocumentReviewPage）
- 验证字段编辑、保存、批量通过功能
- 验证与现有功能的兼容性
- 捕获截图作为证据

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`playwright`]
- **Reason**: 需要全面测试所有功能

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4
- **Blocks**: None
- **Blocked By**: Task 9

**Acceptance Criteria**:
- [ ] 所有QA场景通过
- [ ] 截图证据已保存
- [ ] 无控制台错误
- [ ] 响应式布局在移动端正常

**QA Scenarios**:

```
Scenario: 完整功能验证
  Tool: Playwright
  Preconditions: 应用已启动，npm run dev成功
  Steps:
    1. Open http://localhost:8080
    2. Login and navigate to claim case list
    3. Open a claim case with materials
    4. Click '材料审核' tab
    5. Take screenshot: task-10-default-view.png
    6. Test category view: expand/collapse groups
    7. Take screenshot: task-10-category-view.png
    8. Switch to timeline view
    9. Take screenshot: task-10-timeline-view.png
    10. Switch to list view
    11. Take screenshot: task-10-list-view.png
    12. Switch to ai_review view
    13. Take screenshot: task-10-ai-review-view.png
    14. In category view, click material card
    15. Verify MaterialReviewDrawer opens
    16. Verify DocumentReviewPage is rendered
    17. Edit a field and save
    18. Take screenshot: task-10-drawer-edit.png
    19. Test "全部通过" button
    20. Take screenshot: task-10-batch-approve.png
    21. Close drawer
    22. Verify drawer closes properly
  Expected Result: 所有功能正常工作，审核Drawer支持完整编辑功能，截图保存成功
  Evidence: .sisyphus/evidence/task-10-*.png
```

**Commit**: NO (已在Task 9提交)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** - `oracle`
  验证所有TODO已完成，检查文件结构符合计划。

- [ ] F2. **Code Quality Review** - `unspecified-high`
  运行 `tsc --noEmit` 确保无类型错误，检查代码风格。

- [ ] F3. **Real Manual QA** - `unspecified-high` + `playwright`
  执行所有QA场景，验证截图证据。

- [ ] F4. **Scope Fidelity Check** - `deep`
  验证四种视图都正常工作，未超出范围的功能。

---

## Commit Strategy

- **Final**: `feat(claim): 重构材料审核tab，支持多视图展示`
  - Files: types.ts, components/material-review/*.tsx, ClaimCaseDetailPage.tsx
  - Pre-commit: npm run build

---

## Success Criteria

### Verification Commands
```bash
cd /Users/pegasus/Documents/trae_projects/保险产品配置页面 -理赔
npm run build  # Expected: 构建成功
```

### Final Checklist
- [ ] 四种视图（分类/时间轴/清单/AI审核）均可正常切换
- [ ] 材料卡片展示完整信息
- [ ] 点击材料弹出详情Modal
- [ ] AI智能审核等现有功能未受影响
- [ ] TypeScript编译无错误
- [ ] UI风格与项目保持一致
- [ ] 响应式布局在移动端正常
