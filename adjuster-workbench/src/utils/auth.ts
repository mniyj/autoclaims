/**
 * 前端认证工具函数
 *
 * 功能：
 * 1. Token管理
 * 2. 用户状态管理
 * 3. localStorage操作
 */

const STORAGE_KEYS = {
  TOKEN: 'adjuster_token',
  USER: 'adjuster_user',
  EXPIRY: 'adjuster_expiry',
};

interface User {
  openId: string;
  unionId?: string;
  name: string;
  avatar?: string;
}

/**
 * 保存Token到localStorage
 */
export function saveToken(token: string, expiry: number): void {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.EXPIRY, expiry.toString());
}

/**
 * 获取Token
 */
export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

/**
 * 移除Token
 */
export function removeToken(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EXPIRY);
}

/**
 * 保存用户信息
 */
export function saveUser(user: User): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
}

/**
 * 获取用户信息
 */
export function getUser(): User | null {
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 移除用户信息
 */
export function removeUser(): void {
  localStorage.removeItem(STORAGE_KEYS.USER);
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;

  const expiry = localStorage.getItem(STORAGE_KEYS.EXPIRY);
  if (!expiry) return false;

  const now = Date.now();
  return parseInt(expiry) > now;
}

/**
 * 登出
 */
export function logout(): void {
  removeToken();
  removeUser();
}

/**
 * 获取Token过期时间
 */
export function getTokenExpiry(): number | null {
  const expiry = localStorage.getItem(STORAGE_KEYS.EXPIRY);
  if (!expiry) return null;
  return parseInt(expiry);
}

/**
 * 检查Token是否即将过期（提前1天提示）
 */
export function isTokenExpiringSoon(): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return false;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return expiry - now < oneDayMs;
}

export default {
  STORAGE_KEYS,
  saveToken,
  getToken,
  removeToken,
  saveUser,
  getUser,
  removeUser,
  isAuthenticated,
  logout,
  getTokenExpiry,
  isTokenExpiringSoon,
};
