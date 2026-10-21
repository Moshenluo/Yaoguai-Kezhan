/**
 * 游戏图片预加载：把「即将用到」的图提前拉进浏览器缓存，
 * 避免玩家看到画面后图片才开始加载（白块 → 突然弹出）。
 *
 * 分批策略（按使用时机关卡）：
 * - boot 批：开屏后马上要看的 —— 白天场景底图 + 「实际可见」的贴片（按设施等级
 *   与已摆放装饰精确计算）+ 常驻 UI 图。在开屏期间拉，进度驱动开屏按钮。
 * - night 批：首次入夜前需要 —— 夜战地图、夜色底图、妖怪立绘、状态/体力图标。
 *   白天进入后空闲几秒悄悄补齐。
 * - extras 批：低频图（图鉴妖灵立绘、节日图标、精致档默认贴片等），串行慢补不抢带宽。
 * - 换肤时：按新皮肤重新预载「换肤后会显示」的全部贴片，换肤即换装不闪白。
 *
 * 全部 fire-and-forget：单图失败静默跳过，绝不阻塞游戏流程。
 */
import { SKINS } from './config'
import { SCENE_COMPS, type FacilityKey } from './scene-layers'

const cache = new Map<string, Promise<boolean>>()

/** 预载单图（去重；失败 resolve(false)，不抛错） */
export function preloadImage(src: string): Promise<boolean> {
  const hit = cache.get(src)
  if (hit) return hit
  const p = new Promise<boolean>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
  cache.set(src, p)
  return p
}

/** 串行预载（低速连接下不挤占带宽；已缓存项立刻返回） */
async function preloadSequential(srcs: string[], onEach?: (done: number) => void): Promise<void> {
  let done = 0
  for (const src of srcs) {
    await preloadImage(src)
    done += 1
    onEach?.(done)
  }
}

/** 并行预载（小图批用，快） */
export function preloadImages(srcs: string[]): Promise<boolean[]> {
  return Promise.all(srcs.map(preloadImage))
}

// ---------- 贴片地址计算 ----------

const DECO_COMPS = SCENE_COMPS.filter((c) => !c.facility)
const DECO_KEYS = new Set(DECO_COMPS.map((c) => c.key))

/** 贴片在指定皮肤/档位下的实际 src（皮肤覆盖优先，缺省回落默认图） */
export function pieceSrc(skinId: string | undefined, compKey: string, tier: 0 | 1): string {
  const comp = SCENE_COMPS.find((c) => c.key === compKey)
  if (!comp) return ''
  const override = SKINS.find((s) => s.id === skinId)?.sceneOverrides?.[compKey]?.[tier]
  return override?.src ?? comp.tiers[tier].src
}

/** 某皮肤某档的全部贴片地址（tier: 0=简陋档 1=精致档） */
export function compoSrcs(skinId: string | undefined, tier: 0 | 1): string[] {
  return SCENE_COMPS.map((c) => pieceSrc(skinId, c.key, tier))
}

/**
 * 「当前会显示在场景里」的贴片地址：
 * - 设施件按等级取档（Lv.0 未建不出现，Lv.1~2 简陋档，Lv.3+ 精致档）
 * - 装饰件只在已摆放时预载（两档都拉，升级档也顺带就绪）
 */
export function visiblePieceSrcs(
  skinId: string | undefined,
  facilityLv: Partial<Record<FacilityKey, number>> | undefined,
  placedDecoKeys: Iterable<string>,
): string[] {
  const out: string[] = []
  for (const comp of SCENE_COMPS) {
    if (!comp.facility) continue
    const lv = facilityLv?.[comp.key as FacilityKey] ?? 0
    if (lv <= 0) continue
    const tier: 0 | 1 = lv >= 3 ? 1 : 0
    out.push(pieceSrc(skinId, comp.key, tier))
  }
  for (const key of placedDecoKeys) {
    if (!DECO_KEYS.has(key)) continue
    out.push(pieceSrc(skinId, key, 0), pieceSrc(skinId, key, 1))
  }
  return out
}

// ---------- boot 批 ----------

const NAV_ICONS = [
  '/images/ui/gold.png',
  '/images/ui/gem.png',
  '/images/ui/ticket.png',
  '/images/ui/nav-yaokui.png',
  '/images/ui/nav-tujian.png',
  '/images/ui/nav-task.png',
  '/images/ui/nav-shop.png',
  '/images/ui/nav-bag.png',
  '/images/ui/nav-deco.png',
  '/images/ui/nav-map.png',
  '/images/ui/nav-gather.png',
  '/images/ui/stamina-normal.png',
  '/images/ui/ui-close.png',
  '/images/ui/ui-back.png',
  '/images/ui/ui-sun.png',
]

let bootStarted = false
let bootDoneCount = 0
let bootTotalCount = 0
const bootListeners = new Set<(ratio: number) => void>()

function notifyBoot() {
  const ratio = bootTotalCount === 0 ? 0 : bootDoneCount / bootTotalCount
  for (const cb of bootListeners) cb(ratio)
}

/** 订阅 boot 批进度（0~1）；返回取消订阅函数 */
export function onBootProgress(cb: (ratio: number) => void): () => void {
  bootListeners.add(cb)
  cb(bootTotalCount === 0 ? 0 : bootDoneCount / bootTotalCount)
  return () => bootListeners.delete(cb)
}

/**
 * boot 批：开屏期间预载白天场景骨架（底图 + 实际可见贴片 + 常驻 UI 图）。
 * 幂等（重复调用只跑一次）；进度通过 onBootProgress 观测。
 */
export function preloadBoot(
  skinId?: string,
  facilityLv?: Partial<Record<FacilityKey, number>>,
  placedDecoKeys?: Iterable<string>,
): void {
  if (bootStarted) return
  bootStarted = true
  const list = [
    '/images/scene/scene-splash.jpg',
    '/images/scene/scene-day.jpg',
    '/images/scene/terrain-empty.jpg',
    ...visiblePieceSrcs(skinId, facilityLv, placedDecoKeys ?? []),
    ...NAV_ICONS,
  ]
  bootTotalCount = list.length
  notifyBoot()
  void preloadSequential(list, (done) => {
    bootDoneCount = done
    notifyBoot()
  })
}

// ---------- skin 批（换肤即换装 / 进白天后补齐精致档） ----------

/**
 * 预载某皮肤的覆盖贴片（与默认图不同的部分）。
 * 换肤前调用保证不闪白；对非默认皮肤，进白天后也调用一次兜底。
 * 其余档位由 boot（可见贴片）与 extras（精致档默认图）覆盖，避免整包重拉。
 */
export function preloadSkinPieces(skinId: string | undefined): void {
  const skin = SKINS.find((s) => s.id === skinId)
  if (!skin?.sceneOverrides) return
  const srcs = Object.values(skin.sceneOverrides)
    .flatMap((ovr) => [ovr[0]?.src, ovr[1]?.src])
    .filter((src): src is string => !!src)
  void preloadSequential(srcs)
}

// ---------- night 批 ----------

const YAOGUAI_SPRITES = [
  'baize', 'bifang', 'chenghuang', 'heluoyu', 'jiuweihu', 'lei', 'lili', 'lu',
  'lushu', 'luwu', 'molin', 'qiuyu', 'shengsheng', 'taotie', 'xuangui',
  'yanling', 'yingzhao', 'yu', 'zheng',
].map((n) => `/images/yaoguai/${n}.png`)

/** night 批：入夜前必备 —— 夜战地图、夜色底图、妖怪立绘、战斗 UI 图标 */
export function preloadNightAssets(lineupIds?: string[]): void {
  // 当前阵容立绘加急：extras 批串行慢补大概率来不及，首入夜战会闪白
  const lineupSrcs = (lineupIds ?? []).map((id) => `/images/yaoguai/${id}.png`)
  void preloadImages([
    ...lineupSrcs,
    '/images/scene/scene-battle.jpg',
    '/images/scene/scene-night.jpg',
    '/images/enemy/enemy-1.png',
    '/images/enemy/enemy-2.png',
    '/images/enemy/enemy-3.png',
    '/images/ui/stamina-tired.png',
    '/images/ui/stamina-exhausted.png',
    '/images/ui/stamina-collapse.png',
    '/images/ui/status-stun.png',
    '/images/ui/status-slow.png',
    '/images/ui/status-burn.png',
    '/images/ui/status-charm.png',
    '/images/ui/status-mark.png',
    '/images/ui/status-lock.png',
    '/images/ui/prop-capture-net.png',
    '/images/ui/prop-stone-bag.png',
    '/images/ui/prop-haste-talisman.png',
    '/images/ui/prop-boss-lure.png',
    '/images/ui/fx-slash.png',
    '/images/ui/fx-burst.png',
    '/images/ui/fx-water.png',
    '/images/ui/fx-flame.png',
    '/images/ui/fx-ink.png',
    '/images/ui/fx-shield.png',
    '/images/ui/fx-heal.png',
    '/images/ui/fx-buff.png',
    '/images/ui/fx-dark.png',
    '/images/ui/skill-lili.png',
    '/images/ui/skill-shengsheng.png',
    '/images/ui/skill-lushu.png',
    '/images/ui/skill-xuangui.png',
    '/images/ui/skill-qiuyu.png',
    '/images/ui/skill-lei.png',
    '/images/ui/skill-lu.png',
    '/images/ui/skill-yu.png',
    '/images/ui/skill-zheng.png',
    '/images/ui/skill-heluoyu.png',
    '/images/ui/skill-jiuweihu.png',
    '/images/ui/skill-bifang.png',
    '/images/ui/skill-luwu.png',
    '/images/ui/skill-chenghuang.png',
    '/images/ui/skill-yingzhao.png',
    '/images/ui/skill-molin.png',
    '/images/ui/skill-yanling.png',
    '/images/ui/skill-baize.png',
    '/images/ui/skill-taotie.png',
    '/images/ui/region-1.png',
    '/images/ui/region-2.png',
    '/images/ui/region-3.png',
    '/images/ui/slot-pad.png',
    '/images/ui/play.png',
    '/images/ui/pause.png',
  ])
}

// ---------- extras 批（低频图，串行慢补不抢带宽） ----------

let extrasStarted = false

/** extras 批：妖灵立绘（图鉴/妖库/守卫）、节日与道具图标、全部精致档默认贴片 */
export function preloadExtras(): void {
  if (extrasStarted) return
  extrasStarted = true
  const uiRest = [
    '/images/ui/festival-lantern.png',
    '/images/ui/festival-newyear.png',
    '/images/ui/festival-qixi.png',
    '/images/ui/festival-midautumn.png',
    '/images/ui/festival-dongzhi.png',
    '/images/ui/festival-laba.png',
    '/images/ui/festival-huazhao.png',
    '/images/ui/festival-dragon.png',
    '/images/ui/gift.png',
    '/images/ui/ui-star.png',
    '/images/ui/dish-plain.png',
    '/images/ui/dish-signature.png',
    '/images/ui/dish-banquet.png',
    '/images/logo.png',
  ]
  // 默认精致档贴片：设施升级瞬间不闪白（皮肤覆盖档已由 skin 批拉过）
  const defaultTier1 = compoSrcs(undefined, 1)
  void preloadSequential([...uiRest, ...defaultTier1, ...YAOGUAI_SPRITES])
}