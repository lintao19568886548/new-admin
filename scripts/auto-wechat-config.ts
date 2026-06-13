/**
 * 全自动版本：使用 Edge 浏览器自动获取微信配置并保存
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium } from 'playwright';

const ENV_FILE_PATH = resolve(process.cwd(), 'apps/backend-mock/.env');

async function autoGetWechatConfig() {
  console.log('🚀 使用 Microsoft Edge 启动全自动配置...\n');

  const browser = await chromium.launch({
    args: ['--start-maximized'],
    channel: 'msedge',
    headless: false,
  });

  const context = await browser.newContext({
    viewport: null,
  });

  const page = await context.newPage();

  try {
    console.log('📱 打开微信公众平台...');
    await page.goto('https://mp.weixin.qq.com/');
    await page.waitForTimeout(2000);

    console.log('⏳ 等待扫码登录...');
    console.log('👉 请使用微信扫描浏览器中的二维码\n');

    // 等待登录成功
    let loginSuccess = false;
    for (let i = 0; i < 90; i++) {
      const url = page.url();
      const hasQR = await page
        .locator('.login__type__container__scan__qrcode')
        .isVisible()
        .catch(() => false);

      if (!hasQR || url.includes('/cgi-bin/') || url.length > 40) {
        loginSuccess = true;
        break;
      }

      if (i % 10 === 0 && i > 0) {
        console.log(`⏰ 等待中... (${i * 2}秒)`);
      }

      await page.waitForTimeout(2000);
    }

    if (!loginSuccess) {
      throw new Error('登录超时，请重试');
    }

    console.log('✅ 登录成功！\n');
    await page.waitForTimeout(3000);

    console.log('🔍 正在自动导航到配置页面...');

    // 尝试多个可能的配置页面URL
    const configUrls = [
      'https://mp.weixin.qq.com/advanced/advanced?action=dev&t=advanced/dev',
      'https://mp.weixin.qq.com/wxopen/devprofile?action=get_profile',
      'https://mp.weixin.qq.com/advanced/advanced?action=interface&t=advanced/interface',
    ];

    let foundConfig = false;
    let appId = '';
    let appSecret = '';

    for (const url of configUrls) {
      try {
        console.log(`   尝试: ${url.split('?')[0]}`);
        await page.goto(url, {
          timeout: 15_000,
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(3000);

        const pageText = await page.textContent('body').catch(() => '');

        if (
          pageText.includes('AppID') ||
          pageText.includes('开发者ID') ||
          pageText.includes('appid')
        ) {
          console.log('   ✅ 找到配置页面！');
          foundConfig = true;

          // 提取 AppID
          appId = await extractAppId(page);
          if (appId) {
            console.log(`   ✅ 提取到 AppID: ${appId}`);
          }

          // 尝试提取或获取 AppSecret
          appSecret = await extractAppSecret(page);
          if (appSecret) {
            console.log(`   ✅ 提取到 AppSecret: ${appSecret}`);
          }

          break;
        }
      } catch {
        console.log('   ❌ 该URL无效');
      }
    }

    if (!foundConfig) {
      throw new Error('无法找到配置页面，请手动操作');
    }

    // 如果没有找到 AppSecret，尝试点击按钮获取
    if (appId && !appSecret) {
      console.log('\n🔐 AppSecret 未显示，尝试点击按钮...');
      appSecret = await clickToGetSecret(page);
    }

    // 保存配置
    if (appId) {
      console.log('\n💾 正在保存配置到 .env 文件...');
      await saveToEnv(appId, appSecret);
      console.log('✅ 配置已保存！\n');

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 配置信息：');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`WECHAT_APP_ID=${appId}`);
      if (appSecret) {
        console.log(`WECHAT_APP_SECRET=${appSecret}`);
      } else {
        console.log('WECHAT_APP_SECRET=<需要手动获取>');
        console.log('\n⚠️  AppSecret 未能自动获取，请：');
        console.log('   1. 在当前打开的页面中找到"重置"或"查看"按钮');
        console.log('   2. 点击后可能需要扫码');
        console.log('   3. 复制显示的 AppSecret');
        console.log('   4. 手动添加到 apps/backend-mock/.env');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      throw new Error('未能提取到 AppID');
    }

    if (appSecret) {
      console.log('✅ 配置完成！浏览器将在 10 秒后关闭...\n');
      await page.waitForTimeout(10_000);
    } else {
      console.log('⏰ 浏览器将保持打开 5 分钟供你手动获取 AppSecret');
      console.log('   完成后按 Ctrl+C 关闭\n');
      await page.waitForTimeout(300_000);
    }
  } catch (error: any) {
    console.error('\n❌ 发生错误：', error.message);
    console.log('\n浏览器将保持打开 5 分钟供你手动操作');
    console.log('按 Ctrl+C 可随时关闭\n');
    await page.waitForTimeout(300_000);
  } finally {
    await browser.close();
  }
}

async function extractAppId(page: any): Promise<string> {
  try {
    const pageText = await page.textContent('body').catch(() => '');
    const match = pageText.match(/\b(wx[a-z0-9]{16})\b/i);
    if (match) {
      return match[1];
    }

    // 尝试从输入框或代码块获取
    const elements = await page.locator('input, code, pre, span').all();
    for (const element of elements) {
      const value = await element
        .inputValue()
        .catch(() => element.textContent().catch(() => ''));
      if (value && /^wx[a-z0-9]{16}$/i.test(value.trim())) {
        return value.trim();
      }
    }

    return '';
  } catch {
    return '';
  }
}

async function extractAppSecret(page: any): Promise<string> {
  try {
    const pageText = await page.textContent('body').catch(() => '');
    const match = pageText.match(/\b([a-f0-9]{32})\b/i);
    if (match && /[a-f]/.test(match[1]) && /\d/.test(match[1])) {
      return match[1];
    }

    const elements = await page
      .locator('code, pre, input[type="password"], input[type="text"]')
      .all();
    for (const element of elements) {
      const value = await element
        .inputValue()
        .catch(() => element.textContent().catch(() => ''));
      if (value && /^[a-f0-9]{32}$/i.test(value.trim())) {
        return value.trim();
      }
    }

    return '';
  } catch {
    return '';
  }
}

async function clickToGetSecret(page: any): Promise<string> {
  try {
    const buttonTexts = ['重置', '查看', '生成', '获取'];

    for (const text of buttonTexts) {
      const buttons = await page.locator(`button:has-text("${text}")`).all();
      for (const button of buttons) {
        if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`   找到"${text}"按钮，点击中...`);
          await button.click().catch(() => {});
          await page.waitForTimeout(3000);

          console.log('   ⏳ 如果需要扫码，请在手机上确认...');
          await page.waitForTimeout(5000);

          const secret = await extractAppSecret(page);
          if (secret) {
            console.log(`   ✅ 成功获取 AppSecret`);
            return secret;
          }
        }
      }
    }

    return '';
  } catch {
    return '';
  }
}

async function saveToEnv(appId: string, appSecret: string): Promise<void> {
  try {
    let envContent = '';

    try {
      envContent = readFileSync(ENV_FILE_PATH, 'utf8');
    } catch {
      console.log('   .env 文件不存在，将创建新文件');
    }

    const lines = envContent.split('\n');
    let hasAppId = false;
    let hasAppSecret = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('WECHAT_APP_ID=')) {
        lines[i] = `WECHAT_APP_ID=${appId}`;
        hasAppId = true;
      }
      if (lines[i].startsWith('WECHAT_APP_SECRET=')) {
        if (appSecret) {
          lines[i] = `WECHAT_APP_SECRET=${appSecret}`;
        }
        hasAppSecret = true;
      }
    }

    if (!hasAppId) {
      lines.push(`WECHAT_APP_ID=${appId}`);
    }
    if (!hasAppSecret && appSecret) {
      lines.push(`WECHAT_APP_SECRET=${appSecret}`);
    }

    writeFileSync(ENV_FILE_PATH, lines.join('\n'), 'utf8');
    console.log(`   ✅ 已保存到: ${ENV_FILE_PATH}`);
  } catch (error: any) {
    console.error(`   ❌ 保存失败: ${error.message}`);
    throw error;
  }
}

autoGetWechatConfig().catch((error) => {
  console.error('\n❌ 程序异常：', error);
  process.exit(1);
});
