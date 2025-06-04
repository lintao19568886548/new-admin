import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

test.beforeEach(async ({ page }) => {
  await authLogin(page);
  await page.goto('/bill/mobile-list'); // 导航到手机端账单列表页面
});

test.describe('Mobile Bill List Page Tests', () => {
  test('should display mobile bill list title and elements', async ({
    page,
  }) => {
    // 检查页面标题
    const pageTitle = await page.textContent('.ant-page-header-heading-title');
    expect(pageTitle).toContain('总账单管理');

    // 检查是否存在创建按钮
    const createButton = page.locator('button', { hasText: '创建' });
    await expect(createButton).toBeVisible();

    // 检查区域选择器是否可见
    const areaSelector = page
      .locator('.ant-select-selection-search-input')
      .first();
    await expect(areaSelector).toBeVisible();

    // 检查列表是否存在
    const billList = page.locator('.ant-list');
    await expect(billList).toBeVisible();

    // 检查列表是否包含"暂无账单数据"或至少一个账单项
    const emptyListText = page.locator('text=暂无账单数据');
    const listItem = page.locator('.ant-list-item').first();

    // 页面加载可能需要时间来获取数据，等待数据加载或显示空状态
    await expect(emptyListText.or(listItem)).toBeVisible();
  });

  // 可以添加更多测试用例，例如：
  // test('should open create form when create button is clicked', async ({ page }) => {
  //   await page.locator('button', { hasText: '创建' }).click();
  //   const modalTitle = page.locator('.ant-modal-title');
  //   await expect(modalTitle).toHaveText('创建总账单');
  // });

  // test('should load more bills when "加载更多" button is clicked', async ({ page }) => {
  //   // 假设有足够的数据来触发加载更多
  //   // 初始加载一些项，然后点击加载更多，验证列表项数量增加
  // });
});
