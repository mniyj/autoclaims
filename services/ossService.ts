export const uploadToOSS = async (file: File): Promise<string> => {
    console.log('[OSS] Starting proxy upload for file:', file.name);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64 = (reader.result as string).split(',')[1];
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: `claims/${Date.now()}-${file.name}`,
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
                resolve(result.url);
            } catch (e) {
                console.error('[OSS] Proxy upload failed:', e);
                reject(e);
            }
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsDataURL(file);
    });
};

export const uploadBase64ToOSS = async (base64: string, mimeType: string): Promise<string> => {
    console.log('[OSS] Starting proxy upload for base64');

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: `claims/${Date.now()}.jpg`,
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
        return result.url;
    } catch (e) {
        console.error('[OSS] Proxy upload failed:', e);
        throw e;
    }
};
