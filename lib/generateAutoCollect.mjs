import { format as formatJsonc, applyEdits } from 'jsonc-parser'

const VALID_MAP_WAYS = ['MapNavigate', 'MapTracker']

function validate(params) {
  const required = ['Map_way', 'route_id', 'teleport_name', 'map_name', 'assert_target', 'initial_path', 'collect_points']
  for (const key of required) {
    if (params[key] === undefined || params[key] === null) {
      throw new Error(`缺少必填参数: ${key}`)
    }
  }

  if (!VALID_MAP_WAYS.includes(params.Map_way)) {
    throw new Error(`Map_way 必须是 ${VALID_MAP_WAYS.join(' 或 ')}，当前值: ${params.Map_way}`)
  }

  if (typeof params.route_id !== 'number' || !Number.isInteger(params.route_id) || params.route_id < 1) {
    throw new Error('route_id 必须是正整数')
  }

  if (!Array.isArray(params.assert_target) || params.assert_target.length !== 2) {
    throw new Error('assert_target 必须是 [x, y] 格式的二元数组')
  }

  if (!Array.isArray(params.initial_path) || params.initial_path.length === 0) {
    throw new Error('initial_path 必须是非空数组')
  }

  if (!Array.isArray(params.collect_points) || params.collect_points.length === 0) {
    throw new Error('collect_points 必须是非空数组')
  }

  if (params.Map_way === 'MapNavigate' && !params.zone_id) {
    throw new Error('MapNavigate 模式下 zone_id 为必填参数')
  }
}

function buildAssertTarget(assertTarget) {
  const [x, y] = assertTarget
  return [x - 10, y - 10, 20, 20]
}

function buildActionParam(mapWay, mapName, pathArray, zoneId) {
  if (mapWay === 'MapNavigate') {
    return {
      custom_action: 'MapNavigateAction',
      custom_action_param: {
        map_name: mapName,
        path: [{ action: 'ZONE', zone_id: zoneId }, ...pathArray]
      }
    }
  }
  return {
    custom_action: 'MapTrackerMove',
    custom_action_param: {
      map_name: mapName,
      fine_approach: 'AllTargets',
      path: pathArray
    }
  }
}

function formatOutput(text) {
  try {
    const edits = formatJsonc(text, undefined, {
      tabSize: 4,
      insertSpaces: true,
      eol: '\n',
      keepLines: false,
      insertFinalNewline: true
    })
    return edits.length > 0 ? applyEdits(text, edits) : text
  } catch {
    return text
  }
}

/**
 * @param {object} params
 * @param {string} params.Map_way - 'MapNavigate' | 'MapTracker'
 * @param {number} params.route_id
 * @param {string} params.teleport_name
 * @param {string} params.map_name
 * @param {string} [params.zone_id] - required for MapNavigate
 * @param {[number, number]} params.assert_target
 * @param {Array} params.initial_path
 * @param {Array} params.collect_points
 * @param {string} [params.collect_action_entry]
 * @returns {{ fileName: string, content: string }}
 */
export function generateAutoCollect(params) {
  validate(params)

  const {
    Map_way: mapWay,
    route_id: routeId,
    teleport_name: teleportName,
    map_name: mapName,
    zone_id: zoneId,
    assert_target: assertTarget,
    initial_path: initialPath,
    collect_points: collectPoints,
    collect_action_entry: collectActionEntry = 'AutoCollectClickStart'
  } = params

  const prefix = `AutoCollectRoute${routeId}`
  const totalFinds = 1 + collectPoints.length
  const pipeline = {}

  pipeline[`${prefix}Start`] = {
    next: [
      `${prefix}AssertLocation`,
      `[JumpBack]SceneEnterWorld${teleportName}`
    ],
    focus: {
      'Node.Recognition.Succeeded': `开始路线${routeId}`
    }
  }

  pipeline[`${prefix}End`] = {
    pre_delay: 0,
    post_delay: 0
  }

  pipeline[`${prefix}AssertLocation`] = {
    desc: '传送到采集点',
    recognition: {
      type: 'Custom',
      param: {
        custom_recognition: 'MapTrackerAssertLocation',
        custom_recognition_param: {
          expected: [{
            map_name: mapName,
            target: buildAssertTarget(assertTarget)
          }]
        }
      }
    },
    next: [`${prefix}GotoFind1`]
  }

  const actionParam = buildActionParam(mapWay, mapName, initialPath, zoneId)
  const nextAfterFirst = totalFinds > 1 ? `${prefix}GotoFind2` : `${prefix}End`

  pipeline[`${prefix}GotoFind1`] = {
    desc: '前往采集点',
    action: {
      type: 'Custom',
      param: actionParam
    },
    anchor: {
      AutoCollectClickAfter: nextAfterFirst
    },
    next: [collectActionEntry]
  }

  for (let i = 0; i < collectPoints.length; i++) {
    const findIndex = i + 2
    const point = collectPoints[i]
    const coord = Array.isArray(point) ? point : [point.x, point.y]
    const pathEntry = [coord[0], coord[1], true]

    const isLast = i === collectPoints.length - 1
    const nextNode = isLast ? `${prefix}End` : `${prefix}GotoFind${findIndex + 1}`

    const segmentActionParam = buildActionParam(mapWay, mapName, [pathEntry], zoneId)

    pipeline[`${prefix}GotoFind${findIndex}`] = {
      desc: '前往采集点',
      action: {
        type: 'Custom',
        param: segmentActionParam
      },
      anchor: {
        AutoCollectClickAfter: nextNode
      },
      next: [collectActionEntry]
    }
  }

  const raw = JSON.stringify(pipeline)
  const content = formatOutput(raw)
  const fileName = `${prefix}.json`

  return { fileName, content }
}
