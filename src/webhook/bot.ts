import crypto from 'node:crypto';
import { config } from '../config.js';
import { notifyFeishu } from '../notify/feishu.js';

interface BotMessage {
  msg_type: 'text' | 'post' | 'interactive';
  content: Record<string, unknown>;
}

/** 生成群机器人签名校验头 */
function sign(secret: string, timestamp: string): string {
  const stringToSign = `${timestamp}\n${secret}`;
  return crypto.createHmac('sha256', stringToSign).update('').digest('base64');
}

/** 通过群自定义机器人 Webhook 发送消息 */
export async function sendBotMessage(message: BotMessage) {
  if (!config.botWebhookUrl) {
    throw new Error('未配置 FEISHU_BOT_WEBHOOK_URL');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (config.botSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    headers['X-Lark-Request-Timestamp'] = timestamp;
    headers['X-Lark-Request-Nonce'] = crypto.randomUUID();
    headers['X-Lark-Signature'] = sign(config.botSecret, timestamp);
  }

  const response = await fetch(config.botWebhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });

  const body = await response.json();
  if (!response.ok || (body as { code?: number }).code !== 0) {
    throw new Error(`Webhook 发送失败: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function sendBotText(text: string) {
  return sendBotMessage({
    msg_type: 'text',
    content: { text },
  });
}

/** CLI 入口: npm run send:bot -- "消息内容" */
async function main() {
  const text = process.argv[2] ?? '你好，来自妖怪客栈 Webhook 机器人的测试消息 🏮';
  const result = await notifyFeishu(text);
  console.log(`发送成功 (${result.method})`);
}

const isDirectRun = process.argv[1]?.includes('bot');
if (isDirectRun) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
