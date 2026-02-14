import OSS from 'ali-oss';

const client = new OSS({
  region: process.env.ALIYUN_OSS_REGION!,
  accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET!,
  bucket: process.env.ALIYUN_OSS_BUCKET!,
});

export const uploadToOSS = async (base64: string, mimeType: string): Promise<string> => {
  const buffer = Buffer.from(base64, 'base64');
  const ext = mimeType.split('/')[1] || 'jpg';
  const filename = `claims/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  
  const result = await client.put(filename, buffer, {
    headers: { 'Content-Type': mimeType }
  });
  
  return result.url;
};
