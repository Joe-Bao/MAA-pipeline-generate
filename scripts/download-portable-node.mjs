/**
 * 下载官方 Node 便携版到 ./node/，实现「解压 + 自带 Node」绿色运行。
 * 用法:
 *   node scripts/download-portable-node.mjs win-x64
 *   node scripts/download-portable-node.mjs linux-x64
 *   node scripts/download-portable-node.mjs darwin-x64
 *   node scripts/download-portable-node.mjs darwin-arm64
 *
 * 需已安装系统 Node 才能运行本脚本；下载完成后可用 ./node 下的 node 启动 server。
 * 版本可通过环境变量 PORTABLE_NODE_VERSION 覆盖（默认与 CI 推荐一致）。
 */

import { createWriteStream, mkdir, rm, rename } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const NODE_VER = process.env.PORTABLE_NODE_VERSION || '22.14.0'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'node')
const dlRoot = join(root, 'scripts', '.dl')

const variants = {
  'win-x64': { folder: `node-v${NODE_VER}-win-x64`, file: `node-v${NODE_VER}-win-x64.zip` },
  'linux-x64': { folder: `node-v${NODE_VER}-linux-x64`, file: `node-v${NODE_VER}-linux-x64.tar.gz` },
  'darwin-x64': { folder: `node-v${NODE_VER}-darwin-x64`, file: `node-v${NODE_VER}-darwin-x64.tar.gz` },
  'darwin-arm64': { folder: `node-v${NODE_VER}-darwin-arm64`, file: `node-v${NODE_VER}-darwin-arm64.tar.gz` }
}

const plat = process.argv[2] || 'win-x64'
const spec = variants[plat]
if (!spec) {
  console.error('用法: node scripts/download-portable-node.mjs <' + Object.keys(variants).join('|') + '>')
  process.exit(1)
}

const url = `https://nodejs.org/dist/v${NODE_VER}/${spec.file}`

async function download(dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${url}`)
  await pipeline(res.body, createWriteStream(dest))
  console.log('已下载:', dest)
}

async function main() {
  await rm(outDir, { recursive: true, force: true }).catch(() => {})
  await mkdir(dlRoot, { recursive: true })
  const tmp = join(dlRoot, spec.file)

  console.log('URL:', url)
  await download(tmp)

  if (spec.file.endsWith('.zip')) {
    if (process.platform !== 'win32') {
      execSync(`unzip -o -q "${tmp}" -d "${dlRoot}"`, { stdio: 'inherit' })
    } else {
      const esc = (s) => s.replace(/'/g, "''")
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${esc(tmp)}' -DestinationPath '${esc(dlRoot)}' -Force"`,
        { stdio: 'inherit' }
      )
    }
    const extracted = join(dlRoot, spec.folder)
    await rename(extracted, outDir)
  } else {
    execSync(`tar -xzf "${tmp}" -C "${dlRoot}"`, { stdio: 'inherit' })
    const extracted = join(dlRoot, spec.folder)
    await rename(extracted, outDir)
  }

  await rm(tmp, { force: true }).catch(() => {})
  console.log('\n完成。便携 Node 目录:', outDir)
  if (plat === 'win-x64') {
    console.log('运行: start.bat 或 .\\node\\node.exe server.mjs')
  } else {
    console.log('运行: ./start.sh 或 ./node/bin/node server.mjs')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
