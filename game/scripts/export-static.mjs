/**
 * GitHub Pages 静态导出构建：
 * - 复制源码到临时目录（dev server 的文件监视会锁住 rename，无法原地移出 API）
 * - 副本中删除 src/app/api（route handlers 不支持静态导出；云存档 fetch 失败已静默容错）
 * - junction 链接 node_modules，STATIC_EXPORT=1 → output:'export' + images.unoptimized
 * - 产物拷回 game/out/
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const here = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..'
)
const tmp = path.resolve(here, '..', '.game-static-build')

fs.rmSync(tmp, { recursive: true, force: true })
fs.mkdirSync(tmp, { recursive: true })

const SKIP = new Set(['node_modules', '.next', 'out', '.api-parked', 'dev.log', 'server.log'])
fs.cpSync(here, tmp, {
  recursive: true,
  filter: (src) => !SKIP.has(path.basename(src)),
})
fs.rmSync(path.join(tmp, 'src', 'app', 'api'), { recursive: true, force: true })
fs.symlinkSync(path.join(here, 'node_modules'), path.join(tmp, 'node_modules'), 'junction')

try {
  const nextBin = path.join(here, 'node_modules', 'next', 'dist', 'bin', 'next')
  execSync(`node "${nextBin}" build --webpack`, {
    cwd: tmp,
    stdio: 'inherit',
    env: { ...process.env, STATIC_EXPORT: '1' },
  })
  const outSrc = path.join(tmp, 'out')
  const outDst = path.join(here, 'out')
  fs.rmSync(outDst, { recursive: true, force: true })
  fs.cpSync(outSrc, outDst, { recursive: true })
  console.log('[export-static] done →', outDst)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 })
}