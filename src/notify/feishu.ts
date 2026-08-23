import { sendTextMessage } from '../api/client.js';
import { config } from '../config.js';
import { sendBotText } from '../webhook/bot.js';

/** 推送消息到飞书群（Webhook 优先，失败则回退应用机器人） */
export async function notifyFeishu(text: string) {
  if (config.botWebhookUrl) {
    try {
      await sendBotText(text);
      return { method: 'webhook' as const };
    } catch (err) {
      console.warn('[notify] Webhook 失败，回退应用机器人:', (err as Error).message);
    }
  }

  if (!config.defaultChatId) {
    throw new Error('未配置 FEISHU_DEFAULT_CHAT_ID，无法推送');
  }

  await sendTextMessage(config.defaultChatId, text);
  return { method: 'app_bot' as const };
}
