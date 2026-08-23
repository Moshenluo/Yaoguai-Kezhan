/**
 * 飞书网页版浏览器自动化（Playwright）
 * 运行: npm run browser:feishu
 *
 * 首次运行会打开浏览器，需手动扫码登录飞书。
 * 登录状态会保存在 .playwright/feishu-profile 目录，下次自动复用。
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import { config } from '../config.js';

export interface FeishuBrowserSession {
  context: BrowserContext;
  page: Page;
}

/** 启动飞书浏览器会话（保留登录态） */
export async function openFeishuBrowser(): Promise<FeishuBrowserSession> {
  const context = await chromium.launchPersistentContext(config.playwrightUserDataDir, {
    headless: config.playwrightHeadless,
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(config.feishuWebUrl, { waitUntil: 'domcontentloaded' });

  return { context, page };
}

/** 在飞书网页版中搜索并打开指定会话 */
export async function searchAndOpenChat(page: Page, keyword: string) {
  const searchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="Search"]').first();
  await searchInput.waitFor({ timeout: 15000 });
  await searchInput.fill(keyword);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  const chatItem = page.locator(`[class*="chat"], [class*="conversation"]`).filter({ hasText: keyword }).first();
  if (await chatItem.isVisible({ timeout: 5000 }).catch(() => false)) {
    await chatItem.click();
  }
}

/** 在当前会话发送文本消息 */
export async function sendMessageInChat(page: Page, text: string) {
  const editor = page.locator('[contenteditable="true"]').last();
  await editor.waitFor({ timeout: 10000 });
  await editor.fill(text);
  await page.keyboard.press('Enter');
}

/** 截图当前页面 */
export async function screenshot(page: Page, path = 'feishu-screenshot.png') {
  await page.screenshot({ path, fullPage: false });
  console.log(`截图已保存: ${path}`);
}

async function main() {
  console.log('=== 飞书浏览器自动化 ===');
  console.log('首次运行请扫码登录，登录态会自动保存\n');

  const { context, page } = await openFeishuBrowser();

  console.log('已打开飞书网页版，等待页面加载...');
  await page.waitForTimeout(3000);

  const keyword = process.argv[2];
  const message = process.argv[3];

  if (keyword) {
    console.log(`搜索会话: ${keyword}`);
    await searchAndOpenChat(page, keyword);
  }

  if (message) {
    console.log(`发送消息: ${message}`);
    await sendMessageInChat(page, message);
  }

  await screenshot(page);
  console.log('\n浏览器保持打开，按 Ctrl+C 退出');

  process.on('SIGINT', async () => {
    await context.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('浏览器自动化失败:', err.message ?? err);
  process.exit(1);
});
