// ===== 规则层（模板逻辑）=====
// attempts 是生成结构规则，属于模板层。
const ATTEMPTS = [1, 2, 3, 4]

// default_case 属于“行为规则”，保留在模板里更通用。
const ATTEMPT_DEFAULT_CASE = {
  1: 'Yes',
  2: 'Yes',
  3: 'No',
  4: 'No'
}

function buildSelectCases(nodePrefix, attemptIndex, items, itemCatalog) {
  const selectNode = `SellProduct${nodePrefix}SelectItem${attemptIndex}`
  const cases = [
    {
      name: '无',
      pipeline_override: {
        [selectNode]: { enabled: false }
      }
    }
  ]

  for (const itemId of items) {
    // item 的显示文本/expected 属于数据，来自 data.smart.mjs 的 itemCatalog。
    const item = itemCatalog[itemId]
    if (!item) continue
    cases.push({
      name: item.name,
      pipeline_override: {
        [selectNode]: {
          enabled: true,
          expected: item.expected
        }
      },
      label: item.label
    })
  }

  return cases
}

function buildLocationOptions(location, itemCatalog) {
  const { RegionPrefix, LocationId, NodePrefix, items = [] } = location
  const option = {}
  const locationId = `${RegionPrefix}${LocationId}`
  const taskNode = `SellProduct${NodePrefix}`

  option[locationId] = {
    type: 'switch',
    label: `$task.SellProduct.${locationId}`,
    default_case: 'Yes',
    cases: [
      {
        name: 'Yes',
        pipeline_override: {
          [taskNode]: { enabled: true }
        },
        option: ATTEMPTS.map(i => `${locationId}Attempt${i}`)
      },
      {
        name: 'No',
        pipeline_override: {
          [taskNode]: { enabled: false }
        }
      }
    ]
  }

  for (const i of ATTEMPTS) {
    const attemptId = `${locationId}Attempt${i}`
    option[attemptId] = {
      type: 'switch',
      label: `$task.SellProduct.SellAttempt${i}`,
      default_case: ATTEMPT_DEFAULT_CASE[i],
      ...(i === 1 ? { description: '$task.SellProduct.SellAttemptDescription' } : {}),
      cases: [
        {
          name: 'Yes',
          pipeline_override: {
            [`SellProduct${NodePrefix}SellAttempt${i}`]: { enabled: true }
          },
          option: [`${locationId}Item${i}`]
        },
        {
          name: 'No',
          pipeline_override: {
            [`SellProduct${NodePrefix}SellAttempt${i}`]: { enabled: false }
          }
        }
      ]
    }

    option[`${locationId}Item${i}`] = {
      type: 'select',
      label: `$task.SellProduct.PriorityItem${i}`,
      default_case: '无',
      cases: buildSelectCases(NodePrefix, i, items, itemCatalog)
    }
  }

  return option
}

export default function buildTaskFragment(entry, helpers) {
  // ===== 数据层（来自 data.smart.mjs）=====
  const taskName = entry.taskName ?? 'SellProduct'
  const taskEntry = entry.taskEntry ?? 'SellProductMain'
  const taskLabel = entry.taskLabel ?? '$task.SellProduct.label'
  const taskDescription = entry.taskDescription ?? '$task.SellProduct.description'
  const taskGroup = Array.isArray(entry.taskGroup) ? entry.taskGroup : ['daily']
  const locations = Array.isArray(entry.locations) ? entry.locations : []
  const itemCatalog = entry.itemCatalog && typeof entry.itemCatalog === 'object' ? entry.itemCatalog : {}
  const regionPrefix = entry.regionPrefix
  const regionLabel = entry.regionLabel

  if (!regionPrefix || !regionLabel) {
    throw new Error('entry.regionPrefix 与 entry.regionLabel 为必填')
  }

  const regionToggleId = `${regionPrefix}Sell`
  const regionLocationIds = locations.map(loc => `${loc.RegionPrefix}${loc.LocationId}`)
  const option = {
    [regionToggleId]: {
      type: 'switch',
      label: regionLabel,
      description: '$task.SellProduct.regionToggleDescription',
      default_case: 'Yes',
      cases: [
        {
          name: 'Yes',
          pipeline_override: {
            [`SellProduct${regionPrefix}`]: { enabled: true }
          },
          option: regionLocationIds
        },
        {
          name: 'No',
          pipeline_override: {
            [`SellProduct${regionPrefix}`]: { enabled: false }
          }
        }
      ]
    }
  }

  for (const location of locations) {
    Object.assign(option, buildLocationOptions(location, itemCatalog))
  }

  return {
    task: [
      {
        name: taskName,
        label: taskLabel,
        entry: taskEntry,
        description: taskDescription,
        option: helpers.mergeUniqueStringArray([], [regionToggleId]),
        group: taskGroup
      }
    ],
    option
  }
}
