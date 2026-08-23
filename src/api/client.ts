import * as lark from '@larksuiteoapi/node-sdk';
import { config, requireAppCredentials } from '../config.js';

let cachedClient: lark.Client | null = null;

export function createFeishuClient(): lark.Client {
  if (cachedClient) return cachedClient;

  const { appId, appSecret, domain } = requireAppCredentials();
  const isLark = domain.includes('larksuite.com');

  cachedClient = new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: isLark ? lark.Domain.Lark : lark.Domain.Feishu,
  });

  return cachedClient;
}

/** 发送文本消息到指定会话 */
export async function sendTextMessage(receiveId: string, text: string, receiveIdType: 'chat_id' | 'open_id' | 'user_id' = 'chat_id') {
  const client = createFeishuClient();
  return client.im.v1.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
  });
}

/** 获取当前应用信息（用于验证凭证是否有效） */
export async function getAppInfo() {
  const client = createFeishuClient();
  return client.application.v6.application.get({
    path: { app_id: config.appId },
    params: { lang: 'zh_cn' },
  });
}

/** 列出机器人所在群聊 */
export async function listBotChats(pageSize = 20) {
  const client = createFeishuClient();
  return client.im.v1.chat.list({
    params: { page_size: pageSize },
  });
}

/** 读取群聊历史消息（需应用机器人已加入该群） */
export async function listChatMessages(chatId: string, pageSize = 20) {
  const client = createFeishuClient();
  return client.im.v1.message.list({
    params: {
      container_id_type: 'chat',
      container_id: chatId,
      page_size: pageSize,
      sort_type: 'ByCreateTimeDesc',
    },
  });
}

export { lark };
