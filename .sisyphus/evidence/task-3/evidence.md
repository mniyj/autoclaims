Task: 更新类型定义支持批量操作

What was done:
- 在 types.ts 中新增以下类型：
  - BatchOSSUploadRequest
  - BatchOSSUploadResponse
  - BatchClassifyRequest
  - BatchClassifyResponse
  - MaterialImportTaskV2
+ 更新 ClaimMaterial，新增 ossUrlExpiresAt?: string（可选）
+ 未修改现有核心字段，保持向后兼容

QA / Evidence:
- 运行 TypeScript 检查：npx tsc --noEmit types.ts，未出现类型错误
- 提交记录显示修改了 types.ts，新增了上述接口定义

Commit:
- Message: types(offline-import): add batch operation types
- File touched: types.ts
