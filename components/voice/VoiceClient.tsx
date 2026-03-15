import React from "react";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { VoiceVisualizer } from "./VoiceVisualizer";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { VoiceControls } from "./VoiceControls";

interface VoiceClientProps {
  sessionId: string;
  wsUrl: string;
  onSessionEnd?: (summary: any) => void;
}

export const VoiceClient: React.FC<VoiceClientProps> = ({
  sessionId,
  wsUrl,
  onSessionEnd,
}) => {
  const { state, connect, disconnect, sendBargeIn } = useVoiceSession({
    sessionId,
    wsUrl,
    onSessionEnd,
  });

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`w-3 h-3 rounded-full ${state.isConnected ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className="text-sm text-gray-600">
          {state.isConnected ? "已连接" : "未连接"}
        </span>
        {state.currentTool && (
          <span className="text-sm text-blue-600 ml-4">
            正在{state.currentTool}...
          </span>
        )}
      </div>

      {/* Voice Visualizer */}
      <VoiceVisualizer
        isListening={state.isListening}
        isSpeaking={state.isSpeaking}
      />

      {/* Transcript Display */}
      <TranscriptDisplay
        transcript={state.transcript}
        messages={state.messages}
      />

      {/* Voice Controls */}
      <VoiceControls
        isConnected={state.isConnected}
        isListening={state.isListening}
        isSpeaking={state.isSpeaking}
        onConnect={connect}
        onDisconnect={disconnect}
        onBargeIn={sendBargeIn}
      />

      {/* Error Display */}
      {state.error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {state.error}
        </div>
      )}
    </div>
  );
};
