import React, { useState } from 'react';
import { Layout, Button, Dropdown, Avatar, message } from 'antd';
import { UserOutlined, LogoutOutlined, LockOutlined } from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import ConversationList from './pages/ConversationList';
import MessageManagement from './pages/MessageManagement';
import AIAuthorizationConfig from './pages/AIAuthorizationConfig';
import DataStats from './pages/DataStats';
import { getUser, logout } from './utils/auth';

export type AppView = 'dashboard' | 'conversations' | 'messages' | 'settings' | 'stats';

function App() {
  const [selectedKey, setSelectedKey] = useState<AppView>('dashboard');
  const [user, setUser] = useState<any>(null);

  // 获取当前用户信息
  React.useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
  }, []);

  const handleMenuClick = (key: AppView) => {
    setSelectedKey(key);
  };

  const handleLogout = async () => {
    try {
      // 调用后端登出API
      const token = localStorage.getItem('adjuster_token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008'}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // 清除本地存储
        logout();
        setUser(null);
        message.success('登出成功');

        // 跳转到登录页
        window.location.href = '/login';
      } else {
        message.error('登出失败');
      }
    } catch (error) {
      console.error('登出错误:', error);
      message.error('登出失败，请稍后重试');
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const contentMap: Record<AppView, React.ReactNode> = {
    dashboard: <Dashboard />,
    conversations: <ConversationList onConversationSelect={(id) => console.log('Selected:', id)} />,
    messages: <MessageManagement />,
    settings: <AIAuthorizationConfig />,
    stats: <DataStats />,
  };

  // 用户信息下拉菜单
  const userMenu = user ? (
    <Dropdown
      menu={{
        items: userMenuItems,
      }}
      placement="bottomRight"
    >
      <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar
          size="small"
          src={user.avatar}
          icon={user.avatar ? null : <LockOutlined />}
        >
          {user.name}
        </Avatar>
        <span style={{ color: '#666' }}>
          <LockOutlined style={{ marginRight: '4px' }} />
          钉钉认证
        </span>
      </div>
    </Dropdown>
  ) : (
    <Button type="link" icon={<LockOutlined />} onClick={() => (window.location.href = '/login')}>
      登录
    </Button>
  );

  return (
    <ProtectedRoute>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar selectedKey={selectedKey} onMenuClick={handleMenuClick} />

        <Layout style={{ display: 'flex', flexDirection: 'column' }}>
          <Layout.Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
                智能理赔员工作台
              </h1>
              {userMenu}
            </div>
          </Layout.Header>

          <Layout.Content style={{ padding: '24px', flex: 1, overflow: 'auto' }}>
            {contentMap[selectedKey]}
          </Layout.Content>
        </Layout>
      </Layout>
    </ProtectedRoute>
  );
}

export default App;
