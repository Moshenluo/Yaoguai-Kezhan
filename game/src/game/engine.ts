import type {
  BattleDefender,
  BattleEnemy,
  BattleState,
  Element,
  FloatText,
  InnFacilities,
  SkillEffect,
} from './types'
import {
  AD_CAPTURE_BONUS,
  BOSS_NIGHT,
  BOSS_NIGHT_WAVES,
  CAPTURE_HP_THRESHOLD,
  CAPTURE_RATE,
  RARE_WILD_RATE,
  currentBossId,
  ENEMY_TYPES,
  LEVEL_BONUS,
  PROTECT_HP_THRESHOLD,
  SLOTS,
  WAVES,
  computeFacilityBonus,
  counterDamageMult,
  elementRelation,
  facilityAbilityActive,
  facilityAbilityEnhanced,
  levelScale,
  lineupSynergy,
  regionDef,
  skillLevelMult,
  springRegenPerSec,
  staminaTier,
  starBattleMultiplier,
  stoneIdFor,
  victoryMaterialDrops,
  type WaveConfig,
} from './config'
import { CAPTURABLE_WAVE, YAOGUAI_MAP } from './yaoguai'

// ============ 妖怪客栈 · 夜间塔防战斗引擎 ============
// 逻辑帧驱动：requestAnimationFrame + dt 缩放，速度倍率支持 1x/2x

export interface LineupEntry {
  yaoguaiId: string
  star: number
  /** 妖怪等级（属性成长：攻+3%/级 生命+4%/级 防+2%/级） */
  level: number
  slot: number
  /** 当前体力（0-100）：疲惫攻速-10% / 力竭攻击-20%·攻速-25%（虚脱不可上阵由 UI 拦截） */
  stamina?: number
  /** 技能等级（1-5，妖丹消耗升级：技能伤害/治疗/控制 +15%/级） */
  skillLevel?: number
}

export interface EngineOptions {
  level: number
  lineup: LineupEntry[]
  innMaxHp: number
  /** 稀有妖怪刷新概率加成（颙等，0.05 = +5%） */
  rareBonus: number
  /** 八大设施等级（设施↔塔防联动：对应定位妖怪获得属性加成与特殊能力） */
  facilities: InnFacilities
  /** 妖王夜模式（V1.1 传说妖王）：5 波妖王亲卫 + 第 5 波传说妖王 BOSS，敌军整体强化 */
  bossNight?: boolean
  /** 战斗区域（V1.2 世界地图）：2 = 水墨幽谷 / 3 = 沸火赤川（敌军更强/野妖换域风；妖王夜固定区域一） */
  region?: 1 | 2 | 3
  /** 妖王夜第 5 波妖王 id（白泽/饕餮，由 NightScreen 依 store.stats.bossWins 轮换） */
  bossId?: 'baize' | 'taotie'
  /** 当前可用站位数（前 4 格基础开放，第 5/6 格随客栈等级解锁；超格阵容将被过滤） */
  maxSlots?: number
  /** 属性石强化等级（克制伤害 +5%/级） */
  elementBoost?: Record<Element, number>
}

/** 妖王技能飘字文案（BattleField 依此渲染专属紫/红配色浮字） */
export const BOSS_SKILL_TEXT = {
  baize: '白泽·万物洞察',
  taotie: '饕餮·盛宴',
} as const

/** 格距：1格 = 12% 路径宽度 */
const CELL = 12
const INN_X = 94

let uidCounter = 0
function uid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${uidCounter}`
}

/** 波次精英怪随机池（九尾狐/毕方/陆吾/乘黄 + 区域限定水墨系墨麟/砚灵） */
function pickWaveEliteId(region: 1 | 2 | 3): string {
  const pool = CAPTURABLE_WAVE.filter(
    (y) => !y.spawnRegions || y.spawnRegions.includes(region)
  ).map((y) => y.id)
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 妖雾限定怪随机池（稀有精怪全池，按区域过滤） */
function pickFogYaoguaiId(region: 1 | 2 | 3): string {
  const pool = CAPTURABLE_WAVE.filter(
    (y) => !y.spawnRegions || y.spawnRegions.includes(region)
  ).map((y) => y.id)
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 野妖随机属性：小妖 40% / 山怪精怪 60% 概率携带随机五行（光暗不出现在野妖） */
const WILD_ELEMENTS: Element[] = ['metal', 'wood', 'water', 'fire', 'earth']
function rollWildElement(strong: boolean): Element | null {
  if (Math.random() < (strong ? 0.6 : 0.4)) {
    return WILD_ELEMENTS[Math.floor(Math.random() * WILD_ELEMENTS.length)]
  }
  return null
}

/** 零强化快照（elementBoost 缺省时使用） */
const EMPTY_BOOST: Record<Element, number> = {
  metal: 0, wood: 0, water: 0, fire: 0, earth: 0, light: 0, dark: 0,
}

export class BattleEngine {
  private opts: EngineOptions
  private listeners = new Set<() => void>()
  private rafId: number | null = null
  private lastFrame = 0
  private floatId = 0
  /** 波次敌人出场队列 */
  private spawnQueue: BattleEnemy[] = []
  private spawnTimer = 0
  /** 精英怪是否已刷新（每波一只） */
  private waveEliteSpawned = false
  /** 妖王（妖王夜第 5 波 BOSS）uid 与技能计时器 */
  private bossUid: string | null = null
  private bossSkillTimer = 0
  private bossSkillCd = 13
  /** 白泽·万物洞察：全体守卫易伤窗口（截止时间 + 增伤比例） */
  private defenderVulnUntil = -1
  private defenderVulnBonus = 0
  /** 许愿台 Lv.3 神灵庇佑：客栈无敌窗口（每场一次） */
  private innShieldUntil = -1
  private innShieldUsed = false
  /** 温泉汤院·汤泉回春：全体每秒回复计时器 */
  private springTimer = 0

  state: BattleState

  constructor(opts: EngineOptions) {
    this.opts = opts
    this.state = {
      phase: 'prep',
      wave: 1,
      totalWaves: (opts.bossNight ? BOSS_NIGHT_WAVES : WAVES).length,
      innHp: opts.innMaxHp,
      innMaxHp: opts.innMaxHp,
      enemies: [],
      defenders: [],
      floatTexts: [],
      prepCountdown: 12,
      killCount: 0,
      waveGold: 0,
      // 妖王夜不出妖雾彩蛋
      fogTriggered: opts.bossNight ? false : Math.random() < 0.28,
      fogYaoguai: undefined,
      capturedThisBattle: [],
      materialsGained: {},
      speed: 1,
      paused: false,
      elapsed: 0,
    }
    if (this.state.fogTriggered) {
      this.state.fogYaoguai = pickFogYaoguaiId(this.opts.region ?? 1)
    }
    this.refreshDefenders()
  }

  // ---------- 外部商店接口 ----------

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): BattleState => this.state

  private emit() {
    // 浅拷贝快照触发 React 更新
    this.state = {
      ...this.state,
      enemies: [...this.state.enemies],
      defenders: [...this.state.defenders],
      floatTexts: [...this.state.floatTexts],
    }
    this.listeners.forEach((fn) => fn())
  }

  start() {
    if (this.rafId != null) return
    this.lastFrame = performance.now()
    const loop = (t: number) => {
      this.rafId = requestAnimationFrame(loop)
      const dtReal = Math.min((t - this.lastFrame) / 1000, 0.1)
      this.lastFrame = t
      if (!this.state.paused && (this.state.phase === 'prep' || this.state.phase === 'fighting')) {
        this.tick(dtReal * this.state.speed)
      }
    }
    this.rafId = requestAnimationFrame(loop)
  }

  destroy() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.listeners.clear()
  }

  setSpeed(speed: number) {
    this.state.speed = speed
    this.emit()
  }

  togglePause() {
    this.state.paused = !this.state.paused
    this.emit()
  }

  // ---------- 布阵（prep 阶段） ----------

  /** prep 阶段调整阵容：替换某站位的妖怪（锁定格之外的阵容被过滤，防旧存档越界） */
  setLineup(lineup: LineupEntry[]) {
    if (this.state.phase !== 'prep') return
    const max = this.opts.maxSlots ?? SLOTS.length
    this.opts.lineup = lineup.filter((l) => l.slot >= 0 && l.slot < max)
    this.refreshDefenders()
    this.emit()
  }

  get lineup(): LineupEntry[] {
    return [...this.opts.lineup]
  }

  private refreshDefenders() {
    const max = this.opts.maxSlots ?? SLOTS.length
    // ---- 阵容相生加成（金生水→生命+10%、木生火→攻击+10% 等，全队生效） ----
    const defs = this.opts.lineup
      .filter((entry) => entry.slot >= 0 && entry.slot < max)
      .map((entry) => YAOGUAI_MAP[entry.yaoguaiId])
      .filter((d): d is NonNullable<typeof d> => !!d)
    const syn = lineupSynergy(defs)
    this.state.defenders = this.opts.lineup
      .filter((entry) => entry.slot >= 0 && entry.slot < max)
      .map((entry) => this.buildDefender(entry, syn))
  }

  /**
   * 槽位吸附式布阵（保卫萝卜范式）：空位就地上阵 / 已占位撤下换人。
   * prep 阶段全量重建；战斗中外科手术式只动目标槽位（保留其余守卫血量与 uid），
   * 体力照常按「每波完成时在场名单」结算，无需额外返还逻辑。
   */
  swapSlot(slot: number, entry: LineupEntry | null) {
    const max = this.opts.maxSlots ?? SLOTS.length
    if (slot < 0 || slot >= max) return
    if (this.state.phase === 'victory' || this.state.phase === 'failed') return
    const rest = this.opts.lineup.filter((l) => l.slot !== slot && l.yaoguaiId !== entry?.yaoguaiId)
    this.opts.lineup = entry ? [...rest, { ...entry, slot }] : rest
    if (this.state.phase === 'prep') {
      this.refreshDefenders()
      this.emit()
      return
    }
    const idx = this.state.defenders.findIndex((d) => d.slot === slot)
    if (!entry) {
      if (idx >= 0) this.state.defenders.splice(idx, 1)
      this.emit()
      return
    }
    // 战斗中上阵：按当前阵容重算相生加成，只构建目标槽位这一只
    const defs = this.opts.lineup
      .map((l) => YAOGUAI_MAP[l.yaoguaiId])
      .filter((d): d is NonNullable<typeof d> => !!d)
    const nd = this.buildDefender({ ...entry, slot }, lineupSynergy(defs))
    if (idx >= 0) this.state.defenders[idx] = nd
    else this.state.defenders.push(nd)
    this.emit()
  }

  /** 构建单只战斗守卫（refreshDefenders 全量重建与战斗中换人共用） */
  private buildDefender(entry: LineupEntry, syn: { atkPct: number; hpPct: number }): BattleDefender {
      const def = YAOGUAI_MAP[entry.yaoguaiId]
      const mult = starBattleMultiplier(entry.star)
      const slotPos = SLOTS[entry.slot] ?? SLOTS[0]
      // ---- 设施联动：对应定位 100% 加成，非对应 50%，许愿台全局 ----
      const fac = computeFacilityBonus(this.opts.facilities, def.nightRole)
      // ---- 体力档位：疲惫攻速-10% / 力竭攻击-20%·攻速-25% ----
      const stTier = staminaTier(entry.stamina ?? 100)
      // 等级成长：攻击+3%/级、生命+4%/级、防御+2%/级
      const lvAtk = 1 + (entry.level - 1) * LEVEL_BONUS.atk
      const lvHp = 1 + (entry.level - 1) * LEVEL_BONUS.hp
      const defPctTotal = fac.defPct + (entry.level - 1) * LEVEL_BONUS.def * 100
      // 技能 CD 缩短（妖力池·能量回复，上限 40%）；盾技能基准 10 秒
      const cdReduce = Math.min(fac.energyPct, 0.4)
      const baseCd =
        def.skillEffect === 'insight' ? 15 : def.skillEffect === 'devour' ? 12 : def.skillEffect === 'shield' ? 10 : 9
      // ---- 技能等级（V1.3 妖丹消耗升级）：技能伤害/治疗/控制 +15%/级 ----
      const skMult = skillLevelMult(entry.skillLevel ?? 1)
      return {
        uid: uid('d'),
        yaoguaiId: entry.yaoguaiId,
        star: entry.star,
        level: entry.level,
        name: def.name,
        element: def.element,
        atk: Math.round(def.atk * mult * lvAtk * (1 + fac.atkPct) * (1 + syn.atkPct) * stTier.atkMult),
        hp: Math.round(def.hp * mult * lvHp * (1 + fac.hpPct) * (1 + syn.hpPct)),
        maxHp: Math.round(def.hp * mult * lvHp * (1 + fac.hpPct) * (1 + syn.hpPct)),
        attackSpeed: def.attackSpeed * stTier.asMult,
        range: def.range,
        slot: entry.slot,
        x: slotPos.x,
        color: def.color,
        skillName: def.skillName,
        skillEffect: def.skillEffect,
        attackTimer: 0,
        skillTimer: 3, // 开局3秒后放技能
        skillCd: baseCd * (1 - cdReduce),
        shieldUntil: -1,
        buffAtkUntil: -1,
        dead: false,
        // ---- 设施联动战斗字段 ----
        critRate: 0.1 + fac.critPct,
        defReduce: Math.min(0.5, defPctTotal * 0.004),
        skillDmgMult: (1 + fac.skillDmgPct) * skMult,
        healMult: (1 + fac.healPct) * skMult,
        ctrlMult: (1 + fac.ctrlPct) * skMult,
        firstStrikeUsed: false,
        reviveUsed: false,
        regenTimer: 0,
        atkSpeedBuffUntil: -1,
        hasteUntil: -1,
        hasteMult: 1,
        staminaTier: stTier.key === 'collapse' ? 'exhausted' : stTier.key,
      }
  }

  // ---------- 主循环 ----------

  private tick(dt: number) {
    this.state.elapsed += dt

    if (this.state.phase === 'prep') {
      this.state.prepCountdown -= dt
      if (this.state.prepCountdown <= 0) {
        this.beginWave()
      }
      this.cleanupFloats()
      this.emit()
      return
    }

    if (this.state.phase === 'fighting') {
      this.updateSpawns(dt)
      this.updateEnemies(dt)
      this.updateDefenders(dt)
      this.updateBossSkill(dt)
      this.cleanupFloats()
      this.checkWaveEnd()
      this.emit()
    }
  }

  private cleanupFloats() {
    if (this.state.floatTexts.length > 0) {
      this.state.floatTexts = this.state.floatTexts.filter((f) => this.state.elapsed - f.born < 1.1)
    }
  }

  // ---------- 波次管理 ----------

  /** 当前模式的波次配置（妖王夜用妖王亲卫强化波次表） */
  private get waves(): readonly WaveConfig[] {
    return this.opts.bossNight ? BOSS_NIGHT_WAVES : WAVES
  }

  private beginWave() {
    const waveIdx = this.state.wave - 1
    const wave = this.waves[waveIdx]
    const scale = levelScale(this.opts.level)
    // 妖王夜：敌军整体强化（叠加 levelScale 与波次倍率）；区域二：水墨系野妖更强（妖王夜固定区域一）
    const reg = regionDef(this.opts.region ?? 1)
    const nightHpMult = this.opts.bossNight ? BOSS_NIGHT.hpScale : reg.hpScale
    const nightAtkMult = this.opts.bossNight ? BOSS_NIGHT.atkScale : reg.atkScale
    this.spawnQueue = []
    this.spawnTimer = 0
    this.waveEliteSpawned = false

    const makeEnemy = (
      base: (typeof ENEMY_TYPES)[keyof typeof ENEMY_TYPES],
      lane: number,
      delay: number
    ): BattleEnemy => ({
      uid: uid('e'),
      kind: base.name,
      // 区域二野妖换水墨风名号（kind 保留原类型供击杀金币判定）
      name: base.name === '小妖' ? reg.enemyNames.minion : base.name === '山怪' ? reg.enemyNames.brute : reg.enemyNames.sprite,
      img: base.img,
      element: rollWildElement(base.name !== '小妖'),
      hp: Math.round(base.hp * wave.hpScale * scale.hp * nightHpMult),
      maxHp: Math.round(base.hp * wave.hpScale * scale.hp * nightHpMult),
      atk: Math.round(base.atk * wave.atkScale * scale.atk * nightAtkMult),
      speed: base.speed * scale.speed,
      x: -6,
      size: base.size,
      elite: false,
      attackTimer: 0,
      stunnedUntil: -1,
      slowedUntil: -1,
      slowFactor: 1,
      charmedUntil: -1,
      markedUntil: -1,
      markBonus: 0,
      burningUntil: -1,
      burningDps: 0,
      dead: false,
      protectedFlag: false,
      captureFailCount: 0,
      lane,
      spawnDelay: delay,
    })

    let delay = 0
    const lanes = [44, 49, 53, 46, 51, 54, 47, 52]
    let li = 0
    const types: Array<'minion' | 'brute' | 'sprite'> = []
    for (let i = 0; i < wave.minions; i++) types.push('minion')
    for (let i = 0; i < wave.brutes; i++) types.push('brute')
    for (let i = 0; i < wave.sprites; i++) types.push('sprite')
    // 打乱出场顺序
    types.sort(() => Math.random() - 0.5)
    for (const t of types) {
      this.spawnQueue.push(makeEnemy(ENEMY_TYPES[t], lanes[li++ % lanes.length], delay))
      delay += t === 'brute' ? 1.4 : 0.75
    }

    // 精英妖怪（第3/4/5波概率刷新，可捕捉；妖王夜照常；区域二/三刷新率更高；水墨系新妖仅区域二池）
    const eliteChance = wave.eliteChance + this.opts.rareBonus + (this.opts.bossNight ? 0 : reg.eliteBonus)
    if (waveIdx >= 2 && Math.random() < eliteChance) {
      this.spawnQueue.push(this.makeElite(pickWaveEliteId(this.opts.region ?? 1), delay + 1.2, wave.hpScale * nightHpMult))
      this.waveEliteSpawned = true
    }

    // 妖雾彩蛋：随机波次额外刷新1只限定稀有妖怪（妖王夜关闭）
    if (this.state.fogTriggered && this.state.fogYaoguai && this.state.wave === 4) {
      this.spawnQueue.push(this.makeElite(this.state.fogYaoguai, delay + 2.5, wave.hpScale * 1.3, '妖雾'))
    }

    // BOSS：普通夜第5波压阵（V1.3.1 区域独占）——英招为客栈山道（区域一）独占妖王；
    // 水墨幽谷/沸火赤川改由本区独占稀有精怪压阵；妖王夜第5波传说妖王（白泽/饕餮）
    if (wave.boss) {
      if (this.opts.bossNight) {
        this.spawnQueue.push(this.makeLegendBoss(this.opts.bossId ?? currentBossId(0), delay + 3, wave.hpScale * nightHpMult))
      } else {
        const region = this.opts.region ?? 1
        const bossId = region === 1 ? 'yingzhao' : pickWaveEliteId(region)
        this.spawnQueue.push(this.makeElite(bossId, delay + 3, wave.hpScale, undefined, true))
      }
    }

    this.state.phase = 'fighting'

    // 温泉汤院 Lv.5 沸泉活络：每波开战时全体守卫回复 15% 生命
    if (facilityAbilityEnhanced(this.opts.facilities, 'hotSpring')) {
      for (const d of this.state.defenders) {
        if (d.dead) continue
        const heal = Math.round(d.maxHp * 0.15)
        if (d.hp < d.maxHp && heal > 0) {
          d.hp = Math.min(d.maxHp, d.hp + heal)
          this.float(d.x, 16, `沸泉+${heal}`, 'heal')
        }
      }
    }
  }

  private makeElite(yaoguaiId: string, delay: number, hpScale: number, prefix?: string, boss = false): BattleEnemy {
    const def = YAOGUAI_MAP[yaoguaiId]
    const scale = levelScale(this.opts.level)
    // 妖王夜：精英怪攻击也吃整体强化（hpScale 由调用方已乘）
    const nightAtkMult = this.opts.bossNight ? BOSS_NIGHT.atkScale : 1
    const hp = Math.round(def.hp * 1.5 * hpScale * scale.hp)
    // 野性难驯（V1.2.1）：稀有精英有概率桀骜不驯，本夜无法收服只能放归
    // （妖雾彩蛋是限时福利不参与；传说妖王另有专属保底公式不受影响）
    const wild = def.grade === 'rare' && prefix !== '妖雾' && Math.random() < RARE_WILD_RATE
    return {
      uid: uid('e'),
      kind: `elite:${yaoguaiId}`,
      name: prefix ? `${prefix}·${def.name}` : def.name,
      img: `/images/yaoguai/${def.id}.png`,
      element: def.element,
      hp,
      maxHp: hp,
      atk: Math.round(def.atk * (boss ? 0.85 : 1.1) * scale.atk * nightAtkMult),
      speed: boss ? 2.6 : 4.6,
      size: boss ? 74 : 64,
      x: -6,
      elite: true,
      yaoguaiId,
      uncapturable: wild,
      attackTimer: 0,
      stunnedUntil: -1,
      slowedUntil: -1,
      slowFactor: 1,
      charmedUntil: -1,
      markedUntil: -1,
      markBonus: 0,
      burningUntil: -1,
      burningDps: 0,
      dead: false,
      protectedFlag: false,
      captureFailCount: 0,
      lane: 50,
      spawnDelay: delay,
    }
  }

  /**
   * 传说妖王 BOSS（妖王夜第 5 波）：以 yaoguai.ts 白泽/饕餮数据为模板，
   * 参考英招 BOSS 生成式 ×1.3 强度（hp 系数同精英 1.5，atk 系数 0.85×1.3），
   * 大体型慢速，带专属周期技能（见 updateBossSkill）。
   */
  private makeLegendBoss(bossId: 'baize' | 'taotie', delay: number, hpScale: number): BattleEnemy {
    const def = YAOGUAI_MAP[bossId]
    const scale = levelScale(this.opts.level)
    const hp = Math.round(def.hp * 1.5 * hpScale * scale.hp)
    const boss: BattleEnemy = {
      uid: uid('e'),
      kind: `boss:${bossId}`,
      name: `妖王·${def.name}`,
      img: `/images/yaoguai/${def.id}.png`,
      element: def.element,
      hp,
      maxHp: hp,
      atk: Math.round(def.atk * 0.85 * 1.3 * scale.atk),
      speed: 2.2,
      size: bossId === 'taotie' ? 88 : 82,
      x: -6,
      elite: true,
      yaoguaiId: bossId,
      attackTimer: 0,
      stunnedUntil: -1,
      slowedUntil: -1,
      slowFactor: 1,
      charmedUntil: -1,
      markedUntil: -1,
      markBonus: 0,
      burningUntil: -1,
      burningDps: 0,
      dead: false,
      protectedFlag: false,
      captureFailCount: 0,
      lane: 50,
      spawnDelay: delay,
    }
    // 登记妖王技能计时（入场后 12-15 秒首次施放）
    this.bossUid = boss.uid
    this.bossSkillTimer = 0
    this.bossSkillCd = 12 + Math.random() * 3
    return boss
  }

  private updateSpawns(dt: number) {
    this.spawnTimer += dt
    const remaining: BattleEnemy[] = []
    for (const e of this.spawnQueue) {
      if (e.spawnDelay <= this.spawnTimer) {
        this.state.enemies.push(e)
      } else {
        remaining.push(e)
      }
    }
    this.spawnQueue = remaining
  }

  private checkWaveEnd() {
    if (this.state.enemies.length === 0 && this.spawnQueue.length === 0) {
      if (this.state.wave >= this.state.totalWaves) {
        this.state.phase = 'victory'
        this.float(50, 20, this.opts.bossNight ? '妖王退散！' : '守店成功！', 'skill')
        // 通关素材掉落（妖王夜 ×2 + 稀有妖丹 + 随机属性石）
        const drops = victoryMaterialDrops(this.opts.level)
        const mult = this.opts.bossNight ? 2 : 1
        for (const [id, n] of Object.entries(drops)) {
          this.addMaterial(id, n * mult)
        }
        if (this.opts.bossNight) {
          this.addMaterial('pill-rare', 1)
          const els: Element[] = ['metal', 'wood', 'water', 'fire', 'earth', 'light', 'dark']
          this.addMaterial(stoneIdFor(els[Math.floor(Math.random() * els.length)]), 1)
        }
      } else {
        this.state.wave += 1
        this.state.phase = 'prep'
        this.state.prepCountdown = 8
        this.refreshDefenders()
        const waveName = this.opts.bossNight ? `妖王亲卫 第 ${this.state.wave} 波` : `第 ${this.state.wave} 波`
        this.float(50, 30, `${waveName}来袭前·调整布阵`, 'skill')
      }
    }
    if (this.state.innHp <= 0 && this.state.phase === 'fighting') {
      this.state.innHp = 0
      this.state.phase = 'failed'
    }
  }

  // ---------- 敌人行为 ----------

  /** 客栈受击统一入口（含许愿台 Lv.3 神灵庇佑：血量<20% 时 2 秒无敌，每场一次） */
  private damageInn(dmg: number, lane: number, crit = false) {
    const now = this.state.elapsed
    const wishAltarLv3 = facilityAbilityActive(this.opts.facilities, 'wishAltar')
    if (wishAltarLv3 && !this.innShieldUsed && this.state.innHp > 0 && this.state.innHp / this.state.innMaxHp < 0.2) {
      this.innShieldUsed = true
      this.innShieldUntil = now + (facilityAbilityEnhanced(this.opts.facilities, 'wishAltar') ? 3 : 2)
      this.float(70, 12, '神灵庇佑！', 'heal')
    }
    if (this.innShieldUntil > now) {
      this.float(INN_X, lane, '庇佑', 'skill')
      return
    }
    this.state.innHp = Math.max(0, this.state.innHp - dmg)
    this.float(INN_X, lane, `-${dmg}`, crit ? 'crit' : 'damage')
  }

  private updateEnemies(dt: number) {
    for (const e of this.state.enemies) {
      if (e.dead) continue
      const now = this.state.elapsed

      // 灼烧伤害
      if (e.burningUntil > now && e.burningDps > 0) {
        this.damageEnemy(e, e.burningDps * dt, false, true)
      }
      if (e.dead) continue

      // 残血捕捉保护：停止一切伤害与行动
      if (e.elite && e.hp / e.maxHp <= PROTECT_HP_THRESHOLD) {
        e.protectedFlag = true
      }
      if (e.protectedFlag) continue

      const stunned = e.stunnedUntil > now
      const charmed = e.charmedUntil > now

      // 魅惑结束爆发伤害
      if (e.charmedUntil !== -1 && e.charmedUntil <= now && e.charmedUntil > now - dt) {
        // 刚结束魅惑
      }

      // 攻击逻辑：优先攻击身边防守妖怪，否则客栈
      // 野妖对守卫伤害打折（守卫克制野妖），对客栈建筑全额破坏
      const target = this.nearestDefender(e)
      if (!stunned && !charmed) {
        if (target && Math.abs(target.x - e.x) <= CELL * 1.1) {
          e.attackTimer += dt
          const interval = 1.5
          if (e.attackTimer >= interval) {
            e.attackTimer = 0
            this.damageDefender(target, Math.round(e.atk * 0.7), e)
          }
        } else if (e.x >= INN_X) {
          e.attackTimer += dt
          if (e.attackTimer >= 1.15) {
            e.attackTimer = 0
            this.damageInn(e.atk, e.lane)
            // 客栈受击震屏由 UI 层监听处理
          }
        } else {
          // 移动
          const slowed = e.slowedUntil > now
          e.x += e.speed * (slowed ? e.slowFactor : 1) * dt
        }
      }

      // 魅惑结束的结算伤害
      if (e.charmedUntil !== -1 && e.charmedUntil <= now) {
        const dmg = Math.round(e.maxHp * 0.08)
        e.charmedUntil = -1
        this.damageEnemy(e, dmg, false)
        this.float(e.x, e.lane, '魅惑爆发', 'skill')
      }
    }
    this.state.enemies = this.state.enemies.filter((e) => !e.dead)
  }

  private nearestDefender(e: BattleEnemy): BattleDefender | null {
    let best: BattleDefender | null = null
    let bestDist = Infinity
    for (const d of this.state.defenders) {
      if (d.dead) continue
      const dist = Math.abs(d.x - e.x)
      if (dist < bestDist) {
        bestDist = dist
        best = d
      }
    }
    return best && bestDist <= CELL * 1.1 ? best : null
  }

  // ---------- 妖王专属技能（妖王夜第 5 波 BOSS 周期施放） ----------

  /** 妖王技能计时：每 12-15 秒施放一次；眩晕/魅惑期间暂停，残血保护期不施放 */
  private updateBossSkill(dt: number) {
    if (!this.opts.bossNight || !this.bossUid) return
    const boss = this.state.enemies.find((e) => e.uid === this.bossUid && !e.dead)
    if (!boss || boss.protectedFlag) return
    const now = this.state.elapsed
    if (boss.stunnedUntil > now || boss.charmedUntil > now) return
    this.bossSkillTimer += dt
    if (this.bossSkillTimer < this.bossSkillCd) return
    this.bossSkillTimer = 0
    this.bossSkillCd = 12 + Math.random() * 3
    const def = boss.yaoguaiId != null ? YAOGUAI_MAP[boss.yaoguaiId] : undefined
    if (def?.skillEffect === 'insight') this.castBossInsight(boss)
    else if (def?.skillEffect === 'devour') this.castBossDevour(boss)
  }

  /** 白泽·万物洞察：全体守卫被标记（受伤害+15%持续4秒）+ 妖王自身回复 8% 最大血量 */
  private castBossInsight(boss: BattleEnemy) {
    const now = this.state.elapsed
    this.defenderVulnUntil = now + 4
    this.defenderVulnBonus = 0.15
    this.float(50, 20, BOSS_SKILL_TEXT.baize, 'skill')
    // 回复 8% 最大血量（上限截断，飘字展示实际回复量）
    const before = boss.hp
    boss.hp = Math.min(boss.maxHp, boss.hp + Math.round(boss.maxHp * 0.08))
    const healed = boss.hp - before
    if (healed > 0) this.float(boss.x, boss.lane, `+${healed}`, 'heal')
    for (const d of this.state.defenders) {
      if (!d.dead) this.float(d.x, 14, '易伤', 'skill')
    }
  }

  /** 饕餮·盛宴：对客栈 250% atk 重击 + 吞噬至多 2 只己方小怪（每只回复 6% 血量） */
  private castBossDevour(boss: BattleEnemy) {
    const dmg = Math.round(boss.atk * 2.5)
    this.float(50, 20, BOSS_SKILL_TEXT.taotie, 'skill')
    this.damageInn(dmg, boss.lane, true)
    // 吞噬己方小怪（非精英/非保护）转化为自身血量；无小怪可吞则不回血（清场反制点）
    const prey = this.state.enemies
      .filter((e) => !e.dead && !e.elite && !e.protectedFlag)
      .sort((a, b) => Math.abs(a.x - boss.x) - Math.abs(b.x - boss.x))
      .slice(0, 2)
    let heal = 0
    for (const p of prey) {
      p.dead = true
      heal += Math.round(boss.maxHp * 0.06)
      this.float(p.x, p.lane, '吞噬', 'skill')
    }
    if (heal > 0) {
      // 回复量上限截断，飘字展示实际回复量
      const before = boss.hp
      boss.hp = Math.min(boss.maxHp, boss.hp + heal)
      const healed = boss.hp - before
      if (healed > 0) this.float(boss.x, boss.lane, `+${healed}`, 'heal')
      this.state.enemies = this.state.enemies.filter((e) => !e.dead)
    }
  }

  // ---------- 防守妖怪行为 ----------

  private updateDefenders(dt: number) {
    const now = this.state.elapsed
    // 设施 Lv.3 能力开关
    const fac = this.opts.facilities
    const kitchenAbility = facilityAbilityActive(fac, 'kitchen')
    const kitchenEnhanced = facilityAbilityEnhanced(fac, 'kitchen')
    const guestRoomAbility = facilityAbilityActive(fac, 'guestRoom')
    const guestRoomEnhanced = facilityAbilityEnhanced(fac, 'guestRoom')
    const warehouseAbility = facilityAbilityActive(fac, 'warehouse')
    const warehouseEnhanced = facilityAbilityEnhanced(fac, 'warehouse')
    const smithyAbility = facilityAbilityActive(fac, 'smithy')
    const smithyEnhanced = facilityAbilityEnhanced(fac, 'smithy')
    const powerPoolAbility = facilityAbilityActive(fac, 'powerPool')
    const powerPoolEnhanced = facilityAbilityEnhanced(fac, 'powerPool')
    // 温泉汤院·汤泉回春：全体守卫每秒回复 0.15%×等级 最大生命（静默被动，不刷屏浮字）
    const springRegen = springRegenPerSec(fac.hotSpring ?? 0)
    if (springRegen > 0) {
      this.springTimer += dt
      if (this.springTimer >= 1) {
        this.springTimer = 0
        for (const sd of this.state.defenders) {
          if (sd.dead) continue
          const sheal = Math.round(sd.maxHp * springRegen)
          if (sheal > 0 && sd.hp < sd.maxHp) {
            sd.hp = Math.min(sd.maxHp, sd.hp + sheal)
          }
        }
      }
    }
    for (const d of this.state.defenders) {
      if (d.dead) continue
      const buffed = d.buffAtkUntil > now
      const atk = buffed ? d.atk * 1.25 : d.atk

      // 客房 Lv.3 舒适休憩：每 3 秒回复 2%（Lv.5 3%）最大生命
      if (guestRoomAbility) {
        d.regenTimer += dt
        if (d.regenTimer >= 3) {
          d.regenTimer = 0
          const pct = guestRoomEnhanced ? 0.03 : 0.02
          const heal = Math.round(d.maxHp * pct)
          if (d.hp < d.maxHp && heal > 0) {
            d.hp = Math.min(d.maxHp, d.hp + heal)
            this.float(d.x, 14, `+${heal}`, 'heal')
          }
        }
      }

      // 技能冷却
      d.skillTimer += dt
      const target = this.targetFor(d)
      if (d.skillTimer >= d.skillCd && target) {
        d.skillTimer = 0
        this.castSkill(d, target, atk)
        continue
      }

      // 普攻
      if (target) {
        d.attackTimer += dt
        // 妖力池 Lv.3 妖力涌动：击杀后 5 秒攻速 +30%（Lv.5 45%）；陆吾·天之九部独立攻速增益可叠加
        const speedBuffed = powerPoolAbility && d.atkSpeedBuffUntil > now
        const hasted = d.hasteUntil > now
        const interval =
          1 /
          (d.attackSpeed *
            (speedBuffed ? (powerPoolEnhanced ? 1.45 : 1.3) : 1) *
            (hasted ? d.hasteMult : 1))
        if (d.attackTimer >= interval) {
          d.attackTimer = 0
          const crit = Math.random() < d.critRate
          let dmg = atk * (crit ? 2 : 1)
          // 后厨 Lv.3 美食增益：首次造成伤害 ×1.5（Lv.5 ×1.75）
          if (kitchenAbility && !d.firstStrikeUsed) {
            d.firstStrikeUsed = true
            dmg *= kitchenEnhanced ? 1.75 : 1.5
            this.float(d.x, 10, '美食增益！', 'skill')
          }
          // 铁匠铺 Lv.3 利刃打磨：15% 概率双倍伤害（Lv.5 20%）
          if (smithyAbility && Math.random() < (smithyEnhanced ? 0.2 : 0.15)) {
            dmg *= 2
            this.float(d.x, 8, '利刃！', 'skill')
          }
          this.damageEnemy(target, Math.round(dmg), crit, false, d)
          // 仓库 Lv.3 陷阱布置：20% 概率额外眩晕 1 秒（Lv.5 25%）
          if (warehouseAbility && !target.dead && Math.random() < (warehouseEnhanced ? 0.25 : 0.2)) {
            target.stunnedUntil = Math.max(target.stunnedUntil, now + 1)
            this.float(target.x, target.lane - 10, '陷阱眩晕', 'skill')
          }
        }
      }
    }
  }

  /** 普攻目标：射程内最靠前（x最大）的敌人 */
  private targetFor(d: BattleDefender): BattleEnemy | null {
    let best: BattleEnemy | null = null
    for (const e of this.state.enemies) {
      if (e.dead || e.protectedFlag) continue
      if (Math.abs(e.x - d.x) <= d.range * CELL + 6) {
        if (!best || e.x > best.x) best = e
      }
    }
    return best
  }

  // ---------- 技能系统 ----------

  private castSkill(d: BattleDefender, target: BattleEnemy, atk: number) {
    const star = d.star
    const now = this.state.elapsed
    // ---- 设施联动：技能倍率（大堂·技能效果/妖力池·技能伤害）与大堂 Lv.3 热情服务范围加成 ----
    const hallAbility = facilityAbilityActive(this.opts.facilities, 'hall')
    const hallEnhanced = facilityAbilityEnhanced(this.opts.facilities, 'hall')
    const rangeMult = hallAbility ? (hallEnhanced ? 1.3 : 1.2) : 1
    const dmgAtk = atk * d.skillDmgMult
    this.float(d.x, 12 + d.slot * 6, d.skillName, 'skill')
    switch (d.skillEffect as SkillEffect) {
      case 'stun-aoe': {
        // 掘地冲击：范围眩晕+伤害（仓库·控制时长加成）
        const stun = (1 + 0.2 * (star - 1)) * d.ctrlMult
        for (const e of this.state.enemies) {
          if (e.dead || e.protectedFlag) continue
          if (Math.abs(e.x - d.x) <= CELL * 1.6 * rangeMult) {
            e.stunnedUntil = now + stun
            this.damageEnemy(e, Math.round(dmgAtk), false, false, d)
          }
        }
        break
      }
      case 'multi-shot': {
        // 投石连击
        const n = Math.min(3 + (star - 1), 5)
        const total = Math.round(dmgAtk * 0.6 * n)
        this.damageEnemy(target, total, false, false, d)
        this.float(target.x, target.lane - 8, `连击×${n}`, 'damage')
        break
      }
      case 'heal-aura': {
        // 祥瑞回血：全体友军治疗（大堂/药房·治疗效果加成）
        const healPct = (0.06 + 0.015 * (star - 1)) * d.healMult
        for (const ally of this.state.defenders) {
          if (ally.dead) continue
          const heal = Math.round(ally.maxHp * healPct)
          ally.hp = Math.min(ally.maxHp, ally.hp + heal)
          this.float(ally.x, 18, `+${heal}`, 'heal')
        }
        break
      }
      case 'shield': {
        // 龟甲护盾
        d.shieldUntil = now + 3 + 0.5 * (star - 1)
        this.float(d.x, 18, '护盾展开', 'skill')
        break
      }
      case 'dash-strike': {
        // 疾跑突袭：突进+击退
        const dmg = Math.round(dmgAtk * (1.5 + 0.2 * (star - 1)))
        this.damageEnemy(target, dmg, false, false, d)
        target.x = Math.max(0, target.x - 9)
        this.float(target.x, target.lane, '击退', 'skill')
        break
      }
      case 'claw-combo': {
        // 猫爪连击：多段+暴击
        const n = Math.min(4 + (star - 1), 6)
        const critRate = 0.2 + 0.05 * (star - 1)
        let total = 0
        for (let i = 0; i < n; i++) {
          const crit = Math.random() < critRate
          total += Math.round(dmgAtk * 0.4 * (crit ? 2 : 1))
        }
        this.damageEnemy(target, total, false, false, d)
        this.float(target.x, target.lane - 8, `猫爪×${n}`, 'damage')
        break
      }
      case 'water-bolt': {
        // 水弹喷射：伤害+减速（仓库·减速加成）
        const dmg = Math.round(dmgAtk * 1.2)
        this.damageEnemy(target, dmg, false, false, d)
        target.slowedUntil = now + 2
        const slowPct = d.ctrlMult
        target.slowFactor = Math.max(0.2, (0.7 - 0.05 * (star - 1)) / slowPct)
        this.float(target.x, target.lane, '减速', 'skill')
        break
      }
      case 'mark': {
        // 鹰眼锁定
        target.markedUntil = now + 3
        target.markBonus = 0.15 + 0.03 * (star - 1)
        this.float(target.x, target.lane, '锁定', 'skill')
        break
      }
      case 'charm': {
        // 魅惑幻术（仓库·控制时长加成）
        target.charmedUntil = now + (2 + 0.3 * (star - 1)) * d.ctrlMult
        this.float(target.x, target.lane, '魅惑', 'skill')
        break
      }
      case 'fire-rain': {
        // 烈焰焚天：区域灼烧（大堂 Lv.3 热情服务扩大范围）
        const dps = dmgAtk * (0.8 + 0.1 * (star - 1))
        const rangeCells = (1.2 + 0.2 * (star - 1)) * rangeMult
        for (const e of this.state.enemies) {
          if (e.dead || e.protectedFlag) continue
          if (Math.abs(e.x - target.x) <= rangeCells * CELL) {
            e.burningUntil = now + 3
            e.burningDps = dps
          }
        }
        this.float(target.x, target.lane, '烈焰焚天', 'skill')
        break
      }
      case 'charge-buff': {
        // 神威冲锋：爆发+击飞+团队增益
        const dmg = Math.round(dmgAtk * (2.5 + 0.3 * (star - 1)))
        this.damageEnemy(target, dmg, false, false, d)
        target.stunnedUntil = now + 1 * d.ctrlMult
        target.x = Math.max(0, target.x - 6)
        for (const ally of this.state.defenders) {
          ally.buffAtkUntil = now + 5
        }
        this.float(target.x, target.lane, '击飞！', 'skill')
        break
      }
      case 'insight': {
        // 万物洞察（白泽·守卫侧）：全体敌人易伤+全队回血（大堂·技能效果/治疗加成）
        const markBonus = 0.15 + 0.05 * (star - 1)
        for (const e of this.state.enemies) {
          if (e.dead || e.protectedFlag) continue
          e.markedUntil = now + 5
          e.markBonus = Math.max(e.markBonus, markBonus)
        }
        const healPct = (0.15 + 0.03 * (star - 1)) * d.healMult
        for (const ally of this.state.defenders) {
          if (ally.dead) continue
          const heal = Math.round(ally.maxHp * healPct)
          ally.hp = Math.min(ally.maxHp, ally.hp + heal)
          this.float(ally.x, 18, `+${heal}`, 'heal')
        }
        this.float(50, 24, '万物洞察', 'skill')
        break
      }
      case 'devour': {
        // 饕餮盛宴（饕餮·守卫侧）：范围吞噬伤害+自身回复（大堂范围加成）
        const dmg = Math.round(dmgAtk * (3 + 0.3 * (star - 1)))
        let hits = 0
        for (const e of this.state.enemies) {
          if (e.dead || e.protectedFlag) continue
          if (Math.abs(e.x - target.x) <= CELL * 1.5 * rangeMult) {
            this.damageEnemy(e, dmg, false, false, d)
            hits += 1
          }
        }
        const heal = Math.round(d.maxHp * ((0.3 + 0.08 * (star - 1)) * d.healMult))
        d.hp = Math.min(d.maxHp, d.hp + heal)
        this.float(d.x, 18, hits > 0 ? `盛宴+${heal}` : `+${heal}`, 'heal')
        this.float(50, 24, '饕餮盛宴', 'skill')
        break
      }
      case 'stone-shriek': {
        // 狲鸣裂石：穿透音波——主目标高伤+震退，身后最多2只(星级+)被音波穿透
        const mainDmg = Math.round(dmgAtk * (1.4 + 0.15 * (star - 1)))
        this.damageEnemy(target, mainDmg, false, false, d)
        target.x = Math.max(0, target.x - (5 + star))
        const pierce = Math.min(2 + (star - 1), 4)
        let pierced = 0
        const behind = this.state.enemies
          .filter((e) => !e.dead && !e.protectedFlag && e.uid !== target.uid && e.x <= target.x)
          .sort((a, b) => b.x - a.x)
        for (const e of behind) {
          if (pierced >= pierce) break
          this.damageEnemy(e, Math.round(dmgAtk * 0.6), false, false, d)
          pierced += 1
        }
        this.float(target.x, target.lane - 8, pierced > 0 ? `裂石×${pierced + 1}` : '裂石', 'damage')
        break
      }
      case 'ten-heal': {
        // 十身回春：按已损血量百分比群疗（残血救场，药房·治疗加成）
        const pct = (0.22 + 0.03 * (star - 1)) * d.healMult
        for (const ally of this.state.defenders) {
          if (ally.dead) continue
          const lost = ally.maxHp - ally.hp
          if (lost <= 0) continue
          const heal = Math.max(1, Math.round(lost * pct))
          ally.hp = Math.min(ally.maxHp, ally.hp + heal)
          this.float(ally.x, 18, `+${heal}`, 'heal')
        }
        this.float(d.x, 14, '十身回春', 'skill')
        break
      }
      case 'nine-domains': {
        // 天之九部：全队攻速增益（大堂·技能效果加成）+ 全体敌军减速威压
        const hasteBonus = 0.2 + 0.03 * (star - 1) + (d.skillDmgMult - 1) * 0.5
        for (const ally of this.state.defenders) {
          if (ally.dead) continue
          ally.hasteUntil = now + 6
          ally.hasteMult = Math.max(ally.hasteMult, 1 + hasteBonus)
          this.float(ally.x, 16, '九部庇佑', 'skill')
        }
        const slow = (0.25 + 0.03 * (star - 1)) * d.ctrlMult
        for (const e of this.state.enemies) {
          if (e.dead || e.protectedFlag) continue
          e.slowedUntil = now + 3
          e.slowFactor = Math.max(0.2, 1 - slow)
        }
        this.float(50, 24, '天之九部', 'skill')
        break
      }
      case 'swift-volley': {
        // 千岁神驰：连射神箭独立暴击 + 自身攻速增益持续4秒
        const n = Math.min(4 + (star - 1), 6)
        let total = 0
        for (let i = 0; i < n; i++) {
          const crit = Math.random() < d.critRate + 0.1
          total += Math.round(dmgAtk * 0.55 * (crit ? 2 : 1))
        }
        this.damageEnemy(target, total, false, false, d)
        d.hasteUntil = now + 4
        d.hasteMult = Math.max(d.hasteMult, 1 + 0.2 + 0.03 * (star - 1))
        this.float(target.x, target.lane - 8, `神驰×${n}`, 'damage')
        this.float(d.x, 14, '攻速提升！', 'skill')
        break
      }
      case 'ink-flood': {
        // 墨浪滔天（墨麟·V1.3）：墨浪席卷前路，范围多段伤害+减速（大堂范围加成；仓库·控制加成）
        const n = Math.min(3 + (star - 1), 5)
        const segDmg = Math.round(dmgAtk * 0.9)
        const rangeCells = (1.4 + 0.2 * (star - 1)) * rangeMult
        let hits = 0
        for (const e of this.state.enemies) {
          if (e.dead || e.protectedFlag) continue
          if (Math.abs(e.x - target.x) <= rangeCells * CELL) {
            this.damageEnemy(e, segDmg * n, false, false, d)
            e.slowedUntil = now + 2 * d.ctrlMult
            e.slowFactor = Math.max(0.2, (0.65 - 0.05 * (star - 1)) / d.ctrlMult)
            hits += 1
          }
        }
        this.float(target.x, target.lane - 8, hits > 1 ? `墨浪×${hits}妖` : '墨浪滔天', 'skill')
        break
      }
      case 'ink-stone': {
        // 砚山镇纸（砚灵·V1.3）：巨砚镇压——自身减伤+周围敌人减速压阵（大堂范围加成；仓库·控制加成）
        d.shieldUntil = now + 3 + 0.5 * (star - 1)
        const pressCells = (1.5 + 0.5 * (star - 1)) * rangeMult
        let pressed = 0
        for (const e of this.state.enemies) {
          if (e.dead || e.protectedFlag) continue
          if (Math.abs(e.x - d.x) <= pressCells * CELL) {
            e.slowedUntil = now + 3 * d.ctrlMult
            e.slowFactor = Math.max(0.2, (0.6 - 0.05 * (star - 1)) / d.ctrlMult)
            pressed += 1
          }
        }
        this.float(d.x, 12, pressed > 0 ? `镇纸压${pressed}妖` : '镇纸', 'skill')
        break
      }
    }
  }

  // ---------- 伤害结算 ----------

  /** 素材掉落入账（本场结算随 BattleResult 入仓库） */
  private addMaterial(id: string, n: number) {
    if (n <= 0) return
    this.state.materialsGained[id] = (this.state.materialsGained[id] ?? 0) + n
  }

  private damageEnemy(e: BattleEnemy, dmg: number, crit = false, silent = false, attacker?: BattleDefender) {
    if (e.dead || e.protectedFlag) return
    const now = this.state.elapsed
    let final = dmg
    if (e.markedUntil > now) final *= 1 + e.markBonus
    // ---- 属性克制：克 +30%（属性石每级+5%）；被克 -20% ----
    const rel = attacker ? elementRelation(attacker.element, e.element) : 'none'
    if (rel !== 'none') {
      final *= counterDamageMult(attacker!.element, e.element, this.opts.elementBoost ?? EMPTY_BOOST)
    }
    final = Math.round(final)
    e.hp -= final
    if (!silent) {
      const suffix = rel === 'counter' ? ' 克!' : rel === 'countered' ? ' 被克' : ''
      this.float(e.x, e.lane, `-${final}${suffix}`, rel === 'counter' ? 'crit' : crit ? 'crit' : 'damage')
    }
    // 精英怪触发捕捉保护
    if (e.elite && e.hp / e.maxHp <= PROTECT_HP_THRESHOLD) {
      e.hp = Math.max(e.hp, 1)
      e.protectedFlag = true
      this.float(e.x, e.lane, e.uncapturable ? '野性难驯！' : '可收服！', 'capture')
    }
    if (e.hp <= 0) {
      e.hp = 0
      e.dead = true
      this.state.killCount += 1
      const gold = this.goldForKill(e)
      this.state.waveGold += gold
      this.float(e.x, e.lane, `+${gold}金`, 'gold')
      // 击杀素材掉落：精英妖丹 + 野妖随机建材
      if (e.kind.startsWith('elite:')) {
        this.addMaterial('pill-normal', 1)
      } else if (e.kind.startsWith('boss:')) {
        this.addMaterial('pill-normal', 2)
        this.addMaterial('pill-rare', Math.random() < 0.5 ? 1 : 0)
      } else {
        const roll = Math.random()
        if (roll < 0.08) this.addMaterial('wood', 1)
        else if (roll < 0.15) this.addMaterial('stone', 1)
        else if (roll < 0.2) this.addMaterial('iron', 1)
        else if (roll < 0.23) this.addMaterial(['meat', 'rice', 'salt'][Math.floor(Math.random() * 3)], 1)
      }
      // 妖力池 Lv.3 妖力涌动：击杀者 5 秒攻速 +30%（Lv.5 45%）
      if (attacker && facilityAbilityActive(this.opts.facilities, 'powerPool')) {
        attacker.atkSpeedBuffUntil = now + 5
      }
    }
  }

  private goldForKill(e: BattleEnemy): number {
    const scale = 1 + (this.opts.level - 1) * 0.25
    if (e.kind.startsWith('boss:')) return Math.round(200 * scale) // 传说妖王首级悬赏
    if (e.kind.startsWith('elite:')) return Math.round(80 * scale)
    if (e.kind === 'boss') return Math.round(150 * scale)
    // kind 保存原始类型（区域二仅改显示名），击杀金币不受改名影响
    if (e.kind === '山怪') return Math.round(25 * scale)
    if (e.kind === '精怪') return Math.round(12 * scale)
    return Math.round(8 * scale)
  }

  private damageDefender(d: BattleDefender, dmg: number, attacker?: BattleEnemy) {
    const now = this.state.elapsed
    let final = dmg
    if (d.shieldUntil > now)
      final *= d.skillEffect === 'ink-stone' ? 0.6 - 0.05 * (d.star - 1) : 0.5 - 0.05 * (d.star - 1)
    // 白泽·万物洞察：全体守卫易伤窗口
    if (this.defenderVulnUntil > now) final *= 1 + this.defenderVulnBonus
    // 客房·防御减伤（等级+设施，每点 0.4%，上限 50%）
    final *= 1 - d.defReduce
    // ---- 属性克制（敌攻我）：被克 -20%，克制敌人反击时不受加成 ----
    final *= counterDamageMult(attacker?.element ?? null, d.element, EMPTY_BOOST)
    final = Math.max(1, Math.round(final))
    d.hp -= final
    this.float(d.x, 18, `-${final}`, 'damage')
    if (d.hp <= 0) {
      // 药房 Lv.3 丹药储备：首次致死免死并回 30%（Lv.5 45%）生命
      if (facilityAbilityActive(this.opts.facilities, 'pharmacy') && !d.reviveUsed) {
        d.reviveUsed = true
        const pct = facilityAbilityEnhanced(this.opts.facilities, 'pharmacy') ? 0.45 : 0.3
        d.hp = Math.max(1, Math.round(d.maxHp * pct))
        this.float(d.x, 14, '丹药续命！', 'heal')
        return
      }
      d.hp = 0
      d.dead = true
      this.float(d.x, 18, `${d.name} 退场`, 'skill')
    }
  }

  private float(x: number, y: number, text: string, type: FloatText['type']) {
    this.floatId += 1
    this.state.floatTexts.push({
      id: this.floatId,
      x,
      y,
      text,
      type,
      born: this.state.elapsed,
    })
  }

  // ---------- 捉妖系统 ----------

  /** 计算当前捕捉概率（0-1）；野性难驯目标恒为 0；netBonus 为缚妖网加成（V1.1） */
  captureRate(e: BattleEnemy, adBonus: boolean, attempts: number, netBonus = 0): number {
    if (!e.elite || !e.yaoguaiId) return 0
    if (e.uncapturable) return 0
    const hpPct = Math.max(e.hp / e.maxHp, PROTECT_HP_THRESHOLD)
    if (hpPct > CAPTURE_HP_THRESHOLD) return 0
    // 传说妖王（妖王夜 BOSS）：专用公式——基础 5% + 每次失败 +15%，保底 5 次必成
    const def = YAOGUAI_MAP[e.yaoguaiId]
    if (def?.grade === 'legend') {
      if (attempts >= BOSS_NIGHT.pityAttempts) return 1
      let bossRate = BOSS_NIGHT.captureBaseRate + attempts * BOSS_NIGHT.attemptBonusRate
      if (adBonus) bossRate += AD_CAPTURE_BONUS
      bossRate += netBonus
      return Math.min(bossRate, 1)
    }
    // 血量越低概率越高：30%血→10%，5%血→~60%
    const t = (CAPTURE_HP_THRESHOLD - hpPct) / (CAPTURE_HP_THRESHOLD - PROTECT_HP_THRESHOLD)
    let rate = CAPTURE_RATE.min + t * (CAPTURE_RATE.max - CAPTURE_RATE.min)
    // 累计挑战加成
    if (attempts >= 5) return 1
    if (attempts >= 3) rate += 0.1
    if (adBonus) rate += 0.2
    rate += netBonus
    return Math.min(rate, 0.95)
  }

  /**
   * 尝试收服
   * @returns 成功与否与概率
   */
  tryCapture(uidToCapture: string, adBonus: boolean, attempts: number, netBonus = 0): { success: boolean; rate: number } {
    const e = this.state.enemies.find((x) => x.uid === uidToCapture && !x.dead)
    if (!e || !e.elite || !e.yaoguaiId) return { success: false, rate: 0 }
    if (e.hp / e.maxHp > CAPTURE_HP_THRESHOLD) return { success: false, rate: 0 }
    // 野性难驯：本夜不可收服（不计挑战次数，放归是唯一出路）
    if (e.uncapturable) {
      this.float(e.x, e.lane, '野性难驯，无法收服', 'damage')
      this.emit()
      return { success: false, rate: 0 }
    }
    const rate = this.captureRate(e, adBonus, attempts, netBonus)
    e.captureFailCount += 1
    const success = Math.random() < rate
    if (success) {
      e.dead = true
      this.state.capturedThisBattle.push(e.yaoguaiId)
      this.float(e.x, e.lane, `收服 ${e.name}！`, 'capture')
      // 收服奖励掉落：妖丹×2 + 该妖怪属性对应的属性石×1（PRD 捉妖奖励）
      this.addMaterial('pill-normal', 2)
      const yaoDef = YAOGUAI_MAP[e.yaoguaiId]
      if (yaoDef?.element) this.addMaterial(stoneIdFor(yaoDef.element), 1)
    } else {
      this.float(e.x, e.lane, '收服失败…', 'damage')
    }
    this.state.enemies = this.state.enemies.filter((x) => !x.dead)
    this.emit()
    return { success, rate }
  }

  /** 放归（放弃捕捉，转为击杀奖励） */
  release(uidToRelease: string) {
    const e = this.state.enemies.find((x) => x.uid === uidToRelease)
    if (!e) return
    e.hp = 0
    e.dead = true
    const gold = this.goldForKill(e)
    this.state.waveGold += gold
    this.state.killCount += 1
    this.float(e.x, e.lane, `放归 +${gold}金`, 'gold')
    this.state.enemies = this.state.enemies.filter((x) => !x.dead)
    this.emit()
  }

  /** 广告客栈修复：回满血（战斗中可用） */
  repairInn() {
    this.state.innHp = this.state.innMaxHp
    this.float(70, 15, '客栈修复！', 'heal')
    this.emit()
  }
}
