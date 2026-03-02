/**
 * DocumentViewer - 文档查看器组件
 *
 * 支持 PDF、图片的展示，以及三级高亮策略：
 * - L3 精确高亮：有 bbox 坐标，绘制黄色矩形
 * - L2 文本搜索高亮：有 rawText，滚动到第一个匹配
 * - L1 页面定位：仅 pageIndex，跳转到指定页并显示提示
 *
 * 使用方式：
 * 1. <DocumentViewer fileUrl="..." fileType="pdf" />
 * 2. ref.current.jumpTo(anchor) — 跳转到指定 SourceAnchor
 */

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { type SourceAnchor } from "../../types";

interface DocumentViewerProps {
  /** 文件 URL（OSS URL 或本地路径） */
  fileUrl: string;
  /** 文件类型分类 */
  fileType: "pdf" | "image" | "word" | "excel" | "other";
  /** 文件名（用于展示） */
  fileName?: string;
  /** 初始跳转锚点 */
  initialAnchor?: SourceAnchor;
  className?: string;
}

export interface DocumentViewerRef {
  /** 跳转到指定锚点并执行高亮 */
  jumpTo: (anchor: SourceAnchor) => void;
  /** 清除所有高亮 */
  clearHighlight: () => void;
}

const DocumentViewer = forwardRef<DocumentViewerRef, DocumentViewerProps>(
  ({ fileUrl, fileType, fileName, initialAnchor, className = "" }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [bannerMsg, setBannerMsg] = useState<string | null>(null);
    const [highlightRect, setHighlightRect] = useState<{
      left: number;
      top: number;
      width: number;
      height: number;
    } | null>(null);

    // 暴露 jumpTo / clearHighlight 方法给父组件
    useImperativeHandle(ref, () => ({
      jumpTo(anchor: SourceAnchor) {
        applyAnchor(anchor);
      },
      clearHighlight() {
        setHighlightRect(null);
        setBannerMsg(null);
      },
    }));

    useEffect(() => {
      if (initialAnchor) {
        applyAnchor(initialAnchor);
      }
    }, [initialAnchor, fileUrl]);

    function applyAnchor(anchor: SourceAnchor) {
      if (!anchor) return;

      if (anchor.highlightLevel === "precise" && anchor.bbox) {
        // L3: 精确高亮 — 通过 bbox 归一化坐标在容器上叠加高亮层
        jumpToPageL3(anchor.pageIndex, anchor.bbox);
        setBannerMsg(null);
      } else if (anchor.highlightLevel === "text_search" && anchor.rawText) {
        // L2: 文本搜索高亮 — PDF 用 iframe postMessage，图片用正则
        jumpToPageL2(anchor.pageIndex, anchor.rawText);
        setBannerMsg(null);
      } else {
        // L1: 仅页面定位
        jumpToPageL1(anchor.pageIndex);
        setBannerMsg(
          `AI 已定位到第 ${anchor.pageIndex + 1} 页，请手动查看高亮字段`
        );
      }
    }

    // L1: 滚动到页面（iframe PDF 或图片）
    function jumpToPageL1(pageIndex: number) {
      setCurrentPage(pageIndex + 1);
      setHighlightRect(null);
      if (fileType === "pdf" && iframeRef.current) {
        // PDF.js viewer URL 支持 #page=N
        const base = fileUrl.split("#")[0];
        iframeRef.current.src = `${base}#page=${pageIndex + 1}`;
      }
    }

    // L2: 文本搜索高亮（PDF 通过 URL hash 参数，图片暂时退化为 L1）
    function jumpToPageL2(pageIndex: number, rawText: string) {
      setCurrentPage(pageIndex + 1);
      setHighlightRect(null);
      if (fileType === "pdf" && iframeRef.current) {
        // PDF.js 支持 #search=<keyword>&page=N
        const base = fileUrl.split("#")[0];
        const encoded = encodeURIComponent(rawText.slice(0, 50));
        iframeRef.current.src = `${base}#page=${pageIndex + 1}&search=${encoded}`;
      }
    }

    // L3: 精确高亮 — 在图片容器上叠加 bbox 矩形
    function jumpToPageL3(pageIndex: number, bbox: [number, number, number, number]) {
      setCurrentPage(pageIndex + 1);
      if (fileType === "image" && containerRef.current) {
        const [x0, y0, x1, y1] = bbox;
        setHighlightRect({
          left: x0 * 100,
          top: y0 * 100,
          width: (x1 - x0) * 100,
          height: (y1 - y0) * 100,
        });
      } else if (fileType === "pdf" && iframeRef.current) {
        // PDF: 降级为 L2 文本搜索
        const base = fileUrl.split("#")[0];
        iframeRef.current.src = `${base}#page=${pageIndex + 1}`;
      }
    }

    const renderViewer = () => {
      if (!fileUrl) {
        return (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            未选择文件
          </div>
        );
      }

      if (fileType === "image") {
        return (
          <div ref={containerRef} className="relative w-full h-full overflow-auto">
            <img
              ref={imgRef}
              src={fileUrl}
              alt={fileName || "文件预览"}
              className="max-w-full h-auto"
              style={{ display: "block" }}
            />
            {/* L3 高亮叠加层 */}
            {highlightRect && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${highlightRect.left}%`,
                  top: `${highlightRect.top}%`,
                  width: `${highlightRect.width}%`,
                  height: `${highlightRect.height}%`,
                  background: "rgba(255, 215, 0, 0.35)",
                  border: "2px solid #faad14",
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        );
      }

      if (fileType === "pdf") {
        return (
          <iframe
            ref={iframeRef}
            src={fileUrl}
            className="w-full h-full border-0"
            title={fileName || "PDF 预览"}
          />
        );
      }

      // Word / Excel / 其他：使用 OSS URL 直接渲染或提示下载
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
          <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">{fileName || "文档文件"}</p>
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              在新窗口打开
            </a>
          )}
        </div>
      );
    };

    return (
      <div className={`relative flex flex-col h-full ${className}`}>
        {/* 文件名标题栏 */}
        {fileName && (
          <div className="flex items-center px-3 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600 font-medium shrink-0">
            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {fileName}
            {currentPage > 1 && (
              <span className="ml-2 text-xs text-gray-400">第 {currentPage} 页</span>
            )}
          </div>
        )}

        {/* L1 提示 banner */}
        {bannerMsg && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs shrink-0">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {bannerMsg}
            <button
              onClick={() => setBannerMsg(null)}
              className="ml-auto text-amber-500 hover:text-amber-700"
            >
              ×
            </button>
          </div>
        )}

        {/* 文档内容区 */}
        <div className="flex-1 overflow-hidden">
          {renderViewer()}
        </div>
      </div>
    );
  }
);

DocumentViewer.displayName = "DocumentViewer";
export default DocumentViewer;
