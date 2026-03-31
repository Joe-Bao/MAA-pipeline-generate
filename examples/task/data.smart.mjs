export const config = {
  target: '../../output/SellProduct.generated.smart.json'
}

// ===== 数据层：物品字典 =====
// 这部分明显是业务数据（名称、多语言 expected、label），
// 不放在模板规则里，便于后续仅改数据不改逻辑。
const ITEM_CATALOG = {
  BuckCapsuleA: {
    name: '精选荞愈胶囊',
    label: '$item.BuckCapsuleA',
    expected: ['精選蕎癒膠囊', '精选荞愈胶囊', '蕎花カプセルⅢ', '메밀꽃 치유 캡슐(대)', 'Buck Capsule [A]']
  },
  HCValleyBattery: {
    name: '高容谷地电池',
    label: '$item.HCValleyBattery',
    expected: ['高容量谷地電池', '高容谷地电池', '大容量谷地バッテリー', '대용량 협곡 배터리', 'HC Valley Battery']
  },
  CannedCitromeA: {
    name: '精选柑实罐头',
    label: '$item.CannedCitromeA',
    expected: ['精選柑實罐頭', '精选柑实罐头', 'シトロームの缶詰Ⅲ', '시트론 통조림(대)', 'Canned Citrome [A]']
  },
  SCValleyBattery: {
    name: '中容谷地电池',
    label: '$item.SCValleyBattery',
    expected: ['中容量谷地電池', '中容谷地电池', '中容量谷地バッテリー', '중용량 협곡 배터리', 'SC Valley Battery']
  },
  CannedCitromeB: {
    name: '优质柑实罐头',
    label: '$item.CannedCitromeB',
    expected: ['優質柑實罐頭', '优质柑实罐头', 'シトロームの缶詰Ⅱ', '시트론 통조림(중)', 'Canned Citrome [B]']
  },
  BuckCapsuleB: {
    name: '优质荞愈胶囊',
    label: '$item.BuckCapsuleB',
    expected: ['優質蕎癒膠囊', '优质荞愈胶囊', '蕎花カプセルⅡ', '메밀꽃 치유 캡슐(중)', 'Buck Capsule [B]']
  },
  BuckCapsuleC: {
    name: '荞愈胶囊',
    label: '$item.BuckCapsuleC',
    expected: ['蕎癒膠囊', '荞愈胶囊', '蕎花カプセルⅠ', '메밀꽃 치유 캡슐', 'Buck Capsule [C]']
  },
  CannedCitromeC: {
    name: '柑实罐头',
    label: '$item.CannedCitromeC',
    expected: ['柑實罐頭', '柑实罐头', 'シトロームの缶詰Ⅰ', '시트론 통조림', 'Canned Citrome [C]']
  },
  AmethystBottle: {
    name: '紫晶质瓶',
    label: '$item.AmethystBottle',
    expected: ['紫晶質瓶', '紫晶质瓶', '紫晶製ボトル', '자수정 병', 'Amethyst Bottle']
  },
  Origocrust: {
    name: '晶体外壳',
    label: '$item.Origocrust',
    expected: ['晶體外殼', '晶体外壳', '結晶外殻', '오리고 크러스트', 'Origocrust']
  },
  AmethystPart: {
    name: '紫晶零件',
    label: '$item.AmethystPart',
    expected: ['紫晶零件', '紫晶零件', '紫晶部品', '자수정 부품', 'Amethyst Part']
  },
  LCValleyBattery: {
    name: '低容谷地电池',
    label: '$item.LCValleyBattery',
    expected: ['低容量谷地電池', '低容谷地电池', '小容量谷地バッテリー', '저용량 협곡 배터리', 'LC Valley Battery']
  },
  FerriumPart: {
    name: '铁构零件',
    label: '$item.FerriumPart',
    expected: ['鐵構零件', '铁构零件', 'フェリウム部品', '페리움 부품', 'Ferrium Part']
  }
}

// ===== 数据层：区域与点位 =====
// Location / NodePrefix / items 这类是业务配置，放数据侧维护。
const LOCATIONS_VALLEY_IV = [
  {
    RegionPrefix: 'ValleyIV',
    LocationId: 'RefugeeCamp',
    NodePrefix: 'RefugeeCamp',
    items: [
      'BuckCapsuleA',
      'HCValleyBattery',
      'CannedCitromeA',
      'SCValleyBattery',
      'CannedCitromeB',
      'BuckCapsuleB',
      'BuckCapsuleC',
      'CannedCitromeC',
      'AmethystBottle',
      'Origocrust',
      'AmethystPart'
    ]
  },
  {
    RegionPrefix: 'ValleyIV',
    LocationId: 'InfrastructureOutpost',
    NodePrefix: 'InfrastructureOutpost',
    items: [
      'BuckCapsuleA',
      'HCValleyBattery',
      'CannedCitromeA',
      'SCValleyBattery',
      'CannedCitromeB',
      'BuckCapsuleB',
      'LCValleyBattery',
      'CannedCitromeC',
      'FerriumPart'
    ]
  }
]

export default [
  {
    name: 'ValleyIV-smart',
    taskName: 'SellProduct',
    taskEntry: 'SellProductMain',
    taskLabel: '$task.SellProduct.label',
    taskDescription: '$task.SellProduct.description',
    taskGroup: ['daily'],
    regionPrefix: 'ValleyIV',
    regionLabel: '$global.region.ValleyIV',
    locations: LOCATIONS_VALLEY_IV,
    itemCatalog: ITEM_CATALOG
  }
]
