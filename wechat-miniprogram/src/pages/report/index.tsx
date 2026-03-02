// 智能理赔微信小程序 - 报案页面（适配Taro）

import React, { useState } from 'react';
import Taro, { navigateTo, showToast } from '@tarojs/taro';
import { View, Text, Input, Picker, Textarea, Button } from '@tarojs/components';
import './index.scss';

interface ReportFormData {
  incidentType: string;
  incidentTime: string;
  incidentLocation: string;
  description: string;
  policyNumber?: string;
}

function ReportPage() {
  const [formData, setFormData] = useState<ReportFormData>({
    incidentType: '',
    incidentTime: '',
    incidentLocation: '',
    description: ''
  });

  const incidentTypes = [
    { label: '交通事故', value: 'auto' },
    { label: '医疗事故', value: 'medical' },
    { label: '财产损失', value: 'property' },
    { label: '其他', value: 'other' }
  ];

  const handleInputChange = (field: keyof ReportFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // 验证必填项
    if (!formData.incidentType || !formData.incidentTime || !formData.description) {
      showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    try {
      Taro.showLoading({ title: '正在提交...' });

      // 调用后端API创建理赔案件
      const res = await Taro.request({
        url: '/api/claims/create',
        method: 'POST',
        data: formData
      });

      if (res.data.success) {
        showToast({
          title: '报案成功',
          icon: 'success'
        });

        // 跳转到聊天页面
        navigateTo({
          url: '/pages/chat/index'
        });
      } else {
        showToast({
          title: res.data.message || '报案失败',
          icon: 'none'
        });
      }
    } catch (error) {
      Taro.hideLoading();
      console.error('报案失败:', error);
      showToast({
        title: '报案失败，请重试',
        icon: 'none'
      });
    }
  };

  return (
    <View className="report-page">
      <View className="report-header">
        <Button size="mini" onClick={() => navigateTo({ url: '/pages/chat/index' })}>
          返回
        </Button>
        <Text className="header-title">理赔报案</Text>
      </View>

      <View className="report-form">
        <View className="form-group">
          <Text className="form-label">事故类型</Text>
          <Picker
            mode="selector"
            range={incidentTypes}
            value={formData.incidentType}
            onChange={(e) => handleInputChange('incidentType', e.detail.value)}
          >
            <Picker.View>
              <Text className="picker-item">{formData.incidentType || '请选择'}</Text>
            </Picker.View>
          </Picker>
        </View>

        <View className="form-group">
          <Text className="form-label">发生时间</Text>
          <Picker
            mode="date"
            value={formData.incidentTime}
            onChange={(e) => handleInputChange('incidentTime', e.detail.value)}
          >
            <Picker.View>
              <Text className="picker-item">
                {formData.incidentTime || '请选择日期时间'}
              </Text>
            </Picker.View>
          </Picker>
        </View>

        <View className="form-group">
          <Text className="form-label">发生地点</Text>
          <Input
            className="form-input"
            placeholder="请输入事故发生地点"
            value={formData.incidentLocation}
            onInput={(e) => handleInputChange('incidentLocation', e.detail.value)}
          />
        </View>

        <View className="form-group">
          <Text className="form-label">事故描述</Text>
          <Textarea
            className="form-textarea"
            placeholder="请详细描述事故经过"
            value={formData.description}
            onInput={(e) => handleInputChange('description', e.detail.value)}
            maxlength={500}
          />
        </View>

        <View className="form-group">
          <Text className="form-label">保单号码</Text>
          <Input
            className="form-input"
            placeholder="如有保单请输入"
            value={formData.policyNumber}
            onInput={(e) => handleInputChange('policyNumber', e.detail.value)}
          />
        </View>

        <View className="form-actions">
          <Button
            className="submit-btn"
            type="primary"
            onClick={handleSubmit}
          >
            提交报案
          </Button>
        </View>
      </View>
    </View>
  );
}

export default ReportPage;
