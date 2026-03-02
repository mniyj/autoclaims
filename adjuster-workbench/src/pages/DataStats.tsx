import React, { useState } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Select, Table, Progress } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface StatCard {
  title: string;
  value: number;
  change?: number;
  prefix?: React.ReactNode;
  suffix?: string;
  valueStyle?: { color: string };
}

const DataStats: React.FC = () => {
  const [dateRange, setDateRange] = useState<any>([dayjs().subtract(7, 'day'), dayjs()]);
  const [periodType, setPeriodType] = useState<'day' | 'week' | 'month'>('week');

  const [conversationStats, setConversationStats] = useState<StatCard[]>([
    {
      title: '总对话数',
      value: 156,
      change: 12.5,
      valueStyle: { color: '#1890ff' },
      prefix: <MessageIcon />,
    },
    {
      title: '完成对话数',
      value: 133,
      change: 8.3,
      valueStyle: { color: '#52c41a' },
      prefix: <CheckIcon />,
    },
    {
      title: '平均响应时间',
      value: 1.8,
      suffix: '分钟',
      change: -15.2,
      valueStyle: { color: '#faad14' },
    },
    {
      title: 'AI处理率',
      value: 78,
      suffix: '%',
      change: 5.6,
      valueStyle: { color: '#722ed1' },
    },
  ]);

  const [claimStats] = useState([
    {
      type: '车辆理赔',
      count: 45,
      percentage: 28.8,
      status: 'pending',
      completed: 38,
    },
    {
      type: '医疗理赔',
      count: 67,
      percentage: 42.9,
      status: 'reviewing',
      completed: 55,
    },
    {
      type: '重疾理赔',
      count: 23,
      percentage: 14.7,
      status: 'active',
      completed: 20,
    },
    {
      type: '意外伤害理赔',
      count: 21,
      percentage: 13.5,
      status: 'active',
      completed: 18,
    },
  ]);

  const columns = [
    {
      title: '理赔类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '总数量',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: any, b: any) => a.count - b.count,
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (percentage: number) => (
        <Progress
          percent={percentage}
          size="small"
          format={(percent) => `${percent}%`}
        />
      ),
      sorter: (a: any, b: any) => a.percentage - b.percentage,
    },
    {
      title: '已处理',
      dataIndex: 'completed',
      key: 'completed',
      sorter: (a: any, b: any) => a.completed - b.completed,
    },
    {
      title: '处理中',
      key: 'pending',
      render: (_: any, record: any) => record.count - record.completed,
    },
  ];

  const [topTopics, setTopTopics] = useState([
    { topic: '材料指导', count: 156, trend: 'up' },
    { topic: '进度查询', count: 134, trend: 'up' },
    { topic: '保单咨询', count: 89, trend: 'down' },
    { topic: '理赔报案', count: 67, trend: 'up' },
    { topic: '简单问答', count: 45, trend: 'stable' },
  ]);

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>数据统计</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Select
            value={periodType}
            onChange={setPeriodType}
            style={{ width: 120 }}
            options={[
              { value: 'day', label: '今日' },
              { value: 'week', label: '本周' },
              { value: 'month', label: '本月' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* 对话统计 */}
      <Card title="对话统计" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          {conversationStats.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card bordered={false} hoverable>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                  valueStyle={stat.valueStyle}
                />
                {stat.change !== undefined && (
                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
                    {stat.change > 0 ? (
                      <span style={{ color: '#52c41a' }}>
                        <ArrowUpOutlined /> {Math.abs(stat.change)}%
                      </span>
                    ) : (
                      <span style={{ color: '#f5222d' }}>
                        <ArrowDownOutlined /> {Math.abs(stat.change)}%
                      </span>
                    )}
                    <span style={{ color: '#999', marginLeft: '4px' }}>
                      较上期
                    </span>
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 理赔类型分布 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={16}>
          <Card title="理赔类型分布" bordered={false}>
            <Table
              columns={columns}
              dataSource={claimStats}
              rowKey="type"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="热门咨询话题" bordered={false}>
            {topTopics.map((topic, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{topic.topic}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {topic.count} 次
                  </div>
                </div>
                <div>
                  {topic.trend === 'up' && (
                    <span style={{ color: '#f5222d', fontSize: '20px' }}>↑</span>
                  )}
                  {topic.trend === 'down' && (
                    <span style={{ color: '#52c41a', fontSize: '20px' }}>↓</span>
                  )}
                  {topic.trend === 'stable' && (
                    <span style={{ color: '#999', fontSize: '20px' }}>→</span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* AI使用统计 */}
      <Card title="AI助手使用效果" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="AI自动回复率"
              value={78}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
            <Progress percent={78} showInfo={false} style={{ marginTop: '8px' }} />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="人工介入率"
              value={22}
              suffix="%"
              valueStyle={{ color: '#faad14' }}
            />
            <Progress percent={22} showInfo={false} style={{ marginTop: '8px' }} strokeColor="#faad14" />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Statistic
              title="用户满意度"
              value={4.7}
              suffix="/ 5.0"
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
              基于 342 条评价
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

// Simple SVG icons for stats
const MessageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

export default DataStats;
