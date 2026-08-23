/**
 * 应用事件订阅 - HTTP Webhook 模式
 * 需在飞书开放平台配置请求地址: https://你的域名/webhook/event
 * 本地开发可用 ngrok: ngrok http 3000
 *
 * 运行: npm run dev:webhook
 */
import http from 'node:http';
import * as lark from '@larksuiteoapi/node-sdk';
import { config, requireAppCredentials } from '../config.js';
import { sendTextMessage } from '../api/client.js';

const { appId, appSecret } = requireAppCredentials();

const eventDispatcher = new lark.EventDispatcher({
  encryptKey: config.encryptKey || undefined,
  verificationToken: config.verificationToken || undefined,
}).register({
  'im.message.receive_v1': async (data) => {
    const { message } = data;
    const chatId = message.chat_id;
    const content = JSON.parse(message.content);
    const text = content.text ?? '';

    console.log(`[Webhook] 收到消息: ${text} (chat_id: ${chatId})`);

    if (text.includes('ping')) {
      await sendTextMessage(chatId, 'pong 🏮');
    }
  },
});

const server = http.createServer();
server.on('request', lark.adaptDefault('/webhook/event', eventDispatcher, { autoChallenge: true }));

server.listen(config.webhookPort, () => {
  console.log(`飞书事件 Webhook 服务已启动: http://localhost:${config.webhookPort}/webhook/event`);
  console.log(`App ID: ${appId}`);
  console.log('请在飞书开放平台 → 事件与回调 → 配置请求地址');
});
