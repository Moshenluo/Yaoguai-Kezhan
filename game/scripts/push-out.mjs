// 部署工具：out 仓（Pages 项目页）提交推送
// 用法：node scripts/push-out.mjs ["commit message"]（先跑 export-static.mjs）
import { execSync } from 'node:child_process'
import path from 'node:path'

const site = path.resolve(import.meta.dirname, '..', 'out')
const msg = process.argv[2] ?? 'deploy: update static site'
const run = (c) => execSync(c, { cwd: site, stdio: 'inherit' })
run('git add -A')
run(`git commit -m "${msg.replace(/"/g, '\\"')}"`)
run('git push origin main')
console.log('[deploy-out] done')