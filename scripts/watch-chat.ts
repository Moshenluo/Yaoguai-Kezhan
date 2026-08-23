/**
 * 定时轮询飞书群消息，自动读取并保存新消息
 * 运行: npm run watch:chat
 */
import fs from 'node:fs';
import path from 'node:path';
import { listChatMessages } from '../src/api/client.js';
import { config } from '../src/config.js';

const STATE_DIR = '.feishu';
const STATE_FILE = path.join(STATE_DIR, 'last-message-id.txt');
const LOG_FILE = path.join(STATE_DIR, 'messages.jsonl');

function loadLastId(): string {
  try {
    return fs.readFileSync(STATE_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function saveLastId(id: string) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, id);
}

function parseText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return parsed.text ?? content;
  } catch {
    return content;
  }
}

async function poll() {
  const chatId = config.defaultChatId;
  if (!chatId) throw new Error('未配置 FEISHU_DEFAULT_CHAT_ID');

  const lastId = loadLastId();
  const res = await listChatMessages(chatId, 20);
  const items = res.data?.items ?? [];

  const newMessages = lastId
    ? items.filter((m) => BigInt(m.message_id!) > BigInt(lastId))
    : items;

  if (newMessages.length === 0) return;

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const sorted = [...newMessages].sort((a, b) => Number(a.create_time) - Number(b.create_time));

  for (const msg of sorted) {
    const text = parseText(msg.body?.content ?? '');
    const time = new Date(Number(msg.create_time) * 1000).toLocaleString('zh-CN');
    const entry = { time, message_id: msg.message_id, text };

    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    console.log(`[新消息] ${time} ${text.slice(0, 100)}`);
  }

  const latest = items.reduce((a, b) =>
    BigInt(a.message_id!) > BigInt(b.message_id!) ? a : b,
  );
  if (latest.message_id) saveLastId(latest.message_id);
}

console.log(`开始监听群消息 (每 ${config.pollIntervalMs / 1000}s 轮询)`);
console.log(`chat_id: ${config.defaultChatId}`);
console.log(`日志: ${LOG_FILE}\n`);

await poll();
setInterval(() => {
  poll().catch((err) => console.error('[轮询失败]', err.message));
}, config.pollIntervalMs);
