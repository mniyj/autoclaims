import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import { type SourceAnchor } from "../../types";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

interface DocumentViewerProps {
  fileUrl: string;
  fileType: "pdf" | "image" | "word" | "excel" | "video" | "other";
  fileName?: string;
  initialAnchor?: SourceAnchor;
  className?: string;
}

export interface DocumentViewerRef {
  jumpTo: (anchor: SourceAnchor) => void;
  clearHighlight: () => void;
}

type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PdfDocumentProxy = Awaited<ReturnType<typeof pdfjsLib.getDocument>>["promise"] extends Promise<infer T>
  ? T
  : never;

function buildOfficeViewerUrl(fileUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function normalizeSearchText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

const DocumentViewer = forwardRef<DocumentViewerRef, DocumentViewerProps>(
  ({ fileUrl, fileType, fileName, initialAnchor, className = "" }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const imageViewportRef = useRef<HTMLDivElement>(null);
    const pdfViewportRef = useRef<HTMLDivElement>(null);
    const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [bannerMsg, setBannerMsg] = useState<string | null>(null);
    const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
    const [imageZoom, setImageZoom] = useState(1);
    const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [flashActive, setFlashActive] = useState(false);
    const [pdfDoc, setPdfDoc] = useState<PdfDocumentProxy | null>(null);
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [pdfHighlightRects, setPdfHighlightRects] = useState<HighlightRect[]>([]);
    const [pendingPdfSearchText, setPendingPdfSearchText] = useState<string | null>(null);

    const iframeSrc = useMemo(() => {
      if (!fileUrl) return "";
      if (fileType === "word" || fileType === "excel") {
        return buildOfficeViewerUrl(fileUrl);
      }
      return fileUrl;
    }, [fileType, fileUrl]);

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
      setCurrentPage(1);
      setHighlightRect(null);
      setBannerMsg(null);
      setImageZoom(1);
      setImageOffset({ x: 0, y: 0 });
      setFlashActive(false);
      setPdfError(null);
      setPdfHighlightRects([]);
      setPendingPdfSearchText(null);
    }, [fileUrl]);

    useEffect(() => {
      if (fileType !== "pdf" || !fileUrl) {
        setPdfDoc(null);
        setPdfPageCount(0);
        setPdfLoading(false);
        setPdfError(null);
        setPdfHighlightRects([]);
        return;
      }

      let cancelled = false;
      const loadingTask = pdfjsLib.getDocument(fileUrl);
      setPdfLoading(true);
      setPdfError(null);

      void loadingTask.promise
        .then((loadedPdf) => {
          if (cancelled) {
            void loadedPdf.destroy();
            return;
          }
          setPdfDoc(loadedPdf);
          setPdfPageCount(loadedPdf.numPages);
          setCurrentPage(1);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("[DocumentViewer] Failed to load PDF:", error);
          setPdfError("PDF 加载失败，请尝试在新窗口打开");
          setPdfDoc(null);
          setPdfPageCount(0);
        })
        .finally(() => {
          if (!cancelled) {
            setPdfLoading(false);
          }
        });

      return () => {
        cancelled = true;
        void loadingTask.destroy();
      };
    }, [fileType, fileUrl]);

    useEffect(() => {
      if (fileType !== "pdf" || !pdfDoc || !pdfCanvasRef.current) return;

      let cancelled = false;
      const canvas = pdfCanvasRef.current;
      const containerWidth = pdfViewportRef.current?.clientWidth || 900;

      void pdfDoc.getPage(currentPage).then((page) => {
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(1, Math.min(2, (containerWidth - 32) / baseViewport.width));
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        void page.render({
          canvasContext: context,
          viewport,
        }).promise.catch((error) => {
          if (!cancelled) {
            console.error("[DocumentViewer] Failed to render PDF page:", error);
          }
        });

        if (!pendingPdfSearchText) {
          setPdfHighlightRects([]);
          return;
        }

        void page.getTextContent().then((textContent) => {
          if (cancelled) return;
          const keyword = normalizeSearchText(pendingPdfSearchText);
          if (!keyword) {
            setPdfHighlightRects([]);
            return;
          }

          const nextRects: HighlightRect[] = [];
          for (const item of textContent.items) {
            if (!("str" in item) || typeof item.str !== "string") continue;
            const itemText = normalizeSearchText(item.str);
            if (!itemText) continue;
            const matched =
              itemText.includes(keyword) ||
              keyword.includes(itemText) ||
              itemText.includes(keyword.slice(0, Math.min(keyword.length, 10)));
            if (!matched) continue;

            const transformed = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const width = Math.max(24, item.width * viewport.scale);
            const height = Math.max(14, item.height * viewport.scale);
            nextRects.push({
              left: transformed[4],
              top: transformed[5] - height,
              width,
              height,
            });
          }
          setPdfHighlightRects(nextRects);
          if (nextRects.length === 0) {
            setBannerMsg(
              `已跳转到第 ${currentPage} 页，但未在当前页精确匹配到关键词，可继续人工核对原文`
            );
          }
        });
      });

      return () => {
        cancelled = true;
      };
    }, [currentPage, fileType, pdfDoc, pendingPdfSearchText]);

    useEffect(() => {
      if (initialAnchor) {
        applyAnchor(initialAnchor);
      }
    }, [initialAnchor, fileUrl]);

    function triggerFlash() {
      setFlashActive(true);
      window.setTimeout(() => setFlashActive(false), 1200);
    }

    function zoomImage(nextZoom: number) {
      setImageZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoom.toFixed(2)))));
    }

    function jumpToPageL1(pageIndex: number) {
      setCurrentPage(pageIndex + 1);
      setHighlightRect(null);
      setPdfHighlightRects([]);
      setPendingPdfSearchText(null);
      triggerFlash();
    }

    function jumpToPageL2(pageIndex: number, rawText: string) {
      setCurrentPage(pageIndex + 1);
      setHighlightRect(null);
      const keyword = rawText.trim().slice(0, 40);
      setPendingPdfSearchText(keyword);
      setPdfHighlightRects([]);
      triggerFlash();
      setBannerMsg(
        keyword
          ? `已定位到第 ${pageIndex + 1} 页，请在原文中查看关键词：${keyword}`
          : `已定位到第 ${pageIndex + 1} 页，请手动查看原文`
      );
    }

    function jumpToPageL3(pageIndex: number, bbox: [number, number, number, number]) {
      setCurrentPage(pageIndex + 1);
      if (fileType === "image") {
        const [x0, y0, x1, y1] = bbox;
        setHighlightRect({
          left: x0 * 100,
          top: y0 * 100,
          width: (x1 - x0) * 100,
          height: (y1 - y0) * 100,
        });
        setImageZoom((current) => Math.max(current, 1.8));
        setImageOffset({ x: 0, y: 0 });
        triggerFlash();
        return;
      }

      if (fileType === "pdf") {
        setPendingPdfSearchText(null);
        setPdfHighlightRects([]);
        triggerFlash();
      }
    }

    function applyAnchor(anchor: SourceAnchor) {
      if (!anchor) return;

      if (anchor.highlightLevel === "precise" && anchor.bbox) {
        jumpToPageL3(anchor.pageIndex, anchor.bbox);
        setBannerMsg(null);
        return;
      }

      if (anchor.highlightLevel === "text_search" && anchor.rawText) {
        jumpToPageL2(anchor.pageIndex, anchor.rawText);
        return;
      }

      jumpToPageL1(anchor.pageIndex);
      setBannerMsg(`AI 已定位到第 ${anchor.pageIndex + 1} 页，请手动查看对应原文`);
    }

    const handleImageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      zoomImage(imageZoom + delta);
    };

    const handleImageMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
      if (imageZoom <= 1) return;
      const start = { x: event.clientX, y: event.clientY };
      const origin = { ...imageOffset };
      setIsDraggingImage(true);

      const move = (moveEvent: MouseEvent) => {
        setImageOffset({
          x: origin.x + moveEvent.clientX - start.x,
          y: origin.y + moveEvent.clientY - start.y,
        });
      };

      const up = () => {
        setIsDraggingImage(false);
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };

      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };

    const renderToolbar = () => {
      if (fileType !== "image") return null;
      return (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => zoomImage(imageZoom - ZOOM_STEP)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            缩小
          </button>
          <button
            type="button"
            onClick={() => zoomImage(imageZoom + ZOOM_STEP)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            放大
          </button>
          <button
            type="button"
            onClick={() => {
              setImageZoom(1);
              setImageOffset({ x: 0, y: 0 });
              setHighlightRect(null);
            }}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            重置
          </button>
          <span className="ml-auto">缩放 {Math.round(imageZoom * 100)}%</span>
        </div>
      );
    };

    const renderPdfToolbar = () => {
      if (fileType !== "pdf") return null;
      return (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage <= 1}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一页
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(pdfPageCount || page, page + 1))}
            disabled={!pdfPageCount || currentPage >= pdfPageCount}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一页
          </button>
          <span className="ml-2">
            第 {currentPage} / {pdfPageCount || 1} 页
          </span>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            新窗口打开
          </a>
        </div>
      );
    };

    const renderViewer = () => {
      if (!fileUrl) {
        return (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            未选择文件
          </div>
        );
      }

      if (fileType === "image") {
        return (
          <div className="flex h-full flex-col">
            {renderToolbar()}
            <div
              ref={imageViewportRef}
              className={`relative flex-1 overflow-hidden bg-slate-100 ${
                flashActive ? "ring-2 ring-amber-300 ring-inset" : ""
              }`}
              onWheel={handleImageWheel}
              onMouseDown={handleImageMouseDown}
              onDoubleClick={() => zoomImage(imageZoom >= 2 ? 1 : 2)}
            >
              <div className="flex h-full items-center justify-center overflow-auto">
                <div
                  className={`relative ${isDraggingImage ? "cursor-grabbing" : imageZoom > 1 ? "cursor-grab" : "cursor-zoom-in"}`}
                  style={{
                    transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom})`,
                    transformOrigin: "center center",
                    transition: isDraggingImage ? "none" : "transform 120ms ease-out",
                  }}
                >
                  <img
                    src={fileUrl}
                    alt={fileName || "文件预览"}
                    className="block max-w-full rounded shadow-sm select-none"
                    draggable={false}
                  />
                  {highlightRect && (
                    <div
                      className="pointer-events-none absolute"
                      style={{
                        left: `${highlightRect.left}%`,
                        top: `${highlightRect.top}%`,
                        width: `${highlightRect.width}%`,
                        height: `${highlightRect.height}%`,
                        background: "rgba(250, 173, 20, 0.28)",
                        border: "2px solid #f59e0b",
                        boxShadow: "0 0 0 4px rgba(250, 204, 21, 0.18)",
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      if (fileType === "pdf") {
        return (
          <div className="flex h-full flex-col">
            {renderPdfToolbar()}
            <div
              ref={pdfViewportRef}
              className={`flex-1 overflow-auto bg-slate-100 p-4 ${
                flashActive ? "ring-2 ring-amber-300 ring-inset" : ""
              }`}
            >
              {pdfLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  PDF 加载中...
                </div>
              ) : pdfError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-500">
                  <div>{pdfError}</div>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    在新窗口打开
                  </a>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="relative">
                    <canvas ref={pdfCanvasRef} className="max-w-full rounded bg-white shadow" />
                    {pdfHighlightRects.map((rect, index) => (
                      <div
                        key={`pdf-highlight-${index}`}
                        className="pointer-events-none absolute"
                        style={{
                          left: `${rect.left}px`,
                          top: `${rect.top}px`,
                          width: `${rect.width}px`,
                          height: `${rect.height}px`,
                          background: "rgba(250, 173, 20, 0.24)",
                          border: "2px solid #f59e0b",
                          boxShadow: "0 0 0 3px rgba(250, 204, 21, 0.16)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      if (fileType === "word" || fileType === "excel") {
        return (
          <div className={`h-full ${flashActive ? "ring-2 ring-amber-300 ring-inset" : ""}`}>
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className="h-full w-full border-0"
              title={fileName || "文档预览"}
            />
          </div>
        );
      }

      if (fileType === "video") {
        return (
          <div className={`flex h-full flex-col bg-black ${flashActive ? "ring-2 ring-amber-300 ring-inset" : ""}`}>
            <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
              <span>在线播放</span>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200 hover:bg-slate-800"
              >
                新窗口打开
              </a>
            </div>
            <div className="flex flex-1 items-center justify-center p-4">
              <video
                src={fileUrl}
                controls
                preload="metadata"
                className="max-h-full max-w-full rounded bg-black shadow"
              >
                您的浏览器暂不支持视频播放，请尝试在新窗口打开。
              </video>
            </div>
          </div>
        );
      }

      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-500">
          <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">{fileName || "文档文件"}</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            在新窗口打开
          </a>
        </div>
      );
    };

    return (
      <div className={`relative flex h-full flex-col ${className}`}>
        {fileName && (
          <div className="flex shrink-0 items-center border-b border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
            <svg className="mr-2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {fileName}
            {(fileType === "pdf" || fileType === "word" || fileType === "excel") && currentPage > 0 && (
              <span className="ml-2 text-xs text-slate-400">第 {currentPage} 页</span>
            )}
          </div>
        )}

        {bannerMsg && (
          <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{bannerMsg}</span>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              className="ml-auto text-amber-500 hover:text-amber-700"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">{renderViewer()}</div>
      </div>
    );
  }
);

DocumentViewer.displayName = "DocumentViewer";

export default DocumentViewer;
