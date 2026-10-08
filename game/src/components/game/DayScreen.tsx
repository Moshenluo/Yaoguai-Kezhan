'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore, STAR_UP_COST, bossNightUnlocked, signInAvailable } from '@/game/store'
import { sfx } from '@/game/audio'
import {
  ACHIEVEMENTS,
  BOSS_NIGHT,
  DAILY_TASKS,
  SKINS,
  activeFestival,
  currentBossId,
  festivalGiftId,
  innExpNeeded,
  region2Unlockable,
  region3Unlockable,
  regionDef,
} from '@/game/config'
import { achievementProgress } from '@/game/store'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import type { GameSave } from '@/game/types'
import { AnimNumber, ConfigIcon, GoldIcon, GemIcon, TicketIcon, YaoAvatar } from './shared'
import { FacilityPanel } from './panels/FacilityPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { OfflineDialog } from './OfflineDialog'
import { SignInDialog } from './SignInDialog'
import { DayGuide, type DayGuideStep } from './DayGuide'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export interface DayScreenProps {
  onOpenPanel: (panel: 'yaokui' | 'tujian' | 'task' | 'shop' | 'bag' | 'map' | 'gather') => void
  onNight: () => void
  /** 进入妖王夜（传说妖王挑战，解锁条件：累计守店胜3次） */
  onBossNight: () => void
}

type FacilityKey = keyof GameSave['facilities']
type PanelKey = 'yaokui' | 'tujian' | 'task' | 'shop' | 'bag' | 'map' | 'gather'

/** 场景建筑热点（靠边分布，让出院落中景给游走小妖；温泉汤院需客栈 5 级解锁建造） */
const HOTSPOTS: { key: FacilityKey; icon: string; label: string; className: string }[] = [
  { key: 'guestRoom', icon: '/images/ui/facility-guestRoom.png', label: '客房', className: 'left-[2%] top-[22%]' },
  { key: 'kitchen', icon: '/images/ui/facility-kitchen.png', label: '后厨', className: 'left-[1.5%] top-[50%]' },
  { key: 'hall', icon: '/images/ui/facility-hall.png', label: '大堂', className: 'right-[1.5%] top-[44%]' },
  { key: 'warehouse', icon: '/images/ui/facility-warehouse.png', label: '仓库', className: 'left-[34%] bottom-[20%]' },
  { key: 'powerPool', icon: '/images/ui/facility-powerPool.png', label: '妖力池', className: 'right-[2%] top-[20%]' },
  { key: 'smithy', icon: '/images/ui/facility-smithy.png', label: '铁匠铺', className: 'right-[16%] bottom-[20%]' },
  { key: 'pharmacy', icon: '/images/ui/facility-pharmacy.png', label: '药房', className: 'left-[15%] top-[36%]' },
  { key: 'wishAltar', icon: '/images/ui/facility-wishAltar.png', label: '许愿台', className: 'right-[20%] top-[30%]' },
  { key: 'hotSpring', icon: '/images/ui/facility-hotSpring.png', label: '温泉', className: 'left-[24%] top-[15%]' },
]

const NAVS: { key: PanelKey; icon: string; label: string }[] = [
  { key: 'yaokui', icon: '/images/ui/nav-yaokui.png', label: '妖怪' },
  { key: 'tujian', icon: '/images/ui/nav-tujian.png', label: '图鉴' },
  { key: 'task', icon: '/images/ui/nav-task.png', label: '任务' },
  { key: 'shop', icon: '/images/ui/nav-shop.png', label: '商店' },
  { key: 'bag', icon: '/images/ui/nav-bag.png', label: '仓库' },
]

const HUD_NAVS: { key: Extract<PanelKey, 'gather' | 'map'>; icon: string; label: string }[] = [
  { key: 'gather', icon: '/images/ui/nav-gather.png', label: '采集' },
  { key: 'map', icon: '/images/ui/nav-map.png', label: '地图' },
]

const WORKER_LINES = [
  '客官里边请～',
  '掌柜的，今日生意兴隆！',
  '擦桌抹凳，勤快些～',
  '再来一壶山泉水！',
  '干活干活，攒钱升星～',
  '今儿个客似云来！',
  '小本经营，童叟无欺～',
  '饭菜好香呀～',
  '晚上还要守店，先打个盹……',
  '工钱可别拖欠哦～',
]

/** 每日任务进度（与 store.taskProgress 同源逻辑，仅需事件计数） */
function taskProgressOf(id: string, events: GameSave['daily']['events']): number {
  switch (id) {
    case 'login':
      return 1
    case 'night':
      return events.night ?? 0
    case 'capture':
      return events.capture ?? 0
    case 'recruit':
      return events.recruit ?? 0
    case 'upgrade':
      return events.upgrade ?? 0
    case 'starup':
      return events.starup ?? 0
    case 'ad':
      return events.ad ?? 0
    default:
      return 0
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** 聚宝符剩余时长 mm:ss（≥1 小时显示 h:mm:ss） */
function fmtHasteRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s >= 3600) {
    const h = Math.floor(s / 3600)
    const mm = Math.floor((s % 3600) / 60)
    return `${h}:${String(mm).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 全员体力均值配色：≥70 绿 / 40-70 青绿 / 15-40 琥珀 / <15 红（背景带透明度，与速率胶囊同风格） */
function staminaAvgTone(avg: number): { backgroundColor: string; borderColor: string } {
  if (avg >= 70) return { backgroundColor: 'rgba(45,122,70,0.88)', borderColor: 'rgba(159,227,192,0.65)' }
  if (avg >= 40) return { backgroundColor: 'rgba(22,119,123,0.88)', borderColor: 'rgba(180,232,235,0.6)' }
  if (avg >= 15) return { backgroundColor: 'rgba(185,119,14,0.9)', borderColor: 'rgba(250,220,150,0.6)' }
  return { backgroundColor: 'rgba(192,57,43,0.92)', borderColor: 'rgba(250,180,170,0.6)' }
}

/** SSR 安全的挂载标记（避免 localStorage 存档导致水合不一致） */
const emptySubscribe = () => () => undefined
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

interface CoinFlight {
  id: number
  x: number
  y: number
}

interface WorkerSprite {
  x: number
  y: number
}

/** 白天经营主界面：挂机收益 + 场景互动 + 功能入口 */
export function DayScreen({ onOpenPanel, onNight, onBossNight }: DayScreenProps) {
  // ---------- 顶部状态数据 ----------
  const gold = useGameStore((s) => s.gold)
  const gems = useGameStore((s) => s.gems)
  const tickets = useGameStore((s) => s.tickets)
  const innLevel = useGameStore((s) => s.innLevel)
  const innExp = useGameStore((s) => s.innExp)
  const level = useGameStore((s) => s.level)
  const facilities = useGameStore((s) => s.facilities)
  const owned = useGameStore((s) => s.owned)
  const pendingOffline = useGameStore((s) => s.pendingOffline)
  // 聚宝符（V1.1 道具）：生效中显示限时收益徽章；速率需随激活/过期重算
  const hasteUntil = useGameStore((s) => s.haste?.until ?? 0)
  const hasteActive = hasteUntil > Date.now()

  // 每秒收益速率（goldRate/gemRate 为函数字段，仅在影响因素变化时重算）
  const rates = useMemo(() => {
    const s = useGameStore.getState()
    return { gold: s.goldRate(), gem: s.gemRate() }
  }, [innLevel, owned, facilities, hasteActive])

  // 红点：妖怪=可升星 / 任务=有已完成未领取 / 商店=每日免费招募未用
  const starUpReady = useGameStore((s) =>
    Object.values(s.owned).some(
      (o) => o.star < 5 && o.count >= (STAR_UP_COST[o.star + 1] ?? Number.POSITIVE_INFINITY)
    )
  )
  const taskClaimable = useGameStore((s) =>
    DAILY_TASKS.some(
      (t) => !s.daily.tasksClaimed.includes(t.id) && taskProgressOf(t.id, s.daily.events) >= t.target
    )
  )
  const achievementClaimable = useGameStore((s) =>
    ACHIEVEMENTS.some(
      (a) => !s.achievements.includes(a.id) && achievementProgress(s, a.id) >= a.target
    )
  )
  const freeRecruitReady = useGameStore((s) => !s.daily.freeRecruitUsed)

  // 妖王夜解锁与今日状态
  const bossUnlocked = useGameStore((s) => bossNightUnlocked(s))
  const bossDoneToday = useGameStore((s) => s.daily.bossNightDone)
  const bossWins = useGameStore((s) => s.stats.bossWins)
  const wins = useGameStore((s) => s.stats.wins)
  const bossDef = YAOGUAI_MAP[currentBossId(bossWins)]
  // 焚香引妖（V1.3.1）：今日妖王已退散后，持有妖王诱引香可再召一场
  const bossLureCount = useGameStore((s) => s.materials?.['boss-lure'] ?? 0)
  const canLureBoss = bossDoneToday && bossLureCount > 0
  const handleLureBoss = useCallback(() => {
    const res = useGameStore.getState().consumeBossLure()
    sfx.play(res.ok ? 'claim' : 'click')
    toast({ title: res.ok ? '焚香引妖' : '提示', description: res.message })
    if (res.ok) onBossNight()
  }, [onBossNight])

  // 世界地图：当前驻扎区域与区域二/三解锁进度（红点：可开分店时地图亮红点）
  const region = useGameStore((s) => s.region)
  const region2Opened = useGameStore((s) => s.region2Opened)
  const region2Level = useGameStore((s) => s.region2Level)
  const region3Level = useGameStore((s) => s.region3Level)
  const regionUnlockable = useGameStore((s) => region2Unlockable(s) || region3Unlockable(s))
  const regionInfo = regionDef(region)
  const nightLevel = region === 2 ? region2Level : region === 3 ? region3Level : level
  // 采集队：有可收取产出时「采」导航亮红点
  const gatherCollectable = useGameStore((s) =>
    Object.values(s.gather?.acc ?? {}).some((v) => v >= 1)
  )

  // 皮肤
  const skinId = useGameStore((s) => s.skin)
  const skinFilter = SKINS.find((k) => k.id === skinId)?.filter ?? 'none'

  // 签到：今日可领状态
  const signInReady = useGameStore((s) => signInAvailable(s))

  // 节日彩蛋：当前生效节日（礼包限领一次/年，挂机收益加成在 store.goldRate 内生效）
  const festival = useMemo(() => activeFestival(), [])
  const festivalGiftClaimed = useGameStore((s) =>
    festival ? s.festivalClaimed.includes(festivalGiftId(festival)) : false
  )
  const claimFestival = useCallback(() => {
    const res = useGameStore.getState().claimFestivalGift()
    sfx.play(res.ok ? 'claim' : 'click')
    toast({ title: res.ok ? '节日礼包已入账' : '提示', description: res.message })
  }, [])

  // ---------- 面板状态 ----------
  const [facilityOpen, setFacilityOpen] = useState(false)
  const [facilityFocus, setFacilityFocus] = useState<FacilityKey | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const [guideStep, setGuideStep] = useState<DayGuideStep | null>(null)

  const seenDayGuide = useGameStore((s) => s.settings.seenDayGuide)
  const markDayGuideSeen = useGameStore((s) => s.markDayGuideSeen)

  const finishGuide = useCallback(() => {
    markDayGuideSeen()
    setGuideStep(null)
  }, [markDayGuideSeen])

  const workerIds = useMemo(
    () =>
      Object.entries(owned)
        .filter(([, o]) => o.deployed)
        .map(([id]) => id)
        .slice(0, 12),
    [owned]
  )

  const advanceGuide = useCallback(() => {
    setGuideStep((cur) => {
      if (cur === null || cur >= 3) return cur
      if (cur === 1 && workerIds.length === 0) return 3
      return (cur + 1) as DayGuideStep
    })
  }, [workerIds.length])

  // 每日首次进入白天且未签到时，自动弹签到弹窗（仅一次，不重复打扰）
  const signInAutoShown = useRef(false)
  useEffect(() => {
    if (signInAutoShown.current) return
    if (signInReady && !pendingOffline) {
      signInAutoShown.current = true
      const t = setTimeout(() => setSignInOpen(true), 800)
      return () => clearTimeout(t)
    }
    if (!signInReady) signInAutoShown.current = true
  }, [signInReady, pendingOffline])

  // 离线/签到都关掉后再播三步引导；老档（已有守店胜）直接记看过
  useEffect(() => {
    if (seenDayGuide || guideStep !== null) return
    if (wins + bossWins > 0) {
      markDayGuideSeen()
      return
    }
    if (pendingOffline !== null || signInOpen) return
    if (signInReady && !signInAutoShown.current) return
    const t = window.setTimeout(() => setGuideStep(1), 450)
    return () => window.clearTimeout(t)
  }, [seenDayGuide, guideStep, pendingOffline, signInOpen, signInReady, wins, bossWins, markDayGuideSeen])

  const openFacility = useCallback(
    (key: FacilityKey) => {
      sfx.play('click')
      setFacilityFocus(key)
      setFacilityOpen(true)
      if (guideStep === 1) advanceGuide()
    },
    [advanceGuide, guideStep]
  )

  // ---------- 场景：白天客栈背景（图片缺失时降级为暖色渐变） ----------
  const [sceneFailed, setSceneFailed] = useState(false)

  // ---------- 体力可视化（白天侧只读 owned：总览 chip / 预警横幅 / 小妖角标） ----------
  const staminaStats = useMemo(() => {
    const entries = Object.values(owned)
    const avg = entries.length
      ? Math.round(
          entries.reduce((a, o) => a + (Number.isFinite(o.stamina) ? o.stamina : 100), 0) / entries.length
        )
      : null
    // 打工中且体力 <20：点名预警（取体力最低者）；其中虚脱（≈0）优先红色加强版
    let lowName: string | null = null
    let lowStamina = 20
    let collapsedName: string | null = null
    for (const [id, o] of Object.entries(owned)) {
      if (!o.deployed || o.stamina >= 20) continue
      const name = YAOGUAI_MAP[id]?.name ?? id
      if (o.stamina < 0.01 && collapsedName === null) collapsedName = name
      if (o.stamina < lowStamina) {
        lowStamina = o.stamina
        lowName = name
      }
    }
    return { avg, lowName, collapsedName }
  }, [owned])

  // ---------- 打工小妖游走 ----------

  const [sprites, setSprites] = useState<Record<string, WorkerSprite>>({})
  const [bubble, setBubble] = useState<{ id: string; text: string } | null>(null)

  // 新上阵的小妖分配初始位置；下阵的移除
  useEffect(() => {
    setSprites((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of workerIds) {
        if (!next[id]) {
          next[id] = { x: 10 + Math.random() * 68, y: 30 + Math.random() * 42 }
          changed = true
        }
      }
      for (const id of Object.keys(next)) {
        if (!workerIds.includes(id)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [workerIds])

  // 缓慢随机游走
  useEffect(() => {
    const t = setInterval(() => {
      setSprites((prev) => {
        const next: Record<string, WorkerSprite> = {}
        for (const [id, p] of Object.entries(prev)) {
          next[id] = {
            x: clamp(p.x + (Math.random() * 26 - 13), 6, 84),
            y: clamp(p.y + (Math.random() * 18 - 9), 27, 80),
          }
        }
        return next
      })
    }, 4200)
    return () => clearInterval(t)
  }, [])

  const speak = useCallback((id: string) => {
    const def = YAOGUAI_MAP[id]
    if (!def) return
    setBubble({
      id,
      text: `${def.name}：${WORKER_LINES[Math.floor(Math.random() * WORKER_LINES.length)]}`,
    })
  }, [])

  // 点击小妖 / 随机闲聊气泡（2.2 秒后消失）
  useEffect(() => {
    if (!bubble) return
    const t = setTimeout(() => setBubble(null), 2200)
    return () => clearTimeout(t)
  }, [bubble])

  // 偶尔自动冒出对话
  useEffect(() => {
    if (workerIds.length === 0) return
    const t = setInterval(() => {
      const id = workerIds[Math.floor(Math.random() * workerIds.length)]
      if (id) speak(id)
    }, 9000)
    return () => clearInterval(t)
  }, [workerIds, speak])

  // ---------- 金币抛物线飞行 ----------
  const coinSeq = useRef(0)
  const [flights, setFlights] = useState<CoinFlight[]>([])
  const [goldPulse, setGoldPulse] = useState(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pulseGold = useCallback(() => {
    sfx.play('coin')
    setGoldPulse(true)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setGoldPulse(false), 380)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setFlights((fs) => [
        ...fs.slice(-3),
        { id: ++coinSeq.current, x: 34 + Math.random() * 32, y: 40 + Math.random() * 20 },
      ])
    }, 3000)
    return () => {
      clearInterval(t)
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
    }
  }, [])

  // ---------- 客栈升级庆祝 ----------
  const prevInnLevel = useRef(innLevel)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  useEffect(() => {
    if (innLevel > prevInnLevel.current) {
      sfx.play('levelup')
      setLevelUp(innLevel)
      const t = setTimeout(() => setLevelUp(null), 2200)
      prevInnLevel.current = innLevel
      return () => clearTimeout(t)
    }
    prevInnLevel.current = innLevel
  }, [innLevel])

  const expNeeded = innExpNeeded(innLevel)
  const expPct = Math.min(100, (innExp / expNeeded) * 100)

  // SSR 首帧渲染占位背景，客户端挂载后再展示真实数据（存档来自 localStorage）
  const mounted = useMounted()
  if (!mounted) {
    return <div className="h-full w-full bg-gradient-to-b from-[#E8DECA] to-[#D7CBB2]" aria-hidden />
  }

  return (
    <div className="day-stage relative h-full w-full overflow-hidden">
      {/* ===== 全幅场景（单一构图底） ===== */}
      <div className="absolute inset-0" aria-hidden={false}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDF3DA] via-[#F5E6C4] to-[#E7CDA0]" />

        {!sceneFailed && (
          <img
            src="/images/scene/scene-day.png"
            alt="客栈白日场景"
            className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-700"
            style={{ filter: skinFilter }}
            onError={() => setSceneFailed(true)}
            draggable={false}
          />
        )}

        {sceneFailed && (
          <>
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle at 72% 16%, rgba(232,184,75,0.4), transparent 45%)' }}
            />
            <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-b from-[#C9A96B]/45 to-[#A97B50]/55" />
            <div className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-md border border-[#8B5E3C] bg-[#9C6B44]/95 px-5 py-1.5 font-display text-base font-black tracking-[0.35em] text-[#E6DCC8] shadow-lg">
              妖怪客栈
            </div>
          </>
        )}

        {/* 上下压暗，让 HUD / Dock 可读且场景仍是主体 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/22 via-black/8 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />

        {/* 节日氛围粒子（不抢主场景） */}
        {festival && (
          <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="absolute opacity-40 drop-shadow-sm"
                style={{ left: `${8 + i * 27}%` }}
                initial={{ y: '112%' }}
                animate={{ y: '-18%' }}
                transition={{ duration: 10 + i * 2.4, repeat: Infinity, delay: i * 3.2, ease: 'linear' }}
              >
                <ConfigIcon icon={festival.icon} size={12 + (i % 3) * 4} />
              </motion.span>
            ))}
          </div>
        )}

        {/* 建筑热点 */}
        {HOTSPOTS.map((h) => (
          <button
            key={h.key}
            type="button"
            onClick={() => openFacility(h.key)}
            aria-label={`${h.label}设施`}
            className={cn(
              'day-hotspot absolute z-10',
              h.className,
              guideStep === 1 && h.key === 'guestRoom' && 'z-[45] ring-2 ring-[#E8B84B] ring-offset-2 ring-offset-transparent'
            )}
          >
            <span className="day-hotspot-pin">
              <ConfigIcon icon={h.icon} size={22} />
              <span className="day-hotspot-lv">{facilities[h.key]}</span>
            </span>
            <span className="day-hotspot-name">{h.label}</span>
          </button>
        ))}

        {/* 打工小妖游走 */}
        {workerIds.map((id, i) => {
          const p = sprites[id]
          if (!p) return null
          const stamina = owned[id]?.stamina ?? 100
          const staminaBadge = stamina < 0.01 ? '虚' : stamina < 40 ? '疲' : null
          return (
            <motion.button
              key={id}
              type="button"
              initial={{ left: `${p.x}%`, top: `${p.y}%` }}
              animate={{ left: `${p.x}%`, top: `${p.y}%` }}
              transition={{
                left: { duration: 4, ease: 'easeInOut' },
                top: { duration: 4, ease: 'easeInOut' },
              }}
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                speak(id)
                if (guideStep === 2 && i === 0) advanceGuide()
              }}
              aria-label={`打工小妖 ${YAOGUAI_MAP[id]?.name ?? id}${
                staminaBadge ? (stamina < 0.01 ? '，体力虚脱' : '，体力不足') : ''
              }`}
              className={cn(
                'absolute z-20 p-1',
                guideStep === 2 && i === 0 && 'z-[45] rounded-full ring-2 ring-[#E8B84B]'
              )}
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: (i * 0.4) % 2 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 17, delay: 0.4 + i * 0.06 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative rounded-full bg-black/15 shadow-lg backdrop-blur-[1px]">
                    <YaoAvatar id={id} size={34} />
                    {staminaBadge && (
                      <span
                        aria-hidden
                        title={stamina < 0.01 ? '体力虚脱' : '体力疲惫'}
                        className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#6A442C] bg-[#E6DCC8] text-[9px] font-black leading-none text-[#8B2E24] shadow-md"
                      >
                        {staminaBadge}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 rounded bg-black/45 px-1 text-[9px] font-medium leading-tight text-white">
                    {YAOGUAI_MAP[id]?.name ?? id}
                  </span>
                </motion.div>
              </motion.div>

              <AnimatePresence>
                {bubble?.id === id && (
                  <motion.div
                    key={`${bubble.id}-${bubble.text}`}
                    initial={{ opacity: 0, y: 8, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap"
                  >
                    <div className="relative rounded-xl border border-[#6A442C]/55 bg-[#E6DCC8] px-2 py-1 text-[11px] font-medium text-[#5C4033] shadow-md">
                      {bubble.text}
                      <span className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] border-b border-r border-[#6A442C]/55 bg-[#E6DCC8]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}

        {workerIds.length === 0 && (
          <div className="absolute bottom-[5.75rem] left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-[#E6DCC8]">
            在「妖怪」里安排小妖打工，收益更高哦～
          </div>
        )}

        {/* 体力预警横幅 */}
        <AnimatePresence>
          {(staminaStats.collapsedName ?? staminaStats.lowName) !== null && (
            <motion.button
              key={staminaStats.collapsedName ? 'stamina-collapse' : 'stamina-low'}
              type="button"
              initial={{ y: 24, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 340, damping: 24 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                sfx.play('click')
                onOpenPanel('yaokui')
              }}
              aria-label={
                staminaStats.collapsedName
                  ? `${staminaStats.collapsedName}体力虚脱已停止工作，打开妖库处理`
                  : `${staminaStats.lowName}等妖怪体力不支，打工效率下降，打开妖库轮换`
              }
              className="absolute bottom-[5.75rem] left-1/2 z-30 flex h-10 w-max max-w-[92%] -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-lg backdrop-blur-sm"
              style={
                staminaStats.collapsedName
                  ? {
                      backgroundColor: 'rgba(192,57,43,0.93)',
                      borderColor: 'rgba(255,190,175,0.7)',
                      color: '#FFF0EA',
                    }
                  : {
                      backgroundColor: 'rgba(185,119,14,0.92)',
                      borderColor: 'rgba(255,225,160,0.65)',
                      color: '#FFF7E0',
                    }
              }
            >
              <span className="day-seal shrink-0 text-[11px] leading-none" aria-hidden>
                {staminaStats.collapsedName ? '虚' : '疲'}
              </span>
              <span className="min-w-0 truncate">
                {staminaStats.collapsedName
                  ? `${staminaStats.collapsedName}体力虚脱已停止工作`
                  : `${staminaStats.lowName}等妖怪体力不支，打工效率下降`}
              </span>
              <span className="shrink-0 rounded-full bg-black/25 px-1.5 py-0.5 text-[9px] font-black leading-none">
                {staminaStats.collapsedName ? '去处理' : '去轮换'}
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* 客栈升级庆祝 */}
        <AnimatePresence>
          {levelUp !== null && (
            <motion.div
              key={levelUp}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.5, y: 24 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: -24 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="rounded-2xl border-2 border-[#E8B84B] bg-[#8B2E24]/92 px-7 py-4 text-center shadow-2xl"
              >
                <p className="font-display text-sm tracking-[0.4em] text-[#F5D77E]/80">升</p>
                <p className="mt-1 text-lg font-black tracking-widest text-[#F5D77E]">客栈升级！</p>
                <p className="text-sm font-bold text-[#E6DCC8]">Lv.{levelUp} · 全店收益 +5%</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== 顶部 HUD 叠层 ===== */}
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="day-hud absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-1.5 px-2.5 pt-[max(0.15rem,env(safe-area-inset-top,0px))]"
      >
        <motion.div
          animate={{
            scale: goldPulse ? 1.1 : 1,
            boxShadow: goldPulse ? '0 0 12px rgba(232,184,75,0.7)' : '0 0 0px rgba(232,184,75,0)',
          }}
          transition={{
            scale: { type: 'spring', stiffness: 420, damping: 16 },
            boxShadow: { duration: 0.32, ease: 'easeOut' },
          }}
          className="day-res-pill"
        >
          <GoldIcon size={13} />
          <AnimNumber value={gold} className="text-[12px] font-bold tabular-nums text-[#FFE9B8]" />
        </motion.div>
        <div className="day-res-pill">
          <GemIcon size={13} />
          <AnimNumber value={Math.floor(gems)} className="text-[12px] font-bold tabular-nums text-[#C8F4E4]" />
        </div>
        <div className="day-res-pill hidden min-[360px]:inline-flex">
          <TicketIcon size={13} />
          <AnimNumber value={tickets} className="text-[12px] font-bold tabular-nums text-[#FFD9B8]" />
        </div>

        <div className="ml-auto flex min-w-0 flex-col items-end gap-0.5 pr-0.5">
          <span className="font-display text-[10px] font-bold leading-none tracking-wide text-[#FFE9B8]">
            客栈 Lv.{innLevel}
          </span>
          <div className="h-1 w-[72px] overflow-hidden rounded-full bg-black/40" role="progressbar" aria-label="客栈经验">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E8B84B] to-[#F5D77E] transition-all duration-500"
              style={{ width: `${expPct}%` }}
            />
          </div>
        </div>

        {HUD_NAVS.map((n) => {
          const dot = n.key === 'map' ? regionUnlockable : gatherCollectable
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => {
                sfx.play('click')
                onOpenPanel(n.key)
              }}
              aria-label={n.label}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FFE9B8]/12 bg-black/25 transition active:scale-90"
            >
              <ConfigIcon icon={n.icon} size={20} />
              {dot && (
                <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full border border-[#3a1410] bg-[#D0453B] shadow-sm" />
              )}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="设置"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FFE9B8]/12 bg-black/25 transition active:scale-90"
        >
          <ConfigIcon icon="/images/ui/settings.png" size={20} />
        </button>
      </motion.header>

      {/* 节日横幅：次级叠层，不占主构图 */}
      <AnimatePresence>
        {festival && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-x-2 top-[3.15rem] z-20 flex h-7 items-center gap-1 overflow-hidden rounded-md border px-1.5 shadow-md"
            style={{
              borderColor: `${festival.color}88`,
              background: `linear-gradient(100deg, ${festival.color}E8 0%, ${festival.color}B8 50%, rgba(28,25,21,0.82) 130%)`,
            }}
            role="status"
            aria-label={`${festival.name}活动进行中，挂机收益加成${Math.round(festival.buff * 100)}%`}
          >
            <span className="shrink-0 leading-none opacity-90" aria-hidden>
              <ConfigIcon icon={festival.icon} size={14} />
            </span>
            <span className="shrink-0 text-[10px] font-black tracking-wide text-[#FFF8E7]">{festival.name}</span>
            <span className="ml-auto shrink-0 rounded bg-black/30 px-1 py-px text-[8px] font-bold text-[#FFE9B8]">
              +{Math.round(festival.buff * 100)}%
            </span>
            {festivalGiftClaimed ? (
              <span className="shrink-0 text-[9px] font-bold text-white/70">已领</span>
            ) : (
              <motion.button
                type="button"
                onClick={claimFestival}
                whileTap={{ scale: 0.92 }}
                aria-label={`领取${festival.name}礼包`}
                className="shrink-0 rounded bg-gradient-to-b from-[#F5D77E] to-[#E8B84B] px-1.5 py-0.5 text-[9px] font-black text-[#6B4A1F]"
              >
                领
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 收益 / 体力：一条墨芯片，少挡院子 */}
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        className={cn(
          'absolute left-1/2 z-20 flex max-w-[72%] -translate-x-1/2 items-center',
          festival ? 'top-[5.35rem]' : 'top-[3.25rem]'
        )}
      >
        <div className="ui-ink-chip flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-[#E6DCC8]">
          <span className="text-[#DFC56A]">+{rates.gold.toFixed(1)}</span>
          <span className="opacity-70">金</span>
          <span className="opacity-30">·</span>
          <span className="text-[#B5A48C]">+{rates.gem.toFixed(2)}</span>
          <span className="opacity-70">灵</span>
          {hasteActive && (
            <span
              role="status"
              aria-label="聚宝符生效中，收益加倍"
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-[#8B2E24] to-[#5C3A24] px-1.5 py-px text-[8px] font-black text-[#E6DCC8]"
            >
              <span className="day-seal text-[8px] text-[#F5D77E]" aria-hidden>
                聚
              </span>
              ×2 {fmtHasteRemain(hasteUntil - Date.now())}
            </span>
          )}
          {staminaStats.avg !== null && (
            <>
              <span className="opacity-30">·</span>
              <button
                type="button"
                onClick={() => {
                  sfx.play('click')
                  onOpenPanel('yaokui')
                }}
                aria-label={`全员体力平均 ${staminaStats.avg}，打开妖库查看体力`}
                className="flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-bold text-[#E6DCC8]"
                style={staminaAvgTone(staminaStats.avg)}
              >
                <span className="day-seal text-[8px] text-[#F5D77E]" aria-hidden>
                  力
                </span>
                <span className="font-black tabular-nums">{staminaStats.avg}</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* 签到：侧边硃砂印，次级入口 */}
      <motion.button
        type="button"
        initial={{ x: -12, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.35 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          sfx.play('click')
          setSignInOpen(true)
        }}
        aria-label="七日签到"
        className={cn(
          'absolute left-2 z-20 flex h-11 w-11 flex-col items-center justify-center rounded-md border-2 border-[#B83A2E]/75 bg-[#E6DCC8]/92 shadow-md',
          festival ? 'top-[5.4rem]' : 'top-[3.3rem]'
        )}
      >
        <span className="day-seal text-base leading-none">签</span>
        <span className="mt-0.5 text-[8px] font-bold leading-none text-[#6B4226]">
          {signInReady ? '可领' : '已签'}
        </span>
        {signInReady && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-80" />
            <span className="relative inline-flex h-2 w-2 rounded-full border border-white bg-rose-500" />
          </span>
        )}
      </motion.button>

      {/* 金币飞行层 */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        <AnimatePresence>
          {flights.map((f) => (
            <motion.div
              key={f.id}
              className="absolute z-40 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-[#F5D77E] to-[#E8B84B] text-[10px] font-black text-[#7A5216] shadow-[0_0_10px_rgba(232,184,75,0.85)]"
              initial={{ left: `${f.x}%`, top: `${f.y}%`, scale: 0.3, opacity: 0 }}
              animate={{
                left: [`${f.x}%`, `${(f.x + 13) / 2}%`, '11%'],
                top: [`${f.y}%`, `${Math.max(10, (f.y + 4) / 2 - 13)}%`, '2.5%'],
                scale: [0.3, 1, 0.45],
                opacity: [0, 1, 0.95],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.35, ease: 'easeInOut', times: [0, 0.55, 1] }}
              onAnimationComplete={() => {
                setFlights((fs) => fs.filter((x) => x.id !== f.id))
                pulseGold()
              }}
            >
              金
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 妖王夜：次级入口，贴底栏上方左侧，不抢入夜 CTA */}
      <AnimatePresence>
        {bossUnlocked && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            className="absolute bottom-[4.85rem] left-2.5 z-30"
          >
            <span
              className={cn(
                'mb-0.5 block max-w-[9.5rem] truncate rounded px-1 py-px text-[8px] font-bold shadow-sm',
                canLureBoss ? 'bg-[#6B4226]/95 text-[#FFE9C4]' : 'bg-[#7A2E2E]/90 text-[#FFD9C0]'
              )}
            >
              {bossDoneToday
                ? canLureBoss
                  ? `焚香·${bossDef?.name ?? '妖王'}×${bossLureCount}`
                  : '今日已退散'
                : `今夜·${bossDef?.name ?? '妖王'}`}
            </span>
            <motion.button
              type="button"
              disabled={bossDoneToday && !canLureBoss}
              onClick={() => {
                if (canLureBoss) {
                  handleLureBoss()
                } else if (!bossDoneToday) {
                  sfx.play('click')
                  onBossNight()
                }
              }}
              whileTap={bossDoneToday && !canLureBoss ? undefined : { scale: 0.9 }}
              animate={
                bossDoneToday && !canLureBoss
                  ? undefined
                  : { scale: [1, 1.05, 1] }
              }
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              aria-label={
                bossDoneToday
                  ? canLureBoss
                    ? '焚香引妖：消耗妖王诱引香再召一场妖王夜'
                    : '妖王夜今日已完成'
                  : '挑战妖王夜'
              }
              className={cn(
                'flex h-10 w-10 flex-col items-center justify-center rounded-md border shadow-lg active:scale-95',
                bossDoneToday && !canLureBoss
                  ? 'border-stone-500/50 bg-stone-600/80 text-stone-300 opacity-65'
                  : canLureBoss
                    ? 'border-[#E8B84B]/80 bg-gradient-to-b from-[#8C6A2B] to-[#5C4013] text-[#FFE9C4]'
                    : 'border-[#E86A4A]/75 bg-gradient-to-b from-[#8C3A2B] to-[#5C2018] text-[#FFE4D0]'
              )}
            >
              <span className="font-display text-sm font-black leading-none">
                {canLureBoss ? '香' : '王'}
              </span>
              <span className="mt-0.5 text-[7px] font-bold leading-none tracking-wide">
                {canLureBoss ? '引妖' : '妖王'}
              </span>
            </motion.button>
          </motion.div>
        )}
        {!bossUnlocked && wins >= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-[4.85rem] left-2.5 z-30"
          >
            <span className="mb-0.5 block rounded bg-stone-800/85 px-1 py-px text-[8px] font-bold text-stone-300">
              胜{wins}/{BOSS_NIGHT.unlockWins}
            </span>
            <button
              type="button"
              disabled
              aria-label={`妖王夜未解锁，还需守店胜利 ${BOSS_NIGHT.unlockWins - wins} 次`}
              className="flex h-10 w-10 cursor-not-allowed flex-col items-center justify-center rounded-md border border-stone-500/40 bg-stone-600/70 text-stone-200/60 opacity-55"
            >
              <span className="font-display text-sm font-black leading-none">锁</span>
              <span className="mt-0.5 text-[7px] font-bold leading-none">妖王</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 底部木制坞：印章导航 + 入夜主 CTA ===== */}
      <motion.nav
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'day-dock ui-wood absolute inset-x-0 bottom-0 z-30 flex items-end gap-1 px-1.5 pt-1',
          guideStep === 3 && 'z-[45]'
        )}
        aria-label="功能导航"
      >
        <div className="flex min-w-0 flex-1 items-stretch gap-1 pb-0.5">
          {NAVS.map((n) => {
            const dot =
              n.key === 'yaokui'
                ? starUpReady
                : n.key === 'task'
                  ? taskClaimable || achievementClaimable
                  : n.key === 'shop'
                    ? freeRecruitReady
                    : false
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => {
                  sfx.play('click')
                  onOpenPanel(n.key)
                }}
                aria-label={n.label}
                className="relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition active:scale-95 active:bg-black/15 hover:bg-black/5"
              >
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <ConfigIcon icon={n.icon} size={28} />
                  {dot && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full border border-[#3a1410] bg-[#D0453B] shadow-sm" />
                  )}
                </span>
                <span className="truncate text-[9px] font-semibold tracking-wide text-[#FFF6DF]/88">{n.label}</span>
              </button>
            )
          })}
        </div>

        {/* 入夜 / 守店：唯一主 CTA */}
        <div className={cn('relative shrink-0 pb-0.5', guideStep === 3 && 'z-[45]')}>
          <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-[#6A442C]/95 px-1.5 py-px text-[8px] font-bold text-[#FFE9B8] shadow-sm">
            {region !== 1 ? `${regionInfo.name}·` : ''}第{nightLevel}夜
          </span>
          <motion.button
            type="button"
            onClick={() => {
              if (guideStep !== null) finishGuide()
              onNight()
            }}
            whileTap={{ scale: 0.92 }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-label="入夜守店"
            data-region={region}
            className="day-cta-night flex h-[3.85rem] w-[3.85rem] flex-col items-center justify-center rounded-xl text-[#E6DCC8]"
          >
            <ConfigIcon icon="/images/ui/status-moon.png" size={26} className="drop-shadow-[0_0_6px_rgba(232,184,75,0.55)]" />
            <span className="mt-0.5 text-[10px] font-bold leading-none tracking-widest">入夜</span>
          </motion.button>
        </div>
      </motion.nav>

      {guideStep !== null && (
        <DayGuide
          step={guideStep}
          onNext={guideStep === 3 ? finishGuide : advanceGuide}
          onSkip={finishGuide}
        />
      )}

      {/* ===== 弹窗层 ===== */}
      <FacilityPanel
        open={facilityOpen}
        onOpenChange={(o) => {
          setFacilityOpen(o)
          if (!o) setFacilityFocus(undefined)
        }}
        focusKey={facilityFocus}
      />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      <OfflineDialog open={pendingOffline !== null} onOpenChange={() => undefined} />
      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  )
}
