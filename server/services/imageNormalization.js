import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function detectJpegExifOrientationFromBuffer(buffer) {
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return 1;
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return 1;

    let offset = 2;
    while (offset < buffer.length - 4) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = (buffer[offset + 2] << 8) | buffer[offset + 3];
      if (length < 2) break;

      if (marker === 0xe1 && length > 6) {
        const exifHeader = buffer.slice(offset + 4, offset + 10).toString("ascii");
        if (exifHeader.startsWith("Exif")) {
          const tiffStart = offset + 10;
          const byteOrder = buffer.slice(tiffStart, tiffStart + 2).toString("ascii");
          const littleEndian = byteOrder === "II";
          const readUint16 = (o) =>
            littleEndian
              ? buffer.readUInt16LE(tiffStart + o)
              : buffer.readUInt16BE(tiffStart + o);
          const readUint32 = (o) =>
            littleEndian
              ? buffer.readUInt32LE(tiffStart + o)
              : buffer.readUInt32BE(tiffStart + o);

          const ifdOffset = readUint32(4);
          const entries = readUint16(ifdOffset);
          for (let i = 0; i < entries && i < 30; i += 1) {
            const entryOffset = ifdOffset + 2 + i * 12;
            const tag = readUint16(entryOffset);
            if (tag === 0x0112) {
              return readUint16(entryOffset + 8);
            }
          }
        }
      }

      offset += 2 + length;
    }
  } catch {
    return 1;
  }

  return 1;
}

function getRotationDegreesForOrientation(orientation) {
  if (orientation === 3) return 180;
  if (orientation === 6) return 90;
  if (orientation === 8) return 270;
  return 0;
}

export async function normalizeImageBufferForOcr(buffer, mimeType, fileName = "image.jpg") {
  const normalizedMimeType = String(mimeType || "").toLowerCase();
  if (normalizedMimeType !== "image/jpeg" && normalizedMimeType !== "image/jpg") {
    return {
      buffer,
      mimeType,
      wasAutoRotated: false,
      orientation: 1,
      rotationDegrees: 0,
    };
  }

  const orientation = detectJpegExifOrientationFromBuffer(buffer);
  const rotationDegrees = getRotationDegreesForOrientation(orientation);
  if (!rotationDegrees) {
    return {
      buffer,
      mimeType,
      wasAutoRotated: false,
      orientation,
      rotationDegrees: 0,
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-rotate-"));
  const inputPath = path.join(tempDir, `input-${path.basename(fileName) || "image"}.jpg`);
  const outputPath = path.join(tempDir, `output-${path.basename(fileName) || "image"}.jpg`);

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync("/usr/bin/sips", ["-r", String(rotationDegrees), inputPath, "--out", outputPath]);
    const rotatedBuffer = await fs.readFile(outputPath);
    return {
      buffer: rotatedBuffer,
      mimeType: "image/jpeg",
      wasAutoRotated: true,
      orientation,
      rotationDegrees,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
