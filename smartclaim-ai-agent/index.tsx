import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

type ErrorBoundaryState = { hasError: boolean; error?: Error };

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/60">
            <div className="text-base font-bold text-slate-800 mb-2">页面渲染失败</div>
            <div className="text-xs text-slate-500 leading-relaxed break-words">{this.state.error?.message || '未知错误'}</div>
            <button onClick={() => window.location.reload()} className="mt-4 w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">刷新重试</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
