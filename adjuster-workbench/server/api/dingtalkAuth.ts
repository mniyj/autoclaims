/**
 * 钉钉认证服务 - 实现OAuth 2.0授权流程
 *
 * 功能：
 * 1. 生成钉钉授权URL
 * 2. 处理OAuth回调
 * 3. 用code换取access_token
 * 4. 获取用户信息
 * 5. 生成JWT token
 */

import crypto from 'crypto';

// 钉钉OAuth配置
const DINGTALK_CONFIG = {
  appId: process.env.DINGTALK_APPID || '',
  appSecret: process.env.DINGTALK_APPSECRET || '',
  redirectUri: process.env.DINGTALK_REDIRECT_URI || '',
};

// 钉钉API端点
const DINGTALK_API = {
  authorize: 'https://oapi.dingtalk.com/connect/oauth2/snsauthorize',
  getToken: 'https://oapi.dingtalk.com/sns/gettoken_bycode',
  getUserInfo: 'https://oapi.dingtalk.com/sns/getuserinfo_bycode',
};

/**
 * 生成钉钉授权URL
 */
export async function generateDingTalkAuthUrl(state: string): Promise<string> {
  const { appId, redirectUri } = DINGTALK_CONFIG;

  const authUrl = new URL(DINGTALK_API.authorize);
  authUrl.searchParams.set('appid', appId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'snsapi_login');
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}

/**
 * 用code换取access_token
 */
export async function exchangeCodeForToken(authCode: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { appId, appSecret } = DINGTALK_CONFIG;

  const response = await fetch(DINGTALK_API.getToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appId,
      appSecret,
      code: authCode,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`钉钉API错误: ${response.status}`);
  }

  const data = await response.json();

  if (data.errcode !== 0) {
    throw new Error(`钉钉授权失败: ${data.errmsg}`);
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 7200, // 默认2小时
  };
}

/**
 * 获取钉钉用户信息
 */
export async function getDingTalkUserInfo(accessToken: string): Promise<{
  openId: string;
  unionId?: string;
  nickName: string;
  avatar?: string;
}> {
  const { appId, appSecret } = DINGTALK_CONFIG;

  const url = new URL(DINGTALK_API.getUserInfo);
  url.searchParams.set('accessKey', appId);
  url.searchParams.set('accessSecret', appSecret);
  url.searchParams.set('code', accessToken);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`钉钉API错误: ${response.status}`);
  }

  const data = await response.json();

  if (data.errcode !== 0) {
    throw new Error(`获取钉钉用户信息失败: ${data.errmsg}`);
  }

  return {
    openId: data.openid,
    unionId: data.unionid,
    nickName: data.nick,
    avatar: data.avatar,
  };
}

/**
 * 生成state参数（防CSRF）
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 验证state参数
 */
export function verifyState(state: string, storedState: string): boolean {
  return state === storedState;
}

/**
 * DingTalk API错误响应
 */
export interface DingTalkErrorResponse {
  errcode: number;
  errmsg: string;
}

/**
 * 钉钉授权URL参数
 */
export interface DingTalkAuthParams {
  appId: string;
  redirectUri: string;
  response_type: 'code';
  scope: 'snsapi_login';
  state: string;
}

/**
 * Token响应
 */
export interface DingTalkTokenResponse {
  errcode: number;
  errmsg?: string;
  access_token: string;
  expires_in?: number;
}

/**
 * 用户信息响应
 */
export interface DingTalkUserInfoResponse {
  errcode: number;
  errmsg?: string;
  openid: string;
  unionid?: string;
  nick: string;
  avatar?: string;
}

export default {
  generateDingTalkAuthUrl,
  exchangeCodeForToken,
  getDingTalkUserInfo,
  generateState,
  verifyState,
};
