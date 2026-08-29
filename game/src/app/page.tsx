'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '@/game/store'
import type { BattleResult } from '@/game/types'
import type { BgmTrackName } from '@/game/audio'
import { saveCloud, trackEvent } from '@/game/cloud'
import { BgmPlayer } from '@/components/game/BgmPlayer'
import { DayScreen } from '@/components/game/DayScreen'
import { NightScreen } from '@/components/game/NightScreen'
import { SettlementDialog } from '@/components/game/SettlementDialog'
import { YaokuiPanel } from '@/components/game/panels/YaokuiPanel'
import { TujianPanel } from '@/components/game/panels/TujianPanel'
import { ShopPanel } from '@/components/game/panels/ShopPanel'
import { BagPanel } from '@/components/game/panels/BagPanel'
import { TaskPanel } from '@/components/game/panels/TaskPanel'
import { WorldMapPanel } from '@/components/game/panels/WorldMapPanel'
import { GatherPanel } from '@/components/game/panels/GatherPanel'

type Stage = 'splash' | 'day' | 'night' | 'boss-night'
type NightStage = 'night' | 'boss-night'
type PanelKey = 'yaokui' | 'tujian' | 'task' | 'shop' | 'bag' | 'map' | 'gather'
type Transition = null | 'to-night' | 'to-day'

export default function Home() {
  const [stage, setStage] = useState<Stage>('splash')
  const [transition, setTransition] = useState<Transition>(null)
  const [panel, setPanel] = useState<PanelKey | null>(null)
  const [settleOpen, setSettleOpen] = useState(false)
  const [pendingResult, setPendingResult] = useState<BattleResult | null>(null)
  const [battleKey, setBattleKey] = useState(0)
  // 记录上一次进入的夜战类型（普通夜/妖王夜），结算重开时恢复
  const [lastNightStage, setLastNightStage] = useState<NightStage>('night')

  const hasHydrated = useGameStore((s) => s.hasHydrated)
  const level = useGameStore((s) => s.level)
  // 世界地图：当前驻扎区域与该区域关卡进度（区域二用 region2Level，区域三用 region3Level）
  const region = useGameStore((s) => s.region)
  const region2Level = useGameStore((s) => s.region2Level)
  const region3Level = useGameStore((s) => s.region3Level)
  const battleLevel = region === 2 ? region2Level : region === 3 ? region3Level : level

  // 防止结算重复发奖
  const settledRef = useRef(false)

  // ---------- 白天挂机收益（每秒一跳） ----------
  useEffect(() => {
    if (stage !== 'day' || !hasHydrated) return
    const t = setInterval(() => {
      useGameStore.getState().tickIncome(1)
    }, 1000)
    return () => clearInterval(t)
  }, [stage, hasHydrated])

  // ---------- 云存档（定期 + 切后台） ----------
  useEffect(() => {
    if (!hasHydrated) return
    const doSave = () => {
      const s = useGameStore.getState()
      const { hasHydrated: _h, pendingOffline: _o, ...rest } = s
      void _h
      void _o
      saveCloud(rest, s.level)
    }
    const t = setInterval(doSave, 60_000)
    const onHide = () => {
      if (document.visibilityState === 'hidden') doSave()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [hasHydrated])

  // ---------- 昼夜切换（仪式感动画，普通夜/妖王夜共用） ----------
  const startNight = useCallback((target: NightStage) => {
    setTransition('to-night')
    setLastNightStage(target)
    trackEvent(target === 'boss-night' ? 'boss_night_start' : 'night_start', {
      level: useGameStore.getState().level,
    })
    window.setTimeout(() => {
      setStage(target)
      setBattleKey((k) => k + 1)
    }, 1400)
    window.setTimeout(() => setTransition(null), 3000)
  }, [])

  const goNight = useCallback(() => startNight('night'), [startNight])

  const goBossNight = useCallback(() => startNight('boss-night'), [startNight])

  const goDay = useCallback(() => {
    setTransition('to-day')
    window.setTimeout(() => setStage('day'), 1400)
    window.setTimeout(() => setTransition(null), 3000)
  }, [])

  // ---------- 战斗结算 ----------
  const handleExit = useCallback((result: BattleResult | null) => {
    if (!result) {
      setStage('day')
      return
    }
    settledRef.current = false
    setPendingResult(result)
    setSettleOpen(true)
  }, [])

  const grant = useCallback(
    (mult: number) => {
      if (settledRef.current || !pendingResult) return
      settledRef.current = true
      const r = pendingResult
      useGameStore.getState().finishBattle(
        r.victory,
        Math.floor(r.gold * mult),
        Math.floor(r.gems * mult),
        Math.floor(r.tickets * mult),
        r.waveReached,
        r.bossNight,
        Object.keys(r.expGained ?? {}),
        r.materialsGained,
      )
      trackEvent('battle_end', {
        victory: r.victory,
        waveReached: r.waveReached,
        captured: r.captured.length,
        doubled: mult > 1,
        bossNight: !!r.bossNight,
      })
    },
    [pendingResult]
  )

  const closeSettle = useCallback(
    (next: 'day' | 'night') => {
      grant(1) // 未双倍则按原值发放
      setSettleOpen(false)
      setPendingResult(null)
      if (next === 'night') {
        // 妖王夜每日一次：胜利后今日已完成，不重开（失败可立即重试）
        if (lastNightStage === 'boss-night' && pendingResult?.victory) {
          setStage('day')
          return
        }
        setBattleKey((k) => k + 1)
        setStage(lastNightStage) // 重开恢复上一次的夜战类型（普通夜/妖王夜）
      } else {
        setStage('day')
      }
    },
    [grant, lastNightStage, pendingResult]
  )

  // ---------- BGM 曲目路由（真实 MP3：白天「妖怪茶水间」/ 区域一「夜袭客栈」/ 区域二「水墨藏锋」；区域三纯合成曲「赤川沸火」；妖王夜保留合成曲） ----------
  const currentTrack: BgmTrackName | null =
    stage === 'day'
      ? 'day'
      : stage === 'night'
        ? region === 2
          ? 'night2'
          : region === 3
            ? 'night3'
            : 'night'
        : stage === 'boss-night'
          ? 'boss'
          : null

  // ---------- 启动 ----------
  const startGame = useCallback(() => {
    trackEvent('login', { level: useGameStore.getState().level }) // 仅 splash→day 首次进入上报一次
    setStage('day')
  }, [])

  return (
    <main className="game-shell relative h-dvh w-full overflow-hidden bg-[#1a1610]">
      {/* 桌面端舞台居中 */}
      <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-[#F5F0E8] shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {!hasHydrated ? (
          <SplashLoading />
        ) : stage === 'splash' ? (
          <SplashScreen onStart={startGame} />
        ) : stage === 'day' ? (
          <DayScreen onOpenPanel={setPanel} onNight={goNight} onBossNight={goBossNight} />
        ) : (
          <NightScreen
            key={battleKey}
            level={battleLevel}
            onExit={handleExit}
            bossNight={stage === 'boss-night'}
            region={region}
          />
        )}

        {/* 昼夜切换覆盖动画 */}
        <AnimatePresence>
          {transition && <DayNightTransition kind={transition} />}
        </AnimatePresence>
      </div>

      {/* BGM 播放器（无 UI，随舞台切曲） */}
      <BgmPlayer track={currentTrack} />

      {/* 白天功能面板（抽屉） */}
      <YaokuiPanel open={panel === 'yaokui'} onOpenChange={(o) => !o && setPanel(null)} />
      <TujianPanel open={panel === 'tujian'} onOpenChange={(o) => !o && setPanel(null)} />
      <ShopPanel open={panel === 'shop'} onOpenChange={(o) => !o && setPanel(null)} />
      <TaskPanel open={panel === 'task'} onOpenChange={(o) => !o && setPanel(null)} />
      <BagPanel open={panel === 'bag'} onOpenChange={(o) => !o && setPanel(null)} />
      <WorldMapPanel open={panel === 'map'} onOpenChange={(o) => !o && setPanel(null)} />
      <GatherPanel open={panel === 'gather'} onOpenChange={(o) => !o && setPanel(null)} />

      {/* 夜战结算 */}
      <SettlementDialog
        open={settleOpen}
        result={pendingResult}
        onDouble={() => grant(2)}
        onReturn={() => closeSettle('day')}
        onNext={() => closeSettle('night')}
      />
    </main>
  )
}

// ============ 启动页 ============

function SplashLoading() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#2D5A3D] to-[#1d3d2a]">
      <motion.div
        className="text-5xl"
        animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.6 }}
      >
        🏮
      </motion.div>
      <p className="text-sm tracking-[0.4em] text-amber-200/80">妖怪客栈 · 载入中</p>
    </div>
  )
}

function SplashScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#17233a] via-[#1d2c47] to-[#0f1524] px-6 py-14">
      {/* 背景主视觉 */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: 'url(/images/logo.png)' }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" aria-hidden />

      {/* 星星 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {[
          { l: '12%', t: '16%', d: '0s' },
          { l: '78%', t: '12%', d: '0.8s' },
          { l: '66%', t: '30%', d: '1.6s' },
          { l: '20%', t: '38%', d: '0.4s' },
          { l: '88%', t: '44%', d: '1.2s' },
        ].map((s, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-amber-100"
            style={{ left: s.l, top: s.t }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.4, delay: parseFloat(s.d) }}
          />
        ))}
      </div>

      {/* 标题区 */}
      <motion.div
        className="relative z-10 mt-16 flex flex-col items-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="rounded-2xl border border-amber-300/30 bg-black/30 px-6 py-3 backdrop-blur-sm"
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3 }}
        >
          <h1 className="text-center text-4xl font-black tracking-widest text-amber-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            妖怪客栈
          </h1>
        </motion.div>
        <p className="mt-3 text-xs tracking-[0.5em] text-amber-200/70">山海经 · 放置经营 × 夜间守店</p>
      </motion.div>

      <div className="flex-1" />

      {/* 开始按钮 */}
      <motion.div
        className="relative z-10 mb-6 flex w-full flex-col items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.7 }}
      >
        <motion.button
          onClick={onStart}
          className="h-14 w-64 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-lg font-bold text-white shadow-[0_8px_30px_rgba(232,150,75,0.45)] active:scale-95"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
        >
          🏮 开始经营客栈
        </motion.button>
        <div className="flex items-center gap-3 text-[10px] text-stone-300/60">
          <span>白日挂机赚钱</span>
          <span>·</span>
          <span>入夜布阵守店</span>
          <span>·</span>
          <span>控血捉妖收伙伴</span>
        </div>
        <p className="text-[10px] text-stone-400/50">v1.0 · 灵感源自《山海经》 · 无内购纯广告演示</p>
      </motion.div>
    </div>
  )
}

// ============ 昼夜切换过渡 ============

function DayNightTransition({ kind }: { kind: 'to-night' | 'to-day' }) {
  const isNight = kind === 'to-night'
  return (
    <motion.div
      className="absolute inset-0 z-[80] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className={
          isNight
            ? 'absolute inset-0 bg-gradient-to-b from-[#0a0e21] to-[#1a1435]'
            : 'absolute inset-0 bg-gradient-to-b from-[#ffd98a] to-[#f5f0e8]'
        }
      />
      {/* 日/月升起点缀 */}
      <motion.div
        className="relative text-6xl"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      >
        {isNight ? '🌙' : '☀️'}
      </motion.div>
      <motion.p
        className={isNight ? 'absolute bottom-1/3 text-sm tracking-[0.5em] text-stone-200/70' : 'absolute bottom-1/3 text-sm tracking-[0.5em] text-amber-800/70'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        {isNight ? '夜幕降临 · 妖怪来袭' : '天亮了 · 客栈新的一天'}
      </motion.p>
      {isNight && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            { l: '20%', t: '20%' },
            { l: '70%', t: '15%' },
            { l: '45%', t: '30%' },
            { l: '85%', t: '35%' },
            { l: '10%', t: '45%' },
          ].map((s, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white"
              style={{ left: s.l, top: s.t }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.4] }}
              transition={{ delay: 0.8 + i * 0.15, duration: 1 }}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
