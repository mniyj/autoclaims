import express from 'express';
import { VoiceGateway } from '../voice/VoiceGateway.js';

const router = express.Router();

// 存储 VoiceGateway 实例
let voiceGateway: VoiceGateway | null = null;

// 初始化函数
export function initializeVoiceRoutes(server: any) {
  voiceGateway = new VoiceGateway(server);
  console.log('[VoiceRoutes] 语音服务已初始化');
  return voiceGateway;
}

// 创建语音会话
router.post('/session/start', async (req, res) => {
  try {
    const { userId, initialIntent } = req.body;
    
    if (!voiceGateway) {
      return res.status(503).json({
        success: false,
        error: '语音服务未初始化'
      });
    }

    const sessionId = voiceGateway.createSession(userId || 'anonymous');
    
    res.json({
      success: true,
      sessionId,
      wsUrl: `ws://${req.headers.host}/voice/ws/${sessionId}`,
      expiresAt: new Date(Date.now() + 3600000).toISOString() // 1小时过期
    });
  } catch (error) {
    console.error('[VoiceRoutes] 创建会话失败:', error);
    res.status(500).json({
      success: false,
      error: '创建会话失败'
    });
  }
});

// 结束语音会话
router.post('/session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!voiceGateway) {
      return res.status(503).json({
        success: false,
        error: '语音服务未初始化'
      });
    }

    voiceGateway.endSession(sessionId);
    
    res.json({
      success: true,
      message: '会话已结束'
    });
  } catch (error) {
    console.error('[VoiceRoutes] 结束会话失败:', error);
    res.status(500).json({
      success: false,
      error: '结束会话失败'
    });
  }
});

// 获取会话历史
router.get('/session/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!voiceGateway) {
      return res.status(503).json({
        success: false,
        error: '语音服务未初始化'
      });
    }

    const session = voiceGateway.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      });
    }

    // TODO: 实现获取会话历史的功能
    res.json({
      success: true,
      sessionId,
      messages: []
    });
  } catch (error) {
    console.error('[VoiceRoutes] 获取历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取历史失败'
    });
  }
});

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: voiceGateway ? 'running' : 'not_initialized',
    timestamp: new Date().toISOString()
  });
});

export default router;
