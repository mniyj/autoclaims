# 北京医保诊疗项目数据导入

## TL;DR
将 `北京医保诊疗项目_标准化.csv` 中的1475条诊疗项目数据转换为JSON格式，并导入到 `medical-insurance-catalog.json` 中。

**关键决策**:
- 只导入 `is_valid=是` 的数据（约1400+条）
- 医保类别映射: 甲→A(100%)、乙→B(70%)、丙→C(0%)、无效→excluded(0%)
- 生成唯一ID，避免与现有46条记录冲突
- 诊疗项目的 `unit` 字段映射到 `specifications`

**预计工作量**: 单一转换脚本任务

---

## Context

### 源文件
- **文件**: `jsonlist/北京医保诊疗项目_标准化.csv`
- **行数**: 1475行（含表头）
- **编码**: UTF-8 with BOM
- **字段**: item_code, item_name, unit, price, price_raw, description, insurance_category, is_valid, source, import_time

### 目标文件
- **文件**: `jsonlist/medical-insurance-catalog.json`
- **当前记录**: 46条（药品/诊疗/材料混合）
- **格式**: JSON数组

### 字段映射表

| CSV字段 | JSON字段 | 转换规则 |
|---------|----------|----------|
| item_code | code | 原样保留 |
| item_name | name | 原样保留 |
| unit | specifications | 作为规格/单位 |
| insurance_category | type | 甲→A, 乙→B, 丙→C, 无效→excluded |
| description | restrictions | 作为限制说明 |
| is_valid | - | 过滤条件，只保留"是" |
| import_time | effectiveDate | 提取日期部分 |
| - | province | 固定值 "beijing" |
| - | category | 固定值 "treatment" |
| - | id | 生成唯一ID: `catalog-{timestamp}-{random}` |
| - | reimbursementRatio | A类100, B类70, C类0, excluded类0 |

---

## Work Objectives

### Core Objective
将北京医保诊疗项目CSV数据转换为标准JSON格式并合并到医保目录文件中。

### Concrete Deliverables
1. 转换脚本 `scripts/convert-csv-to-json.ts`
2. 更新后的 `jsonlist/medical-insurance-catalog.json`（包含新增记录）
3. 转换报告（成功/失败统计）

### Definition of Done
- [ ] CSV中所有有效记录（is_valid=是）都已导入
- [ ] JSON格式正确，可通过 `bun` 解析
- [ ] 无重复code（与现有记录对比）
- [ ] 文件大小合理（不会导致内存问题）

### Must Have
- 正确处理CSV BOM头
- 正确处理引号内的逗号
- 唯一ID生成策略
- 数据去重（基于code字段）

### Must NOT Have
- 导入无效记录（is_valid=否）
- 破坏现有46条记录
- 产生无效的JSON格式

---

## Verification Strategy

### QA Policy
每项任务包含自动化验证：
- 脚本执行后验证JSON可解析
- 统计导入记录数
- 抽样检查字段映射正确性

---

## Execution Strategy

单一任务，无需分波执行。

---

## TODOs

- [ ] 1. 创建CSV到JSON转换脚本

  **What to do**:
  - 在 `scripts/` 目录创建 `convert-beijing-medical-catalog.ts`
  - 读取CSV文件，处理BOM头
  - 逐行解析，处理引号内的逗号
  - 按映射规则转换每条记录
  - 生成唯一ID（catalog-{timestamp}-{random}）
  - 读取现有JSON文件，合并数据（去重：基于code）
  - 写入更新后的JSON文件
  - 输出转换统计报告

  **Must NOT do**:
  - 不要修改现有46条记录的任何字段
  - 不要导入is_valid=否的记录
  - 不要改变JSON文件的数组结构

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单一数据转换脚本，逻辑清晰
  - **Skills**: []
    - 不需要特殊技能，使用Bun内置API即可

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `jsonlist/北京医保诊疗项目_标准化.csv` - 源CSV文件
  - `jsonlist/medical-insurance-catalog.json` - 目标JSON文件
  - CSV字段: item_code, item_name, unit, description, insurance_category, is_valid, import_time
  - JSON字段: id, province, category, code, name, specifications, type, reimbursementRatio, restrictions, effectiveDate

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: 转换脚本执行成功
    Tool: Bash
    Preconditions: CSV文件存在且可读
    Steps:
      1. bun run scripts/convert-beijing-medical-catalog.ts
      2. 检查退出码为0
    Expected Result: 脚本执行成功，无报错
    Evidence: .sisyphus/evidence/task-1-convert-script.log

  Scenario: JSON文件格式正确
    Tool: Bash
    Preconditions: 转换脚本已执行
    Steps:
      1. bun -e "JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json'))"
      2. 检查退出码为0
    Expected Result: JSON可正常解析
    Evidence: .sisyphus/evidence/task-1-json-valid.log

  Scenario: 记录数验证
    Tool: Bash
    Preconditions: 转换脚本已执行
    Steps:
      1. bun -e "const data = JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json')); console.log(data.length);"
      2. 验证记录数 > 46（原始记录数）
    Expected Result: 记录数增加，约1400+条新记录
    Evidence: .sisyphus/evidence/task-1-record-count.log

  Scenario: 抽样字段验证
    Tool: Bash
    Preconditions: 转换脚本已执行
    Steps:
      1. bun -e "const data = JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json')); const record = data.find(r => r.code === 'w0107010001'); console.log(JSON.stringify(record, null, 2));"
      2. 验证record.name === '健康档案建档费'
      3. 验证record.type === 'C'（丙类）
      4. 验证record.province === 'beijing'
      5. 验证record.category === 'treatment'
    Expected Result: 字段映射正确
    Evidence: .sisyphus/evidence/task-1-sample-record.json
  ```

  **Evidence to Capture**:
  - [ ] 转换脚本的console输出日志
  - [ ] JSON验证结果
  - [ ] 记录数统计
  - [ ] 抽样记录详情

  **Commit**: NO
  - 任务完成后统一提交

---

## Final Verification Wave

- [ ] F1. **数据完整性检查**
  
  验证所有有效记录都已导入：
  ```bash
  # 统计CSV中is_valid=是的记录数
  grep ',是,' jsonlist/北京医保诊疗项目_标准化.csv | wc -l
  
  # 统计JSON中新增的beijing treatment记录数
  bun -e "const data = JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json')); console.log(data.filter(r => r.province === 'beijing' && r.category === 'treatment' && r.code.startsWith('w')).length);"
  ```
  
  两个数字应该相等。

- [ ] F2. **JSON格式验证**
  
  ```bash
  bun -e "JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json')); console.log('✓ JSON格式正确');"
  ```

- [ ] F3. **抽样验证**
  
  随机抽取5条记录，验证字段映射正确。

---

## Success Criteria

### Verification Commands
```bash
# 1. JSON格式验证
bun -e "JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json'));"

# 2. 记录数验证（应远大于46）
bun -e "const data = JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json')); console.log('总记录数:', data.length);"

# 3. 抽样检查
bun -e "const data = JSON.parse(require('fs').readFileSync('jsonlist/medical-insurance-catalog.json')); const r = data.find(x => x.code === 'w0107010001'); console.log(r ? '✓ 找到记录: ' + r.name : '✗ 未找到');"
```

### Final Checklist
- [ ] CSV中所有is_valid=是的记录都已导入
- [ ] JSON文件格式正确，可解析
- [ ] 现有46条记录未被破坏
- [ ] 抽样验证字段映射正确
- [ ] 无重复code

---

## Notes

### 报销比例映射规则
- 甲类 (A): 100% 报销
- 乙类 (B): 70% 报销（北京医保通常先自付10-30%，此处用70作为近似值）
- 丙类 (C): 0% 报销（全额自付）
- 无效/ excluded: 0% 报销

### ID生成策略
使用 `catalog-{timestamp}-{random}` 格式，例如：`catalog-1741094400000-abc123`
- timestamp: 当前时间毫秒数
- random: 6位随机字符

### 去重策略
基于 `code` 字段去重。如果CSV中的code已存在于JSON中，跳过该记录。
