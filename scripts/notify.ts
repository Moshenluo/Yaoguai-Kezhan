/**
 * 手动发送飞书通知
 * 用法: npm run notify:feishu -- "消息内容"
 */
import { notifyFeishu } from '../src/notify/feishu.js';

const text = process.argv[2] ?? '妖怪客栈通知测试 🏮';

notifyFeishu(text)
  .then((r) => console.log(`发送成功 (${r.method})`))
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
