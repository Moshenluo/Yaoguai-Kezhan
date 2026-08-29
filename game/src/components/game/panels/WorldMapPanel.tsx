'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { GoldIcon, HpBar } from '@/components/game/shared'
import { useGameStore } from '@/game/store'
import {
  BRANCH_GOLD_BONUS,
  BRANCH_STAMINA_BONUS,
  BRANCH3_GOLD_BONUS,
  BRANCH3_STAMINA_BONUS,
  REGIONS,
  REGION2_UNLOCK,
  REGION3_UNLOCK,
  region2Unlockable,
  region3Unlockable,
  regionDef,
  regionLevelOf,
} from '@/game/config'
import { trackEvent } from '@/game/cloud'
import { sfx } from '@/game/audio'
import { RARE_IDS, YAOGUAI_MAP } from '@/game/yaoguai'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface WorldMapPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 增幅百分比文本（0.3 → +30%） */
const pct = (v: number) => `+${Math.round(v * 100)}%`

/** 相对基准的倍率增幅（hpScale 1.15 → +15%） */
const scalePct = (v: number) => `+${Math.round((v - 1) * 100)}%`

/** 敌踪预览键序（小妖/强怪/精怪 —— 各区域自动换皮野怪名） */
const ENEMY_KEYS = ['minion', 'brute', 'sprite'] as const

/** 区域独占稀有精怪（V1.3.1 招募池随区域轮换）：按 spawnRegions 过滤，每区一只不落 */
const REGION_RARES: Record<1 | 2 | 3, string[]> = {
  1: RARE_IDS.filter((id) => YAOGUAI_MAP[id]?.spawnRegions?.includes(1) ?? false),
  2: RARE_IDS.filter((id) => YAOGUAI_MAP[id]?.spawnRegions?.includes(2) ?? false),
  3: RARE_IDS.filter((id) => YAOGUAI_MAP[id]?.spawnRegions?.includes(3) ?? false),
}

/** 分店雅号（开设按钮/锁定面板文案，与 store 开张 message 同名） */
const BRANCH_NAMES: Record<2 | 3, string> = { 2: '水墨别院', 3: '沸泉别馆' }

/** 区域卡视觉主题：区域一暖绿大本营 / 区域二水墨 / 区域三火色（暖红棕，集中管理避免三元表达式蔓延） */
interface CardTheme {
  /** 卡片底色与默认边框 */
  card: string
  /** 当前驻扎时的高亮边框色（含呼吸描边） */
  borderCurrent: string
  /** 区域名文字色 */
  title: string
  /** 区域标签文字色 */
  tag: string
  /** 风物志文字色 */
  desc: string
  /** 情报行文字色 */
  info: string
  /** 敌踪「敌踪」小标签色 */
  enemyLabel: string
  /** 敌踪 chip 配色 */
  enemyChip: string
  /** 驻扎态底条配色 */
  stay: string
  /** 移驻按钮渐变（含 text-white） */
  switchBtn: string
  /** 锁定态前置面板底色 */
  lockPanel: string
  /** 锁定面板标题色 */
  lockTitle: string
  /** 锁定面板条目名文字色 */
  lockLabel: string
  /** 锁定面板数值色（未达成态） */
  lockValue: string
  /** 前置未达成进度条色 */
  lockBar: string
  /** 前置达成数值绿色（火色深底用亮绿保证可读） */
  okValue: string
  /** 「前置已达成」绿条配色 */
  readyBar: string
  /** 可开设态底部收益预告文字色 */
  readyHint: string
  /** 已开张效益徽章配色（边框+底+字色） */
  badge: string
  /** 效益徽章标题色 */
  badgeTitle: string
  /** 开设主按钮渐变（未 armed 态，含 text-white） */
  openBtn: string
}

const CARD_THEME: Record<1 | 2 | 3, CardTheme> = {
  // 区域一（区域一永不锁定，锁定相关字段为占位，实际不会渲染）
  1: {
    card: 'border-[#D4A574]/60 bg-white/85',
    borderCurrent: 'border-[#2D5A3D]',
    title: 'text-[#2D5A3D]',
    tag: 'text-[#A87B3D]',
    desc: 'text-stone-500',
    info: 'text-stone-600',
    enemyLabel: 'text-stone-400',
    enemyChip: 'bg-[#2D5A3D]/10 text-[#2D5A3D]',
    stay: 'bg-[#2D5A3D]/10 text-[#2D5A3D]',
    switchBtn: 'bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-white shadow-amber-700/25',
    lockPanel: 'bg-white/55',
    lockTitle: 'text-[#3A3644]',
    lockLabel: 'text-[#5A5560]',
    lockValue: 'text-[#3A3644]',
    lockBar: 'bg-[#4A4458]',
    okValue: 'text-[#2D7A46]',
    readyBar: 'bg-[#2D7A46]/10 text-[#2D7A46]',
    readyHint: 'text-[#5A5560]',
    badge: 'border-[#4A4458]/25 bg-white/60 text-[#3A3644]',
    badgeTitle: 'text-[#4A4458]',
    openBtn: 'bg-gradient-to-b from-[#5C5570] to-[#4A4458] text-white shadow-[#4A4458]/30',
  },
  // 区域二 · 水墨
  2: {
    card: 'border-[#4A4458]/40 bg-gradient-to-b from-[#EDEAE4] to-[#DCD8D2]',
    borderCurrent: 'border-[#4A4458]',
    title: 'text-[#3A3644]',
    tag: 'text-[#6B6570]',
    desc: 'text-[#5A5560]',
    info: 'text-[#3A3644]',
    enemyLabel: 'text-[#6B6570]',
    enemyChip: 'bg-[#3A3644]/10 text-[#3A3644]',
    stay: 'bg-[#4A4458]/10 text-[#3A3644]',
    switchBtn: 'bg-gradient-to-b from-[#5C5570] to-[#4A4458] text-white shadow-[#4A4458]/30',
    lockPanel: 'bg-white/55',
    lockTitle: 'text-[#3A3644]',
    lockLabel: 'text-[#5A5560]',
    lockValue: 'text-[#3A3644]',
    lockBar: 'bg-[#4A4458]',
    okValue: 'text-[#2D7A46]',
    readyBar: 'bg-[#2D7A46]/10 text-[#2D7A46]',
    readyHint: 'text-[#5A5560]',
    badge: 'border-[#4A4458]/25 bg-white/60 text-[#3A3644]',
    badgeTitle: 'text-[#4A4458]',
    openBtn: 'bg-gradient-to-b from-[#5C5570] to-[#4A4458] text-white shadow-[#4A4458]/30',
  },
  // 区域三 · 沸火赤川（暗色火川卡 + 暖红棕渐变，浅暖字色保证对比）
  3: {
    card: 'border-[#A8402F]/45 bg-gradient-to-b from-[#3a1108] to-[#240a04]',
    borderCurrent: 'border-[#A8402F]',
    title: 'text-[#F5D3B5]',
    tag: 'text-[#D9A08B]',
    desc: 'text-[#DCAF97]',
    info: 'text-[#F0C4A8]',
    enemyLabel: 'text-[#C98B72]',
    enemyChip: 'bg-[#A8402F]/25 text-[#F5C9AE]',
    stay: 'bg-[#A8402F]/25 text-[#F5C9AE]',
    switchBtn: 'bg-gradient-to-b from-[#C0533A] to-[#A8402F] text-white shadow-[#7C2D1F]/40',
    lockPanel: 'bg-black/25',
    lockTitle: 'text-[#F5C9AE]',
    lockLabel: 'text-[#D9A08B]',
    lockValue: 'text-[#F0C4A8]',
    lockBar: 'bg-[#C0533A]',
    okValue: 'text-[#8AD391]',
    readyBar: 'bg-[#2D7A46]/25 text-[#8AD391]',
    readyHint: 'text-[#D9A08B]',
    badge: 'border-[#A8402F]/40 bg-[#A8402F]/15 text-[#F5C9AE]',
    badgeTitle: 'text-[#F5C9AE]',
    openBtn: 'bg-gradient-to-b from-[#C0533A] to-[#A8402F] text-white shadow-[#7C2D1F]/40',
  },
}

/**
 * 世界地图面板 —— 三界山河 · 切换今夜驻扎区域 + 开设连锁分店
 *
 * 区域一「客栈山道」：始终可用的大本营；
 * 区域二「水墨幽谷」：前置（山道关卡≥6 + 累计守店胜利≥5）→ 8000 金币开「水墨别院」→
 * 解锁移驻 + 全局分店效益（挂机金币+30% / 全体休息恢复+20%）；
 * 区域三「沸火赤川」：前置（水墨别院已开张 + 水墨幽谷关卡≥10 + 累计守店胜利≥8）→
 * 25000 金币开「沸泉别馆」→ 挂机金币+50% / 休息恢复+30%（与水墨分店加成叠乘）。
 */
export function WorldMapPanel({ open, onOpenChange }: WorldMapPanelProps) {
  const { toast } = useToast()

  // ?? 兜底：即使存档异常也不至于渲染层崩溃（沿用 ShopPanel 约定）
  const region = useGameStore((s) => s.region)
  const region2Opened = useGameStore((s) => s.region2Opened === true)
  const region3Opened = useGameStore((s) => s.region3Opened === true)
  const gold = useGameStore((s) => s.gold ?? 0)
  const level = useGameStore((s) => s.level ?? 1)
  const wins = useGameStore((s) => s.stats?.wins ?? 0)
  // 数据层派生（选择器直接回传原始值，避免订阅整档引发挂机 tick 重渲染）
  const unlockable2 = useGameStore((s) => region2Unlockable(s))
  const unlockable3 = useGameStore((s) => region3Unlockable(s))
  const region1Lv = useGameStore((s) => regionLevelOf(s, 1) ?? 1)
  const region2Lv = useGameStore((s) => regionLevelOf(s, 2) ?? 1)
  const region3Lv = useGameStore((s) => regionLevelOf(s, 3) ?? 1)

  // 开分店两步确认：首次点击进入 3 秒「再次确认」armed 态，期间再点才真正扣费
  // （同一时刻至多一个区域处于 armed 态，切到别的分店按钮会重新武装）
  const [armingRegion, setArmingRegion] = useState<1 | 2 | 3 | null>(null)
  const armTimer = useRef<number | null>(null)

  // 卸载时清理计时器（armed 态无需随开合复位：3 秒超时自然回落，
  // 且面板关闭期间 armed 残留最多 3 秒，重开时仍在确认窗口内属合理交互）
  // 注意：不可在 effect 里同步 setState（react-hooks/set-state-in-effect 规则）
  useEffect(() => {
    return () => {
      if (armTimer.current !== null) window.clearTimeout(armTimer.current)
    }
  }, [])

  const notify = (title: string, description?: string) => {
    toast({ title, description, duration: 2800 })
  }

  /** 移驻区域：click 音效 → setRegion → toast 结果（成功再放 upgrade + 埋点） */
  const handleSwitch = (target: 1 | 2 | 3) => {
    sfx.play('click')
    const res = useGameStore.getState().setRegion(target)
    notify(res.message)
    if (res.ok) {
      sfx.play('upgrade')
      trackEvent('map_switch_region', { region: target })
    }
  }

  /** 开设分店（两步确认）：成功 victory 音效 + 埋点 + 庆祝 toast */
  const handleOpenBranch = (id: 1 | 2 | 3) => {
    if (armingRegion !== id) {
      // 第一步：武装确认态，3 秒内再次点击才生效
      sfx.play('click')
      setArmingRegion(id)
      if (armTimer.current !== null) window.clearTimeout(armTimer.current)
      armTimer.current = window.setTimeout(() => setArmingRegion(null), 3000)
      return
    }
    // 第二步：真正开设
    if (armTimer.current !== null) {
      window.clearTimeout(armTimer.current)
      armTimer.current = null
    }
    setArmingRegion(null)
    const res = id === 3 ? useGameStore.getState().openRegion3() : useGameStore.getState().openRegion2()
    if (res.ok) {
      sfx.play('victory')
      if (id === 3) {
        trackEvent('map_open_region3', {})
        notify(
          '🔥 沸泉别馆开张！',
          `挂机金币 ${pct(BRANCH3_GOLD_BONUS)} · 休息恢复 ${pct(BRANCH3_STAMINA_BONUS)} · 今夜已移驻沸火赤川`,
        )
      } else {
        trackEvent('map_open_branch', {})
        notify(
          '🖌️ 水墨别院开张！',
          `挂机金币 ${pct(BRANCH_GOLD_BONUS)} · 休息恢复 ${pct(BRANCH_STAMINA_BONUS)} · 今夜已移驻水墨幽谷`,
        )
      }
    } else {
      notify(res.message)
    }
  }

  const curDef = regionDef(region)
  const curLv = region === 3 ? region3Lv : region === 2 ? region2Lv : region1Lv

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[78vh] max-h-[78vh] max-w-[480px] rounded-t-[28px] border-x-2 border-t-[3px] border-[#D4A574] bg-gradient-to-b from-[#FAF6ED] to-[#F1EADA]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-center text-xl font-black tracking-[0.3em] text-[#2D5A3D]">
            世界地图
          </DrawerTitle>
          <DrawerDescription className="sr-only">世界地图 · 切换今夜驻扎区域与开设连锁分店</DrawerDescription>
          <p className="text-center text-[11px] font-bold tracking-[0.15em] text-stone-500">
            三界山河 · 今夜守何处
          </p>
          <div className="mx-auto mt-1 h-px w-4/5 bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
        </DrawerHeader>

        <div
          data-vaul-no-drag
          className="mx-3 mb-3 flex min-h-0 flex-1 rounded-2xl border border-[#D4A574]/40 bg-white/50 p-1"
        >
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col gap-3 p-2">
              {/* 当前驻扎概览：区域图标 + 名称 + 第X夜 + BGM 曲名 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2"
                style={{ borderColor: `${curDef.themeColor}55`, backgroundColor: `${curDef.themeColor}0D` }}
              >
                <span className="text-2xl" aria-hidden>
                  {curDef.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black tracking-widest text-stone-400">当前驻扎</p>
                  <p className="truncate text-sm font-black" style={{ color: curDef.themeColor }}>
                    {curDef.name}
                    <span className="ml-1.5 text-xs font-bold text-stone-600">第 {curLv} 夜</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold text-stone-600 shadow-sm">
                  {/* night3（沸火赤川）为纯合成曲（无真实 MP3），标注与另两区区分 */}
                  🎵 BGM「{curDef.subtitle}」{curDef.bgmTrack === 'night3' ? '（合成曲）' : ''}
                </span>
              </motion.div>

              {/* 区域卡（数据驱动 REGIONS，stagger 入场） */}
              {REGIONS.map((def, i) => {
                const theme = CARD_THEME[def.id]
                const isCurrent = def.id === region
                const regionLv = def.id === 3 ? region3Lv : def.id === 2 ? region2Lv : region1Lv
                const rewardPct = Math.round((def.rewardMult - 1) * 100)
                // 三态判定：区域一始终开张；区域二/三由存档与前置决定（锁定 / 可开设 / 已开张）
                const regionOpened = def.id === 1 ? true : def.id === 2 ? region2Opened : region3Opened
                const canUnlock = def.id === 2 ? unlockable2 : def.id === 3 ? unlockable3 : false
                const ready = !regionOpened && canUnlock
                const locked = !regionOpened && !canUnlock
                // 前置条件与分店文案（区域一永不进入这些分支，兜底取区域二配置）
                const unlock = def.id === 3 ? REGION3_UNLOCK : REGION2_UNLOCK
                const branchName = def.id === 3 ? BRANCH_NAMES[3] : BRANCH_NAMES[2]
                const preLabel = def.id === 3 ? '水墨幽谷关卡' : '山道关卡'
                const preLevel = def.id === 3 ? region2Lv : level
                const goldBonus = def.id === 3 ? BRANCH3_GOLD_BONUS : BRANCH_GOLD_BONUS
                const staBonus = def.id === 3 ? BRANCH3_STAMINA_BONUS : BRANCH_STAMINA_BONUS
                const goldShort = Math.max(0, unlock.openCost - gold)
                const arming = armingRegion === def.id

                return (
                  <motion.div
                    key={def.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.05 + i * 0.09 }}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border-2 p-4 shadow-sm',
                      theme.card,
                      isCurrent && theme.borderCurrent,
                      locked && 'saturate-[0.65]',
                    )}
                  >
                    {/* 当前驻扎高亮：呼吸描边（subtle pulse） */}
                    {isCurrent && (
                      <motion.span
                        aria-hidden
                        className={cn('pointer-events-none absolute inset-0 rounded-2xl border-2', theme.borderCurrent)}
                        animate={{ opacity: [0.85, 0.2, 0.85] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}

                    {/* 头部：图标 + 名称/区域标签 + 状态徽章 */}
                    <div className="flex items-center gap-3">
                      {/* 区域三地火不熄：图标常燃摇摆；其余区域仅当前驻扎时摇摆 */}
                      <motion.span
                        animate={def.id === 3 || isCurrent ? { rotate: [0, -6, 6, 0] } : undefined}
                        transition={
                          def.id === 3 || isCurrent ? { repeat: Infinity, duration: 3.2 } : undefined
                        }
                        className={cn('text-3xl', locked && 'grayscale')}
                        aria-hidden
                      >
                        {def.icon}
                      </motion.span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-base font-black', theme.title)}>
                          {def.name}
                          {locked && (
                            <span className="ml-1.5 text-xs" aria-label="未解锁">
                              🔒
                            </span>
                          )}
                        </p>
                        <p className={cn('text-[10px] font-bold', theme.tag)}>
                          {def.id === 1 ? '区域一 · 大本营' : def.id === 2 ? '区域二 · 连锁分店' : '区域三 · 连锁分店'}
                        </p>
                      </div>
                      {isCurrent && (
                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black text-white shadow-sm"
                          style={{ backgroundColor: def.themeColor }}
                        >
                          今夜驻扎
                        </span>
                      )}
                    </div>

                    {/* 风物志 */}
                    <p className={cn('mt-2 text-[11px] leading-relaxed', theme.desc)}>{def.desc}</p>

                    {/* 情报行：关卡进度 / 战斗 BGM / 通关奖励 */}
                    <div className={cn('mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold', theme.info)}>
                      <span>🌙 第 {regionLv} 夜</span>
                      <span>🎵 BGM「{def.subtitle}」</span>
                      <span>💰 通关奖励 +{rewardPct}%</span>
                    </div>

                    {/* 敌踪预览（各区域自动换皮野怪名） */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn('text-[10px] font-bold', theme.enemyLabel)}>敌踪</span>
                      {ENEMY_KEYS.map((k) => (
                        <span key={k} className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', theme.enemyChip)}>
                          🐾 {def.enemyNames[k]}
                        </span>
                      ))}
                    </div>

                    {/* 本区独占稀有（V1.3.1）：招募池随区域轮换，稀有精怪各区域独占 */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={cn('text-[10px] font-bold', theme.enemyLabel)}>独占稀有</span>
                      {REGION_RARES[def.id].map((id) => {
                        const rd = YAOGUAI_MAP[id]
                        return (
                          <span
                            key={id}
                            className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', theme.enemyChip)}
                            style={{ color: rd?.color }}
                          >
                            ✨ {rd?.name ?? id}
                          </span>
                        )
                      })}
                    </div>

                    {/* 锁定态：前置进度条 + 费用要求（区域二/三通用结构） */}
                    {locked && (
                      <div className={cn('mt-3 flex flex-col gap-2.5 rounded-xl p-3', theme.lockPanel)}>
                        <p className={cn('text-[10px] font-black', theme.lockTitle)}>
                          🔒 开设{branchName} · 前置条件
                        </p>
                        {/* 区域三特有：需先开张水墨别院（未开张给警示条 + 布尔行） */}
                        {def.id === 3 && !region2Opened && (
                          <p className="rounded-lg bg-[#B9770E]/15 px-2 py-1.5 text-[10px] font-bold text-[#B9770E]">
                            ⚠️ 沸火赤川分店需先开张水墨别院
                          </p>
                        )}
                        {def.id === 3 && (
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className={theme.lockLabel}>水墨别院开张</span>
                            <span className={region2Opened ? theme.okValue : theme.lockValue}>
                              {region2Opened ? '✓ 已开张' : '✗ 未开张'}
                            </span>
                          </div>
                        )}
                        {[
                          {
                            key: 'lv',
                            label: `守店进度（${preLabel}）`,
                            cur: Math.min(preLevel, unlock.level),
                            max: unlock.level,
                            ok: preLevel >= unlock.level,
                          },
                          {
                            key: 'win',
                            label: '累计守店胜利',
                            cur: Math.min(wins, unlock.wins),
                            max: unlock.wins,
                            ok: wins >= unlock.wins,
                          },
                        ].map((r) => (
                          <div key={r.key}>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
                              <span className={theme.lockLabel}>{r.label}</span>
                              <span className={cn('tabular-nums', r.ok ? theme.okValue : theme.lockValue)}>
                                {r.cur}/{r.max}
                                {r.ok ? ' ✓' : ''}
                              </span>
                            </div>
                            <HpBar
                              value={r.cur}
                              max={r.max}
                              height={6}
                              color={r.ok ? 'bg-[#2D7A46]' : theme.lockBar}
                            />
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className={theme.lockLabel}>开设费用</span>
                          <span
                            className={cn(
                              'flex items-center gap-1 tabular-nums',
                              gold >= unlock.openCost ? theme.okValue : theme.lockValue,
                            )}
                          >
                            <GoldIcon size={11} /> {unlock.openCost} 金币
                            {gold >= unlock.openCost ? ' ✓' : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 前置达成态：开设分店（两步确认） */}
                    {ready && (
                      <div className="mt-3 flex flex-col gap-2">
                        <p className={cn('rounded-xl px-2 py-1.5 text-center text-[10px] font-black', theme.readyBar)}>
                          ✓ 前置已达成 · {def.name}静候掌柜入驻
                        </p>
                        <motion.button
                          type="button"
                          disabled={goldShort > 0}
                          onClick={() => handleOpenBranch(def.id)}
                          animate={!arming && goldShort <= 0 ? { scale: [1, 1.02, 1] } : undefined}
                          transition={
                            !arming && goldShort <= 0
                              ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
                              : undefined
                          }
                          className={cn(
                            'flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-black shadow-md transition-transform active:scale-95',
                            goldShort > 0
                              ? 'cursor-not-allowed bg-stone-300 text-stone-500 shadow-none'
                              : arming
                                ? 'bg-gradient-to-b from-[#D4943C] to-[#B3541E] text-white shadow-amber-800/25'
                                : theme.openBtn,
                          )}
                        >
                          {goldShort > 0
                            ? `${def.icon} 还差 ${goldShort.toLocaleString()} 金币`
                            : arming
                              ? `⚠️ 确认开设？将花费 ${unlock.openCost} 金币`
                              : `${def.icon} 开设${branchName}分店 · ${unlock.openCost}金币`}
                        </motion.button>
                        <p className={cn('text-center text-[10px] font-bold', theme.readyHint)}>
                          {goldShort > 0
                            ? `集齐 ${unlock.openCost} 金币即可开张（当前持有 ${gold.toLocaleString()}）`
                            : arming
                              ? '再次点击确认 · 3 秒内有效'
                              : `开张立得：挂机金币 ${pct(goldBonus)} · 全体休息恢复 ${pct(staBonus)}`}
                        </p>
                      </div>
                    )}

                    {/* 已开张态：分店效益徽章行（区域一大本营无分店效益） */}
                    {regionOpened && def.id !== 1 && (
                      <div className="mt-2.5">
                        <p className={cn('mb-1 text-[10px] font-black', theme.badgeTitle)}>🏪 分店效益（全体生效）</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            `🏪 挂机金币 ${pct(goldBonus)}`,
                            `😴 休息恢复 ${pct(staBonus)}`,
                            `⚔️ 敌军更强(Hp${scalePct(def.hpScale)}/Atk${scalePct(def.atkScale)})`,
                            `💰 通关奖励 ${pct(def.rewardMult - 1)}`,
                            `✨ 精英刷新 ${pct(def.eliteBonus)}`,
                          ].map((b) => (
                            <span key={b} className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold', theme.badge)}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 操作区：驻扎态 / 移驻按钮（锁定与待开设态不渲染） */}
                    {!locked && !ready && (
                      <div className="mt-3">
                        {isCurrent ? (
                          <div
                            className={cn(
                              'flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-black',
                              theme.stay,
                            )}
                            aria-label={`今夜驻扎${def.name}`}
                          >
                            📍 今夜驻扎 · 哨位已设
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSwitch(def.id)}
                            className={cn(
                              'h-11 w-full rounded-xl text-sm font-black text-white shadow-md transition-transform active:scale-95',
                              theme.switchBtn,
                            )}
                          >
                            移驻此处
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })}

              {/* 底部提示：两处分店的远程疗养收益（数值全部同源取自分店加成常量） */}
              <p className="rounded-xl bg-stone-800/90 px-3 py-2 text-center text-[10px] leading-relaxed text-stone-300">
                🏪 分店效益全体生效 · 水墨：挂机 {pct(BRANCH_GOLD_BONUS)}/休息 {pct(BRANCH_STAMINA_BONUS)} · 沸火：挂机{' '}
                {pct(BRANCH3_GOLD_BONUS)}/休息 {pct(BRANCH3_STAMINA_BONUS)}（远程疗养，可叠乘）
              </p>
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
