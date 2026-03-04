// 测试阿里云 Token 获取
import { getTokenManager } from './server/voice/services/AliyunTokenManager.js';

async function testToken() {
  try {
    console.log('正在测试阿里云 Token 获取...');
    const token = await getTokenManager().getToken();
    console.log('✅ Token 获取成功！');
    console.log('Token:', token.substring(0, 20) + '...');
  } catch (error) {
    console.error('❌ Token 获取失败:', error);
  }
}

testToken();
