import React from "react";

interface DecisionBadgeProps {
  decision: "APPROVE" | "REJECT" | "PARTIAL_APPROVE" | "MANUAL_REVIEW";
  className?: string;
}

const STYLES: Record<DecisionBadgeProps["decision"], string> = {
  APPROVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL_APPROVE: "bg-amber-50 text-amber-700 border-amber-200",
  REJECT: "bg-rose-50 text-rose-700 border-rose-200",
  MANUAL_REVIEW: "bg-slate-100 text-slate-700 border-slate-200",
};

const LABELS: Record<DecisionBadgeProps["decision"], string> = {
  APPROVE: "自动通过",
  PARTIAL_APPROVE: "部分赔付",
  REJECT: "自动拒赔",
  MANUAL_REVIEW: "人工复核",
};

const DecisionBadge: React.FC<DecisionBadgeProps> = ({ decision, className = "" }) => (
  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STYLES[decision]} ${className}`}>
    {LABELS[decision]}
  </span>
);

export default DecisionBadge;
