# Draft: 赔案管理新增报案功能

## 需求理解

用户希望在赔案管理页面（ClaimCaseListPage）增加一个"新增报案"按钮，功能逻辑与"索赔人报案"相同：
1. 选择保单（Policy）
2. 根据保单对应的产品配置展示报案需要收集的信息字段
3. 填完后记录索赔材料所需的清单

## 关键发现

### 现有功能
1. **ClaimCaseListPage** (赔案管理页面) - `components/ClaimCaseListPage.tsx`
   - 当前只显示赔案列表，没有新增按钮
   - 通过 `onViewDetail` 查看赔案详情

2. **ClaimIntakeConfigPage** (报案信息配置) - `components/ClaimIntakeConfigPage.tsx`
   - 配置产品的报案字段 (`intakeConfig.fields`)
   - 配置理赔材料清单 (`intakeConfig.claimMaterials`)
   - 支持动态材料清单计算

3. **PolicyListPage** (保单列表) - `components/PolicyListPage.tsx`
   - 保单有 "发起理赔" 按钮
   - App.tsx 中的 `handleInitiateClaim` 方法实现了该逻辑

4. **App.tsx 中的现有实现** (`handleInitiateClaim` 方法，约第771-807行)
   - 根据保单找到关联产品
   - 检查产品是否有 `intakeConfig` 配置
   - 目前只是弹出 alert 展示配置信息

### 数据结构

**ClaimCase (赔案)**:
```typescript
interface ClaimCase {
  id: string;
  reportNumber: string;  // 报案号
  reporter: string;      // 报案人
  reportTime: string;    // 报案时间
  accidentTime: string;  // 事故时间
  accidentReason: string;// 事故原因
  accidentLocation?: string;
  claimAmount?: number;
  approvedAmount?: number;
  status: ClaimStatus;
  productCode?: string;  // 关联产品
  productName?: string;
  policyNumber?: string; // 关联保单
  policyholder?: string; // 投保人
  insured?: string;      // 被保险人
  // ...
}
```

**IntakeConfig (报案配置)**:
```typescript
interface IntakeConfig {
  fields: IntakeField[];        // 报案字段
  voice_input: VoiceInputConfig;
  claimMaterials: {
    extraMaterialIds: string[]; // 额外材料
    materialOverrides: Record<string, { selected: boolean; required: boolean }>;
    enableDynamicCalculation?: boolean;
    claimItemFieldId?: string;
    accidentCauseFieldId?: string;
  };
  accidentCauses: AccidentCause[];
}
```

**IntakeField (报案字段)**:
```typescript
interface IntakeField {
  field_id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'number' | 'id_card' | 'phone' | 'email' | 'address';
  required: boolean;
  placeholder?: string;
  options?: string[];  // for select
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}
```

## 技术方案

### 方案一：内嵌表单组件 (推荐)
在 ClaimCaseListPage 中直接实现完整的报案流程：
1. 点击"新增报案"按钮
2. 弹出选择保单的对话框
3. 选择保单后，进入报案表单页面
4. 根据产品配置动态渲染表单字段
5. 提交创建赔案

### 方案二：跳转至独立页面
创建一个新的 AddClaimCasePage 组件：
1. 从 ClaimCaseListPage 跳转到 AddClaimCasePage
2. 在独立页面完成保单选择和表单填写
3. 完成后返回列表

**推荐方案一**，因为：
- 流程简单，不需要额外路由
- 可以使用 Modal 组件保持上下文
- 与现有编辑模式保持一致

## 实现步骤

### 任务1: 添加"新增报案"按钮
- 在 ClaimCaseListPage 头部按钮区域添加"新增报案"按钮
- 点击打开保单选择对话框

### 任务2: 创建保单选择对话框
- 使用 Modal 组件
- 调用 `api.policies.list()` 获取保单列表
- 显示保单号、投保人、产品名称、有效期等信息
- 支持搜索/筛选

### 任务3: 创建报案表单组件
- 根据保单找到关联产品
- 获取产品的 `intakeConfig`
- 根据 `intakeConfig.fields` 动态渲染表单字段
- 支持各种字段类型：text, textarea, date, select, number, id_card, phone 等
- 实现字段验证

### 任务4: 材料清单展示
- 根据 `intakeConfig.claimMaterials` 展示材料清单
- 支持动态计算（如果启用）
- 标记必填/可选材料

### 任务5: 提交创建赔案
- 收集表单数据
- 生成报案号（格式：CLA-YYYYMMDD-XXXX）
- 调用 `api.claimCases.add()` 创建赔案
- 关联保单信息
- 刷新列表并跳转到新创建的赔案详情

## 相关文件

| 文件 | 用途 |
|------|------|
| `components/ClaimCaseListPage.tsx` | 赔案列表页面，需要添加按钮 |
| `components/PolicyListPage.tsx` | 参考保单选择UI |
| `components/ClaimIntakeConfigPage.tsx` | 参考 intakeConfig 使用方式 |
| `components/product-form/IntakeFieldConfigEditor.tsx` | 字段编辑器，可参考字段类型定义 |
| `App.tsx` | `handleInitiateClaim` 方法参考 |
| `types.ts` | 类型定义 |
| `services/api.ts` | API 调用 |

## 关键代码参考

### App.tsx 中的 handleInitiateClaim (第771-807行)
```typescript
const handleInitiateClaim = (policy: InsurancePolicy) => {
  const product = products.find((p) => p.productCode === policy.productCode);
  
  if (!product) {
    alert(`未找到保单关联的产品`);
    return;
  }

  const intakeConfig = product.intakeConfig;
  const hasConfig = !!intakeConfig && (intakeConfig.fields.length > 0 || intakeConfig.voice_input?.enabled);

  if (!hasConfig) {
    alert(`产品尚未配置报案信息`);
    return;
  }
  
  // 展示配置信息...
};
```

### ClaimIntakeConfigPage 中的字段配置
展示了如何根据配置渲染字段和材料清单。

## 问题澄清

1. **报案号生成规则**？
   - 建议：CLA-YYYYMMDD-XXXX (如 CLA-20260302-0001)

2. **报案人信息来源**？
   - 从保单获取投保人/被保险人作为默认值
   - 允许用户修改

3. **是否需要AI语音报案**？
   - 当前 scope：先实现表单方式
   - 语音报案可作为后续增强

4. **材料清单的动态计算**？
   - 如果产品配置了 `enableDynamicCalculation`
   - 需要根据用户选择的"索赔项目"和"事故原因"动态更新材料清单

5. **创建后是否直接进入详情页**？
   - 建议：创建成功后进入 ClaimCaseDetailPage
   - 便于用户继续上传材料

## 边界条件

- 保单必须关联产品
- 产品必须有 intakeConfig 配置
- 字段验证失败不能提交
- 生成唯一报案号

## 待办事项

- [ ] 确认报案号生成规则
- [ ] 确认材料清单交互方式
- [ ] 确认创建后跳转行为
