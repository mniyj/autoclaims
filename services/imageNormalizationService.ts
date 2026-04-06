const DEFAULT_MIME_TYPE = 'image/jpeg';

type NormalizedImagePayload = {
  base64Data: string;
  mimeType: string;
  wasAutoRotated: boolean;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const normalizeMimeType = (mimeType?: string): string => {
  const normalized = String(mimeType || '').trim().toLowerCase();
  return normalized || DEFAULT_MIME_TYPE;
};

const getMimeTypeFromDataUrl = (value: string): string | null => {
  const match = value.match(/^data:([^;]+);base64,/i);
  return match?.[1] ? normalizeMimeType(match[1]) : null;
};

const readUint16 = (view: DataView, offset: number, littleEndian: boolean) =>
  littleEndian ? view.getUint16(offset, true) : view.getUint16(offset, false);

const readUint32 = (view: DataView, offset: number, littleEndian: boolean) =>
  littleEndian ? view.getUint32(offset, true) : view.getUint32(offset, false);

const getJpegExifOrientation = (arrayBuffer: ArrayBuffer): number => {
  try {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
      return 1;
    }

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) {
        break;
      }

      const marker = view.getUint8(offset + 1);
      const segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2) {
        break;
      }

      if (marker === 0xe1 && offset + 10 <= view.byteLength) {
        const exifHeader =
          String.fromCharCode(view.getUint8(offset + 4)) +
          String.fromCharCode(view.getUint8(offset + 5)) +
          String.fromCharCode(view.getUint8(offset + 6)) +
          String.fromCharCode(view.getUint8(offset + 7));

        if (exifHeader === 'Exif') {
          const tiffOffset = offset + 10;
          if (tiffOffset + 8 > view.byteLength) {
            return 1;
          }

          const byteOrder = String.fromCharCode(
            view.getUint8(tiffOffset),
            view.getUint8(tiffOffset + 1),
          );
          const littleEndian = byteOrder === 'II';
          const firstIfdOffset = readUint32(view, tiffOffset + 4, littleEndian);
          const ifdStart = tiffOffset + firstIfdOffset;

          if (ifdStart + 2 > view.byteLength) {
            return 1;
          }

          const entryCount = readUint16(view, ifdStart, littleEndian);
          for (let i = 0; i < entryCount; i += 1) {
            const entryOffset = ifdStart + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) {
              break;
            }

            const tag = readUint16(view, entryOffset, littleEndian);
            if (tag === 0x0112) {
              return readUint16(view, entryOffset + 8, littleEndian);
            }
          }
        }
      }

      offset += 2 + segmentLength;
    }
  } catch {
    return 1;
  }

  return 1;
};

const loadImageBitmap = async (blob: Blob): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob, { imageOrientation: 'none' });
  }

  const dataUrl = await blobToDataUrl(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = dataUrl;
  });
};

const renderRotatedBlob = async (
  blob: Blob,
  orientation: number,
  mimeType: string,
): Promise<Blob> => {
  const source = await loadImageBitmap(blob);
  const sourceWidth = 'width' in source ? source.width : 0;
  const sourceHeight = 'height' in source ? source.height : 0;
  const canvas = document.createElement('canvas');
  const rotateQuarterTurn = orientation === 6 || orientation === 8;

  canvas.width = rotateQuarterTurn ? sourceHeight : sourceWidth;
  canvas.height = rotateQuarterTurn ? sourceWidth : sourceHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }

  switch (orientation) {
    case 3:
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
      break;
    case 6:
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 8:
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
      break;
    default:
      break;
  }

  ctx.drawImage(source as CanvasImageSource, 0, 0, sourceWidth, sourceHeight);

  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }
        reject(new Error('Failed to export rotated image'));
      },
      mimeType,
      mimeType === 'image/png' ? undefined : 0.92,
    );
  });
};

const maybeAutoRotateBlob = async (blob: Blob): Promise<{ blob: Blob; mimeType: string; wasAutoRotated: boolean }> => {
  const mimeType = normalizeMimeType(blob.type);
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/jpg') {
    return { blob, mimeType, wasAutoRotated: false };
  }

  const orientation = getJpegExifOrientation(await blob.arrayBuffer());
  if (![3, 6, 8].includes(orientation)) {
    return { blob, mimeType, wasAutoRotated: false };
  }

  const rotatedBlob = await renderRotatedBlob(blob, orientation, 'image/jpeg');
  return { blob: rotatedBlob, mimeType: 'image/jpeg', wasAutoRotated: true };
};

const resolveImageBlob = async (imageSource: string | Blob): Promise<Blob> => {
  if (typeof imageSource !== 'string') {
    return imageSource;
  }

  if (imageSource.startsWith('http://') || imageSource.startsWith('https://') || imageSource.startsWith('data:')) {
    const response = await fetch(imageSource);
    return response.blob();
  }

  return dataUrlToBlob(`data:${DEFAULT_MIME_TYPE};base64,${imageSource}`);
};

export const normalizeImageForOcr = async (
  imageSource: string | Blob,
): Promise<NormalizedImagePayload> => {
  const blob = await resolveImageBlob(imageSource);
  const { blob: normalizedBlob, mimeType, wasAutoRotated } = await maybeAutoRotateBlob(blob);
  const dataUrl = await blobToDataUrl(normalizedBlob);
  const normalizedMimeType = getMimeTypeFromDataUrl(dataUrl) || mimeType || normalizeMimeType(blob.type);

  return {
    base64Data: dataUrl.split(',')[1] || '',
    mimeType: normalizedMimeType,
    wasAutoRotated,
  };
};

export const normalizeImageToDataUrl = async (imageSource: string | Blob): Promise<string> => {
  const { base64Data, mimeType } = await normalizeImageForOcr(imageSource);
  return `data:${mimeType};base64,${base64Data}`;
};
