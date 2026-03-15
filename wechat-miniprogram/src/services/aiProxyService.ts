import Taro from '@tarojs/taro';

const getSessionId = (): string => `wechat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const generateContentViaProxy = async (params: {
  model: string;
  contents: any;
  config?: any;
  operation: string;
  context?: Record<string, any>;
}) => {
  const response = await Taro.request({
    url: '/api/ai/proxy',
    method: 'POST',
    data: {
      model: params.model,
      contents: params.contents,
      config: params.config,
      meta: {
        sourceApp: 'wechat-miniprogram',
        module: 'wechat-miniprogram',
        operation: params.operation,
        sessionId: getSessionId(),
        context: params.context,
      },
    },
    header: {
      'Content-Type': 'application/json',
    },
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    const errorMessage = (response.data as any)?.error || 'AI proxy failed';
    throw new Error(errorMessage);
  }

  return response.data as any;
};
