import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DialogVariant = "info" | "warning" | "error" | "danger" | "success";

interface DialogState {
  open: boolean;
  type: "alert" | "confirm";
  variant: DialogVariant;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  resolve?: (value: boolean) => void;
}

// ── Variant config ────────────────────────────────────────────────────────────

const VARIANT: Record<
  DialogVariant,
  {
    wrapperBg: string;
    iconColor: string;
    confirmBtn: string;
    icon: React.ReactNode;
  }
> = {
  info: {
    wrapperBg: "bg-blue-50",
    iconColor: "text-blue-500",
    confirmBtn:
      "bg-brand-blue-600 hover:bg-brand-blue-700 focus:ring-brand-blue-500 text-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  success: {
    wrapperBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    confirmBtn:
      "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    wrapperBg: "bg-amber-50",
    iconColor: "text-amber-500",
    confirmBtn:
      "bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 text-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  error: {
    wrapperBg: "bg-red-50",
    iconColor: "text-red-500",
    confirmBtn:
      "bg-brand-blue-600 hover:bg-brand-blue-700 focus:ring-brand-blue-500 text-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  danger: {
    wrapperBg: "bg-red-50",
    iconColor: "text-red-500",
    confirmBtn:
      "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
};

// ── Animation keyframe injected once ─────────────────────────────────────────

let styleInjected = false;
function ensureStyles() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes _dlg_fade_in  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes _dlg_slide_up { from { opacity: 0; transform: translateY(12px) scale(.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
  `;
  document.head.appendChild(el);
}

// ── Dialog component ──────────────────────────────────────────────────────────

interface DialogProps {
  state: DialogState;
  onConfirm: () => void;
  onCancel: () => void;
}

const Dialog: React.FC<DialogProps> = ({ state, onConfirm, onCancel }) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state.open) {
      ensureStyles();
      setTimeout(() => confirmRef.current?.focus(), 60);
    }
  }, [state.open]);

  useEffect(() => {
    if (!state.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [state.open, onCancel, onConfirm]);

  if (!state.open) return null;

  const cfg = VARIANT[state.variant];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
      style={{
        backgroundColor: "rgba(15,23,42,.55)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        animation: "_dlg_fade_in .15s ease",
      }}
      onClick={onCancel}
    >
      {/* Card */}
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "_dlg_slide_up .2s cubic-bezier(.34,1.2,.64,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top color bar */}
        <div
          className={`h-1 w-full ${
            state.variant === "danger" || state.variant === "error"
              ? "bg-red-500"
              : state.variant === "warning"
                ? "bg-amber-400"
                : state.variant === "success"
                  ? "bg-emerald-500"
                  : "bg-brand-blue-500"
          }`}
        />

        {/* Body */}
        <div className="px-6 pt-5 pb-1 flex items-start gap-4">
          {/* Icon circle */}
          <div
            className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${cfg.wrapperBg} ${cfg.iconColor}`}
          >
            {cfg.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-gray-900 leading-snug">
              {state.title}
            </p>
            {state.message && (
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                {state.message}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 mt-4 border-t border-gray-100" />

        {/* Buttons */}
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          {state.type === "confirm" && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
            >
              {state.cancelText}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-sm ${cfg.confirmBtn}`}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

const DEFAULT_STATE: DialogState = {
  open: false,
  type: "alert",
  variant: "info",
  title: "",
  message: "",
  confirmText: "确认",
  cancelText: "取消",
};

export function useDialog() {
  const [state, setState] = useState<DialogState>(DEFAULT_STATE);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      options?: { variant?: DialogVariant; confirmText?: string },
    ) =>
      new Promise<void>((resolve) => {
        setState({
          open: true,
          type: "alert",
          variant: options?.variant ?? "info",
          title,
          message: message ?? "",
          confirmText: options?.confirmText ?? "确认",
          cancelText: "取消",
          resolve: () => resolve(),
        });
      }),
    [],
  );

  const showConfirm = useCallback(
    (
      title: string,
      message?: string,
      options?: {
        variant?: DialogVariant;
        confirmText?: string;
        cancelText?: string;
      },
    ) =>
      new Promise<boolean>((resolve) => {
        setState({
          open: true,
          type: "confirm",
          variant: options?.variant ?? "warning",
          title,
          message: message ?? "",
          confirmText: options?.confirmText ?? "确认",
          cancelText: options?.cancelText ?? "取消",
          resolve,
        });
      }),
    [],
  );

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    close();
  }, [state, close]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    close();
  }, [state, close]);

  const dialogNode = (
    <Dialog state={state} onConfirm={handleConfirm} onCancel={handleCancel} />
  );

  return { dialogNode, showAlert, showConfirm };
}

export default Dialog;
