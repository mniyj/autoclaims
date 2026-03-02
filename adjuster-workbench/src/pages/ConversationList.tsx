import React, { useState } from 'react';
import { Input, Select, Table, Tag, Avatar, Button, Space, Dropdown, Modal, message } from 'antd';
import { SearchOutlined, MoreOutlined, SendOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';

interface Conversation {
  id: string;
  userName: string;
  avatar?: string;
  claimId: string;
  claimType: string;
  status: 'active' | 'pending' | 'closed';
  lastMessage: string;
  lastActive: string;
  unreadCount: number;
  aiEnabled: boolean;
  assignee?: string;
}

interface ConversationListProps {
  onConversationSelect: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ onConversationSelect }) => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      userName: '张建国',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang',
      claimId: 'CLM-2024-001',
      claimType: '车辆理赔',
      status: 'active',
      lastMessage: '好的，我会尽快上传材料',
      lastActive: '2分钟前',
      unreadCount: 2,
      aiEnabled: true,
      assignee: '张经理',
    },
    {
      id: '2',
      userName: '李桂英',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Li',
      claimId: 'CLM-2024-002',
      claimType: '医疗理赔',
      status: 'pending',
      lastMessage: '请问理赔进度如何了？',
      lastActive: '15分钟前',
      unreadCount: 1,
      aiEnabled: false,
      assignee: '未分配',
    },
    {
      id: '3',
      userName: '王小明',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wang',
      claimId: 'CLM-2019-001',
      claimType: '少儿住院医疗',
      status: 'active',
      lastMessage: '谢谢您的帮助',
      lastActive: '30分钟前',
      unreadCount: 0,
      aiEnabled: true,
      assignee: '李助理',
    },
    {
      id: '4',
      userName: '陈乐乐',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chen',
      claimId: 'CLM-2019-003',
      claimType: '少儿门急诊理赔',
      status: 'closed',
      lastMessage: '理赔已完成，款项已到账',
      lastActive: '2小时前',
      unreadCount: 0,
      aiEnabled: true,
      assignee: '李助理',
    },
    {
      id: '5',
      userName: '赵强',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhao',
      claimId: 'CLM-2021-001',
      claimType: '意外伤害理赔',
      status: 'active',
      lastMessage: '手术材料已经补传了',
      lastActive: '昨天',
      unreadCount: 3,
      aiEnabled: true,
      assignee: '王主任',
    },
  ]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchSearch = conv.userName.includes(searchText) ||
                     conv.claimId.includes(searchText) ||
                     conv.claimType.includes(searchText);
    const matchStatus = statusFilter === 'all' || conv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const columns: ColumnsType<Conversation> = [
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 150,
      render: (_: any, record: Conversation) => (
        <Space>
          <Avatar src={record.avatar} size={40}>
            {record.userName[0]}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.userName}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>{record.claimId}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '理赔类型',
      dataIndex: 'claimType',
      key: 'claimType',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      title: 'AI状态',
      dataIndex: 'aiEnabled',
      key: 'aiEnabled',
      width: 100,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'blue' : 'red'}>
          {enabled ? '已启用' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
    },
    {
      title: '最后消息',
      dataIndex: 'lastMessage',
      key: 'lastMessage',
      ellipsis: true,
    },
    {
      title: '未读',
      dataIndex: 'unreadCount',
      key: 'unreadCount',
      width: 80,
      render: (count: number) => (
        count > 0 ? <Tag color="red">{count}</Tag> : <span>-</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_: any, record: Conversation) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'view',
                label: '查看对话',
                icon: <SendOutlined />,
                onClick: () => onConversationSelect(record.id),
              },
              {
                key: 'assign',
                label: '分配理赔员',
              },
              {
                key: 'ai',
                label: record.aiEnabled ? '禁用AI' : '启用AI',
              },
              {
                key: 'close',
                label: '关闭对话',
                danger: true,
              },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  const handleBatchAssign = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择对话');
      return;
    }
    message.success(`已分配 ${selectedRowKeys.length} 个对话`);
  };

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Input
          placeholder="搜索用户名、理赔ID或类型"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          defaultValue="all"
          style={{ width: 120 }}
          onChange={handleStatusFilter}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'active', label: '进行中' },
            { value: 'pending', label: '待处理' },
            { value: 'closed', label: '已关闭' },
          ]}
        />
        {selectedRowKeys.length > 0 && (
          <Button type="primary" onClick={handleBatchAssign}>
            批量分配 ({selectedRowKeys.length})
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={filteredConversations}
        rowKey="id"
        rowSelection={rowSelection}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
};

export default ConversationList;
