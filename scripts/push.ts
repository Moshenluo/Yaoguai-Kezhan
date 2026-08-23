/**
 * 推送代码到远程，并通知飞书群
 * 用法: npm run push -- origin main
 */
import { execSync } from 'node:child_process';
import { notifyFeishu } from '../src/notify/feishu.js';

const args = process.argv.slice(2);
const pushArgs = args.length > 0 ? args.join(' ') : '';

async function main() {
  execSync(`git push ${pushArgs}`, { stdio: 'inherit' });

  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8' }).trim();
  const author = execSync('git log -1 --format=%an', { encoding: 'utf8' }).trim();

  const message = [
    '🏮 代码已推送到 Cursor Origin',
    `分支: ${branch}`,
    `提交: ${lastCommit}`,
    `作者: ${author}`,
  ].join('\n');

  const result = await notifyFeishu(message);
  console.log(`\n飞书通知已发送 (${result.method})`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
