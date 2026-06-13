import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = process.cwd();
const ENV_PATH = resolve(ROOT, 'apps/backend-mock/.env');
const USER_DATA_DIR = resolve(ROOT, '.cache/wechat-mp-playwright');
const MP_HOME = 'https://mp.weixin.qq.com/';
const OAUTH_DOMAIN = process.env.WECHAT_OAUTH_DOMAIN || 'www.yizuw.cn';
const H5_BASE_URL = `https://${OAUTH_DOMAIN}`;

const rl = createInterface({ input, output });

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function mask(value) {
  if (!value) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function waitForEnter(message) {
  await rl.question(`${message}\nPress Enter to continue...`);
}

async function waitForAppIdOnCurrentPage(page, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const appId = await extractAppId(page);
    if (appId) return appId;
    await sleep(2000);
  }
  return '';
}

async function promptRequired(message, validate) {
  while (true) {
    const value = (await rl.question(message)).trim();
    if (validate(value)) return value;
    console.log('Invalid value, try again.');
  }
}

function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  const prefix = content.trimEnd();
  return `${prefix}${prefix ? '\n' : ''}${line}\n`;
}

function saveEnv({ appId, appSecret }) {
  mkdirSync(dirname(ENV_PATH), { recursive: true });
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';

  content = upsertEnv(content, 'WECHAT_APP_ID', appId);
  content = upsertEnv(content, 'WECHAT_APP_SECRET', appSecret);
  content = upsertEnv(content, 'CRM_INVITE_H5_BASE_URL', H5_BASE_URL);
  content = upsertEnv(content, 'CRM_MINIPROGRAM_QRCODE_PAGE', 'pages/home/index');

  writeFileSync(ENV_PATH, content, 'utf8');
}

async function getBodyText(page) {
  return page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
}

function getTokenFromUrl(url) {
  try {
    return new URL(url).searchParams.get('token') || '';
  } catch {
    return '';
  }
}

async function getMpToken(page) {
  const fromUrl = getTokenFromUrl(page.url());
  if (fromUrl) return fromUrl;

  const links = await page.locator('a[href*="token="]').all();
  for (const link of links.slice(0, 80)) {
    const href = await link.getAttribute('href').catch(() => '');
    const token = getTokenFromUrl(href || '');
    if (token) return token;
  }

  return '';
}

async function clickText(page, texts, options = {}) {
  for (const text of texts) {
    const locators = [
      page.getByText(text, { exact: true }),
      page.locator(`text=${text}`),
      page.locator(`a:has-text("${text}")`),
      page.locator(`button:has-text("${text}")`),
      page.locator(`li:has-text("${text}")`),
    ];

    for (const locator of locators) {
      const first = locator.first();
      if (await first.isVisible({ timeout: options.timeout || 1200 }).catch(() => false)) {
        await first.click({ timeout: 5000 }).catch(async () => first.dispatchEvent('click'));
        await sleep(options.afterClick || 1800);
        return true;
      }
    }
  }

  return false;
}

async function tryTokenUrls(page) {
  const token = await getMpToken(page);
  if (!token) return '';

  console.log(`Found MP token: ${token}`);
  const urls = [
    `https://mp.weixin.qq.com/advanced/advanced?action=dev&t=advanced/dev&token=${token}&lang=zh_CN`,
    `https://mp.weixin.qq.com/advanced/advanced?action=interface&t=advanced/interface&token=${token}&lang=zh_CN`,
    `https://mp.weixin.qq.com/cgi-bin/frame?t=advanced/dev_tools_frame&token=${token}&lang=zh_CN`,
    `https://mp.weixin.qq.com/cgi-bin/settingpage?t=setting/function&action=function&token=${token}&lang=zh_CN`,
  ];

  for (const url of urls) {
    console.log(`Trying token URL: ${url.split('&token=')[0]}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await sleep(2500);
    const appId = await extractAppId(page);
    if (appId) return appId;
  }

  return '';
}

async function tryMenuNavigation(page) {
  console.log('\nTrying to click through the MP menu...');

  const menuSteps = [
    ['设置与开发'],
    ['开发', '开发设置', '基本配置', '开发接口管理'],
    ['基本配置', '开发者ID(AppID)', '开发者ID', 'AppID'],
  ];

  for (const texts of menuSteps) {
    await clickText(page, texts);
    const appId = await extractAppId(page);
    if (appId) return appId;
  }

  const candidates = ['基本配置', '开发者ID', 'AppID', '开发配置', '开发管理'];
  for (let round = 0; round < 4; round += 1) {
    for (const text of candidates) {
      await clickText(page, [text], { timeout: 700, afterClick: 1300 });
      const appId = await extractAppId(page);
      if (appId) return appId;
    }
  }

  return '';
}

async function extractAppId(page) {
  const text = await getBodyText(page);
  const match = text.match(/\bwx[a-z0-9]{16}\b/i);
  if (match) return match[0];

  const inputs = await page.locator('input, textarea').all();
  for (const item of inputs) {
    const value = await item.inputValue().catch(() => '');
    const inputMatch = value.match(/\bwx[a-z0-9]{16}\b/i);
    if (inputMatch) return inputMatch[0];
  }

  return '';
}

async function openMpConfigPage(page) {
  console.log('\nOpening WeChat MP console...');
  await page.goto(MP_HOME, { waitUntil: 'domcontentloaded' });

  console.log('\nIf a QR code is shown, scan it with the admin WeChat account.');
  console.log('The script will wait until the logged-in MP console is available.');

  for (let i = 0; i < 180; i += 1) {
    const url = page.url();
    const text = await getBodyText(page);
    if (
      url.includes('/cgi-bin/') ||
      text.includes('账号设置') ||
      text.includes('设置与开发') ||
      text.includes('开发者ID') ||
      text.includes('AppID')
    ) {
      break;
    }
    await sleep(2000);
  }

  console.log('\nTrying known basic-config URLs...');

  const tokenAppId = await tryTokenUrls(page);
  if (tokenAppId) return tokenAppId;

  const urls = [
    'https://mp.weixin.qq.com/advanced/advanced?action=dev&t=advanced/dev',
    'https://mp.weixin.qq.com/cgi-bin/frame?t=advanced/dev_tools_frame',
    'https://mp.weixin.qq.com/advanced/advanced?action=interface&t=advanced/interface',
  ];

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await sleep(2500);
    const appId = await extractAppId(page);
    if (appId) return appId;
  }

  const menuAppId = await tryMenuNavigation(page);
  if (menuAppId) return menuAppId;

  console.log('\nI could not auto-open the exact basic config page.');
  console.log('Do this in the opened browser:');
  console.log('1. Left menu: Settings and Development');
  console.log('2. Click: Development');
  console.log('3. Open: Basic Configuration');
  console.log('\nNo need to paste AppID yet. I will keep watching the page for 10 minutes.');

  const appId = await waitForAppIdOnCurrentPage(page, 10 * 60 * 1000);
  if (appId) return appId;

  console.log('\nI still could not read AppID from the page.');
  console.log('Only paste it manually if the page is already showing the service account AppID.');
  return '';
}

async function openOauthDomainPage(page) {
  console.log('\nOpening account settings page for OAuth domain check...');
  await page
    .goto('https://mp.weixin.qq.com/cgi-bin/settingpage?t=setting/function&action=function&lang=zh_CN', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    .catch(() => {});
  await sleep(2500);

  const text = await getBodyText(page);
  if (text.includes('网页授权域名') || text.includes(OAUTH_DOMAIN)) {
    console.log(`OAuth domain page loaded. Expected domain: ${OAUTH_DOMAIN}`);
    return;
  }

  console.log('If the page did not open correctly, navigate manually to:');
  console.log('Settings and Development -> Account Settings -> Function Settings -> Webpage OAuth Domain.');
}

async function main() {
  console.log('WeChat MP OAuth helper');
  console.log('This script opens a real browser. You handle QR scan and admin confirmations.');
  console.log('It writes only local env values and does not print AppSecret.');
  console.log(`Target env file: ${ENV_PATH}`);
  console.log(`OAuth domain/base URL: ${OAUTH_DOMAIN} / ${H5_BASE_URL}`);

  mkdirSync(USER_DATA_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'msedge',
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    const foundAppId = await openMpConfigPage(page);
    const appId =
      foundAppId ||
      (await promptRequired('Paste the service account AppID here: ', (value) =>
        /^wx[a-z0-9]{16}$/i.test(value),
      ));

    console.log(`\nAppID found: ${appId}`);

    console.log('\nNow get AppSecret on the Basic Configuration page.');
    console.log('If WeChat asks for QR/admin verification, complete it in the browser.');
    console.log('Do not paste the mini-program secret here. Use the service account AppSecret.');
    const appSecret = await promptRequired('Paste the service account AppSecret here: ', (value) =>
      /^[a-f0-9]{32}$/i.test(value),
    );

    saveEnv({ appId, appSecret });

    console.log('\nSaved local backend env:');
    console.log(`WECHAT_APP_ID=${appId}`);
    console.log(`WECHAT_APP_SECRET=${mask(appSecret)}`);
    console.log(`CRM_INVITE_H5_BASE_URL=${H5_BASE_URL}`);

    await openOauthDomainPage(page);
    console.log('\nIf the OAuth domain is not saved yet, set it to:');
    console.log(OAUTH_DOMAIN);
    console.log('\nKeep "force HTTPS verification" enabled if the platform asks for it.');
    await waitForEnter('Finish any browser-side verification, then continue.');

    console.log('\nDone. Next step: deploy/sync these env values to the server and restart backend.');
  } finally {
    await context.close();
    rl.close();
  }
}

main().catch((error) => {
  console.error(error);
  rl.close();
  process.exit(1);
});
