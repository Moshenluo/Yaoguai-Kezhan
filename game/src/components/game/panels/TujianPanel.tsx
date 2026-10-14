'use client'

import { Fragment, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { AdDialog } from '@/components/game/AdDialog'
import { SharePosterDialog } from '@/components/game/SharePosterDialog'
import { ElementBadge, ElementChip } from '@/components/game/ElementBadge'
import { ConfigIcon, GemIcon, GoldIcon, GradeTag, TicketIcon, YaoAvatar, notify } from '@/components/game/shared'
import { useGameStore } from '@/game/store'
import { TUJIAN_REWARDS, lineupSynergy } from '@/game/config'
import { YAOGUAI, YAOGUAI_MAP } from '@/game/yaoguai'
import type { Element, YaoguaiDef } from '@/game/types'
import { cn } from '@/lib/utils'

export interface TujianPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 五行相克环：金→木→土→水→火→（循环回金） */
const CYCLE: Element[] = ['metal', 'wood', 'earth', 'water', 'fire']

/** 收集进度属性分区展示顺序（五行 + 光暗） */
const ELEM_ORDER: Element[] = ['metal', 'wood', 'water', 'fire', 'earth', 'light', 'dark']

/** 五行相生加成对（数据驱动：拿全五行阵容跑 lineupSynergy 得全部 pairs） */
const SYNERGY_PAIRS = lineupSynergy([
  { element: 'metal' },
  { element: 'water' },
  { element: 'wood' },
  { element: 'fire' },
  { element: 'earth' },
]).pairs

/**
 * 图鉴面板 —— 山海经妖怪收集进度
 */
export function TujianPanel({ open, onOpenChange }: TujianPanelProps) {
  const tujian = useGameStore((s) => s.tujian)
  const tasksClaimed = useGameStore((s) => s.daily.tasksClaimed)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [lockedId, setLockedId] = useState<string | null>(null)
  const [hintAdOpen, setHintAdOpen] = useState(false)
  /** 属性克制说明卡展开态（默认收起，避免占屏；玩家可自行展开查阅） */
  const [elemOpen, setElemOpen] = useState(false)
  /** 已看广告解锁线索的妖怪（本会话有效） */
  const [hinted, setHinted] = useState<ReadonlySet<string>>(new Set())
  const [posterOpen, setPosterOpen] = useState(false)

  const unlocked = useMemo(() => new Set(tujian), [tujian])
  const total = YAOGUAI.length

  /** 属性分区收集进度（已收录/总数） */
  const elemProgress = useMemo(() => {
    const m = new Map<Element, { have: number; total: number }>()
    for (const y of YAOGUAI) {
      if (!y.element) continue
      const e = m.get(y.element) ?? { have: 0, total: 0 }
      e.total += 1
      if (unlocked.has(y.id)) e.have += 1
      m.set(y.element, e)
    }
    return m
  }, [unlocked])

  /** 品级收集进度（普通/稀有/传说） */
  const gradeProgress = useMemo(() => {
    const g = { normal: { have: 0, total: 0 }, rare: { have: 0, total: 0 }, legend: { have: 0, total: 0 } }
    for (const y of YAOGUAI) {
      const e = g[y.grade]
      e.total += 1
      if (unlocked.has(y.id)) e.have += 1
    }
    return g
  }, [unlocked])

  const rewardState = (count: number) => {
    const claimed = tasksClaimed.includes(`tujian-${count}`)
    const claimable = !claimed && tujian.length >= count
    return { claimed, claimable }
  }

  const handleClaim = (count: number) => {
    const res = useGameStore.getState().claimTujianReward(count)
    notify(res.message)
  }

  const detailDef: YaoguaiDef | null = detailId ? (YAOGUAI_MAP[detailId] ?? null) : null
  const lockedDef: YaoguaiDef | null = lockedId ? (YAOGUAI_MAP[lockedId] ?? null) : null

  const handleCardClick = (y: YaoguaiDef) => {
    if (unlocked.has(y.id)) setDetailId(y.id)
    else setLockedId(y.id)
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="panel-sheet mx-auto h-[78vh] max-h-[78vh] max-w-[480px] rounded-t-[28px]">
          <DrawerHeader className="pb-1">
            <DrawerTitle className="panel-title text-center text-xl">
              图 鉴
            </DrawerTitle>
            <DrawerDescription className="sr-only">山海经妖怪收集进度与收集奖励</DrawerDescription>
            <div className="mx-auto mt-1 h-px w-4/5 bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
          </DrawerHeader>

          <div
            data-vaul-no-drag
            className="mx-3 mb-3 flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-[#D4A574]/40 bg-white/50 p-2"
          >
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-3 p-1.5">
                {/* 收集进度（总进度 + 属性分区 + 品级 + 分享海报入口） */}
                <div className="rounded-2xl border border-[#D4A574]/50 bg-white/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-black text-stone-700">📜 收集进度</span>
                    <span className="text-xs font-black tabular-nums text-[#8B2E24]">
                      已收集 {tujian.length} / {total}
                    </span>
                  </div>
                  <Progress
                    value={(tujian.length / total) * 100}
                    className="h-2.5 bg-stone-200 [&>div]:bg-gradient-to-r [&>div]:from-[#E8B84B] [&>div]:to-[#D4933D] [&>div]:shadow-[0_0_6px_rgba(232,184,75,0.6)]"
                  />
                  {/* 属性分区：集齐点亮金色 */}
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    {ELEM_ORDER.map((el) => {
                      const p = elemProgress.get(el)
                      if (!p) return null
                      const done = p.have === p.total
                      return (
                        <span
                          key={el}
                          className={cn(
                            'flex items-center gap-0.5 text-[10px] font-bold tabular-nums',
                            done ? 'text-[#B8860B]' : 'text-stone-400'
                          )}
                        >
                          <ElementBadge element={el} size="xs" />
                          {p.have}/{p.total}
                        </span>
                      )
                    })}
                  </div>
                  {/* 品级进度 + 分享海报入口 */}
                  <div className="mt-2 flex items-center justify-between border-t border-[#D4A574]/30 pt-2">
                    <span className="text-[10px] font-bold tabular-nums text-stone-500">
                      普通 {gradeProgress.normal.have}/{gradeProgress.normal.total} · 稀有 {gradeProgress.rare.have}/{gradeProgress.rare.total} · 传说 {gradeProgress.legend.have}/{gradeProgress.legend.total}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPosterOpen(true)}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-[#E8B84B]/70 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-[#B8860B] transition active:scale-95"
                    >
                      <ConfigIcon icon="/images/ui/festival-lantern.png" size={11} />
                      分享海报
                    </button>
                  </div>
                </div>

                {/* 属性克制 · 相生说明卡（可折叠） */}
                <Collapsible open={elemOpen} onOpenChange={setElemOpen}>
                  <div className="rounded-2xl border border-[#D4A574]/50 bg-white/80 p-2.5">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        aria-expanded={elemOpen}
                        className="flex w-full items-center justify-between active:scale-95"
                      >
                        <span className="text-xs font-black text-stone-700">☯️ 属性克制 · 相生</span>
                        <span className="text-[10px] font-bold text-stone-400">
                          {elemOpen ? '收起 ▲' : '展开 ▼'}
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 flex flex-col gap-2">
                        {/* 五行相克环 */}
                        <div>
                          <p className="mb-1 text-[10px] font-black text-stone-500">⚔️ 五行相克</p>
                          <div className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1 rounded-xl bg-[#FAF5EA] px-2 py-1.5">
                            {CYCLE.map((el, i) => (
                              <Fragment key={el}>
                                {i > 0 && (
                                  <span aria-hidden className="px-0.5 text-[10px] font-bold text-stone-400">
                                    →
                                  </span>
                                )}
                                <ElementBadge element={el} size="sm" />
                              </Fragment>
                            ))}
                            <span aria-hidden className="px-0.5 text-[10px] font-bold text-stone-400">
                              →
                            </span>
                            <span aria-label="循环相克" className="text-[10px] font-bold text-stone-400">
                              ↺
                            </span>
                          </div>
                          <p className="mt-1 text-center text-[10px] font-bold text-stone-500">
                            克制 +30% 伤害 · 被克 -20%
                          </p>
                        </div>
                        {/* 光暗互克 */}
                        <div>
                          <p className="mb-1 text-[10px] font-black text-stone-500">✨ 光暗互克</p>
                          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-[#FAF5EA] px-2 py-1.5">
                            <ElementBadge element="light" size="sm" />
                            <span aria-hidden className="text-[10px] font-bold text-stone-400">
                              ⇄
                            </span>
                            <ElementBadge element="dark" size="sm" />
                          </div>
                        </div>
                        {/* 五行相生 */}
                        <div>
                          <p className="mb-1 text-[10px] font-black text-stone-500">
                            🌿 五行相生（同队上阵触发全队加成）
                          </p>
                          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#FAF5EA] p-1.5">
                            {SYNERGY_PAIRS.map(({ pair, kind, value }) => (
                              <span
                                key={pair.join('+')}
                                className="flex items-center justify-center gap-1 text-[9px] font-bold text-stone-600"
                              >
                                <ElementBadge element={pair[0]} size="xs" />
                                <span aria-hidden>+</span>
                                <ElementBadge element={pair[1]} size="xs" />
                                <span>
                                  全队{kind === 'atk' ? '攻击' : '生命'}+{Math.round(value * 100)}%
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* 收集奖励横排 */}
                <div className="rounded-2xl border border-[#D4A574]/50 bg-white/80 p-2.5">
                  <p className="mb-1.5 inline-flex items-center gap-1 text-xs font-black text-stone-700">
                    <ConfigIcon icon="/images/ui/gift.png" size={14} />
                    收集奖励
                  </p>
                  <div className="flex items-start justify-between gap-1.5">
                    {TUJIAN_REWARDS.map((r) => {
                      const { claimed, claimable } = rewardState(r.count)
                      return (
                        <button
                          type="button"
                          key={r.count}
                          title={r.reward.label}
                          disabled={!claimable}
                          onClick={() => handleClaim(r.count)}
                          className={cn(
                            'relative flex flex-1 flex-col items-center gap-0.5 rounded-xl border p-2 transition-transform active:scale-95',
                            claimable
                              ? 'animate-pulse border-[#E8B84B] bg-amber-50 shadow-md shadow-amber-400/30'
                              : 'border-transparent bg-stone-100/70',
                            claimed && 'opacity-60'
                          )}
                        >
                          <span
                            className={cn(
                              'leading-none',
                              claimed && 'grayscale',
                              !claimed && !claimable && 'opacity-40 grayscale'
                            )}
                          >
                            <ConfigIcon
                              icon={
                                claimed
                                  ? '/images/ui/nav-bag.png'
                                  : claimable
                                    ? '/images/ui/gift.png'
                                    : '/images/ui/status-lock.png'
                              }
                              size={22}
                            />
                          </span>
                          <span className="text-[10px] font-bold text-stone-600">{r.count} 妖</span>
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-stone-500">
                            {r.reward.gold ? (
                              <span className="flex items-center gap-0.5">
                                <GoldIcon size={10} />
                                {r.reward.gold}
                              </span>
                            ) : null}
                            {r.reward.gems ? (
                              <span className="flex items-center gap-0.5">
                                <GemIcon size={10} />
                                {r.reward.gems}
                              </span>
                            ) : null}
                            {r.reward.tickets ? (
                              <span className="flex items-center gap-0.5">
                                <TicketIcon size={10} />
                                {r.reward.tickets}
                              </span>
                            ) : null}
                          </span>
                          {claimable && (
                            <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-red-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 图鉴网格（弹入节奏 + 悬浮微升） */}
                <div className="grid grid-cols-3 gap-2">
                  {YAOGUAI.map((y, i) => {
                    const isUnlocked = unlocked.has(y.id)
                    const isLegend = y.grade === 'legend'
                    return (
                      <motion.button
                        type="button"
                        key={y.id}
                        onClick={() => handleCardClick(y)}
                        initial={{ opacity: 0, y: 10, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.04 + i * 0.03, type: 'spring', stiffness: 300, damping: 22 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'relative flex min-h-[112px] flex-col items-center gap-1 rounded-2xl border p-2',
                          isUnlocked
                            ? 'border-[#D4A574]/60 bg-white/90 shadow-sm hover:border-[#E8B84B] hover:shadow-md'
                            : isLegend
                              ? 'border-rose-200/80 bg-rose-50/50'
                              : 'border-stone-200 bg-stone-100/60'
                        )}
                      >
                        {isLegend && !isUnlocked && (
                          <span className="absolute left-1 top-1 rounded-full bg-rose-400/90 px-1.5 py-px text-[8px] font-bold text-white">
                            V1.1
                          </span>
                        )}
                        <div className="pt-1">
                          <YaoAvatar id={y.id} size={54} active={isUnlocked} />
                        </div>
                        <span className="flex items-center gap-1">
                          <span
                            className={cn(
                              'text-xs font-bold',
                              isUnlocked ? 'text-stone-800' : 'text-stone-400'
                            )}
                          >
                            {isUnlocked ? y.name : '？？？'}
                          </span>
                          {/* 属性徽章（仅已解锁展示，不剧透未收录妖） */}
                          {isUnlocked && <ElementBadge element={y.element} size="xs" hideNone />}
                        </span>
                        {isUnlocked ? (
                          <GradeTag grade={y.grade} />
                        ) : (
                          <span
                            className={cn(
                              'text-[9px]',
                              isLegend ? 'font-bold text-rose-400' : 'text-stone-400'
                            )}
                          >
                            {isLegend ? '敬请期待' : '未解锁'}
                          </span>
                        )}
                        {!isUnlocked && !isLegend && hinted.has(y.id) && (
                          <span className="text-[8px] font-bold text-amber-600">有线索</span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>

      {/* 已解锁妖怪详情 */}
      <Dialog
        open={detailId !== null}
        onOpenChange={(o) => {
          if (!o) setDetailId(null)
        }}
      >
        <DialogContent className="max-w-[360px] rounded-3xl border-2 ui-paper p-5">
          {detailDef && (
            <div className="flex flex-col gap-3">
              <DialogHeader className="items-center space-y-1">
                <DialogTitle className="flex items-center gap-2 text-lg font-black text-[#8B2E24]">
                  {detailDef.name}
                  <span className="text-xs font-normal text-stone-400">{detailDef.pinyin}</span>
                </DialogTitle>
                <DialogDescription asChild>
                  <span className="flex items-center justify-center gap-2">
                    <GradeTag grade={detailDef.grade} />
                    {detailDef.element ? <ElementChip element={detailDef.element} /> : null}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="flex justify-center"
              >
                <YaoAvatar id={detailDef.id} size={88} />
              </motion.div>

              <div className="rounded-xl bg-stone-800/90 px-3 py-2.5 text-center">
                <p className="text-[11px] tracking-[0.2em] text-amber-100/90">「 {detailDef.origin} 」</p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-300">{detailDef.form}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2 text-center">
                  <p className="inline-flex items-center justify-center gap-1 text-[9px] text-amber-600">
                    <ConfigIcon icon="/images/ui/ui-sun.png" size={11} />
                    白天职业
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-stone-700">{detailDef.dayJobName}</p>
                </div>
                <div className="rounded-xl border border-[#8B2E24]/30 bg-[#8B2E24]/5 p-2 text-center">
                  <p className="inline-flex items-center justify-center gap-1 text-[9px] text-[#8B2E24]">
                    <ConfigIcon icon="/images/ui/status-moon.png" size={11} />
                    夜晚定位
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-stone-700">{detailDef.nightRoleName}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4A574]/50 bg-white/80 p-3">
                <p className="text-[10px] font-black text-stone-500">📜 获取方式</p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-700">{detailDef.obtain}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 未解锁妖怪：线索 / V1.1 */}
      <Dialog
        open={lockedId !== null}
        onOpenChange={(o) => {
          if (!o) setLockedId(null)
        }}
      >
        <DialogContent className="max-w-[340px] rounded-3xl border-2 ui-paper p-5">
          {lockedDef && (
            <div className="flex flex-col items-center gap-3">
              <DialogHeader className="items-center">
                <DialogTitle className="text-base font-black text-[#8B2E24]">
                  {lockedDef.grade === 'legend' ? '传说妖王' : '未解锁 · 神秘妖怪'}
                </DialogTitle>
              </DialogHeader>

              <YaoAvatar id={lockedDef.id} size={80} active={false} />

              {lockedDef.grade === 'legend' ? (
                <>
                  <p className="text-center text-sm font-bold text-stone-600">？？？</p>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-center">
                    <p className="text-xs font-black text-rose-500">V1.1 敬请期待</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                      传说妖王「{lockedDef.name}」将在 V1.1 版本降临客栈，届时开放收服
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-stone-400">「 ？？？ 」</p>
                  {hinted.has(lockedDef.id) ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full rounded-2xl border border-amber-200 bg-amber-50/80 p-3"
                    >
                      <p className="mb-1 text-[10px] font-black text-amber-600">线索 · 形态</p>
                      <p className="text-[11px] leading-relaxed text-stone-700">{lockedDef.form}</p>
                      <p className="mt-1.5 text-[10px] text-stone-400">
                        在夜间守店中寻找它的踪迹，控血捕捉即可收录
                      </p>
                    </motion.div>
                  ) : (
                    <>
                      <p className="text-center text-[11px] text-stone-500">
                        此妖尚未收录，看一段广告解锁它的形态线索
                      </p>
                      <Button
                        onClick={() => setHintAdOpen(true)}
                        className="h-11 w-full rounded-xl bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-sm font-black text-white shadow-md shadow-amber-500/30 transition-transform active:scale-95"
                      >
                        看广告解锁线索
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 图鉴线索广告 */}
      <AdDialog
        scene="tujian-hint"
        open={hintAdOpen}
        onOpenChange={setHintAdOpen}
        onReward={() => {
          if (lockedId) setHinted((prev) => new Set(prev).add(lockedId))
        }}
      />

      {/* 分享海报 */}
      <SharePosterDialog open={posterOpen} onOpenChange={setPosterOpen} />
    </>
  )
}
