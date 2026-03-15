// 智能理赔微信小程序 - 聊天页面（适配Taro）
// 从 smartclaim-ai-agent/App.tsx 迁移

import React, { useState, useEffect, useRef } from 'react';
import Taro, { useLoadFontFace, navigateTo, showToast } from '@tarojs/taro';
import { View, Text, Input, Image, ScrollView, Button } from '@tarojs/components';
import { ClaimState, ClaimStatus, Message, Attachment, DocumentAnalysis } from '../../types';
import { getAIResponse, transcribeAudio } from '../../services/geminiService';
import { chooseAndUploadImage, uploadToOSS, compressImage } from '../../services/ossService';
import './index.scss';

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [claimState, setClaimState] = useState<ClaimState>({
    status: ClaimStatus.REPORTING,
    reportInfo: {},
    requiredDocs: [
      { name: '医疗发票', description: '医院开具的正规发票', example: 'jpg/png', received: false, notes: '' },
      { name: '出院小结', description: '医院提供的出院记录', example: 'pdf', received: false, notes: '' },
      { name: '诊断证明', description: '确诊病情的诊断书', example: 'jpg/pdf', received: false, notes: '' }
    ],
    documents: [],
    assessment: undefined
  });
  const [isTyping, setIsTyping] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const scrollViewRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 初始化消息
  useEffect(() => {
    const savedMessages = Taro.getStorageSync('messages');
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages);
      // 迁移旧消息：确保每条消息都有 role 字段
      const migratedMessages = parsedMessages.map((msg: Message) => ({
        ...msg,
        role: msg.role || '' // 旧消息没有 role 字段，默认为空字符串
      }));
      setMessages(migratedMessages);
    }

    // 加载用户位置
    Taro.getLocation({
      type: 'wgs84',
      success: (res) => {
        setUserLocation({
          latitude: res.latitude,
          longitude: res.longitude
        });
      },
      fail: (err) => {
        console.warn('获取位置失败:', err);
      }
    });
  }, []);

  // 自动滚动到底部
  setTimeout(() => {
    scrollViewRef.current?.scrollTo({ top: 99999, animated: true });
  }, 500);

  // 保存消息到本地存储
  useEffect(() => {
    Taro.setStorageSync('messages', JSON.stringify(messages));
  }, [messages]);

  /**
   * 发送消息
   */
  const handleSendMessage = async (content: string, attachments?: Attachment[]) => {
    if (!content.trim()) return;

    // 添加用户消息
    const userMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments
    };
    setMessages(prev => [...prev, userMessage]);

    setIsTyping(true);

    try {
      // 调用AI获取回复
      const aiMessage = await getAIResponse(
        [{ role: 'user', content }],
        claimState,
        userLocation || undefined
      );

      // 添加AI回复
      setMessages(prev => [...prev, aiMessage]);

      // TODO: 通过WebSocket发送消息到后端，实现实时同步
      // const wsResponse = await websocketService.sendMessage(userMessage);
      // const wsMessage = { ...aiMessage, sender: { type: 'human', id: adjusterId, name: adjusterName } };
      // await websocketService.sendMessage(wsMessage);

    } catch (error) {
      console.error('AI响应失败:', error);
      showToast({
        title: '消息发送失败',
        icon: 'none'
      });
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * 上传图片附件
   */
  const handleImageUpload = async () => {
    try {
      Taro.showLoading({ title: '正在上传...' });

      const { url, objectKey } = await chooseAndUploadImage(1);

      const userMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: '我上传了一张图片',
        timestamp: Date.now(),
        attachments: [{ url, ossKey: objectKey, name: '图片.jpg', type: 'image' }]
      };

      setMessages(prev => [...prev, userMessage]);

      // 触发AI分析
      handleSendMessage('请帮我分析这张图片', [{ url, ossKey: objectKey, name: '图片.jpg', type: 'image' }]);

      Taro.hideLoading();
    } catch (error) {
      Taro.hideLoading();
      showToast({
        title: '上传失败',
        icon: 'none'
      });
    }
  };

  /**
   * 语音输入（小程序语音识别）
   */
  const handleVoiceInput = async () => {
    try {
      Taro.showLoading({ title: '正在录音...' });

      const recorderManager = Taro.getRecorderManager();
      const recorder = await recorderManager.getRecorder();

      await recorder.start({
        duration: 60000, // 60秒
        format: 'wav'
      });

      showToast({
        title: '开始录音...',
        icon: 'success'
      });

      // 停止录音
      const { tempFilePath } = await recorder.stop();

      // 转换为base64
      const base64 = await Taro.getFileSystemManager().readFileSync(tempFilePath, 'base64');

      // 转录文字
      const text = await transcribeAudio(base64);

      const userMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: text,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, userMessage]);

      // 发送消息
      handleSendMessage(text);

      Taro.hideLoading();
    } catch (error) {
      Taro.hideLoading();
      console.error('语音识别失败:', error);
      showToast({
        title: '语音识别失败',
        icon: 'none'
      });
    }
  };

  /**
   * 跳转到报案页面
   */
  const handleGoToReport = () => {
    navigateTo({
      url: '/pages/report/index'
    });
  };

  /**
   * 跳转到进度查询
   */
  const handleGoToProgress = () => {
    navigateTo({
      url: '/pages/progress/index'
    });
  };

  /**
   * 点赞消息
   */
  const handleLike = (messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        return {
          ...msg,
          reactions: {
            ...reactions,
            liked: !reactions.liked,
            disliked: reactions.liked ? false : reactions.disliked // 取消点踩
          }
        };
      }
      return msg;
    }));
  };

  /**
   * 点踩消息
   */
  const handleDislike = (messageId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || {};
        return {
          ...msg,
          reactions: {
            ...reactions,
            disliked: !reactions.disliked,
            liked: reactions.disliked ? false : reactions.liked // 取消点赞
          }
        };
      }
      return msg;
    }));
  };

  /**
   * 复制消息内容
   */
  const handleCopy = (content: string) => {
    Taro.setClipboardData({
      data: content,
      success: () => {
        showToast({ title: '已复制', icon: 'success' });
      }
    });
  };

  /**
   * 分享消息
   */
  const handleShare = (message: Message) => {
    Taro.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  };

  /**
   * 渲染消息组件
    */
  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const isAI = message.role === 'assistant';

    // 仅对非用户消息显示操作按钮
    const showActions = message.role && message.role !== 'user';

    return (
      <View
        key={message.id}
        className={`message-item ${isUser ? 'user' : isAI ? 'ai' : 'human'}`}
      >
        {/* 消息内容 */}
        <View className="message-content">
          <Text className="message-text">{message.content}</Text>

          {/* 附件列表 */}
          {message.attachments && message.attachments.length > 0 && (
            <View className="message-attachments">
              {message.attachments.map((att, index) => (
                <View key={index} className="attachment">
                  {att.type === 'image' ? (
                    <Image
                      src={att.url}
                      className="attachment-image"
                      mode="aspectFit"
                      lazyLoad
                    />
                  ) : (
                    <View className="file-attachment">
                      <Text className="file-name">{att.name}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* 分析结果 */}
          {message.analysisResults && message.analysisResults.length > 0 && (
            <View className="analysis-results">
              {message.analysisResults.map((analysis, index) => (
                <View key={index} className="analysis-item">
                  <Text className="analysis-label">分析类型: {analysis.category}</Text>
                  <Text className="analysis-score">清晰度: {analysis.clarityScore}</Text>
                  <Text className="analysis-summary">{analysis.summary}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 时间戳 */}
        <Text className="message-time">
          {new Date(message.timestamp).toLocaleString()}
        </Text>

        {/* 操作按钮 - 仅AI/理赔员消息显示 */}
        {showActions && (
          <View className="message-actions">
            <View 
              className={`action-btn ${message.reactions?.liked ? 'active' : ''}`}
              onClick={() => handleLike(message.id)}
            >
              <Text className="action-icon">👍</Text>
              <Text className="action-text">点赞</Text>
            </View>
            <View 
              className={`action-btn ${message.reactions?.disliked ? 'active' : ''}`}
              onClick={() => handleDislike(message.id)}
            >
              <Text className="action-icon">👎</Text>
              <Text className="action-text">点踩</Text>
            </View>
            <View 
              className="action-btn"
              onClick={() => handleCopy(message.content)}
            >
              <Text className="action-icon">📋</Text>
              <Text className="action-text">复制</Text>
            </View>
            <View 
              className="action-btn"
              onClick={() => handleShare(message)}
            >
              <Text className="action-icon">📤</Text>
              <Text className="action-text">分享</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="chat-page">
      {/* 顶部栏 */}
      <View className="chat-header">
        <View className="header-left">
          <Text className="header-title">智能理赔助手</Text>
          {claimState.status !== ClaimStatus.REPORTING && (
            <Button size="mini" onClick={handleGoToProgress}>
              查看进度
            </Button>
          )}
        </View>
        <View className="header-right">
          <Button size="mini" onClick={handleGoToReport}>
            新建理赔
          </Button>
        </View>
      </View>

      {/* 理赔状态信息 */}
      {claimState.status !== ClaimStatus.REPORTING && (
        <View className="claim-status">
          <Text className="status-label">当前状态：</Text>
          <Text className="status-value">
            {claimState.status === ClaimStatus.DOCUMENTING && '材料收集中'}
            {claimState.status === ClaimStatus.REVIEWING && '审核中'}
            {claimState.status === ClaimStatus.SETTLED && '已结案'}
          </Text>

          {claimState.assessment && claimState.assessment.isLiable !== undefined && (
            <View className="assessment-result">
              <Text className="assessment-label">
                {claimState.assessment.isLiable ? '✓ 属实' : '✗ 不属实'}
              </Text>
              <Text className="assessment-reason">
                {claimState.assessment.reasoning}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 消息列表 */}
      <ScrollView
        ref={scrollViewRef}
        scrollY
        className="message-list"
        enhanced
        showScrollbar={false}
      >
        {messages.map(message => renderMessage(message))}
      </ScrollView>

      {/* AI输入提示 */}
      {isTyping && (
        <View className="typing-indicator">
          <Text className="typing-text">AI正在输入...</Text>
        </View>
      )}

      {/* 输入区域 */}
      <View className="input-area">
        <View className="input-row">
          <Input
            ref={inputRef}
            className="message-input"
            placeholder="输入消息..."
            onConfirm={handleSendMessage}
            confirmType="send"
          />

          <Button className="voice-btn" onClick={handleVoiceInput}>
            🎤 语音
          </Button>

          <Button className="image-btn" onClick={handleImageUpload}>
            📷 图片
          </Button>
        </View>

        <Button
          className="send-btn"
          onClick={() => inputRef.current?.blur()}
        >
          发送
        </Button>
      </View>
    </View>
  );
}

export default ChatPage;
