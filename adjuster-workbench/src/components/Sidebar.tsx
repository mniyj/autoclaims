import React from 'react';
import { Menu } from 'antd';
import {
  TeamOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { AppView } from '../App';

interface SidebarProps {
  selectedKey: AppView;
  onMenuClick: (key: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedKey, onMenuClick }) => {
  const items: MenuProps['items'] = [
    {
      key: 'dashboard',
      icon: <TeamOutlined />,
      label: '工作台',
    },
    {
      key: 'conversations',
      icon: <MessageOutlined />,
      label: '对话列表',
    },
    {
      key: 'messages',
      icon: <RobotOutlined />,
      label: '消息管理',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'AI授权',
    },
    {
      key: 'stats',
      icon: <CheckCircleOutlined />,
      label: '数据统计',
    },
  ];

  return (
    <Layout.Sider
      width={240}
      style={{
        background: '#fff',
        boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '16px',
          fontWeight: 600,
          color: '#1890ff',
        }}
      >
        理赔工作台
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={items}
        onClick={({ key }) => onMenuClick(key as AppView)}
        style={{ borderRight: 0 }}
      />
    </Layout.Sider>
  );
};

export default Sidebar;
