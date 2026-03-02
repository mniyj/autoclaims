import React, { useEffect, useState } from 'react';
import { Result, Button } from 'antd';
import { LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { isAuthenticated, logout } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = isAuthenticated();

        if (!authenticated) {
          setChecking(false);
          setAuthorized(false);
          return;
        }

        // 验证服务器端token
        const token = localStorage.getItem('adjuster_token');
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008'}/api/auth/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        setChecking(false);

        if (data.valid && !data.expired) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          logout();
        }
      } catch (error) {
        console.error('认证检查失败:', error);
        setChecking(false);
        setAuthorized(false);
      }
    };

    checkAuth();
  }, []);

  const handleGoToLogin = () => {
    window.location.href = '/api/dingtalk/login';
  };

  if (checking) {
    return (
      <Result
        icon={<LockOutlined />}
        title="验证中..."
        subTitle="正在验证您的登录状态，请稍候"
        style={{ marginTop: '20vh' }}
      />
    );
  }

  if (!authorized) {
    return (
      <Result
        status="error"
        icon={<LockOutlined />}
        title="未登录或登录已过期"
        subTitle="请使用钉钉账号重新登录"
        extra={
          <div>
            <Button type="primary" icon={<ArrowLeftOutlined />} onClick={handleGoToLogin}>
              前往登录
            </Button>
          </div>
        }
        style={{ marginTop: '20vh' }}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
