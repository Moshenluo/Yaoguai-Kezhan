'use client'

// 副作用导入：把 Web Audio / localStorage 注入逻辑层桥接（bridge）。
// 必须排在其他 @/game/* 导入之前，逻辑层才拿得到浏览器能力。
import '@/game/adapters-web'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '@/game/store'
import type { BattleResult } from '@/game/types'
import type { BgmTrackName } from '@/game/audio'
import { saveCloud, trackEvent } from '@/game/cloud'
import { BgmPlayer } from '@/components/game/BgmPlayer'
import { ConfigIcon } from '@/components/game/shared'
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
    setPanel(null)
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
    <main className="game-shell game-shell-bg relative h-dvh w-full overflow-hidden">
      {/* 桌面端舞台居中 */}
      <div className="game-stage paper-grain relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden">
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

      {stage === 'day' && panel !== null && (
        <DayNightFab onNight={goNight} region={region} />
      )}

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

/** 抽屉打开时坞栏入夜被 overlay(z-50) 挡住；悬浮 CTA 挂到 body，z-[70] 仍可点 */
function DayNightFab({ onNight, region }: { onNight: () => void; region: number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70] flex justify-center">
      <div className="relative h-full w-full max-w-[480px]">
        <motion.button
          type="button"
          onClick={onNight}
          whileTap={{ scale: 0.92 }}
          aria-label="入夜守店"
          data-region={region}
          className="day-cta-night pointer-events-auto absolute bottom-[max(1.15rem,env(safe-area-inset-bottom,0px))] right-3 flex h-14 w-14 flex-col items-center justify-center rounded-xl text-[#E6DCC8]"
        >
          <ConfigIcon
            icon="/images/ui/status-moon.png"
            size={22}
            className="drop-shadow-[0_0_6px_rgba(232,184,75,0.55)]"
          />
          <span className="mt-0.5 text-[9px] font-bold leading-none tracking-widest">入夜</span>
        </motion.button>
      </div>
    </div>,
    document.body
  )
}

// ============ 启动页 ============

function SplashLoading() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center gap-5 overflow-hidden bg-gradient-to-b from-[#1a1612] via-[#12100e] to-[#0a0908]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 28%, rgba(184,58,46,0.22), transparent 52%), radial-gradient(ellipse at 70% 80%, rgba(14,20,36,0.5), transparent 45%)',
        }}
        aria-hidden
      />
      <div className="lantern-sway drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]" aria-hidden>
        <ConfigIcon icon="/images/ui/festival-lantern.png" size={64} />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="font-display text-xl font-black tracking-[0.4em] text-[#E6DCC8]">妖怪客栈</p>
        <p className="ink-breathe text-[11px] tracking-[0.5em] text-[#B83A2E]/90">载入中</p>
      </div>
      <div className="mt-1 h-0.5 w-32 overflow-hidden bg-[#2C241C]">
        <div className="h-full w-2/5 animate-pulse bg-gradient-to-r from-[#8B2E24] to-[#C9A227]" />
      </div>
    </div>
  )
}

function SplashScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-between overflow-hidden px-6 py-12">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/images/scene/scene-splash.jpg)' }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,9,8,0.32) 0%, rgba(14,20,36,0.14) 32%, rgba(10,9,8,0.32) 62%, rgba(8,7,6,0.88) 100%)',
        }}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {[
          { l: '12%', t: '16%', d: '0s' },
          { l: '78%', t: '12%', d: '0.8s' },
          { l: '64%', t: '30%', d: '1.5s' },
          { l: '20%', t: '38%', d: '0.4s' },
          { l: '88%', t: '44%', d: '1.2s' },
        ].map((s, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-[#DFC56A]"
            style={{ left: s.l, top: s.t }}
            animate={{ opacity: [0.12, 0.85, 0.12] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3, delay: parseFloat(s.d) }}
          />
        ))}
      </div>

      <motion.div
        className="relative z-10 mt-10 flex flex-col items-center"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
      >
        <motion.div
          className="ui-wood seal-mark relative rounded-xl px-8 py-4 outline outline-1 outline-offset-[-4px] outline-[#C9A227]/55 shadow-[0_10px_28px_rgba(10,8,6,0.6)]"
          animate={{ y: [0, -4, 0], rotate: [0, -0.6, 0, 0.6, 0] }}
          transition={{
            y: { repeat: Number.POSITIVE_INFINITY, duration: 3.6, ease: 'easeInOut' },
            rotate: { repeat: Number.POSITIVE_INFINITY, duration: 7.2, ease: 'easeInOut' },
          }}
        >
          {/* 挂绳：匾随动画轻轻摇摆 */}
          <span aria-hidden className="absolute -top-[13vh] left-7 h-[13vh] w-[2px] rotate-[7deg] bg-gradient-to-b from-transparent via-[#4A2E1C]/80 to-[#5C3A24]" />
          <span aria-hidden className="absolute -top-[13vh] right-7 h-[13vh] w-[2px] -rotate-[7deg] bg-gradient-to-b from-transparent via-[#4A2E1C]/80 to-[#5C3A24]" />
          {/* 四角铜钉 */}
          {(['left-1.5 top-1.5', 'right-1.5 top-1.5', 'left-1.5 bottom-1.5', 'right-1.5 bottom-1.5'] as const).map((pos) => (
            <span
              key={pos}
              aria-hidden
              className={`absolute ${pos} h-1.5 w-1.5 rounded-full bg-gradient-to-b from-[#F5D77E] to-[#B8860B] shadow-[0_0_3px_rgba(245,215,126,0.55)]`}
            />
          ))}
          <div className="pointer-events-none absolute inset-x-5 top-1 h-px bg-gradient-to-r from-transparent via-[#B83A2E]/55 to-transparent" />
          <h1
            className="text-center text-[2.8rem] leading-none tracking-[0.18em] text-[#E6DCC8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]"
            style={{ fontFamily: 'var(--font-script), var(--font-brush), var(--font-display-cn), var(--font-serif), serif' }}
          >
            妖怪客栈
          </h1>
          <div className="pointer-events-none absolute inset-x-5 bottom-1 h-px bg-gradient-to-r from-transparent via-[#C9A227]/35 to-transparent" />
        </motion.div>
        <p className="yao-nametag mt-4 px-3.5 py-1 text-[10px] tracking-[0.38em]" style={{ maxWidth: 'none' }}>
          山海志怪 · 昼营夜守
        </p>
      </motion.div>

      <div className="flex-1" />

      <motion.div
        className="relative z-10 mb-4 flex w-full flex-col items-center gap-4"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.7 }}
      >
        <motion.button
          onClick={onStart}
          whileTap={{ scale: 0.97 }}
          className="ui-wood group relative h-[3.35rem] w-[16.5rem] overflow-hidden rounded-xl outline outline-1 outline-offset-[-4px] outline-[#C9A227]/60 shadow-[0_10px_26px_rgba(10,8,6,0.55)] text-lg font-bold tracking-[0.2em] text-[#E6DCC8] active:brightness-95"
        >
          <span className="font-display relative z-10 inline-flex items-center gap-2 text-xl tracking-[0.2em]">
            <ConfigIcon icon="/images/ui/festival-lantern.png" size={22} />
            推门入店
          </span>
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#8B2E24]/35 to-transparent opacity-70 transition group-hover:opacity-100" />
        </motion.button>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-[#B5A48C]/80">
          <span>白日经营</span>
          <span className="text-[#B83A2E]/70">·</span>
          <span>入夜守店</span>
          <span className="text-[#B83A2E]/70">·</span>
          <span>控血捉妖</span>
        </div>
        <p className="text-[10px] text-[#8A7A66]/70">灵感源自《山海经》 · 无内购纯广告演示</p>
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
            ? 'absolute inset-0 bg-gradient-to-b from-[#0a0d18] via-[#12182a] to-[#1a1020]'
            : 'absolute inset-0 bg-gradient-to-b from-[#c9a227]/80 via-[#e6dcc8] to-[#d2c4a8]'
        }
      />
      {/* 日/月升起点缀 */}
      <motion.div
        className="relative"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      >
        <ConfigIcon
          icon={isNight ? '/images/ui/status-moon.png' : '/images/ui/ui-sun.png'}
          size={96}
        />
      </motion.div>
      <motion.p
        className={
          isNight
            ? 'font-display absolute bottom-1/3 text-sm tracking-[0.45em] text-[#E6DCC8]/75'
            : 'font-display absolute bottom-1/3 text-sm tracking-[0.45em] text-[#8B2E24]/80'
        }
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        {isNight ? '夜幕将至 · 妖怪出没' : '晨光初破 · 客栈开张'}
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
