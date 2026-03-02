import React, { useState, useEffect } from 'react';
import { Spin, Button, Card, Typography, Alert } from 'antd';
import { DingTalkOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { getUser, isAuthenticated } from '../utils/auth';

const { Title, Paragraph } = Typography;

interface LoginProps {
  onLoginSuccess?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查是否已登录
    checkAuthStatus();
  }, []);

  /**
   * 检查认证状态
   */
  const checkAuthStatus = async () => {
    try {
      const user = getUser();

      if (user && isAuthenticated()) {
        // 已登录，跳转到工作台
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        return;
      }

      // 未登录，初始化钉钉登录流程
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008'}/api/dingtalk/login`);
      const data = await response.json();

      if (data.authUrl) {
        // 跳转到钉钉授权页面
        window.location.href = data.authUrl;
      } else {
        setError('无法获取钉钉授权URL');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('登录初始化错误:', err);
      setError('登录初始化失败，请刷新页面重试');
      setLoading(false);
    }
  };

  /**
   * 处理钉钉OAuth回调
   */
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      // 清除URL中的参数
      window.history.replaceState({}, document.title, window.location.pathname);

      if (error) {
        setError('用户取消了钉钉授权');
        setLoading(false);
        return;
      }

      if (!code) {
        setError('未收到钉钉授权码');
        setLoading(false);
        return;
      }

      // 使用code获取token
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008'}/api/dingtalk/callback?code=${code}&state=${state}`);
        const data = await response.json();

        if (data.success && data.token) {
          // 保存token和用户信息
          localStorage.setItem('adjuster_token', data.token);
          localStorage.setItem('adjuster_user', JSON.stringify(data.user));
          localStorage.setItem('adjuster_expiry', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());

          setLoading(false);
          // 通知登录成功
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        } else {
          setError(data.error || '登录失败');
          setLoading(false);
        }
      } catch (err: any) {
        console.error('OAuth回调错误:', err);
        setError('登录失败，请稍后重试');
        setLoading(false);
      }
    };

    // 检查是否是OAuth回调
    if (window.location.search.includes('code=') || window.location.search.includes('state=')) {
      handleCallback();
    }
  }, []);

  /**
   * 重试登录
   */
  const handleRetry = () => {
    setLoading(true);
    setError(null);
    window.location.href = window.location.pathname; // 清除URL参数后重新加载
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          padding: '48px',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
        }}
      >
        {loading ? (
          <div>
            <Spin size="large" tip="正在跳转到钉钉..." />
            <div style={{ marginTop: '24px' }}>
              <DingTalkOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
              <Title level={3} style={{ marginTop: '16px', color: '#1890ff' }}>
                钉钉单点登录
              </Title>
              <Paragraph type="secondary">
                请在钉钉应用中完成授权
              </Paragraph>
            </div>
          </div>
        ) : error ? (
          <Alert
            message={error}
            type="error"
            showIcon
            action={
              <Button type="link" size="small" onClick={handleRetry}>
                重试
              </Button>
            }
          />
        ) : (
          <div>
            <DingTalkOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
            <Title level={3} style={{ marginTop: '24px', color: '#1890ff' }}>
              登录成功
            </Title>
            <Paragraph type="secondary">
              即将进入理赔员工作台
            </Paragraph>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Login;
