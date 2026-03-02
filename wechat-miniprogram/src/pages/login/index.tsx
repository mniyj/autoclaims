// 智能理赔微信小程序 - 登录页面（微信登录）

import React, { useState, useEffect } from 'react';
import Taro, { useLoadFontFace } from '@tarojs/taro';
import { View, Text, Button, Image } from '@tarojs/components';
import './index.scss';

function LoginPage() {
  const [loading, setLoading] = useState(false);

  useLoadFontFace({
    family: 'PingFang SC',
    source: 'url',
    success: () => {
      console.log('Font loaded');
    }
  });

  useEffect(() => {
    // 检查是否已登录
    const token = Taro.getStorageSync('token');
    if (token) {
      Taro.reLaunch({
        url: '/pages/chat/index'
      });
    }
  }, []);

  const handleWechatLogin = async () => {
    try {
      setLoading(true);

      // 调用微信登录
      const loginRes = await Taro.login({
        provider: 'weixin',
        success: (res) => {
          const { userInfo } = res;

          // 调用后端验证微信用户
          verifyWechatUser({
            openid: userInfo.openId,
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl
          }).then(data => {
            // 保存token和用户信息
            Taro.setStorageSync('token', data.token);
            Taro.setStorageSync('userInfo', JSON.stringify(data.userInfo));

            Taro.showToast({
              title: '登录成功',
              icon: 'success'
            });

            // 跳转到聊天页面
            setTimeout(() => {
              Taro.reLaunch({
                url: '/pages/chat/index'
              });
            }, 500);
          }).catch(error => {
            Taro.showToast({
              title: '登录失败',
              icon: 'none'
            });
          });
        },
        fail: (err) => {
          console.error('微信登录失败:', err);
          Taro.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
        }
      });

      setLoading(false);
    } catch (error) {
      console.error('登录过程出错:', error);
      setLoading(false);
      Taro.showToast({
        title: '登录出错',
        icon: 'none'
      });
    }
  };

  /**
   * 验证微信用户并登录
   */
  const verifyWechatUser = async (openid: string, nickName: string, avatarUrl: string) => {
    const res = await Taro.request({
      url: '/api/wechat/login',
      method: 'POST',
      data: { openid, nickName, avatarUrl }
    });

    return res.data;
  };

  return (
    <View className="login-page">
      <View className="login-header">
        <Image
          src="https://gw.alipayobjects.com/zos/bmw-prod/d7490aea-bbd4-4031-97c4-497ee4d19be3.ico"
          className="logo"
          mode="aspectFit"
        />
        <Text className="app-title">智能理赔助手</Text>
      </View>

      <View className="login-content">
        <View className="welcome-section">
          <Image
            src="https://gw.alipayobjects.com/zos/bmw-prod/d7490aea-bbd4-4031-97c4-497ee4d19be3.ico"
            className="app-icon"
            mode="aspectFit"
          />
          <Text className="welcome-title">欢迎使用智能理赔助手</Text>
          <Text className="welcome-subtitle">专业的保险理赔服务，快速、透明、便捷</Text>
        </View>

        <View className="login-actions">
          <Button
            className="wechat-login-btn"
            type="primary"
            loading={loading}
            onClick={handleWechatLogin}
            size="large"
          >
            <Image
              src="https://img.icons8.com/wechat/32x32/wechat_logo.png"
              className="wechat-icon"
            />
            <Text className="btn-text">{loading ? '登录中...' : '微信一键登录'}</Text>
          </Button>
        </View>

        <View className="features-section">
          <View className="feature-item">
            <Text className="feature-icon">📱</Text>
            <View className="feature-content">
              <Text className="feature-title">智能客服</Text>
              <Text className="feature-desc">24小时在线，快速响应</Text>
            </View>
          </View>
          <View className="feature-item">
            <Text className="feature-icon">⚡️</Text>
            <View className="feature-content">
              <Text className="feature-title">材料审核</Text>
              <Text className="feature-desc">AI智能识别，快速审核</Text>
            </View>
          </View>
          <View className="feature-item">
            <Text className="feature-icon">📊</Text>
            <View className="feature-content">
              <Text className="feature-title">进度追踪</Text>
              <Text className="feature-desc">实时更新理赔进度</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default LoginPage;
