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

/**
 * Generate a fresh signed URL for an existing OSS object.
 * Signed URLs expire after `expires` seconds (default 1 hour).
 */
export const getSignedUrl = async (objectKey: string, expires = 3600): Promise<string> => {
    const response = await fetch(`/api/oss-url?key=${encodeURIComponent(objectKey)}&expires=${expires}`);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as { message?: string }).message || 'Failed to generate signed URL');
    }
    const result = await response.json();
    return result.url;
};
