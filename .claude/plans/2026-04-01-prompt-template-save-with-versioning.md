# 提示词模板版本控制 + 独立保存按钮 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在提示词模板编辑器中添加独立保存按钮和内联版本历史面板，让用户可以为单个模板保存新版本（含变更原因），并在编辑界面直接查看/回滚历史版本。

**Architecture:** 在现有全局保存流程之外，新增 per-template 保存通道：点击"保存此版本"弹出内联确认框（填写变更原因）→ 调用 `updateConfig` 更新内容 + `publishPrompt` 写版本记录 → 刷新内联历史列表。全局"保存 AI 配置"按钮保持不变（仍负责能力绑定和批量模板保存）。

**Tech Stack:** React 19 + TypeScript，Tailwind CSS，无新依赖

---

## 文件总览

| 文件 | 变更性质 |
|------|---------|
| `components/AIConfigCenterPage.tsx` | 主要修改：新增 state、handleSaveTemplate、UI 组件 |

---

### Task 1: 新增 dirty 跟踪 + per-template 保存相关 state

**文件：** `components/AIConfigCenterPage.tsx`

**当前行参考：** `handleTemplateChange` 函数约在第 543 行；state 声明约在第 351-360 行

**Step 1: 在现有 state 下方添加 3 个新 state**

紧跟 `insertFnsRef` 声明之后（约第 367 行）插入：

```tsx
// 已编辑但未保存的模板 ID 集合
const [dirtyTemplateIds, setDirtyTemplateIds] = useState<Set<string>>(
  new Set(),
);
// 当前打开保存确认框的模板 ID（空字符串表示关闭）
const [savingTemplateId, setSavingTemplateId] = useState<string>("");
// 单模板保存时填写的变更原因
const [templateSaveReason, setTemplateSaveReason] = useState<string>("");
// 展开版本历史面板的模板 ID（空字符串表示全部收起）
const [historyExpandedId, setHistoryExpandedId] = useState<string>("");
```

**Step 2: 修改 `handleTemplateChange`，将 templateId 加入 dirty 集合**

当前代码（约第 543 行）：
```tsx
const handleTemplateChange = (templateId: string, content: string) => {
  setPromptTemplates((current) =>
    current.map((template) =>
      template.id === templateId ? { ...template, content } : template,
    ),
  );
};
```

替换为：
```tsx
const handleTemplateChange = (templateId: string, content: string) => {
  setPromptTemplates((current) =>
    current.map((template) =>
      template.id === templateId ? { ...template, content } : template,
    ),
  );
  setDirtyTemplateIds((prev) => new Set([...prev, templateId]));
};
```

---

### Task 2: 新增 `handleSaveTemplate` 函数

**文件：** `components/AIConfigCenterPage.tsx`

**Step 1: 在 `handleTemplateChange` 之后（约第 550 行）插入新函数**

```tsx
const handleSaveTemplate = async (templateId: string, reason: string) => {
  const template = promptTemplates.find((t) => t.id === templateId);
  if (!template) return;
  setSaving(true);
  setError("");
  try {
    // 1. 持久化内容变更
    const payload = {
      capabilities,
      promptTemplates,
      providers,
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: currentUsername || "admin",
        changeReason: reason.trim() || "manual update",
      },
    };
    await api.ai.updateConfig(payload);

    // 2. 发布版本记录
    await api.ai.publishPrompt({
      templateId: template.id,
      content: template.content,
      variables: template.requiredVariables || [],
      applicableCapabilities: capabilities
        .filter(
          (c) =>
            c.promptTemplateId === template.id ||
            c.secondaryPromptTemplateId === template.id,
        )
        .map((c) => c.id),
      publishedBy: currentUsername || "admin",
      reason: reason.trim() || "manual update",
    });

    // 3. 刷新版本历史
    const nextHistory = await api.ai.getPromptHistory();
    setPromptHistory((nextHistory || []) as AIPromptTemplateVersion[]);

    // 4. 清除 dirty 标记
    setDirtyTemplateIds((prev) => {
      const next = new Set(prev);
      next.delete(templateId);
      return next;
    });

    setSuccessMessage(`"${template.name}" 已保存新版本`);
    setTimeout(() => setSuccessMessage(""), 3000);
  } catch (saveError) {
    setError(
      saveError instanceof Error ? saveError.message : "保存失败，请重试",
    );
  } finally {
    setSaving(false);
    setSavingTemplateId("");
    setTemplateSaveReason("");
  }
};
```

---

### Task 3: 在模板底部状态栏加入"保存此版本"按钮 + 确认框

**文件：** `components/AIConfigCenterPage.tsx`

**目标位置：** templates tab 的底部状态栏区域，约在渲染预览按钮之后（`{/* 底部状态栏 */}` 注释下方）

**Step 1: 找到底部状态栏的"预览按钮"部分，在其后添加"保存此版本"按钮**

找到以下代码（底部状态栏 flex 容器，约第 1556-1605 行）：

```tsx
{/* 底部状态栏 */}
<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
  {/* 变量覆盖率 */}
  ...
  {/* 预览按钮 */}
  {currentTemplate.templateEngine === "jinja2" &&
    templateVars.length > 0 && (
      <button
        type="button"
        onClick={() => setPreviewTemplateId(currentTemplate.id)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-sky-600"
      >
        预览渲染效果
      </button>
    )}
</div>
```

**Step 2: 将底部状态栏替换为含保存按钮和内联确认框的版本**

```tsx
{/* 底部状态栏 */}
<div className="mt-3 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
    {/* 变量覆盖率 */}
    {currentTemplate.templateEngine === "jinja2" &&
    templateVars.length > 0 ? (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">变量覆盖率：</span>
        <span
          className={
            unknownVars.length > 0
              ? "font-medium text-red-600"
              : allRequiredUsed
                ? "font-medium text-emerald-600"
                : "font-medium text-amber-600"
          }
        >
          {coveredCount}/{usedVarNames.length} 已定义
        </span>
        {unknownVars.length > 0 && (
          <span className="text-red-500">
            ({unknownVars.length} 个未声明)
          </span>
        )}
      </div>
    ) : (
      <div />
    )}

    <div className="flex items-center gap-2">
      {/* 预览按钮 */}
      {currentTemplate.templateEngine === "jinja2" &&
        templateVars.length > 0 && (
          <button
            type="button"
            onClick={() => setPreviewTemplateId(currentTemplate.id)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-sky-600"
          >
            预览渲染效果
          </button>
        )}
      {/* 保存此版本按钮 */}
      <button
        type="button"
        onClick={() => {
          setSavingTemplateId(currentTemplate.id);
          setTemplateSaveReason("");
        }}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium shadow-sm transition ${
          dirtyTemplateIds.has(currentTemplate.id)
            ? "border border-sky-300 bg-sky-600 text-white hover:bg-sky-700"
            : "border border-slate-200 bg-white text-slate-400 hover:text-slate-600"
        }`}
      >
        {dirtyTemplateIds.has(currentTemplate.id) && (
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
        )}
        保存此版本
      </button>
    </div>
  </div>

  {/* 保存确认内联框 */}
  {savingTemplateId === currentTemplate.id && (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div className="mb-2 text-sm font-medium text-sky-900">
        保存「{currentTemplate.name}」新版本
      </div>
      <textarea
        value={templateSaveReason}
        onChange={(e) => setTemplateSaveReason(e.target.value)}
        placeholder="填写本次修改的原因（可选，便于追溯）"
        rows={2}
        className="w-full resize-none rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setSavingTemplateId("");
            setTemplateSaveReason("");
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void handleSaveTemplate(currentTemplate.id, templateSaveReason)
          }
          className="rounded-xl bg-sky-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? "保存中..." : "确认保存"}
        </button>
      </div>
    </div>
  )}
</div>
```

---

### Task 4: 在模板编辑器底部添加内联版本历史面板

**文件：** `components/AIConfigCenterPage.tsx`

**位置：** 紧接在 Task 3 的底部状态栏 `</div>` 之后（即 section 结束之前）

**Step 1: 获取当前模板的版本历史列表**

在 templates tab 顶部的变量计算区（约 `const templateVars` 行附近），添加：
```tsx
const templateHistory = (promptHistoryMap.get(currentTemplateId) || [])
  .slice()
  .sort((a, b) => b.version - a.version)
  .slice(0, 10); // 最多显示 10 个版本
```

**Step 2: 插入内联历史面板（在 Task 3 底部状态栏之后）**

```tsx
{/* 内联版本历史 */}
{templateHistory.length > 0 && (
  <div className="mt-4 border-t border-slate-200 pt-4">
    <button
      type="button"
      onClick={() =>
        setHistoryExpandedId(
          historyExpandedId === currentTemplate.id
            ? ""
            : currentTemplate.id,
        )
      }
      className="flex w-full items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-700"
    >
      <span>版本历史（{templateHistory.length} 个版本）</span>
      <span className="text-slate-400">
        {historyExpandedId === currentTemplate.id ? "▲ 收起" : "▼ 展开"}
      </span>
    </button>

    {historyExpandedId === currentTemplate.id && (
      <div className="mt-3 space-y-2">
        {templateHistory.map((entry, idx) => (
          <div
            key={entry.id}
            className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
              idx === 0
                ? "border border-emerald-200 bg-emerald-50"
                : "border border-slate-100 bg-slate-50"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs font-semibold ${
                    idx === 0 ? "text-emerald-700" : "text-slate-600"
                  }`}
                >
                  v{entry.version}
                </span>
                {idx === 0 && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    当前版本
                  </span>
                )}
                <span className="text-[10px] text-slate-400">
                  {new Date(entry.publishedAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-[10px] text-slate-400">
                  {entry.publishedBy}
                </span>
              </div>
              {entry.reason && entry.reason !== "manual update" && (
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {entry.reason}
                </div>
              )}
            </div>
            {idx > 0 && (
              <button
                type="button"
                onClick={() => void handleRollbackPrompt(entry)}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-100"
              >
                回滚
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

---

### Task 5: 处理回滚后的 dirty 标记

**文件：** `components/AIConfigCenterPage.tsx`

**背景：** `handleRollbackPrompt` 约在第 782 行，执行回滚后内容被恢复到历史版本。回滚本身已经调用了 `publishPrompt`，所以回滚后该模板不应被标记为 dirty。

**Step 1: 找到 `handleRollbackPrompt` 函数结尾，在其中清除 dirty 标记**

在 `handleRollbackPrompt` 成功执行后的 `setPromptHistory` 调用之后，添加：
```tsx
// 回滚已自动发布新版本，清除 dirty 标记
setDirtyTemplateIds((prev) => {
  const next = new Set(prev);
  next.delete(entry.templateId);
  return next;
});
```

---

## 验证方法

1. 打开 AI 配置中心 → 模板中心
2. 选中任意 Jinja2 模板，修改内容
3. 确认底部"保存此版本"按钮变为蓝色，左侧导航该模板出现橙色小圆点
4. 点击"保存此版本"，出现内联确认框，填写原因后点击"确认保存"
5. 保存成功后按钮恢复灰色，顶部出现绿色成功提示
6. 点击"▼ 展开"版本历史，确认新版本出现在列表顶部标注"当前版本"
7. 点击历史版本的"回滚"，确认编辑器内容恢复，版本历史更新
8. 切换到"模板历史"Tab，确认版本记录同步出现
