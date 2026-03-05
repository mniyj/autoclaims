# 规则集可视化升级计划

## 目标
将可视化从"单个规则"升级为"整个规则集"的排布展示

## 当前状态
- ✅ 已实现单个规则的条件树可视化
- ✅ 可以查看 AND/OR/NOT 逻辑门、条件、动作节点
- ❌ 只能一次查看一个规则，无法看到规则间的关系

## 目标状态
- 可视化展示整个规则集的层次结构：
  1. 规则集入口 → 执行域（定责/定损/后处理）
  2. 执行域 → 类别（承保范围/除外责任/免赔额等）
  3. 类别 → 具体规则
  4. 规则 → 条件树（可展开）
  5. 覆盖链关系（虚线连接）

## 执行策略

### Wave 1: 数据层升级
**Task 1**: 扩展数据转换器支持整个规则集
- 修改 `utils/rulesetFlowTransformer.ts`
- 添加 `rulesetToFlowElements()` 函数
- 生成层级结构：Ruleset → Domain → Category → Rule
- 添加覆盖链连接

**Task 2**: 保留单规则详细视图
- 重命名现有函数为 `ruleToDetailedFlowElements()`
- 用于双击规则后展开查看详情

### Wave 2: UI 组件升级  
**Task 3**: 创建新的节点类型
- `RulesetStartNode`: 规则集开始节点（产品名称）
- `ExecutionDomainNode`: 执行域节点（蓝/绿/紫色）
- `CategoryNode`: 类别节点（不同颜色区分）
- `RuleNode`: 规则节点（显示规则名+状态+条件数）

**Task 4**: 更新画布组件
- 修改 `RulesetFlowCanvas.tsx` 接收 `InsuranceRuleset` 而非 `RulesetRule`
- 支持两种视图模式：
  - 概览模式：显示整个规则集结构
  - 详情模式：双击规则显示其条件树
- 添加视图切换逻辑

### Wave 3: 集成和优化
**Task 5**: 更新 RulesetDetailView
- 修改可视化标签页，直接传入整个 ruleset
- 移除"选择规则"的提示，直接显示完整结构
- 侧边栏显示不同层级节点的详情

**Task 6**: 添加交互功能
- 双击规则节点 → 展开/收起条件树
- 点击节点 → 侧边栏显示详情
- 缩放适应视图
- 小地图导航

### Wave 4: 测试验证
**Task 7**: 构建和类型检查
- 运行 npm run build
- 验证无类型错误

**Task 8**: 提交代码
- Git commit 所有变更

## 节点类型设计

### 1. RulesetStartNode
```
┌─────────────────────────┐
│  📋 产品名称            │
│  版本: v1.0            │
│  规则数: 25            │
└─────────────────────────┘
```

### 2. ExecutionDomainNode
```
┌─────────────────────────┐
│  🔵 定责 (ELIGIBILITY)  │
│  8 条规则              │
│  执行模式: sequential  │
└─────────────────────────┘
```

### 3. CategoryNode
```
┌─────────────────────────┐
│  承保范围              │
│  3 条规则              │
└─────────────────────────┘
```

### 4. RuleNode
```
┌─────────────────────────┐
│  ✅ 规则名称           │
│  5 个条件 → REJECT     │
│  [双击查看详情]        │
└─────────────────────────┘
```

### 5. 现有节点（用于详情视图）
- LogicGateNode: AND/OR/NOT
- ConditionNode: 字段比较
- ActionNode: 执行动作

## 边的样式
- 实线（主流程）: Ruleset → Domain → Category → Rule
- 虚线（覆盖链）: Rule A --覆盖--> Rule B

## 技术实现

### 数据结构
```typescript
// 概览模式节点数据
interface RulesetNodeData {
  label: string;
  description?: string;
  count?: number;
  domain?: string;
  category?: string;
  ruleId?: string;
  status?: string;
  details?: Record<string, unknown>;
}

// 视图模式切换
const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
const [selectedRule, setSelectedRule] = useState<RulesetRule | null>(null);
```

### 布局算法
- 使用分层布局（Sugiyama 风格）
- 每层水平排列，层间垂直排列
- 自动计算节点位置避免重叠

## 验收标准
- [ ] 打开规则集详情页，可视化标签直接显示完整结构
- [ ] 能看到 定责→定损→后处理 的执行流程
- [ ] 每个域下显示类别和规则数量
- [ ] 双击规则可以展开查看其条件树
- [ ] 覆盖链用虚线正确显示
- [ ] 点击任意节点，侧边栏显示对应详情
- [ ] 支持缩放、平移、适应视图
- [ ] 大数据集（100+规则）流畅渲染

## 风险
- 大数据集性能：可能需要虚拟化或分页
- 布局复杂度：深层嵌套可能导致布局混乱
- 回退方案：如性能不佳，可默认只显示一层，点击展开下一层
