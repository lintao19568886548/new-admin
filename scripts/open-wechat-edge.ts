/**
 * 使用 Microsoft Edge 浏览器打开微信公众平台
 * 简单版本：只打开浏览器，你自己操作
 */

import { chromium } from 'playwright';

async function openWithEdge() {
  console.log('🚀 使用 Microsoft Edge 启动...\n');

  const browser = await chromium.launch({
    args: ['--start-maximized'],
    channel: 'msedge', // 使用系统安装的 Edge 浏览器
    headless: false,
  });

  const context = await browser.newContext({
    viewport: null, // 使用最大化窗口
  });

  const page = await context.newPage();

  console.log('📱 打开微信公众平台...\n');
  await page.goto('https://mp.weixin.qq.com/');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Edge 浏览器已打开微信公众平台');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 操作步骤：');
  console.log('1. 📱 扫码登录');
  console.log('2. 🔍 左侧菜单 → 设置与开发 → 开发 → 基本配置');
  console.log('3. 📋 复制 AppID 和 AppSecret');
  console.log('4. 💾 保存到 apps/backend-mock/.env');
  console.log('\n💡 配置格式：');
  console.log('   WECHAT_APP_ID=你的AppID');
  console.log('   WECHAT_APP_SECRET=你的AppSecret');
  console.log('\n⏰ 浏览器会一直保持打开');
  console.log('   完成后按 Ctrl+C 关闭\n');

  // 保持浏览器打开
  await new Promise(() => {});
}

openWithEdge().catch((error) => {
  console.error('\n❌ 启动失败：', error.message);

  if (
    error.message.includes('browserType.launch') ||
    error.message.includes('msedge')
  ) {
    console.log('\n💡 解决方法：');
    console.log('   可能系统没有安装 Edge 浏览器');
    console.log('   或者 Playwright 无法找到 Edge');
    console.log('\n   尝试运行：');
    console.log('   pnpm exec playwright install msedge\n');
  }
});
