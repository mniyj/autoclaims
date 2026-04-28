/**
 * Minimal RMS-based voice activity detector.
 *
 * Fed by MicCapture: one call to feed() per audio frame (128ms @ 16kHz).
 *
 * State model:
 *  - silence → candidate-speech (RMS crosses threshold)
 *  - candidate-speech → speech (sustained for MIN_SPEECH_MS)
 *  - speech → candidate-silence (RMS drops below threshold)
 *  - candidate-silence → silence (sustained for HANGOVER_MS)
 *
 * This deliberately ignores isolated loud samples (clicks, pops) via the
 * min-speech debounce, and tolerates brief mid-word pauses via the hangover.
 *
 * If the default threshold produces too many false positives for a given
 * microphone, adjust `threshold` in the options — 0.015 is tuned for a
 * quiet room with built-in MacBook mic; noisier environments want 0.03+.
 */
export type VadState = "speech" | "silence";

export interface VadOptions {
  /** RMS threshold above which a frame is considered loud. Default 0.015. */
  threshold?: number;
  /** ms of sustained loud frames before we announce "speech". Default 60. */
  minSpeechMs?: number;
  /** ms of sustained quiet frames before we announce "silence". Default 250. */
  hangoverMs?: number;
  /** Called when state changes. */
  onStateChange: (state: VadState) => void;
}

export class VadDetector {
  private state: VadState = "silence";
  private pendingState: VadState = "silence";
  private pendingSince = 0;
  private options: Required<Omit<VadOptions, "onStateChange">> & Pick<VadOptions, "onStateChange">;

  constructor(options: VadOptions) {
    this.options = {
      threshold: options.threshold ?? 0.015,
      minSpeechMs: options.minSpeechMs ?? 60,
      hangoverMs: options.hangoverMs ?? 250,
      onStateChange: options.onStateChange,
    };
  }

  getState(): VadState {
    return this.state;
  }

  /**
   * Feed one audio frame's RMS value. Invokes onStateChange if the stable
   * state transitions after applying the debounce rules.
   */
  feed(rms: number, nowMs: number = Date.now()): void {
    const loud = rms >= this.options.threshold;
    const observed: VadState = loud ? "speech" : "silence";

    if (observed === this.state) {
      // Still the same as the confirmed state; drop any pending transition.
      this.pendingState = this.state;
      this.pendingSince = 0;
      return;
    }

    // Observed differs from current confirmed state.
    if (observed !== this.pendingState) {
      // Starting to consider a flip.
      this.pendingState = observed;
      this.pendingSince = nowMs;
      return;
    }

    // Pending has been consistent; check whether it's held long enough.
    const requiredMs =
      observed === "speech" ? this.options.minSpeechMs : this.options.hangoverMs;
    if (nowMs - this.pendingSince >= requiredMs) {
      this.state = observed;
      this.pendingState = observed;
      this.pendingSince = 0;
      try {
        this.options.onStateChange(observed);
      } catch (err) {
        console.error("[VadDetector] onStateChange threw:", err);
      }
    }
  }

  /** Force the detector back to silence (e.g. after barge-in fires). */
  reset(): void {
    this.state = "silence";
    this.pendingState = "silence";
    this.pendingSince = 0;
  }
}
