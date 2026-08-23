import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量: ${name}，请复制 .env.example 为 .env 并填写`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  appId: optional('FEISHU_APP_ID'),
  appSecret: optional('FEISHU_APP_SECRET'),
  domain: optional('FEISHU_DOMAIN', 'https://open.feishu.cn'),

  botWebhookUrl: optional('FEISHU_BOT_WEBHOOK_URL'),
  botSecret: optional('FEISHU_BOT_SECRET'),

  webhookPort: Number(optional('FEISHU_WEBHOOK_PORT', '3000')),
  encryptKey: optional('FEISHU_ENCRYPT_KEY'),
  verificationToken: optional('FEISHU_VERIFICATION_TOKEN'),

  defaultChatId: optional('FEISHU_DEFAULT_CHAT_ID', 'oc_415dacf962ac4276abfdb7b6839ee9a6'),
  pollIntervalMs: Number(optional('FEISHU_POLL_INTERVAL_SEC', '60')) * 1000,

  feishuWebUrl: optional('FEISHU_WEB_URL', 'https://www.feishu.cn/next/messenger/'),
  playwrightHeadless: optional('PLAYWRIGHT_HEADLESS', 'false') === 'true',
  playwrightUserDataDir: optional('PLAYWRIGHT_USER_DATA_DIR', './.playwright/feishu-profile'),
} as const;

export function requireAppCredentials() {
  return {
    appId: required('FEISHU_APP_ID'),
    appSecret: required('FEISHU_APP_SECRET'),
    domain: config.domain,
  };
}
