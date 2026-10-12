'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { ConfigIcon, GemIcon, GoldIcon, TicketIcon } from '@/components/game/shared'
import { achievementProgress, taskProgress, weekGoalInfo, useGameStore } from '@/game/store'
import { sfx } from '@/game/audio'
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORY_LABEL, DAILY_TASKS, WEEK_GOALS } from '@/game/config'
import type { AchievementCategory } from '@/game/config'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface TaskPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TASK_ICON: Record<string, string> = {
  login: '/images/ui/gift.png',
  night: '/images/ui/status-moon.png',
  capture: '/images/ui/prop-capture-net.png',
  recruit: '/images/ui/ticket.png',
  ad: '/images/ui/gift.png',
  upgrade: '/images/ui/cat-build.png',
  starup: '/images/ui/ui-star.png',
}

const CATEGORY_ICON: Record<AchievementCategory, string> = {
  capture: '/images/ui/prop-capture-net.png',
  battle: '/images/ui/battle-inn.png',
  boss: '/images/ui/prop-boss-lure.png',
  business: '/images/ui/festival-lantern.png',
  growth: '/images/ui/ui-star.png',
}

/** 成就进度展示格式（大数字缩写） */
function fmtNum(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k`
  return n.toLocaleString()
}

function notify(message: string) {
  const t = toast({ title: message })
  window.setTimeout(() => t.dismiss(), 2400)
}

/**
 * 任务面板 —— 每日任务 / 成就（捉妖·守店·妖王·经营四线）
 */
export function TaskPanel({ open, onOpenChange }: TaskPanelProps) {
  const save = useGameStore()
  const claimed = save.daily.tasksClaimed
  const doneCount = DAILY_TASKS.filter((t) => claimed.includes(t.id)).length

  const [tab, setTab] = useState<'daily' | 'achievement'>('daily')

  const handleClaim = (id: string) => {
    const res = useGameStore.getState().claimTask(id)
    if (res.ok) sfx.play('claim')
    notify(res.message)
  }

  const handleClaimWeek = (idx: number) => {
    const res = useGameStore.getState().claimWeekGoal(idx)
    if (res.ok) sfx.play('claim')
    notify(res.message)
  }

  const handleClaimAchievement = (id: string) => {
    const res = useGameStore.getState().claimAchievement(id)
    if (res.ok) sfx.play('levelup')
    notify(res.message)
  }

  // 成就汇总
  const achievementSummary = useMemo(() => {
    const achieved = ACHIEVEMENTS.filter((a) => save.achievements.includes(a.id)).length
    const claimable = ACHIEVEMENTS.filter(
      (a) => !save.achievements.includes(a.id) && achievementProgress(save, a.id) >= a.target
    ).length
    const byCategory = (cat: AchievementCategory) => ACHIEVEMENTS.filter((a) => a.category === cat)
    return { achieved, total: ACHIEVEMENTS.length, claimable, byCategory }
  }, [save])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="panel-sheet mx-auto h-[78vh] max-h-[78vh] max-w-[480px] rounded-t-[28px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="panel-title text-center text-xl">
            任 务 · 成 就
          </DrawerTitle>
          <DrawerDescription className="sr-only">每日任务与成就进度</DrawerDescription>

          {/* 页签切换（滑块式高亮） */}
          <div className="mx-auto mt-2 flex w-full max-w-[240px] rounded-full border border-[#D4A574]/60 bg-white/70 p-1">
            <button
              type="button"
              onClick={() => setTab('daily')}
              className={cn(
                'relative flex-1 rounded-full py-1.5 text-xs font-black transition-all active:scale-95',
                tab === 'daily' ? 'text-[#E6DCC8]' : 'text-stone-500'
              )}
            >
              {tab === 'daily' && (
                <motion.span
                  layoutId="task-tab-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-[#8B2E24] shadow-md"
                  aria-hidden
                />
              )}
              <span className="relative z-10">每日任务</span>
              {DAILY_TASKS.some((t) => !claimed.includes(t.id) && taskProgress(save, t.id) >= t.target) && (
                <span className="absolute right-1 top-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-red-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('achievement')}
              className={cn(
                'relative flex-1 rounded-full py-1.5 text-xs font-black transition-all active:scale-95',
                tab === 'achievement' ? 'text-[#E6DCC8]' : 'text-stone-500'
              )}
            >
              {tab === 'achievement' && (
                <motion.span
                  layoutId="task-tab-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full bg-[#8B2E24] shadow-md"
                  aria-hidden
                />
              )}
              <span className="relative z-10">成就</span>
              {achievementSummary.claimable > 0 && (
                <span className="absolute right-1 top-0.5 z-10 h-2 w-2 animate-pulse rounded-full bg-red-500" />
              )}
            </button>
          </div>

          {/* 摘要行 */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-stone-500">
            {tab === 'daily' ? (
              <>
                <span>每日 0 点刷新</span>
                <span>·</span>
                <span>
                  已完成 <b className="text-[#8B2E24]">{doneCount}</b>/{DAILY_TASKS.length}
                </span>
              </>
            ) : (
              <>
                <span>
                  成就达成 <b className="text-[#8B2E24]">{achievementSummary.achieved}</b>/{achievementSummary.total}
                </span>
                {achievementSummary.claimable > 0 && (
                  <span className="animate-pulse font-black text-[#D4933D]">
                    · {achievementSummary.claimable} 个可领取!
                  </span>
                )}
              </>
            )}
          </div>
          <div className="mx-auto mt-1 h-px w-4/5 bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
        </DrawerHeader>

        {tab === 'daily' ? (
          <div
            data-vaul-no-drag
            className="mx-3 mb-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-[#D4A574]/40 bg-white/50 p-2"
          >
            {DAILY_TASKS.map((t, idx) => {
              const progress = taskProgress(save, t.id)
              const isDone = progress >= t.target
              const isClaimed = claimed.includes(t.id)
              const claimable = isDone && !isClaimed
              const pct = Math.min(100, (progress / t.target) * 100)
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative flex items-center gap-3 rounded-2xl border border-[#D4A574]/50 bg-white/80 p-3"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8B2E24]/10">
                    <ConfigIcon icon={TASK_ICON[t.id] ?? '/images/ui/nav-task.png'} size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-stone-800">{t.name}</span>
                      <span className="text-[10px] tabular-nums text-stone-500">
                        {Math.min(progress, t.target)}/{t.target}
                      </span>
                    </div>
                    <p className="mb-1.5 truncate text-[11px] text-stone-500">{t.desc}</p>
                    <Progress
                      value={isClaimed ? 100 : pct}
                      className={cn(
                        'h-1.5 bg-stone-200',
                        isClaimed
                          ? '[&>div]:bg-emerald-500'
                          : claimable
                            ? '[&>div]:bg-gradient-to-r [&>div]:from-[#E8B84B] [&>div]:to-[#D4933D] [&>div]:shadow-[0_0_6px_rgba(232,184,75,0.8)]'
                            : '[&>div]:bg-stone-400'
                      )}
                    />
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-stone-600">
                      {t.reward.gold ? (
                        <span className="flex items-center gap-0.5">
                          <GoldIcon size={13} />
                          {t.reward.gold}
                        </span>
                      ) : null}
                      {t.reward.gems ? (
                        <span className="flex items-center gap-0.5">
                          <GemIcon size={13} />
                          {t.reward.gems}
                        </span>
                      ) : null}
                      {t.reward.tickets ? (
                        <span className="flex items-center gap-0.5">
                          <TicketIcon size={13} />
                          {t.reward.tickets}
                        </span>
                      ) : null}
                    </div>
                    {isClaimed ? (
                      <span className="flex h-11 items-center rounded-xl bg-stone-100 px-3 text-xs font-black text-stone-400">
                        ✓ 已领取
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!claimable}
                        onClick={() => handleClaim(t.id)}
                        className={cn(
                          'relative flex h-11 items-center rounded-xl px-4 text-xs font-black transition-transform active:scale-95',
                          claimable
                            ? 'animate-pulse bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-white shadow-md shadow-amber-500/30'
                            : 'cursor-not-allowed bg-stone-200 text-stone-400'
                        )}
                      >
                        领取
                        {claimable && (
                          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-red-500" />
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}

            {/* 七日目标：第 1~7 天递进奖励链（超 7 日自动重开新一轮） */}
            {(() => {
              const wg = weekGoalInfo(save)
              const curGoal = WEEK_GOALS[wg.dayIdx]
              const curClaimed = wg.claimed[wg.dayIdx]
              const curProgress = curGoal ? save.daily.events[curGoal.key] ?? 0 : 0
              const curDone = curGoal ? curProgress >= curGoal.target : false
              const curClaimable = curDone && !curClaimed
              const curPct = curGoal ? Math.min(100, (curProgress / curGoal.target) * 100) : 0
              return (
                <div className="rounded-2xl border border-[#C77DFF]/40 bg-gradient-to-b from-[#3A2440]/10 to-transparent p-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="flex items-center gap-1 text-sm font-black text-stone-800">
                      <span className="text-[#8B3FA8]">🗓</span> 七日目标
                    </span>
                    <span className="text-[10px] text-stone-500">第 {wg.dayIdx + 1} / 7 天 · 超期自动重开</span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {WEEK_GOALS.map((g, i) => {
                      const st = wg.claimed[i]
                        ? 'claimed'
                        : i === wg.dayIdx
                          ? 'current'
                          : i > wg.dayIdx
                            ? 'locked'
                            : 'past'
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex h-7 flex-1 items-center justify-center rounded-lg border text-[10px] font-black',
                            st === 'claimed' && 'border-emerald-400/60 bg-emerald-100/70 text-emerald-700',
                            st === 'current' && 'border-[#D4933D] bg-gradient-to-b from-[#FFE9B8] to-[#E8B84B]/40 text-[#8B2E24] shadow-[0_0_6px_rgba(232,184,75,0.7)]',
                            st === 'locked' && 'border-stone-200 bg-white/40 text-stone-300',
                            st === 'past' && 'border-stone-300/60 bg-stone-100/70 text-stone-400'
                          )}
                        >
                          {st === 'claimed' ? '✓' : i + 1}
                        </div>
                      )
                    })}
                  </div>
                  {curGoal && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#D4A574]/50 bg-white/80 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-stone-800">{curGoal.name}</p>
                        <p className="truncate text-[10px] text-stone-500">
                          {curGoal.desc}（{Math.min(curProgress, curGoal.target)}/{curGoal.target}）
                        </p>
                        <Progress
                          value={curPct}
                          className={cn('mt-1 h-1.5 bg-stone-200', curClaimed ? '[&>div]:bg-emerald-500' : '[&>div]:bg-[#8B3FA8]')}
                        />
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-black text-stone-600">
                          {curGoal.reward.gold ? <span className="flex items-center gap-0.5"><GoldIcon size={12} />{curGoal.reward.gold}</span> : null}
                          {curGoal.reward.gems ? <span className="flex items-center gap-0.5"><GemIcon size={12} />{curGoal.reward.gems}</span> : null}
                          {curGoal.reward.tickets ? <span className="flex items-center gap-0.5"><TicketIcon size={12} />{curGoal.reward.tickets}</span> : null}
                        </div>
                      </div>
                      {curClaimed ? (
                        <span className="flex h-10 shrink-0 items-center rounded-xl bg-stone-100 px-3 text-xs font-black text-stone-400">✓ 已领</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!curClaimable}
                          onClick={() => handleClaimWeek(wg.dayIdx)}
                          className={cn(
                            'relative flex h-10 shrink-0 items-center rounded-xl px-4 text-xs font-black transition-transform active:scale-95',
                            curClaimable
                              ? 'animate-pulse bg-gradient-to-r from-[#8B3FA8] to-[#C77DFF] text-white shadow-md shadow-purple-500/30'
                              : 'cursor-not-allowed bg-stone-200 text-stone-400'
                          )}
                        >
                          领取
                          {curClaimable && (
                            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-red-500" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            <p className="px-2 pb-1 text-center text-[10px] text-stone-400">
              任务进度随玩法自动累计，奖励记得当日领取，过期清零哦
            </p>
          </div>
        ) : (
          <div
            data-vaul-no-drag
            className="mx-3 mb-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-[#D4A574]/40 bg-white/50 p-2"
          >
            {(['capture', 'battle', 'boss', 'business', 'growth'] as AchievementCategory[]).map((cat) => (
              <div key={cat} className="flex flex-col gap-2">
                {/* 分类标题 */}
                <div className="sticky top-0 z-10 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#F1E5C9] via-[#E8DAB6] to-[#F1E5C9] px-2 py-1 text-[11px] font-black tracking-wider text-[#8B2E24]">
                  <ConfigIcon icon={CATEGORY_ICON[cat]} size={14} />
                  {ACHIEVEMENT_CATEGORY_LABEL[cat]}成就
                  <span className="text-stone-400">
                    {achievementSummary.byCategory(cat).filter((a) => save.achievements.includes(a.id)).length}/
                    {achievementSummary.byCategory(cat).length}
                  </span>
                </div>

                {achievementSummary.byCategory(cat).map((a, idx) => {
                  const progress = achievementProgress(save, a.id)
                  const isClaimed = save.achievements.includes(a.id)
                  const isDone = progress >= a.target
                  const claimable = isDone && !isClaimed
                  const pct = Math.min(100, (progress / a.target) * 100)
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={cn(
                        'relative flex items-center gap-3 rounded-2xl border p-3 transition-colors',
                        isClaimed
                          ? 'border-[#E8B84B]/70 bg-emerald-50/60 ring-1 ring-[#E8B84B]/45'
                          : claimable
                            ? 'border-[#E8B84B] bg-gradient-to-r from-amber-50/90 to-white/80 shadow-sm'
                            : 'border-[#D4A574]/50 bg-white/80'
                      )}
                    >
                      {/* 成就徽章 */}
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                          isClaimed
                            ? 'bg-emerald-100 ring-1 ring-[#E8B84B]/60'
                            : claimable
                              ? 'bg-amber-100 ring-2 ring-[#E8B84B] ring-offset-1'
                              : 'bg-stone-100 grayscale'
                        )}
                      >
                        <ConfigIcon icon={CATEGORY_ICON[cat]} size={22} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-stone-800">{a.name}</span>
                          <span className="text-[10px] tabular-nums text-stone-500">
                            {fmtNum(Math.min(progress, a.target))}/{fmtNum(a.target)}
                          </span>
                        </div>
                        <p className="mb-1.5 truncate text-[11px] text-stone-500">{a.desc}</p>
                        <Progress
                          value={isClaimed ? 100 : pct}
                          className={cn(
                            'h-1.5 bg-stone-200',
                            isClaimed
                              ? '[&>div]:bg-emerald-500'
                              : claimable
                                ? '[&>div]:bg-gradient-to-r [&>div]:from-[#E8B84B] [&>div]:to-[#D4933D] [&>div]:shadow-[0_0_6px_rgba(232,184,75,0.8)]'
                                : '[&>div]:bg-stone-400'
                          )}
                        />
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-stone-600">
                          {a.reward.gold ? (
                            <span className="flex items-center gap-0.5">
                              <GoldIcon size={13} />
                              {a.reward.gold}
                            </span>
                          ) : null}
                          {a.reward.gems ? (
                            <span className="flex items-center gap-0.5">
                              <GemIcon size={13} />
                              {a.reward.gems}
                            </span>
                          ) : null}
                          {a.reward.tickets ? (
                            <span className="flex items-center gap-0.5">
                              <TicketIcon size={13} />
                              {a.reward.tickets}
                            </span>
                          ) : null}
                        </div>
                        {isClaimed ? (
                          <span className="flex h-11 items-center rounded-xl bg-emerald-100 px-3 text-xs font-black text-emerald-600">
                            ✓ 已达成
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!claimable}
                            onClick={() => handleClaimAchievement(a.id)}
                            className={cn(
                              'relative flex h-11 items-center rounded-xl px-4 text-xs font-black transition-transform active:scale-95',
                              claimable
                                ? 'animate-pulse bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-white shadow-md shadow-amber-500/30'
                                : 'cursor-not-allowed bg-stone-200 text-stone-400'
                            )}
                          >
                            领取
                            {claimable && (
                              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-red-500" />
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}

            <p className="px-2 pb-1 text-center text-[10px] text-stone-400">
              成就永久累计 · 捉妖/守店/妖王/经营四条线共同记录掌柜的山海传奇
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
