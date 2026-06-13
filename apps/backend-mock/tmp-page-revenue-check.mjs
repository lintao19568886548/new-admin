import { chromium } from 'playwright';

const baseUrl = 'http://localhost:5556';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const storageKey = 'vben-web-play-5.5.4-dev-core-access';

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    body: JSON.stringify({
      password: '113605',
      username: '17770113605',
    }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await response.json();
  if (!response.ok || payload?.code !== 0 || !payload?.data?.accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(payload)}`);
  }
  return payload.data.accessToken;
}

function pickSummary(payload) {
  return payload?.data?.summary ?? null;
}

async function readRevenueCards(page) {
  return page.locator('.summary-card').evaluateAll((cards) =>
    cards.map((card) =>
      (card.textContent || '')
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  );
}

async function readRevenueInputs(page) {
  return page.locator('.ant-picker-input input').evaluateAll((inputs) =>
    inputs.slice(0, 2).map((input) => input.value),
  );
}

async function readPageState(page, label, revenueResponses) {
  const body = await page.locator('body').innerText({ timeout: 5000 });
  return {
    cards: await readRevenueCards(page).catch((error) => [
      `cards failed: ${error.message}`,
    ]),
    inputs: await readRevenueInputs(page).catch((error) => [
      `inputs failed: ${error.message}`,
    ]),
    label,
    responseCount: revenueResponses.length,
    url: page.url(),
    visibleText: body.replace(/\s+/g, ' ').slice(0, 1200),
  };
}

async function acceptPrivacyIfNeeded(page) {
  const buttons = [
    page.locator('button:has-text("同 意")').first(),
    page.locator('button:has-text("同意")').first(),
  ];

  for (const button of buttons) {
    if ((await button.count()) > 0) {
      await button.click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      return true;
    }
  }

  return false;
}

async function setFirstRevenueDateRange(page, startDate, endDate) {
  const start = page.locator('.ant-picker-input input').nth(0);
  const end = page.locator('.ant-picker-input input').nth(1);

  await start.click({ timeout: 5000 });
  await start.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await start.fill(startDate);
  await start.press('Enter');

  await end.click({ timeout: 5000 });
  await end.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await end.fill(endDate);
  await end.press('Enter');

  await page.locator('button.ant-btn-primary').first().click({ timeout: 5000 });
}

async function waitForNewRevenueResponse(revenueResponses, startLength) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (revenueResponses.length > startLength) {
      return revenueResponses.at(-1);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

async function run() {
  const token = await login();
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
  const revenueResponses = [];
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('response', async (response) => {
    if (!response.url().includes('/api/dashboard/revenue-stats')) {
      return;
    }
    try {
      const payload = await response.json();
      revenueResponses.push({
        status: response.status(),
        summary: pickSummary(payload),
        url: response.url(),
      });
    } catch (error) {
      revenueResponses.push({
        error: error instanceof Error ? error.message : String(error),
        status: response.status(),
        url: response.url(),
      });
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
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
    { key: storageKey, token },
  );

  await page.goto(`${baseUrl}/analytics`, { waitUntil: 'domcontentloaded' });
  await waitForNewRevenueResponse(revenueResponses, 0);
  await page.waitForTimeout(1500);
  await acceptPrivacyIfNeeded(page);
  const initialState = await readPageState(page, 'initial', revenueResponses);

  const beforeSingle = revenueResponses.length;
  let singleDaySetError = null;
  try {
    await setFirstRevenueDateRange(page, '2026-06-08', '2026-06-08');
  } catch (error) {
    singleDaySetError = error instanceof Error ? error.message : String(error);
  }
  const singleDayResponse = await waitForNewRevenueResponse(
    revenueResponses,
    beforeSingle,
  );
  await page.waitForTimeout(1500);
  const singleDayState = await readPageState(
    page,
    'single-day',
    revenueResponses,
  );

  const beforeRange = revenueResponses.length;
  let rangeSetError = null;
  try {
    await setFirstRevenueDateRange(page, '2026-06-01', '2026-06-08');
  } catch (error) {
    rangeSetError = error instanceof Error ? error.message : String(error);
  }
  const rangeResponse = await waitForNewRevenueResponse(
    revenueResponses,
    beforeRange,
  );
  await page.waitForTimeout(1500);
  const rangeState = await readPageState(page, 'range', revenueResponses);

  console.log(
    JSON.stringify(
      {
        consoleErrors: consoleErrors.slice(-10),
        initialState,
        rangeResponse,
        rangeSetError,
        rangeState,
        revenueResponses,
        singleDayResponse,
        singleDaySetError,
        singleDayState,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
