'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BattleEngine, type LineupEntry } from '@/game/engine'
import type { BattleEnemy, BattleResult } from '@/game/types'
import { ATTEMPT_BONUS_STEP, BOSS_NIGHT, BOSS_NIGHT_WAVES, BOSS_WAVE_STAMINA_COST, CAPTURE_GEM_COST, CAPTURE_HP_THRESHOLD, CAPTURE_NET, PITY_ATTEMPTS, SLOTS, VICTORY_GOLD_PER_LEVEL, WAVES, WAVE_STAMINA_COST, battleExpGain, currentBossId, levelCapForStar, maxSlotsForInn, pickNightBuffs, regionDef, slotUnlockAt, staminaTier, victoryGems } from '@/game/config'
import type { NightBuff } from '@/game/config'
import type { NightEvent } from '@/game/types'
import { sfx } from '@/game/audio'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import { useGameStore } from '@/game/store'
import { trackEvent } from '@/game/cloud'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AdDialog } from './AdDialog'
import { BattleField } from './BattleField'
import { CaptureSuccessDialog } from './CaptureSuccessDialog'
import { LineupBar } from './LineupBar'
import { AnimNumber, ConfigIcon, GemIcon, GoldIcon, HpBar, YaoAvatar } from './shared'
import { cn } from '@/lib/utils'

/** 夜战 HUD 漆木按钮（与白天 ui-wood 同调） */
const HUD_BTN =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#FFE9B8]/18 bg-black/30 text-[#FFE9B8] transition active:scale-95 disabled:opacity-40'

/** 夜战信息芯片（墨色 / 旧金描边） */
const HUD_CHIP =
  'shrink-0 rounded-full border border-[#E8B84B]/35 bg-black/35 px-2 py-1 text-[10px] font-bold tabular-nums text-[#FFE9B8]'

// ============ 夜晚塔防 · 夜战主容器 ============
// 状态机：prep（布阵倒计时+LineupBar）→ fighting（实时渲染+捕捉流）
//        → victory / failed（停 1.2s 展示后 onExit 结算）
// 引擎驱动：useSyncExternalStore 订阅 BattleEngine，绝不复制引擎状态。

export interface NightScreenProps {
  level: number
  /** 战斗结束回调；null = 玩家主动退出（当前主动退出走半金结算对象，见 confirmExit） */
  onExit: (result: BattleResult | null) => void
  /** 妖王夜模式（V1.1 传说妖王）：5 波妖王亲卫 + 第 5 波传说妖王 BOSS，胜利奖励 ×2 */
  bossNight?: boolean
  /** 战斗区域（V1.2 世界地图）：2 = 水墨幽谷（水墨场景/野妖皮肤/奖励 ×1.35） / 3 = 沸火赤川（火色场景/野妖皮肤/奖励 ×1.8） */
  region?: 1 | 2 | 3
}

export function NightScreen({ level, onExit, bossNight, region = 1 }: NightScreenProps) {
  // 夜战含随机事件（妖雾/刷怪），SSR 首帧仅渲染占位，水合完成后再建引擎，避免水合不一致。
  // 用 useSyncExternalStore 的 server/client 快照差探测挂载，无需 setState-in-effect。
  const mounted = useSyncExternalStore(emptySubscribe, getTrue, getFalse)
  if (!mounted) {
    return (
      <div
        className={cn(
          'mx-auto flex h-dvh w-full max-w-[480px] flex-col items-center justify-center text-[#E6DCC8]',
          bossNight
            ? 'bg-gradient-to-b from-[#1a060c] to-[#2e0a14]'
            : region === 2
              ? 'bg-gradient-to-b from-[#1a1816] to-[#2a2620]'
              : region === 3
                ? 'bg-gradient-to-b from-[#1c0d08] to-[#33140b]'
                : 'bg-gradient-to-b from-[#1C1915] to-[#2C241C]'
        )}
      >
        <div className="ui-wood rounded-2xl px-6 py-4 text-center">
          <p className="font-display animate-pulse text-sm tracking-[0.3em] text-[#FFE9B8]">
            {bossNight
              ? '血月高悬，妖王压境…'
              : region === 2
                ? '谷雾如墨，笔锋藏杀…'
                : region === 3
                  ? '地脉沸腾，火魅扑面…'
                  : '夜幕降临，妖影蠢动…'}
          </p>
        </div>
      </div>
    )
  }
  return <NightBattle level={level} onExit={onExit} bossNight={bossNight} region={region} />
}

// ---------- 内部实现 ----------

type LineupSlots = Array<LineupEntry | null>
const EMPTY_LINEUP: LineupSlots = Array.from({ length: 6 }, () => null)
const EMPTY_UID_SET: ReadonlySet<string> = new Set()

// 挂载探测用空订阅（useSyncExternalStore 惯用法）
const emptySubscribe = (): (() => void) => () => undefined
const getTrue = (): boolean => true
const getFalse = (): boolean => false

/** 可捕捉判定：精英怪且血量已入 30% 捕捉窗口 */
function isCapturableEnemy(e: BattleEnemy): boolean {
  return e.elite && !!e.yaoguaiId && !e.dead && e.hp / e.maxHp <= CAPTURE_HP_THRESHOLD
}

function NightBattle({ level, onExit, bossNight = false, region = 1 }: NightScreenProps) {
  // ---- 妖王（V1.1）：bossWins 偶数→白泽 / 奇数→饕餮，入场时锁定本夜妖王 ----
  const bossWins = useGameStore((s) => s.stats.bossWins)
  const bossDef = bossNight ? YAOGUAI_MAP[currentBossId(bossWins)] : null
  // ---- 站位扩容：前 4 格基础，第 5/6 格随客栈等级解锁（养成↔塔防联动） ----
  const innLevel = useGameStore((s) => s.innLevel)
  const maxSlots = maxSlotsForInn(innLevel)

  // ---- 引擎（单次创建，prep 阶段 setLineup 更新阵容） ----
  const engineRef = useRef<BattleEngine | null>(null)
  if (!engineRef.current) {
    const s = useGameStore.getState()
    const bonus = s.jobBonus()
    engineRef.current = new BattleEngine({
      level,
      lineup: [], // 初始空，prep 阶段由玩家布阵
      innMaxHp: Math.round(250 * (1 + bonus.innHpRate / 100)),
      rareBonus: bonus.rareRate / 100,
      // 设施↔塔防联动：八大设施等级快照（对应定位妖怪获得属性加成与 Lv.3 特殊能力）
      facilities: s.facilities,
      bossNight,
      region,
      bossId: bossNight ? currentBossId(s.stats.bossWins) : undefined,
      maxSlots: maxSlotsForInn(s.innLevel),
      // 属性石强化等级（克制伤害 +5%/级）
      elementBoost: s.elementBoost,
    })
  }
  const engine = engineRef.current
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot)

  // ---- store 订阅（派生数据仍以 getState 读取，避免每帧重算） ----
  const owned = useGameStore((s) => s.owned)
  const capturedMap = useGameStore((s) => s.captured)
  // 收服耗贃灵石（V1.3.1）：订阅灵石余额，供按钮禁用与扣费校验
  const gems = useGameStore((s) => s.gems ?? 0)
  // 缚妖网（V1.1 道具）：库存订阅 + 本场生效标记
  const netStock = useGameStore((s) => s.materials?.['capture-net'] ?? 0)
  const [netBuffed, setNetBuffed] = useState(false)

  // ---- 本地 UI 状态 ----
  const [lineup, setLineup] = useState<LineupSlots>(EMPTY_LINEUP)
  /** 槽位吸附式布阵：当前打开就地菜单的站位（空位=上阵菜单 / 已占=守卫浮窗），null=关闭 */
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [repairAdOpen, setRepairAdOpen] = useState(false)
  const [captureAdOpen, setCaptureAdOpen] = useState(false)
  const [captureSuccessId, setCaptureSuccessId] = useState<string | null>(null)
  const [captureUid, setCaptureUid] = useState<string | null>(null)
  const [adBuffUids, setAdBuffUids] = useState<ReadonlySet<string>>(EMPTY_UID_SET)
  const [fogBannerVisible, setFogBannerVisible] = useState(engine.state.fogTriggered)
  /** 妖王降临横幅（妖王夜入场 3 秒） */
  const [bossBannerVisible, setBossBannerVisible] = useState(bossNight)
  /** 移驻横幅（区域二/三入场 3 秒） */
  const [regionBannerVisible, setRegionBannerVisible] = useState(!bossNight && region !== 1)
  const pausedByDialogRef = useRef(false)

  // ---- 备战增益三选一（肉鸽钩子）：prep 阶段弹出，选一注入引擎；广告可换一批一次 ----
  const [buffOffer, setBuffOffer] = useState<NightBuff[] | null>(() => pickNightBuffs(3))
  const [buffChosen, setBuffChosen] = useState(false)
  const [buffRerollOpen, setBuffRerollOpen] = useState(false)
  const buffRerollUsedRef = useRef(false)
  const buffOpen = !buffChosen && buffOffer !== null && state.phase === 'prep'

  // ---- toast（带自动消失；项目 Toaster 移除延迟极长，需显式 duration） ----
  const { toast } = useToast()
  const notify = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, duration: 2800 })
    },
    [toast]
  )

  const handlePickBuff = useCallback(
    (b: NightBuff) => {
      engine.applyBuff(b.effect)
      sfx.play('claim')
      notify(`✦ 增益生效：${b.name}`, b.desc)
      setBuffChosen(true)
    },
    [engine, notify]
  )
  const handleBuffRerollReward = useCallback(() => {
    buffRerollUsedRef.current = true
    setBuffOffer(pickNightBuffs(3))
    notify('已换一批增益', '重新挑选今晚的备战增益')
  }, [notify])

  // ---- 波间事件三选一：interlude 相位弹出，选完自动开下一波 ----
  const handlePickEvent = useCallback(
    (idx: number) => {
      sfx.play('claim')
      engine.pickEvent(idx)
    },
    [engine]
  )

  // ---- 引擎生命周期 ----
  useEffect(() => {
    engine.start()
    return () => engine.destroy()
  }, [engine])

  // ---- 布阵同步（仅 prep 阶段生效；携带当前体力，战斗引擎据此折算疲惫/力竭 debuff） ----
  useEffect(() => {
    if (engine.state.phase !== 'prep') return
    const store = useGameStore.getState()
    engine.setLineup(
      lineup
        .filter((l): l is LineupEntry => l !== null)
        .map((l) => ({
          ...l,
          stamina: store.owned[l.yaoguaiId]?.stamina ?? 100,
          skillLevel: store.owned[l.yaoguaiId]?.skillLevel ?? 1,
        }))
    )
  }, [lineup, engine])

  // ---- 防呆保底：倒计时临结束仍空阵 → 自动上阵（新手/挂机党友好；虚脱妖怪不可上阵，体力充沛者优先） ----
  const autoFilledRef = useRef(false)
  useEffect(() => {
    if (state.phase !== 'prep' || autoFilledRef.current) return
    if (state.prepCountdown > 1.6) return
    if (lineup.some((l) => l !== null)) return
    const ids = Object.entries(useGameStore.getState().owned)
      .filter(([, o]) => o.count > 0 && staminaTier(o.stamina ?? 100).battleOk)
      .map(([id, o]) => ({
        id,
        star: o.star,
        level: o.level ?? 1,
        stamina: o.stamina ?? 100,
        skillLevel: o.skillLevel ?? 1,
      }))
    if (ids.length === 0) {
      notify('💤 全体妖怪体力虚脱', '可先用体力药水或看广告恢复体力')
      autoFilledRef.current = true
      return
    }
    const priority: Record<string, number> = {
      tank: 0,
      allround: 1,
      healer: 2,
      mage: 3,
      controller: 4,
      ranged: 5,
      assassin: 6,
      support: 7,
    }
    ids.sort(
      (a, b) =>
        (priority[YAOGUAI_MAP[a.id]?.nightRole ?? 'support'] ?? 9) -
        (priority[YAOGUAI_MAP[b.id]?.nightRole ?? 'support'] ?? 9)
    )
    autoFilledRef.current = true
    setLineup(
      ids.slice(0, maxSlots).map((entry, i) => ({
        yaoguaiId: entry.id,
        star: entry.star,
        level: entry.level,
        slot: i,
        stamina: entry.stamina,
        skillLevel: entry.skillLevel,
      }))
    )
    notify('⏰ 时间到！已自动布阵', '下次可在倒计时内自行调整站位')
  }, [state.phase, state.prepCountdown, lineup, notify, maxSlots])

  // ---- 妖雾横幅：入场展示 3 秒 ----
  useEffect(() => {
    if (!fogBannerVisible) return
    const t = setTimeout(() => setFogBannerVisible(false), 3000)
    return () => clearTimeout(t)
  }, [fogBannerVisible])

  // ---- 妖王降临横幅：入场展示 3 秒 ----
  useEffect(() => {
    if (!bossBannerVisible) return
    const t = setTimeout(() => setBossBannerVisible(false), 3000)
    return () => clearTimeout(t)
  }, [bossBannerVisible])

  // ---- 移驻横幅：入场展示 3 秒 ----
  useEffect(() => {
    if (!regionBannerVisible) return
    const t = setTimeout(() => setRegionBannerVisible(false), 3000)
    return () => clearTimeout(t)
  }, [regionBannerVisible])

  // ---- 夜战体力消耗：完成一波全阵容各扣 5 点，BOSS 波 15 点（PRD 第 9 节） ----
  const waveRef = useRef(1)
  useEffect(() => {
    if (state.wave > waveRef.current) {
      const finished = waveRef.current
      const waves = bossNight ? BOSS_NIGHT_WAVES : WAVES
      const isBoss = !!waves[finished - 1]?.boss
      const ids = engine.lineup.map((l) => l.yaoguaiId)
      useGameStore.getState().drainBattleStamina(ids, isBoss ? BOSS_WAVE_STAMINA_COST : WAVE_STAMINA_COST)
      waveRef.current = state.wave
    }
  }, [state.wave, engine, bossNight])

  // ---- 胜负结算：停 1.2s 让玩家看清画面再回调 ----
  // 仅依赖 phase（奖励数值在切换瞬间冻结快照），避免父级重渲染导致计时器被清
  useEffect(() => {
    if (state.phase !== 'victory' && state.phase !== 'failed') return
    const victory = state.phase === 'victory'
    const wave = state.wave
    const waveGold = state.waveGold
    const captured = [...state.capturedThisBattle]
    const materialsGained = { ...state.materialsGained }
    // 胜利时最后一波（BOSS 波）体力消耗入账
    if (victory) {
      const ids = engine.lineup.map((l) => l.yaoguaiId)
      useGameStore.getState().drainBattleStamina(ids, BOSS_WAVE_STAMINA_COST)
    }
    // 参战妖怪经验（未满级者获得，快照冻结）
    const expPer = battleExpGain(wave, victory, bossNight)
    const expGained: Record<string, number> = {}
    for (const entry of engine.lineup) {
      const o = useGameStore.getState().owned[entry.yaoguaiId]
      if (!o || o.level >= levelCapForStar(o.star)) continue
      expGained[entry.yaoguaiId] = expPer
    }
    const timer = setTimeout(() => {
      // 区域二（水墨幽谷）通关奖励 ×1.35 / 区域三（沸火赤川）×1.8（与妖王夜 ×2 同叠加位；妖王夜固定区域一）
      const regMult = !bossNight && region !== 1 ? regionDef(region).rewardMult : 1
      // 胜利基础灵石（V1.2.1 经济回调：2 + level/2）与金币尾款（每级 150）
      const baseGems = victoryGems(level)
      onExit({
        victory,
        waveReached: wave,
        // 妖王夜胜利：沿用现有结算公式整体 × rewardMult（gold/gems/tickets 全×2）；失败半金照旧
        gold: victory
          ? bossNight
            ? Math.round((waveGold + VICTORY_GOLD_PER_LEVEL * level) * BOSS_NIGHT.rewardMult)
            : Math.round((waveGold + VICTORY_GOLD_PER_LEVEL * level) * regMult)
          : Math.floor(waveGold * 0.5) + 50,
        gems: victory
          ? bossNight
            ? Math.round(baseGems * BOSS_NIGHT.rewardMult)
            : Math.round(baseGems * regMult)
          : 0,
        tickets: victory ? (bossNight ? 1 * BOSS_NIGHT.rewardMult : 1) : 0,
        captured,
        bossNight: bossNight || undefined,
        expGained: Object.keys(expGained).length > 0 ? expGained : undefined,
        materialsGained: Object.keys(materialsGained).length > 0 ? materialsGained : undefined,
      })
    }, 1200)
    return () => clearTimeout(timer)
    // 仅依赖 phase：结算值在切换瞬间冻结快照，避免父级重渲染重置计时器
  }, [state.phase])

  // ---- 弹窗期间自动暂停（广告/收服庆祝/撤退确认），关闭后恢复原速 ----
  const lockPause = useCallback(
    (lock: boolean) => {
      if (lock) {
        if (!engine.state.paused) {
          engine.togglePause()
          pausedByDialogRef.current = true
        }
      } else {
        if (pausedByDialogRef.current && engine.state.paused) engine.togglePause()
        pausedByDialogRef.current = false
      }
    },
    [engine]
  )

  useEffect(() => lockPause(exitOpen), [exitOpen, lockPause])
  useEffect(() => lockPause(repairAdOpen), [repairAdOpen, lockPause])
  useEffect(() => lockPause(captureAdOpen), [captureAdOpen, lockPause])
  useEffect(() => lockPause(captureSuccessId !== null), [captureSuccessId, lockPause])
  useEffect(() => lockPause(buffOpen || buffRerollOpen), [buffOpen, buffRerollOpen, lockPause])

  // ---- 捕捉目标（多个可捕捉精英时点击战场切换） ----
  const capturables = useMemo(
    () => (state.phase === 'fighting' ? state.enemies.filter(isCapturableEnemy) : []),
    [state.phase, state.enemies]
  )
  const captureTarget = useMemo(() => {
    if (capturables.length === 0) return null
    return capturables.find((e) => e.uid === captureUid) ?? capturables[0]
  }, [capturables, captureUid])

  const targetYaoguaiId = captureTarget?.yaoguaiId ?? null
  const attempts = targetYaoguaiId != null ? capturedMap[targetYaoguaiId] ?? 0 : 0
  const adBuffed = captureTarget != null && adBuffUids.has(captureTarget.uid)
  // 缚妖网加成（V1.1）：本场夜战全体收服目标生效
  const netBonus = netBuffed ? CAPTURE_NET.bonus : 0
  const captureRate = captureTarget != null ? engine.captureRate(captureTarget, adBuffed, attempts, netBonus) : 0
  /** 传说妖王目标：专用捕捉文案（基础5% / 每败+15% / 5次保底） */
  const legendTarget = targetYaoguaiId != null && YAOGUAI_MAP[targetYaoguaiId]?.grade === 'legend'
  /** 野性难驯目标：本夜无法收服，只能放归（V1.2.1） */
  const wildTarget = captureTarget?.uncapturable === true
  /** 收服单次耗费灵石（V1.3.1）：精英 5 / 传说妖王 20，余额不足时按钮置灰 */
  const captureGemCost = legendTarget ? CAPTURE_GEM_COST.boss : CAPTURE_GEM_COST.normal
  const gemsTooLow = !wildTarget && gems < captureGemCost

  // ---- 捕捉窗口开启提示音（0→1 只精英进入窗口时） ----
  const prevCapturableCount = useRef(0)
  useEffect(() => {
    if (capturables.length > prevCapturableCount.current) {
      sfx.play('captureWindow')
    }
    prevCapturableCount.current = capturables.length
  }, [capturables.length])

  // ---- 张开缚妖网（V1.1 道具）：本场夜战收服成功率 +15%，一场只能张一次 ----
  const handleUseNet = useCallback(() => {
    const res = useGameStore.getState().consumeCaptureNet()
    notify(res.message)
    if (res.ok) {
      sfx.play('claim')
      setNetBuffed(true)
    }
  }, [notify])

  // ---- 收服（核心闭环；V1.3.1 起每次尝试耗费客栈灵石） ----
  const handleCaptureClick = useCallback(() => {
    const e = captureTarget
    if (!e || !e.yaoguaiId) return
    const st = useGameStore.getState()
    const legend = YAOGUAI_MAP[e.yaoguaiId]?.grade === 'legend'
    const gemCost = legend ? CAPTURE_GEM_COST.boss : CAPTURE_GEM_COST.normal
    if ((st.gems ?? 0) < gemCost) {
      notify(`灵石不足：每次收服尝试耗费 ${gemCost} 灵石`, '可看广告领灵石，或等客栈产出后再来')
      return
    }
    const prevAttempts = st.captured[e.yaoguaiId] ?? 0
    const adBuff = adBuffUids.has(e.uid)
    st.addGems(-gemCost) // 无论成败均计一次尝试费用
    const result = engine.tryCapture(e.uid, adBuff, prevAttempts, netBuffed ? CAPTURE_NET.bonus : 0)
    if (!result.success && result.rate <= 0) {
      st.addGems(gemCost) // 目标已失效（不在窗口），退还费用
      return
    }
    useGameStore.getState().recordCaptureAttempt(e.yaoguaiId) // 成败都记次数（加成/保底）
    trackEvent('capture', {
      yaoguaiId: e.yaoguaiId,
      grade: YAOGUAI_MAP[e.yaoguaiId]?.grade,
      success: result.success,
      attempts: prevAttempts + 1,
      adBonus: adBuff,
      bossNight: !!bossNight,
      netBuff: netBuffed,
    })
    if (result.success) {
      sfx.play('captureSuccess')
      useGameStore.getState().addCaptured(e.yaoguaiId)
      setCaptureSuccessId(e.yaoguaiId)
      setAdBuffUids((prev) => {
        if (!prev.has(e.uid)) return prev
        const next = new Set(prev)
        next.delete(e.uid)
        return next
      })
      setCaptureUid(null)
    } else {
      sfx.play('captureFail')
      const after = prevAttempts + 1
      let hint = '血量越低成功率越高，再压低些血量'
      if (legend) {
        hint =
          after >= BOSS_NIGHT.pityAttempts
            ? '保底已达成：下一次必定收服！'
            : `妖王桀骜难驯：每次失败永久+${Math.round(BOSS_NIGHT.attemptBonusRate * 100)}%，${BOSS_NIGHT.pityAttempts}次保底`
      } else if (after >= PITY_ATTEMPTS) hint = '保底已达成：下一次必定收服！'
      else if (after >= ATTEMPT_BONUS_STEP) hint = '累计挑战加成已提升（+10%）'
      notify('差一点就收服了！妖怪没有逃跑，再试一次', hint)
    }
  }, [captureTarget, engine, adBuffUids, notify, bossNight, gems])

  const handleRelease = useCallback(
    (enemy: BattleEnemy) => {
      sfx.play('release')
      engine.release(enemy.uid)
      setCaptureUid((uid) => (uid === enemy.uid ? null : uid))
      notify(`已放归「${enemy.name}」`, '按击杀奖励结算金币')
    },
    [engine, notify]
  )

  const handleFieldCapture = useCallback((enemy: BattleEnemy) => {
    setCaptureUid(enemy.uid)
  }, [])

  // ---- 广告奖励 ----
  const handleCaptureAdReward = useCallback(() => {
    const e = captureTarget
    if (!e) return
    setAdBuffUids((prev) => {
      const next = new Set(prev)
      next.add(e.uid)
      return next
    })
    notify('捕捉祝福生效：本次收服成功率 +20%！')
  }, [captureTarget, notify])

  const handleRepairAdReward = useCallback(() => {
    sfx.play('claim')
    engine.repairInn()
    notify('客栈修复完毕，血量已回满！')
  }, [engine, notify])

  // ---- 布阵（保卫萝卜式槽位吸附：点空位/守卫就地弹菜单，prep 与战斗中通用） ----
  /** 就地菜单选人上阵：体力/解锁校验；战斗中走 engine.swapSlot 外科替换（保留其余守卫血量） */
  const handleDeploy = useCallback(
    (slot: number, yaoguaiId: string) => {
      const ownedEntry = useGameStore.getState().owned[yaoguaiId]
      if (!ownedEntry || ownedEntry.count <= 0) return
      // 虚脱妖怪无法上阵（体力耗尽）
      const tier = staminaTier(ownedEntry.stamina ?? 100)
      if (!tier.battleOk) {
        notify(`💀 ${YAOGUAI_MAP[yaoguaiId]?.name ?? '该妖怪'}体力虚脱，无法上阵`, '可在白天使用体力药水或看广告恢复')
        return
      }
      sfx.play('place')
      const entry: LineupEntry = {
        yaoguaiId,
        star: ownedEntry.star,
        level: ownedEntry.level ?? 1,
        slot,
        stamina: ownedEntry.stamina ?? 100,
        skillLevel: ownedEntry.skillLevel ?? 1,
      }
      engine.swapSlot(slot, entry)
      setLineup((prev) => {
        const next = [...prev]
        // 同一妖怪只能占一个坑（换位）
        for (let i = 0; i < next.length; i++) {
          if (next[i]?.yaoguaiId === yaoguaiId) next[i] = null
        }
        next[slot] = entry
        return next
      })
      if (tier.key === 'tired' || tier.key === 'exhausted') {
        notify(`⚠️ ${YAOGUAI_MAP[yaoguaiId]?.name ?? '该妖怪'}体力${tier.name}`, tier.desc)
      }
      setActiveSlot(null)
    },
    [engine, notify]
  )

  const handleRemoveSlot = useCallback((slot: number) => {
    sfx.play('click')
    setLineup((prev) => {
      if (!prev[slot]) return prev
      const next = [...prev]
      next[slot] = null
      return next
    })
  }, [])

  // 就地浮窗撤下（体力不返还：按「每波完成时在场名单」结算，撤下者自然退出后续名单）
  const handleWithdrawSlot = useCallback(
    (slot: number) => {
      sfx.play('click')
      engine.swapSlot(slot, null)
      setLineup((prev) => {
        const next = [...prev]
        next[slot] = null
        return next
      })
      setActiveSlot(null)
    },
    [engine]
  )

  // 战场光圈点击：打开/关闭就地菜单（空位=上阵菜单；已占=守卫浮窗）；解锁校验
  const handleSelectSlot = useCallback(
    (slot: number) => {
      const ph = engine.state.phase
      if (ph === 'victory' || ph === 'failed') return
      if (slot >= maxSlots) {
        notify(`站位 ${slot + 1} 尚未解锁`, `客栈升至 ${slotUnlockAt(slot)} 级后开放（当前 ${innLevel} 级）`)
        return
      }
      sfx.play('click')
      setActiveSlot((prev) => (prev === slot ? null : slot))
    },
    [maxSlots, innLevel, notify]
  )

  const ownedIds = useMemo(
    () => Object.entries(owned).filter(([, o]) => o.count > 0).map(([id]) => id),
    [owned]
  )

  // ---- 主动退出（半金结算，进度清留由外层处理） ----
  const confirmExit = useCallback(() => {
    const s = engine.state
    // 参战妖怪同样获得经验（按已推进波次）
    const expPer = battleExpGain(s.wave, false, bossNight)
    const expGained: Record<string, number> = {}
    for (const entry of engine.lineup) {
      const o = useGameStore.getState().owned[entry.yaoguaiId]
      if (!o || o.level >= levelCapForStar(o.star)) continue
      expGained[entry.yaoguaiId] = expPer
    }
    onExit({
      victory: false,
      waveReached: s.wave,
      gold: Math.floor(s.waveGold * 0.5),
      gems: 0,
      tickets: 0,
      captured: [...s.capturedThisBattle],
      bossNight: bossNight || undefined,
      expGained: Object.keys(expGained).length > 0 ? expGained : undefined,
      materialsGained: Object.keys(s.materialsGained).length > 0 ? { ...s.materialsGained } : undefined,
    })
  }, [engine, onExit, bossNight])

  const closeCaptureSuccess = useCallback(() => setCaptureSuccessId(null), [])
  const handleCaptureDialogChange = useCallback(
    (o: boolean) => {
      if (!o) closeCaptureSuccess()
    },
    [closeCaptureSuccess]
  )

  // ---- 派生显示 ----
  const phase = state.phase
  const inBattle = phase === 'prep' || phase === 'interlude' || phase === 'fighting'
  const modalOpen = exitOpen || repairAdOpen || captureAdOpen || captureSuccessId !== null
  const innHpPct = state.innMaxHp > 0 ? state.innHp / state.innMaxHp : 0
  const innLow = phase === 'fighting' && innHpPct < 0.4
  const showPauseOverlay = state.paused && !modalOpen && inBattle
  const captureHint = captureTarget
    ? wildTarget
      ? '此妖桀骜不驯，今夜不肯归顺——放归可按击杀结算金币'
      : legendTarget
        ? `已挑战 ${attempts} 次 · 每次耗费 ${CAPTURE_GEM_COST.boss} 灵石${
            attempts >= BOSS_NIGHT.pityAttempts
              ? ' · 保底必成'
              : ` · 每败+${Math.round(BOSS_NIGHT.attemptBonusRate * 100)}%（${BOSS_NIGHT.pityAttempts}次保底）`
          }${captureTarget.protectedFlag ? ' · 残血保护中' : ''}`
        : `已挑战 ${attempts} 次 · 每次耗费 ${CAPTURE_GEM_COST.normal} 灵石${
            attempts >= PITY_ATTEMPTS
              ? ' · 保底必成'
              : attempts >= ATTEMPT_BONUS_STEP
                ? ' · 累计加成+10%'
                : ''
          }${captureTarget.protectedFlag ? ' · 残血保护中' : ' · 血越低概率越高'}`
    : ''

  return (
    <div
      className={cn(
        'relative mx-auto h-dvh w-full max-w-[480px] touch-manipulation select-none overflow-hidden text-[#E6DCC8]',
        bossNight ? 'bg-[#170911]' : region === 2 ? 'bg-[#131318]' : region === 3 ? 'bg-[#1c0d08]' : 'bg-[#1C1915]'
      )}
    >
      {/* ======== 全幅夜战场景（HUD 叠层，不裁切背景） ======== */}
      <div className="absolute inset-0">
        <BattleField
          engine={engine}
          state={state}
          bossNight={bossNight}
          region={region}
          selectedUid={captureTarget?.uid ?? null}
          onCapture={handleFieldCapture}
          onRelease={handleRelease}
          onSelectSlot={handleSelectSlot}
          maxSlots={maxSlots}
          innLevel={innLevel}
        />

        {/* 顶部/底部柔光渐隐，衬托 HUD 可读性 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[15] h-24"
          style={{
            background: bossNight
              ? 'linear-gradient(180deg, rgba(40,8,14,0.72) 0%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(28,25,21,0.65) 0%, transparent 100%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] h-36"
          style={{
            background: bossNight
              ? 'linear-gradient(0deg, rgba(40,8,14,0.78) 0%, transparent 100%)'
              : 'linear-gradient(0deg, rgba(28,25,21,0.72) 0%, transparent 100%)',
          }}
        />

        {/* ======== 槽位吸附式就地菜单（保卫萝卜范式）：点空位弹上阵横排 / 点守卫弹信息+撤下 ======== */}
        {activeSlot !== null && phase !== 'victory' && phase !== 'failed' && (() => {
          const sp = SLOTS[activeSlot] ?? SLOTS[0]
          const defender = state.defenders.find((d) => d.slot === activeSlot) ?? null
          const entry = lineup[activeSlot] ?? null
          const menuBelow = sp.y < 50 // 上排站位菜单朝下弹，下排朝上弹，避免顶出画框
          const candidates = ownedIds
            .filter((id) => !lineup.some((l) => l?.yaoguaiId === id))
            .map((id) => ({ id, o: owned[id] }))
            .filter(({ o }) => o && staminaTier(o.stamina ?? 100).battleOk)
          return (
            <>
              {/* 透明遮罩：点任意处关闭菜单（菜单打开期间接管战场点击） */}
              <button
                type="button"
                aria-label="关闭布阵菜单"
                className="absolute inset-0 z-[26] cursor-default"
                onClick={() => setActiveSlot(null)}
              />
              <motion.div
                key={`slot-menu-${activeSlot}`}
                initial={{ opacity: 0, y: menuBelow ? 10 : -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: menuBelow ? 10 : -10 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                className="absolute z-[27] w-[64%] max-w-[260px]"
                style={{
                  left: `${Math.min(Math.max(sp.x, 24), 66)}%`,
                  top: `${sp.y}%`,
                  translate: menuBelow ? '-50% 30px' : '-50% calc(-100% - 30px)',
                }}
              >
                <div className="overflow-hidden rounded-2xl border-2 border-[#5C3A24]/70 shadow-xl shadow-black/50 backdrop-blur-sm">
                  <div className="ui-wood px-2.5 py-1 text-[10px] font-black tracking-wider text-[#FFE9B8]">
                    站位 {activeSlot + 1}{entry || defender ? ' · 已上阵' : ' · 空位'}
                  </div>
                  {entry || defender ? (
                    <div className="bg-gradient-to-b from-[#2C241C]/95 to-[#1C1915]/95 px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <YaoAvatar
                          id={(defender ?? entry)!.yaoguaiId}
                          size={40}
                          active={defender ? !defender.dead : true}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-black text-[#FFE9B8]">
                            {(defender ?? entry)!.yaoguaiId && YAOGUAI_MAP[(defender ?? entry)!.yaoguaiId]?.name}
                            {defender ? ` · ${defender.star}★ Lv.${defender.level}` : ` · ${entry!.star}★ Lv.${entry!.level}`}
                          </div>
                          {defender && (
                            <>
                              <div className="mt-1">
                                <HpBar value={defender.hp} max={defender.maxHp} height={5} />
                              </div>
                              <div className="mt-0.5 text-[9px] tabular-nums text-[#E6DCC8]/75">
                                {defender.hp} / {defender.maxHp}
                                {defender.staminaTier === 'tired' || defender.staminaTier === 'exhausted' ? ' · 体力不支' : ''}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleWithdrawSlot(activeSlot)}
                        className="mt-2 w-full rounded-lg border border-[#F5A9A0]/40 bg-[#8B2E24]/25 py-1 text-[11px] font-bold text-[#F5A9A0] active:scale-95"
                      >
                        撤下{phase === 'prep' ? '（可再点其他空位换位）' : '（不返还本波体力）'}
                      </button>
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="bg-gradient-to-b from-[#2C241C]/95 to-[#1C1915]/95 px-2 py-3 text-center text-[11px] text-[#E6DCC8]/70">
                      无可上阵妖怪（体力虚脱或已全员上阵）
                    </div>
                  ) : (
                    <div className="flex gap-1.5 overflow-x-auto bg-gradient-to-b from-[#2C241C]/95 to-[#1C1915]/95 px-2 py-2">
                      {candidates.map(({ id, o }) => {
                        const def = YAOGUAI_MAP[id]
                        const st = Math.round(o?.stamina ?? 100)
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleDeploy(activeSlot, id)}
                            aria-label={`上阵 ${def?.name ?? id}`}
                            className="flex w-[60px] shrink-0 flex-col items-center rounded-xl border border-[#E8B84B]/35 bg-black/30 px-1 py-1.5 active:scale-95"
                          >
                            <YaoAvatar id={id} size={38} />
                            <span className="mt-1 max-w-full truncate text-[9px] font-bold text-[#FFE9B8]">
                              {def?.name ?? id}
                            </span>
                            <span className="text-[8px] tabular-nums text-[#E6DCC8]/70">
                              Lv.{o?.level ?? 1} · {o?.star ?? 1}★
                            </span>
                            <span
                              className={cn(
                                'mt-0.5 rounded-full px-1 text-[8px] font-bold leading-[12px]',
                                st >= 70 ? 'bg-emerald-500/20 text-emerald-300' : st >= 40 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                              )}
                            >
                              {st}%
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )
        })()}

        {/* 妖王降临横幅 */}
        <AnimatePresence>
          {bossBannerVisible && bossNight && bossDef && (
            <motion.div
              key="boss-banner"
              initial={{ y: -48, opacity: 0, x: '-50%' }}
              animate={{ y: 58, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="rounded-xl border border-[#8B2E24]/70 bg-gradient-to-r from-[#3a0f18]/95 via-[#57182a]/95 to-[#3a0f18]/95 px-3 py-2 text-center shadow-lg shadow-rose-950/50 backdrop-blur-sm">
                <p className="font-display text-sm font-black tracking-[0.2em] text-[#FFE9B8]">
                  妖王降临 · {bossDef.name}
                </p>
                <p className="mt-0.5 text-[10px] text-[#E6DCC8]/85">传说亲卫压境 · 血战五波 · 胜利奖励翻倍</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 移驻横幅 */}
        <AnimatePresence>
          {regionBannerVisible && !bossNight && region === 2 && (
            <motion.div
              key="region-banner"
              initial={{ y: -48, opacity: 0, x: '-50%' }}
              animate={{ y: 58, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="rounded-xl border border-[#E8B84B]/35 bg-gradient-to-r from-[#2c2820]/95 via-[#3d3930]/95 to-[#2c2820]/95 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
                <p className="font-display text-sm font-black tracking-[0.2em] text-[#E6DCC8]">水墨幽谷 · 水墨别院</p>
                <p className="mt-0.5 text-[10px] text-[#E6DCC8]/80">谷雾如墨 · 野妖更悍 · 通关奖励 +35%</p>
              </div>
            </motion.div>
          )}
          {regionBannerVisible && !bossNight && region === 3 && (
            <motion.div
              key="region3-banner"
              initial={{ y: -48, opacity: 0, x: '-50%' }}
              animate={{ y: 58, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="rounded-xl border border-[#E8A26B]/50 bg-gradient-to-r from-[#3a1108]/95 via-[#7c2d1f]/95 to-[#3a1108]/95 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
                <p className="font-display text-sm font-black tracking-[0.2em] text-[#FFE9B8]">沸火赤川 · 沸泉别馆</p>
                <p className="mt-0.5 text-[10px] text-[#FFE9B8]/85">地脉沸腾 · 火魅凶猛 · 通关奖励 +80%</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 妖雾降临横幅 */}
        <AnimatePresence>
          {fogBannerVisible && (
            <motion.div
              key="fog-banner"
              initial={{ y: -48, opacity: 0, x: '-50%' }}
              animate={{ y: 58, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="ui-ink-chip rounded-xl px-3 py-2 text-center">
                <p className="text-xs font-bold text-[#E6DCC8]">妖雾降临！今夜将有限定稀有妖怪出没</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 胜负过场 */}
        <AnimatePresence>
          {(phase === 'victory' || phase === 'failed') && (
            <motion.div
              key="battle-end"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px]"
            >
              <div className="mx-6 w-[min(88%,300px)] rounded-2xl border-2 border-[#E8B84B]/70 bg-gradient-to-b from-[#FAF5EA] to-[#E8DFD0] px-5 py-6 text-center shadow-2xl">
                <p
                  className={cn(
                    'font-display text-2xl font-black tracking-[0.18em]',
                    phase === 'victory' ? 'text-[#8B2E24]' : 'text-[#5C3A24]'
                  )}
                >
                  {phase === 'victory'
                    ? bossNight
                      ? '妖王退散'
                      : '守店成功'
                    : bossNight
                      ? '妖王太过强大'
                      : '客栈失守'}
                </p>
                <p className="mt-2 text-[11px] text-[#5C3A24]/75">正在结算战利品…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 暂停面板 · 宣纸木框 */}
        <AnimatePresence>
          {showPauseOverlay && (
            <motion.div
              key="pause-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-[#1C1915]/78 backdrop-blur-sm"
            >
              <div className="w-[272px] overflow-hidden rounded-2xl border-2 border-[#5C3A24]/55 shadow-2xl">
                <div className="ui-wood px-4 py-2.5 text-center">
                  <p className="font-display text-base font-black tracking-[0.2em] text-[#FFE9B8]">战斗暂停</p>
                </div>
                <div className="bg-gradient-to-b from-[#FAF5EA] to-[#E8DFD0] px-4 py-4 text-center">
                  <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-[#5C3A24]/85">
                    <span>第 {state.wave} 波</span>
                    <span>·</span>
                    <span>击杀 {state.killCount}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <GoldIcon size={12} />+{state.waveGold}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => engine.togglePause()}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E8B84B] to-[#D4933D] py-2.5 text-sm font-black text-[#5C3A1E] shadow-md active:scale-95"
                  >
                    <ConfigIcon icon="/images/ui/play.png" size={16} />
                    继续战斗
                  </button>
                  <button
                    type="button"
                    onClick={() => setExitOpen(true)}
                    className="mt-2 w-full rounded-xl border-2 border-[#8B2E24]/45 bg-white/70 py-2.5 text-sm font-bold text-[#8B2E24] active:scale-95"
                  >
                    退出战斗
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ======== 顶部 HUD（叠在场景上） ======== */}
      <header className="ui-wood absolute left-1.5 right-1.5 top-[max(0.35rem,env(safe-area-inset-top))] z-40 flex items-center gap-1.5 rounded-2xl px-1.5 py-1.5">
        <button type="button" aria-label="退出夜战" onClick={() => setExitOpen(true)} className={HUD_BTN}>
          <ConfigIcon icon="/images/ui/ui-back.png" size={18} />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-[#FFE9B8]/12 bg-black/30 px-2 py-1">
          <span className="shrink-0 text-[10px] font-black text-[#F5A9A0]" aria-label="客栈生命">
            寿
          </span>
          <HpBar
            value={state.innHp}
            max={state.innMaxHp}
            height={7}
            className="min-w-0 flex-1"
            color={innHpPct > 0.4 ? 'bg-[#C0392B]' : 'bg-[#8B2E24]'}
          />
          <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-[#FFE9B8]">
            {Math.round(innHpPct * 100)}%
          </span>
        </div>

        {bossNight && (
          <div className="shrink-0 rounded-full border border-[#8B2E24]/80 bg-gradient-to-r from-[#4a1120] to-[#7a1a2e] px-1.5 py-1 text-[9px] font-black text-[#FFE9B8]">
            妖王夜
          </div>
        )}
        {!bossNight && region === 2 && (
          <div className={cn(HUD_CHIP, 'hidden min-[380px]:block')}>水墨</div>
        )}
        {!bossNight && region === 3 && (
          <div className={cn(HUD_CHIP, 'border-[#E8A26B]/50 text-[#FFD9B8] hidden min-[380px]:block')}>沸火</div>
        )}

        <div className={HUD_CHIP}>
          {bossNight ? `亲卫 ${state.wave}/${state.totalWaves}` : `${state.wave}/${state.totalWaves}波`}
        </div>

        <button
          type="button"
          aria-label={state.paused ? '继续战斗' : '暂停'}
          disabled={!inBattle}
          onClick={() => engine.togglePause()}
          className={HUD_BTN}
        >
          {state.paused ? (
            <ConfigIcon icon="/images/ui/play.png" size={18} />
          ) : (
            <ConfigIcon icon="/images/ui/pause.png" size={18} />
          )}
        </button>
        <button
          type="button"
          aria-label="切换战斗速度"
          disabled={!inBattle}
          onClick={() => engine.setSpeed(state.speed === 1 ? 2 : 1)}
          className={cn(
            'h-9 w-9 shrink-0 rounded-xl border text-[11px] font-black tabular-nums active:scale-95 disabled:opacity-40',
            state.speed > 1
              ? 'border-[#E8B84B]/70 bg-[#E8B84B]/25 text-[#FFE9B8]'
              : 'border-[#FFE9B8]/18 bg-black/30 text-[#FFE9B8]'
          )}
        >
          {state.speed}x
        </button>
      </header>

      {/* ======== 底部：捕捉 + 布阵/战况 ======== */}
      <footer className="play-safe-b absolute inset-x-0 bottom-0 z-40">
        <AnimatePresence>
          {phase === 'fighting' && captureTarget && (
            <motion.div
              key="capture-panel"
              initial={{ y: 56, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 56, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className={cn(
                'mx-1.5 mb-1 overflow-hidden rounded-xl border-2 shadow-lg',
                bossNight ? 'border-[#8B2E24]/70' : 'border-[#5C3A24]/55'
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5',
                  bossNight
                    ? 'bg-gradient-to-b from-[#3a1420]/97 to-[#240b12]/97'
                    : 'bg-gradient-to-b from-[#3a3228]/97 to-[#2a241c]/97'
                )}
                title={captureHint}
                aria-label={captureHint}
              >
                <YaoAvatar id={captureTarget.yaoguaiId ?? 'lili'} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-xs font-bold text-[#FFE9B8]">{captureTarget.name}</span>
                    {wildTarget ? (
                      <span className="shrink-0 rounded bg-stone-500/50 px-1 text-[8px] font-black text-stone-100 ring-1 ring-stone-300/50">
                        野
                      </span>
                    ) : legendTarget ? (
                      <span className="shrink-0 rounded bg-[#8B2E24]/70 px-1 text-[8px] font-black text-[#FFE9B8] ring-1 ring-[#E8B84B]/40">
                        妖王
                      </span>
                    ) : (
                      <span className="shrink-0 rounded bg-[#8B2E24]/35 px-1 text-[8px] font-bold text-[#F5A9A0]">
                        精英
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#E6DCC8]/85">
                    <span className="shrink-0 tabular-nums">
                      <b className="text-[#E8B84B]">{Math.round((captureTarget.hp / captureTarget.maxHp) * 100)}%</b>
                    </span>
                    <span className="shrink-0">
                      率{' '}
                      <b
                        className={cn(
                          'tabular-nums',
                          wildTarget
                            ? 'text-stone-300'
                            : captureRate >= 0.6
                              ? 'text-emerald-300'
                              : captureRate >= 0.3
                                ? 'text-[#E8B84B]'
                                : 'text-[#F5A9A0]'
                        )}
                      >
                        {wildTarget ? '—' : `${Math.round(captureRate * 100)}%`}
                      </b>
                    </span>
                    <span className="truncate text-[9px] text-[#E6DCC8]/50">{captureHint}</span>
                  </div>
                </div>
                {!adBuffed && !wildTarget && (
                  <button
                    type="button"
                    onClick={() => setCaptureAdOpen(true)}
                    className="shrink-0 rounded-md border border-emerald-300/45 bg-emerald-400/15 px-1.5 py-1 text-[10px] font-bold text-emerald-200 active:scale-95"
                  >
                    祝福
                  </button>
                )}
                {!netBuffed && netStock > 0 && (
                  <button
                    type="button"
                    onClick={handleUseNet}
                    aria-label={`张网（本场收服成功率 +${Math.round(CAPTURE_NET.bonus * 100)}%，剩余 ${netStock} 张）`}
                    title={`张网：本场收服成功率 +${Math.round(CAPTURE_NET.bonus * 100)}%，剩余 ${netStock} 张`}
                    className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-[#E8B84B]/45 bg-[#8B2E24]/40 px-1.5 text-[10px] font-bold text-[#FFE9B8] active:scale-95"
                  >
                    <ConfigIcon icon="/images/ui/prop-capture-net.png" size={18} />
                    <span>张网</span>
                    <span className="tabular-nums text-[#E8B84B]">{netStock}</span>
                  </button>
                )}
                {wildTarget ? (
                  <button
                    type="button"
                    onClick={() => handleRelease(captureTarget)}
                    className="h-9 shrink-0 rounded-lg border border-[#E8B84B]/60 bg-[#E8B84B]/20 px-2.5 text-[11px] font-bold text-[#FFE9B8] active:scale-95"
                  >
                    放归领赏
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={gemsTooLow}
                    onClick={handleCaptureClick}
                    aria-label={
                      gemsTooLow
                        ? `灵石不足，收服需 ${captureGemCost} 灵石`
                        : `收服（耗费 ${captureGemCost} 灵石）`
                    }
                    className={cn(
                      'h-9 shrink-0 rounded-lg px-2.5 text-sm font-black tracking-widest shadow-lg active:scale-95',
                      gemsTooLow
                        ? 'cursor-not-allowed border border-[#FFE9B8]/15 bg-black/40 text-[#E6DCC8]/45 shadow-none'
                        : 'animate-pulse bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-[#5C3A1E] shadow-[#E8B84B]/25'
                    )}
                  >
                    {gemsTooLow ? (
                      '灵石不足'
                    ) : (
                      <span className="flex items-center justify-center gap-0.5">
                        收服
                        <span className="flex items-center gap-px text-[10px] font-bold opacity-90">
                          −{captureGemCost}
                          <GemIcon size={12} />
                        </span>
                      </span>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'prep' ? (
          <LineupBar
            lineup={lineup}
            ownedIds={ownedIds}
            onPlace={handleDeploy}
            onRemove={handleRemoveSlot}
            countdown={state.prepCountdown}
            maxSlots={maxSlots}
            innLevel={innLevel}
          />
        ) : phase === 'victory' || phase === 'failed' ? (
          <div className="ui-wood mx-1.5 mb-1 rounded-2xl px-3 py-2 text-[11px]">
            <span
              className={cn(
                'font-display font-bold tracking-wider',
                phase === 'victory' ? 'text-[#E8B84B]' : 'text-[#F5A9A0]'
              )}
            >
              {phase === 'victory'
                ? bossNight
                  ? '妖王退散，结算中…'
                  : '守店成功，结算中…'
                : bossNight
                  ? '妖王太过强大，结算中…'
                  : '战斗结束，结算中…'}
            </span>
          </div>
        ) : (
          <div className="ui-wood mx-1.5 mb-1 flex items-center gap-2 overflow-x-auto rounded-2xl px-2 py-1.5 text-[11px] text-[#E6DCC8]">
            <div className="flex shrink-0 items-center gap-1" aria-label="守店妖怪">
              {state.defenders.map((d) => (
                <span
                  key={d.uid}
                  className={cn('relative inline-flex', d.dead && 'opacity-35 grayscale')}
                >
                  <YaoAvatar id={d.yaoguaiId} size={26} />
                  <span
                    className="absolute inset-x-0 -bottom-0.5 mx-auto h-1 w-6 overflow-hidden rounded-full bg-black/55"
                    aria-hidden
                  >
                    <span
                      className="block h-full bg-[#C0392B]"
                      style={{ width: `${d.maxHp > 0 ? Math.max(0, (d.hp / d.maxHp) * 100) : 0}%` }}
                    />
                  </span>
                </span>
              ))}
            </div>
            <span className="h-6 w-px shrink-0 bg-[#FFE9B8]/15" aria-hidden />
            <span className="flex shrink-0 items-center gap-1">
              击 <AnimNumber value={state.killCount} className="font-bold text-[#FFE9B8]" />
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <GoldIcon size={12} />
              <AnimNumber value={state.waveGold} className="font-bold text-[#E8B84B]" />
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <GemIcon size={12} />
              <AnimNumber
                value={gems}
                className={cn('font-bold', gemsTooLow ? 'text-[#F5A9A0]' : 'text-[#C8F4E4]')}
              />
            </span>
            {state.capturedThisBattle.length > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[#E8B84B]">
                收 {state.capturedThisBattle.length}
              </span>
            )}
            {innLow && (
              <button
                type="button"
                onClick={() => setRepairAdOpen(true)}
                className="ml-auto animate-pulse shrink-0 rounded-full border border-[#E8B84B]/50 bg-[#E8B84B]/18 px-2.5 py-1 text-[11px] font-bold text-[#FFE9B8] active:scale-95"
              >
                修复
              </button>
            )}
          </div>
        )}
      </footer>

      {/* ======== 弹窗层 ======== */}
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="max-w-[320px] gap-0 overflow-hidden rounded-2xl border-2 border-[#5C3A24]/55 bg-transparent p-0 text-[#1C1915] shadow-2xl">
          <div className="ui-wood px-4 py-2.5">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-center text-lg tracking-[0.15em] text-[#FFE9B8]">
                今夜就撤吗？
              </AlertDialogTitle>
            </AlertDialogHeader>
          </div>
          <div className="bg-gradient-to-b from-[#FAF5EA] to-[#E8DFD0] px-5 py-4">
            <AlertDialogDescription className="text-center text-xs leading-relaxed text-[#5C3A24]/90">
              中途撤退只能带走一半战利金币（当前约 +
              {Math.floor(state.waveGold * 0.5)} 金），已收服的妖怪不受影响。
            </AlertDialogDescription>
            <AlertDialogFooter className="mt-4 flex-row gap-2 sm:space-x-0">
              <AlertDialogCancel className="mt-0 flex-1 rounded-xl border-2 border-[#8B2E24]/35 bg-white/80 text-[#8B2E24] hover:bg-white hover:text-[#8B2E24]">
                继续守店
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmExit}
                className="flex-1 rounded-xl border-0 bg-gradient-to-r from-[#E8B84B] to-[#D4933D] font-bold text-[#5C3A1E] hover:from-[#E8B84B] hover:to-[#C9922A]"
              >
                撤退结算
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AdDialog
        scene="inn-repair"
        open={repairAdOpen}
        onOpenChange={setRepairAdOpen}
        onReward={handleRepairAdReward}
      />
      <AdDialog
        scene="capture-buff"
        open={captureAdOpen}
        onOpenChange={setCaptureAdOpen}
        onReward={handleCaptureAdReward}
      />
      <AdDialog
        scene="buff-reroll"
        open={buffRerollOpen}
        onOpenChange={setBuffRerollOpen}
        onReward={handleBuffRerollReward}
      />

      {/* 备战增益三选一（肉鸽）：prep 阶段弹出，选一或跳过 */}
      <AnimatePresence>
        {buffOpen && (
          <motion.div
            key="buff-offer"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-[420px] rounded-2xl border-2 border-[#E8B84B]/40 bg-[#2A211A] p-4 shadow-2xl"
              initial={{ scale: 0.85, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            >
              <p className="text-center text-lg font-bold text-[#E8B84B]">🌙 备战增益</p>
              <p className="mt-1 text-center text-xs text-[#C9B08A]">入夜前，选一项今晚的守护加持（三选一）</p>
              <div className="mt-3 space-y-2">
                {buffOffer!.map((b, i) => {
                  const rarityStyle =
                    b.rarity === 3
                      ? 'border-[#C77DFF]/60 bg-[#3A2440]/70 text-[#E9C6FF]'
                      : b.rarity === 2
                        ? 'border-[#6FB7FF]/50 bg-[#20303F]/70 text-[#BFE0FF]'
                        : 'border-[#8FA37A]/40 bg-[#26301F]/60 text-[#D6E2C0]'
                  return (
                    <motion.button
                      key={b.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.97] ${rarityStyle}`}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 * i }}
                      onClick={() => handlePickBuff(b)}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/35 text-xl">
                        <img src={b.icon} alt="" className="h-7 w-7 object-contain" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">
                          {b.name}
                          {b.rarity === 3 && <em className="ml-1 text-[10px] not-italic text-[#C77DFF]">史诗</em>}
                          {b.rarity === 2 && <em className="ml-1 text-[10px] not-italic text-[#6FB7FF]">稀有</em>}
                        </span>
                        <span className="block truncate text-xs opacity-80">{b.desc}</span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="rounded-lg px-2 py-1.5 text-xs text-[#C9B08A]/70 underline-offset-2 hover:underline"
                  onClick={() => setBuffChosen(true)}
                >
                  不选，直接开战
                </button>
                {!buffRerollUsedRef.current ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg border border-[#FFE9B8]/25 bg-black/30 px-3 py-1.5 text-xs text-[#FFE9B8] transition active:scale-95"
                    onClick={() => setBuffRerollOpen(true)}
                  >
                    ▶ 换一批（看广告）
                  </button>
                ) : (
                  <span className="text-xs text-[#C9B08A]/40">今日换批已用</span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 波间事件三选一（肉鸽第二层）：清波后弹出，选完开下一波 */}
      <AnimatePresence>
        {phase === 'interlude' && state.eventOffer && (
          <motion.div
            key="event-offer"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-[420px] rounded-2xl border-2 border-[#8FA37A]/50 bg-[#232B1C] p-4 shadow-2xl"
              initial={{ scale: 0.85, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            >
              <p className="text-center text-lg font-bold text-[#D6E2C0]">🍃 波间际遇</p>
              <p className="mt-1 text-center text-xs text-[#C9B08A]">
                第 {state.wave} 波已清 · 山海之间偶有际遇（三选一）
              </p>
              <div className="mt-3 space-y-2">
                {state.eventOffer.map((ev: NightEvent, i) => {
                  const tooPoor = ev.kind === 'deal' && ev.cost != null && state.waveGold < ev.cost
                  const style =
                    ev.kind === 'curse'
                      ? 'border-[#E07A6B]/50 bg-[#3B2420]/70 text-[#F5C4BC]'
                      : ev.kind === 'deal'
                        ? 'border-[#6FB7FF]/50 bg-[#20303F]/70 text-[#BFE0FF]'
                        : ev.kind === 'rest'
                          ? 'border-[#7FC98F]/50 bg-[#22331F]/70 text-[#CFE8C4]'
                          : 'border-[#E8B84B]/50 bg-[#3A3220]/70 text-[#F0DFAE]'
                  return (
                    <motion.button
                      key={ev.id}
                      type="button"
                      disabled={tooPoor}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.97] disabled:opacity-40 ${style}`}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 * i }}
                      onClick={() => handlePickEvent(i)}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/35">
                        <img src={ev.icon} alt="" className="h-7 w-7 object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">
                          {ev.name}
                          {ev.kind === 'deal' && ev.cost != null && (
                            <em className="ml-1 text-[10px] not-italic text-[#BFE0FF]">花 {ev.cost} 金</em>
                          )}
                          {ev.kind === 'curse' && <em className="ml-1 text-[10px] not-italic text-[#E07A6B]">有代价</em>}
                        </span>
                        <span className="block text-xs opacity-85">{ev.desc}</span>
                      </span>
                    </motion.button>
                  )
                })}
              </div>
              <p className="mt-3 text-center text-[10px] text-[#C9B08A]/60">
                本场金币 {state.waveGold} · 选择后立即迎接下一波
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {captureSuccessId != null && (
        <CaptureSuccessDialog
          key={captureSuccessId}
          open
          yaoguaiId={captureSuccessId}
          onOpenChange={handleCaptureDialogChange}
        />
      )}
    </div>
  )
}
