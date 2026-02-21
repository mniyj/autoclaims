
import React, { useState } from 'react';

interface LoginUser {
  username: string;
  companyCode?: string;
  tool?: '智能体' | '省心配';
}

interface LoginPageProps {
  onLogin: (user: LoginUser) => void;
}

interface PasswordFormProps {
  username: string;
  password: string;
  isPasswordVisible: boolean;
  error: string;
  onUsernameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVisibilityToggle: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PasswordForm: React.FC<PasswordFormProps> = ({
  username,
  password,
  isPasswordVisible,
  error,
  onUsernameChange,
  onPasswordChange,
  onVisibilityToggle,
  onSubmit,
}) => (
  <form className="space-y-6" onSubmit={onSubmit}>
    <div>
      <label htmlFor="username" className="block text-sm font-medium text-gray-500">
        账号用户名
      </label>
      <div className="mt-2">
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={onUsernameChange}
          placeholder="请输入用户名"
          className="appearance-none block w-full px-3 py-2.5 border-b border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500 sm:text-sm transition"
        />
      </div>
    </div>

    <div>
      <label htmlFor="password"className="block text-sm font-medium text-gray-500">
        密码
      </label>
      <div className="mt-2 relative">
        <input
          id="password"
          name="password"
          type={isPasswordVisible ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={password}
          onChange={onPasswordChange}
          placeholder="请输入密码"
          className="appearance-none block w-full px-3 py-2.5 border-b border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-blue-500 sm:text-sm transition"
        />
        <button type="button" onClick={onVisibilityToggle} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">
          {isPasswordVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
          ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
          )}
        </button>
      </div>
    </div>
    
     <div className="flex items-center justify-between">
        <div className="text-sm">
          <a href="#" className="font-medium text-gray-500 hover:text-blue-500">
            忘记密码?
          </a>
        </div>
      </div>
    
    {error && (
      <p className="text-sm text-red-600 text-center">{error}</p>
    )}

    <div>
      <button
        type="submit"
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        登录
      </button>
    </div>
     <div className="text-center">
          <a href="#" className="font-medium text-blue-500 hover:text-blue-600 text-sm">
            立即注册 &gt;
          </a>
      </div>
  </form>
);

const QrCode = () => (
  <div className="flex flex-col items-center justify-center pt-8 pb-4">
      <h3 className="text-lg font-semibold text-gray-800">扫码登录</h3>
      <div className="relative w-48 h-48 mt-4 bg-gray-200 flex items-center justify-center">
        <svg className="w-44 h-44 text-gray-400" fill="none" viewBox="0 0 100 100" stroke="currentColor">
          <path d="M10 10h20v20H10z M15 15h10v10H15z M70 10h20v20H70z M75 15h10v10H75z M10 70h20v20H10z M15 75h10v10H15z M40 10h10v10H40z M60 10h10v10H60z M10 40h10v10H10z M10 60h10v10H10z M40 40h30v30H40z M45 45h20v20H45z M80 40h10v10H80z M40 80h10v10H40z M60 80h30v10H60z" strokeWidth="2" />
        </svg>
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-white p-1 rounded-md shadow-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12.83,6.33C12.83,6.33,12.83,6.33,12.83,6.33c0-0.41-0.34-0.75-0.75-0.75c-0.41,0-0.75,0.34-0.75,0.75 c0,0,0,0,0,0v0c0,2.06-0.84,3.93-2.22,5.29c-0.49,0.48-0.77,1.14-0.77,1.83v1.73c0,0.41,0.34,0.75,0.75,0.75 c0.41,0,0.75-0.34,0.75-0.75v-1.73c0-0.28,0.11-0.55,0.32-0.75c0.91-0.9,1.48-2.17,1.48-3.54V6.33z"/><path d="M19.75,10.02c0.35,0,0.66-0.23,0.73-0.57c0.11-0.5-0.24-0.98-0.74-0.98h-1.48c-0.41,0-0.75,0.34-0.75,0.75 s0.34,0.75,0.75,0.75H19.75z"/><path d="M4.25,10.02h1.48c0.41,0,0.75-0.34,0.75-0.75S6.14,8.52,5.73,8.52H4.25c-0.5,0-0.85,0.48-0.74,0.98 c0.07,0.34,0.38,0.57,0.73,0.57z"/><path d="M16.2,16.08c-1.89,0-3.43-1.53-3.44-3.42c-0.01-1.9,1.52-3.44,3.42-3.44s3.44,1.54,3.44,3.44 C19.62,14.55,18.09,16.08,16.2,16.08z M16.2,10.22c-1.34,0-2.43,1.09-2.43,2.43c0,1.34,1.09,2.43,2.43,2.43 c1.34,0,2.43-1.09,2.43-2.43C18.63,11.3,17.54,10.22,16.2,10.22z"/><path d="M7.8,16.08c-1.89,0-3.43-1.53-3.44-3.42c-0.01-1.9,1.52-3.44,3.42-3.44s3.44,1.54,3.44,3.44 C11.22,14.55,9.69,16.08,7.8,16.08z M7.8,10.22c-1.34,0-2.43,1.09-2.43,2.43c0,1.34,1.09,2.43,2.43,2.43 c1.34,0,2.43-1.09,2.43-2.43C10.23,11.3,9.14,10.22,7.8,10.22z"/></svg>
            </div>
         </div>
      </div>
      <p className="mt-4 text-sm text-gray-600">
          请使用 <span className="text-blue-500 font-medium">手机支付宝</span> 扫码
      </p>
  </div>
);

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'qr'>('password');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const valid =
      (username === 'test' && password === '123456') ||
      (username === 'gclife' && password === '123456') ||
      (username === 'admin' && password === '234567');
    if (valid) {
      setError('');
      const companyCode = username === 'test' ? 'xintai' : username === 'gclife' ? 'gclife' : undefined;
      const tool: '智能体' | '省心配' = username === 'test' ? '省心配' : '智能体';
      onLogin({ username, companyCode, tool });
    } else {
      setError('账号或密码错误，请重试');
    }
  };
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative bg-black">
        <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-50"
            src="https://gw.alipayobjects.com/v/huamei_gcee1x/afts/video/4mH9SrLaoIQAAAAAAAAAAAAAK4eUAQBr"
        >
            Your browser does not support the video tag.
        </video>
      <main className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8">
         <div className="w-full max-w-sm mx-auto">
             <div className="flex items-center">
                 <img src="https://gw.alipayobjects.com/mdn/rms_a9745b/afts/img/A*-BjkQLIEK0UAAAAAAAAAAAAAARQnAQ" alt="Ant Group Logo" className="h-10" />
                 <div className="w-px h-6 bg-gray-300 mx-4"></div>
                  
             </div>
             
             <div className="mt-8">
                 <div className="flex border-b border-gray-200">
                     <button onClick={() => setLoginMethod('password')} className={`px-4 py-2 text-sm font-semibold ${loginMethod === 'password' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>账号密码登录</button>
                     <button onClick={() => setLoginMethod('qr')} className={`px-4 py-2 text-sm font-semibold ${loginMethod === 'qr' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>短信登录</button>
                 </div>

                 <div className="pt-4">
                     {loginMethod === 'password' ? (
                        <PasswordForm
                            username={username}
                            password={password}
                            isPasswordVisible={isPasswordVisible}
                            error={error}
                            onUsernameChange={(e) => setUsername(e.target.value)}
                            onPasswordChange={(e) => setPassword(e.target.value)}
                            onVisibilityToggle={() => setIsPasswordVisible(!isPasswordVisible)}
                            onSubmit={handleLogin}
                        />
                     ) : (
                        <QrCode />
                     )}
                 </div>

                 <div className="mt-6">
                     <div className="relative">
                         <div className="absolute inset-0 flex items-center">
                             <div className="w-full border-t border-gray-300" />
                         </div>
                         
                     </div>
                     
                 </div>
             </div>
         </div>
      </main>
    </div>
  );
};

export default LoginPage;
