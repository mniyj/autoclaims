# 报案记录未同步问题修复方案

## 问题总结

索赔人端报案后，理赔员后端"赔案清单"中不显示报案记录。

## 根本原因

1. **缺少必填字段 `claimAmount`** - ClaimCase 类型定义 claimAmount 为必填，但报案时未提供
2. **错误处理不当** - API 错误仅记录到控制台，用户无感知
3. **未检查响应状态** - fetch 未检查 response.ok

## 修复步骤

### 修复 1：报案时添加 claimAmount 字段

**文件**: `smartclaim-ai-agent/App.tsx`

在报案表单中添加索赔金额字段，或在提交时设置默认值：

```typescript
// 在提交报案数据前，添加 claimAmount
const claimAmount = calculateClaimAmount(dynamicFormValues); // 从表单计算或设置默认值

await fetch('/api/claim-cases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: newClaimId,
    reportNumber,
    reporter: userName,
    // ... 其他字段
    claimAmount: claimAmount || 0,  // ✅ 添加此字段
    status: '已报案',
    operator: userName,
    // ...
  })
});
```

### 修复 2：改进错误处理

```typescript
// Create backend claim case record
try {
  const response = await fetch('/api/claim-cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // ... 报案数据
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('Failed to create claim case:', errorData);
    // 向用户显示错误信息
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: `报案创建成功，但同步到后端时出错：${errorData.error || '未知错误'}。请联系管理员。`,
      timestamp: Date.now()
    }]);
  } else {
    console.log('Claim case created successfully');
  }
} catch (err) {
  console.error('Failed to create backend claim case:', err);
  setMessages(prev => [...prev, {
    id: Date.now().toString(),
    role: 'assistant',
    content: `报案创建成功，但网络同步失败。请稍后刷新页面查看最新状态。`,
    timestamp: Date.now()
  }]);
}
```

### 修复 3：将 claimAmount 设为可选字段

**文件**: `types.ts`

如果索赔金额在报案时确实无法确定，可以将其设为可选：

```typescript
export interface ClaimCase {
  // ...
  claimAmount?: number;  // 改为可选
  // ...
}
```

### 修复 4：后端数据校验

**文件**: `server/apiHandler.js`

在创建 claim-case 时添加数据校验：

```javascript
} else if (req.method === "POST") {
  const newItem = await parseBody(req);
  
  // 校验必填字段
  if (!newItem.id || !newItem.reportNumber || !newItem.reporter) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Missing required fields: id, reportNumber, reporter" }));
    return;
  }
  
  const data = readData(resource);
  data.push(newItem);
  writeData(resource, data);
  res.statusCode = 201;
  res.end(JSON.stringify({ success: true, data: newItem }));
}
```

## 推荐方案

**短期修复**（立即生效）：
1. 在报案时设置 `claimAmount: 0` 作为默认值
2. 添加响应状态检查
3. 改进错误提示

**长期优化**：
1. 在报案表单中添加索赔金额输入字段
2. 后端添加完整的数据校验
3. 建立报案记录同步状态监控

## 验证步骤

修复后，按以下步骤验证：
1. 索赔人端提交报案
2. 检查浏览器 Network 中 `/api/claim-cases` 请求是否返回 201
3. 检查 `jsonlist/claim-cases.json` 是否包含新记录
4. 理赔员端刷新"赔案清单"，确认记录显示
