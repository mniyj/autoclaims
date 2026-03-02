/**
 * AnchoredField - 带溯源跳转的字段展示组件
 *
 * 每个字段值旁边显示 🔍 图标，点击后触发 onJumpTo 回调，
 * 由父组件（材料审核页面）将对应锚点传递给 DocumentViewer 执行跳转和高亮。
 *
 * 置信度颜色系统：
 * - confidence > 0.9  → 绿色 ✓ 可直接通过
 * - 0.7 - 0.9        → 蓝色 🔍 建议快速核验
 * - < 0.7            → 黄色 ⚠️ 需人工处理
 * - reviewFlag 存在   → 红色 强制复核
 */

import React from "react";
import { type SourceAnchor, type ReviewFlag } from "../../types";

interface AnchoredFieldProps {
  /** 字段标签 */
  label: string;
  /** 字段值（字符串或数字） */
  value?: string | number | null;
  /** 源锚点（指向原始文件位置） */
  anchor?: SourceAnchor;
  /** 整体提取置信度 0-1 */
  confidence?: number;
  /** 人工复核标记 */
  reviewFlag?: ReviewFlag;
  /** 点击跳转时的回调 */
  onJumpTo?: (anchor: SourceAnchor) => void;
  /** 是否已通过人工审核 */
  approved?: boolean;
  /** 批量通过时触发 */
  onApprove?: () => void;
  /** 值格式化函数 */
  format?: (v: string | number) => string;
  className?: string;
}

function getConfidenceStyle(confidence?: number, reviewFlag?: ReviewFlag, approved?: boolean) {
  if (approved) {
    return {
      dotClass: "bg-green-500",
      textClass: "text-green-700",
      bgClass: "bg-green-50 border-green-200",
      icon: "✓",
    };
  }
  if (reviewFlag) {
    return {
      dotClass: "bg-red-500",
      textClass: "text-red-700",
      bgClass: "bg-red-50 border-red-200",
      icon: "!",
    };
  }
  if (confidence === undefined) {
    return {
      dotClass: "bg-gray-300",
      textClass: "text-gray-600",
      bgClass: "",
      icon: "",
    };
  }
  if (confidence >= 0.9) {
    return {
      dotClass: "bg-green-400",
      textClass: "text-green-700",
      bgClass: "",
      icon: "✓",
    };
  }
  if (confidence >= 0.7) {
    return {
      dotClass: "bg-blue-400",
      textClass: "text-blue-700",
      bgClass: "bg-blue-50 border-blue-200",
      icon: "",
    };
  }
  return {
    dotClass: "bg-yellow-400",
    textClass: "text-yellow-700",
    bgClass: "bg-yellow-50 border-yellow-200",
    icon: "⚠",
  };
}

const AnchoredField: React.FC<AnchoredFieldProps> = ({
  label,
  value,
  anchor,
  confidence,
  reviewFlag,
  onJumpTo,
  approved,
  onApprove,
  format,
  className = "",
}) => {
  const style = getConfidenceStyle(confidence, reviewFlag, approved);
  const hasValue = value !== undefined && value !== null && value !== "";
  const displayValue = hasValue
    ? (format ? format(value!) : String(value))
    : "—";

  const canJump = anchor && onJumpTo;

  return (
    <div
      className={`flex items-start justify-between py-1.5 px-2 rounded border ${
        style.bgClass || "border-transparent"
      } group ${className}`}
    >
      {/* 左侧：标签 + 值 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {/* 置信度指示点 */}
          {confidence !== undefined && (
            <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${style.dotClass}`} />
          )}
          <span className="text-xs text-gray-500 shrink-0">{label}</span>
          {style.icon && (
            <span className={`text-xs font-semibold ${style.textClass}`}>{style.icon}</span>
          )}
        </div>
        <div className={`text-sm font-medium mt-0.5 ${hasValue ? "text-gray-800" : "text-gray-400"} ${style.textClass && !approved ? style.textClass : ""}`}>
          {displayValue}
        </div>
        {/* 复核标记说明 */}
        {reviewFlag && (
          <div className="text-xs text-red-600 mt-0.5">{reviewFlag.description}</div>
        )}
      </div>

      {/* 右侧：跳转按钮 + 通过按钮 */}
      <div className="flex items-center gap-1 ml-2 shrink-0">
        {/* 跳转到源文件 */}
        {canJump && (
          <button
            type="button"
            title={`查看源文件 (${anchor.highlightLevel === "precise" ? "精确位置" : anchor.highlightLevel === "text_search" ? "文本搜索" : "页面定位"})`}
            onClick={() => onJumpTo!(anchor!)}
            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        )}
        {/* 手动通过 */}
        {onApprove && !approved && (
          <button
            type="button"
            title="标记为已审核"
            onClick={onApprove}
            className="p-1 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default AnchoredField;

/**
 * 用于分组展示多个 AnchoredField 的容器
 */
export const AnchoredSection: React.FC<{
  title: string;
  docId?: string;
  confidence?: number;
  children: React.ReactNode;
  onViewSource?: () => void;
  expanded?: boolean;
  onToggle?: () => void;
}> = ({ title, docId, confidence, children, onViewSource, expanded = true, onToggle }) => {
  const badgeColor =
    confidence === undefined ? "text-gray-400 bg-gray-100"
    : confidence >= 0.9 ? "text-green-700 bg-green-100"
    : confidence >= 0.7 ? "text-blue-700 bg-blue-100"
    : "text-yellow-700 bg-yellow-100";

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-3">
      {/* 分组标题 */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <button className="text-gray-400 hover:text-gray-600">
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {confidence !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeColor}`}>
              {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        {onViewSource && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewSource(); }}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            查看源文件
          </button>
        )}
      </div>
      {/* 展开内容 */}
      {expanded && (
        <div className="p-2 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
};
