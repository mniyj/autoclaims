import React, { useState } from 'react';
import { Input, Select, DatePicker, Table, Tag, Avatar, Button, Space, Modal, message } from 'antd';
import { SearchOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs from 'dayjs';

interface Message {
  id: string;
  conversationId: string;
  userName: string;
  avatar?: string;
  sender: 'user' | 'ai' | 'human';
  content: string;
  timestamp: string;
  claimType?: string;
}

const MessageManagement: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [senderFilter, setSenderFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      conversationId: '1',
      userName: '张建国',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang',
      sender: 'user',
      content: '我想报案理赔，车辆被剐蹭了',
      timestamp: '2024-01-10 09:30:15',
      claimType: '车辆理赔',
    },
    {
      id: '2',
      conversationId: '1',
      userName: 'AI助手',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AI',
      sender: 'ai',
      content: '您好，请问事故发生在什么时间和地点？',
      timestamp: '2024-01-10 09:30:20',
    },
    {
      id: '3',
      conversationId: '1',
      userName: '张建国',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhang',
      sender: 'user',
      content: '昨天下午3点，小区地库',
      timestamp: '2024-01-10 09:31:00',
    },
    {
      id: '4',
      conversationId: '1',
      userName: '张经理',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Adjuster',
      sender: 'human',
      content: '好的，请您上传现场照片和事故证明',
      timestamp: '2024-01-10 09:32:00',
    },
    {
      id: '5',
      conversationId: '2',
      userName: '李桂英',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Li',
      sender: 'user',
      content: '请问住院费用能报销多少？',
      timestamp: '2024-02-20 14:15:30',
      claimType: '医疗理赔',
    },
    {
      id: '6',
      conversationId: '2',
      userName: 'AI助手',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AI',
      sender: 'ai',
      content: '根据您的保单，医疗费用的报销比例为80%，起付线为1000元。请问您具体住院费用是多少？',
      timestamp: '2024-02-20 14:15:35',
    },
  ]);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleSenderFilter = (value: string) => {
    setSenderFilter(value);
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates) => {
    setDateRange(dates);
  };

  const filteredMessages = messages.filter((msg) => {
    const matchSearch = msg.content.includes(searchText) ||
                     msg.userName.includes(searchText) ||
                     (msg.claimType && msg.claimType.includes(searchText));
    const matchSender = senderFilter === 'all' || msg.sender === senderFilter;

    let matchDate = true;
    if (dateRange && dateRange[0] && dateRange[1]) {
      const msgDate = dayjs(msg.timestamp);
      matchDate = msgDate.isAfter(dateRange[0]) && msgDate.isBefore(dateRange[1]);
    }

    return matchSearch && matchSender && matchDate;
  });

  const columns: ColumnsType<Message> = [
    {
      title: '对话ID',
      dataIndex: 'conversationId',
      key: 'conversationId',
      width: 120,
    },
    {
      title: '发送者',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (_: any, record: Message) => (
        <Space>
          <Avatar src={record.avatar} size={32}>
            {record.userName[0]}
          </Avatar>
          <span>{record.userName}</span>
        </Space>
      ),
    },
    {
      title: '消息类型',
      dataIndex: 'sender',
      key: 'sender',
      width: 100,
      render: (sender: string) => {
        const config = {
          user: { color: 'green', text: '用户' },
          ai: { color: 'blue', text: 'AI助手' },
          human: { color: 'orange', text: '理赔员' },
        };
        const senderConfig = config[sender as keyof typeof config];
        return <Tag color={senderConfig.color}>{senderConfig.text}</Tag>;
      },
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <span style={{ maxWidth: '300px', display: 'inline-block' }}>
          {content}
        </span>
      ),
    },
    {
      title: '理赔类型',
      dataIndex: 'claimType',
      key: 'claimType',
      width: 120,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: Message) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedMessage(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => message.info('导出功能开发中')}
          >
            导出
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>消息管理</h2>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Input
          placeholder="搜索消息内容或用户名"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          defaultValue="all"
          style={{ width: 120 }}
          onChange={handleSenderFilter}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'user', label: '用户' },
            { value: 'ai', label: 'AI助手' },
            { value: 'human', label: '理赔员' },
          ]}
        />
        <DatePicker.RangePicker
          onChange={handleDateRangeChange}
          style={{ width: 280 }}
        />
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => message.info('批量导出功能开发中')}
        >
          批量导出
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredMessages}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条消息`,
        }}
        scroll={{ x: 1200, y: 600 }}
      />

      <Modal
        title="消息详情"
        open={!!selectedMessage}
        onCancel={() => setSelectedMessage(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedMessage(null)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedMessage && (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar src={selectedMessage.avatar} size={48}>
                {selectedMessage.userName[0]}
              </Avatar>
              <div>
                <div style={{ fontWeight: 500, fontSize: '16px' }}>
                  {selectedMessage.userName}
                </div>
                <div style={{ color: '#999', fontSize: '12px' }}>
                  {selectedMessage.timestamp}
                </div>
              </div>
            </div>
            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
              {selectedMessage.content}
            </div>
            {selectedMessage.claimType && (
              <div style={{ marginTop: '12px' }}>
                <Tag color="blue">理赔类型: {selectedMessage.claimType}</Tag>
                <Tag>对话ID: {selectedMessage.conversationId}</Tag>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MessageManagement;
