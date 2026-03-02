/**
 * 文件预处理服务
 * 在 OCR 和分类之前执行：格式验证、图片旋转校正、SHA-256 指纹生成
 */

import crypto from "crypto";
import path from "path";

// 已知 MIME 类型对应的合法文件扩展名
const MIME_EXT_MAP = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/bmp": ["bmp"],
  "image/tiff": ["tif", "tiff"],
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov"],
  "video/x-msvideo": ["avi"],
  "video/webm": ["webm"],
  "video/x-matroska": ["mkv"],
  "text/plain": ["txt"],
  "text/csv": ["csv"],
  "text/html": ["html", "htm"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "application/x-rar-compressed": ["rar"],
  "application/vnd.rar": ["rar"],
  "message/rfc822": ["eml"],
  "application/vnd.ms-outlook": ["msg"],
};

// 文件类型魔术字节（用于格式完整性校验）
const MAGIC_BYTES = {
  pdf: { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }, // %PDF
  png: { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  jpg: { bytes: [0xff, 0xd8, 0xff], offset: 0 },
  gif: { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 }, // GIF8
  zip: { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 }, // PK..
  rar: { bytes: [0x52, 0x61, 0x72, 0x21], offset: 0 }, // Rar!
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * 验证 MIME 类型与文件扩展名是否一致
 */
function validateMimeExtConsistency(mimeType, fileName) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  if (!ext) return { valid: true }; // 无扩展名，跳过
  const allowedExts = MIME_EXT_MAP[mimeType];
  if (!allowedExts) return { valid: true }; // 未知 MIME 类型，跳过
  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      warning: `文件扩展名 .${ext} 与声明的类型 ${mimeType} 不一致，可能是伪造类型文件`,
    };
  }
  return { valid: true };
}

/**
 * 验证文件魔术字节（仅 Base64 数据可用时执行）
 */
function validateMagicBytes(base64Data, mimeType) {
  try {
    // 读取前 16 字节即可
    const buf = Buffer.from(base64Data.slice(0, 24), "base64");
    const ext = Object.keys(MAGIC_BYTES).find((key) => {
      const magic = MAGIC_BYTES[key];
      return magic.bytes.every((b, i) => buf[magic.offset + i] === b);
    });

    if (!ext) return { valid: true }; // 无法识别，跳过
    const mimeForExt = Object.entries(MIME_EXT_MAP).find(([, exts]) =>
      exts.includes(ext)
    )?.[0];
    if (mimeForExt && mimeType !== mimeForExt && !mimeType.includes(ext)) {
      return {
        valid: false,
        warning: `文件实际格式为 ${ext.toUpperCase()}，但声明的 MIME 类型为 ${mimeType}`,
      };
    }
    return { valid: true };
  } catch {
    return { valid: true }; // 解码失败，跳过魔术字节验证
  }
}

/**
 * 检测 JPEG EXIF 旋转角度
 * 返回旋转角度（0/90/180/270），需要调用方对图片进行旋转
 */
function detectJpegExifOrientation(base64Data) {
  try {
    const buf = Buffer.from(base64Data.slice(0, 512), "base64");
    // JPEG SOI marker
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return 0;

    let offset = 2;
    while (offset < buf.length - 4) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      const length = (buf[offset + 2] << 8) | buf[offset + 3];

      // APP1 marker (0xFFE1) contains EXIF data
      if (marker === 0xe1 && length > 6) {
        // Check for "Exif\0\0"
        const exifHeader = buf.slice(offset + 4, offset + 10).toString("ascii");
        if (exifHeader.startsWith("Exif")) {
          const tiffStart = offset + 10;
          // Check byte order (II = little-endian, MM = big-endian)
          const byteOrder = buf.slice(tiffStart, tiffStart + 2).toString("ascii");
          const le = byteOrder === "II";
          const readUint16 = (o) =>
            le ? buf.readUInt16LE(tiffStart + o) : buf.readUInt16BE(tiffStart + o);
          const readUint32 = (o) =>
            le ? buf.readUInt32LE(tiffStart + o) : buf.readUInt32BE(tiffStart + o);

          const ifdOffset = readUint32(4);
          const entries = readUint16(ifdOffset);
          for (let i = 0; i < entries && i < 30; i++) {
            const entryOffset = ifdOffset + 2 + i * 12;
            const tag = readUint16(entryOffset);
            if (tag === 0x0112) {
              // Orientation tag
              const orientation = readUint16(entryOffset + 8);
              // EXIF orientation to degrees
              const orientMap = { 1: 0, 3: 180, 6: 90, 8: 270 };
              return orientMap[orientation] || 0;
            }
          }
        }
      }
      offset += 2 + length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 计算 Base64 数据的 SHA-256 哈希
 */
function computeSHA256(base64Data) {
  const buf = Buffer.from(base64Data, "base64");
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * 估算文件字节大小（从 Base64 长度推算）
 */
function estimateByteSizeFromBase64(base64Data) {
  // Base64 编码率约 4/3，去除填充字符
  const paddingCount = (base64Data.match(/=/g) || []).length;
  return Math.floor((base64Data.length * 3) / 4) - paddingCount;
}

/**
 * 预处理单个文件
 *
 * @param {object} file - 文件信息
 * @param {string} file.fileName - 文件名
 * @param {string} file.mimeType - MIME 类型
 * @param {string} [file.base64Data] - Base64 编码的文件内容
 * @returns {object} 预处理结果
 */
export async function preprocessFile({ fileName, mimeType, base64Data }) {
  const warnings = [];
  const errors = [];
  let sha256 = null;
  let exifRotation = 0;
  let estimatedBytes = 0;

  // 1. MIME + 扩展名一致性校验
  const mimeCheck = validateMimeExtConsistency(mimeType, fileName);
  if (!mimeCheck.valid) {
    warnings.push(mimeCheck.warning);
  }

  if (base64Data) {
    // 2. 魔术字节校验
    const magicCheck = validateMagicBytes(base64Data, mimeType);
    if (!magicCheck.valid) {
      warnings.push(magicCheck.warning);
    }

    // 3. 文件大小估算
    estimatedBytes = estimateByteSizeFromBase64(base64Data);
    if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
      warnings.push(
        `文件较大（约 ${Math.round(estimatedBytes / 1024 / 1024)}MB），建议压缩后上传以提高处理速度`
      );
    }

    // 4. JPEG EXIF 旋转检测
    if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
      exifRotation = detectJpegExifOrientation(base64Data);
      if (exifRotation !== 0) {
        warnings.push(`检测到图片旋转 ${exifRotation}°（EXIF），已标记供 OCR 引擎处理`);
      }
    }

    // 5. SHA-256 指纹
    sha256 = computeSHA256(base64Data);
  }

  return {
    fileName,
    mimeType,
    sha256,
    exifRotation,
    estimatedBytes,
    warnings,
    errors,
    /** 文件是否通过预处理（有 error 时为 false，warning 不阻断） */
    passed: errors.length === 0,
  };
}

/**
 * 批量预处理文件列表
 *
 * @param {Array} files - 文件信息数组
 * @returns {Array} 预处理结果数组
 */
export async function preprocessFiles(files) {
  return Promise.all(files.map((f) => preprocessFile(f)));
}

/**
 * 判断文件是否为容器格式（压缩包/邮件），需要解包
 */
export function isContainerFormat(mimeType, fileName) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  const containerMimes = [
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/vnd.rar",
    "message/rfc822",
    "application/vnd.ms-outlook",
  ];
  const containerExts = ["zip", "rar", "eml", "msg"];
  return containerMimes.includes(mimeType) || containerExts.includes(ext);
}

/**
 * 获取容器类型
 */
export function getContainerType(mimeType, fileName) {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  if (ext === "zip" || mimeType.includes("zip")) return "zip";
  if (ext === "rar" || mimeType.includes("rar")) return "rar";
  if (ext === "eml" || mimeType === "message/rfc822") return "eml";
  if (ext === "msg" || mimeType === "application/vnd.ms-outlook") return "msg";
  return null;
}
