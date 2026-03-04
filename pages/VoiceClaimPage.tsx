import React, { useState } from 'react';
import { VoiceClient } from '../components/voice/VoiceClient';

export const VoiceClaimPage: React.FC = () => {
  const [sessionId, setSessionId] = useState<string>('');
  const [showVoice, setShowVoice] = useState(false);

  const startSession = () => {
    const newSessionId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    setShowVoice(true);
  };

  const handleSessionEnd = (summary: any) => {
    console.log('Session ended:', summary);
    setShowVoice(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          智能理赔语音助手
        </h1>

        {!showVoice ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="mb-6">
              <svg 
                className="w-24 h-24 mx-auto text-blue-500 mb-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                />
              </svg>
              <h2 className="text-xl font-semibold mb-2">欢迎使用语音理赔服务</h2>
              <p className="text-gray-600 mb-6">
                通过语音与AI助手对话，快速完成理赔报案、查询进度等操作
              </p>
            </div>

            <button
              onClick={startSession}
              className="px-8 py-4 bg-blue-600 text-white rounded-full font-medium text-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              开始语音对话
            </button>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">📝 报案</h3>
                <p className="text-sm text-gray-600">语音描述事故，自动填写报案信息</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">🔍 查进度</h3>
                <p className="text-sm text-gray-600">随时查询理赔案件处理进度</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">💬 咨询</h3>
                <p className="text-sm text-gray-600">解答理赔相关问题</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <VoiceClient
              sessionId={sessionId}
              wsUrl={`ws://${window.location.host}/voice/ws/${sessionId}`}
              onSessionEnd={handleSessionEnd}
            />
            
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowVoice(false)}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                返回首页
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
