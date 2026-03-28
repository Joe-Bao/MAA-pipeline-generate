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

// ======================== Tab switching ========================

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'))
    $(`panel-${btn.dataset.tab}`).classList.remove('hidden')
  })
})

// ======================== MapWay toggle for zone_id ========================

$('acMapWay').addEventListener('change', () => {
  $('acZoneIdField').style.display = $('acMapWay').value === 'MapNavigate' ? '' : 'none'
})

// ======================== Template generate (existing) ========================

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

// ======================== AutoCollect generate ========================

function parseJsonField(value, fieldName) {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${fieldName} 格式错误，请输入合法的 JSON`)
  }
}

$('btnAutoCollect').addEventListener('click', async () => {
  const btn = $('btnAutoCollect')
  btn.disabled = true
  $('log').value = ''
  $('acPreviewCard').style.display = 'none'

  try {
    const mapWay = $('acMapWay').value
    const routeId = parseInt($('acRouteId').value, 10)
    const teleportName = $('acTeleportName').value.trim()
    const mapName = $('acMapName').value.trim()
    const zoneId = $('acZoneId').value.trim()
    const assertTargetRaw = $('acAssertTarget').value.trim()
    const initialPathRaw = $('acInitialPath').value.trim()
    const collectPointsRaw = $('acCollectPoints').value.trim()
    const collectAction = $('acCollectAction').value.trim()

    if (!teleportName) { appendLog('请填写传送点名称'); return }
    if (!mapName) { appendLog('请填写地图名'); return }
    if (!assertTargetRaw) { appendLog('请填写传送落点校验坐标'); return }
    if (!initialPathRaw) { appendLog('请填写初始路径'); return }
    if (!collectPointsRaw) { appendLog('请填写采集点列表'); return }

    const params = {
      Map_way: mapWay,
      route_id: routeId,
      teleport_name: teleportName,
      map_name: mapName,
      assert_target: parseJsonField(assertTargetRaw, 'assert_target'),
      initial_path: parseJsonField(initialPathRaw, 'initial_path'),
      collect_points: parseJsonField(collectPointsRaw, 'collect_points')
    }

    if (mapWay === 'MapNavigate') {
      if (!zoneId) { appendLog('MapNavigate 模式下请填写 zone_id'); return }
      params.zone_id = zoneId
    }

    if (collectAction) {
      params.collect_action_entry = collectAction
    }

    const res = await fetch('/api/generate-auto-collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(params)
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

    if (json.content) {
      $('acPreview').value = json.content
      $('acPreviewCard').style.display = ''
    }

    appendLog(`\n--- 已生成: ${json.fileName} ---`)
  } catch (e) {
    appendLog(`异常: ${e.message}`)
  } finally {
    btn.disabled = false
  }
})
