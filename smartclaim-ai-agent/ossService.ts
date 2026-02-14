import OSS from 'ali-oss';

let client: OSS | null = null;

const getClient = (): OSS => {
  if (!client) {
    const accessKeyId = process.env.ALIYUN_OSS_ACCESS_KEY_ID || '';
    const accessKeySecret = process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || '';

    if (!accessKeyId || !accessKeySecret) {
      throw new Error('OSS credentials not configured');
    }

    client = new OSS({
      region: process.env.ALIYUN_OSS_REGION || 'oss-cn-beijing',
      accessKeyId,
      accessKeySecret,
      bucket: process.env.ALIYUN_OSS_BUCKET || '',
    });
  }
  return client;
};

export const uploadToOSS = async (base64: string, mimeType: string): Promise<string> => {
  // Convert base64 to Blob via fetch (clean and browser-native)
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Create a File object from the Blob (ali-oss browser SDK prefers File)
  const ext = mimeType.split('/')[1] || 'jpg';
  const filename = `claims/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const file = new File([blob], filename, { type: mimeType });

  const ossClient = getClient();
  const result = await ossClient.put(filename, file);

  return result.url;
};
