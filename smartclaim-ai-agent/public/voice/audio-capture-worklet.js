/**
 * Audio capture worklet for the voice pipeline.
 *
 * Runs on the dedicated audio worker thread. The AudioContext is forced to
 * 16kHz on the JS side, so inputs arrive at our target rate — no downsampling
 * needed here. We accumulate mono float32 samples into ~128ms frames, convert
 * to int16 PCM, and postMessage them to the main thread.
 *
 * Frame size: 2048 samples = 128ms @ 16kHz. This is ~8× the AudioWorklet's
 * native 128-sample quantum, which keeps the message rate low (~8 msgs/s)
 * while staying well under the Aliyun IDLE_TIMEOUT threshold if frames stop.
 */
const FRAME_SAMPLES = 2048;

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(FRAME_SAMPLES);
    this.writeIndex = 0;
  }

  /**
   * inputs[0] is an array of channels. We take the first (mono).
   * Each channel is a Float32Array of exactly 128 samples per invocation.
   */
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.writeIndex++] = channel[i];
      if (this.writeIndex === FRAME_SAMPLES) {
        // Compute RMS on the float frame (cheap, no copy).
        let sumSq = 0;
        for (let j = 0; j < FRAME_SAMPLES; j++) {
          const s = this.buffer[j];
          sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / FRAME_SAMPLES);

        // Convert to int16. Transferable to avoid copy.
        const int16 = new Int16Array(FRAME_SAMPLES);
        for (let j = 0; j < FRAME_SAMPLES; j++) {
          let s = this.buffer[j];
          if (s > 1) s = 1;
          else if (s < -1) s = -1;
          int16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        this.port.postMessage(
          { pcm: int16.buffer, rms },
          [int16.buffer],
        );

        this.writeIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
