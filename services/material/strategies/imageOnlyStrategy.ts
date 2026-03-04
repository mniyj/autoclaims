import type { MaterialCategory } from '../../types';
import { ProcessingStrategy, StrategyContext, StrategyResult } from './baseStrategy';

export class ImageOnlyStrategy implements ProcessingStrategy {
  public readonly name = 'image_only';

  async process(
    fileSource: File | Blob | string,
    context: StrategyContext
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const stepTimings: StrategyResult['stepTimings'] = [
      {
        step: 'OCR',
        label: 'Extract text from image',
        startTime,
      },
    ];

    try {
      const ocrText = await this.performOcr(fileSource);
      const duration = Date.now() - startTime;
      return {
        success: true,
        extractedData: { ocrText },
        rawOcrText: ocrText,
        duration,
        stepTimings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: String(error instanceof Error ? error.message : error),
        duration,
        stepTimings,
      };
    }
  }

  supports(_materialId: string, _category?: MaterialCategory): boolean {
    return true;
  }

  private async performOcr(fileSource: File | Blob | string): Promise<string> {
    const dataUrl = await this.toDataURL(fileSource);

    // 1) Try lightweight client: tesseract.js (dynamic import)
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = createWorker({ logger: () => {} });
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data } = await worker.recognize(dataUrl);
      await worker.terminate();
      return data?.text ?? '';
    } catch {
      // proceed to fallbacks below
    }

    // 2) Gemini Vision OCR if API key is available (best-effort)
    try {
      const apiKey = (process.env.GEMINI_API_KEY as string) || '';
      if (apiKey) {
        const resp = await fetch('https://gemini-vision.example/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ image: dataUrl }),
        });
        if (resp.ok) {
          const json = await resp.json();
          return typeof json?.text === 'string' ? json.text : '';
        }
      }
    } catch {
      // ignore and continue to next fallback
    }

    // 3) PaddleOCR local server fallback (if available)
    try {
      const resp = await fetch('http://localhost:5000/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (resp.ok) {
        const json = await resp.json();
        return typeof json?.text === 'string' ? json.text : '';
      }
    } catch {
      // ignore
    }

    // 4) Final fallback: empty string (fast path when OCR unavailable)
    return '';
  }

  /**
   * Convert input image to data URL (base64).
   */
  private async toDataURL(fileSource: File | Blob | string): Promise<string> {
    // If already a data URL, return as is
    if (typeof fileSource === 'string' && fileSource.startsWith('data:')) {
      return fileSource;
    }

    // If string URL, fetch and convert to data URL
    if (typeof fileSource === 'string') {
      const resp = await fetch(fileSource);
      if (!resp.ok) {
        throw new Error(`Failed to fetch image: ${resp.status}`);
      }
      const contentType = resp.headers.get('content-type') || 'image/jpeg';
      const arrBuffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(arrBuffer);
      const base64 =
        typeof Buffer !== 'undefined'
          ? Buffer.from(bytes).toString('base64')
          : (globalThis as any).btoa(String.fromCharCode(...bytes));
      return `data:${contentType};base64,${base64}`;
    }

    // If File/Blob, read as DataURL using FileReader
    const blob = fileSource as Blob;
    return await new Promise<string>((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      } catch (e) {
        reject(e as any);
      }
    });
  }
}

export default ImageOnlyStrategy;
