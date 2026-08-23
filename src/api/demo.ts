/**
 * 开放平台 API 使用示例
 * 运行: npm run dev:api
 */
import { getAppInfo, listBotChats, sendTextMessage } from './client.js';

async function main() {
  console.log('=== 飞书开放平台 API 测试 ===\n');

  const appInfo = await getAppInfo();
  console.log('应用信息:', JSON.stringify(appInfo.data, null, 2));

  const chats = await listBotChats(5);
  console.log('\n群聊列表:', JSON.stringify(chats.data?.items?.map((c) => ({ name: c.name, chat_id: c.chat_id })), null, 2));

  const targetChatId = process.argv[2];
  if (targetChatId) {
    const result = await sendTextMessage(targetChatId, '你好，来自妖怪客栈 API 的测试消息 🏮');
    console.log('\n消息发送结果:', result.msg);
  } else {
    console.log('\n提示: 传入 chat_id 可发送测试消息 → npm run dev:api -- <chat_id>');
  }
}

main().catch((err) => {
  console.error('API 调用失败:', err.message ?? err);
  process.exit(1);
});
