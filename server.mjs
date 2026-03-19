import http from 'node:http'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = dirname(fileURLToPath(import.meta.url))
const publicDir = join(root, 'public')
const tmpDir = join(root, '.maa-gen-tmp')

const PORT = Number(process.env.PORT) || 48765
const MAX_BODY = 32 * 1024 * 1024

const noOpen = process.argv.includes('--no-open') || process.env.CI === 'true'

function openBrowser(url) {
  if (noOpen) return
  try {
    if (process.platform === 'win32') {
      execSync(`cmd /c start "" "${url}"`, { stdio: 'ignore', windowsHide: true })
    } else if (process.platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' })
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' })
    }
  } catch {
    // ignore
  }
}

async function readBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY) {
      throw new Error(`请求体超过 ${MAX_BODY} 字节`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function serveStatic(pathname, res) {
  let file = pathname === '/' ? '/index.html' : pathname
  if (file.includes('..')) {
    res.writeHead(400)
    res.end('bad path')
    return
  }
  const abs = join(publicDir, file)
  if (!abs.startsWith(publicDir)) {
    res.writeHead(403)
    res.end()
    return
  }
  try {
    const buf = await readFile(abs)
    const ext = file.split('.').pop()
    const ct =
      ext === 'html' ? 'text/html; charset=utf-8' :
      ext === 'js' ? 'text/javascript; charset=utf-8' :
      ext === 'css' ? 'text/css; charset=utf-8' :
      'application/octet-stream'
    res.writeHead(200, { 'Content-Type': ct })
    res.end(buf)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}

async function handleGenerate(body) {
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    throw new Error('JSON 无效')
  }

  const template = typeof payload.template === 'string' ? payload.template : ''
  const data = typeof payload.data === 'string' ? payload.data : ''
  if (!template.trim()) throw new Error('缺少模板内容')
  if (!data.trim()) throw new Error('缺少数据内容')

  await mkdir(tmpDir, { recursive: true })
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const tplPath = join(tmpDir, `tpl-${id}.jsonc`)
  const dataPath = join(tmpDir, `data-${id}.json`)

  await writeFile(tplPath, template, 'utf8')
  await writeFile(dataPath, data, 'utf8')

  const logs = []
  const { runGenerate } = await import('./lib/runGenerate.mjs')

  try {
    const result = await runGenerate(
      {
        // 与 CLI 一致：相对输出目录等相对于用户启动服务时的 cwd（npx 下不是包目录）
        baseDir: process.cwd(),
        template: tplPath,
        data: dataPath,
        outputDir: payload.outputDir || undefined,
        outputPattern: payload.outputPattern || undefined,
        merged: Boolean(payload.merged)
      },
      {
        onLog(level, message) {
          logs.push({ level, message })
        }
      }
    )
    return { ok: true, logs, totalTasks: result.totalTasks, totalIssues: result.totalIssues }
  } finally {
    await rm(tplPath, { force: true }).catch(() => {})
    await rm(dataPath, { force: true }).catch(() => {})
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/generate') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    try {
      const body = await readBody(req)
      const out = await handleGenerate(body)
      res.writeHead(200)
      res.end(JSON.stringify(out))
    } catch (e) {
      res.writeHead(400)
      res.end(JSON.stringify({ ok: false, error: e.message || String(e) }))
    }
    return
  }

  if (req.method === 'GET') {
    await serveStatic(url.pathname, res)
    return
  }

  res.writeHead(405)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`
  console.log(`[maa-pipeline-generate] 本机界面: ${url}`)
  console.log(`[maa-pipeline-generate] 按 Ctrl+C 结束服务`)
  openBrowser(url)
})
