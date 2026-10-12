import type { SceneComp, SceneCompTier } from './scene-layers'
import type { Element, GameSave, InnFacilities, NightRole } from './types'

// ============ 妖怪客栈 · 数值配置 ============

/** 波次配置（5 层基础波次） */
export interface WaveConfig {
  wave: number
  /** 小妖数量 */
  minions: number
  /** 山怪数量 */
  brutes: number
  /** 精怪数量（远程敌人） */
  sprites: number
  /** 是否 BOSS 波（刷新英招） */
  boss?: boolean
  /** 精英妖怪刷新概率（第3/4/5波） */
  eliteChance: number
  /** 敌人属性倍率 */
  hpScale: number
  atkScale: number
  reward: { gold: number; gems: number }
}

export const WAVES: WaveConfig[] = [
  { wave: 1, minions: 4, brutes: 0, sprites: 0, eliteChance: 0, hpScale: 1, atkScale: 1, reward: { gold: 120, gems: 1 } },
  { wave: 2, minions: 5, brutes: 1, sprites: 0, eliteChance: 0, hpScale: 1.1, atkScale: 1.05, reward: { gold: 160, gems: 1 } },
  { wave: 3, minions: 6, brutes: 1, sprites: 1, eliteChance: 0.35, hpScale: 1.2, atkScale: 1.1, reward: { gold: 220, gems: 2 } },
  { wave: 4, minions: 7, brutes: 2, sprites: 1, eliteChance: 0.45, hpScale: 1.35, atkScale: 1.2, reward: { gold: 280, gems: 2 } },
  { wave: 5, minions: 6, brutes: 2, sprites: 1, boss: true, eliteChance: 0.6, hpScale: 1.5, atkScale: 1.3, reward: { gold: 400, gems: 5 } },
]

/** 关卡难度成长（level 1 为新手首夜保护，level>1 逐关递增） */
export function levelScale(level: number): { hp: number; atk: number; speed: number } {
  if (level <= 1) {
    // 新手首夜：仅初始3妖阵容也应能体验完整5波
    return { hp: 0.75, atk: 0.65, speed: 0.95 }
  }
  const l = level - 1
  return {
    hp: 1 + l * 0.32,
    atk: 1 + l * 0.25,
    speed: 1 + Math.min(l * 0.04, 0.4),
  }
}

/** 敌人基础模板 */
export const ENEMY_TYPES = {
  minion: { name: '小妖', img: '/images/enemy/enemy-1.png', hp: 50, atk: 6, speed: 7.5, size: 44 },
  brute: { name: '山怪', img: '/images/enemy/enemy-2.png', hp: 170, atk: 12, speed: 4.2, size: 56 },
  sprite: { name: '精怪', img: '/images/enemy/enemy-3.png', hp: 80, atk: 9, speed: 6, size: 48 },
} as const

/** 站位格（10 格：沿妖道两侧一圈分布——上排 5 / 下排 5，路百分比坐标；妖道带 42%~56%） */
export const SLOTS = [
  { slot: 0, x: 16, y: 38 },
  { slot: 1, x: 26, y: 61 },
  { slot: 2, x: 38, y: 37 },
  { slot: 3, x: 46, y: 63 },
  { slot: 4, x: 56, y: 36 },
  { slot: 5, x: 58, y: 61 },
  { slot: 6, x: 68, y: 37 },
  { slot: 7, x: 70, y: 62 },
  { slot: 8, x: 80, y: 40 },
  { slot: 9, x: 82, y: 62 },
]

/** 基础站位数（默认开放） */
export const BASE_SLOTS = 6

/** 每个站位格的解锁客栈等级（0 = 默认开放；第 7~10 格随客栈养成解锁，养成↔塔防联动） */
export const SLOT_UNLOCK_INN_LEVEL: number[] = [0, 0, 0, 0, 0, 0, 8, 15, 22, 30]

/** 某站位格解锁所需的客栈等级（0 表示无需解锁） */
export function slotUnlockAt(slot: number): number {
  return SLOT_UNLOCK_INN_LEVEL[slot] ?? 0
}

/** 当前客栈等级可用的最大站位数（4/5/6） */
export function maxSlotsForInn(innLevel: number): number {
  let n = BASE_SLOTS
  for (let i = BASE_SLOTS; i < SLOTS.length; i++) {
    if (innLevel >= SLOT_UNLOCK_INN_LEVEL[i]) n = i + 1
  }
  return n
}

// ============ 妖王夜（V1.1 传说妖王玩法） ============

export const BOSS_NIGHT = {
  /** 解锁条件：累计守店胜利次数 */
  unlockWins: 3,
  /** 妖王夜整体敌军强化（叠加在 levelScale 之上） */
  hpScale: 1.3,
  atkScale: 1.2,
  /** 妖王夜通关奖励倍率（相对波次奖励） */
  rewardMult: 2,
  /** 妖王捕捉：基础概率极低，需多次挑战 */
  captureBaseRate: 0.05,
  /** 每次失败累计加成 */
  attemptBonusRate: 0.15,
  /** 保底次数 */
  pityAttempts: 5,
} as const

/** 妖王夜波次（亲卫强敌，第5波刷新传说妖王 BOSS） */
export const BOSS_NIGHT_WAVES: WaveConfig[] = [
  { wave: 1, minions: 5, brutes: 1, sprites: 0, eliteChance: 0, hpScale: 1, atkScale: 1, reward: { gold: 160, gems: 2 } },
  { wave: 2, minions: 6, brutes: 1, sprites: 1, eliteChance: 0.2, hpScale: 1.15, atkScale: 1.1, reward: { gold: 230, gems: 2 } },
  { wave: 3, minions: 7, brutes: 2, sprites: 1, eliteChance: 0.45, hpScale: 1.3, atkScale: 1.2, reward: { gold: 330, gems: 3 } },
  { wave: 4, minions: 8, brutes: 2, sprites: 2, eliteChance: 0.6, hpScale: 1.45, atkScale: 1.3, reward: { gold: 430, gems: 3 } },
  { wave: 5, minions: 6, brutes: 3, sprites: 2, boss: true, eliteChance: 0.8, hpScale: 1.6, atkScale: 1.45, reward: { gold: 800, gems: 8 } },
]

/** 妖王轮换：偶数次妖王夜→白泽，奇数→饕餮 */
export function currentBossId(bossWins: number): 'baize' | 'taotie' {
  return bossWins % 2 === 0 ? 'baize' : 'taotie'
}

// ============ 世界地图 · 区域系统（V1.2 新区域探索 + 连锁分店） ============

/** 区域定义（当前三片：客栈山道 / 水墨幽谷 / 沸火赤川） */
export interface RegionDef {
  id: 1 | 2 | 3
  /** 区域名 */
  name: string
  /** 副题（战斗 BGM 曲名） */
  subtitle: string
  icon: string
  /** 风物志描述 */
  desc: string
  /** 夜战 BGM 轨道名（对应 audio.ts BgmTrackName 的 night / night2 / night3） */
  bgmTrack: 'night' | 'night2' | 'night3'
  /** 敌人视觉主题（区域二水墨风：应用在 BattleField 敌人贴图与夜战场景） */
  enemyFilter: string
  /** 夜战场景滤镜（应用在 scene-night 背景） */
  sceneFilter: string
  /** 敌人数值倍率（叠加在 levelScale 之上） */
  hpScale: number
  atkScale: number
  /** 通关奖励倍率（金币/灵石掉落） */
  rewardMult: number
  /** 精英刷新概率加成 */
  eliteBonus: number
  /** 野怪名称（区域二换水墨风野怪名） */
  enemyNames: { minion: string; brute: string; sprite: string }
  /** 区域主题色（UI 用，禁冷蓝） */
  themeColor: string
  /** 场景背景图（夜战） */
  scene: string
}

export const REGIONS: RegionDef[] = [
  {
    id: 1,
    name: '客栈山道',
    subtitle: '夜袭客栈',
    icon: '/images/ui/region-1.png',
    desc: '客栈门前的山道，入夜总有野妖摸黑来偷吃。妖王英招偶尔压阵第 5 波。',
    bgmTrack: 'night',
    enemyFilter: 'none',
    sceneFilter: 'none',
    hpScale: 1,
    atkScale: 1,
    rewardMult: 1,
    eliteBonus: 0,
    enemyNames: { minion: '小妖', brute: '山怪', sprite: '精怪' },
    themeColor: '#8B2E24',
    scene: '/images/scene/scene-battle.jpg',
  },
  {
    id: 2,
    name: '水墨幽谷',
    subtitle: '水墨藏锋',
    icon: '/images/ui/region-2.png',
    desc: '谷中雾气如墨、笔锋藏杀，栖息着水墨系野妖。分店「水墨别院」坐落于此，守店收益丰厚。',
    bgmTrack: 'night2',
    enemyFilter: 'grayscale(0.82) contrast(1.22) brightness(1.02) saturate(0.55)',
    sceneFilter: 'grayscale(0.35) contrast(1.12) brightness(0.92) saturate(0.6)',
    hpScale: 1.15,
    atkScale: 1.12,
    rewardMult: 1.35,
    eliteBonus: 0.12,
    enemyNames: { minion: '墨妖', brute: '石魈', sprite: '雾灵' },
    themeColor: '#4A4458',
    scene: '/images/scene/scene-battle.jpg',
  },
  {
    id: 3,
    name: '沸火赤川',
    subtitle: '赤川沸火',
    icon: '/images/ui/region-3.png',
    desc: '地脉奔涌的赤色火川，熔岩为溪、火魅成群。分店「沸泉别馆」依地热而建，守店收益极丰。',
    bgmTrack: 'night3',
    enemyFilter: 'sepia(0.45) saturate(1.9) hue-rotate(-18deg) contrast(1.18) brightness(0.96)',
    sceneFilter: 'sepia(0.3) saturate(1.6) hue-rotate(-12deg) contrast(1.1) brightness(0.88)',
    hpScale: 1.32,
    atkScale: 1.28,
    rewardMult: 1.8,
    eliteBonus: 0.25,
    enemyNames: { minion: '火魅', brute: '熔岩怪', sprite: '焰灵' },
    themeColor: '#A8402F',
    scene: '/images/scene/scene-battle.jpg',
  },
]

/** 区域 id → 定义 */
export function regionDef(id: 1 | 2 | 3): RegionDef {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0]
}

/** 区域二（水墨幽谷分店）解锁前置：客栈山道进度 + 累计守店胜利 */
export const REGION2_UNLOCK = {
  /** 客栈山道关卡进度要求 */
  level: 6,
  /** 累计守店胜利要求 */
  wins: 5,
  /** 开设分店费用（金币） */
  openCost: 8000,
} as const

/** 区域三（沸火赤川分店）解锁前置：水墨幽谷进度 + 累计守店胜利 + 门票 */
export const REGION3_UNLOCK = {
  /** 水墨幽谷关卡进度要求 */
  level: 10,
  /** 累计守店胜利要求（全部区域合计） */
  wins: 8,
  /** 开设分店费用（金币） */
  openCost: 25000,
} as const

/** 水墨分店开设后的挂机金币加成（+30%） */
export const BRANCH_GOLD_BONUS = 0.3
/** 水墨分店开设后的全体休息恢复加成（+20%，PRD 分店远程恢复体力联动） */
export const BRANCH_STAMINA_BONUS = 0.2
/** 沸火分店开设后的挂机金币加成（+50%，与水墨分店叠加） */
export const BRANCH3_GOLD_BONUS = 0.5
/** 沸火分店开设后的全体休息恢复加成（+30%，与水墨分店叠加） */
export const BRANCH3_STAMINA_BONUS = 0.3

/** 区域二前置条件是否满足（可开分店状态） */
export function region2Unlockable(save: GameSave): boolean {
  return !save.region2Opened && save.level >= REGION2_UNLOCK.level && save.stats.wins >= REGION2_UNLOCK.wins
}

/** 区域三前置条件是否满足（可开分店状态） */
export function region3Unlockable(save: GameSave): boolean {
  return (
    !save.region3Opened &&
    save.region2Opened &&
    (save.region2Level ?? 1) >= REGION3_UNLOCK.level &&
    save.stats.wins >= REGION3_UNLOCK.wins
  )
}

/** 某区域的当前关卡进度 */
export function regionLevelOf(save: GameSave, region: 1 | 2 | 3): number {
  if (region === 2) return save.region2Level ?? 1
  if (region === 3) return save.region3Level ?? 1
  return save.level
}

/** 当前驻扎区域的关卡进度 */
export function currentRegionLevel(save: GameSave): number {
  return regionLevelOf(save, save.region)
}

// ============ 捉妖数值 ============

/** 可捕捉血线（30%） */
export const CAPTURE_HP_THRESHOLD = 0.3
/** 残血保护线（5%，停止所有伤害） */
export const PROTECT_HP_THRESHOLD = 0.05
/** 基础捕捉概率区间（血量30%→10%，血量趋近0→60%） */
export const CAPTURE_RATE = { min: 0.1, max: 0.6 }
/** 累计挑战加成：3次后概率+10% */
export const ATTEMPT_BONUS_STEP = 3
export const ATTEMPT_BONUS_RATE = 0.1
/** 保底：累计挑战5次必定收服 */
export const PITY_ATTEMPTS = 5
/** 看广告捕捉加成 */
export const AD_CAPTURE_BONUS = 0.2
/** 野性难驯：稀有精英刷新时概率桀赊不驯，本夜无法收服只能放归（V1.2.1 新增） */
export const RARE_WILD_RATE = 0.3

// ============ 客栈经营数值（八大设施：白天产出 + 夜晚定位联动） ============

/** 设施特殊能力解锁等级 */
export const FACILITY_ABILITY_LEVEL = 3
/** 设施特殊能力强化等级 */
export const FACILITY_ABILITY_ENHANCE = 5

/** 设施对应的夜晚定位 */
export type FacilityRoleKey = 'atk' | 'def' | 'support' | 'ctrl' | 'mage' | 'phys' | 'heal' | 'global'

/** 夜晚属性加成定义（每级百分比） */
export interface FacilityNightBonus {
  /** 攻击加成 %/级 */
  atk?: number
  /** 生命加成 %/级 */
  hp?: number
  /** 防御减伤 %/级（每点降低受伤 0.4%，上限 50%） */
  def?: number
  /** 暴击率加成 %/级 */
  crit?: number
  /** 技能伤害加成 %/级 */
  skillDmg?: number
  /** 治疗效果加成 %/级 */
  heal?: number
  /** 控制时长加成 %/级 */
  ctrl?: number
  /** 减速幅度加成 %/级 */
  slow?: number
  /** 能量（技能CD）回复加成 %/级（缩短技能CD） */
  energy?: number
}

export interface FacilityConfig {
  key: keyof InnFacilities
  name: string
  icon: string
  desc: string
  baseCost: number
  costGrow: number
  /** 每级金币产出/秒 */
  goldPerLevel: number
  maxLevel: number
  /** 联动定位 key */
  role: FacilityRoleKey
  /** 联动定位名（如「攻击型」） */
  roleName: string
  /** 定位徽章主题色 */
  roleColor: string
  /** 对应的夜晚定位（global = 全体生效） */
  targetRoles: NightRole[] | 'global'
  /** 每级夜晚属性加成（对应定位 100%，非对应 50%） */
  nightBonus: FacilityNightBonus
  /** 夜晚加成文案 */
  nightDesc: string
  /** Lv.3 解锁的特殊能力 */
  ability: { name: string; desc: string; enhanceDesc: string }
  /** 建造/升级所需的最低客栈等级（缺省 = 无门槛；温泉汤院需客栈 5 级） */
  unlockInnLevel?: number
}

export const FACILITIES: FacilityConfig[] = [
  {
    key: 'kitchen', name: '后厨', icon: '/images/ui/facility-kitchen.png', desc: '火候正旺，荤香四溢',
    baseCost: 200, costGrow: 1.6, goldPerLevel: 0.8, maxLevel: 30,
    role: 'atk', roleName: '攻击型', roleColor: '#C0392B', targetRoles: ['ranged'],
    nightBonus: { atk: 5, crit: 2 }, nightDesc: '攻击型妖怪 攻击+5%/级 · 暴击+2%/级',
    ability: { name: '美食增益', desc: '守卫开场首击造成 150% 伤害', enhanceDesc: 'Lv.5 强化：首击 175% 伤害' },
  },
  {
    key: 'guestRoom', name: '客房', icon: '/images/ui/facility-guestRoom.png', desc: '妖客安睡，养精蓄锐',
    baseCost: 150, costGrow: 1.55, goldPerLevel: 0.5, maxLevel: 30,
    role: 'def', roleName: '防御型', roleColor: '#8B2E24', targetRoles: ['tank'],
    nightBonus: { hp: 8, def: 5 }, nightDesc: '防御型妖怪 生命+8%/级 · 防御减伤+5%/级',
    ability: { name: '舒适休憩', desc: '守卫每 3 秒回复 2% 生命', enhanceDesc: 'Lv.5 强化：每 3 秒回 3% 生命' },
  },
  {
    key: 'hall', name: '大堂', icon: '/images/ui/facility-hall.png', desc: '迎来送往，宾至如归',
    baseCost: 180, costGrow: 1.58, goldPerLevel: 0.45, maxLevel: 30,
    role: 'support', roleName: '辅助型', roleColor: '#B9770E', targetRoles: ['support'],
    nightBonus: { skillDmg: 6, heal: 8 }, nightDesc: '辅助型妖怪 技能效果+6%/级 · 治疗+8%/级',
    ability: { name: '热情服务', desc: '守卫技能作用范围 +20%', enhanceDesc: 'Lv.5 强化：范围 +30%' },
  },
  {
    key: 'warehouse', name: '仓库', icon: '/images/ui/facility-warehouse.png', desc: '奇物囤积，陷阱暗藏',
    baseCost: 120, costGrow: 1.55, goldPerLevel: 0.35, maxLevel: 30,
    role: 'ctrl', roleName: '控制型', roleColor: '#6B4E8E', targetRoles: ['controller'],
    nightBonus: { ctrl: 10, slow: 5 }, nightDesc: '控制型妖怪 控制时长+10%/级 · 减速+5%/级',
    ability: { name: '陷阱布置', desc: '守卫普攻 20% 概率眩晕敌人 1 秒', enhanceDesc: 'Lv.5 强化：概率提升至 25%' },
  },
  {
    key: 'powerPool', name: '妖力池', icon: '/images/ui/facility-powerPool.png', desc: '灵气汇聚，妖力涌动',
    baseCost: 800, costGrow: 1.62, goldPerLevel: 0.6, maxLevel: 30,
    role: 'mage', roleName: '法术型', roleColor: '#16777B', targetRoles: ['mage'],
    nightBonus: { skillDmg: 7, energy: 5 }, nightDesc: '法术型妖怪 技能伤害+7%/级 · 技能CD -5%/级',
    ability: { name: '妖力涌动', desc: '击杀后 5 秒攻速 +30%', enhanceDesc: 'Lv.5 强化：攻速 +45%' },
  },
  {
    key: 'smithy', name: '铁匠铺', icon: '/images/ui/facility-smithy.png', desc: '炉火不熄，利刃出鞘',
    baseCost: 1200, costGrow: 1.62, goldPerLevel: 0.55, maxLevel: 30,
    role: 'phys', roleName: '物理型', roleColor: '#8B5E3C', targetRoles: ['assassin'],
    nightBonus: { atk: 3, crit: 1 }, nightDesc: '物理型妖怪 攻击+3%/级 · 暴击+1%/级',
    ability: { name: '利刃打磨', desc: '普攻 15% 概率造成双倍伤害', enhanceDesc: 'Lv.5 强化：概率提升至 20%' },
  },
  {
    key: 'pharmacy', name: '药房', icon: '/images/ui/facility-pharmacy.png', desc: '丹香弥漫，妙手回春',
    baseCost: 2000, costGrow: 1.62, goldPerLevel: 0.5, maxLevel: 30,
    role: 'heal', roleName: '治疗型', roleColor: '#C2185B', targetRoles: ['healer'],
    nightBonus: { heal: 10 }, nightDesc: '治疗型妖怪 治疗效果+10%/级',
    ability: { name: '丹药储备', desc: '守卫首次致死免死并回 30% 生命', enhanceDesc: 'Lv.5 强化：回复 45% 生命' },
  },
  {
    key: 'wishAltar', name: '许愿台', icon: '/images/ui/facility-wishAltar.png', desc: '神灵庇佑，福泽满门',
    baseCost: 3000, costGrow: 1.65, goldPerLevel: 0.4, maxLevel: 30,
    role: 'global', roleName: '全局', roleColor: '#E8B84B', targetRoles: 'global',
    nightBonus: { atk: 2, hp: 2 }, nightDesc: '全体妖怪 攻击/生命 +2%/级（不受定位限制）',
    ability: { name: '神灵庇佑', desc: '客栈血量低于 20% 时无敌 2 秒（每场一次）', enhanceDesc: 'Lv.5 强化：无敌 3 秒' },
  },
  {
    key: 'hotSpring', name: '温泉汤院', icon: '/images/ui/facility-hotSpring.png', desc: '地热涌泉，涤荡疲惫（需客栈 5 级）',
    baseCost: 5000, costGrow: 1.7, goldPerLevel: 0.3, maxLevel: 30, unlockInnLevel: 5,
    role: 'heal', roleName: '全体', roleColor: '#16777B', targetRoles: 'global',
    nightBonus: { heal: 4 }, nightDesc: '汤泉回春：全体守卫战斗中每秒回复 0.15%×等级 生命',
    ability: { name: '硭磺疗愈', desc: '温泉体力恢复效果额外 +50%', enhanceDesc: 'Lv.5 强化：每波开始时全体守卫回复 15% 生命' },
  },
]

/** 设施战斗加成汇总（引擎消费） */
export interface FacilityBattleBonus {
  atkPct: number // 攻击总加成%（0.05=+5%）
  hpPct: number
  critPct: number // 暴击率加成（0.02=+2%）
  defPct: number // 防御减伤%
  skillDmgPct: number
  healPct: number
  ctrlPct: number
  slowPct: number
  energyPct: number
  /** 各设施等级快照（Lv.3 能力判定） */
  levels: InnFacilities
}

/**
 * 计算某定位妖怪从八大设施获得的夜晚战斗加成
 * - 对应定位设施：100% 效果
 * - 非对应定位设施：50% 效果（PRD 联动核心规则）
 * - 许愿台：全局，所有定位 100%
 * - allround 全能型：定向设施一律 50%，许愿台 100%
 */
export function computeFacilityBonus(facilities: InnFacilities, role: NightRole): FacilityBattleBonus {
  const b: FacilityBattleBonus = {
    atkPct: 0, hpPct: 0, critPct: 0, defPct: 0, skillDmgPct: 0,
    healPct: 0, ctrlPct: 0, slowPct: 0, energyPct: 0,
    levels: facilities,
  }
  for (const f of FACILITIES) {
    const lv = facilities[f.key]
    if (lv <= 0) continue
    const matched = f.targetRoles === 'global' || f.targetRoles.includes(role)
    // 全能型对定向设施只吃 50%；许愿台全局 100%
    const ratio = f.targetRoles === 'global' ? 1 : matched ? (role === 'allround' ? 0.5 : 1) : 0.5
    const nb = f.nightBonus
    b.atkPct += ((nb.atk ?? 0) * lv * ratio) / 100
    b.hpPct += ((nb.hp ?? 0) * lv * ratio) / 100
    b.critPct += ((nb.crit ?? 0) * lv * ratio) / 100
    b.defPct += ((nb.def ?? 0) * lv * ratio) / 100
    b.skillDmgPct += ((nb.skillDmg ?? 0) * lv * ratio) / 100
    b.healPct += ((nb.heal ?? 0) * lv * ratio) / 100
    b.ctrlPct += ((nb.ctrl ?? 0) * lv * ratio) / 100
    b.slowPct += ((nb.slow ?? 0) * lv * ratio) / 100
    b.energyPct += ((nb.energy ?? 0) * lv * ratio) / 100
  }
  // 暴击率上限 40%
  b.critPct = Math.min(b.critPct, 0.4)
  // defPct 保留原始累计（引擎侧与等级加成统一按每点 0.4% 换算减伤，上限 50%）
  return b
}

/** 设施是否已解锁特殊能力（Lv.3） */
export function facilityAbilityActive(facilities: InnFacilities, key: keyof InnFacilities): boolean {
  return facilities[key] >= FACILITY_ABILITY_LEVEL
}

/** 设施特殊能力是否已强化（Lv.5） */
export function facilityAbilityEnhanced(facilities: InnFacilities, key: keyof InnFacilities): boolean {
  return facilities[key] >= FACILITY_ABILITY_ENHANCE
}

export function facilityCost(cfg: FacilityConfig, level: number): number {
  return Math.floor(cfg.baseCost * Math.pow(cfg.costGrow, level))
}

/** 基础金币产出/秒（水墨分店开张后整体 +30%；V1.3.1 经济再测调：0.5→0.32，挂机收益进一步收紧） */
export const ECONOMY_GOLD_MULT = 0.32

export function baseGoldRate(save: GameSave): number {
  let rate = 1
  for (const f of FACILITIES) {
    rate += save.facilities[f.key] * f.goldPerLevel
  }
  // 客栈等级全局加成 5%/级
  rate *= 1 + save.innLevel * 0.05
  // 连锁分店加成（区域二 +30%，区域三再 +50% 叠乘）
  if (save.region2Opened) rate *= 1 + BRANCH_GOLD_BONUS
  if (save.region3Opened) rate *= 1 + BRANCH3_GOLD_BONUS
  return rate * ECONOMY_GOLD_MULT
}

/** 基础灵石产出/秒（较稀有；V1.3.1 经济再测调：产出再降约 45%） */
export function baseGemRate(save: GameSave): number {
  return 0.0011 + save.innLevel * 0.00045 + save.facilities.kitchen * 0.00028
}

/** 夜战胜利灵石结算：基础 1 + 关卡进度/4（V1.3.1 经济再测调） */
export function victoryGems(level: number): number {
  return 1 + Math.floor(level / 4)
}

/** 夜战胜利金币尾款：每级 110（V1.3.1 经济再测调：150→110） */
export const VICTORY_GOLD_PER_LEVEL = 110

// ============ 妖怪升级系统（V1.2 双线养成：升级 + 升星） ============

/** 每级属性成长：攻击+3%/级、生命+4%/级、防御减伤+2%/级 */
export const LEVEL_BONUS = { atk: 0.03, hp: 0.04, def: 0.02 } as const

/** 等级上限 = 星级 × 10（1★→10 … 5★→50） */
export function levelCapForStar(star: number): number {
  return star * 10
}

/** 升到下一级所需经验 */
export function expToNext(level: number): number {
  return Math.floor(40 * Math.pow(1.16, level - 1))
}

/** 经验药水配置 */
export interface PotionDef {
  id: 'small' | 'medium' | 'large'
  name: string
  icon: string
  exp: number
  /** 购买货币与价格 */
  currency: 'gold' | 'gems'
  price: number
  desc: string
}

export const EXP_POTIONS: PotionDef[] = [
  { id: 'small', name: '小瓶经验露', icon: '/images/ui/potion-exp-small.png', exp: 30, currency: 'gold', price: 600, desc: '经验 +30' },
  { id: 'medium', name: '中瓶经验露', icon: '/images/ui/potion-exp-medium.png', exp: 100, currency: 'gold', price: 1900, desc: '经验 +100' },
  { id: 'large', name: '大瓶经验露', icon: '/images/ui/potion-exp-large.png', exp: 300, currency: 'gems', price: 30, desc: '经验 +300（灵石购买）' },
]

/** 夜战参战经验：每只上阵妖怪获得 */
export function battleExpGain(waveReached: number, victory: boolean, bossNight = false): number {
  const base = 12 + waveReached * 8
  return Math.round(base * (victory ? 2 : 1) * (bossNight ? 1.5 : 1))
}

/** 等级→战斗力展示（面板估值） */
export function yaoguaiPower(def: { atk: number; hp: number }, star: number, level: number): number {
  const starMult = starBattleMultiplier(star)
  const lvlAtk = 1 + (level - 1) * LEVEL_BONUS.atk
  const lvlHp = 1 + (level - 1) * LEVEL_BONUS.hp
  return Math.round((def.atk * lvlAtk * 2 + def.hp * lvlHp / 10) * starMult)
}

/** 妖怪打工总加成（%） */
export interface JobBonus {
  goldRate: number
  gemRate: number
  globalRate: number
  offlineRate: number
  innHpRate: number
  rareRate: number
}

/** 离线收益上限（小时） */
export const OFFLINE_CAP_HOURS = 8
/** 离线效率 */
export const OFFLINE_EFFICIENCY = 0.6

// ============ 客栈等级 ============

/** 升级所需经验（经验来自金币收益，1金币=1经验） */
export function innExpNeeded(level: number): number {
  return Math.floor(300 * Math.pow(1.5, level - 1))
}

// ============ 升星数值 ============

export const MAX_STAR = 5
/** 升到 n 星所需持有数量（含当前） */
export const STAR_REQUIRE: Record<number, number> = {
  1: 1,
  2: 3,
  3: 6,
  4: 10,
  5: 15,
}

/** 星级战斗倍率 */
export function starBattleMultiplier(star: number): number {
  return 1 + (star - 1) * 0.35
}

// ============ 商店/招募 ============

export const RECRUIT_COST = {
  normal: 650, // 金币单抽（V1.3.1 经济再测调：350→650）
  ten: 5850, // 金币十连（保底稀有；约九折）
  advanced: 45, // 灵石高级单抽（V1.3.1：25→45）
  advancedTen: 405, // 灵石高级十连（必得稀有；约九折）
}
/** 高级招募稀有概率（V1.3.1 再调低：28%→20%） */
export const ADVANCED_RARE_RATE = 0.2
/** 普通招募权重（普通小妖均分；V1.3.1：稀有概率 1.5%→0.8%） */
export const NORMAL_POOL_RATE = 0.992
/** 普通单抽稀有概率（V1.3.1 再调低：1.5%→0.8%） */
export const NORMAL_RARE_RATE = 0.008
/** 普通十连非保底位稀有概率（V1.3.1：2.5%→1.2%） */
export const NORMAL_TEN_RARE_RATE = 0.012
/** 每日免费招募稀有概率（V1.3.1：3%→1.5%） */
export const FREE_RARE_RATE = 0.015

/** 收服耗贃：每次尝试收服消耗客栈灵石（V1.3.1 新增；传说妖王另计） */
export const CAPTURE_GEM_COST = {
  /** 精英小妖每次尝试 */
  normal: 5,
  /** 传说妖王（妖王夜 BOSS）每次尝试 */
  boss: 20,
} as const

/** 妖王诱引香（V1.3.1 新增）：今日妖王退散后可焚香再召一场妖王夜 */
export const BOSS_LURE = {
  id: 'boss-lure',
  name: '妖王诱引香',
  /** 商店售价（灵石） */
  price: 30,
  desc: '今日妖王已退散后，可焚香再召一场妖王夜',
} as const

/** 缚妖网（V1.1 道具实装）：夜战中张网，本场收服成功率 +15%（精英与妖王通用） */
export const CAPTURE_NET = {
  id: 'capture-net',
  name: '缚妖网',
  /** 商店售价（灵石） */
  price: 15,
  /** 收服成功率加成（0-1，与广告增益叠加） */
  bonus: 0.15,
  desc: '夜战中张网，本场收服成功率 +15%',
} as const

/** 聚宝符（V1.1 道具实装）：激活后 15 分钟，挂机金币与灵石收益 ×2 */
export const HASTE_TALISMAN = {
  id: 'haste-talisman',
  name: '聚宝符',
  /** 商店售价（灵石） */
  price: 12,
  /** 持续分钟数 */
  minutes: 15,
  /** 收益倍率（金币与灵石同乘） */
  mult: 2,
  desc: '激活后 15 分钟，挂机金币与灵石收益 ×2',
} as const

// ============ 每日任务 ============

export interface DailyTask {
  id: string
  name: string
  desc: string
  target: number
  reward: { gold?: number; gems?: number; tickets?: number }
}

export const DAILY_TASKS: DailyTask[] = [
  { id: 'login', name: '每日签到', desc: '登录游戏即可领取', target: 1, reward: { gold: 100, gems: 1 } },
  { id: 'night', name: '守店一晚', desc: '完成一次夜间守店战斗', target: 1, reward: { gold: 150, tickets: 1 } },
  { id: 'capture', name: '捉妖一只', desc: '夜间控血收服任意妖怪', target: 1, reward: { gems: 3, tickets: 1 } },
  { id: 'recruit', name: '招募妖怪', desc: '在商店招募一次妖怪', target: 1, reward: { gold: 120 } },
  { id: 'ad', name: '观看广告', desc: '观看任意激励视频广告', target: 1, reward: { gold: 80, gems: 1 } },
  { id: 'upgrade', name: '修缮客栈', desc: '升级任意客栈设施 1 次', target: 1, reward: { gold: 150, gems: 1 } },
  { id: 'starup', name: '妖力精进', desc: '完成 1 次妖怪升星', target: 1, reward: { gems: 4, tickets: 1 } },
]

// ============ 图鉴收集奖励 ============

export const TUJIAN_REWARDS = [
  { count: 3, reward: { gold: 300, label: '收集3只：金币×300' } },
  { count: 7, reward: { gold: 800, tickets: 2, label: '收集7只：金币×800+招募券×2' } },
  { count: 12, reward: { gems: 10, tickets: 3, label: '收集12只：灵石×10+招募券×3' } },
  { count: 17, reward: { gems: 30, tickets: 5, label: '收集17只：灵石×30+招募券×5' } },
  { count: 19, reward: { gems: 50, tickets: 8, label: '集齐全妖（19只）：灵石×50+招募券×8' } },
]

// ============ 成就系统 ============

export type AchievementCategory = 'capture' | 'battle' | 'boss' | 'business' | 'growth'

export interface AchievementDef {
  id: string
  category: AchievementCategory
  name: string
  desc: string
  target: number
  reward: { gold?: number; gems?: number; tickets?: number }
}

/** 四线成就（捕捉/战斗/妖王/经营），进度由 achievementProgress 计算 */
export const ACHIEVEMENTS: AchievementDef[] = [
  // ---- 捕捉线 ----
  { id: 'capture-1', category: 'capture', name: '初次捉妖', desc: '夜间控血收服第 1 只妖怪', target: 1, reward: { gold: 200, gems: 2 } },
  { id: 'capture-5', category: 'capture', name: '妖友遍天下', desc: '累计收服 5 只妖怪', target: 5, reward: { gold: 800, tickets: 2 } },
  { id: 'capture-rare', category: 'capture', name: '稀有大妖', desc: '收服任一稀有精怪（九尾狐/毕方/陆吾/乘黄/英招）', target: 1, reward: { gems: 8, tickets: 2 } },
  { id: 'capture-all-rare', category: 'capture', name: '稀有全收录', desc: '集齐全部 7 只稀有精怪（含水墨系墨麟/砚灵）', target: 7, reward: { gems: 40, tickets: 6 } },
  // ---- 战斗线 ----
  { id: 'battle-first-win', category: 'battle', name: '守店初胜', desc: '首次守店成功', target: 1, reward: { gold: 300, gems: 2 } },
  { id: 'battle-10-win', category: 'battle', name: '百战老兵', desc: '累计守店成功 10 次', target: 10, reward: { gold: 2000, tickets: 3 } },
  { id: 'battle-level-3', category: 'battle', name: '越战越勇', desc: '守店进度推进到第 3 关', target: 3, reward: { gems: 10, tickets: 2 } },
  // ---- 经营线 ----
  { id: 'biz-gold-10k', category: 'business', name: '小有积蓄', desc: '累计获得 1 万金币', target: 10000, reward: { gems: 5 } },
  { id: 'biz-gold-100k', category: 'business', name: '日进斗金', desc: '累计获得 10 万金币', target: 100000, reward: { gems: 25, tickets: 5 } },
  { id: 'biz-inn-5', category: 'business', name: '客栈名家', desc: '客栈等级达到 5 级', target: 5, reward: { gold: 1000, tickets: 2 } },
  { id: 'biz-tujian-6', category: 'business', name: '山海拾遗', desc: '图鉴收集 8 只妖怪', target: 8, reward: { gold: 600, gems: 3 } },
  // ---- 妖王线 ----
  { id: 'boss-first-win', category: 'boss', name: '首退妖王', desc: '妖王夜首次守店成功', target: 1, reward: { gold: 1000, gems: 5 } },
  { id: 'boss-3-win', category: 'boss', name: '妖王克星', desc: '累计妖王夜守店成功 3 次', target: 3, reward: { gems: 20, tickets: 3 } },
  { id: 'boss-all-legend', category: 'boss', name: '双妖王全收', desc: '收服白泽与饕餮两位传说妖王', target: 2, reward: { gems: 50, tickets: 8 } },
  // ---- 养成线 ----
  { id: 'growth-level-10', category: 'growth', name: '初露锋芒', desc: '任意妖怪升级到 10 级', target: 1, reward: { gold: 500, gems: 3 } },
  { id: 'growth-level-50', category: 'growth', name: '妖力大成', desc: '任意妖怪升到 50 级（需 5 星）', target: 1, reward: { gems: 40, tickets: 6 } },
  { id: 'growth-facility-3', category: 'growth', name: '焕然一新', desc: '任意设施升级到 Lv.3 解锁特殊能力', target: 1, reward: { gold: 400, gems: 2 } },
  { id: 'growth-facility-all3', category: 'growth', name: '焕新客栈', desc: '九大设施全部达到 Lv.3', target: 9, reward: { gems: 40, tickets: 6 } },
  // ---- 属性线（五行+光暗） ----
  { id: 'elem-lightdark', category: 'growth', name: '光暗双辉', desc: '同时持有光、暗属性妖怪各一只', target: 2, reward: { gems: 15, tickets: 2 } },
  { id: 'elem-stone-max', category: 'growth', name: '属性大师', desc: '任一属性石强化至 5 级（克制伤害 +25%）', target: 1, reward: { gems: 25, tickets: 3 } },
  // ---- 素材线 ----
  { id: 'mat-cook', category: 'business', name: '火头功夫', desc: '灶火做饭 1 次（仓库→做饭）', target: 1, reward: { gold: 300, gems: 2 } },
  { id: 'mat-synth', category: 'business', name: '化零为整', desc: '首次合成高级建设素材', target: 1, reward: { gold: 400, gems: 2 } },
  // ---- 体力轮换线 ----
  { id: 'stamina-potion', category: 'growth', name: '气力充沛', desc: '首次使用体力药水恢复妖怪体力', target: 1, reward: { gold: 300, gems: 2 } },
  { id: 'stamina-ad', category: 'growth', name: '神清气爽', desc: '观看广告使全体妖怪体力恢复 50%', target: 1, reward: { gold: 300, gems: 2 } },
  { id: 'stamina-squad', category: 'growth', name: '妖才济济', desc: '同时持有 8 种妖怪，组建轮换梯队', target: 8, reward: { gems: 20, tickets: 3 } },
  // ---- 世界地图线（V1.2 新区域探索 + 连锁分店） ----
  { id: 'region2-open', category: 'business', name: '开疆拓土', desc: '花费金币在水墨幽谷开设连锁分店「水墨别院」', target: 1, reward: { gems: 15, tickets: 3 } },
  { id: 'region2-win', category: 'battle', name: '墨谷初捷', desc: '水墨幽谷分店守店成功 1 次', target: 1, reward: { gold: 1500, gems: 5 } },
  { id: 'region2-level-5', category: 'battle', name: '水墨长歌', desc: '水墨幽谷守店进度推进到第 5 夜', target: 5, reward: { gems: 30, tickets: 5 } },
  // ---- 世界地图线·三（V1.3 沸火赤川） ----
  { id: 'region3-open', category: 'business', name: '烈焰开疆', desc: '花费金币在沸火赤川开设连锁分店「沸泉别馆」', target: 1, reward: { gems: 25, tickets: 4 } },
  { id: 'region3-win', category: 'battle', name: '赤川初捷', desc: '沸火赤川分店守店成功 1 次', target: 1, reward: { gold: 3000, gems: 8 } },
  { id: 'region3-level-5', category: 'battle', name: '沸火长明', desc: '沸火赤川守店进度推进到第 5 夜', target: 5, reward: { gems: 45, tickets: 7 } },
  // ---- 采集线（V1.3 山野采集队） ----
  { id: 'gather-first', category: 'business', name: '初采山野', desc: '首次从采集队收取素材', target: 1, reward: { gold: 400, gems: 2 } },
  { id: 'gather-100', category: 'business', name: '采野有方', desc: '采集队累计收取 100 个素材', target: 100, reward: { gems: 12, tickets: 3 } },
  { id: 'gather-team', category: 'business', name: '满编采集队', desc: '5 个采集位同时驻有妖怪', target: 5, reward: { gems: 10, tickets: 2 } },
  // ---- 技能升级线（V1.3 妖丹消耗） ----
  { id: 'skill-first', category: 'growth', name: '初窥门径', desc: '首次升级妖怪技能（消耗妖丹）', target: 1, reward: { gold: 300, gems: 2 } },
  { id: 'skill-max', category: 'growth', name: '技进乎道', desc: '任意妖怪技能升至 5 级（需 4 星以上）', target: 1, reward: { gems: 35, tickets: 5 } },
  // ---- 温泉线（V1.3 温泉汤院） ----
  { id: 'spring-build', category: 'business', name: '汤泉初沸', desc: '建成温泉汤院（需客栈 5 级 + 灵玉/灵木）', target: 1, reward: { gems: 10, tickets: 2 } },
  { id: 'spring-level-3', category: 'growth', name: '硫磺疗愈', desc: '温泉汤院升至 Lv.3 解锁体力恢复强化', target: 1, reward: { gems: 15, tickets: 3 } },
  // ---- 水墨新妖线（V1.3 墨麟/砚灵） ----
  { id: 'capture-ink', category: 'capture', name: '墨色入册', desc: '收服水墨系新妖：墨麟与砚灵（区域二夜战刷新）', target: 2, reward: { gems: 25, tickets: 4 } },
]

export const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  capture: '捉妖',
  battle: '守店',
  boss: '妖王',
  business: '经营',
  growth: '养成',
}

// ============ 广告位配置（IAA 模拟） ============

export type AdScene =
  | 'idle-speed' // 挂机加速
  | 'inn-repair' // 客栈修复
  | 'reward-double' // 奖励翻倍
  | 'keep-progress' // 进度保留
  | 'capture-buff' // 捉妖增益
  | 'advanced-recruit' // 高级招募
  | 'tujian-hint' // 图鉴线索
  | 'recruit-refresh' // 招募池刷新
  | 'stamina-recover' // 体力恢复（全体 +50%）
  | 'buff-reroll' // 备战增益换一批

export const AD_SCENES: Record<AdScene, { title: string; desc: string; duration: number }> = {
  'idle-speed': { title: '挂机加速', desc: '立即获得 2 小时挂机收益', duration: 5 },
  'inn-repair': { title: '客栈修复', desc: '客栈血量立即回满', duration: 5 },
  'reward-double': { title: '奖励翻倍', desc: '本次通关奖励翻倍领取', duration: 5 },
  'keep-progress': { title: '进度保留', desc: '保留当前波次进度继续战斗', duration: 5 },
  'capture-buff': { title: '捉妖增益', desc: '本次捕捉成功率 +20%', duration: 5 },
  'advanced-recruit': { title: '高级招募', desc: '免费高级招募一次（稀有概率提升）', duration: 5 },
  'tujian-hint': { title: '图鉴线索', desc: '解锁一只未收集妖怪的线索', duration: 5 },
  'recruit-refresh': { title: '招募池刷新', desc: '刷新招募池提升稀有概率', duration: 5 },
  'stamina-recover': { title: '体力恢复', desc: '全体妖怪体力立即恢复 50%', duration: 5 },
  'buff-reroll': { title: '增益换一批', desc: '重新抽取今晚的备战增益', duration: 5 },
}

// ============ 夜战备战增益（肉鸽三选一） ============

export interface NightBuffEffect {
  /** 守卫攻击力 ×N */
  atkMul?: number
  /** 守卫攻速 ×N */
  atkSpeedMul?: number
  /** 技能冷却速度 ×N（>1 更快） */
  cdSpeedMul?: number
  /** 击杀金币 ×N */
  goldMul?: number
  /** 客栈耐久上限 ×N（含当前耐久等比提升） */
  innHpMul?: number
  /** 守卫每 3 秒回复 N 比例生命 */
  regenPct?: number
  /** 击杀素材额外掉落概率 */
  dropBonus?: number
}

export interface NightBuff {
  id: string
  name: string
  desc: string
  /** 1=普通 2=稀有 3=史诗（影响抽取权重与边框配色） */
  rarity: 1 | 2 | 3
  icon: string
  effect: NightBuffEffect
}

export const NIGHT_BUFFS: NightBuff[] = [
  { id: 'stove', name: '灶火正旺', desc: '守卫攻击力 +15%', rarity: 1, icon: '/images/ui/facility-kitchen.png', effect: { atkMul: 1.15 } },
  { id: 'blade', name: '利刃出鞘', desc: '守卫攻速 +20%', rarity: 1, icon: '/images/ui/facility-smithy.png', effect: { atkSpeedMul: 1.2 } },
  { id: 'abacus', name: '账房算盘', desc: '击杀金币 +30%', rarity: 1, icon: '/images/ui/gold.png', effect: { goldMul: 1.3 } },
  { id: 'spring', name: '汤泉药气', desc: '守卫每 3 秒回复 2% 生命', rarity: 1, icon: '/images/ui/facility-hotSpring.png', effect: { regenPct: 0.02 } },
  { id: 'overload', name: '妖力过载', desc: '技能冷却加快 25%', rarity: 2, icon: '/images/ui/facility-powerPool.png', effect: { cdSpeedMul: 1.333 } },
  { id: 'fullhouse', name: '高朋满座', desc: '客栈耐久上限 +25%', rarity: 2, icon: '/images/ui/facility-guestRoom.png', effect: { innHpMul: 1.25 } },
  { id: 'huntbag', name: '猎妖行囊', desc: '击杀素材额外掉落概率 +10%', rarity: 2, icon: '/images/ui/nav-bag.png', effect: { dropBonus: 0.1 } },
  { id: 'resonance', name: '山海共鸣', desc: '攻击 +30% 且攻速 +30%', rarity: 3, icon: '/images/ui/ui-sun.png', effect: { atkMul: 1.3, atkSpeedMul: 1.3 } },
  { id: 'treasure', name: '招财进宝', desc: '击杀金币翻倍', rarity: 3, icon: '/images/ui/gem.png', effect: { goldMul: 2 } },
  { id: 'diamond', name: '金刚不坏', desc: '客栈耐久上限 +60%', rarity: 3, icon: '/images/ui/stat-hp.png', effect: { innHpMul: 1.6 } },
]

/** 按稀有度加权抽取 n 个不重复增益（1→5 / 2→3 / 3→2） */
export function pickNightBuffs(n = 3): NightBuff[] {
  const weight = (r: 1 | 2 | 3) => (r === 1 ? 5 : r === 2 ? 3 : 2)
  const pool = [...NIGHT_BUFFS]
  const out: NightBuff[] = []
  while (out.length < n && pool.length > 0) {
    let total = 0
    for (const b of pool) total += weight(b.rarity)
    let roll = Math.random() * total
    let idx = 0
    for (let i = 0; i < pool.length; i++) {
      roll -= weight(pool[i].rarity)
      if (roll <= 0) { idx = i; break }
    }
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

// ============ 七日目标（每日事件计数驱动的周链） ============

export interface WeekGoal {
  name: string
  desc: string
  /** 对应 save.daily.events 的计数键 */
  key: 'night' | 'upgrade' | 'capture' | 'recruit' | 'ad' | 'gather' | 'cook'
  target: number
  reward: { gold?: number; gems?: number; tickets?: number }
}

export const WEEK_GOALS: WeekGoal[] = [
  { name: '第1日 · 开门红', desc: '完成 1 场夜战守店', key: 'night', target: 1, reward: { gold: 300 } },
  { name: '第2日 · 百废俱兴', desc: '升级或建造设施 2 次', key: 'upgrade', target: 2, reward: { gold: 500 } },
  { name: '第3日 · 缉妖有功', desc: '收服 1 只妖怪', key: 'capture', target: 1, reward: { gems: 20 } },
  { name: '第4日 · 广结善缘', desc: '观看 2 次广告', key: 'ad', target: 2, reward: { gold: 800 } },
  { name: '第5日 · 进山采撷', desc: '外出采集 2 次', key: 'gather', target: 2, reward: { gems: 30 } },
  { name: '第6日 · 小宴宾朋', desc: '烹饪 2 道菜肴', key: 'cook', target: 2, reward: { gold: 1200 } },
  { name: '第7日 · 七日大集', desc: '完成 3 场夜战守店', key: 'night', target: 3, reward: { gems: 60, tickets: 2 } },
]

// ============ 七日签到 ============

export interface SignInReward {
  day: number
  gold?: number
  gems?: number
  tickets?: number
  label: string
}

export const SEVEN_DAY_REWARDS: SignInReward[] = [
  { day: 1, gold: 500, label: '金币×500' },
  { day: 2, gems: 3, label: '灵石×3' },
  { day: 3, tickets: 1, label: '招募券×1' },
  { day: 4, gold: 1500, label: '金币×1500' },
  { day: 5, gems: 6, label: '灵石×6' },
  { day: 6, tickets: 2, label: '招募券×2' },
  { day: 7, gold: 2500, gems: 8, tickets: 1, label: '传说大礼包' },
]

// ============ 客栈皮肤 ============

export interface SkinDef {
  id: string
  name: string
  desc: string
  icon: string
  /** CSS filter（应用到白天场景图） */
  filter: string
  /** 解锁条件 */
  unlock: { type: 'default' | 'wins' | 'bossWins' | 'tujian'; value: number }
  unlockDesc: string
  /** 按场景组件 key 覆盖贴片档位图（0=简陋档 1=精致档，缺省回落默认图） */
  sceneOverrides?: Record<string, { 0?: SceneCompTier; 1?: SceneCompTier }>
}

export const SKINS: SkinDef[] = [
  { id: 'default', name: '青瓦木檐', desc: '经典客栈原貌', icon: '/images/ui/skin-default.png', filter: 'none', unlock: { type: 'default', value: 0 }, unlockDesc: '默认解锁' },
  {
    // 初始简陋档贴片做成皮肤：两档均指向 -1 图，无论设施等级都显示初建原貌
    id: 'rustic', name: '初创原貌', desc: '客栈初建时的简朴模样', icon: '/images/scene/compo/hall-1.png', filter: 'none',
    unlock: { type: 'default', value: 0 }, unlockDesc: '默认解锁',
    sceneOverrides: {
      hall: { 0: { src: '/images/scene/compo/hall-1.png', wPct: 24 }, 1: { src: '/images/scene/compo/hall-1.png', wPct: 24 } },
      guestRoom: { 0: { src: '/images/scene/compo/guest-room-1.png', wPct: 20 }, 1: { src: '/images/scene/compo/guest-room-1.png', wPct: 20 } },
      kitchen: { 0: { src: '/images/scene/compo/kitchen-1.png', wPct: 20 }, 1: { src: '/images/scene/compo/kitchen-1.png', wPct: 20 } },
      warehouse: { 0: { src: '/images/scene/compo/warehouse-1.png', wPct: 18 }, 1: { src: '/images/scene/compo/warehouse-1.png', wPct: 18 } },
      powerPool: { 0: { src: '/images/scene/compo/powerpool-1.png', wPct: 18 }, 1: { src: '/images/scene/compo/powerpool-1.png', wPct: 18 } },
      smithy: { 0: { src: '/images/scene/compo/smithy-1.png', wPct: 19 }, 1: { src: '/images/scene/compo/smithy-1.png', wPct: 19 } },
      pharmacy: { 0: { src: '/images/scene/compo/pharmacy-1.png', wPct: 17 }, 1: { src: '/images/scene/compo/pharmacy-1.png', wPct: 17 } },
      wishAltar: { 0: { src: '/images/scene/compo/wishaltar-1.png', wPct: 15 }, 1: { src: '/images/scene/compo/wishaltar-1.png', wPct: 15 } },
      hotSpring: { 0: { src: '/images/scene/compo/hotspring-1.png', wPct: 22 }, 1: { src: '/images/scene/compo/hotspring-1.png', wPct: 22 } },
    },
  },
  { id: 'lantern', name: '朱漆灯笼', desc: '红灯高挂 · 喜气盈门', icon: '/images/ui/skin-lantern.png', filter: 'saturate(1.35) sepia(0.16) hue-rotate(-12deg) brightness(1.03)', unlock: { type: 'wins', value: 5 }, unlockDesc: '守店成功 5 次解锁' },
  { id: 'frost', name: '霜雪琉璃', desc: '雪落屋檐 · 银装素裹', icon: '/images/ui/skin-frost.png', filter: 'saturate(0.72) hue-rotate(168deg) brightness(1.14) contrast(0.96)', unlock: { type: 'wins', value: 10 }, unlockDesc: '守店成功 10 次解锁' },
  { id: 'gilt', name: '鎏金岁月', desc: '金漆流彩 · 百年老店', icon: '/images/ui/skin-gilt.png', filter: 'sepia(0.5) saturate(1.55) hue-rotate(-8deg) brightness(1.08)', unlock: { type: 'tujian', value: 10 }, unlockDesc: '图鉴收集 10 只解锁' },
  { id: 'bloodmoon', name: '血月妖楼', desc: '赤月高悬 · 妖气缭绕', icon: '/images/ui/skin-bloodmoon.png', filter: 'saturate(1.32) hue-rotate(-30deg) brightness(0.9) contrast(1.15)', unlock: { type: 'bossWins', value: 2 }, unlockDesc: '妖王夜守店成功 2 次解锁' },
  {
    id: 'hui', name: '徽派水墨', desc: '白墙黛瓦 · 马头墙影', icon: '/images/scene/compo/hall-2-hui.png', filter: 'none',
    unlock: { type: 'wins', value: 15 }, unlockDesc: '守店成功 15 次解锁',
    sceneOverrides: {
      hall: { 1: { src: '/images/scene/compo/hall-2-hui.png', wPct: 27 } },
      guestRoom: { 1: { src: '/images/scene/compo/guest-room-2-hui.png', wPct: 22 } },
      kitchen: { 1: { src: '/images/scene/compo/kitchen-2-hui.png', wPct: 21 } },
      warehouse: { 1: { src: '/images/scene/compo/warehouse-2-hui.png', wPct: 20 } },
      powerPool: { 1: { src: '/images/scene/compo/powerpool-2-hui.png', wPct: 23 } },
      smithy: { 1: { src: '/images/scene/compo/smithy-2-hui.png', wPct: 21 } },
      pharmacy: { 1: { src: '/images/scene/compo/pharmacy-2-hui.png', wPct: 18 } },
      wishAltar: { 1: { src: '/images/scene/compo/wishaltar-2-hui.png', wPct: 16 } },
      hotSpring: { 1: { src: '/images/scene/compo/hotspring-2-hui.png', wPct: 24 } },
    },
  },
]

/** 判断皮肤是否已解锁 */
export function skinUnlocked(save: GameSave, skinId: string): boolean {
  const skin = SKINS.find((s) => s.id === skinId)
  if (!skin) return false
  if (skin.unlock.type === 'default') return true
  if (skin.unlock.type === 'wins') return save.stats.wins >= skin.unlock.value
  if (skin.unlock.type === 'bossWins') return save.stats.bossWins >= skin.unlock.value
  return save.tujian.length >= skin.unlock.value
}

// ============ 节日彩蛋系统（V1.2） ============

export interface FestivalDef {
  id: string
  name: string
  icon: string
  /** 节日问候语（横幅展示） */
  greeting: string
  /** 公历月份（1-12）与日期范围（同月内，含首尾） */
  month: number
  start: number
  end: number
  /** 节日礼包（每个节日周期限领一次，跨年可重复领） */
  gift: { gold?: number; gems?: number; tickets?: number }
  giftDesc: string
  /** 节日挂机收益加成（小数：0.15 = +15%，金币与灵石同步生效） */
  buff: number
  /** 主题色（横幅渐变主色，暖色/深绿系，禁冷蓝） */
  color: string
}

/** 全年节日表（按时间排序；日期为固定公历窗口，营造固定仪式感） */
export const FESTIVALS: FestivalDef[] = [
  { id: 'laba', name: '腊八粥香', icon: '/images/ui/festival-laba.png', greeting: '过了腊八就是年，客栈熬了一大锅甜粥～', month: 1, start: 5, end: 10, gift: { gold: 400, gems: 2 }, giftDesc: '金币×400 灵石×2', buff: 0.1, color: '#8B5E3C' },
  { id: 'newyear', name: '新春佳节', icon: '/images/ui/festival-newyear.png', greeting: '爆竹声中一岁除，山间小妖组团来拜年啦！', month: 2, start: 14, end: 21, gift: { gold: 800, gems: 5 }, giftDesc: '金币×800 灵石×5', buff: 0.2, color: '#C0392B' },
  { id: 'lantern', name: '上元灯节', icon: '/images/ui/festival-lantern.png', greeting: '东风夜放花千树，今夜灯笼照亮客栈！', month: 2, start: 22, end: 26, gift: { gold: 600, tickets: 2 }, giftDesc: '金币×600 招募券×2', buff: 0.15, color: '#D35400' },
  { id: 'huazhao', name: '花朝节', icon: '/images/ui/festival-huazhao.png', greeting: '百花生日是良辰，院里的桃花都开啦～', month: 3, start: 10, end: 14, gift: { gems: 3, tickets: 1 }, giftDesc: '灵石×3 招募券×1', buff: 0.15, color: '#C2185B' },
  { id: 'dragon', name: '端午安康', icon: '/images/ui/festival-dragon.png', greeting: '粽叶飘香艾草长，小妖们也排队讨粽子～', month: 6, start: 1, end: 6, gift: { gold: 600, gems: 3 }, giftDesc: '金币×600 灵石×3', buff: 0.15, color: '#8B2E24' },
  { id: 'qixi', name: '七夕鹊桥', icon: '/images/ui/festival-qixi.png', greeting: '金风玉露一相逢，客栈檐下喜鹊闹哄哄～', month: 8, start: 14, end: 19, gift: { gems: 5, tickets: 2 }, giftDesc: '灵石×5 招募券×2', buff: 0.15, color: '#A0522D' },
  { id: 'midautumn', name: '中秋团圆', icon: '/images/ui/festival-midautumn.png', greeting: '但愿人长久，千里共婵娟～掌柜的分月饼啦！', month: 9, start: 14, end: 20, gift: { gold: 1000, gems: 4 }, giftDesc: '金币×1000 灵石×4', buff: 0.2, color: '#B9770E' },
  { id: 'dongzhi', name: '冬至大如年', icon: '/images/ui/festival-dongzhi.png', greeting: '天时人事日相催，冬至阳生春又来～', month: 12, start: 20, end: 24, gift: { gold: 600, gems: 3 }, giftDesc: '金币×600 灵石×3', buff: 0.15, color: '#16777B' },
]

/** 当前生效的节日（无则 null）；本地时区自然日 */
export function activeFestival(now: Date = new Date()): FestivalDef | null {
  const m = now.getMonth() + 1
  const d = now.getDate()
  return FESTIVALS.find((f) => f.month === m && d >= f.start && d <= f.end) ?? null
}

/** 节日礼包领取标识（跨年可重复领：newyear-2026） */
export function festivalGiftId(fest: FestivalDef, now: Date = new Date()): string {
  return `${fest.id}-${now.getFullYear()}`
}

// ============ 妖怪属性系统（五行 + 光暗） ============

/** 属性展示定义 */
export interface ElementDef {
  name: string
  icon: string
  color: string
  bg: string
  desc: string
}

export const ELEMENT_ORDER: Element[] = ['metal', 'wood', 'water', 'fire', 'earth', 'light', 'dark']

export const ELEMENTS: Record<Element, ElementDef> = {
  metal: { name: '金', icon: '/images/ui/el-metal.png', color: '#8C6A1D', bg: '#F6EAD0', desc: '金石之锐，克木' },
  wood: { name: '木', icon: '/images/ui/el-wood.png', color: '#2D7A46', bg: '#E8DFD0', desc: '草木之生，克土' },
  water: { name: '水', icon: '/images/ui/el-water.png', color: '#16777B', bg: '#DCEFF0', desc: '流水之柔，克火' },
  fire: { name: '火', icon: '/images/ui/el-fire.png', color: '#C0392B', bg: '#F9E3DD', desc: '烈焰之炎，克金' },
  earth: { name: '土', icon: '/images/ui/el-earth.png', color: '#8B5E3C', bg: '#F1E6D8', desc: '厚土之重，克水' },
  light: { name: '光', icon: '/images/ui/el-light.png', color: '#B8860B', bg: '#FBF3D9', desc: '光明祥瑞，克暗' },
  dark: { name: '暗', icon: '/images/ui/el-dark.png', color: '#6B4E8E', bg: '#EAE2F3', desc: '幽暗玄冥，克光' },
}

/** 五行相克：金→木→土→水→火→金；光暗互克 */
const COUNTER_MAP: Record<Element, Element> = {
  metal: 'wood',
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  light: 'dark',
  dark: 'light',
}

/** e 克制的属性 */
export function countersOf(e: Element): Element {
  return COUNTER_MAP[e]
}

/** 克制 e 的属性 */
export function counteredBy(e: Element): Element {
  for (const k of ELEMENT_ORDER) if (COUNTER_MAP[k] === e) return k
  return e
}

/** 克制伤害倍率（克 +30% / 被克 -20%） */
export const COUNTER_MULT = 1.3
export const COUNTERED_MULT = 0.8

/** 攻防属性倍率：克制 1.3 / 被克 0.8 / 其他 1.0 */
export function elementMult(att: Element | null, def: Element | null): number {
  if (!att || !def) return 1
  if (COUNTER_MAP[att] === def) return COUNTER_MULT
  if (COUNTER_MAP[def] === att) return COUNTERED_MULT
  return 1
}

export type ElementRelation = 'counter' | 'countered' | 'neutral' | 'none'

export function elementRelation(att: Element | null, def: Element | null): ElementRelation {
  if (!att || !def) return 'none'
  if (COUNTER_MAP[att] === def) return 'counter'
  if (COUNTER_MAP[def] === att) return 'countered'
  return 'neutral'
}

// ---- 五行相生（队伍加成） ----

/** 相生：金生水、水生木、木生火、火生土、土生金（光暗不相生） */
const GENERATE_MAP: Partial<Record<Element, Element>> = {
  metal: 'water',
  water: 'wood',
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
}

/** 相生队伍加成类型（PRD：金+水全队生命+10%；木+火全队攻击+10%） */
const GENERATE_BUFF: Record<string, { kind: 'atk' | 'hp'; value: number }> = {
  'metal+water': { kind: 'hp', value: 0.1 },
  'water+wood': { kind: 'atk', value: 0.1 },
  'wood+fire': { kind: 'atk', value: 0.1 },
  'fire+earth': { kind: 'hp', value: 0.1 },
  'earth+metal': { kind: 'atk', value: 0.1 },
}

export interface SynergyPair {
  pair: [Element, Element]
  kind: 'atk' | 'hp'
  /** 加成小数（0.1 = +10%） */
  value: number
}

export interface LineupSynergy {
  atkPct: number
  hpPct: number
  pairs: SynergyPair[]
}

/** 阵容相生检测：同时存在相生属性的两只妖怪触发全队加成 */
export function lineupSynergy(defs: Array<{ element: Element | null }>): LineupSynergy {
  const have = new Set<Element>()
  for (const d of defs) if (d.element) have.add(d.element)
  const result: LineupSynergy = { atkPct: 0, hpPct: 0, pairs: [] }
  if (have.size < 2) return result
  for (const [gen, out] of Object.entries(GENERATE_MAP) as Array<[Element, Element]>) {
    if (have.has(gen) && have.has(out)) {
      const buff = GENERATE_BUFF[`${gen}+${out}`]
      if (!buff) continue
      result.pairs.push({ pair: [gen, out], kind: buff.kind, value: buff.value })
      if (buff.kind === 'atk') result.atkPct += buff.value
      else result.hpPct += buff.value
    }
  }
  return result
}

// ---- 属性石强化 ----

/** 属性石强化上限（每级克制伤害 +5%，最高 +25%） */
export const ELEMENT_STONE_MAX_LEVEL = 5
export const ELEMENT_STONE_BONUS = 0.05

/** 属性石素材 id（存于 materials） */
export function stoneIdFor(e: Element): string {
  return `stone-${e}`
}

/** 属性石强化消耗（lv 为当前等级 → 升到 lv+1） */
export function stoneUpCost(lv: number): { gems: number; stones: number } {
  return { gems: 5 + lv * 5, stones: 3 + lv * 2 }
}

/** 克制伤害总倍率（含属性石强化；仅克制时生效） */
export function counterDamageMult(att: Element | null, def: Element | null, boost: Record<Element, number>): number {
  if (elementRelation(att, def) !== 'counter') return elementMult(att, def)
  const lv = Math.min(boost[att ?? 'metal'] ?? 0, ELEMENT_STONE_MAX_LEVEL)
  return COUNTER_MULT + lv * ELEMENT_STONE_BONUS
}

// ============ 妖怪体力与轮换系统（PRD 第 9 节） ============

/** 体力五档：充沛 / 正常 / 疲惫 / 力竭 / 虚脱 */
export type StaminaTierKey = 'full' | 'normal' | 'tired' | 'exhausted' | 'collapse'

export interface StaminaTierDef {
  key: StaminaTierKey
  name: string
  icon: string
  /** 区间下限（含） */
  min: number
  /** 区间上限（含，仅展示用） */
  max: number
  /** 主题色 */
  color: string
  /** 徽章底色 */
  bg: string
  /** 打工效率（0-1） */
  jobEff: number
  /** 战斗攻击倍率 */
  atkMult: number
  /** 战斗攻速倍率 */
  asMult: number
  /** 是否可上阵夜战 */
  battleOk: boolean
  desc: string
}

export const STAMINA_TIERS: StaminaTierDef[] = [
  { key: 'full', name: '充沛', icon: '/images/ui/stamina-full.png', min: 70, max: 100, color: '#2D7A46', bg: '#E8DFD0', jobEff: 1, atkMult: 1, asMult: 1, battleOk: true, desc: '精神抖擞，全力发挥' },
  { key: 'normal', name: '正常', icon: '/images/ui/stamina-normal.png', min: 40, max: 70, color: '#16777B', bg: '#DCEFF0', jobEff: 1, atkMult: 1, asMult: 1, battleOk: true, desc: '状态平稳，正常发挥' },
  { key: 'tired', name: '疲惫', icon: '/images/ui/stamina-tired.png', min: 15, max: 40, color: '#B9770E', bg: '#F6EAD0', jobEff: 0.6, atkMult: 1, asMult: 0.9, battleOk: true, desc: '打工效率 60% · 战斗攻速 -10%' },
  { key: 'exhausted', name: '力竭', icon: '/images/ui/stamina-exhausted.png', min: 1, max: 15, color: '#C0392B', bg: '#F9E3DD', jobEff: 0.3, atkMult: 0.8, asMult: 0.75, battleOk: true, desc: '打工效率 30% · 攻击 -20% 攻速 -25%' },
  { key: 'collapse', name: '虚脱', icon: '/images/ui/stamina-collapse.png', min: 0, max: 0, color: '#6B4E8E', bg: '#EAE2F3', jobEff: 0, atkMult: 0, asMult: 0, battleOk: false, desc: '体力耗尽，无法打工与上阵' },
]

/** 体力值 → 档位定义 */
export function staminaTier(v: number): StaminaTierDef {
  const s = Math.max(0, Math.min(100, Number.isFinite(v) ? v : 100))
  if (s <= 0) return STAMINA_TIERS[4]
  if (s < 15) return STAMINA_TIERS[3]
  if (s < 40) return STAMINA_TIERS[2]
  if (s < 70) return STAMINA_TIERS[1]
  return STAMINA_TIERS[0]
}

/** 白天打工体力消耗（点/小时，按夜战定位差异化：坦克耐操 / 刺客高强度） */
export const JOB_STAMINA_COST: Record<NightRole, number> = {
  tank: 4,
  mage: 6,
  assassin: 8,
  ranged: 5,
  controller: 5,
  healer: 4,
  support: 4,
  allround: 6,
}

/** 夜战体力消耗：普通波 / BOSS 波（点/只） */
export const WAVE_STAMINA_COST = 5
export const BOSS_WAVE_STAMINA_COST = 15

/** 自然恢复基础速率（点/小时，仅对非打工妖怪生效） */
export const STAMINA_REGEN = 10
/** 客房休息加成基础 +50% */
export const REST_BONUS_BASE = 0.5
/** 客房每级额外 +4%（上限取 5 级） */
export const REST_BONUS_PER_GUESTROOM = 0.04
/** 美食联动：灶火增益期间全体恢复再 +20% */
export const COOK_STAMINA_BONUS = 0.2

/** 休息妖怪的恢复速率（点/小时）：基础 10 × 客房加成 × 美食加成 × 分店加成 × 温泉加成 */
export function staminaRegenRate(
  guestRoomLv: number,
  cookingActive: boolean,
  branchOpen = false,
  hotSpringLv = 0
): number {
  const restBonus = 1 + REST_BONUS_BASE + Math.min(Math.max(guestRoomLv, 0), 5) * REST_BONUS_PER_GUESTROOM
  // 温泉汤院：每级 +8%；Lv.3 硫磺疗愈额外 ×1.5
  const springMult = (1 + Math.max(hotSpringLv, 0) * 0.08) * (hotSpringLv >= FACILITY_ABILITY_LEVEL ? 1.5 : 1)
  return (
    STAMINA_REGEN *
    restBonus *
    (cookingActive ? 1 + COOK_STAMINA_BONUS : 1) *
    (branchOpen ? 1 + BRANCH_STAMINA_BONUS : 1) *
    springMult
  )
}

/** 温泉汤院·汤泉回春：战斗中全体守卫每秒回复生命比例（0.0015×等级；Lv.5 沸泉活络另有每波并血） */
export function springRegenPerSec(hotSpringLv: number): number {
  return Math.max(hotSpringLv, 0) * 0.0015
}

/** 新收录妖怪初始体力（50%） */
export const NEW_YAOGUAI_STAMINA = 50
/** 自动轮换阈值：打工妖体力低于此值自动撤下休息 */
export const AUTO_ROTATE_THRESHOLD = 20
/** 看广告全体体力恢复比例 */
export const AD_STAMINA_RECOVER = 0.5

/** 体力药水（PRD 经济素材表新增 3 档） */
export interface StaminaPotionDef {
  id: 'small' | 'medium' | 'large'
  name: string
  icon: string
  /** 恢复值 */
  value: number
  /** 单只 / 全体 */
  target: 'single' | 'all'
  currency: 'gold' | 'gems'
  price: number
  desc: string
}

export const STAMINA_POTIONS: StaminaPotionDef[] = [
  { id: 'small', name: '小瓶气力散', icon: '/images/ui/potion-stamina-small.png', value: 30, target: 'single', currency: 'gold', price: 520, desc: '单只妖怪体力 +30' },
  { id: 'medium', name: '中瓶气力散', icon: '/images/ui/potion-stamina-medium.png', value: 60, target: 'single', currency: 'gold', price: 1400, desc: '单只妖怪体力 +60' },
  { id: 'large', name: '大瓶回元丹', icon: '/images/ui/potion-stamina-large.png', value: 100, target: 'all', currency: 'gems', price: 35, desc: '全体妖怪体力回满' },
]

// ============ 技能升级系统（V1.3：妖丹消耗，技能效果 +15%/级） ============

/** 技能等级上限 */
export const SKILL_MAX_LEVEL = 5
/** 每级技能效果加成（伤害/治疗/控制时长统一 +15%） */
export const SKILL_LEVEL_BONUS = 0.15

/** 技能等级上限受星级约束：上限 = min(5, 星级 + 1) */
export function skillLevelCapForStar(star: number): number {
  return Math.min(SKILL_MAX_LEVEL, Math.max(1, star + 1))
}

/** 技能升级消耗（妖丹为主，高阶消耗稀有妖丹；顶级加灵石） */
export interface SkillUpCost {
  gold: number
  gems: number
  /** 妖丹（小妖内丹） */
  pillNormal: number
  /** 稀有妖丹（精怪内丹） */
  pillRare: number
}

/** 升到 nextLevel（2-5）所需的消耗；满级返回 null */
export function skillUpCost(nextLevel: number): SkillUpCost | null {
  switch (nextLevel) {
    case 2:
      return { gold: 800, gems: 0, pillNormal: 3, pillRare: 0 }
    case 3:
      return { gold: 2000, gems: 0, pillNormal: 6, pillRare: 0 }
    case 4:
      return { gold: 4000, gems: 8, pillNormal: 0, pillRare: 2 }
    case 5:
      return { gold: 8000, gems: 15, pillNormal: 0, pillRare: 4 }
    default:
      return null
  }
}

/** 技能等级总效果加成（Lv1 = ×1.0，Lv5 = ×1.6） */
export function skillLevelMult(skillLevel: number): number {
  const lv = Math.min(Math.max(skillLevel, 1), SKILL_MAX_LEVEL)
  return 1 + (lv - 1) * SKILL_LEVEL_BONUS
}

// ============ 山野采集队（V1.3：妖怪出野采集素材，亲和加成） ============

/** 采集任务定义 */
export interface GatherTaskDef {
  id: string
  name: string
  icon: string
  /** 产出的素材 id */
  material: string
  desc: string
  /** 基础采集速率（个/小时） */
  baseRate: number
  /** 解锁所需客栈等级 */
  unlockInnLevel: number
}

export const GATHER_TASKS: GatherTaskDef[] = [
  { id: 'hunt', name: '后山狩猎', icon: '/images/ui/gather-hunt.png', material: 'meat', desc: '后山林深兽肥，猎取妖兽肉', baseRate: 9, unlockInnLevel: 1 },
  { id: 'farm', name: '灵田耕作', icon: '/images/ui/gather-farm.png', material: 'rice', desc: '开垦山灵田，播种灵稻', baseRate: 9, unlockInnLevel: 1 },
  { id: 'lumber', name: '松林伐木', icon: '/images/ui/gather-lumber.png', material: 'wood', desc: '斧斤入林，伐取松木', baseRate: 6, unlockInnLevel: 1 },
  { id: 'saltwell', name: '盐井采卤', icon: '/images/ui/gather-saltwell.png', material: 'salt', desc: '汲取地底盐卤，晒制妖盐', baseRate: 7, unlockInnLevel: 2 },
  { id: 'quarry', name: '青石采场', icon: '/images/ui/gather-quarry.png', material: 'stone', desc: '凿山开石，采青石', baseRate: 6, unlockInnLevel: 2 },
  { id: 'brewery', name: '曲坊酿酒', icon: '/images/ui/gather-brewery.png', material: 'wine', desc: '采曲酿酒，窖藏灵米酒', baseRate: 5, unlockInnLevel: 3 },
  { id: 'mine', name: '铁脉矿洞', icon: '/images/ui/gather-mine.png', material: 'iron', desc: '深入地脉，掘取铁矿', baseRate: 5, unlockInnLevel: 4 },
]

export const GATHER_TASKS_MAP: Record<string, GatherTaskDef> = Object.fromEntries(
  GATHER_TASKS.map((t) => [t.id, t])
)

/**
 * 采集亲和表（妖怪 id → 任务 id → 速率加成）
 * 「某些妖怪可以提高采集效率」：开山谐石猬/十身采珠何罗鱼等本职采集大户，
 * 乘黄/英招/白泽等全任务小幅统筹加成
 */
export const GATHER_AFFINITY: Record<string, Partial<Record<string, number>>> = {
  lili: { quarry: 0.25 }, // 善掘土
  shengsheng: { brewery: 0.15 },
  lushu: { farm: 0.15 },
  xuangui: { lumber: 0.15 },
  qiuyu: { farm: 0.2 },
  lei: { saltwell: 0.15 },
  lu: { hunt: 0.25 },
  yu: { hunt: 0.2 },
  zheng: { quarry: 0.35, mine: 0.35, lumber: 0.2 }, // 开山谐石（dayBuff 石料采集+35% 联动）
  heluoyu: { saltwell: 0.4, brewery: 0.15 }, // 十身采珠
  jiuweihu: { brewery: 0.2 },
  bifang: { hunt: 0.3, farm: 0.3 }, // 后厨主厨识食材
  luwu: { mine: 0.25 },
  chenghuang: { hunt: 0.1, farm: 0.1, saltwell: 0.1, brewery: 0.1, lumber: 0.1, quarry: 0.1, mine: 0.1 }, // 神行效率
  yingzhao: { hunt: 0.15, farm: 0.15, saltwell: 0.15, brewery: 0.15, lumber: 0.15, quarry: 0.15, mine: 0.15 }, // 总管统筹
  baize: { hunt: 0.2, farm: 0.2, saltwell: 0.2, brewery: 0.2, lumber: 0.2, quarry: 0.2, mine: 0.2 }, // 万物之情
  taotie: { hunt: 0.5 }, // 贪食猎手
  molin: { lumber: 0.3 }, // 松烟制墨
  yanling: { quarry: 0.3 }, // 砚石本源
}

/** 采集体力消耗为打工的 70%（出野轻劳作） */
export const GATHER_STAMINA_COST_MULT = 0.7
/** 采集产出的星级加成（每星 +10%） */
export const GATHER_STAR_BONUS = 0.1
/** 采集产出的等级加成（每级 +2%） */
export const GATHER_LEVEL_BONUS = 0.02
/** 采集产出累积上限（个/任务，防挂机无限囤积） */
export const GATHER_ACC_CAP = 60

/** 某任务当前采集速率（个/小时）：基础 × 亲和 × 星级 × 等级 × 体力档位效率 */
export function gatherRateOf(save: GameSave, taskId: string): number {
  const task = GATHER_TASKS_MAP[taskId]
  if (!task) return 0
  const yid = save.gather.assignments[taskId]
  if (!yid) return 0
  const o = save.owned[yid]
  if (!o) return 0
  const aff = GATHER_AFFINITY[yid]?.[taskId] ?? 0
  const starMult = 1 + (Math.max(1, o.star) - 1) * GATHER_STAR_BONUS
  const lvMult = 1 + (Math.max(1, o.level ?? 1) - 1) * GATHER_LEVEL_BONUS
  const eff = staminaTier(o.stamina ?? 100).jobEff
  return task.baseRate * (1 + aff) * starMult * lvMult * eff
}


// ============ 经济素材系统（经营/建设/养成三类） ============

export type MaterialCat = 'food' | 'build' | 'growth' | 'prop'

export interface MaterialDef {
  id: string
  name: string
  icon: string
  cat: MaterialCat
  desc: string
  /** 出售价（金币） */
  sellPrice: number
}

export const MATERIALS: MaterialDef[] = [
  // ---- 经营素材（食材：灶火做饭消耗） ----
  { id: 'meat', name: '妖兽肉', icon: '/images/ui/mat-meat.png', cat: 'food', desc: '客栈招牌菜的主料', sellPrice: 15 },
  { id: 'rice', name: '灵米', icon: '/images/ui/mat-rice.png', cat: 'food', desc: '山灵稻米，粒粒生香', sellPrice: 12 },
  { id: 'salt', name: '妖盐', icon: '/images/ui/mat-salt.png', cat: 'food', desc: '提味增鲜的秘制调料', sellPrice: 14 },
  { id: 'wine', name: '灵米酒', icon: '/images/ui/mat-wine.png', cat: 'food', desc: '迎宾宴必备佳酿', sellPrice: 25 },
  // ---- 建设素材（设施升级消耗） ----
  { id: 'wood', name: '松木', icon: '/images/ui/mat-wood.png', cat: 'build', desc: '基础建材，升级设施', sellPrice: 20 },
  { id: 'stone', name: '青石', icon: '/images/ui/mat-stone.png', cat: 'build', desc: '基础建材，升级设施', sellPrice: 20 },
  { id: 'iron', name: '铁矿', icon: '/images/ui/mat-iron.png', cat: 'build', desc: '基础建材，升级设施', sellPrice: 22 },
  { id: 'spirit-wood', name: '灵木', icon: '/images/ui/mat-spirit-wood.png', cat: 'build', desc: '高级建材（5 松木合成）', sellPrice: 100 },
  { id: 'jade', name: '灵玉', icon: '/images/ui/mat-jade.png', cat: 'build', desc: '高级建材（5 青石合成）', sellPrice: 100 },
  { id: 'star-iron', name: '星金', icon: '/images/ui/mat-star-iron.png', cat: 'build', desc: '高级建材（5 铁矿合成）', sellPrice: 110 },
  // ---- 养成素材（妖丹 + 七属性石） ----
  { id: 'pill-normal', name: '妖丹', icon: '/images/ui/mat-pill-normal.png', cat: 'growth', desc: '小妖内丹，可兑换养成物资', sellPrice: 40 },
  { id: 'pill-rare', name: '稀有妖丹', icon: '/images/ui/mat-pill-rare.png', cat: 'growth', desc: '精怪内丹，妖王夜掉落', sellPrice: 150 },
  { id: 'stone-metal', name: '金晶石', icon: '/images/ui/el-metal.png', cat: 'growth', desc: '强化金属性克制伤害', sellPrice: 60 },
  { id: 'stone-wood', name: '木灵石', icon: '/images/ui/el-wood.png', cat: 'growth', desc: '强化木属性克制伤害', sellPrice: 60 },
  { id: 'stone-water', name: '水魄石', icon: '/images/ui/el-water.png', cat: 'growth', desc: '强化水属性克制伤害', sellPrice: 60 },
  { id: 'stone-fire', name: '火晶石', icon: '/images/ui/el-fire.png', cat: 'growth', desc: '强化火属性克制伤害', sellPrice: 60 },
  { id: 'stone-earth', name: '土魂石', icon: '/images/ui/el-earth.png', cat: 'growth', desc: '强化土属性克制伤害', sellPrice: 60 },
  { id: 'stone-light', name: '辉光石', icon: '/images/ui/el-light.png', cat: 'growth', desc: '强化光属性克制伤害', sellPrice: 80 },
  { id: 'stone-dark', name: '幽冥石', icon: '/images/ui/el-dark.png', cat: 'growth', desc: '强化暗属性克制伤害', sellPrice: 80 },
  // ---- 法宝道具（夜战与经营的限时神器） ----
  { id: 'boss-lure', name: '妖王诱引香', icon: '/images/ui/prop-boss-lure.png', cat: 'prop', desc: '今日妖王退散后焚香，可再召一场妖王夜', sellPrice: 60 },
  { id: 'capture-net', name: '缚妖网', icon: '/images/ui/prop-capture-net.png', cat: 'prop', desc: '夜战中张网，本场收服成功率 +15%', sellPrice: 30 },
  { id: 'haste-talisman', name: '聚宝符', icon: '/images/ui/prop-haste-talisman.png', cat: 'prop', desc: '激活后 15 分钟，挂机收益 ×2', sellPrice: 25 },
]

export const MATERIALS_MAP: Record<string, MaterialDef> = Object.fromEntries(
  MATERIALS.map((m) => [m.id, m])
)

/** 杂货铺：金币素材（食材 + 基础建材；V1.3.1 经济再测调：物价约×1.8） */
export const GROCERY_GOLD: Array<{ id: string; price: number }> = [
  { id: 'meat', price: 330 },
  { id: 'rice', price: 260 },
  { id: 'salt', price: 290 },
  { id: 'wine', price: 470 },
  { id: 'wood', price: 580 },
  { id: 'stone', price: 580 },
  { id: 'iron', price: 690 },
]

/** 杂货铺：灵石商品（妖丹 + 属性石袋 + 妖王诱引香；V1.3.1 提价并新增诱引香） */
export const GROCERY_GEM: Array<{ id: string; price: number; name: string; icon: string; desc: string }> = [
  { id: 'pill-normal', price: 12, name: '妖丹', icon: '/images/ui/mat-pill-normal.png', desc: '小妖内丹' },
  { id: 'stone-bag', price: 16, name: '属性石袋', icon: '/images/ui/prop-stone-bag.png', desc: '随机开出七属性石×1' },
  { id: BOSS_LURE.id, price: BOSS_LURE.price, name: BOSS_LURE.name, icon: '/images/ui/prop-boss-lure.png', desc: BOSS_LURE.desc },
]

export const MATERIAL_CATS: Array<{ key: MaterialCat; name: string; icon: string; desc: string }> = [
  { key: 'food', name: '经营食材', icon: '/images/ui/cat-food.png', desc: '灶火做饭，提升挂机收益' },
  { key: 'build', name: '建设素材', icon: '/images/ui/cat-build.png', desc: '设施升级，客栈焕新' },
  { key: 'growth', name: '养成素材', icon: '/images/ui/cat-growth.png', desc: '属性强化，克制加成' },
  { key: 'prop', name: '法宝道具', icon: '/images/ui/cat-prop.png', desc: '夜战经营神器，时机使用' },
]

/** 素材合成配方（低级 → 高级） */
export interface MatRecipe {
  id: string
  from: { id: string; n: number }
  to: { id: string; n: number }
}

export const MAT_RECIPES: MatRecipe[] = [
  { id: 'r-wood', from: { id: 'wood', n: 5 }, to: { id: 'spirit-wood', n: 1 } },
  { id: 'r-stone', from: { id: 'stone', n: 5 }, to: { id: 'jade', n: 1 } },
  { id: 'r-iron', from: { id: 'iron', n: 5 }, to: { id: 'star-iron', n: 1 } },
]

/** 素材存储上限（仓库等级提升上限） */
export const MAT_CAP_BASE = 200

export function matCap(save: Pick<GameSave, 'facilities'>): number {
  return MAT_CAP_BASE + save.facilities.warehouse * 100
}

/** 灶火料理（消耗食材 → 限时收益加成） */
export interface CookDish {
  id: string
  name: string
  icon: string
  cost: Record<string, number>
  goldMult: number
  gemMult: number
  minutes: number
  desc: string
}

export const COOK_DISHES: CookDish[] = [
  {
    id: 'plain', name: '家常便饭', icon: '/images/ui/dish-plain.png',
    cost: { meat: 1, rice: 1 },
    goldMult: 0.2, gemMult: 0, minutes: 30,
    desc: '金币收益 +20%，持续 30 分钟',
  },
  {
    id: 'signature', name: '招牌妖宴', icon: '/images/ui/dish-signature.png',
    cost: { meat: 2, rice: 2, salt: 1 },
    goldMult: 0.35, gemMult: 0.05, minutes: 60,
    desc: '金币 +35% · 灵石 +5%，持续 60 分钟',
  },
  {
    id: 'banquet', name: '迎宾大宴', icon: '/images/ui/dish-banquet.png',
    cost: { meat: 3, rice: 3, salt: 2, wine: 1 },
    goldMult: 0.6, gemMult: 0.1, minutes: 120,
    desc: '金币 +60% · 灵石 +10%，持续 120 分钟',
  },
]

/** 设施升级的建设素材消耗（Lv.1-3 新手期纯金币，Lv.4+ 开始消耗素材；温泉汤院从建造起即需高级建材） */
export function facilityMatCost(key: keyof InnFacilities, level: number): Record<string, number> {
  if (level < 3 && key !== 'hotSpring') return {}
  const lv = level
  const ceil = (n: number) => Math.ceil(n)
  switch (key) {
    case 'kitchen':
      return { iron: ceil(lv * 0.75), wood: ceil(lv * 0.5) }
    case 'guestRoom':
      return { wood: ceil(lv * 0.75), stone: ceil(lv * 0.4) }
    case 'hall':
      return { stone: ceil(lv * 0.75), wood: ceil(lv * 0.4) }
    case 'warehouse':
      return { stone: ceil(lv * 0.5), iron: ceil(lv * 0.4) }
    case 'powerPool':
      return { wood: ceil(lv * 0.5), stone: ceil(lv * 0.5), iron: ceil(lv * 0.4) }
    case 'smithy':
      return { iron: ceil(lv), wood: ceil(lv * 0.3) }
    case 'pharmacy':
      return { wood: ceil(lv * 0.6), stone: ceil(lv * 0.6) }
    case 'wishAltar':
      return { stone: ceil(lv * 0.75), iron: ceil(lv * 0.5) }
    case 'hotSpring':
      // 温泉汤院：灵玉 + 灵木（高级建材，需采集/合成/商店多渠道获取）
      return { jade: ceil(Math.max(1, lv * 0.5)), 'spirit-wood': ceil(Math.max(1, lv * 0.4)) }
    default:
      return {}
  }
}

/** 战斗结算素材掉落基数（普通夜 / 妖王夜 ×2 由调用方处理） */
export function victoryMaterialDrops(level: number): Record<string, number> {
  const n = 2 + Math.floor(level / 3)
  return { wood: n, stone: n - 1 > 0 ? n - 1 : 1, iron: Math.max(1, n - 2), 'pill-normal': 1 }
}


export function defaultSave(): GameSave {
  return {
    version: 1,
    playerName: '客栈掌柜',
    gold: 300,
    gems: 10,
    tickets: 1,
    level: 1,
    region: 1,
    region2Level: 1,
    region2Opened: false,
    region3Level: 1,
    region3Opened: false,
    innLevel: 1,
    innExp: 0,
    facilities: { kitchen: 1, guestRoom: 1, hall: 1, warehouse: 1, powerPool: 0, smithy: 0, pharmacy: 0, wishAltar: 0, hotSpring: 0 },
    potions: { small: 2, medium: 1, large: 0 },
    staminaPotions: { small: 1, medium: 0, large: 0 },
    autoRotate: true,
    materials: { meat: 5, rice: 5, salt: 3, wine: 1, wood: 30, stone: 30, iron: 20, 'pill-normal': 1 },
    elementBoost: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0, light: 0, dark: 0 },
    cooking: { until: 0, goldMult: 0, gemMult: 0 },
    haste: { until: 0 },
    gather: { assignments: {}, acc: {} },
    owned: {
      lili: { count: 1, star: 1, deployed: true, level: 1, exp: 0, stamina: 100, skillLevel: 1 },
      shengsheng: { count: 1, star: 1, deployed: true, level: 1, exp: 0, stamina: 100, skillLevel: 1 },
      xuangui: { count: 1, star: 1, deployed: true, level: 1, exp: 0, stamina: 100, skillLevel: 1 },
    },
    tujian: ['lili', 'shengsheng', 'xuangui'],
    captured: {},
    achievements: [],
    daily: { date: today(), freeRecruitUsed: false, tasksClaimed: [], adsWatched: 0, nightDone: false, bossNightDone: false, events: {} },
    signIn: { totalDays: 0, lastDate: '' },
    festivalClaimed: [],
    skin: 'default',
    stats: { totalGold: 0, totalCaptures: 0, wins: 0, fails: 0, adViews: 0, bossWins: 0, winsRegion2: 0, winsRegion3: 0, gatherTotal: 0, createdAt: Date.now(), lastOnline: Date.now() },
    settings: { sound: true, music: true, sfxVolume: 0.8, bgmVolume: 0.8, seenDayGuide: false },
  }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
