import { chromium } from 'playwright';

const BASE_URL = process.env.SMOKE_FRONTEND_URL || 'http://localhost:5558';
const API_BASE_URL =
  process.env.SMOKE_API_BASE_URL || 'http://127.0.0.1:5320/api';
const USERNAME = process.env.SMOKE_USERNAME || '17770113605';
const PASSWORD = process.env.SMOKE_PASSWORD || '113605';
const STORAGE_KEY =
  process.env.SMOKE_ACCESS_STORAGE_KEY ||
  'vben-web-play-5.5.4-dev-core-access';

const desktopRoutes = [
  '/investment/app',
  '/investment/radar',
  '/investment/radar-dashboard',
  '/investment/radar-tasks',
  '/investment/radar-factory-listings',
  '/investment/radar-public-demands',
];

const mobileRoutes = [
  '/investment/radar/mobile',
  '/investment/radar/mobile-dashboard',
  '/investment/radar/mobile-tasks',
  '/investment/radar/mobile-public-demands',
  '/investment/radar/mobile-factory-listings',
  '/investment/radar/mobile-external-leads',
  '/investment/radar/mobile-signal-events',
  '/investment/radar/mobile-enterprise-profiles',
  '/investment/radar/mobile-score-rules',
  '/investment/radar/mobile-crawler-sources',
  '/investment/radar/mobile-crawler-tasks',
];

const routeAlternates = new Map();

function isAuthUrl(url) {
  return url.includes('/auth/login');
}

async function fillFirst(page, selectors, value) {
  const deadline = Date.now() + 15_000;
  let lastCount = 0;
  let lastUrl = '';
  for (const selector of selectors) {
    while (Date.now() < deadline) {
      const locator = page.locator(selector).first();
      const count = await locator.count();
      lastCount += count;
      lastUrl = page.url();
      if (count > 0) {
        await locator.waitFor({ state: 'visible', timeout: 5_000 });
        await locator.fill(value);
        return selector;
      }
      await page.waitForTimeout(300);
    }
  }
  const bodyText = await page
    .locator('body')
    .innerText({ timeout: 2_000 })
    .catch((error) => `body read failed: ${error.message}`);
  throw new Error(
    `Cannot find input for ${value}; url=${lastUrl}; matchedCount=${lastCount}; body=${bodyText
      .replace(/\s+/g, ' ')
      .slice(0, 1000)}`,
  );
}

async function clickLogin(page) {
  const candidates = [
    'button:has-text("登录")',
    'button:has-text("登 录")',
    'button[type="submit"]',
  ];
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.click();
      return selector;
    }
  }
  throw new Error('Cannot find login button');
}

async function solveCaptcha(page) {
  const slider = page
    .locator(
      '.slider, .slider-captcha, [class*="slider"], [class*="captcha"]',
    )
    .first();
  if ((await slider.count()) === 0) return false;
  const box = await slider.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + 12, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 12, box.y + box.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
  await page.waitForTimeout(500);
  return true;
}

async function login(page) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    body: JSON.stringify({ password: PASSWORD, username: USERNAME }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = await response.json();
  if (!response.ok || payload?.code !== 0 || !payload?.data?.accessToken) {
    throw new Error(
      `api login failed: http=${response.status}, code=${payload?.code}, message=${payload?.error || payload?.message}`,
    );
  }
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ key, token }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          accessCodes: [],
          accessToken: token,
          refreshToken: null,
        }),
      );
    },
    { key: STORAGE_KEY, token: payload.data.accessToken },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
    // Dev mode can keep helper connections open.
  });
  await page.waitForTimeout(1_500);
  if (!isAuthUrl(page.url())) {
    await acceptPrivacyIfNeeded(page);
    return;
  }

  await page.goto(`${BASE_URL}/auth/login`, {
    waitUntil: 'domcontentloaded',
  });
  await fillFirst(
    page,
    [
      'input[name="username"]',
      'input[placeholder*="用户名"]',
      'input[placeholder*="账号"]',
      'input[type="text"]',
    ],
    USERNAME,
  );
  await fillFirst(
    page,
    [
      'input[name="password"]',
      'input[placeholder*="密码"]',
      'input[type="password"]',
    ],
    PASSWORD,
  );
  await solveCaptcha(page);
  await clickLogin(page);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
    // Some pages keep websocket/devtool requests open in dev mode.
  });
  await page.waitForTimeout(1_500);
  if (isAuthUrl(page.url())) {
    throw new Error(`login stayed on auth page: ${page.url()}`);
  }
  await acceptPrivacyIfNeeded(page);
}

async function acceptPrivacyIfNeeded(page) {
  for (const text of ['同 意', '同意']) {
    const button = page.locator(`button:has-text("${text}")`).first();
    if ((await button.count()) > 0) {
      await button.click({ timeout: 2_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function visitRoute(page, route) {
  const attempts = routeAlternates.get(route) || [route];
  let last = null;
  for (const candidate of attempts) {
    await page.goto(`${BASE_URL}${candidate}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(4_000);
    await acceptPrivacyIfNeeded(page);
    last = {
      title: await page.title().catch(() => ''),
      url: page.url(),
    };
    const bodyText = await page.locator('body').innerText({ timeout: 5_000 });
    if (!bodyText.includes('404') && !isAuthUrl(page.url())) {
      return {
        ...last,
        bodyPreview: bodyText.replace(/\s+/g, ' ').slice(0, 220),
      };
    }
  }
  throw new Error(`route failed ${route}: ${JSON.stringify(last)}`);
}

async function runViewport(name, viewport, routes) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const api = [];
  const consoleErrors = [];
  const requestStart = new Map();

  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const sourceUrl = new URL(request.url());
    const targetUrl = `${API_BASE_URL}${sourceUrl.pathname.replace(/^\/api/, '')}${sourceUrl.search}`;
    const response = await route.fetch({ url: targetUrl });
    await route.fulfill({ response });
  });

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/investment/radar')) {
      requestStart.set(request, Date.now());
    }
  });
  page.on('response', (response) => {
    const request = response.request();
    const url = response.url();
    if (url.includes('/api/investment/radar')) {
      api.push({
        durationMs: Date.now() - (requestStart.get(request) || Date.now()),
        method: request.method(),
        status: response.status(),
        url: url.replace(BASE_URL, ''),
      });
    }
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/api/investment/radar')) {
      api.push({
        failure: request.failure()?.errorText,
        method: request.method(),
        status: 'FAILED',
        url: url.replace(BASE_URL, ''),
      });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  const pages = [];
  try {
    await login(page);
    for (const route of routes) {
      const startedAt = Date.now();
      const result = await visitRoute(page, route);
      pages.push({
        durationMs: Date.now() - startedAt,
        route,
        ...result,
      });
    }
  } finally {
    await browser.close();
  }

  return {
    api,
    consoleErrors,
    failedApi: api.filter(
      (item) =>
        item.status === 'FAILED' ||
        (typeof item.status === 'number' && item.status >= 400),
    ),
    name,
    pages,
    slowApi: api
      .filter((item) => typeof item.durationMs === 'number')
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10),
    viewport,
  };
}

const results = [];
for (const item of [
  { name: 'desktop', routes: desktopRoutes, viewport: { height: 900, width: 1440 } },
  { name: 'mobile', routes: mobileRoutes, viewport: { height: 812, width: 390 } },
]) {
  results.push(await runViewport(item.name, item.viewport, item.routes));
}

const output = {
  checkedAt: new Date().toISOString(),
  results,
};

console.log(JSON.stringify(output, null, 2));
