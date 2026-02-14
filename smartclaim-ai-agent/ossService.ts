export const uploadToOSS = async (base64: string, mimeType: string): Promise<{ url: string; objectKey: string }> => {
  console.log('[OSS-AJ] Starting proxy upload for base64');

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
    console.log('[OSS-AJ] Proxy upload successful:', result.url);
    return { url: result.url, objectKey: result.objectKey || result.name };
  } catch (error) {
    console.error('[OSS-AJ] Proxy upload failed:', error);
    throw error;
  }
};

export const getSignedUrl = async (objectKey: string, expires = 3600): Promise<string> => {
  const response = await fetch(`/api/oss-url?key=${encodeURIComponent(objectKey)}&expires=${expires}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Signed URL failed');
  }
  const result = await response.json();
  return result.url;
};
