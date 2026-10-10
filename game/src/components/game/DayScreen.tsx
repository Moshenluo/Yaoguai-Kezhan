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
import { SCENE_COMPS, nextPieceGate, sceneCap, sceneTierIndex, sceneTotalCap } from '@/game/scene-layers'
import type { GameSave } from '@/game/types'
import { AnimNumber, ConfigIcon, GoldIcon, GemIcon, TicketIcon, YaoFigure } from './shared'
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
  const scenePiecesRaw = useGameStore((s) => s.scenePieces)
  const setPiecePos = useGameStore((s) => s.setPiecePos)
  const flipPiece = useGameStore((s) => s.flipPiece)
  const removePiece = useGameStore((s) => s.removePiece)
  const addPiece = useGameStore((s) => s.addPiece)
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
  // ---------- 场景组件层：地形底图缺失时回退整图 ----------
  const [terrainFailed, setTerrainFailed] = useState(false)
  // ---------- 装扮模式：拖拽摆放 / 缩放 / 翻转 / 货单安放（多实例） ----------
  const [dressing, setDressing] = useState(false)
  const [dragPos, setDragPos] = useState<Record<string, { x: number; y: number; s?: number }>>({})
  const [selId, setSelId] = useState<string | null>(null)
  const dragRef = useRef<string | null>(null) // 贴片实例 id 或 `new:<compKey>`（货单拖出）
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragModeRef = useRef<'move' | 'scale'>('move')
  const scaleRef = useRef<{ cx: number; cy: number; dist: number; s: number; x: number; y: number } | null>(null)
  const dragPosRef = useRef<Record<string, { x: number; y: number; s?: number }>>({})
  const stageRef = useRef<HTMLDivElement | null>(null)
  // ---------- 顶栏收纳：资源锦囊抽屉 ----------
  const [resDrawerOpen, setResDrawerOpen] = useState(false)
  const writeDrag = useCallback((id: string, pos: { x: number; y: number; s?: number }) => {
    dragPosRef.current = { ...dragPosRef.current, [id]: pos }
    setDragPos(dragPosRef.current)
  }, [])

  // 场景贴片实例：设施随等级换皮肤（Lv.0 不显示），装饰全显；z 序按 y 升序（越靠下越在前）
  const scenePieces = useMemo(() => {
    if (terrainFailed) return []
    return (scenePiecesRaw ?? [])
      .map((pc) => {
        const comp = SCENE_COMPS.find((c) => c.key === pc.key)
        if (!comp) return null
        const d = dragPos[pc.id]
        const pos = { x: d?.x ?? pc.x, y: d?.y ?? pc.y, s: d?.s ?? pc.s }
        if (comp.facility) {
          const lvl = facilities[pc.key as FacilityKey] ?? 0
          if (lvl <= 0) return null
          return { id: pc.id, comp, pos, f: pc.f === true, tier: sceneTierIndex(lvl) ?? 0, ghost: false, lv: lvl }
        }
        return { id: pc.id, comp, pos, f: pc.f === true, tier: 0, ghost: false, lv: 0 }
      })
      .filter((p) => p !== null)
      .sort((a, b) => a.pos.y - b.pos.y)
  }, [scenePiecesRaw, facilities, dragPos, terrainFailed])

  // 拖拽：底部中心锚点跟随指针，抬起时写存档（全局监听，不依赖 setPointerCapture）
  const onPiecePointerDown = useCallback(
    (id: string) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dressing) return
      e.preventDefault()
      dragRef.current = id
      dragModeRef.current = 'move'
      dragStartRef.current = { x: e.clientX, y: e.clientY }
    },
    [dressing]
  )

  // 缩放角柄：以底部中心锚点为圆心，按指针距离等比缩放
  const onScaleHandleDown = useCallback(
    (id: string) => (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!dressing) return
      e.preventDefault()
      e.stopPropagation()
      const rect = (e.currentTarget.parentElement as HTMLDivElement | null)?.getBoundingClientRect()
      if (!rect) return
      const piece = (useGameStore.getState().scenePieces ?? []).find((p) => p.id === id)
      if (!piece) return
      const cx = rect.left + rect.width / 2
      const cy = rect.bottom
      dragRef.current = id
      dragModeRef.current = 'scale'
      dragStartRef.current = { x: e.clientX, y: e.clientY }
      scaleRef.current = {
        cx,
        cy,
        dist: Math.max(12, Math.hypot(e.clientX - cx, e.clientY - cy)),
        s: piece.s ?? 1,
        x: piece.x,
        y: piece.y,
      }
    },
    [dressing]
  )

  useEffect(() => {
    if (!dressing) return
    const move = (e: PointerEvent) => {
      const id = dragRef.current
      if (!id) return
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return
      if (dragModeRef.current === 'scale' && scaleRef.current) {
        const sc = scaleRef.current
        const dist = Math.max(12, Math.hypot(e.clientX - sc.cx, e.clientY - sc.cy))
        // 自由缩放：连续值（0.01 精度），不做档位量化
        const s = Math.max(0.5, Math.min(2.5, (sc.s * dist) / sc.dist))
        scaleRef.current = { ...sc, s }
        writeDrag(id, { x: sc.x, y: sc.y, s })
        return
      }
      const x = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(4, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100))
      writeDrag(id, { x, y })
    }
    const up = (e: PointerEvent) => {
      const ref = dragRef.current
      dragRef.current = null
      if (!ref) return
      const st = dragStartRef.current
      dragStartRef.current = null
      const moved = !!st && (Math.abs(e.clientX - st.x) >= 8 || Math.abs(e.clientY - st.y) >= 8)
      const rect = stageRef.current?.getBoundingClientRect()
      // 货单拖出：new:<compKey> —— 落点安放新实例；轻点则摆默认位
      if (ref.startsWith('new:')) {
        const key = ref.slice(4)
        const comp = SCENE_COMPS.find((c) => c.key === key)
        if (!comp) return
        const st2 = useGameStore.getState()
        const lvl = comp.facility ? (st2.facilities[key as FacilityKey] ?? 0) : 0
        if (comp.facility && lvl <= 0) {
          toast({ title: '尚未建造', description: `先建造「${comp.label}」设施后再摆放` })
          return
        }
        const cap = sceneCap(comp, lvl)
        if ((st2.scenePieces ?? []).filter((p) => p.key === key).length >= cap) {
          const gate = nextPieceGate(comp, lvl)
          toast({
            title: '已达上限',
            description: comp.facility
              ? gate
                ? `${comp.label}下一座需设施 Lv.${gate}`
                : `${comp.label}最多可摆 ${cap} 座`
              : `${comp.label}最多可摆 ${cap} 件`,
          })
          return
        }
        if ((st2.scenePieces ?? []).length >= sceneTotalCap(st2.innLevel)) {
          toast({
            title: '庭院已满',
            description: `全院最多摆放 ${sceneTotalCap(st2.innLevel)} 件，客栈升级可扩容`,
          })
          return
        }
        const x = moved && rect ? Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100)) : comp.x
        const y = moved && rect ? Math.max(4, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100)) : comp.y
        const newId = useGameStore.getState().addPiece(key, Math.round(x * 10) / 10, Math.round(y * 10) / 10)
        if (newId) sfx.play('click')
        return
      }
      // 实例操作
      if (dragModeRef.current === 'scale') {
        const sc = scaleRef.current
        scaleRef.current = null
        dragModeRef.current = 'move'
        if (sc) setPiecePos(ref, sc.x, sc.y, sc.s)
        return
      }
      const pos = dragPosRef.current[ref]
      delete dragPosRef.current[ref]
      if (moved && pos) {
        setPiecePos(ref, Math.round(pos.x * 10) / 10, Math.round(pos.y * 10) / 10)
      } else if (!moved) {
        // 未移动（位移 < 8px）视为点选：切换选中态（缩放/翻转/收回）
        setSelId((k) => (k === ref ? null : ref))
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dressing, setPiecePos, writeDrag])

  // 选中贴片缩放（± 按钮微调步进 0.1；拖拽手柄为自由缩放，范围 0.5~2.5）
  const scaleSel = useCallback(
    (delta: number) => {
      const id = selId
      if (!id) return
      const pc = (useGameStore.getState().scenePieces ?? []).find((p) => p.id === id)
      if (!pc) return
      const next = Math.max(0.5, Math.min(2.5, Math.round(((pc.s ?? 1) + delta) * 10) / 10))
      setPiecePos(id, pc.x, pc.y, next)
    },
    [selId, setPiecePos]
  )

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
  const resPillRef = useRef<HTMLButtonElement | null>(null)
  const flyTargetRef = useRef<{ x: number; y: number }>({ x: 11, y: 2.5 })

  const pulseGold = useCallback(() => {
    sfx.play('coin')
    setGoldPulse(true)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setGoldPulse(false), 380)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      // 落点动态对准顶栏锦囊钮的金币图标（换布局也不跑偏）
      const pill = resPillRef.current
      const stage = stageRef.current
      if (pill && stage) {
        const pr = pill.getBoundingClientRect()
        const sr = stage.getBoundingClientRect()
        if (sr.width > 0 && sr.height > 0) {
          flyTargetRef.current = {
            x: ((pr.left + 14 - sr.left) / sr.width) * 100,
            y: ((pr.top + pr.height / 2 - sr.top) / sr.height) * 100,
          }
        }
      }
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
    <div className="day-stage relative h-full w-full overflow-hidden" ref={stageRef}>
      {/* ===== 全幅场景（地形底图 + 设施建筑贴片；地形缺失时回退整图） ===== */}
      <div className="absolute inset-0" aria-hidden={false}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDF3DA] via-[#F5E6C4] to-[#E7CDA0]" />

        {!sceneFailed && !terrainFailed && (
          <img
            src="/images/scene/terrain-empty.png"
            alt="客栈山间空地"
            className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-700"
            style={{ filter: skinFilter }}
            onError={() => setTerrainFailed(true)}
            draggable={false}
          />
        )}

        {!sceneFailed && terrainFailed && (
          <img
            src="/images/scene/scene-day.jpg"
            alt="客栈白日场景"
            className="absolute inset-0 h-full w-full object-cover transition-[filter] duration-700"
            style={{ filter: skinFilter }}
            onError={() => setSceneFailed(true)}
            draggable={false}
          />
        )}

        {/* 设施/装饰贴片实例：底部中心锚点，Lv.3+ 换精致档；装扮模式可拖拽/缩放/翻转/收回 */}
        {scenePieces.map(({ id, comp, pos, f, tier, ghost, lv }, idx) => {
          const t = comp.tiers[tier as 0 | 1]
          const scale = pos.s ?? 1
          const label = comp.label
          const selected = dressing && selId === id
          return (
            <div
              key={id}
              aria-label={`${label}${comp.facility ? '设施' : '装饰'}`}
              role={!dressing && comp.facility ? 'button' : undefined}
              onClick={
                !dressing && comp.facility
                  ? () => {
                      sfx.play('click')
                      openFacility(comp.key as Parameters<typeof openFacility>[0])
                    }
                  : undefined
              }
              onPointerDown={onPiecePointerDown(id)}
              className={cn(
                'absolute touch-none',
                dressing ? 'cursor-grab active:cursor-grabbing' : comp.facility ? 'cursor-pointer pointer-events-auto active:scale-[0.97] transition-transform' : 'pointer-events-none',
                selected && 'z-30'
              )}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${t.wPct * scale}%`,
                transform: 'translateX(-50%) translateY(-100%)',
                zIndex: (dressing ? 10 : 5) + idx,
              }}
            >
              {selected && (
                <div
                  className="absolute -top-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-[#E8B84B]/80 bg-[#2A1F14]/92 px-1.5 py-1 shadow-lg"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => scaleSel(-0.1)}
                    aria-label={`缩小${label}`}
                    className="flex h-5 w-5 items-center justify-center rounded bg-black/40 text-[12px] font-black text-[#FFE9B8]"
                  >
                    −
                  </button>
                  <span className="min-w-[30px] text-center text-[9px] font-bold tabular-nums text-[#C9A96B]">
                    {+scale.toFixed(2)}×
                  </span>
                  <button
                    type="button"
                    onClick={() => scaleSel(0.1)}
                    aria-label={`放大${label}`}
                    className="flex h-5 w-5 items-center justify-center rounded bg-black/40 text-[12px] font-black text-[#FFE9B8]"
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    onClick={() => flipPiece(id)}
                    aria-pressed={f}
                    aria-label={`翻转${label}`}
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded text-[10px] font-black',
                      f ? 'bg-[#E8B84B]/80 text-[#2A1F14]' : 'bg-black/40 text-[#FFE9B8]'
                    )}
                  >
                    ⇋
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.play('click')
                      removePiece(id)
                      setSelId(null)
                    }}
                    aria-label={`收回${label}`}
                    className="flex h-5 w-5 items-center justify-center rounded bg-[#6B4A1F]/80 text-[10px] font-black text-[#FFE9B8]"
                  >
                    ⇱
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelId(null)}
                    aria-label="取消选择"
                    className="ml-0.5 flex h-5 w-5 items-center justify-center rounded bg-[#8B2E24]/80 text-[10px] font-black text-[#FFE9B8]"
                  >
                    ✕
                  </button>
                </div>
              )}
              {selected && <div className="absolute inset-0 rounded-lg ring-2 ring-[#E8B84B]/90 ring-offset-1 ring-offset-transparent" />}
              <span
                className="block w-full select-none"
                style={{ transform: f ? 'scaleX(-1)' : undefined }}
              >
                <motion.img
                  src={t.src}
                  alt=""
                  aria-hidden
                  initial={{ y: -14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="w-full"
                  style={{ filter: 'drop-shadow(0 6px 8px rgba(60,40,20,0.35))' }}
                  draggable={false}
                />
              </span>
              {/* 缩放角柄（装扮模式选中时出现，拖动等比缩放） */}
              {selected && (
                <span
                  onPointerDown={onScaleHandleDown(id)}
                  aria-label={`拖动缩放${label}`}
                  className="absolute -bottom-1.5 -right-1.5 z-30 flex h-6 w-6 touch-none cursor-nwse-resize items-center justify-center rounded-full border-2 border-[#E8B84B] bg-[#2A1F14] text-[10px] font-black leading-none text-[#F5D77E] shadow-lg"
                >
                  ◢
                </span>
              )}
              {/* 名牌：悬浮在建筑上方（不遮挡建筑本体） */}
              {comp.facility && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap">
                  <span className="day-hotspot-name">
                    {label}
                    <span className="day-hotspot-lv">{lv}</span>
                  </span>
                </span>
              )}
              {guideStep === 1 && comp.key === 'guestRoom' && (
                <div className="pointer-events-none absolute inset-0 z-[15] rounded-lg ring-2 ring-[#E8B84B] ring-offset-2 ring-offset-transparent" />
              )}
            </div>
          )
        })}

        {/* 装扮模式：提示条 + 完成 */}
        {dressing && (
          <div className="absolute inset-x-2 top-[3.8rem] z-40 flex items-center gap-2 rounded-lg border border-[#E8B84B]/70 bg-[#2A1F14]/92 px-3 py-2 shadow-xl">
            <span className="text-[11px] font-bold text-[#FFE9B8]">拖动摆放 · 拖右下角手柄缩放 · 点选可翻转/收回</span>
            <button
              type="button"
              onClick={() => {
                sfx.play('click')
                setDressing(false)
                setDragPos({})
                dragPosRef.current = {}
                setSelId(null)
                const t = toast({ title: '庭院已装扮', description: '摆放位置已保存' })
                window.setTimeout(() => t.dismiss(), 1800)
              }}
              className="ml-auto shrink-0 rounded-md bg-gradient-to-b from-[#F5D77E] to-[#E8B84B] px-2.5 py-1 text-[11px] font-black text-[#6B4A1F] shadow"
            >
              完成
            </button>
          </div>
        )}

        {/* 装扮模式：营造货单（建筑 / 装饰 分区，拖到庭院安放） */}
        {dressing && (
          <div className="absolute inset-x-2 bottom-[4.9rem] z-40 max-h-[46%] overflow-y-auto rounded-xl border border-[#E8B84B]/60 bg-[#2A1F14]/92 p-2 shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <p className="mb-1 flex items-center justify-between px-1 text-[9px] font-bold tracking-wide text-[#C9A96B]">
              <span>营造货单 · 拖到庭院安放 · 点贴片可缩放/翻转/收回</span>
              <span className="shrink-0 tabular-nums text-[#E8B84B]">
                已摆 {scenePiecesRaw?.length ?? 0}/{sceneTotalCap(innLevel)}
              </span>
            </p>
            <p className="mb-0.5 px-1 text-[8px] font-bold text-[#8B6B47]">建筑（需先建造 · 各设施解锁第二座的等级不同）</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SCENE_COMPS.filter((c) => c.facility).map((c) => {
                const lvl = facilities[c.key as FacilityKey] ?? 0
                const cap = sceneCap(c, lvl)
                const n = (scenePiecesRaw ?? []).filter((p) => p.key === c.key).length
                const locked = lvl <= 0
                const full = n >= cap
                const gate = nextPieceGate(c, lvl)
                return (
                  <div
                    key={c.key}
                    title={full && gate ? `下一座需设施 Lv.${gate}` : undefined}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      if (locked) {
                        toast({ title: '尚未建造', description: `先建造「${c.label}」设施后再摆放` })
                        return
                      }
                      dragRef.current = `new:${c.key}`
                      dragModeRef.current = 'move'
                      scaleRef.current = null
                      dragStartRef.current = { x: e.clientX, y: e.clientY }
                      setSelId(null)
                      sfx.play('click')
                    }}
                    aria-label={`货单：${c.label}${locked ? '（未建造）' : `已摆 ${n}/${cap}`}`}
                    className={cn(
                      'flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 transition active:scale-95',
                      locked ? 'border-[#8B6B47]/30 bg-black/20 opacity-50' : 'cursor-grab border-[#8B6B47]/60 bg-black/30'
                    )}
                  >
                    <img src={c.tiers[0].src} alt="" className="h-9 w-9 select-none object-contain" draggable={false} />
                    <span className="max-w-full truncate text-[8px] font-bold leading-none text-[#E6DCC8]">{c.label}</span>
                    {locked ? (
                      <span className="text-[7px] font-bold leading-none text-[#8B6B47]">未建</span>
                    ) : full && gate ? (
                      <span className="text-[7px] font-black leading-none text-[#E8B84B]">Lv{gate}解锁</span>
                    ) : (
                      <span className={cn('text-[7px] font-black leading-none tabular-nums', full ? 'text-[#D0453B]' : 'text-[#C9A96B]')}>
                        {n}/{cap}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="mb-0.5 mt-1 px-1 text-[8px] font-bold text-[#8B6B47]">装饰</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SCENE_COMPS.filter((c) => !c.facility).map((c) => {
                const cap = sceneCap(c, 0)
                const n = (scenePiecesRaw ?? []).filter((p) => p.key === c.key).length
                const full = n >= cap
                return (
                  <div
                    key={c.key}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      if (full) {
                        toast({ title: '已达上限', description: `${c.label}最多可摆 ${cap} 件` })
                        return
                      }
                      dragRef.current = `new:${c.key}`
                      dragModeRef.current = 'move'
                      scaleRef.current = null
                      dragStartRef.current = { x: e.clientX, y: e.clientY }
                      setSelId(null)
                      sfx.play('click')
                    }}
                    aria-label={`货单：${c.label}已摆 ${n}/${cap}`}
                    className={cn(
                      'flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 transition active:scale-95',
                      full ? 'border-[#8B6B47]/30 bg-black/20 opacity-50' : 'cursor-grab border-[#8B6B47]/60 bg-black/30'
                    )}
                  >
                    <img src={c.tiers[0].src} alt="" className="h-9 w-9 select-none object-contain" draggable={false} />
                    <span className="max-w-full truncate text-[8px] font-bold leading-none text-[#E6DCC8]">{c.label}</span>
                    <span className={cn('text-[7px] font-black leading-none tabular-nums', full ? 'text-[#D0453B]' : 'text-[#C9A96B]')}>
                      {n}/{cap}
                    </span>
                  </div>
                )
              })}
              {/* 打造间（预留）：装饰物购买 / 打造入口，暂未开放 */}
              <button
                type="button"
                onClick={() =>
                  toast({ title: '打造间 · 即将开放', description: '装饰物购买与打造功能筹备中，敬请期待' })
                }
                className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[#8B6B47]/50 bg-black/15 px-1 py-1"
              >
                <span className="day-seal text-sm leading-none text-[#B83A2E]">造</span>
                <span className="text-[8px] font-bold leading-none text-[#C9A96B]">打造间</span>
              </button>
            </div>
          </div>
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

        {/* 打工小妖游走（装扮模式隐藏，专心装修） */}
        {!dressing && workerIds.map((id, i) => {
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
                onOpenPanel('yaokui')
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
                  <YaoFigure id={id} size={42}>
                    {staminaBadge && (
                      <span
                        aria-hidden
                        title={stamina < 0.01 ? '体力虚脱' : '体力疲惫'}
                        className="absolute -bottom-1 -right-1 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#6A442C] bg-[#E6DCC8] text-[9px] font-black leading-none text-[#8B2E24] shadow-md"
                      >
                        {staminaBadge}
                      </span>
                    )}
                  </YaoFigure>
                  <span className="yao-nametag mt-0.5">{YAOGUAI_MAP[id]?.name ?? id}</span>
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

        {!dressing && workerIds.length === 0 && (
          <div className="absolute bottom-[5.75rem] left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-[#E6DCC8]">
            在「妖怪」里安排小妖打工，收益更高哦～
          </div>
        )}

        {/* 体力预警横幅（装扮模式隐藏） */}
        <AnimatePresence>
          {!dressing && (staminaStats.collapsedName ?? staminaStats.lowName) !== null && (
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

      {/* ===== 顶部 HUD 叠层（收纳式：左锦囊 / 右导航，中间让给场景） ===== */}
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="day-hud absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-2 px-3 pt-[max(0.15rem,env(safe-area-inset-top,0px))]"
      >
        <motion.button
          ref={resPillRef}
          type="button"
          onClick={() => {
            sfx.play('click')
            setResDrawerOpen((v) => !v)
          }}
          aria-label="资源锦囊，展开资源明细"
          aria-expanded={resDrawerOpen}
          animate={{
            scale: goldPulse ? 1.08 : 1,
            boxShadow: goldPulse ? '0 0 12px rgba(232,184,75,0.7)' : '0 0 0px rgba(232,184,75,0)',
          }}
          transition={{
            scale: { type: 'spring', stiffness: 420, damping: 16 },
            boxShadow: { duration: 0.32, ease: 'easeOut' },
          }}
          className="day-res-pill shrink-0 gap-1.5"
        >
          <GoldIcon size={16} />
          <AnimNumber value={gold} className="text-[13px] font-bold tabular-nums text-[#FFE9B8]" />
          <span
            aria-hidden
            className={cn(
              'text-[9px] leading-none text-[#C9A96B] transition-transform duration-300',
              resDrawerOpen && 'rotate-180'
            )}
          >
            ▼
          </span>
        </motion.button>

        <div className="ml-auto flex items-center gap-1.5">
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
              className="relative flex h-12 w-11 shrink-0 flex-col items-center justify-center gap-0.5 transition active:scale-90"
            >
              {dot && (
                <span className="absolute right-0.5 top-1 z-10 flex h-2 w-2 rounded-full border border-[#3a1410] bg-[#D0453B] shadow-sm" />
              )}
              <span className="flex h-6 w-6 items-center justify-center">
                <ConfigIcon icon={n.icon} size={22} className="ink-chip" />
              </span>
              <span className="yao-nametag max-w-none px-1.5 text-[9px] leading-tight">{n.label}</span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="设置"
          className="relative flex h-12 w-11 shrink-0 flex-col items-center justify-center gap-0.5 transition active:scale-90"
        >
          <span className="flex h-6 w-6 items-center justify-center">
            <ConfigIcon icon="/images/ui/settings.png" size={22} className="ink-chip" />
          </span>
          <span className="yao-nametag max-w-none px-1.5 text-[9px] leading-tight">设置</span>
        </button>
        </div>
      </motion.header>

      {/* 资源锦囊抽屉：宣纸小卡，点外关闭 */}
      <AnimatePresence>
        {resDrawerOpen && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setResDrawerOpen(false)}
              className="absolute inset-0 z-[35] cursor-default"
            />
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              role="dialog"
              aria-label="资源明细"
              className="ui-paper absolute left-2 top-[3.6rem] z-40 w-48 rounded-xl border border-[#5c3a24] p-3 shadow-[0_10px_24px_rgba(20,12,6,0.45)]"
            >
              <ul className="flex flex-col gap-1.5 text-[12px] text-[#4A3421]">
                <li className="flex items-center gap-2">
                  <GoldIcon size={15} />
                  <span className="font-bold">金币</span>
                  <AnimNumber value={gold} className="ml-auto font-bold tabular-nums text-[#3D2B1A]" />
                </li>
                <li className="flex items-center gap-2">
                  <GemIcon size={15} />
                  <span className="font-bold">灵石</span>
                  <AnimNumber value={Math.floor(gems)} className="ml-auto font-bold tabular-nums text-[#3D2B1A]" />
                </li>
                <li className="flex items-center gap-2">
                  <TicketIcon size={15} />
                  <span className="font-bold">妖券</span>
                  <AnimNumber value={tickets} className="ml-auto font-bold tabular-nums text-[#3D2B1A]" />
                </li>
                {staminaStats.avg !== null && (
                  <li className="flex items-center gap-2">
                    <span className="day-seal text-[11px] text-[#B83A2E]" aria-hidden>
                      力
                    </span>
                    <span className="font-bold">体力均值</span>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('click')
                        setResDrawerOpen(false)
                        onOpenPanel('yaokui')
                      }}
                      className="ml-auto font-bold tabular-nums text-[#3D2B1A] underline decoration-[#C9A96B]/60 underline-offset-2"
                    >
                      {staminaStats.avg}
                    </button>
                  </li>
                )}
              </ul>
              <div className="mt-2.5 border-t border-[#5c3a24]/25 pt-2">
                <div className="flex items-baseline justify-between text-[11px] font-bold text-[#4A3421]">
                  <span>客栈 Lv.{innLevel}</span>
                  <span className="tabular-nums text-[#8B6B47]">{Math.round(expPct)}%</span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#5c3a24]/25"
                  role="progressbar"
                  aria-label="客栈经验"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#C98F3D] to-[#E8B84B] transition-all duration-500"
                    style={{ width: `${expPct}%` }}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 节日横幅：次级叠层，不占主构图 */}
      <AnimatePresence>
        {festival && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-x-2 top-[3.75rem] z-20 flex h-7 items-center gap-1 overflow-hidden rounded-md border px-1.5 shadow-md"
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
          festival ? 'top-[5.95rem]' : 'top-[3.85rem]'
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
          festival ? 'top-[6rem]' : 'top-[3.9rem]'
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
              className="absolute z-40 flex h-6 w-6 items-center justify-center"
              style={{ filter: 'drop-shadow(0 0 8px rgba(232,184,75,0.9))' }}
              initial={{ left: `${f.x}%`, top: `${f.y}%`, scale: 0.3, opacity: 0 }}
              animate={{
                left: [`${f.x}%`, `${(f.x + flyTargetRef.current.x) / 2}%`, `${flyTargetRef.current.x}%`],
                top: [
                  `${f.y}%`,
                  `${Math.max(10, (f.y + flyTargetRef.current.y) / 2 - 13)}%`,
                  `${flyTargetRef.current.y}%`,
                ],
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
              <GoldIcon size={22} />
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
                <span className="ink-chip relative h-8 w-8 items-center justify-center">
                  <ConfigIcon icon={n.icon} size={24} />
                  {dot && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2 rounded-full border border-[#3a1410] bg-[#D0453B] shadow-sm" />
                  )}
                </span>
                <span className="font-display truncate text-[10px] tracking-wide text-[#FFF6DF]/90">{n.label}</span>
              </button>
            )
          })}

          {/* 装修：庭院摆放独立入口（仓库之后） */}
          <button
            type="button"
            onClick={() => {
              sfx.play('click')
              setDressing(true)
              dragPosRef.current = {}
              setDragPos({})
              setSelId(null)
            }}
            aria-label="装修庭院"
            className="relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition active:scale-95 active:bg-black/15 hover:bg-black/5"
          >
            <span className="ink-chip flex h-8 w-8 items-center justify-center">
              <ConfigIcon icon="/images/ui/nav-deco.png" size={24} />
            </span>
            <span className="font-display truncate text-[10px] tracking-wide text-[#FFF6DF]/90">装修</span>
          </button>
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
