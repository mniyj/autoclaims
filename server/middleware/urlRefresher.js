/**
 * URL刷新中间件
 * 检测签名URL是否即将过期，自动刷新
 */

import OSS from 'ali-oss';

// URL缓存
const urlCache = new Map();

/**
 * 解析签名URL的过期时间
 * @param {string} url - 签名URL
 * @returns {Date|null} 过期时间
 */
function parseUrlExpiration(url) {
  try {
    const urlObj = new URL(url);
    const expires = urlObj.searchParams.get('Expires');
    if (expires) {
      return new Date(parseInt(expires) * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 检查URL是否即将过期（默认5分钟内）
 * @param {string} url - 签名URL
 * @param {number} thresholdMinutes - 过期阈值（分钟）
 * @returns {boolean} 是否即将过期
 */
export function isUrlExpiringSoon(url, thresholdMinutes = 5) {
  const expiration = parseUrlExpiration(url);
  if (!expiration) return true;
  
  const thresholdMs = thresholdMinutes * 60 * 1000;
  return (expiration.getTime() - Date.now()) < thresholdMs;
}

/**
 * 生成新的签名URL
 * @param {string} objectKey - OSS对象Key
 * @param {number} expires - 过期时间（秒）
 * @returns {Promise<string>} 新的签名URL
 */
export async function generateSignedUrl(objectKey, expires = 3600) {
  const region = process.env.ALIYUN_OSS_REGION || 'oss-cn-beijing';
  const bucket = process.env.ALIYUN_OSS_BUCKET;
  const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET;

  if (!bucket || !accessKeyId || !accessKeySecret) {
    throw new Error('OSS credentials not configured');
  }

  const client = new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
  });

  const signedUrl = client.signatureUrl(objectKey, { expires });
  
  // 缓存URL
  urlCache.set(objectKey, {
    url: signedUrl,
    expiresAt: Date.now() + expires * 1000,
  });
  
  return signedUrl;
}

/**
 * 确保URL有效（如果即将过期则刷新）
 * @param {string} currentUrl - 当前URL
 * @param {string} objectKey - OSS对象Key
 * @param {number} expires - 过期时间（秒）
 * @returns {Promise<string>} 有效的URL
 */
export async function ensureFreshSignedUrl(currentUrl, objectKey, expires = 3600) {
  // 检查缓存
  const cached = urlCache.get(objectKey);
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.url;
  }
  
  // 检查当前URL是否即将过期
  if (currentUrl && !isUrlExpiringSoon(currentUrl, 5)) {
    return currentUrl;
  }
  
  // 生成新URL
  console.log(`[URLRefresher] Refreshing signed URL for ${objectKey}`);
  const newUrl = await generateSignedUrl(objectKey, expires);
  return newUrl;
}

/**
 * 批量刷新签名URL
 * @param {string[]} objectKeys - OSS对象Key数组
 * @param {number} expires - 过期时间（秒）
 * @returns {Promise<Record<string, string>>} Key到URL的映射
 */
export async function refreshSignedUrls(objectKeys, expires = 3600) {
  const results = {};
  
  for (const key of objectKeys) {
    try {
      results[key] = await ensureFreshSignedUrl(null, key, expires);
    } catch (error) {
      console.error(`[URLRefresher] Failed to refresh URL for ${key}:`, error);
      results[key] = null;
    }
  }
  
  return results;
}

/**
 * 清除URL缓存
 * @param {string} objectKey - 可选，指定Key清除，否则清除全部
 */
export function clearUrlCache(objectKey) {
  if (objectKey) {
    urlCache.delete(objectKey);
  } else {
    urlCache.clear();
  }
}

/**
 * Express中间件：确保请求中的URL有效
 * 可在路由中使用
 */
export function urlRefreshMiddleware(options = {}) {
  const { thresholdMinutes = 5, expires = 3600 } = options;
  
  return async (req, res, next) => {
    req.ensureFreshUrl = async (currentUrl, objectKey) => {
      return ensureFreshSignedUrl(currentUrl, objectKey, expires);
    };
    
    req.refreshUrls = async (objectKeys) => {
      return refreshSignedUrls(objectKeys, expires);
    };
    
    next();
  };
}
