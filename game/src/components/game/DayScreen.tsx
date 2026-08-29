'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings } from 'lucide-react'
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
import { AnimNumber, GoldIcon, GemIcon, TicketIcon, YaoAvatar } from './shared'
import { FacilityPanel } from './panels/FacilityPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { OfflineDialog } from './OfflineDialog'
import { SignInDialog } from './SignInDialog'
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

/** 场景建筑热点（九大设施：白天产出 + 夜晚定位联动；温泉汤院需客栈 5 级解锁建造） */
const HOTSPOTS: { key: FacilityKey; icon: string; label: string; className: string }[] = [
  { key: 'guestRoom', icon: '🛏️', label: '客房', className: 'left-[4%] top-[13%]' },
  { key: 'kitchen', icon: '🍲', label: '后厨', className: 'left-[3%] top-[46%]' },
  { key: 'hall', icon: '🏮', label: '大堂', className: 'right-[3%] top-[30%]' },
  { key: 'warehouse', icon: '📦', label: '仓库', className: 'left-[32%] bottom-[7%]' },
  { key: 'powerPool', icon: '🌀', label: '妖力池', className: 'right-[4%] top-[10%]' },
  { key: 'smithy', icon: '⚒️', label: '铁匠铺', className: 'right-[26%] bottom-[9%]' },
  { key: 'pharmacy', icon: '⚗️', label: '药房', className: 'left-[14%] top-[28%]' },
  { key: 'wishAltar', icon: '🌟', label: '许愿台', className: 'right-[30%] top-[24%]' },
  { key: 'hotSpring', icon: '♨️', label: '温泉', className: 'left-[26%] top-[7%]' },
]

const NAVS: { key: PanelKey; char: string; label: string }[] = [
  { key: 'yaokui', char: '妖', label: '妖怪' },
  { key: 'tujian', char: '册', label: '图鉴' },
  { key: 'task', char: '卷', label: '任务' },
  { key: 'shop', char: '袋', label: '商店' },
  { key: 'bag', char: '仓', label: '仓库' },
  { key: 'gather', char: '采', label: '采集' },
  { key: 'map', char: '舆', label: '地图' },
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
    toast({ title: res.ok ? '🕯️ 焚香引妖' : '提示', description: res.message })
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
    toast({ title: res.ok ? '🎉 节日礼包已入账' : '提示', description: res.message })
  }, [])

  // ---------- 面板状态 ----------
  const [facilityOpen, setFacilityOpen] = useState(false)
  const [facilityFocus, setFacilityFocus] = useState<FacilityKey | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)

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

  const openFacility = useCallback((key: FacilityKey) => {
    sfx.play('click')
    setFacilityFocus(key)
    setFacilityOpen(true)
  }, [])

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
  const workerIds = useMemo(
    () =>
      Object.entries(owned)
        .filter(([, o]) => o.deployed)
        .map(([id]) => id)
        .slice(0, 12), // 场景中最多同时游走 12 只，避免拥挤
    [owned]
  )

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
    return <div className="h-full w-full bg-gradient-to-b from-[#F7EEDC] to-[#EFE3C8]" aria-hidden />
  }

  return (
    <div className="relative flex h-full w-full flex-col gap-1.5 bg-gradient-to-b from-[#F7EEDC] to-[#EFE3C8] p-1.5">
      {/* ===== 顶部状态栏 ===== */}
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-30 flex h-14 shrink-0 items-center gap-1.5 rounded-2xl border border-[#8B5E3C]/70 bg-gradient-to-b from-[#B98A5F] to-[#9C6B44] px-2 shadow-lg"
      >
        <motion.div
          animate={{
            scale: goldPulse ? 1.15 : 1,
            boxShadow: goldPulse ? '0 0 14px rgba(232,184,75,0.85)' : '0 0 0px rgba(232,184,75,0)',
          }}
          transition={{
            scale: { type: 'spring', stiffness: 420, damping: 16 },
            boxShadow: { duration: 0.32, ease: 'easeOut' },
          }}
          className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-1"
        >
          <GoldIcon size={14} />
          <AnimNumber value={gold} className="text-[13px] font-bold text-[#FFE9B8]" />
        </motion.div>
        <div className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-1">
          <GemIcon size={14} />
          {/* 灵石挂机累积为小数，展示时取整避免浮点尾数（如 280.066…） */}
          <AnimNumber value={Math.floor(gems)} className="text-[13px] font-bold text-[#C8F4E4]" />
        </div>
        <div className="hidden items-center gap-1 rounded-full bg-black/25 px-2 py-1 min-[380px]:flex">
          <TicketIcon size={14} />
          <AnimNumber value={tickets} className="text-[13px] font-bold text-[#FFD9B8]" />
        </div>

        <div className="ml-auto flex flex-col items-end gap-0.5 pr-0.5">
          <span className="text-[10px] font-bold leading-none text-[#FFE9B8]">客栈 Lv.{innLevel}</span>
          <div className="h-1.5 w-[84px] overflow-hidden rounded-full bg-black/30" role="progressbar" aria-label="客栈经验">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E8B84B] to-[#F5D77E] transition-all duration-500"
              style={{ width: `${expPct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="设置"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20 text-[#FFE9B8] transition active:scale-90"
        >
          <Settings className="h-5 w-5" />
        </button>
      </motion.header>

      {/* ===== 节日彩蛋横幅（节日期间显示：礼包限领一次 + 挂机收益加成） ===== */}
      <AnimatePresence>
        {festival && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 34, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="relative z-20 flex shrink-0 items-center gap-1.5 overflow-hidden rounded-xl border px-2 shadow-md"
            style={{
              borderColor: `${festival.color}99`,
              background: `linear-gradient(100deg, ${festival.color}F0 0%, ${festival.color}CC 45%, #F5EDD8 135%)`,
            }}
            role="status"
            aria-label={`${festival.name}活动进行中，挂机收益加成${Math.round(festival.buff * 100)}%`}
          >
            <motion.span
              animate={{ y: [0, -2.5, 0], rotate: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              className="shrink-0 text-base leading-none drop-shadow"
            >
              {festival.icon}
            </motion.span>
            <span className="shrink-0 text-[11px] font-black tracking-wide text-[#FFF8E7] drop-shadow-sm">
              {festival.name}
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-[10px] leading-none text-[#FFF8E7]/90 min-[360px]:inline">
              {festival.greeting}
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-black/25 px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#FFE9B8] min-[360px]:ml-0">
              收益+{Math.round(festival.buff * 100)}%
            </span>
            {festivalGiftClaimed ? (
              <span className="shrink-0 rounded-full bg-white/75 px-2 py-1 text-[10px] font-bold leading-none text-stone-500">
                ✓ 已领
              </span>
            ) : (
              <motion.button
                type="button"
                onClick={claimFestival}
                whileTap={{ scale: 0.9 }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                aria-label={`领取${festival.name}礼包`}
                className="shrink-0 rounded-full bg-gradient-to-b from-[#F5D77E] to-[#E8B84B] px-2.5 py-1 text-[10px] font-black leading-none text-[#6B4A1F] shadow-sm"
              >
                领礼包
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 客栈场景区 ===== */}
      <main className="relative flex-1 overflow-hidden rounded-2xl border border-[#D4A574]/60 shadow-inner">
        {/* 底色渐变（图片加载中/失败时的背景） */}
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

        {/* 图片缺失时的降级装饰 */}
        {sceneFailed && (
          <>
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(circle at 72% 16%, rgba(232,184,75,0.4), transparent 45%)' }}
            />
            <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-b from-[#C9A96B]/50 to-[#A97B50]/60" />
            <span className="absolute left-[7%] top-[5%] text-2xl drop-shadow">🏮</span>
            <span className="absolute right-[8%] top-[6%] text-2xl drop-shadow">🏮</span>
            <div className="absolute left-1/2 top-[14%] -translate-x-1/2 rounded-lg border-2 border-[#8B5E3C] bg-[#9C6B44] px-4 py-1.5 text-lg font-black tracking-[0.3em] text-[#F5F0E8] shadow-lg">
              妖怪客栈
            </div>
          </>
        )}

        {/* 顶部压暗渐变，保证上层文字可读 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/20 to-transparent" />

        {/* 节日氛围：缓缓上升的节日符号（灯笼/花瓣/雪花…） */}
        {festival && (
          <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="absolute opacity-50 drop-shadow-sm"
                style={{ left: `${8 + i * 27}%`, fontSize: 12 + (i % 3) * 5 }}
                initial={{ y: '112%' }}
                animate={{ y: '-18%' }}
                transition={{ duration: 10 + i * 2.4, repeat: Infinity, delay: i * 3.2, ease: 'linear' }}
              >
                {festival.icon}
              </motion.span>
            ))}
          </div>
        )}

        {/* 每秒收益速率（聚宝符生效中附倒计时徽章） */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="absolute left-1/2 top-2.5 z-10 flex max-w-[92%] -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#D4A574]/70 bg-[#2D5A3D]/85 px-3 py-1 text-[11px] font-medium text-[#F5F0E8] shadow-md backdrop-blur-sm"
        >
          <span className="text-[#F5D77E]">+{rates.gold.toFixed(1)}</span>金币/秒
          <span className="opacity-40">|</span>
          <span className="text-[#9FE3C0]">+{rates.gem.toFixed(2)}</span>灵石/秒
          {hasteActive && (
            <span
              role="status"
              aria-label="聚宝符生效中，收益加倍"
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-[#7BA05B] to-[#5D8A43] px-1.5 py-px text-[9px] font-black text-white"
            >
              <span aria-hidden>🧿</span>×2 {fmtHasteRemain(hasteUntil - Date.now())}
            </span>
          )}
        </motion.div>

        {/* 全员体力总览 chip（均值分档配色，点击进妖库管理体力） */}
        {staminaStats.avg !== null && (
          <motion.button
            type="button"
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.32, duration: 0.35, ease: 'easeOut' }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              sfx.play('click')
              onOpenPanel('yaokui')
            }}
            aria-label={`全员体力平均 ${staminaStats.avg}，打开妖库查看体力`}
            className="absolute left-1/2 top-[38px] z-10 flex h-9 -translate-x-1/2 items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold text-[#F5F0E8] shadow-md backdrop-blur-sm"
            style={staminaAvgTone(staminaStats.avg)}
          >
            <span className="text-[12px] leading-none" aria-hidden>
              ⚡
            </span>
            <span>全员体力</span>
            <span className="font-black tabular-nums">{staminaStats.avg}</span>
          </motion.button>
        )}

        {/* 签到入口（今日可领时脉冲提醒） */}
        <motion.button
          type="button"
          initial={{ x: -16, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            sfx.play('click')
            setSignInOpen(true)
          }}
          aria-label="七日签到"
          className="absolute left-2 top-11 z-10 flex h-9 items-center gap-1.5 rounded-full border border-[#E8B84B]/80 bg-[#2D5A3D]/90 px-2.5 shadow-md backdrop-blur-sm active:scale-95"
        >
          <span className="text-base leading-none">🎁</span>
          <span className="text-[11px] font-bold leading-none text-[#F5D77E]">
            {signInReady ? '签到' : '已签'}
          </span>
          {signInReady && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-300 opacity-80" />
              <span className="relative inline-flex h-2 w-2 rounded-full border border-white bg-rose-500" />
            </span>
          )}
        </motion.button>

        {/* 建筑热点：点击打开设施升级 */}
        {HOTSPOTS.map((h, i) => (
          <motion.button
            key={h.key}
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 280, damping: 18 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => openFacility(h.key)}
            aria-label={`${h.label}设施`}
            className={cn(
              'absolute z-10 flex min-h-[48px] min-w-[56px] flex-col items-center gap-0.5 rounded-2xl border-2 border-[#D4A574] bg-[#F5F0E8]/90 px-2.5 py-1.5 shadow-md backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-[#E8B84B] hover:shadow-[0_6px_18px_rgba(212,165,116,0.55)]',
              h.className
            )}
          >
            <span className="text-xl leading-none">{h.icon}</span>
            <span className="whitespace-nowrap text-[10px] font-bold text-[#5C4033]">
              {h.label} Lv.{facilities[h.key]}
            </span>
          </motion.button>
        ))}

        {/* 打工小妖游走 */}
        {workerIds.map((id, i) => {
          const p = sprites[id]
          if (!p) return null
          // 体力状态角标：疲惫（<40）😪 / 虚脱（≈0）💀（纯 DOM span，数据只读 owned）
          const stamina = owned[id]?.stamina ?? 100
          const staminaIcon = stamina < 0.01 ? '💀' : stamina < 40 ? '😪' : null
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
              onClick={() => speak(id)}
              aria-label={`打工小妖 ${YAOGUAI_MAP[id]?.name ?? id}${
                staminaIcon ? (stamina < 0.01 ? '，体力虚脱' : '，体力不足') : ''
              }`}
              className="absolute z-20 p-1"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: (i * 0.4) % 2 }}
                className="flex flex-col items-center"
              >
                {/* 入场弹跳（独立子层，避免与位移/点按手势的 transition 互相干扰） */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 17, delay: 0.4 + i * 0.06 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative rounded-full bg-black/15 shadow-lg backdrop-blur-[1px]">
                    <YaoAvatar id={id} size={34} />
                    {staminaIcon && (
                      <span
                        aria-hidden
                        title={stamina < 0.01 ? '体力虚脱' : '体力疲惫'}
                        className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#D4A574] bg-[#F5F0E8] text-[10px] leading-none shadow-md"
                      >
                        {staminaIcon}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 rounded bg-black/45 px-1 text-[9px] font-medium leading-tight text-white">
                    {YAOGUAI_MAP[id]?.name ?? id}
                  </span>
                </motion.div>
              </motion.div>

              {/* 对话气泡 */}
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
                    <div className="relative rounded-xl border border-[#D4A574] bg-[#F5F0E8] px-2 py-1 text-[11px] font-medium text-[#5C4033] shadow-md">
                      {bubble.text}
                      <span className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] border-b border-r border-[#D4A574] bg-[#F5F0E8]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )
        })}

        {/* 无打工小妖提示 */}
        {workerIds.length === 0 && (
          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] text-[#F5F0E8]">
            在「妖怪」里安排小妖打工，收益更高哦～
          </div>
        )}

        {/* 体力预警横幅：打工妖体力 <20 提醒轮换；虚脱红色加强版；点击进妖库 */}
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
              className="absolute bottom-3 left-1/2 z-30 flex h-11 w-max max-w-[94%] -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-lg backdrop-blur-sm"
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
              <motion.span
                animate={{ x: [0, -2, 2, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                className="shrink-0 text-[13px] leading-none"
                aria-hidden
              >
                {staminaStats.collapsedName ? '💀' : '😪'}
              </motion.span>
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
                className="rounded-2xl border-2 border-[#E8B84B] bg-[#2D5A3D]/92 px-7 py-4 text-center shadow-2xl"
              >
                <p className="text-2xl leading-none">✨🏮✨</p>
                <p className="mt-1.5 text-lg font-black tracking-widest text-[#F5D77E]">客栈升级！</p>
                <p className="text-sm font-bold text-[#F5F0E8]">Lv.{levelUp} · 全店收益 +5%</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ===== 金币飞行层（覆盖全屏，飞向顶部金币栏） ===== */}
      <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
        <AnimatePresence>
          {flights.map((f) => (
            <motion.div
              key={f.id}
              className="absolute z-40 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-[#F5D77E] to-[#E8B84B] text-[10px] font-black text-[#7A5216] shadow-[0_0_10px_rgba(232,184,75,0.85)]"
              initial={{ left: `${f.x}%`, top: `${f.y}%`, scale: 0.3, opacity: 0 }}
              animate={{
                left: [`${f.x}%`, `${(f.x + 13) / 2}%`, '13%'],
                top: [`${f.y}%`, `${Math.max(10, (f.y + 4) / 2 - 13)}%`, '3.5%'],
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

      {/* ===== 妖王夜入口（解锁后可挑战；今日已退散可焚香再引；接近解锁时显示预告） ===== */}
      <AnimatePresence>
        {bossUnlocked && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            className="absolute bottom-[158px] right-3 z-40"
          >
            <span
              className={cn(
                'absolute -left-1 -top-1.5 -translate-x-full whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-md',
                canLureBoss ? 'bg-[#6B4226] text-[#FFE9C4]' : 'bg-[#7A2E2E] text-[#FFD9C0]'
              )}
            >
              {bossDoneToday
                ? canLureBoss
                  ? `🕯️ 焚香再引·${bossDef?.name ?? '妖王'}（×${bossLureCount}）`
                  : '今日妖王已退散'
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
                  : {
                      scale: [1, 1.07, 1],
                      boxShadow: [
                        '0 0 0px rgba(220,80,60,0.0)',
                        '0 0 18px rgba(220,80,60,0.55)',
                        '0 0 0px rgba(220,80,60,0.0)',
                      ],
                    }
              }
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              aria-label={
                bossDoneToday
                  ? canLureBoss
                    ? '焚香引妖：消耗妖王诱引香再召一场妖王夜'
                    : '妖王夜今日已完成'
                  : '挑战妖王夜'
              }
              className={cn(
                'flex h-[52px] w-[52px] flex-col items-center justify-center rounded-full border-2 shadow-xl active:scale-95',
                bossDoneToday && !canLureBoss
                  ? 'border-stone-500/60 bg-gradient-to-b from-stone-500 to-stone-700 text-stone-300 opacity-70'
                  : canLureBoss
                    ? 'border-[#E8B84B] bg-gradient-to-b from-[#8C6A2B] to-[#5C4013] text-[#FFE9C4] shadow-black/30'
                    : 'border-[#E86A4A] bg-gradient-to-b from-[#8C3A2B] to-[#5C2018] text-[#FFE4D0] shadow-black/30'
              )}
            >
              <span className="text-lg leading-none">{canLureBoss ? '🕯️' : '👹'}</span>
              <span className="mt-0.5 text-[9px] font-bold leading-none tracking-wider">
                {canLureBoss ? '焚香引妖' : '妖王夜'}
              </span>
            </motion.button>
          </motion.div>
        )}
        {!bossUnlocked && wins >= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.6 }}
            className="absolute bottom-[158px] right-3 z-40"
          >
            <span className="absolute -left-1 -top-1.5 -translate-x-full whitespace-nowrap rounded-full bg-stone-700/90 px-1.5 py-0.5 text-[9px] font-bold text-stone-300 shadow-md">
              守店胜 {wins}/{BOSS_NIGHT.unlockWins} 解锁
            </span>
            <button
              type="button"
              disabled
              aria-label={`妖王夜未解锁，还需守店胜利 ${BOSS_NIGHT.unlockWins - wins} 次`}
              className="flex h-[52px] w-[52px] cursor-not-allowed flex-col items-center justify-center rounded-full border-2 border-stone-500/50 bg-gradient-to-b from-stone-400/90 to-stone-600/90 text-stone-200/70 opacity-60 shadow-lg"
            >
              <span className="text-lg leading-none">🔒</span>
              <span className="mt-0.5 text-[9px] font-bold leading-none tracking-wider">妖王夜</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 入夜守店浮动按钮 ===== */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 16 }}
        className="absolute bottom-[82px] right-3 z-40"
      >
        <span className="absolute -left-8 -top-2 flex max-w-[120px] items-center gap-1 whitespace-nowrap rounded-full bg-[#8B5E3C] px-1.5 py-0.5 text-[9px] font-bold text-[#FFE9B8] shadow-md">
          {region !== 1 ? regionInfo.icon : ''}第{nightLevel}夜
          {region === 2 && <span className="text-[8px] opacity-90">水墨幽谷</span>}
          {region === 3 && <span className="text-[8px] opacity-90">沸火赤川</span>}
        </span>
        <motion.button
          type="button"
          onClick={onNight}
          whileTap={{ scale: 0.9 }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-label="入夜守店"
          className={cn(
            'flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 text-[#F5F0E8] shadow-xl shadow-black/30',
            region === 2
              ? 'border-[#B9C0CC] bg-gradient-to-b from-[#4A4658] to-[#33313E]'
              : region === 3
                ? 'border-[#E8A26B] bg-gradient-to-b from-[#A8402F] to-[#7C2D1F]'
                : 'border-[#E8B84B] bg-gradient-to-b from-[#37714B] to-[#2D5A3D]'
          )}
        >
          <span className="text-lg leading-none">{region === 2 ? '🖌️' : region === 3 ? '🔥' : '🌙'}</span>
          <span className="mt-0.5 text-[9px] font-bold leading-none tracking-wider">入夜</span>
        </motion.button>
      </motion.div>

      {/* ===== 底部功能栏 ===== */}
      <motion.nav
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-30 flex h-16 shrink-0 items-stretch gap-1 rounded-2xl border border-[#8B5E3C]/70 bg-gradient-to-b from-[#B98A5F] to-[#9C6B44] px-1.5 shadow-lg"
      >
        {NAVS.map((n) => {
          const dot =
            n.key === 'yaokui'
              ? starUpReady
              : n.key === 'task'
                ? taskClaimable || achievementClaimable
                : n.key === 'shop'
                  ? freeRecruitReady
                  : n.key === 'map'
                    ? regionUnlockable
                    : n.key === 'gather'
                      ? gatherCollectable
                      : false
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => {
                sfx.play('click')
                onOpenPanel(n.key)
              }}
              className="relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition active:scale-95 active:bg-black/10 hover:bg-black/5"
            >
              <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-[#FBF6E8] via-[#F0E2C0] to-[#DCC48E] text-sm font-black text-[#4A3222] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_3px_rgba(140,102,60,0.4),0_1px_2px_rgba(60,40,25,0.35)]">
                <span className="drop-shadow-[0_1px_0_rgba(255,250,235,0.8)]">{n.char}</span>
                {dot && (
                  <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-white bg-rose-500" />
                  </span>
                )}
              </span>
              <span className="text-[10px] font-semibold text-[#F5F0E8]/90">{n.label}</span>
            </button>
          )
        })}
      </motion.nav>

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
