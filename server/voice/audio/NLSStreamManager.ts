import type { AliyunNLSService } from "../services/AliyunNLS.js";

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
}

export interface NLSManagerOptions {
  /**
   * Called when NLS emits a result (interim or final).
   * Generation-guarded internally — callbacks from stale streams are suppressed.
   */
  onResult: (result: TranscriptionResult) => void;
  /**
   * Called when the current NLS stream errors out. Manager has already
   * internally closed the failed stream; caller decides whether to re-open.
   */
  onError: (error: Error) => void;
  /** Called each time exponential backoff fires. For telemetry. */
  onReconnecting?: (attempt: number, delayMs: number) => void;
  /** Called when a fresh NLS stream is ready to receive audio. */
  onReady?: () => void;
}

interface ActiveStream {
  generation: number;
  sendAudio: (data: Buffer) => void;
  close: () => void;
}

/** Max bytes buffered while NLS is starting up. 5s @ 16kHz mono PCM16 = 160_000 bytes. */
const MAX_BUFFER_BYTES = 160_000;

/** Exponential backoff schedule for NLS reconnect attempts (ms). */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Phase 2: silence-frame keepalive. Aliyun IDLE_TIMEOUT is ~10s if the stream
 * receives no audio, so we send a small silent PCM frame every 400ms (25×
 * the safety floor). 400ms keeps packet rate modest (~2.5 pps) while leaving
 * plenty of headroom vs. timeout.
 */
const KEEPALIVE_INTERVAL_MS = 400;
/** 200ms of silence @ 16kHz mono PCM16 = 3200 samples = 6400 bytes. */
const KEEPALIVE_FRAME = Buffer.alloc(6400, 0);

/**
 * Owns the NLS transcription stream lifecycle for a single voice session.
 *
 * Responsibilities:
 *  - open / close the underlying Aliyun NLS WebSocket on demand
 *  - buffer audio (bounded) while the stream is starting
 *  - discard callbacks from superseded (stale) streams via generation counter
 *  - exponential-backoff reconnect on failure
 *
 * Phase 1: one NLS stream per LISTENING period. When the session transitions
 * out of LISTENING (into THINKING/SPEAKING), call stop() to close the stream;
 * when returning to LISTENING, call start() again. Phase 2 will add keepalive
 * frames so the stream stays open across the whole session.
 */
export class NLSStreamManager {
  private nlsService: AliyunNLSService | null;
  private options: NLSManagerOptions;

  private active: ActiveStream | null = null;
  private generation = 0;
  private starting = false;
  private disposed = false;

  private pendingBuffer: Buffer[] = [];
  private pendingBufferBytes = 0;

  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private keepaliveEnabled = false;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private keepaliveCount = 0;
  private lastSendWasRealAudio = 0; // timestamp ms

  constructor(nlsService: AliyunNLSService | null, options: NLSManagerOptions) {
    this.nlsService = nlsService;
    this.options = options;
  }

  /** Whether a stream is currently open and ready to accept audio. */
  isReady(): boolean {
    return this.active !== null && !this.starting;
  }

  /**
   * Open an NLS stream. Idempotent: if one is already open or starting, this is a no-op.
   * Returns a promise that resolves when the stream is ready (or rejects on failure).
   */
  async start(): Promise<void> {
    if (this.disposed) throw new Error("NLSStreamManager disposed");
    if (this.active) return;
    if (this.starting) {
      // Another start() is already in flight; wait for it.
      await this.waitUntilReady();
      return;
    }
    if (!this.nlsService) {
      // Mock mode: emit a single result and bail. Matches existing VoicePipeline
      // mock behavior so dev environments without Aliyun creds still function.
      this.options.onResult({
        text: "开发环境未配置阿里云语音识别，当前使用模拟识别。",
        isFinal: false,
      });
      return;
    }

    this.starting = true;
    const myGeneration = ++this.generation;
    console.log(`[NLSStreamManager] starting stream (gen=${myGeneration})`);

    try {
      const stream = await this.nlsService.createTranscriptionStream(
        (result) => {
          if (myGeneration !== this.generation) return; // stale
          if (!this.disposed) this.options.onResult(result);
        },
        (error) => {
          if (myGeneration !== this.generation) return; // stale
          this.handleStreamError(error, myGeneration);
        },
      );

      if (this.disposed || myGeneration !== this.generation) {
        // Disposed or superseded while we were awaiting. Close the stream we just got.
        console.log(
          `[NLSStreamManager] stream gen=${myGeneration} superseded before ready, closing`,
        );
        stream.close();
        return;
      }

      this.active = { generation: myGeneration, sendAudio: stream.sendAudio, close: stream.close };
      this.reconnectAttempt = 0; // success → reset backoff

      // Flush any audio that arrived while we were starting.
      if (this.pendingBuffer.length > 0) {
        console.log(
          `[NLSStreamManager] flushing ${this.pendingBuffer.length} buffered chunks (${this.pendingBufferBytes} bytes)`,
        );
        for (const chunk of this.pendingBuffer) {
          stream.sendAudio(chunk);
        }
        this.pendingBuffer = [];
        this.pendingBufferBytes = 0;
      }

      console.log(`[NLSStreamManager] stream ready (gen=${myGeneration})`);

      // Start the silence-frame keepalive so Aliyun doesn't IDLE_TIMEOUT us.
      if (this.keepaliveEnabled) {
        this.startKeepaliveTimer();
      }

      this.options.onReady?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[NLSStreamManager] start failed (gen=${myGeneration}):`, err.message);
      if (myGeneration === this.generation) {
        // Let caller know; they can decide whether to retry.
        this.options.onError(err);
      }
      throw err;
    } finally {
      this.starting = false;
    }
  }

  /**
   * Close the current NLS stream. Idempotent. Audio pushed in after stop()
   * is buffered (bounded) until the next start().
   */
  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepaliveTimer();
    if (this.active) {
      console.log(`[NLSStreamManager] stopping stream (gen=${this.active.generation})`);
      try {
        this.active.close();
      } catch (err) {
        console.warn("[NLSStreamManager] stream close threw:", err);
      }
      this.active = null;
    }
    // Bump generation so any in-flight start() aborts its own setup.
    this.generation++;
  }

  /**
   * Enable silence-frame keepalive. Call once per manager lifetime (e.g. right
   * after construction). Keepalive actually starts running once the stream is
   * ready and is paused across reconnects until the new stream comes up.
   */
  enableKeepalive(): void {
    this.keepaliveEnabled = true;
    if (this.active && !this.keepaliveTimer) {
      this.startKeepaliveTimer();
    }
  }

  disableKeepalive(): void {
    this.keepaliveEnabled = false;
    this.stopKeepaliveTimer();
  }

  /**
   * Send an audio chunk to the NLS stream. If the stream is not ready yet
   * (still starting), buffers the chunk up to MAX_BUFFER_BYTES (drops oldest on overflow).
   */
  sendAudio(data: Buffer): void {
    if (this.disposed) return;

    if (this.active) {
      this.lastSendWasRealAudio = Date.now();
      try {
        this.active.sendAudio(data);
      } catch (err) {
        console.warn("[NLSStreamManager] sendAudio threw:", err);
      }
      return;
    }

    if (!this.starting) {
      // Manager is stopped, not starting. Drop the chunk silently.
      return;
    }

    this.pendingBuffer.push(data);
    this.pendingBufferBytes += data.length;
    while (this.pendingBufferBytes > MAX_BUFFER_BYTES && this.pendingBuffer.length > 1) {
      const dropped = this.pendingBuffer.shift()!;
      this.pendingBufferBytes -= dropped.length;
      console.warn(
        `[NLSStreamManager] pending buffer full, dropped ${dropped.length} bytes of oldest audio`,
      );
    }
  }

  /** Dispose permanently. Closes current stream and cancels any pending reconnect. */
  dispose(): void {
    this.disposed = true;
    this.keepaliveEnabled = false;
    this.stop();
    this.pendingBuffer = [];
    this.pendingBufferBytes = 0;
  }

  // ----- keepalive internals -----

  private startKeepaliveTimer(): void {
    if (this.keepaliveTimer || this.disposed) return;
    this.keepaliveTimer = setInterval(() => {
      if (!this.active || this.disposed) return;
      // If the caller just sent real audio within the last interval, skip this
      // tick — the real audio already keeps the stream warm and we don't want
      // to interleave zero bytes into the middle of a sentence.
      if (Date.now() - this.lastSendWasRealAudio < KEEPALIVE_INTERVAL_MS) return;
      try {
        this.active.sendAudio(KEEPALIVE_FRAME);
        this.keepaliveCount += 1;
        // Sample one tick per minute so the log confirms the timer is alive
        // without spamming.
        if (this.keepaliveCount === 1 || this.keepaliveCount % 150 === 0) {
          console.log(
            `[NLSStreamManager] keepalive tick #${this.keepaliveCount} gen=${this.active.generation}`,
          );
        }
      } catch (err) {
        console.warn("[NLSStreamManager] keepalive sendAudio threw:", err);
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepaliveTimer(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  // -------- internals --------

  private handleStreamError(error: Error, generation: number): void {
    if (generation !== this.generation) return; // stale
    console.error(
      `[NLSStreamManager] stream error (gen=${generation}):`,
      error.message,
    );
    // Close the failed stream; invalidate generation.
    this.active = null;
    this.generation++;
    this.stopKeepaliveTimer();

    if (this.disposed) return;

    // Propagate to caller first so they see the failure immediately.
    this.options.onError(error);

    // Then schedule a reconnect with backoff. Caller can still call stop() to cancel.
    const attempt = this.reconnectAttempt;
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
    this.reconnectAttempt++;
    this.options.onReconnecting?.(attempt + 1, delay);
    console.log(
      `[NLSStreamManager] scheduling reconnect in ${delay}ms (attempt ${attempt + 1})`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.disposed) return;
      this.start().catch((err) => {
        console.error("[NLSStreamManager] reconnect failed:", err);
      });
    }, delay);
  }

  private async waitUntilReady(): Promise<void> {
    const start = Date.now();
    while (this.starting && !this.disposed) {
      await new Promise((r) => setTimeout(r, 50));
      if (Date.now() - start > 30_000) {
        throw new Error("NLSStreamManager: waitUntilReady timed out");
      }
    }
  }
}
