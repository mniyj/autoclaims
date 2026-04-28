/**
 * Serial PCM16 audio playback for server-streamed TTS chunks.
 *
 * Receives base64-encoded int16 PCM chunks, decodes them into AudioBuffers,
 * and plays them in-order via a Promise chain. Exposes a deterministic
 * `onEnded` event that fires when all queued chunks have finished playing.
 *
 * Lifecycle:
 *  - push(base64) while SPEAKING — plays serially
 *  - once the chain drains and the caller has signalled that no more chunks
 *    are coming (markSpeechEnd()), onEnded fires exactly once
 *  - cancel() aborts all pending playback immediately (used for barge-in)
 */
export interface TTSPlayerOptions {
  sampleRate?: number; // default 16000
  numChannels?: number; // default 1
}

type EndedListener = () => void;

export class TTSPlayer {
  private ctx: AudioContext | null = null;
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  private speechEnded = false;
  private disposed = false;
  /**
   * Incremented on every cancel(). Chunks enqueued at generation N are
   * unconditionally dropped once `playbackGen` advances past N. This is what
   * makes barge-in actually cut off already-queued audio, even after reset()
   * re-arms the player for the next turn.
   */
  private playbackGen = 0;
  /**
   * Generation that has been "armed" for end-of-speech detection by a push().
   * markSpeechEnd() only fires onEnded if armedForGen matches the current gen,
   * which prevents a stale server `speech_end` arriving right after cancel()
   * from triggering a spurious `playback_ended` for an aborted turn.
   */
  private armedForGen: number | null = null;
  private listeners: EndedListener[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private readonly sampleRate: number;
  private readonly numChannels: number;

  constructor(options: TTSPlayerOptions = {}) {
    this.sampleRate = options.sampleRate ?? 16000;
    this.numChannels = options.numChannels ?? 1;
  }

  /** Returns true while at least one chunk is queued or playing. */
  isPlaying(): boolean {
    return this.pending > 0;
  }

  /** Enqueue a base64-encoded PCM16 chunk for playback. */
  push(base64: string): void {
    if (this.disposed || !base64) return;
    this.ensureContext();

    // Capture the generation at enqueue time. If cancel() happens later, the
    // generation advances and this chunk (and its decode/play work) becomes
    // a no-op, regardless of whether the player is "re-armed" for a later turn.
    const myGen = this.playbackGen;

    // First chunk of a new turn arms the end-of-speech gate. See markSpeechEnd:
    // this prevents a stale speech_end event arriving just after a cancel()
    // from triggering a spurious onEnded fire.
    this.armedForGen = myGen;
    this.pending += 1;
    this.speechEnded = false; // receiving chunks again → speech is not ended

    this.chain = this.chain
      .catch(() => undefined)
      .then(async () => {
        if (this.disposed || myGen !== this.playbackGen) return;
        if (!this.ctx) return;
        const buffer = decodePCM16ToAudioBuffer(
          base64,
          this.ctx,
          this.sampleRate,
          this.numChannels,
        );

        if (this.ctx.state === "suspended") {
          try {
            await this.ctx.resume();
          } catch {
            /* best-effort */
          }
        }

        if (this.disposed || myGen !== this.playbackGen) return;

        await new Promise<void>((resolve) => {
          if (this.disposed || myGen !== this.playbackGen || !this.ctx) {
            resolve();
            return;
          }
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.ctx.destination);
          source.onended = () => {
            if (this.currentSource === source) this.currentSource = null;
            resolve();
          };
          this.currentSource = source;
          source.start(0);
        });
      })
      .finally(() => {
        this.pending = Math.max(0, this.pending - 1);
        this.maybeFireEnded();
      });
  }

  /**
   * Signal that the server has finished streaming TTS audio for this turn
   * (i.e. a `speech_end` event arrived). Once the chain drains *after* this
   * signal, onEnded fires.
   */
  markSpeechEnd(): void {
    this.speechEnded = true;
    this.maybeFireEnded();
  }

  /**
   * Abort playback immediately. Advances the playback generation so any chunks
   * already in the Promise chain become no-ops, and stops the currently-playing
   * source (if any). Safe to call multiple times. After cancel(), the player is
   * immediately ready to accept chunks for the NEXT turn — no separate reset()
   * needed.
   */
  cancel(): void {
    this.playbackGen += 1;
    this.armedForGen = null;
    if (this.currentSource) {
      try {
        this.currentSource.stop(0);
      } catch {
        /* ignore */
      }
      this.currentSource = null;
    }
    this.pending = 0;
    this.chain = Promise.resolve();
    this.speechEnded = false;
  }

  /**
   * @deprecated kept for API stability; cancel() alone is now sufficient
   * since it no longer leaves the player in a "refuses-all-pushes" state.
   */
  reset(): void {
    // no-op: cancel() already leaves the player accepting new chunks.
  }

  /** Fully dispose — closes AudioContext. */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.cancel();
    this.listeners = [];
    if (this.ctx && this.ctx.state !== "closed") {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
  }

  /** Register a listener fired once all queued chunks drain AFTER markSpeechEnd. */
  onEnded(listener: EndedListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private ensureContext(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
  }

  private maybeFireEnded(): void {
    if (this.disposed) return;
    // Only fire for the generation that was armed by a push(). Prevents a
    // stale speech_end landing right after cancel() from firing onEnded.
    if (this.armedForGen !== this.playbackGen) return;
    if (!this.speechEnded) return;
    if (this.pending > 0) return;
    // All chunks drained after server signalled end-of-speech. Fire once.
    this.speechEnded = false; // require another speech_end to re-arm
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("[TTSPlayer] listener threw:", err);
      }
    }
  }
}

function decodePCM16ToAudioBuffer(
  base64: string,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const frameCount = int16.length / numChannels;
  const audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = int16[i * numChannels + channel] / 32768;
    }
  }
  return audioBuffer;
}
