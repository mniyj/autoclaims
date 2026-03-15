export interface OSSUploadResult {
    url: string;
    objectKey: string;
}

export const uploadToOSS = async (file: File, pathPrefix = 'claims'): Promise<OSSUploadResult> => {
    console.log('[OSS] Starting proxy upload for file:', file.name);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1];
                const fileName = `${pathPrefix}/${Date.now()}-${file.name}`;
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName,
                        fileType: file.type,
                        base64
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Server upload failed');
                }

                const result = await response.json();
                console.log('[OSS] Proxy upload successful:', result.url);
                resolve({
                    url: result.url,
                    objectKey: result.objectKey || fileName,
                });
            } catch (e) {
                console.error('[OSS] Proxy upload failed:', e);
                reject(e);
            }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsDataURL(file);
    });
};

export const uploadBase64ToOSS = async (base64: string, mimeType: string, pathPrefix = 'claims'): Promise<OSSUploadResult> => {
    console.log('[OSS] Starting proxy upload for base64');

    try {
        const fileName = `${pathPrefix}/${Date.now()}.jpg`;
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName,
                fileType: mimeType,
                base64
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server upload failed');
        }

        const result = await response.json();
        console.log('[OSS] Proxy upload successful:', result.url);
        return {
            url: result.url,
            objectKey: result.objectKey || fileName,
        };
    } catch (e) {
        console.error('[OSS] Proxy upload failed:', e);
        throw e;
    }
};

 
// In-memory cache for signed URLs (with per-item expiration metadata)
type SignedUrlCacheItem = {
    url: string;
    expiresAt: number; // timestamp in ms when this URL expires
};

const signedUrlCache: Record<string, SignedUrlCacheItem> = {};

 
export const getSignedUrlWithRetry = async (
    objectKey: string,
    expires = 3600,
    mode: 'download' | 'preview' = 'download'
): Promise<string> => {
    const now = Date.now();
    const cacheKey = `${mode}:${objectKey}`;
    const cached = signedUrlCache[cacheKey];

    // If we have a valid cached URL, return it
    if (cached && now < cached.expiresAt) {
        return cached.url;
    }

    // Otherwise, fetch a fresh URL from backend
    const refreshedUrl = await getSignedUrl(objectKey, expires, mode);
    // Compute expiry time with a small safety margin (5 seconds)
    const expiryAt = now + expires * 1000 - 5000;
    signedUrlCache[cacheKey] = {
        url: refreshedUrl,
        expiresAt: expiryAt > now ? expiryAt : now + expires * 1000,
    };
    return refreshedUrl;
};

/**
 * Refresh multiple signed URLs in batch.
 * Returns a map of objectKey -> newSignedUrl for the provided keys.
 */
export const refreshSignedUrls = async (ossKeys: string[]): Promise<Record<string, string>> => {
    const results: Record<string, string> = {};
    if (!ossKeys || ossKeys.length === 0) return results;

    // Refresh in parallel for all keys
    const promises = ossKeys.map(async (key) => {
        try {
            const url = await getSignedUrl(key, 3600);
            // Update cache with refreshed URL
            const now = Date.now();
            const expiryAt = now + 3600 * 1000 - 5000;
            signedUrlCache[key] = { url, expiresAt: expiryAt > now ? expiryAt : now + 3600 * 1000 };
            results[key] = url;
        } catch (e) {
            // On failure, do not crash; return empty entry for this key
            console.error('[OSS] Failed to refresh signed URL for', key, e);
        }
    });

    await Promise.all(promises);
    return results;
};

/**
 * Generate a fresh signed URL for an existing OSS object.
 * Signed URLs expire after `expires` seconds (default 1 hour).
 */
export const getSignedUrl = async (
    objectKey: string,
    expires = 3600,
    mode: 'download' | 'preview' = 'download'
): Promise<string> => {
    const response = await fetch(`/api/oss-url?key=${encodeURIComponent(objectKey)}&expires=${expires}&mode=${mode}`);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as { message?: string }).message || 'Failed to generate signed URL');
    }
    const result = await response.json();
    return result.url;
};

export const getPreviewUrl = async (
    objectKey: string,
    fileType?: string,
    expires = 3600
): Promise<string> => {
    if (fileType?.includes('pdf')) {
        return `/api/oss-preview?key=${encodeURIComponent(objectKey)}&expires=${expires}`;
    }
    return getSignedUrl(objectKey, expires, 'preview');
};
