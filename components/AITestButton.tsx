import React, { useState } from 'react';
import { AITestPanel } from './services/ai/AITestPanel';
import { aiService } from './services/ai/aiService';
import { GeminiProvider } from './services/ai/providers/geminiProvider';
import { ClaudeProvider } from './services/ai/providers/claudeProvider';

// 注册 AI Provider（应用启动时执行一次）
aiService.registerProvider(new GeminiProvider());
aiService.registerProvider(new ClaudeProvider());

export const AITestButton: React.FC = () => {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        onClick={() => setShowPanel(true)}
        className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center space-x-2 z-40 transition-all hover:scale-105"
        title="AI 测试面板"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span>AI 测试</span>
      </button>

      {/* 测试面板 */}
      {showPanel && (
        <AITestPanel onClose={() => setShowPanel(false)} />
      )}
    </>
  );
};
