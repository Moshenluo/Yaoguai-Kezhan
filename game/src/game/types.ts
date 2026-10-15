// ============ 妖怪客栈 · 核心类型定义 ============

/** 品级 */
export type Grade = 'normal' | 'rare' | 'legend'

/** 妖怪属性（五行 + 光暗） */
export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'light' | 'dark'

/** 夜晚战斗定位（与八大设施+温泉联动对应） */
export type NightRole =
  | 'tank' // 防御型 → 客房
  | 'ranged' // 攻击型 → 后厨
  | 'assassin' // 物理型 → 铁匠铺
  | 'mage' // 法术型 → 妖力池
  | 'controller' // 控制型 → 仓库
  | 'healer' // 治疗型 → 药房
  | 'support' // 辅助型 → 大堂
  | 'allround' // 全能型 → 仅吃许愿台全局加成，定向设施一律 50%

/** 白天职业 */
export type DayJob =
  | 'kitchen' // 后厨帮工
  | 'reception' // 前台接待
  | 'guest-room' // 客房服务
  | 'guard' // 护院维修
  | 'waiter' // 跑堂送餐
  | 'cleaner' // 清洁杂役
  | 'aquatic' // 后厨水产
  | 'watcher' // 夜间瞭望
  | 'accountant' // 账房先生
  | 'chef' // 后厨主厨
  | 'manager' // 客栈总管
  | 'sage' // 智慧长老（白泽）
  | 'devourer' // 吞金神兽（饕餮）
  | 'miner' // 开山谐石（猲）
  | 'diver' // 十身采珠（何罗鱼）
  | 'keeper' // 镇守山门（陆吾）
  | 'courier' // 神行接驳（乘黄）
  | 'inkmaker' // 制墨坊主（墨麟，水墨系）
  | 'scholar' // 书画先生（砚灵，水墨系）
  | 'reserved' // V1.1 预留

/** 技能效果类型（战斗引擎使用） */
export type SkillEffect =
  | 'stun-aoe' // 掘地冲击：范围眩晕
  | 'multi-shot' // 投石连击：多段
  | 'heal-aura' // 祥瑞回血：持续治疗
  | 'shield' // 龟甲护盾：自身减伤
  | 'dash-strike' // 疾跑突袭：突进+击退
  | 'claw-combo' // 猫爪连击：多段+暴击
  | 'water-bolt' // 水弹喷射：伤害+减速
  | 'mark' // 鹰眼锁定：增伤标记
  | 'charm' // 魅惑幻术：控制+爆发
  | 'fire-rain' // 烈焰焚天：区域持续AOE
  | 'charge-buff' // 神威冲锋：爆发+团队增益
  | 'insight' // 万物洞察：全体易伤+全队回血（白泽）
  | 'devour' // 饕餮盛宴：范围吞噬+自身回复（饕餮）
  | 'stone-shriek' // 猲鸣裂石：穿透音波多段伤害（猲）
  | 'ten-heal' // 十身回春：按已损血量强力群疗（何罗鱼）
  | 'nine-domains' // 天之九部：全队攻速增益+全体减速（陆吾）
  | 'swift-volley' // 千岁神驰：连射箭雨+自身攻速提升（乘黄）
  | 'ink-flood' // 墨浪洒天：范围墨浪多段伤害+减速（墨麟）
  | 'ink-stone' // 砚山镇纸：自身减伤+周团减速压阵（砚灵）

/** 妖怪静态数据 */
export interface YaoguaiDef {
  id: string
  name: string
  pinyin: string
  grade: Grade
  /** 妖怪属性（金木水火土光暗；普通小妖多数无属性，稀有以上必有） */
  element: Element | null
  origin: string // 出处
  form: string // 形态描述
  dayJob: DayJob
  dayJobName: string // 白天职业名
  dayBuff: string // 白天加成描述
  /** 白天数值加成（%） */
  dayStats: {
    goldRate?: number // 金币收益加成
    gemRate?: number // 灵石收益加成
    globalRate?: number // 全局收益加成
    offlineRate?: number // 离线收益加成
    innHpRate?: number // 夜间客栈血量加成
    rareRate?: number // 稀有妖怪刷新概率加成
  }
  nightRole: NightRole
  nightRoleName: string
  skillName: string
  skillDesc: string
  skillEffect: SkillEffect
  /** 基础战斗属性 */
  atk: number
  hp: number
  attackSpeed: number // 次/秒
  range: number // 格（1格≈12%路径宽度）
  obtain: string // 获取方式描述
  obtainType: 'initial' | 'capture-wave' | 'capture-boss' | 'capture-boss-night' | 'v1.1'
  /** 限定刷新区域（缺省 = 任意区域可刷；水墨系新妖仅区域二夜战精英池刷新） */
  spawnRegions?: Array<1 | 2 | 3>
  /** 升星描述 */
  starUpDesc: string
  remark: string
  color: string // 主题色（UI用）
}

/** 玩家持有的妖怪 */
export interface OwnedYaoguai {
  count: number // 持有数量（重复妖怪自动转化）
  star: number // 当前星级 1-5
  deployed: boolean // 白天是否上阵打工（影响收益）
  /** 当前等级（1-50，上限 = 星级 × 10） */
  level: number
  /** 当前经验（升级用） */
  exp: number
  /** 当前体力 0-100（五档状态：充沛/正常/疲惫/力竭/虚脱） */
  stamina: number
  /** 技能等级 1-5（妖丹消耗升级，每级技能效果 +15%） */
  skillLevel: number
}

/** 客栈设施等级（八大设施：白天产出收益 + 夜晚对应定位妖怪属性加成） */
export interface InnFacilities {
  kitchen: number // 后厨（攻击型：攻击/暴击）
  guestRoom: number // 客房（防御型：生命/防御）
  hall: number // 大堂（辅助型：技能效果/治疗）
  warehouse: number // 仓库（控制型：控制时长/减速）
  powerPool: number // 妖力池（法术型：技能伤害/能量回复）
  smithy: number // 铁匠铺（物理型：破甲/溅射）
  pharmacy: number // 药房（治疗型：治疗/全队回血）
  wishAltar: number // 许愿台（全局：全属性）
  hotSpring: number // 温泉汤院（V1.3：白天全体体力恢复加成，夜晚全体守卫脱战回春）
}

/** 经验药水库存 */
export interface PotionStock {
  small: number // 小瓶经验露 +30
  medium: number // 中瓶经验露 +100
  large: number // 大瓶经验露 +300
}

/** 体力药水库存 */
export interface StaminaPotionStock {
  small: number // 小瓶气力散 单只 +30
  medium: number // 中瓶气力散 单只 +60
  large: number // 大瓶回元丹 全体 +100
}

/** 场景贴片实例（多实例：同一设施可摆多座、装饰可摆多件；id 为实例唯一标识） */
export interface ScenePiece {
  /** 实例唯一 id（存档内稳定） */
  id: string
  /** 对应 scene-layers.SCENE_COMPS 的 key */
  key: string
  /** 底部中心锚点（% 场景坐标） */
  x: number
  y: number
  /** 缩放倍率 0.5~2.5（缺省 1） */
  s?: number
  /** 水平镜像翻转 */
  f?: boolean
}

/** 玩家游戏存档 */
export interface GameSave {
  version: number
  playerName: string
  gold: number
  gems: number
  tickets: number // 招募券
  level: number // 塔防关卡进度（区域一·客栈山道）
  /** 当前驻扎区域（1 = 客栈山道 / 2 = 水墨幽谷 / 3 = 沸火赤川），夜战按此区域结算 */
  region: 1 | 2 | 3
  /** 区域二（水墨幽谷）关卡进度 */
  region2Level: number
  /** 水墨幽谷分店是否已开设（开设后解锁区域二 + 分店收益/体力加成） */
  region2Opened: boolean
  /** 区域三（沸火赤川）关卡进度 */
  region3Level: number
  /** 沸火赤川分店是否已开设（开设后解锁区域三 + 分店收益/体力加成） */
  region3Opened: boolean
  innLevel: number // 客栈等级
  innExp: number
  facilities: InnFacilities
  /** 经验药水库存（妖怪升级用） */
  potions: PotionStock
  /** 体力药水库存（妖怪体力恢复用） */
  staminaPotions: StaminaPotionStock
  /** 自动轮换排班开关（打工妖体力低于阈值自动休息并补位） */
  autoRotate: boolean
  /** 三类素材库存（经营/建设/养成，含属性石 stone-*、妖丹 pill-*） */
  materials: Record<string, number>
  /** 属性石强化等级（每级克制伤害 +5%，上限 5 级） */
  elementBoost: Record<Element, number>
  /** 灶火料理增益（消耗食材获得限时收益加成） */
  cooking: { until: number; goldMult: number; gemMult: number; dish?: string }
  /** 聚宝符增益（V1.1 道具：激活后限时挂机收益 ×2） */
  haste: { until: number }
  /** 山野采集队（V1.3：妖怪出野采集素材，某些妖怪有采集亲和加成） */
  gather: {
    /** 采集位任命（任务 id → 妖怪 id） */
    assignments: Record<string, string>
    /** 各任务累积产出（小数累积，收取时取整） */
    acc: Record<string, number>
  }
  owned: Record<string, OwnedYaoguai>
  tujian: string[] // 图鉴（见过的妖怪）
  captured: Record<string, number> // 各妖怪累计捕捉挑战次数（保底用）
  /** 已领取的成就 id */
  achievements: string[]
  daily: {
    date: string
    freeRecruitUsed: boolean
    tasksClaimed: string[]
    adsWatched: number
    nightDone: boolean
    /** 妖王夜今日是否已完成（胜利后置位，每日重置） */
    bossNightDone: boolean
    /** 每日事件计数（任务进度用） */
    events: Record<string, number>
  }
  /** 七日签到进度（totalDays：累计签到天数；lastDate：上次签到日期，同日不可重复领） */
  signIn: { totalDays: number; lastDate: string }
  /** 已领取的节日礼包标识（如 newyear-2026，跨年可重复领） */
  festivalClaimed: string[]
  /** 当前客栈皮肤 id（见 config.SKINS） */
  skin: string
  /** 七日目标：start=周期首日日期；claimed=第 1~7 日领取标记（懒周期：超 7 日自动重开） */
  weekGoal?: { start: string; claimed: boolean[] }
  /** 场景贴片实例列表（建筑 + 装饰；同一设施可摆多座，上限见 scene-layers.sceneCap） */
  scenePieces?: ScenePiece[]
  stats: {
    totalGold: number
    totalCaptures: number
    wins: number
    fails: number
    adViews: number
    /** 妖王夜胜利次数（决定妖王轮换：偶数白泽/奇数饕餮） */
    bossWins: number
    /** 区域二（水墨幽谷）守店胜利次数（成就用） */
    winsRegion2: number
    /** 区域三（沸火赤川）守店胜利次数（成就用） */
    winsRegion3: number
    /** 累计采集素材数量（采集队收取入账时累计） */
    gatherTotal: number
    createdAt: number
    lastOnline: number
  }
  settings: {
    sound: boolean
    music: boolean
    /** 音效音量（0-1，存档持久化） */
    sfxVolume: number
    /** 背景音乐音量（0-1，存档持久化） */
    bgmVolume: number
    /** 白天三步引导是否已看过（跳过/完成都记） */
    seenDayGuide: boolean
  }
}

// ============ 战斗引擎类型 ============

export interface BattleDefender {
  uid: string
  yaoguaiId: string
  star: number
  level: number
  name: string
  /** 妖怪属性（克制关系结算用） */
  element: Element | null
  atk: number
  hp: number
  maxHp: number
  attackSpeed: number
  range: number
  slot: number // 站位格 0-3
  x: number // 位置（路径百分比 0-100，客栈一侧 ~88-95）
  color: string
  skillName: string
  skillEffect: SkillEffect
  attackTimer: number
  skillTimer: number
  skillCd: number
  shieldUntil: number
  buffAtkUntil: number
  dead: boolean
  // ---- 设施联动战斗字段 ----
  /** 暴击率（后厨·暴击加成，0-1） */
  critRate: number
  /** 防御减伤系数（客房·防御加成，0-0.5，受伤 ×(1-defReduce)） */
  defReduce: number
  /** 技能伤害倍率（大堂/妖力池加成，1.0 基准） */
  skillDmgMult: number
  /** 治疗倍率（大堂/药房加成，1.0 基准） */
  healMult: number
  /** 控制时长倍率（仓库加成，1.0 基准） */
  ctrlMult: number
  /** 后厨 Lv.3 美食增益：首次造成伤害 ×1.5 */
  firstStrikeUsed: boolean
  /** 药房 Lv.3 丹药储备：免死一次 */
  reviveUsed: boolean
  /** 客房 Lv.3 舒适休憩：回血计时器 */
  regenTimer: number
  /** 妖力池 Lv.3 妖力涌动：攻速增益截止时间 */
  atkSpeedBuffUntil: number
  /** 陆吾·天之九部：独立攻速增益截止时间（与妖力池 buff 叠加） */
  hasteUntil: number
  /** 陆吾·天之九部：攻速增益倍率（如 1.2 = +20%） */
  hasteMult: number
  /** 体力档位（疲惫/力竭战斗 debuff 已折算到攻速/攻击；UI 状态角标用） */
  staminaTier: 'full' | 'normal' | 'tired' | 'exhausted'
}

export interface BattleEnemy {
  uid: string
  kind: string // enemy-1 / enemy-2 / boss / elite:xxx
  name: string
  img: string
  /** 敌人属性（野妖概率携带，精英/妖王取自身属性） */
  element: Element | null
  hp: number
  maxHp: number
  atk: number
  speed: number // 路径百分比/秒
  x: number // 0(出生) - 100(客栈)
  size: number
  elite: boolean
  /** 可捕捉的稀有妖怪 id */
  yaoguaiId?: string
  attackTimer: number
  stunnedUntil: number
  slowedUntil: number
  slowFactor: number
  charmedUntil: number
  markedUntil: number
  markBonus: number
  burningUntil: number
  burningDps: number
  dead: boolean
  /** 捕捉保护（血量≤5% 停止一切伤害） */
  protectedFlag: boolean
  captureFailCount: number
  /** 运宝小妖（宝箱波）：不打客栈，打死掉宝，到达客栈则溜走 */
  treasure?: boolean
  /** 野性难驯（稀有精英概率生成）：本夜无法收服，只能放归 */
  uncapturable?: boolean
  /** 精英词缀（V2.0 反背板：精英怪随机携带，普通怪/妖雾/妖王不带） */
  affix?: EliteAffixId
  /** 纵向车道位置（渲染用，0-100） */
  lane: number
  /** 出场延迟（秒） */
  spawnDelay: number
}

/** 精英词缀 id（池见 config.ELITE_AFFIXES） */
export type EliteAffixId = 'swift' | 'bulwark' | 'vampire' | 'stone' | 'fission' | 'rampage'

export interface FloatText {
  id: number
  x: number
  y: number
  text: string
  type: 'damage' | 'crit' | 'heal' | 'gold' | 'capture' | 'skill'
  /** 出生时间（引擎 elapsed 秒） */
  born: number
}

export type BattlePhase =
  | 'prep' // 波次间隔（布阵倒计时）
  | 'interlude' // 波间抉择（肉鸽三选一事件，暂停等待玩家）
  | 'fighting' // 战斗中
  | 'victory' // 通关
  | 'failed' // 失败

/** 夜战备战增益效果（engine.applyBuff 注入；开局三选一与波间事件共用） */
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

/** 夜战波间事件（肉鸽钩子第二层：清波后三选一） */
export type NightEventKind = 'buff' | 'deal' | 'curse' | 'rest'
export interface NightEvent {
  id: string
  name: string
  desc: string
  icon: string
  kind: NightEventKind
  /** deal：花费（本场 waveGold） */
  cost?: number
  /** buff/deal：注入的增益效果 */
  effect?: NightBuffEffect
  /** buff/deal：对应底层增益 id（觉醒计数用，3 张同名觉醒） */
  buffId?: string
  /** buff/deal：增益名（觉醒飘字用） */
  buffName?: string
  /** rest/curse：客栈耐久变化比例（+修复 / -受损） */
  innHpPct?: number
  /** rest：全体守卫回血比例 */
  healPct?: number
  /** curse：受损换取的补偿增益 */
  compensation?: NightBuffEffect
}

export interface BattleState {
  phase: BattlePhase
  wave: number // 当前波次 1-5
  totalWaves: number
  /** 波间事件三选一（phase='interlude' 时非空，选完清除） */
  eventOffer?: NightEvent[]
  /** 本夜夜相（入场随机全局 modifier，池见 config.NIGHT_PHASES） */
  nightPhase: 'calm' | 'waxing' | 'waning' | 'blood'
  innHp: number
  innMaxHp: number
  enemies: BattleEnemy[]
  defenders: BattleDefender[]
  floatTexts: FloatText[]
  prepCountdown: number // 布阵剩余秒
  killCount: number
  waveGold: number // 本场金币掉落
  fogTriggered: boolean // 妖雾降临
  fogYaoguai?: string // 妖雾刷新的限定妖怪
  capturedThisBattle: string[]
  /** 本场掉落的素材（结算入仓库） */
  materialsGained: Record<string, number>
  speed: number
  paused: boolean
  elapsed: number
}

/** 战斗结算 */
export interface BattleResult {
  victory: boolean
  waveReached: number
  gold: number
  gems: number
  tickets: number
  captured: string[]
  /** 妖王夜结算标记（page.tsx 传给 finishBattle，决定 bossWins/bossNightDone/不推进关卡） */
  bossNight?: boolean
  /** 参战妖怪获得的经验（id → 经验值） */
  expGained?: Record<string, number>
  /** 本场掉落的素材（id → 数量，结算入仓库） */
  materialsGained?: Record<string, number>
}
