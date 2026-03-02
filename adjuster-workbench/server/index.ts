/**
 * 后端服务器入口
 *
 * 启动HTTP API服务器和WebSocket服务器
 */

import express from 'express';
import cors from 'cors';
import './websocketServer';
import { testDingTalkConnection } from './dingtalkBot';
import {
  generateDingTalkAuthUrl,
  exchangeCodeForToken,
  getDingTalkUserInfo,
  generateState,
} from './api/dingtalkAuth';
import {
  generateToken,
  verifyToken,
  getAdjusterInfoFromToken,
} from './api/auth';

// 创建Express应用
const app = express();
const PORT = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3008;

// 中间件
app.use(cors());
app.use(express.json());

// 存储state（用于验证OAuth回调）
const stateStore = new Map<string, { timestamp: number }>();

// 钉钉OAuth路由

/**
 * GET /api/dingtalk/login - 重定向到钉钉授权页面
 */
app.get('/api/dingtalk/login', (req, res) => {
  const state = generateState();
  stateStore.set(state, { timestamp: Date.now() });

  const authUrl = generateDingTalkAuthUrl(state);

  res.json({
    authUrl,
    state,
  });
});

/**
 * GET /api/dingtalk/callback - 钉钉OAuth回调
 */
app.get('/api/dingtalk/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // 用户取消授权
    if (error) {
      return res.status(400).json({
        error: '用户取消授权',
        code: 'USER_CANCELLED',
      });
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        error: '缺少授权码',
        code: 'NO_CODE',
      });
    }

    if (!state || typeof state !== 'string') {
      return res.status(400).json({
        error: '缺少state参数',
        code: 'NO_STATE',
      });
    }

    // 验证state
    const storedState = stateStore.get(state);
    if (!storedState) {
      return res.status(400).json({
        error: 'State验证失败',
        code: 'INVALID_STATE',
      });
    }

    // 检查state有效期（5分钟）
    if (Date.now() - storedState.timestamp > 5 * 60 * 1000) {
      return res.status(400).json({
        error: 'State已过期',
        code: 'EXPIRED_STATE',
      });
    }

    // 清除已使用的state
    stateStore.delete(state);

    // 用code换取access_token
    const { accessToken } = await exchangeCodeForToken(code as string);

    // 获取用户信息
    const userInfo = await getDingTalkUserInfo(accessToken);

    // 生成JWT token
    const token = generateToken({
      openId: userInfo.openId,
      name: userInfo.nickName,
      avatar: userInfo.avatar,
    });

    // 返回token和用户信息
    res.json({
      success: true,
      token,
      user: {
        openId: userInfo.openId,
        unionId: userInfo.unionId,
        name: userInfo.nickName,
        avatar: userInfo.avatar,
      },
    });

    console.log(`钉钉登录成功: ${userInfo.nickName} (${userInfo.openId})`);
  } catch (error: any) {
    console.error('钉钉OAuth回调错误:', error);
    res.status(500).json({
      error: error.message || '登录失败',
      code: 'LOGIN_FAILED',
    });
  }
});

/**
 * GET /api/auth/verify - 验证Token有效性
 */
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      valid: false,
      error: '未提供认证token',
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const verification = verifyToken(token);

  res.json({
    valid: verification.valid,
    expired: verification.expired,
    user: verification.decoded ? {
      openId: verification.decoded.openId,
      name: verification.decoded.name,
      avatar: verification.decoded.avatar,
    } : null,
  });
});

/**
 * POST /api/auth/refresh - 刷新Token
 */
app.post('/api/auth/refresh', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: '未提供认证token',
    });
  }

  const oldToken = authHeader.replace('Bearer ', '');
  const newToken = refreshToken(oldToken);

  if (!newToken) {
    return res.status(401).json({
      error: 'Token无效或已过期，请重新登录',
    });
  }

  res.json({
    success: true,
    token: newToken,
  });
});

/**
 * POST /api/auth/logout - 登出
 */
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // 客户端会清除localStorage中的token
    console.log('用户登出');
  }

  res.json({
    success: true,
  });
});

/**
 * GET /api/user/info - 获取当前用户信息
 */
app.get('/api/user/info', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: '未提供认证token',
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const user = getAdjusterInfoFromToken(token);

  if (!user) {
    return res.status(401).json({
      error: 'Token无效或已过期',
    });
  }

  res.json({
    success: true,
    user: {
      openId: user.openId,
      name: user.name,
      avatar: user.avatar,
    },
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('智能理赔后端服务');
  console.log('='.repeat(60));
  console.log();

  // 测试钉钉机器人连接（如果配置了Webhook URL）
  if (process.env.DINGTALK_WEBHOOK_URL) {
    testDingTalkConnection();
  } else {
    console.log(
      '⚠️  钉钉Webhook URL未配置，请在环境变量中设置 DINGTALK_WEBHOOK_URL',
    );
    console.log(
      '   例如: DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx',
    );
  }

  console.log();
  console.log('环境变量配置:');
  console.log(`  - HTTP_PORT: ${PORT} (API端口)`);
  console.log(`  - WS_PORT: ${process.env.WS_PORT || 3007} (WebSocket端口)`);
  console.log(`  - DINGTALK_WEBHOOK_URL: ${process.env.DINGTALK_WEBHOOK_URL || '未配置'}`);
  console.log();
  console.log('✅ 后端服务已启动');
  console.log();
  console.log('提示: 请确保前端小程序和理赔员工作台正确配置了WebSocket连接地址');
  console.log('      小程序: ws://localhost:${process.env.WS_PORT || 3007}');
  console.log('      理赔员: ws://localhost:${process.env.WS_PORT || 3007}');
  console.log(`      API: http://localhost:${PORT}`);
});
