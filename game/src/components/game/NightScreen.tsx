'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Pause, Play } from 'lucide-react'
import { BattleEngine, type LineupEntry } from '@/game/engine'
import type { BattleEnemy, BattleResult } from '@/game/types'
import { ATTEMPT_BONUS_STEP, BOSS_NIGHT, BOSS_NIGHT_WAVES, BOSS_WAVE_STAMINA_COST, CAPTURE_GEM_COST, CAPTURE_HP_THRESHOLD, CAPTURE_NET, PITY_ATTEMPTS, VICTORY_GOLD_PER_LEVEL, WAVES, WAVE_STAMINA_COST, battleExpGain, currentBossId, levelCapForStar, maxSlotsForInn, regionDef, slotUnlockAt, staminaTier, victoryGems } from '@/game/config'
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
import { AnimNumber, HpBar, YaoAvatar } from './shared'
import { cn } from '@/lib/utils'

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
          'mx-auto flex h-dvh w-full max-w-[480px] flex-col items-center justify-center text-stone-300',
          bossNight
            ? 'bg-gradient-to-b from-[#1a060c] to-[#2e0a14]'
            : region === 2
              ? 'bg-gradient-to-b from-[#14131c] to-[#2a2833]'
              : region === 3
                ? 'bg-gradient-to-b from-[#1c0d08] to-[#33140b]'
                : 'bg-gradient-to-b from-[#0b0a20] to-[#171338]'
        )}
      >
        <div className="animate-pulse text-4xl">{bossNight ? '👹' : region === 2 ? '🖌️' : region === 3 ? '🔥' : '🌙'}</div>
        <p className="mt-3 text-sm tracking-[0.3em]">
          {bossNight
            ? '血月高悬，妖王压境…'
            : region === 2
              ? '谷雾如墨，笔锋藏杀…'
              : region === 3
                ? '地脉沸腾，火魅扑面…'
                : '夜幕降临，妖影蠢动…'}
        </p>
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
  const [selectedYao, setSelectedYao] = useState<string | null>(null)
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

  // ---- toast（带自动消失；项目 Toaster 移除延迟极长，需显式 duration） ----
  const { toast } = useToast()
  const notify = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, duration: 2800 })
    },
    [toast]
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
    notify('📺 捕捉祝福生效：本次收服成功率 +20%！')
  }, [captureTarget, notify])

  const handleRepairAdReward = useCallback(() => {
    sfx.play('claim')
    engine.repairInn()
    notify('🏮 客栈修复完毕，血量已回满！')
  }, [engine, notify])

  // ---- 布阵 ----
  const handlePlace = useCallback(
    (slot: number, yaoguaiId: string) => {
      const ownedEntry = useGameStore.getState().owned[yaoguaiId]
      if (!ownedEntry || ownedEntry.count <= 0) return
      if (slot >= maxSlots) {
        notify(`🔒 站位 ${slot + 1} 尚未解锁`, `客栈升至 ${slotUnlockAt(slot)} 级后开放（当前 ${innLevel} 级）`)
        return
      }
      // 虚脱妖怪无法上阵（体力耗尽）
      const tier = staminaTier(ownedEntry.stamina ?? 100)
      if (!tier.battleOk) {
        notify(`💀 ${YAOGUAI_MAP[yaoguaiId]?.name ?? '该妖怪'}体力虚脱，无法上阵`, '可在白天使用体力药水或看广告恢复')
        return
      }
      sfx.play('place')
      const star = ownedEntry.star
      const level = ownedEntry.level ?? 1
      const stamina = ownedEntry.stamina ?? 100
      const skillLevel = ownedEntry.skillLevel ?? 1
      setLineup((prev) => {
        const next = [...prev]
        // 同一妖怪只能占一个坑（换位）
        for (let i = 0; i < next.length; i++) {
          if (next[i]?.yaoguaiId === yaoguaiId) next[i] = null
        }
        next[slot] = { yaoguaiId, star, level, slot, stamina, skillLevel }
        return next
      })
      if (tier.key === 'tired' || tier.key === 'exhausted') {
        notify(`⚠️ ${YAOGUAI_MAP[yaoguaiId]?.name ?? '该妖怪'}体力${tier.name}`, tier.desc)
      }
      setSelectedYao(null)
    },
    [maxSlots, innLevel, notify]
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

  // 战场光圈点击：选中卡 → 放置；已占用 → 移除；锁定 → 提示解锁等级；空 → 提示
  const handleSelectSlot = useCallback(
    (slot: number) => {
      if (engine.state.phase !== 'prep') return
      if (slot >= maxSlots) {
        notify(`🔒 站位 ${slot + 1} 尚未解锁`, `客栈升至 ${slotUnlockAt(slot)} 级后开放（当前 ${innLevel} 级）`)
        return
      }
      if (selectedYao) {
        handlePlace(slot, selectedYao)
      } else if (lineup[slot]) {
        handleRemoveSlot(slot)
      } else {
        notify('先点选下方妖怪卡，再点战场光圈上阵')
      }
    },
    [engine, selectedYao, lineup, handlePlace, handleRemoveSlot, notify, maxSlots, innLevel]
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
  const inBattle = phase === 'prep' || phase === 'fighting'
  const modalOpen = exitOpen || repairAdOpen || captureAdOpen || captureSuccessId !== null
  const innHpPct = state.innMaxHp > 0 ? state.innHp / state.innMaxHp : 0
  const innLow = phase === 'fighting' && innHpPct < 0.4
  const showPauseOverlay = state.paused && !modalOpen && inBattle

  return (
    <div
      className={cn(
        'relative mx-auto flex h-dvh w-full max-w-[480px] touch-manipulation select-none flex-col overflow-hidden text-stone-100',
        bossNight ? 'bg-[#170911]' : region === 2 ? 'bg-[#131318]' : region === 3 ? 'bg-[#1c0d08]' : 'bg-[#0b0a1e]'
      )}
    >
      {/* ======== 顶部战斗栏 ======== */}
      <header
        className={cn(
          'z-40 flex items-center border-b px-2.5 py-2',
          bossNight ? 'gap-1.5 border-rose-200/15 bg-[#2a0f16]/95' : 'gap-2 border-white/10 bg-[#151231]/95'
        )}
      >
        <button
          type="button"
          aria-label="退出夜战"
          onClick={() => setExitOpen(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-stone-200 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-sm leading-none" role="img" aria-label="客栈生命">
            ❤️
          </span>
          <HpBar
            value={state.innHp}
            max={state.innMaxHp}
            height={8}
            className="min-w-0 flex-1"
            color={innHpPct > 0.4 ? 'bg-rose-400' : 'bg-rose-500'}
          />
          <span className="w-9 shrink-0 text-right text-[10px] font-bold tabular-nums text-rose-200">
            {Math.round(innHpPct * 100)}%
          </span>
        </div>

        {/* 妖王夜血色徽章 */}
        {bossNight && (
          <div className="shrink-0 rounded-full border border-rose-300/60 bg-gradient-to-r from-[#4a1120] to-[#7a1a2e] px-1.5 py-1 text-[10px] font-black text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.35)]">
            👹妖王夜
          </div>
        )}

        {/* 水墨幽谷墨色徽章（区域二）/ 沸火赤川火色徽章（区域三） */}
        {!bossNight && region === 2 && (
          <div className="shrink-0 rounded-full border border-stone-300/40 bg-gradient-to-r from-[#2f2d38] to-[#4a4658] px-1.5 py-1 text-[10px] font-black text-stone-100 shadow-[0_0_10px_rgba(148,158,180,0.28)]">
            🖌️水墨幽谷
          </div>
        )}
        {!bossNight && region === 3 && (
          <div className="shrink-0 rounded-full border border-orange-300/50 bg-gradient-to-r from-[#5c1d10] to-[#a8402f] px-1.5 py-1 text-[10px] font-black text-orange-50 shadow-[0_0_10px_rgba(232,120,70,0.4)]">
            🔥沸火赤川
          </div>
        )}

        <div
          className={cn(
            'shrink-0 rounded-full border px-1.5 py-1 text-[10px] font-bold tabular-nums',
            bossNight
              ? 'border-rose-200/30 bg-rose-400/15 text-rose-100'
              : 'border-amber-200/25 bg-amber-200/10 px-2 text-[11px] text-amber-100'
          )}
        >
          {bossNight ? `妖王亲卫 ${state.wave}/${state.totalWaves}` : `第 ${state.wave}/${state.totalWaves} 波`}
        </div>

        <button
          type="button"
          aria-label={state.paused ? '继续战斗' : '暂停'}
          disabled={!inBattle}
          onClick={() => engine.togglePause()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-stone-200 active:scale-95 disabled:opacity-40"
        >
          {state.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="切换战斗速度"
          disabled={!inBattle}
          onClick={() => engine.setSpeed(state.speed === 1 ? 2 : 1)}
          className={cn(
            'h-8 w-9 shrink-0 rounded-full border text-[11px] font-black tabular-nums active:scale-95 disabled:opacity-40',
            state.speed > 1
              ? 'border-amber-300/60 bg-amber-400/20 text-amber-200'
              : 'border-white/15 bg-white/5 text-stone-200'
          )}
        >
          {state.speed}x
        </button>
      </header>

      {/* ======== 战斗场景 ======== */}
      <main className="relative min-h-0 flex-1">
        <BattleField
          engine={engine}
          state={state}
          bossNight={bossNight}
          region={region}
          onCapture={handleFieldCapture}
          onRelease={handleRelease}
          onSelectSlot={handleSelectSlot}
          maxSlots={maxSlots}
          innLevel={innLevel}
        />

        {/* 妖王降临横幅（妖王夜入场 3 秒） */}
        <AnimatePresence>
          {bossBannerVisible && bossNight && bossDef && (
            <motion.div
              key="boss-banner"
              initial={{ y: -48, opacity: 0, x: '-50%' }}
              animate={{ y: 10, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="rounded-xl border border-rose-300/45 bg-gradient-to-r from-[#3a0f18]/95 via-[#57182a]/95 to-[#3a0f18]/95 px-3 py-2 text-center shadow-lg shadow-rose-950/50 backdrop-blur-sm">
                <p className="text-sm font-black tracking-[0.2em] text-rose-100 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]">
                  👹 妖王降临 · {bossDef.name} 👹
                </p>
                <p className="mt-0.5 text-[10px] text-rose-200/80">
                  传说妖王亲卫压境 · 血战五波 · 胜利奖励翻倍
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 移驻横幅（区域二/三入场 3 秒） */}
        <AnimatePresence>
          {regionBannerVisible && !bossNight && region === 2 && (
            <motion.div
              key="region-banner"
              initial={{ y: -48, opacity: 0, x: '-50%' }}
              animate={{ y: 10, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="rounded-xl border border-stone-300/35 bg-gradient-to-r from-[#26242e]/95 via-[#3d3a48]/95 to-[#26242e]/95 px-3 py-2 text-center shadow-lg shadow-stone-950/50 backdrop-blur-sm">
                <p className="text-sm font-black tracking-[0.2em] text-stone-100 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]">
                  🖌️ 水墨幽谷 · 水墨别院 🖌️
                </p>
                <p className="mt-0.5 text-[10px] text-stone-300/90">
                  谷雾如墨 · 野妖更悍 · 通关奖励 +35%
                </p>
              </div>
            </motion.div>
          )}
          {regionBannerVisible && !bossNight && region === 3 && (
            <motion.div
              key="region3-banner"
              initial={{ y: -48, opacity: 0, x: '-50%' }}
              animate={{ y: 10, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="rounded-xl border border-orange-300/40 bg-gradient-to-r from-[#3a1108]/95 via-[#7c2d1f]/95 to-[#3a1108]/95 px-3 py-2 text-center shadow-lg shadow-orange-950/50 backdrop-blur-sm">
                <p className="text-sm font-black tracking-[0.2em] text-orange-50 drop-shadow-[0_0_8px_rgba(255,160,100,0.5)]">
                  🔥 沸火赤川 · 沸泉别馆 🔥
                </p>
                <p className="mt-0.5 text-[10px] text-orange-100/90">
                  地脉沸腾 · 火魅凶猛 · 通关奖励 +80%
                </p>
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
              animate={{ y: 10, opacity: 1, x: '-50%' }}
              exit={{ y: -48, opacity: 0, x: '-50%' }}
              className="absolute left-1/2 top-0 z-30 w-[92%]"
            >
              <div className="rounded-xl border border-violet-300/30 bg-[#241d47]/90 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
                <p className="text-xs font-bold text-violet-100">
                  🌫️ 妖雾降临！今夜将有限定稀有妖怪出没
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 胜负过场（1.2s 展示） */}
        <AnimatePresence>
          {(phase === 'victory' || phase === 'failed') && (
            <motion.div
              key="battle-end"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]"
            >
              <div className="text-6xl drop-shadow-lg">
                {phase === 'victory' ? (bossNight ? '👑' : '🎉') : bossNight ? '👹' : '💔'}
              </div>
              <p
                className={cn(
                  'mt-3 text-2xl font-black tracking-[0.2em]',
                  phase === 'victory' ? 'text-amber-200' : 'text-rose-300'
                )}
              >
                {phase === 'victory'
                  ? bossNight
                    ? '妖王退散！'
                    : '守店成功！'
                  : bossNight
                    ? '妖王太过强大…'
                    : '客栈失守…'}
              </p>
              <p className="mt-1 text-xs text-stone-300">正在结算战利品…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 暂停面板 */}
        <AnimatePresence>
          {showPauseOverlay && (
            <motion.div
              key="pause-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0a1e]/80 backdrop-blur-sm"
            >
              <div className="w-64 rounded-2xl border border-white/15 bg-[#1a1636] p-5 text-center shadow-2xl">
                <p className="text-lg font-black text-stone-100">⏸ 战斗暂停</p>
                <p className="mt-1 text-[11px] text-stone-400">
                  第 {state.wave} 波 · 击杀 {state.killCount} · 金币 +{state.waveGold}
                </p>
                <button
                  type="button"
                  onClick={() => engine.togglePause()}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 active:scale-95"
                >
                  ▶ 继续战斗
                </button>
                <button
                  type="button"
                  onClick={() => setExitOpen(true)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm text-stone-200 active:scale-95"
                >
                  🏠 退出战斗
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ======== 底部：捕捉面板 + 布阵栏/战况条 ======== */}
      <footer className="relative z-20 shrink-0">
        {/* 收服面板（fighting 且存在可捕捉精英时弹出） */}
        <AnimatePresence>
          {phase === 'fighting' && captureTarget && (
            <motion.div
              key="capture-panel"
              initial={{ y: 56, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 56, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className={cn(
                'border-t px-3 py-2.5',
                bossNight
                  ? 'border-rose-300/30 bg-gradient-to-b from-[#3a1420] to-[#240b12]'
                  : 'border-amber-300/30 bg-gradient-to-b from-[#2a2142] to-[#1c1735]'
              )}
            >
              {/* 多目标切换 */}
              {capturables.length > 1 && (
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-[10px] text-stone-400">可收服目标：</span>
                  {capturables.map((c) => (
                    <button
                      key={c.uid}
                      type="button"
                      aria-label={`切换收服目标 ${c.name}${c.uncapturable ? '（野性难驯）' : ''}`}
                      onClick={() => setCaptureUid(c.uid)}
                      className={cn(
                        'relative rounded-full p-0.5 active:scale-95',
                        c.uid === captureTarget.uid
                          ? c.uncapturable
                            ? 'bg-stone-400/30 ring-1 ring-stone-300'
                            : 'bg-amber-300/30 ring-1 ring-amber-300'
                          : 'opacity-60'
                      )}
                    >
                      <YaoAvatar id={c.yaoguaiId ?? 'lili'} size={26} />
                      {c.uncapturable && (
                        <span className="absolute -right-0.5 -top-1 text-[10px] leading-none">🚫</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <YaoAvatar id={captureTarget.yaoguaiId ?? 'lili'} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-amber-100">
                      {captureTarget.name}
                    </span>
                    {wildTarget ? (
                      <span className="shrink-0 rounded bg-stone-500/50 px-1 text-[9px] font-black text-stone-100 ring-1 ring-stone-300/50">
                        野性难驯
                      </span>
                    ) : legendTarget ? (
                      <span className="shrink-0 rounded bg-rose-500/40 px-1 text-[9px] font-black text-rose-50 ring-1 ring-rose-300/50">
                        妖王
                      </span>
                    ) : (
                      <span className="shrink-0 rounded bg-rose-400/20 px-1 text-[9px] font-bold text-rose-200">
                        精英
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-stone-300">
                    <span className="shrink-0">
                      血量{' '}
                      <b className="tabular-nums text-amber-200">
                        {Math.round((captureTarget.hp / captureTarget.maxHp) * 100)}%
                      </b>
                    </span>
                    <span className="truncate">
                      成功率{' '}
                      <b
                        className={cn(
                          'tabular-nums',
                          captureRate >= 0.6
                            ? 'text-emerald-300'
                            : captureRate >= 0.3
                              ? 'text-amber-300'
                              : 'text-rose-300'
                        )}
                      >
                        {wildTarget ? '—' : `${Math.round(captureRate * 100)}%`}
                      </b>
                      {!wildTarget && adBuffed && <span className="text-emerald-300">（含📺+20%）</span>}
                      {!wildTarget && netBuffed && (
                        <span className="text-sky-300">（含🕸️+{Math.round(CAPTURE_NET.bonus * 100)}%）</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-stone-400">
                    {wildTarget
                      ? '🐴 此妖桀赊不驯，今夜不肯归顺——放归可按击杀结算金币'
                      : legendTarget
                        ? `已挑战 ${attempts} 次 · 每次耗费 ${CAPTURE_GEM_COST.boss} 灵石${
                            attempts >= BOSS_NIGHT.pityAttempts
                              ? ' · 保底必成'
                              : ` · 每败+${Math.round(BOSS_NIGHT.attemptBonusRate * 100)}%（${BOSS_NIGHT.pityAttempts}次保底）`
                          }${captureTarget.protectedFlag ? ' · 残血保护（免疫伤害，只能收服或放归）' : ''}`
                        : `已挑战 ${attempts} 次 · 每次耗费 ${CAPTURE_GEM_COST.normal} 灵石${
                            attempts >= PITY_ATTEMPTS
                              ? ' · 保底必成'
                              : attempts >= ATTEMPT_BONUS_STEP
                                ? ' · 累计加成+10%'
                                : ''
                          }${captureTarget.protectedFlag ? ' · 残血保护（免疫伤害，只能收服或放归）' : ' · 血越低概率越高'}`}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                  <div className="flex gap-1.5">
                    {!adBuffed && !wildTarget && (
                      <button
                        type="button"
                        onClick={() => setCaptureAdOpen(true)}
                        className="rounded-lg border border-emerald-300/50 bg-emerald-400/15 px-2 py-1.5 text-[11px] font-bold text-emerald-200 active:scale-95"
                      >
                        📺 +20%
                      </button>
                    )}
                    {!netBuffed && netStock > 0 && (
                      <button
                        type="button"
                        onClick={handleUseNet}
                        aria-label={`张开缚妖网（本场收服成功率 +${Math.round(CAPTURE_NET.bonus * 100)}%，剩余 ${netStock} 张）`}
                        title={`本场夜战收服成功率 +${Math.round(CAPTURE_NET.bonus * 100)}%，剩余 ${netStock} 张`}
                        className="rounded-lg border border-sky-300/40 bg-sky-400/15 px-2 py-1.5 text-[11px] font-bold text-sky-200 active:scale-95"
                      >
                        🕸️ +{Math.round(CAPTURE_NET.bonus * 100)}%
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRelease(captureTarget)}
                      className={cn(
                        'rounded-lg border px-2 py-1.5 text-[11px] active:scale-95',
                        wildTarget
                          ? 'border-amber-300/60 bg-amber-400/20 font-bold text-amber-100'
                          : 'border-white/15 bg-white/5 text-stone-300'
                      )}
                    >
                      {wildTarget ? '放归领赏' : '放归'}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={wildTarget || gemsTooLow}
                    onClick={handleCaptureClick}
                    aria-label={
                      wildTarget
                        ? '野性难驯，无法收服'
                        : gemsTooLow
                          ? `灵石不足，收服需 ${captureGemCost} 灵石`
                          : `收服（耗费 ${captureGemCost} 灵石）`
                    }
                    className={cn(
                      'rounded-lg px-5 py-1.5 text-sm font-black tracking-widest shadow-lg active:scale-95',
                      wildTarget
                        ? 'cursor-not-allowed bg-stone-600/60 text-stone-400 shadow-none'
                        : gemsTooLow
                          ? 'cursor-not-allowed bg-stone-600/60 text-stone-400 shadow-none'
                          : 'animate-pulse bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-500/30'
                    )}
                  >
                    {wildTarget
                      ? '无法收服'
                      : gemsTooLow
                        ? `灵石不足`
                        : (
                          <span className="flex items-center justify-center gap-1">
                            收 服
                            <span className="flex items-center gap-0.5 text-[10px] font-bold opacity-90">
                              −{captureGemCost}
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#8FE3C0] to-[#3FA98A]" aria-hidden />
                            </span>
                          </span>
                        )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* prep：布阵栏；fighting/结算：战况条 */}
        {phase === 'prep' ? (
          <LineupBar
            lineup={lineup}
            ownedIds={ownedIds}
            onPlace={handlePlace}
            onRemove={handleRemoveSlot}
            countdown={state.prepCountdown}
            selectedId={selectedYao}
            onSelectCard={setSelectedYao}
            maxSlots={maxSlots}
            innLevel={innLevel}
          />
        ) : phase === 'victory' || phase === 'failed' ? (
          <div
            className={cn(
              'border-t px-3 py-2.5 text-[11px]',
              bossNight ? 'border-rose-200/15 bg-[#2a0f16]/95' : 'border-white/10 bg-[#151231]/95'
            )}
          >
            <span
              className={cn(
                'font-bold',
                phase === 'victory' ? 'text-amber-200' : 'text-rose-300'
              )}
            >
              {phase === 'victory'
                ? bossNight
                  ? '👑 妖王退散，结算中…'
                  : '🎉 守店成功，结算中…'
                : bossNight
                  ? '💔 妖王太过强大，结算中…'
                  : '💔 战斗结束，结算中…'}
            </span>
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center gap-3 overflow-x-auto border-t px-3 py-2 text-[11px] text-stone-200',
              bossNight ? 'border-rose-200/15 bg-[#2a0f16]/95' : 'border-white/10 bg-[#151231]/95'
            )}
          >
            <span className="flex shrink-0 items-center gap-1">
              ⚔️ 击杀 <AnimNumber value={state.killCount} className="font-bold text-amber-200" />
            </span>
            <span className="flex shrink-0 items-center gap-1">
              💰 掉落
              <AnimNumber value={state.waveGold} className="font-bold text-amber-300" />
              金
            </span>
            {/* 收服耗灵石（V1.3.1）：夜战实时透出灵石余额 */}
            <span className="flex shrink-0 items-center gap-1">
              💎 灵石
              <AnimNumber value={gems} className={cn('font-bold', gemsTooLow ? 'text-rose-300' : 'text-emerald-300')} />
            </span>
            {state.capturedThisBattle.length > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                🎉 已收服 {state.capturedThisBattle.length}
              </span>
            )}
            <span className="ml-auto shrink-0" />
            {innLow && (
              <button
                type="button"
                onClick={() => setRepairAdOpen(true)}
                className="animate-pulse shrink-0 rounded-full border border-emerald-300/50 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200 active:scale-95"
              >
                📺 修复客栈
              </button>
            )}
          </div>
        )}
      </footer>

      {/* ======== 弹窗层 ======== */}
      {/* 撤退确认 */}
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl border-amber-200/25 bg-[#1c1836] p-5 text-stone-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-lg">今夜就撤吗？</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-xs leading-relaxed text-stone-300">
              中途撤退只能带走一半战利金币（当前约 +
              {Math.floor(state.waveGold * 0.5)} 金），已收服的妖怪不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="mt-0 flex-1 rounded-xl border-white/15 bg-white/5 text-stone-200 hover:bg-white/10 hover:text-stone-100">
              继续守店
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmExit}
              className="flex-1 rounded-xl border-0 bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-white hover:from-amber-600 hover:to-orange-600"
            >
              撤退结算
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 广告：客栈修复 */}
      <AdDialog
        scene="inn-repair"
        open={repairAdOpen}
        onOpenChange={setRepairAdOpen}
        onReward={handleRepairAdReward}
      />
      {/* 广告：捕捉加成 */}
      <AdDialog
        scene="capture-buff"
        open={captureAdOpen}
        onOpenChange={setCaptureAdOpen}
        onReward={handleCaptureAdReward}
      />
      {/* 收服成功庆祝：以妖怪 id 为 key，每次收服都是全新弹窗 */}
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
