import React from "react";

interface ManualReviewReason {
  code: string;
  message: string;
}

interface ManualReviewReasonListProps {
  reasons: ManualReviewReason[];
  title?: string;
}

const ManualReviewReasonList: React.FC<ManualReviewReasonListProps> = ({
  reasons,
  title = "人工复核原因",
}) => {
  if (reasons.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">
        {reasons.map((reason, index) => (
          <div
            key={`${reason.code}-${index}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <div className="text-sm text-slate-800">{reason.message}</div>
            <div className="mt-1 text-xs text-slate-500">{reason.code}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManualReviewReasonList;
