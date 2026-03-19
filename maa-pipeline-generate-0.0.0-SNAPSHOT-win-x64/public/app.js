const $ = id => document.getElementById(id)

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file, 'UTF-8')
  })
}

function appendLog(text) {
  const el = $('log')
  el.value += (el.value ? '\n' : '') + text
  el.scrollTop = el.scrollHeight
}

$('btnRun').addEventListener('click', async () => {
  const tplInput = $('tplFile')
  const dataInput = $('dataFile')
  const tplFile = tplInput.files?.[0]
  const dataFile = dataInput.files?.[0]

  if (!tplFile) {
    appendLog('请选择模板文件')
    return
  }
  if (!dataFile) {
    appendLog('请选择数据文件')
    return
  }

  const btn = $('btnRun')
  btn.disabled = true
  $('log').value = ''

  try {
    const [template, data] = await Promise.all([readFileAsText(tplFile), readFileAsText(dataFile)])

    const body = {
      template,
      data,
      outputDir: $('outputDir').value.trim() || undefined,
      outputPattern: $('outputPattern').value.trim() || undefined,
      merged: $('merged').checked
    }

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body)
    })

    const json = await res.json()
    if (!json.ok) {
      appendLog(`错误: ${json.error || res.statusText}`)
      return
    }
    for (const line of json.logs || []) {
      const p = line.level === 'error' ? '[ERR] ' : line.level === 'warn' ? '[WRN] ' : ''
      appendLog(p + line.message)
    }
    appendLog(`\n--- 完成: ${json.totalTasks} 个任务节点, ${json.totalIssues} 条诊断 ---`)
  } catch (e) {
    appendLog(`异常: ${e.message}`)
  } finally {
    btn.disabled = false
  }
})
