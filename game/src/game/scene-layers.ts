/**
 * 场景组件层：白天场景不再是单一整图，而是「地形底图 + 设施建筑贴片」组成。
 * - 底图 terrain-empty.jpg 只画地形/植被/山石（无建筑）
 * - 每个设施一个建筑贴片，按设施等级显示：Lv.0 未建不出现，Lv.1~2 用简陋档，Lv.3+ 用精致档
 * - 贴片为透明 PNG，锚点是「底部中心」，z 序按 y 升序（越靠下越在前）
 * - 装饰件（deco）不挂设施，留给装扮模式自由摆放
 */
import type { GameSave } from './types'

export type FacilityKey = keyof GameSave['facilities']

export interface SceneCompTier {
  src: string
  /** 显示宽度，占场景宽度的百分比 */
  wPct: number
}

/** 装饰件打造/购买配方（预留）：后续在 store 实现 craftDeco/buyDeco 时读取 */
export interface DecoRecipe {
  /** 打造消耗金币 */
  gold?: number
  /** 打造消耗素材（materials id → 数量） */
  mats?: Record<string, number>
  /** 直接购买价（金币）；与打造二选一 */
  shopGold?: number
  /** 货单展示文案（如「山石凿灯」） */
  desc?: string
}

export interface SceneComp {
  key: string
  /** 中文名（名牌 / 货单用） */
  label: string
  /** 底部中心锚点（场景百分比坐标） */
  x: number
  y: number
  /** 两档皮肤：[简陋档, 精致档] */
  tiers: [SceneCompTier, SceneCompTier]
  /** 是否跟随设施等级自动出现（装饰件为 false） */
  facility: boolean
  /** 装饰件打造/购买配方（预留接口：暂未实装消耗，仅货单展示；接入后由 craftDeco 消费） */
  recipe?: DecoRecipe
  /** 多座解锁阈值（设施自身等级）：阈值 ≤ 当前等级的数量即可摆座数；缺省仅一座 */
  pieceCap?: number[]
  // TODO 皮肤奖励（出图计划）：绘制设施素材时同步产出「变体风格」贴片（如徽派/苗疆/水乡），
  // 作为成就/节庆奖励解锁后替换 tiers 档位或追加第三档皮肤
}

export const SCENE_COMPS: SceneComp[] = [
  {
    key: 'guestRoom',
    label: '客房',
    x: 18,
    y: 58,
    facility: true,
    // 产出主力：Lv1/10/20 各解锁一座（最多 3 座）
    pieceCap: [1, 10, 20],
    tiers: [
      { src: '/images/scene/compo/guest-room-1.png', wPct: 20 },
      { src: '/images/scene/compo/guest-room-2.png', wPct: 22 },
    ],
  },
  {
    key: 'hall',
    label: '大堂',
    x: 52,
    y: 54,
    facility: true,
    tiers: [
      { src: '/images/scene/compo/hall-1.png', wPct: 24 },
      { src: '/images/scene/compo/hall-2.png', wPct: 27 },
    ],
  },
  {
    key: 'kitchen',
    label: '后厨',
    x: 10,
    y: 74,
    facility: true,
    // Lv12 解锁第二座
    pieceCap: [1, 12],
    tiers: [
      { src: '/images/scene/compo/kitchen-1.png', wPct: 20 },
      { src: '/images/scene/compo/kitchen-2.png', wPct: 21 },
    ],
  },
  {
    key: 'warehouse',
    label: '仓库',
    x: 28,
    y: 84,
    facility: true,
    tiers: [
      { src: '/images/scene/compo/warehouse-1.png', wPct: 18 },
      { src: '/images/scene/compo/warehouse-2.png', wPct: 20 },
    ],
  },
  {
    key: 'powerPool',
    label: '妖力池',
    x: 86,
    y: 56,
    facility: true,
    tiers: [
      { src: '/images/scene/compo/powerpool-1.png', wPct: 18 },
      { src: '/images/scene/compo/powerpool-2.png', wPct: 23 },
    ],
  },
  {
    key: 'smithy',
    label: '铁匠铺',
    x: 72,
    y: 84,
    facility: true,
    tiers: [
      { src: '/images/scene/compo/smithy-1.png', wPct: 19 },
      { src: '/images/scene/compo/smithy-2.png', wPct: 21 },
    ],
  },
  {
    key: 'pharmacy',
    label: '药房',
    x: 36,
    y: 66,
    facility: true,
    // Lv14 解锁第二座
    pieceCap: [1, 14],
    tiers: [
      { src: '/images/scene/compo/pharmacy-1.png', wPct: 17 },
      { src: '/images/scene/compo/pharmacy-2.png', wPct: 18 },
    ],
  },
  {
    key: 'wishAltar',
    label: '许愿台',
    x: 88,
    y: 70,
    facility: true,
    tiers: [
      { src: '/images/scene/compo/wishaltar-1.png', wPct: 15 },
      { src: '/images/scene/compo/wishaltar-2.png', wPct: 16 },
    ],
  },
  {
    key: 'hotSpring',
    label: '温泉',
    x: 64,
    y: 72,
    facility: true,
    // 高阶设施：Lv15 才解锁第二座
    pieceCap: [1, 15],
    tiers: [
      { src: '/images/scene/compo/hotspring-1.png', wPct: 22 },
      { src: '/images/scene/compo/hotspring-2.png', wPct: 24 },
    ],
  },
  // 装饰件：不随设施出现，装扮模式可自由摆放多个
  {
    key: 'deco-lantern',
    label: '石灯笼',
    x: 40,
    y: 58,
    facility: false,
    // 打造配方（预留）：接入打造间后按此消耗扣费
    recipe: { gold: 120, desc: '山石凿灯' },
    tiers: [
      { src: '/images/scene/compo/deco-lantern-1.png', wPct: 9 },
      { src: '/images/scene/compo/deco-lantern-2.png', wPct: 9 },
    ],
  },
  {
    key: 'deco-screen',
    label: '徽派影壁',
    x: 46,
    y: 62,
    facility: false,
    recipe: { gold: 200, desc: '粉墙砌壁' },
    tiers: [
      { src: '/images/scene/compo/deco-screen-1.png', wPct: 12 },
      { src: '/images/scene/compo/deco-screen-2.png', wPct: 12 },
    ],
  },
]

/** 设施等级 → 皮肤档位（0=无建筑；1~2 简陋；3+ 精致） */
export function sceneTierIndex(level: number): 0 | 1 | null {
  if (level <= 0) return null
  return level >= 3 ? 1 : 0
}

/** 装饰每款可摆件数 */
export const DECO_PIECE_CAP = 4

/** 贴片可摆放数量上限：建筑按 pieceCap 阈值（设施自身等级解锁，各建筑节奏不同），装饰每款 4 件 */
export function sceneCap(comp: SceneComp, facilityLevel: number): number {
  if (!comp.facility) return DECO_PIECE_CAP
  const steps = comp.pieceCap ?? [1]
  return steps.filter((lv) => lv <= Math.max(0, facilityLevel)).length
}

/** 下一座解锁所需设施等级；已满或无下一座返回 null */
export function nextPieceGate(comp: SceneComp, facilityLevel: number): number | null {
  if (!comp.facility) return null
  const steps = comp.pieceCap ?? [1]
  return steps.find((lv) => lv > Math.max(0, facilityLevel)) ?? null
}

/** 全院总摆放上限：随客栈等级扩容（Lv1 → 12 件，每 4 级 +1，封顶 20） */
export function sceneTotalCap(innLevel: number): number {
  return Math.min(20, 12 + Math.floor(Math.max(0, innLevel - 1) / 4))
}