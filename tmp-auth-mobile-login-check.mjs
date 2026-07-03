import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  isMobile: true,
  viewport: { height: 844, width: 390 },
});
const logs = [];
const directCodeLogin = process.argv.includes('--direct-code-login');

page.on('console', (message) => {
  logs.push(`console ${message.type()}: ${message.text()}`);
});
page.on('pageerror', (error) => {
  logs.push(`pageerror: ${error.message}`);
});
page.on('requestfailed', (request) => {
  logs.push(
    `requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`,
  );
});

await page.goto(
  directCodeLogin
    ? 'http://localhost:5559/auth/code-login'
    : 'http://localhost:5559/auth/login',
  {
  waitUntil: 'networkidle',
  },
);
console.log('initial-url:', page.url());
console.log('initial-body:', (await page.locator('body').innerText()).slice(0, 500));

if (directCodeLogin) {
  console.log('input-count:', await page.locator('input').count());
  console.log(`logs:\n${logs.join('\n')}`);
  await browser.close();
  process.exit(0);
}

const privacyAgreeButton = page.getByRole('button', { name: /^同意$/ });
if (await privacyAgreeButton.count()) {
  await privacyAgreeButton.click();
  await page.waitForTimeout(500);
  console.log('after-privacy-url:', page.url());
  console.log(
    'after-privacy-body:',
    (await page.locator('body').innerText()).slice(0, 500),
  );
}

await page.getByRole('button', { name: /手机号登录/ }).click();
await page.waitForTimeout(800);
console.log('after-click-url:', page.url());
console.log('after-click-body:', (await page.locator('body').innerText()).slice(0, 800));

const agreeButton = page.getByRole('button', { name: /同意并继续/ });
if (await agreeButton.count()) {
  await agreeButton.click();
  await page.waitForTimeout(1500);
  console.log('after-agree-url:', page.url());
  console.log(
    'after-agree-body:',
    (await page.locator('body').innerText()).slice(0, 1000),
  );
  console.log(
    'after-agree-html:',
    (await page.locator('body').innerHTML()).slice(0, 3000),
  );
  console.log(
    'after-agree-inspect:',
    await page.evaluate(() => {
      const body = document.body;
      const formContainers = Array.from(
        document.querySelectorAll('.flex-col-center'),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          className: element.className,
          display: style.display,
          height: rect.height,
          text: (element.textContent || '').trim().slice(0, 300),
          visibility: style.visibility,
          width: rect.width,
        };
      });
      return {
        bodyText: body.innerText.slice(0, 1000),
        buttonTexts: Array.from(document.querySelectorAll('button')).map(
          (button) => (button.textContent || '').trim(),
        ),
        formContainers,
        hasCodeText: body.innerHTML.includes('验证码'),
        hasMobileText: body.innerHTML.includes('手机号'),
        inputCount: document.querySelectorAll('input').length,
      };
    }),
  );
  await page.waitForTimeout(3000);
  console.log('after-extra-wait-url:', page.url());
  console.log(
    'after-extra-wait-body:',
    (await page.locator('body').innerText()).slice(0, 1000),
  );
}

console.log(`logs:\n${logs.join('\n')}`);
await browser.close();
