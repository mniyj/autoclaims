import React, { useEffect, useCallback } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  /** 是否有未保存的更改，关闭时会弹出确认提示 */
  isDirty?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width,
  isDirty,
}) => {
  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm("有未保存的更改，确定要关闭吗？")) {
        return;
      }
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${width || "max-w-md"} m-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="关闭"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-6 text-gray-700 overflow-y-auto max-h-[70vh]">
          {children}
        </div>
        {footer === undefined ? (
          <div className="flex justify-end p-4 bg-gray-50 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-brand-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue-500 transition-colors"
            >
              确认
            </button>
          </div>
        ) : (
          footer !== null && (
            <div className="flex justify-end p-4 bg-gray-50 rounded-b-lg">
              {footer}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Modal;
