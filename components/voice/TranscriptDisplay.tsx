import React, { useRef, useEffect } from 'react';
import type { VoiceChatMessage } from '../../types/voice';

interface TranscriptDisplayProps {
  transcript: string;
  messages: VoiceChatMessage[];
}

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  transcript,
  messages
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, transcript]);

  return (
    <div 
      ref={scrollRef}
      className="w-full h-64 overflow-y-auto mb-6 p-4 bg-gray-50 rounded-lg"
    >
      {/* Message History */}
      {messages.map((message, index) => (
        <div
          key={index}
          className={`mb-3 ${
            message.role === 'user' ? 'text-right' : 'text-left'
          }`}
        >
          <div
            className={`inline-block max-w-[80%] px-4 py-2 rounded-2xl ${
              message.role === 'user'
                ? 'bg-blue-500 text-white'
                : message.role === 'system'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            <p className="text-sm">{message.content}</p>
            <span className="text-xs opacity-70 mt-1 block">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      ))}

      {/* Current Transcript */}
      {transcript && (
        <div className="text-right">
          <div className="inline-block max-w-[80%] px-4 py-2 rounded-2xl bg-blue-300 text-white">
            <p className="text-sm">{transcript}</p>
            <span className="text-xs opacity-70 mt-1 block">识别中...</span>
          </div>
        </div>
      )}

      {messages.length === 0 && !transcript && (
        <div className="flex items-center justify-center h-full text-gray-400">
          <p>点击"开始对话"与AI理赔助手交流</p>
        </div>
      )}
    </div>
  );
};
