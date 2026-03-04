import React from 'react';

interface VoiceControlsProps {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onBargeIn: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  isConnected,
  isListening,
  isSpeaking,
  onConnect,
  onDisconnect,
  onStartListening,
  onStopListening,
  onBargeIn
}) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {/* Connect/Disconnect Button */}
      {!isConnected ? (
        <button
          onClick={onConnect}
          className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          开始对话
        </button>
      ) : (
        <button
          onClick={onDisconnect}
          className="px-6 py-3 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          结束对话
        </button>
      )}

      {/* Listen/Stop Button */}
      {isConnected && (
        <button
          onClick={isListening ? onStopListening : onStartListening}
          className={`px-6 py-3 rounded-full font-medium transition-colors flex items-center gap-2 ${
            isListening
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {isListening ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              停止聆听
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              开始聆听
            </>
          )}
        </button>
      )}

      {/* Barge-in Button */}
      {isConnected && isSpeaking && (
        <button
          onClick={onBargeIn}
          className="px-6 py-3 bg-orange-500 text-white rounded-full font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          打断
        </button>
      )}
    </div>
  );
};
