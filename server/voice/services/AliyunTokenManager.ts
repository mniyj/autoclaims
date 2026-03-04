import RPCClient from '@alicloud/pop-core';

interface TokenInfo {
  token: string;
  expireTime: number;
}

class AliyunTokenManager {
  private client: RPCClient;
  private cachedToken: TokenInfo | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;

    if (!accessKeyId || !accessKeySecret) {
      throw new Error('阿里云 AccessKey 未配置');
    }

    this.client = new RPCClient({
      accessKeyId,
      accessKeySecret,
      endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
      apiVersion: '2019-02-28'
    });
  }

  /**
   * 获取有效的 Token
   * 如果缓存的 Token 即将过期，会自动刷新
   */
  async getToken(): Promise<string> {
    // 检查缓存的 Token 是否有效（提前5分钟刷新）
    if (this.cachedToken && this.cachedToken.expireTime > Date.now() / 1000 + 300) {
      return this.cachedToken.token;
    }

    // 获取新 Token
    return this.refreshToken();
  }

  /**
   * 强制刷新 Token
   */
  private async refreshToken(): Promise<string> {
    try {
      console.log('[AliyunTokenManager] 正在获取新 Token...');
      
      const result: any = await this.client.request('CreateToken', {}, { method: 'POST' });
      
      if (result.Token && result.Token.Id) {
        this.cachedToken = {
          token: result.Token.Id,
          expireTime: result.Token.ExpireTime
        };

        console.log('[AliyunTokenManager] Token 获取成功，有效期至:', 
          new Date(result.Token.ExpireTime * 1000).toLocaleString());

        // 设置自动刷新定时器（在过期前10分钟刷新）
        this.scheduleRefresh(result.Token.ExpireTime * 1000 - Date.now() - 600000);

        return result.Token.Id;
      } else {
        throw new Error('Token 响应格式错误');
      }
    } catch (error) {
      console.error('[AliyunTokenManager] 获取 Token 失败:', error);
      throw error;
    }
  }

  /**
   * 设置自动刷新定时器
   */
  private scheduleRefresh(delayMs: number): void {
    // 清除旧的定时器
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // 确保延迟时间不小于0
    const delay = Math.max(delayMs, 60000); // 最少1分钟后刷新

    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('[AliyunTokenManager] 自动刷新 Token 失败:', error);
      }
    }, delay);

    console.log(`[AliyunTokenManager] 已设置 Token 自动刷新，${Math.floor(delay / 60000)} 分钟后刷新`);
  }

  /**
   * 停止自动刷新
   */
  stopAutoRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }
}

// 单例实例
let tokenManagerInstance: AliyunTokenManager | null = null;

export function getTokenManager(): AliyunTokenManager {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new AliyunTokenManager();
  }
  return tokenManagerInstance;
}

export { AliyunTokenManager };
