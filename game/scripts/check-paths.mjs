// 一次性检查：导出产物中是否残留未加前缀的资源路径
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', 'out')
const bad = []
const walk = (dir) => {
  for (const n of fs.readdirSync(dir)) {
    const f = path.join(dir, n)
    if (fs.statSync(f).isDirectory()) walk(f)
    else if (/\.(html|js|css|txt)$/.test(n)) {
      const t = fs.readFileSync(f, 'utf8')
      if (/"\/images\/|'\/images\/|\(\/images\/|"\/_next\//.test(t)) bad.push(path.relative(root, f))
    }
  }
}
walk(root)
console.log(bad.length ? 'LEAKED:\n' + bad.join('\n') : 'CLEAN: no bare asset paths')