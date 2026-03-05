# Bug修复计划：材料审核页文件和解析结果同步问题

## TL;DR

> **问题**：用户在"索赔文件"上传并解析的文件，在"材料审核"页面无法显示，解析结果也无法显示。
> 
> **根本原因**：`handleParseFile` 函数只保存解析结果到 `claim-cases.fileParseResults`，**没有同步到 `claim-materials`**。
> 
> **修复方案**：在 `handleParseFile` 中添加同步逻辑，将文件和解析结果同时写入 `claim-materials`。
> 
> **预估工期**：15-20 分钟

---

## Context

### 问题描述

| 症状 | 表现 |
|-----|------|
| 文件不显示 | "微信图片_2025-07-02_173630_395.jpg" 在"索赔文件"可见，在"材料审核"不可见 |
| 解析结果不显示 | "索赔文件"显示已解析，"材料审核"显示"暂无AI提取结果" |

### 根本原因分析

**数据流问题：**

```
用户上传文件 → localFileCategories (前端状态)
        ↓
用户点击解析 → handleParseFile
        ↓
        ├── 调用 /api/parse-document (AI解析)
        ├── 保存到 claim-cases.fileParseResults
        └── ❌ 没有同步到 claim-materials!

材料审核 Tab 加载 → GET /api/claim-materials
        ↓
        └── 查询不到新文件（因为从未写入）
```

**关键代码问题：**

`server/apiHandler.js` 中的 `syncFileCategoriesToMaterials` 只在以下情况触发：
- `PUT /api/claim-cases/:id` 且 `payload.fileCategories` 存在

但 `handleParseFile` 只更新 `fileParseResults`，不更新 `fileCategories`，所以同步逻辑从未被触发。

---

## Work Objectives

### Core Objective
修复文件和解析结果从"索赔文件"到"材料审核"的同步问题。

### Concrete Deliverables
1. 修改 `handleParseFile`，添加 `claim-materials` 同步逻辑
2. 修改 `types.ts`，确保 `ProcessedFile` 有 `ossKey` 字段（如缺失）
3. 修改 `loadReviewData`，正确显示解析结果

### Definition of Done
- [ ] 在"索赔文件"解析的文件立即出现在"材料审核"页
- [ ] 解析结果在"材料审核"页正确显示
- [ ] 不影响现有功能

---

## Verification Strategy

### QA Method
手动测试：上传文件 → 解析 → 检查材料审核页

---

## TODOs

- [ ] **Task 1: 添加 inferFileType 辅助函数到 ClaimCaseDetailPage**

  **What to do**:
  在 `ClaimCaseDetailPage.tsx` 中添加 `inferFileType` 函数（如不存在）：
  
  ```typescript
  const inferFileType = (fileName: string): string => {
    if (!fileName) return 'application/octet-stream';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
    };
    return typeMap[ext] || 'application/octet-stream';
  };
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Commit**: YES
  - Message: `feat: add inferFileType helper to ClaimCaseDetailPage`

---

- [ ] **Task 2: 修改 handleParseFile 添加 claim-materials 同步**

  **What to do**:
  在 `handleParseFile` 函数的"保存解析结果到后端"部分，添加同步到 `claim-materials` 的逻辑：
  
  在以下代码之后：
  ```typescript
  await api.claimCases.update(claim.id, {
    fileParseResults: { ... }
  });
  console.log("[Parse] Result saved to backend:", fileKey);
  ```
  
  添加：
  ```typescript
  // 同步到 claim-materials（确保材料审核页能看到）
  try {
    // 先检查是否已存在
    const materialsResp = await fetch(`/api/claim-materials?claimCaseId=${claim.id}`);
    if (materialsResp.ok) {
      const materialsData = await materialsResp.json();
      const existingMaterial = materialsData.materials?.find(
        (m: ClaimMaterial) => m.fileName === file.name && m.source === 'direct_upload'
      );
      
      if (existingMaterial) {
        // 更新现有记录（添加解析结果）
        await fetch(`/api/claim-materials/${existingMaterial.id}/parse`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractedData: result.extractedData,
            auditConclusion: result.auditConclusion,
            confidence: result.confidence,
            materialId: materialConfig.id,
            materialName: materialConfig.name,
            status: 'completed',
            processedAt: new Date().toISOString(),
          }),
        });
        console.log("[Parse] Updated existing material:", existingMaterial.id);
      } else {
        // 创建新记录
        await fetch('/api/claim-materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claimCaseId: claim.id,
            fileName: file.name,
            fileType: inferFileType(file.name),
            url: file.url || '#',
            ossKey: file.ossKey,
            category: categoryName,
            materialId: materialConfig.id,
            materialName: materialConfig.name,
            extractedData: result.extractedData,
            auditConclusion: result.auditConclusion,
            confidence: result.confidence,
            source: 'direct_upload',
            status: 'completed',
            uploadedAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
          }),
        });
        console.log("[Parse] Created new material for:", file.name);
      }
    }
  } catch (syncError) {
    console.error("[Parse] Failed to sync to claim-materials:", syncError);
    // 同步失败不影响主流程
  }
  ```

  **References**:
  - `ClaimCaseDetailPage.tsx:733-755` - 现有保存逻辑位置

  **Acceptance Criteria**:
  - [ ] 代码正确插入到现有保存逻辑之后
  - [ ] 使用 try-catch 包裹，不影响主流程
  - [ ] 正确处理已存在和新建两种情况

  **Commit**: YES
  - Message: `fix: sync parsed files to claim-materials`
  - Files: `components/ClaimCaseDetailPage.tsx`

---

- [ ] **Task 3: 修改 loadReviewData 正确显示解析结果**

  **What to do**:
  确保 `loadReviewData` 正确将 `extractedData` 映射到 `structuredData`：
  
  在现有代码中：
  ```typescript
  const allDocs: typeof reviewDocuments = (data.materials || []).map((m: ClaimMaterial) => ({
    // ...
    structuredData: m.extractedData,  // 确保这行存在
    // ...
  }));
  ```

  **Verify**:
  确认 `structuredData: m.extractedData` 这一行已存在。

  **Commit**: NO（如已存在则无需修改）

---

- [ ] **Task 4: 手动测试验证**

  **What to do**:
  1. 启动应用：`npm run dev`
  2. 打开一个案件详情页
  3. 在"案件信息" Tab 上传一个新文件
  4. 点击"解析"按钮
  5. 切换到"材料审核" Tab
  6. 验证：
     - [ ] 文件出现在列表中
     - [ ] 解析结果正确显示

  **Commit**: NO（验证任务）

---

## Commit Strategy

```
feat: add inferFileType helper to ClaimCaseDetailPage

fix: sync parsed files to claim-materials

- Check if material exists in claim-materials
- Update existing or create new record
- Include extractedData, auditConclusion, confidence
```

---

## Success Criteria

### 功能验证
1. 上传新文件到"索赔文件"
2. 点击"解析"
3. 切换到"材料审核"
4. 文件可见 ✓
5. 解析结果可见 ✓

### 代码检查
- [ ] `handleParseFile` 包含同步逻辑
- [ ] 错误处理完善（try-catch）
- [ ] 控制台日志输出正常

---

## Notes

### 关键设计决策
1. **双写策略**：同时写入 `claim-cases` 和 `claim-materials`
2. **幂等性**：根据 `fileName + source` 检查是否已存在
3. **容错性**：同步失败不影响主流程

### 后续优化
- 考虑在文件上传时就同步到 `claim-materials`（而不是解析时）
- 考虑批量同步 API 减少请求次数
