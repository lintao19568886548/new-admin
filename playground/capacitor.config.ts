import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cn.yizuw.magic',
  appName: '魔镜',
  server: {
    androidScheme: 'https', // 如果您的本地开发服务器使用 HTTPS
    // hostname: 'localhost', // 用于 live reload
    cleartext: true, // 如果本地开发API是http，可能需要允许明文流量
    // 如果您的后端 API 在本地运行 (例如 http://localhost:3000)
    // 安卓模拟器通常通过 http://10.0.2.2 访问宿主机的 localhost
    url: 'https://yizuw.cn/', // 用于本地开发时代理 API 请求
  },
  webDir: 'dist',
  // bundledWebRuntime: false, // 默认为 false，Capacitor 核心功能通过原生代码提供
};

export default config;
