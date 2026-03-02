/**
 * 重复文件检测服务
 *
 * Level 1 - 精确匹配：SHA-256 哈希完全相同
 * Level 2 - 相似检测：
 *   - 图片类：感知哈希（pHash）汉明距离
 *   - 文档类：SimHash 文本相似度
 */

// pHash 相似度阈值：汉明距离 <= 10 认为是同一文件的不同扫描（相似度 ~84%）
const PHASH_HAMMING_THRESHOLD = 10;
// 文本 SimHash 相似度阈值：>= 0.85
const SIMHASH_THRESHOLD = 0.85;

/**
 * 计算两个 64-bit pHash 的汉明距离
 * pHash 以十六进制字符串存储，如 "a3b4c5d6e7f80012"
 */
function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64;
  let distance = 0;
  for (let i = 0; i < hash1.length; i += 2) {
    const byte1 = parseInt(hash1.slice(i, i + 2), 16);
    const byte2 = parseInt(hash2.slice(i, i + 2), 16);
    let xor = byte1 ^ byte2;
    // 计算位差异数（Brian Kernighan 算法）
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/**
 * 将汉明距离转换为相似度 [0, 1]
 * 64-bit hash：最大距离 64
 */
function hammingToSimilarity(distance) {
  return 1 - distance / 64;
}

/**
 * 简单 SimHash 实现（用于文本相似度）
 * 将文本映射为 64-bit 签名
 */
function computeSimHash(text) {
  if (!text || text.length < 10) return null;

  // 提取 k-gram（k=4），计算每个 gram 的哈希
  const k = 4;
  const v = new Array(64).fill(0);

  for (let i = 0; i <= text.length - k; i++) {
    const gram = text.slice(i, i + k);
    // 简单哈希函数：djb2 变体
    let h = 5381;
    for (let j = 0; j < gram.length; j++) {
      h = ((h << 5) + h) ^ gram.charCodeAt(j);
      h = h >>> 0; // 无符号 32-bit
    }
    // 将哈希的每一位映射到 v
    for (let b = 0; b < 64; b++) {
      const bit = (b < 32)
        ? ((h >>> b) & 1)
        : ((h >>> (b - 32)) & 1); // 复用低 32 位填充高 32 位
      v[b] += bit ? 1 : -1;
    }
  }

  // 生成最终签名：v[i] > 0 -> bit=1, else bit=0
  let signature = "";
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) {
      nibble |= (v[i + j] > 0 ? 1 : 0) << j;
    }
    signature += nibble.toString(16);
  }
  return signature;
}

/**
 * 计算两个 SimHash 签名的相似度
 */
function simHashSimilarity(sig1, sig2) {
  const distance = hammingDistance(sig1, sig2);
  return hammingToSimilarity(distance);
}

/**
 * 对已有文件列表执行精确去重检测（SHA-256）
 *
 * @param {string} sha256 - 待检测文件的 SHA-256
 * @param {Array} existingDocuments - 案件中已有的文件列表，每项需有 {documentId, fileName, sha256, batchId, importedAt}
 * @returns {object|null} 若发现精确重复，返回重复信息；否则返回 null
 */
export function checkExactDuplicate(sha256, existingDocuments) {
  if (!sha256) return null;
  const found = existingDocuments.find(
    (doc) => doc.sha256 && doc.sha256 === sha256 && !doc.superseded
  );
  if (!found) return null;
  return {
    isDuplicate: true,
    duplicateType: "exact",
    similarity: 1,
    existingDocumentId: found.documentId,
    existingFileName: found.fileName,
    existingBatchId: found.batchId,
    existingImportedAt: found.importedAt,
    message: `该文件与"${found.fileName}"完全相同（已于 ${
      found.importedAt
        ? new Date(found.importedAt).toLocaleString("zh-CN")
        : "之前"
    } 导入），建议跳过`,
  };
}

/**
 * 对已有图片文件执行感知哈希相似度检测
 *
 * @param {string} pHash - 待检测文件的感知哈希
 * @param {Array} existingDocuments - 案件中已有的图片文件
 * @returns {object|null} 若发现相似文件，返回信息；否则返回 null
 */
export function checkImageSimilarity(pHash, existingDocuments) {
  if (!pHash) return null;

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const doc of existingDocuments) {
    if (!doc.pHash || doc.superseded) continue;
    const distance = hammingDistance(pHash, doc.pHash);
    if (distance <= PHASH_HAMMING_THRESHOLD) {
      const similarity = hammingToSimilarity(distance);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = doc;
      }
    }
  }

  if (!bestMatch) return null;
  return {
    isDuplicate: true,
    duplicateType: "similar",
    similarity: bestSimilarity,
    existingDocumentId: bestMatch.documentId,
    existingFileName: bestMatch.fileName,
    existingBatchId: bestMatch.batchId,
    existingImportedAt: bestMatch.importedAt,
    message: `与"${bestMatch.fileName}"高度相似（相似度 ${Math.round(bestSimilarity * 100)}%），可能是同一张单据的不同扫描`,
  };
}

/**
 * 对已有文档文件执行文本 SimHash 相似度检测
 *
 * @param {string} extractedText - 待检测文件的提取文本
 * @param {Array} existingDocuments - 案件中已有的文件，需含 extractedText 字段
 * @returns {object|null}
 */
export function checkTextSimilarity(extractedText, existingDocuments) {
  if (!extractedText || extractedText.length < 50) return null;

  const newSig = computeSimHash(extractedText);
  if (!newSig) return null;

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const doc of existingDocuments) {
    if (!doc.extractedText || doc.superseded) continue;
    const existSig = computeSimHash(doc.extractedText);
    if (!existSig) continue;
    const similarity = simHashSimilarity(newSig, existSig);
    if (similarity >= SIMHASH_THRESHOLD && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = doc;
    }
  }

  if (!bestMatch) return null;
  return {
    isDuplicate: true,
    duplicateType: "similar",
    similarity: bestSimilarity,
    existingDocumentId: bestMatch.documentId,
    existingFileName: bestMatch.fileName,
    existingBatchId: bestMatch.batchId,
    existingImportedAt: bestMatch.importedAt,
    message: `与"${bestMatch.fileName}"文本内容高度相似（相似度 ${Math.round(bestSimilarity * 100)}%），可能是同一份文档`,
  };
}

/**
 * 综合去重检测
 * 先执行 SHA-256 精确匹配，再按文件类型执行相似度检测
 *
 * @param {object} newFile - 新文件信息
 * @param {string} newFile.sha256 - SHA-256 哈希
 * @param {string} [newFile.pHash] - 感知哈希（图片类）
 * @param {string} [newFile.extractedText] - 提取文本（文档类）
 * @param {string} newFile.mimeType - MIME 类型
 * @param {Array} existingDocuments - 案件中已有的文件列表
 * @returns {object} { isDuplicate, duplicateType, similarity, ... }
 */
export function checkDuplicate(newFile, existingDocuments) {
  if (!existingDocuments || existingDocuments.length === 0) {
    return { isDuplicate: false };
  }

  // Level 1: SHA-256 精确匹配
  if (newFile.sha256) {
    const exactResult = checkExactDuplicate(newFile.sha256, existingDocuments);
    if (exactResult) return exactResult;
  }

  // Level 2a: 图片类 pHash 相似度
  const isImage = newFile.mimeType?.startsWith("image/");
  if (isImage && newFile.pHash) {
    const imgResult = checkImageSimilarity(newFile.pHash, existingDocuments);
    if (imgResult) return imgResult;
  }

  // Level 2b: 文档类文本 SimHash 相似度
  if (!isImage && newFile.extractedText) {
    const textResult = checkTextSimilarity(newFile.extractedText, existingDocuments);
    if (textResult) return textResult;
  }

  return { isDuplicate: false };
}

/**
 * 批量去重检测
 * 逐文件检测，后续文件也会与前面已通过的文件对比（防止同批次内重复）
 *
 * @param {Array} newFiles - 新上传的文件列表
 * @param {Array} existingDocuments - 案件中已有的文件列表
 * @returns {Array} 每个文件的去重检测结果
 */
export function checkDuplicatesBatch(newFiles, existingDocuments) {
  const results = [];
  const checkedSoFar = [...(existingDocuments || [])];

  for (const file of newFiles) {
    const result = checkDuplicate(file, checkedSoFar);
    results.push({ ...result, fileName: file.fileName });

    // 非精确重复文件加入已检测列表（防止同批次内后续文件与它重复）
    if (!result.isDuplicate) {
      checkedSoFar.push(file);
    }
  }

  return results;
}
