import React, { useState } from "react";
import {
  Card,
  Form,
  Switch,
  Select,
  InputNumber,
  Button,
  Table,
  Space,
  Modal,
  message,
  Divider,
  Tag,
  Input,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { AIAuthorizationConfig, EscalationRule } from "../types";

const AIAuthorizationConfig: React.FC = () => {
  const [config, setConfig] = useState<AIAuthorizationConfig>({
    id: "global-config",
    enabled: true,
    autoReplyLevel: "full",
    maxConfidence: 0.7,
    allowedTopics: [
      "material_guidance",
      "progress_inquiry",
      "simple_questions",
    ],
    escalationRules: [
      {
        id: "1",
        condition: "confidence_low",
        threshold: 0.6,
        action: "human_intervention",
        priority: "high",
      },
      {
        id: "2",
        condition: "manual_request",
        action: "human_intervention",
        priority: "high",
      },
      {
        id: "3",
        condition: "complex_question",
        action: "human_intervention",
        priority: "medium",
      },
    ],
    updatedBy: "system",
    updatedAt: new Date().toISOString(),
  });

  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleSaveConfig = async (values: Partial<AIAuthorizationConfig>) => {
    setConfig({ ...config, ...values });
    message.success("配置已保存");
  };

  const handleAddRule = () => {
    const newRule: EscalationRule = {
      id: Date.now().toString(),
      condition: "confidence_low",
      threshold: 0.6,
      action: "human_intervention",
      priority: "medium",
    };
    setEditingRule(newRule);
    setIsModalVisible(true);
  };

  const handleEditRule = (rule: EscalationRule) => {
    setEditingRule(rule);
    setIsModalVisible(true);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = config.escalationRules.filter((r) => r.id !== ruleId);
    setConfig({ ...config, escalationRules: updatedRules });
    message.success("规则已删除");
  };

  const handleSaveRule = () => {
    if (!editingRule) return;

    const existingIndex = config.escalationRules.findIndex(
      (r) => r.id === editingRule.id,
    );
    let updatedRules;
    if (existingIndex >= 0) {
      updatedRules = [...config.escalationRules];
      updatedRules[existingIndex] = editingRule;
    } else {
      updatedRules = [...config.escalationRules, editingRule];
    }

    setConfig({ ...config, escalationRules: updatedRules });
    setIsModalVisible(false);
    setEditingRule(null);
    message.success("规则已保存");
  };

  const escalationColumns = [
    {
      title: "触发条件",
      dataIndex: "condition",
      key: "condition",
      width: 150,
      render: (condition: string) => {
        const conditionMap: Record<string, string> = {
          confidence_low: "置信度低于阈值",
          manual_request: "用户请求人工",
          complex_question: "复杂问题",
          emotion_abnormal: "情绪异常",
          keyword_match: "关键词匹配",
        };
        return conditionMap[condition] || condition;
      },
    },
    {
      title: "阈值",
      dataIndex: "threshold",
      key: "threshold",
      width: 100,
      render: (value?: number) =>
        value !== undefined ? `${(value * 100).toFixed(0)}%` : "-",
    },
    {
      title: "处理动作",
      dataIndex: "action",
      key: "action",
      width: 150,
      render: (action: string) => {
        const actionMap: Record<string, string> = {
          human_intervention: "人工介入",
          pause_ai: "暂停AI",
          notify_adjuster: "通知理赔员",
        };
        return <Tag color="blue">{actionMap[action] || action}</Tag>;
      },
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (priority: string) => {
        const colorMap: Record<string, string> = {
          high: "red",
          medium: "orange",
          low: "green",
        };
        return <Tag color={colorMap[priority] || "default"}>{priority}</Tag>;
      },
    },
    {
      title: "操作",
      key: "action-btn",
      width: 120,
      render: (_: any, record: EscalationRule) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditRule(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRule(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: "24px" }}>AI授权配置</h2>

      {/* 全局配置 */}
      <Card title="全局AI配置" style={{ marginBottom: "24px" }}>
        <Form
          layout="vertical"
          initialValues={config}
          onFinish={handleSaveConfig}
        >
          <Form.Item
            label="启用AI自动答复"
            name="enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item label="授权级别" name="autoReplyLevel">
            <Select
              options={[
                { value: "full", label: "完全授权 - AI自动答复所有问题" },
                { value: "partial", label: "部分授权 - AI仅答复允许话题" },
                { value: "disabled", label: "禁用 - AI不自动答复" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="AI置信度阈值"
            name="maxConfidence"
            tooltip="当AI置信度低于此值时，建议人工介入"
          >
            <InputNumber
              min={0}
              max={1}
              step={0.1}
              precision={1}
              style={{ width: "100%" }}
              addonAfter="%"
            />
          </Form.Item>

          <Form.Item
            label="允许AI自动答复的话题"
            name="allowedTopics"
            tooltip="仅在选择'部分授权'时生效"
          >
            <Select
              mode="tags"
              options={[
                { value: "material_guidance", label: "材料指导" },
                { value: "progress_inquiry", label: "进度查询" },
                { value: "simple_questions", label: "简单问题" },
                { value: "policy_inquiry", label: "保单咨询" },
                { value: "claim_reporting", label: "理赔报案" },
              ]}
              placeholder="选择允许的话题"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" size="large">
              保存全局配置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 升级规则 */}
      <Card
        title="人工介入升级规则"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddRule}
          >
            添加规则
          </Button>
        }
      >
        <p style={{ color: "#666", marginBottom: "16px" }}>
          配置在什么情况下需要人工介入接管对话
        </p>

        <Table
          columns={escalationColumns}
          dataSource={config.escalationRules}
          rowKey="id"
          pagination={false}
          size="middle"
        />

        <Divider />

        <div style={{ fontSize: "14px", color: "#666" }}>
          <strong>规则说明：</strong>
          <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
            <li>规则按顺序执行，优先级高的规则优先触发</li>
            <li>置信度低于阈值时自动触发人工介入</li>
            <li>用户明确请求人工时立即升级</li>
            <li>可配置关键词检测，匹配特定词汇时触发规则</li>
          </ul>
        </div>
      </Card>

      {/* 编辑规则弹窗 */}
      <Modal
        title={editingRule?.id ? "编辑升级规则" : "添加升级规则"}
        open={isModalVisible}
        onOk={handleSaveRule}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingRule(null);
        }}
        width={600}
      >
        {editingRule && (
          <Form layout="vertical">
            <Form.Item label="触发条件">
              <Select
                value={editingRule.condition}
                onChange={(value) =>
                  setEditingRule({ ...editingRule, condition: value })
                }
                options={[
                  { value: "confidence_low", label: "置信度低于阈值" },
                  { value: "manual_request", label: "用户请求人工" },
                  { value: "complex_question", label: "复杂问题" },
                  { value: "emotion_abnormal", label: "情绪异常" },
                  { value: "keyword_match", label: "关键词匹配" },
                ]}
              />
            </Form.Item>

            {editingRule.condition === "confidence_low" && (
              <Form.Item label="置信度阈值">
                <InputNumber
                  min={0}
                  max={1}
                  step={0.1}
                  precision={2}
                  value={editingRule.threshold}
                  onChange={(value) =>
                    setEditingRule({ ...editingRule, threshold: value })
                  }
                  style={{ width: "100%" }}
                  addonAfter="%"
                />
              </Form.Item>
            )}

            {editingRule.condition === "keyword_match" && (
              <Form.Item label="关键词（多个关键词用逗号分隔）">
                <Input placeholder="例如: 投诉, 不满意, 投诉" />
              </Form.Item>
            )}

            <Form.Item label="处理动作">
              <Select
                value={editingRule.action}
                onChange={(value) =>
                  setEditingRule({ ...editingRule, action: value })
                }
                options={[
                  { value: "human_intervention", label: "人工介入" },
                  { value: "pause_ai", label: "暂停AI自动答复" },
                  { value: "notify_adjuster", label: "仅通知理赔员" },
                ]}
              />
            </Form.Item>

            <Form.Item label="优先级">
              <Select
                value={editingRule.priority}
                onChange={(value) =>
                  setEditingRule({ ...editingRule, priority: value })
                }
                options={[
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default AIAuthorizationConfig;
