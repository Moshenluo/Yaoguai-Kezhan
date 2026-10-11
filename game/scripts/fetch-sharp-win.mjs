// 下载 @img/sharp-win32-x64 tarball 并解压到 node_modules
import https from 'https'
import fs from 'fs'
import zlib from 'zlib'
import { execSync } from 'child_process'

const ver = '0.34.5'
const pkg = '@img/sharp-win32-x64'
const url = `https://registry.npmjs.org/${pkg}/-/${pkg.split('/')[1]}-${ver}.tgz`
const tgz = 'sharp-win32-x64.tgz'
const outDir = 'node_modules/@img/sharp-win32-x64'

const dl = () =>
  new Promise((res, rej) => {
    https.get(url, (r) => {
      if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode))
      const f = fs.createWriteStream(tgz)
      r.pipe(f)
      f.on('finish', () => f.close(res))
    }).on('error', rej)
  })

await dl()
console.log('downloaded', (fs.statSync(tgz).size / 1024 / 1024).toFixed(1) + 'MB')
fs.mkdirSync(outDir, { recursive: true })
// tarball 结构：package/... → 解压后改名为包名
execSync(`tar -xzf ${tgz} -C ${outDir} --strip-components=1`, { stdio: 'inherit' })
fs.rmSync(tgz)
console.log('extracted to', outDir)