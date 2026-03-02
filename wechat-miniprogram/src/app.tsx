import Taro, { useState, useEffect } from '@tarojs/taro';
import { useLoadFontFace } from '@tarojs/taro';
import { ClaimStatus, ClaimState, Message } from './types';

import './app.scss';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  // 加载中文字体
  useLoadFontFace({
    family: 'PingFang SC',
    source: 'url',
    success() {
      console.log('Font loaded');
    }
  });

  useEffect(() => {
    // 检查登录状态
    const token = Taro.getStorageSync('token');
    const userData = Taro.getStorageSync('userInfo');

    if (token && userData) {
      setIsLoggedIn(true);
      setUserInfo(JSON.parse(userData));
    }
  }, []);

  return (
    <View className="app">
      {isLoggedIn ? (
        // 已登录 - 显示主界面（聊天等）
        <View className="app-content">
          {/* 这里将通过Taro的路由显示对应页面 */}
        </View>
      ) : (
        // 未登录 - 显示登录页
        <View className="login-container">
          <View className="login-header">
            <Image
              src="https://gw.alipayobjects.com/zos/bmw-prod/d7490aea-bbd4-4031-97c4-497ee4d19be3.ico"
              className="logo"
              mode="aspectFit"
            />
            <Text className="app-title">智能理赔助手</Text>
          </View>

          <View className="login-content">
            <Text className="welcome">欢迎使用智能理赔助手</Text>
            <Text className="subtitle">请登录以继续</Text>

            <Button
              className="login-btn"
              onClick={() => handleWechatLogin()}
            >
              微信一键登录
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * 微信登录处理
 */
const handleWechatLogin = async () => {
  try {
    Taro.showLoading({
      title: '正在登录...',
    });

    // 调用微信登录
    const loginRes = await Taro.login({
      provider: 'weixin',
      success: () => {
        // 获取用户信息
        Taro.getUserProfile({
          success: (res) => {
            const { userInfo } = res;

            // 调用后端API进行登录验证
            verifyWechatUser({
              openid: userInfo.openId,
              nickName: userInfo.nickName,
              avatarUrl: userInfo.avatarUrl
            }).then(data => {
              // 保存token和用户信息
              Taro.setStorageSync('token', data.token);
              Taro.setStorageSync('userInfo', JSON.stringify(data.userInfo));

              setIsLoggedIn(true);
              setUserInfo(data.userInfo);

              Taro.hideLoading();
              Taro.showToast({
                title: '登录成功',
                icon: 'success'
              });
            }).catch(error => {
              Taro.hideLoading();
              Taro.showToast({
                title: '登录失败',
                icon: 'none'
              });
            });
          },
          fail: (err) => {
            Taro.hideLoading();
            Taro.showToast({
              title: '获取用户信息失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        Taro.hideLoading();
        console.error('微信登录失败:', err);
        Taro.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      }
    });
  } catch (error) {
    Taro.hideLoading();
    console.error('登录过程出错:', error);
    Taro.showToast({
      title: '登录出错',
      icon: 'none'
    });
  }
};

/**
 * 调用后端验证微信用户
 */
const verifyWechatUser = async (openid: string, nickName: string, avatarUrl: string) => {
  const res = await Taro.request({
    url: '/api/wechat/login',
    method: 'POST',
    data: {
      openid,
      nickName,
      avatarUrl
    }
  });

  return res.data;
};

export default App;
