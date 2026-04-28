import type { AliyunTTSService } from "../services/AliyunTTS.js";

export interface TTSSynthesizeOptions {
  /** AbortSignal. When aborted, forwarded chunks stop immediately. */
  signal?: AbortSignal;
  /** Override timeout (ms). Default 60_000. */
  timeoutMs?: number;
}

export interface TTSSynthesizeResult {
  chunks: number;
  bytes: number;
  aborted: boolean;
  timedOut: boolean;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * One-shot TTS synthesis per utterance, with abort + timeout support.
 *
 * The underlying AliyunTTSService.synthesize() resolves only on completion;
 * we cannot cleanly cancel the upstream WebSocket from here, so abort works
 * by (a) stopping forwarding of incoming chunks to the caller's onChunk, and
 * (b) resolving the promise immediately with `aborted: true`. The upstream
 * synthesis still finishes in the background and its result is discarded.
 * Timeout works the same way: after timeoutMs, we resolve with `timedOut: true`.
 */
export class TTSStreamController {
  private ttsService: AliyunTTSService | null;

  constructor(ttsService: AliyunTTSService | null) {
    this.ttsService = ttsService;
  }

  async synthesize(
    text: string,
    onChunk: (chunk: Buffer) => void,
    options: TTSSynthesizeOptions = {},
  ): Promise<TTSSynthesizeResult> {
    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (!this.ttsService) {
      console.log(`[TTSStreamController] TTS (mock): ${text}`);
      return { chunks: 0, bytes: 0, aborted: false, timedOut: false, durationMs: 0 };
    }

    let chunks = 0;
    let bytes = 0;
    let aborted = false;
    let timedOut = false;
    let settled = false;

    const abortSignal = options.signal;
    if (abortSignal?.aborted) {
      return { chunks: 0, bytes: 0, aborted: true, timedOut: false, durationMs: 0 };
    }

    return new Promise<TTSSynthesizeResult>((resolve) => {
      const finish = (reason: "complete" | "abort" | "timeout", error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        abortSignal?.removeEventListener("abort", onAbort);
        const result: TTSSynthesizeResult = {
          chunks,
          bytes,
          aborted: reason === "abort",
          timedOut: reason === "timeout",
          durationMs: Date.now() - startedAt,
        };
        if (error) {
          console.warn(
            `[TTSStreamController] synthesis ${reason} after ${result.durationMs}ms:`,
            error.message,
          );
        } else {
          console.log(
            `[TTSStreamController] synthesis ${reason}: chunks=${chunks}, bytes=${bytes}, ${result.durationMs}ms`,
          );
        }
        resolve(result);
      };

      const onAbort = () => {
        aborted = true;
        finish("abort");
      };
      abortSignal?.addEventListener("abort", onAbort);

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        finish("timeout");
      }, timeoutMs);

      // The upstream synthesis may continue for a while after we abort/timeout;
      // we just stop forwarding chunks. It cleans itself up when its own
      // WebSocket closes.
      this.ttsService!
        .synthesize(text, (audioChunk) => {
          if (settled) return; // aborted or timed out — drop remaining chunks
          chunks += 1;
          bytes += audioChunk.length;
          try {
            onChunk(audioChunk);
          } catch (err) {
            console.error("[TTSStreamController] onChunk threw:", err);
          }
        })
        .then(() => {
          finish("complete");
        })
        .catch((err) => {
          const e = err instanceof Error ? err : new Error(String(err));
          finish("complete", e);
        });
    });
  }
}
