import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cn.yizuw.magic',
  appName: '魔镜',
  server: {
    // 需要取消注释此部分以设置 androidScheme
    /**
     * @function
     * @description 设置 Android 平台的 scheme 为 http。
     * 这样 Capacitor 会通过 http://localhost 提供应用打包的本地内容，
     * 而不是 https://localhost。
     */
    androidScheme: 'http',
    /**
     * @function
     * @description 允许明文流量，配合 AndroidManifest.xml 中的 usesCleartextTraffic="true"
     * 确保应用可以向 http:// 地址发起请求（如果您的API也是HTTP）。
     */
    cleartext: true,
    // hostname: 'localhost', // 如果不使用实时重载，可以保持注释
    // url: 'http://10.0.2.2:5555', // 如果不使用实时重载，可以保持注释
  },
  webDir: 'dist',
  // bundledWebRuntime: false, // 默认为 false，Capacitor 核心功能通过原生代码提供
};

export default config;
