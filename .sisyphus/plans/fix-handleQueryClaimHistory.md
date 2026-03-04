# handleQueryClaimHistory 修复计划

## 问题描述

`handleQueryClaimHistory` 函数没有正确处理多赔案场景。当前代码：
- ✅ 处理无赔案场景
- ❌ **缺少多赔案选择 UI** - 直接返回所有历史记录

## 修复内容

### 修改文件
`smartclaim-ai-agent/intentTools.ts`，第 1345-1380 行

### 修复代码

```typescript
/**
 * 查询历史案件
 *
 * 支持三种场景：
 * 1. 无赔案：返回提示信息
 * 2. 单个赔案：显示该案件历史详情
 * 3. 多个赔案：展示案件选择 UI
 */
function handleQueryClaimHistory(
  entities: IntentEntities,
  claimState: ClaimState
): ToolResponse {
  const claims = claimState.historicalClaims || [];

  // 场景1: 无赔案
  if (claims.length === 0) {
    return {
      success: true,
      data: { claims: [], totalCount: 0, totalAmount: 0 },
      message: "您暂无历史理赔记录。",
      uiComponent: undefined
    };
  }

  // 如果用户指定了案件号，查找对应案件
  if (entities.claimId) {
    const targetClaim = claims.find(c =>
      c.id === entities.claimId ||
      c.id.includes(entities.claimId!)
    );
    if (!targetClaim) {
      return {
        success: false,
        data: null,
        message: `未找到案件号为 "${entities.claimId}" 的案件，请检查案件号是否正确。`,
        uiComponent: undefined
      };
    }
    return queryClaimHistoryForClaim(targetClaim, claims);
  }

  // 场景3: 多个赔案且未指定案件号 - 展示案件选择 UI
  if (claims.length > 1) {
    return createClaimSelectionResponse(
      claims,
      IntentType.QUERY_CLAIM_HISTORY,
      "您有"
    );
  }

  // 场景2: 单个赔案 - 显示该案件历史
  const targetClaim = claims[0];
  return queryClaimHistoryForClaim(targetClaim, claims);
}

/**
 * 查询指定案件的历史详情
 *
 * @param targetClaim 目标案件
 * @param allClaims 所有案件列表（用于计算统计）
 * @returns ToolResponse
 */
function queryClaimHistoryForClaim(
  targetClaim: HistoricalClaim,
  allClaims: HistoricalClaim[]
): ToolResponse {
  const info: ClaimHistoryInfo = {
    claims: allClaims.map(c => ({
      id: c.id,
      date: c.date,
      type: c.type,
      status: c.status,
      amount: c.amount,
      statusLabel: getStatusLabel(c.status)
    })),
    totalCount: allClaims.length,
    totalAmount: allClaims.reduce((s, c) => s + (c.amount || 0), 0)
  };

  return {
    success: true,
    data: info,
    message: `案件 **${targetClaim.id}** 的历史记录：

您共有 **${info.totalCount}** 条理赔记录，累计金额 **¥${info.totalAmount.toLocaleString()}**。`,
    uiComponent: UIComponentType.CLAIM_HISTORY,
    uiData: info
  };
}
```

## 关键变更点

1. **添加多赔案处理**：当 `claims.length > 1` 时，调用 `createClaimSelectionResponse` 展示案件选择列表
2. **提取内部函数**：新增 `queryClaimHistoryForClaim` 处理单个案件的历史查询逻辑
3. **支持 claimId 参数**：用户可以通过 `entities.claimId` 指定查询特定案件
4. **统一消息格式**：单赔案时显示 "案件 **XXX** 的历史记录"，多赔案时显示选择列表

## 验收标准

- [ ] TypeScript 编译通过：`npx tsc --noEmit`
- [ ] 无赔案时显示 "您暂无历史理赔记录"
- [ ] 单赔案时直接显示该案件历史
- [ ] 多赔案时展示 `CLAIM_SELECTION` UI 组件
- [ ] 用户选择案件后自动显示该案件历史

## 验证方式

```bash
cd smartclaim-ai-agent
npx tsc --noEmit
npm run dev
```

然后在浏览器中测试：
1. 无赔案用户说 "查历史" → 显示 "暂无历史理赔记录"
2. 单赔案用户说 "查历史" → 直接显示该案件历史
3. 多赔案用户说 "查历史" → 显示案件选择列表 → 选择后显示选中案件历史
