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
  // out/ 是 Pages 部署仓库（含 .git）：重建产物前把 .git 挪出去，拷完再放回
  const gitDir = path.join(outDst, '.git')
  const gitKeep = path.join(here, '.out-pages-git')
  const hadGit = fs.existsSync(gitDir)
  if (hadGit) { fs.rmSync(gitKeep, { recursive: true, force: true }); fs.renameSync(gitDir, gitKeep) }
  fs.rmSync(outDst, { recursive: true, force: true })
  fs.cpSync(outSrc, outDst, { recursive: true })
  if (hadGit) fs.renameSync(gitKeep, gitDir)
  // GitHub Pages 的 Jekyll 会忽略 _next/（下划线开头目录），必须带 .nojekyll
  fs.writeFileSync(path.join(outDst, '.nojekyll'), '')
  // 子路径适配：Pages 项目页部署在 /yaoguaikezhan/ 下，
  // basePath 只覆盖 _next 资产，代码里硬编码的 /images/... 公共资源需手动加前缀
  const IMG_REWRITES = [
    ['"/images/', '"/yaoguaikezhan/images/'],
    ["'/images/", "'/yaoguaikezhan/images/"],
    ['(/images/', '(/yaoguaikezhan/images/'],
    ['=/images/', '=/yaoguaikezhan/images/'],
    // 反引号模板字符串（yaoImg 等）——SWC 保留模板字面量，必须单独覆盖
    ['`/images/', '`/yaoguaikezhan/images/'],
  ]
  const REWRITE_EXTS = new Set(['.html', '.js', '.css', '.txt', '.xml', '.json', '.webmanifest', '.map'])
  let rewrote = 0
  const walkRewrite = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) walkRewrite(p)
      else if (REWRITE_EXTS.has(path.extname(name))) {
        let text = fs.readFileSync(p, 'utf8')
        const before = text
        for (const [from, to] of IMG_REWRITES) text = text.split(from).join(to)
        if (text !== before) { fs.writeFileSync(p, text); rewrote++ }
      }
    }
  }
  walkRewrite(outDst)
  console.log('[export-static] done →', outDst, `(basePath rewrite: ${rewrote} files)`)
} finally {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 })
}