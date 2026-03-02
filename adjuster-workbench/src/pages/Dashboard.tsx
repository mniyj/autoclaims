import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MessageOutlined, TeamOutlined, ClockCircleOutlined } from '@ant-design/icons';

interface DashboardStats {
  totalConversations: number;
  activeConversations: number;
  todayMessages: number;
  pendingClaims: number;
}

interface RecentConversation {
  id: string;
  userName: string;
  claimType: string;
  status: 'active' | 'pending' | 'closed';
  lastMessage: string;
  lastActive: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 156,
    activeConversations: 23,
    todayMessages: 342,
    pendingClaims: 8,
  });

  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([
    {
      id: '1',
      userName: '张建国',
      claimType: '医疗理赔',
      status: 'active',
      lastMessage: '我的理赔材料已经上传完成了',
      lastActive: '2分钟前',
    },
    {
      id: '2',
      userName: '李桂英',
      claimType: '重疾医疗理赔',
      status: 'pending',
      lastMessage: '请问理赔进度如何了？',
      lastActive: '15分钟前',
    },
    {
      id: '3',
      userName: '王小明',
      claimType: '少儿住院医疗',
      status: 'active',
      lastMessage: '谢谢您的帮助',
      lastActive: '30分钟前',
    },
  ]);

  const columns = [
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
    },
    {
      title: '理赔类型',
      dataIndex: 'claimType',
      key: 'claimType',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = {
          active: { color: 'green', text: '进行中' },
          pending: { color: 'orange', text: '待处理' },
          closed: { color: 'default', text: '已关闭' },
        };
        const statusConfig = config[status as keyof typeof config];
        return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>;
      },
    },
    {
      title: '最后消息',
      dataIndex: 'lastMessage',
      key: 'lastMessage',
      ellipsis: true,
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActive',
      key: 'lastActive',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RecentConversation) => (
        <Button type="link" size="small">
          查看对话
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>工作台</h2>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总对话数"
              value={stats.totalConversations}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="进行中对话"
              value={stats.activeConversations}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix={
                <span style={{ fontSize: '14px', color: '#52c41a' }}>
                  <ArrowUpOutlined /> 12%
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日消息数"
              value={stats.todayMessages}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待处理理赔"
              value={stats.pendingClaims}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷入口 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ cursor: 'pointer', textAlign: 'center' }}
          >
            <MessageOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
            <div style={{ marginTop: '12px', fontWeight: 500 }}>开始新对话</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ cursor: 'pointer', textAlign: 'center' }}
          >
            <TeamOutlined style={{ fontSize: '32px', color: '#52c41a' }} />
            <div style={{ marginTop: '12px', fontWeight: 500 }}>查看全部对话</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ cursor: 'pointer', textAlign: 'center' }}
          >
            <ClockCircleOutlined style={{ fontSize: '32px', color: '#faad14' }} />
            <div style={{ marginTop: '12px', fontWeight: 500 }}>查看待处理</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ cursor: 'pointer', textAlign: 'center' }}
          >
            <MessageOutlined style={{ fontSize: '32px', color: '#722ed1' }} />
            <div style={{ marginTop: '12px', fontWeight: 500 }}>AI授权配置</div>
          </Card>
        </Col>
      </Row>

      {/* 最近对话 */}
      <Card title="最近对话" bordered={false}>
        <Table
          columns={columns}
          dataSource={recentConversations}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
