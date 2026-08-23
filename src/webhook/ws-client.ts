/**
 * 应用事件订阅 - 长连接模式（推荐，无需公网地址）
 * 运行: npm run dev:ws
 * 启动后，在飞书开放平台 → 事件与回调 → 选择「使用长连接接收事件」
 */
import * as lark from '@larksuiteoapi/node-sdk';
import { requireAppCredentials } from '../config.js';
import { sendTextMessage } from '../api/client.js';

const { appId, appSecret } = requireAppCredentials();

const client = new lark.Client({ appId, appSecret });

const wsClient = new lark.WSClient({ appId, appSecret });

wsClient.start({
  eventDispatcher: new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      const { message } = data;
      const chatId = message.chat_id;
      const content = JSON.parse(message.content);
      const text = content.text ?? '';

      console.log(`[长连接] 收到消息: ${text} (chat_id: ${chatId})`);

      if (text.includes('ping')) {
        await client.im.v1.message.create({
          params: { receive_id_type: 'chat_id' },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ text: 'pong 🏮' }),
          },
        });
      }
    },
  }),
});

console.log('飞书长连接已启动，等待事件...');
console.log('现在可以去飞书开放平台保存「使用长连接接收事件」配置');
