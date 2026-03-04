import React, { useEffect, useRef } from 'react';

interface VoiceVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isListening,
  isSpeaking
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bars: number[] = new Array(20).fill(0);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / bars.length;
      const centerY = canvas.height / 2;

      bars.forEach((bar, index) => {
        // Update bar height based on state
        if (isListening) {
          // Simulate audio input visualization
          bar += (Math.random() - 0.5) * 20;
          bar = Math.max(10, Math.min(80, bar));
        } else if (isSpeaking) {
          // Simulate audio output visualization
          bar = 30 + Math.sin(Date.now() / 100 + index) * 20;
        } else {
          // Idle state
          bar = bar * 0.9 + 5;
        }

        bars[index] = bar;

        // Draw bar
        const height = bar;
        const x = index * barWidth + barWidth * 0.2;
        const y = centerY - height / 2;

        // Gradient color based on state
        let gradient;
        if (isListening) {
          gradient = ctx.createLinearGradient(0, y, 0, y + height);
          gradient.addColorStop(0, '#3B82F6');
          gradient.addColorStop(1, '#1D4ED8');
        } else if (isSpeaking) {
          gradient = ctx.createLinearGradient(0, y, 0, y + height);
          gradient.addColorStop(0, '#10B981');
          gradient.addColorStop(1, '#059669');
        } else {
          gradient = ctx.createLinearGradient(0, y, 0, y + height);
          gradient.addColorStop(0, '#9CA3AF');
          gradient.addColorStop(1, '#6B7280');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth * 0.6, height, 4);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isSpeaking]);

  return (
    <div className="relative w-full h-32 mb-6">
      <canvas
        ref={canvasRef}
        width={400}
        height={128}
        className="w-full h-full"
      />
      
      {/* Status Label */}
      <div className="absolute top-2 right-2">
        {isListening && (
          <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
            正在聆听
          </span>
        )}
        {isSpeaking && (
          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
            AI正在说话
          </span>
        )}
      </div>
    </div>
  );
};
