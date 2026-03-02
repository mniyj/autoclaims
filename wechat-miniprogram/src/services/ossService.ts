// 智能理赔微信小程序 - 阿里云 OSS 服务（适配Taro）
// 从 smartclaim-ai-agent/ossService.ts 迁移

import Taro from '@tarojs/taro';

/**
 * 上传文件到阿里云OSS
 * 注意：小程序端使用Taro.uploadFile API
 */
export const uploadToOSS = async (
  filePath: string,
  onProgress?: (percent: number) => void
): Promise<{ url: string; objectKey: string }> => {
  try {
    // 先获取上传凭证
    const tokenRes = await Taro.request({
      url: '/api/upload-token',
      method: 'POST'
    });
    const { uploadToken, signature, url: ossUrl, key: ossKey, region } = await tokenRes.data;

    // 使用Taro.uploadFile上传到OSS
    const uploadRes = await Taro.uploadFile({
      url: ossUrl,
      filePath,
      name: `claims_${Date.now()}.jpg`,
      formData: {
        name: `claims_${Date.now()}.jpg`,
        key: `${key}${new Date().getTime()}.jpg`,
        policy: `${signature}` // OSS签名策略
      },
      header: {
        'Content-Type': 'multipart/form-data',
        'x-oss-signature': signature,
        'x-oss-date': new Date().toUTCString()
      },
      success: (res) => {
        console.log('上传成功:', res);
        if (onProgress) {
          onProgress(res.progress * 100);
        }
      },
      fail: (res) => {
        console.error('上传失败:', res);
        Taro.showToast({
          title: '上传失败',
          icon: 'none',
          duration: 2000
        });
      }
    });

    // 返回OSS URL
    return {
      url: uploadRes.data.url || '',
      objectKey: key
    };
  } catch (error) {
    console.error('OSS上传失败:', error);
    Taro.showToast({
      title: '上传失败，请重试',
      icon: 'none',
      duration: 2000
    });
    throw error;
  }
};

/**
 * 选择并上传图片
 */
export const chooseAndUploadImage = async (
  count: number = 1
): Promise<{ url: string; objectKey: string }> => {
  const res = await Taro.chooseImage({
    count,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera']
  });

  if (res.tempFilePaths && res.tempFilePaths.length > 0) {
    return await uploadToOSS(res.tempFilePaths[0]);
  }

  throw new Error('未选择图片');
};

/**
 * 获取OSS签名URL
 */
export const getSignedUrl = async (
  objectKey: string,
  expires: number = 3600
): Promise<string> => {
  const res = await Taro.request({
    url: `/api/oss-url?key=${encodeURIComponent(objectKey)}&expires=${expires}`,
    method: 'GET'
  });

  const { url } = await res.data;
  return url;
};

/**
 * 压缩图片（小程序端图片压缩）
 */
export const compressImage = async (
  filePath: string,
  quality: number = 80,
  maxWidth: number = 1600
): Promise<string> => {
  try {
    const res = await Taro.compressImage({
      src: filePath,
      quality,
      maxWidth
    });

    if (res.tempFilePath) {
      return res.tempFilePath;
    }

    return filePath;
  } catch (error) {
    console.error('图片压缩失败:', error);
    return filePath;
  }
};
