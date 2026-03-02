import { defineUserConfig } from '@tarojs/taro';
import path from 'path';

const config = defineUserConfig({
  pages: [
    'pages/chat/index',
    'pages/report/index',
    'pages/upload/index',
    'pages/progress/index',
    'pages/documents/index',
    'pages/login/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '智能理赔',
    navigationBarTextStyle: 'black',
    enablePullDownRefresh: false
  },
  tabBar: {
    color: '#999',
    selectedColor: '#1677ff',
    backgroundColor: '#fff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/chat/index',
        text: '对话',
        iconPath: 'assets/images/chat.png',
        selectedIconPath: 'assets/images/chat-active.png'
      },
      {
        pagePath: 'pages/report/index',
        text: '报案',
        iconPath: 'assets/images/report.png',
        selectedIconPath: 'assets/images/report-active.png'
      },
      {
        pagePath: 'pages/progress/index',
        text: '进度',
        iconPath: 'assets/images/progress.png',
        selectedIconPath: 'assets/images/progress-active.png'
      }
    ]
  },
  server: {
    port: 8082,
    host: 'localhost'
  },
  projectRoot: path.resolve(__dirname, '..'),
  designWidth: 750,
  deviceRatio: {
    '640': 2.34 / 2,
    '750': 1,
    '828': 1.81 / 2,
    '375': 2.34 / 2
  }
});

export default config;
