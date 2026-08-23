/**
 * 读取群聊消息
 * 运行: npm run read:chat -- <chat_id>
 */
import { listBotChats, listChatMessages } from './client.js';

async function main() {
  const chatId = process.argv[2];

  if (!chatId) {
    console.log('=== 机器人所在的群聊 ===\n');
    const chats = await listBotChats();
    const items = chats.data?.items ?? [];

    if (items.length === 0) {
      console.log('暂无群聊。请确保：');
      console.log('1. 应用已开启「机器人」能力');
      console.log('2. 已将应用机器人添加到目标群');
      return;
    }

    for (const chat of items) {
      console.log(`- ${chat.name}  (chat_id: ${chat.chat_id})`);
    }
    console.log('\n读取消息: npm run read:chat -- <chat_id>');
    return;
  }

  console.log(`=== 群聊 ${chatId} 最近消息 ===\n`);
  const messages = await listChatMessages(chatId, 20);
  const items = messages.data?.items ?? [];

  for (const msg of items.reverse()) {
    const time = new Date(Number(msg.create_time) * 1000).toLocaleString('zh-CN');
    let text = msg.body?.content ?? '';
    try {
      const parsed = JSON.parse(text);
      text = parsed.text ?? text;
    } catch { /* 非文本消息 */ }
    console.log(`[${time}] ${text}`);
  }
}

main().catch((err) => {
  console.error('读取失败:', err.message ?? err);
  process.exit(1);
});
