import React, { useState, useRef, useCallback } from 'react';
import { SourceAnchor } from '../../types';

interface DocumentPreviewPanelProps {
  imageUrl: string;
  fileType?: 'image' | 'pdf';
  activeAnchor?: SourceAnchor | null;
  onZoomChange?: (zoom: number) => void;
}

export const DocumentPreviewPanel: React.FC<DocumentPreviewPanelProps> = ({
  imageUrl,
  fileType = 'image',
  activeAnchor,
  onZoomChange,
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 5);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.5);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    onZoomChange?.(1);
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        setIsDragging(true);
        dragStart.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        };
      }
    },
    [zoom, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y,
        });
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const getHighlightStyle = () => {
    if (!activeAnchor?.coordinates || !containerRef.current) return null;

    const coords = activeAnchor.coordinates;
    const container = containerRef.current.getBoundingClientRect();

    return {
      left: `${(coords.x / container.width) * 100}%`,
      top: `${(coords.y / container.height) * 100}%`,
      width: `${(coords.width / container.width) * 100}%`,
      height: `${(coords.height / container.height) * 100}%`,
    };
  };

  const highlightStyle = getHighlightStyle();

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <span className="text-sm text-gray-600">材料预览</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="缩小"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="放大"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded ml-2"
            title="重置"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {fileType === 'image' ? (
            <img
              src={imageUrl}
              alt="Document preview"
              className="max-w-full max-h-full object-contain shadow-lg"
              draggable={false}
            />
          ) : (
            <iframe
              src={imageUrl}
              className="w-full h-full border-0"
              title="PDF preview"
            />
          )}

          {/* Highlight overlay */}
          {highlightStyle && (
            <div
              className="absolute border-2 border-red-500 bg-red-500/20 animate-pulse pointer-events-none"
              style={highlightStyle}
            />
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
        鼠标滚轮缩放，拖拽移动，点击字段可定位
      </div>
    </div>
  );
};

export default DocumentPreviewPanel;
