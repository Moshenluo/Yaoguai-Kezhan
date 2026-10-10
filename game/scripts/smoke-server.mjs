// 极简静态服务器（冒烟验证 out/ 产物）
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
  'out'
)
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain', '.ico': 'image/x-icon',
}
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0])
  let file = path.join(root, p)
  if (!file.startsWith(root)) { res.writeHead(403); return res.end() }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = file + '.html'
    file = fs.existsSync(alt) ? alt : path.join(root, '404.html')
  }
  const data = fs.readFileSync(file)
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' })
  res.end(data)
}).listen(3003, () => console.log('[smoke] http://localhost:3003/'))