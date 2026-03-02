/**
 * 通用认证服务 - JWT token管理
 *
 * 功能：
 * 1. 生成JWT token
 * 2. 验证token有效性
 * 3. 刷新token
 * 4. 登出
 */

import jwt from 'jsonwebtoken';

// JWT配置
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this',
  expiresIn: '7d', // 7天过期
};

/**
 * 生成JWT token
 */
export function generateToken(user: {
  openId: string;
  name: string;
  avatar?: string;
  department?: string;
  position?: string;
}): string {
  const payload = {
    openId: user.openId,
    name: user.name,
    avatar: user.avatar,
    department: user.department,
    position: user.position,
    iat: Math.floor(Date.now() / 1000), // 签发时间（秒）
  };

  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn,
  });
}

/**
 * 验证JWT token
 */
export function verifyToken(token: string): {
  valid: boolean;
  decoded: any;
  expired: boolean;
} {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret);
    const now = Math.floor(Date.now() / 1000);

    return {
      valid: true,
      decoded,
      expired: decoded.exp < now, // 检查是否过期
    };
  } catch (error) {
    return {
      valid: false,
      decoded: null,
      expired: false,
    };
  }
}

/**
 * 获取token payload（不验证签名，仅用于解码）
 */
export function decodeToken(token: string): any | null {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

/**
 * 刷新token
 */
export function refreshToken(oldToken: string): string | null {
  const verification = verifyToken(oldToken);

  if (!verification.valid) {
    return null;
  }

  if (verification.expired) {
    // Token已过期，需要重新登录
    return null;
  }

  // 生成新token
  const decoded = verification.decoded;
  return generateToken({
    openId: decoded.openId,
    name: decoded.name,
    avatar: decoded.avatar,
    department: decoded.department,
    position: decoded.position,
  });
}

/**
 * 中间件：验证请求的token
 */
export function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: '未提供认证token',
      code: 'NO_TOKEN',
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const verification = verifyToken(token);

  if (!verification.valid) {
    return res.status(401).json({
      error: 'Token无效或已过期',
      code: 'INVALID_TOKEN',
    });
  }

  if (verification.expired) {
    return res.status(401).json({
      error: 'Token已过期',
      code: 'EXPIRED_TOKEN',
    });
  }

  // 将用户信息附加到请求对象
  req.user = verification.decoded;
  next();
}

/**
 * 调整器信息
 */
export function getAdjusterInfoFromToken(token: string): {
  openId: string;
  name: string;
  avatar?: string;
  department?: string;
  position?: string;
} | null {
  const decoded = decodeToken(token);
  return decoded ? {
    openId: decoded.openId,
    name: decoded.name,
    avatar: decoded.avatar,
    department: decoded.department,
    position: decoded.position,
  } : null;
}

export default {
  generateToken,
  verifyToken,
  decodeToken,
  refreshToken,
  authMiddleware,
  getAdjusterInfoFromToken,
};
