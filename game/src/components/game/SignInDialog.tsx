'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfigIcon, GemIcon, GoldIcon, TicketIcon } from '@/components/game/shared'
import { SEVEN_DAY_REWARDS } from '@/game/config'
import type { SignInReward } from '@/game/config'
import { signInAvailable, useGameStore } from '@/game/store'
import { sfx } from '@/game/audio'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface SignInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function notify(title: string, description?: string) {
  const t = toast({ title, description })
  window.setTimeout(() => t.dismiss(), 2200)
}

type CardState = 'claimed' | 'today' | 'future'

interface ConfettiPiece {
  id: number
  left: number
  delay: number
  dur: number
  size: number
  color: string
  round: boolean
}

/**
 * 七日签到弹窗 —— 每日登录领奖，7 天一轮循环
 * 挂载入口由 DayScreen / 主界面负责：<SignInDialog open={...} onOpenChange={...} />
 */
export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] rounded-2xl border-[#D4A574] bg-gradient-to-b from-[#FBF5E8] to-[#F3E7CC] p-5">
        {/* 内容放在子组件：弹窗关闭即卸载，签到成功等本地状态自然复位 */}
        <SignInBody />
      </DialogContent>
    </Dialog>
  )
}

function SignInBody() {
  const signIn = useGameStore((s) => s.signIn)
  const canClaim = useGameStore((s) => signInAvailable(s))
  const [justClaimed, setJustClaimed] = useState<number | null>(null)

  const totalDays = signIn.totalDays
  // 本轮已领天数：今日已签且 totalDays%7===0 且 >0 → 恰好领满一轮显示 7；
  // 今日可领时按 totalDays%7 计（新一轮开启自然归 0）
  const claimedThisRound = canClaim
    ? totalDays % 7
    : totalDays % 7 === 0 && totalDays > 0
      ? 7
      : totalDays % 7
  const todayIndex = canClaim ? totalDays % 7 : -1
  const roundDone = !canClaim && claimedThisRound >= 7

  // 轻量彩带（签到成功时一次性播放，随 justClaimed 卸载）
  const confetti = useMemo<ConfettiPiece[]>(() => {
    const colors = ['#E8B84B', '#D4A574', '#E6DCC8', '#E8C97A', '#C98A3D', '#8B2E24']
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: 6 + Math.random() * 88,
      delay: Math.random() * 0.25,
      dur: 1.1 + Math.random() * 0.6,
      size: 4 + Math.random() * 4,
      color: colors[i % colors.length],
      round: Math.random() > 0.5,
    }))
  }, [])

  const handleClaim = () => {
    const res = useGameStore.getState().claimSignIn()
    if (res.ok) {
      sfx.play('claim')
      const day = res.day ?? 1
      setJustClaimed(day)
      window.setTimeout(() => setJustClaimed(null), 2000)
      const reward = SEVEN_DAY_REWARDS[day - 1]
      const parts: string[] = []
      if (reward.gold !== undefined) parts.push(`金币×${reward.gold}`)
      if (reward.gems !== undefined) parts.push(`灵石×${reward.gems}`)
      if (reward.tickets !== undefined) parts.push(`招募券×${reward.tickets}`)
      notify(res.message, `${parts.join(' · ')} 已入账`)
    } else {
      notify(res.message)
    }
  }

  return (
    <>
      <DialogHeader className="items-center space-y-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8B2E24]/10">
          <ConfigIcon icon="/images/ui/gift.png" size={26} />
        </div>
        <DialogTitle className="text-lg font-bold text-[#4A3728]">七日签到</DialogTitle>
        <DialogDescription className="text-xs text-[#8B7355]">每日登录领取厚礼，连续签到更丰盛</DialogDescription>
      </DialogHeader>

      {/* 本轮进度 */}
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-[#D4A574]/50 bg-white/60 px-3 py-1 text-[10px] font-bold text-[#8B7355]">
        本轮已签 <span className="font-black text-[#8B2E24]">{claimedThisRound}</span> / 7 天
      </div>

      {/* 7 天奖励网格（首行 4 张 + 次行 2 张 + 第 7 天宽卡） */}
      <div className="grid grid-cols-4 gap-2.5 pt-1">
        {SEVEN_DAY_REWARDS.map((r, i) => {
          const state: CardState = i === todayIndex ? 'today' : i < claimedThisRound ? 'claimed' : 'future'
          return (
            <SignInCard
              key={r.day}
              reward={r}
              state={state}
              justClaimed={justClaimed === r.day}
              delay={0.05 * i}
            />
          )
        })}
      </div>

      {/* 一轮签满循环提示 */}
      {roundDone && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-[11px] font-bold text-[#B8860B]"
        >
          本轮已签满 7 天，明日开启新一轮
        </motion.p>
      )}

      {/* 签到按钮 */}
      {canClaim ? (
        <motion.button
          type="button"
          onClick={handleClaim}
          whileTap={{ scale: 0.95 }}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F0C75E] via-[#E8B84B] to-[#D4933D] text-base font-black text-[#5C3A1E] shadow-lg shadow-amber-500/40"
        >
          <ConfigIcon icon="/images/ui/gift.png" size={18} />
          签到领取
        </motion.button>
      ) : (
        <div className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4A574]/50 bg-[#EFE6D2]/70 text-sm font-bold text-[#8B7355]">
          {justClaimed !== null ? (
            '今日已签'
          ) : (
            <>
              <ConfigIcon icon="/images/ui/status-moon.png" size={16} />
              明日再来
            </>
          )}
        </div>
      )}

      <p className="text-center text-[10px] text-[#8B7355]/80">奖励每日 0 点刷新 · 七天一轮循环发放</p>

      {/* 签到成功彩带粒子 */}
      {justClaimed !== null && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {confetti.map((c) => (
            <motion.span
              key={c.id}
              className="absolute top-0"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.round ? c.size : c.size * 0.5,
                backgroundColor: c.color,
                borderRadius: c.round ? '50%' : 1,
              }}
              initial={{ y: -14, opacity: 0 }}
              animate={{ y: 460, opacity: [0, 1, 1, 0], rotate: 340 }}
              transition={{ duration: c.dur, delay: c.delay, ease: 'linear' }}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** 单日奖励卡片：Day N + 奖励图标数量 + label，三态 + 第 7 天传说大礼包特殊样式 */
function SignInCard({
  reward,
  state,
  justClaimed,
  delay,
}: {
  reward: SignInReward
  state: CardState
  justClaimed: boolean
  delay: number
}) {
  const isDay7 = reward.day === 7
  const claimed = state === 'claimed'
  const isToday = state === 'today'

  return (
    <motion.div
      className={cn(isDay7 && 'col-span-2')}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
    >
      <motion.div
        animate={
          justClaimed
            ? { scale: [1, 1.32, 1], rotate: [0, -6, 6, 0] }
            : isToday
              ? { scale: [1.05, 1.11, 1.05] }
              : { scale: 1 }
        }
        transition={
          justClaimed
            ? { duration: 0.65, ease: 'easeOut' }
            : isToday
              ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
              : { duration: 0.25 }
        }
        className={cn(
          'relative flex h-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2',
          isDay7
            ? 'border-[#E8B84B] bg-gradient-to-b from-[#FBEDC2] to-[#F1D287] shadow-[0_2px_10px_rgba(232,184,75,0.35)]'
            : 'border-[#D4A574]/60 bg-white/85',
          isToday &&
            (isDay7
              ? 'border-2 shadow-[0_0_16px_rgba(232,184,75,0.75)]'
              : 'border-2 border-[#E8B84B] bg-white shadow-[0_0_14px_rgba(232,184,75,0.55)]'),
          claimed && !justClaimed && 'opacity-55 saturate-50',
          !isToday && !claimed && 'opacity-85'
        )}
      >
        {/* 今日可领角标 */}
        {isToday && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[#F0C75E] to-[#D4933D] px-2 py-px text-[9px] font-black text-white shadow-md">
            今日
          </span>
        )}
        {/* 已领角标 */}
        {claimed && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#8B2E24] text-[10px] font-black text-white shadow">
            ✓
          </span>
        )}

        <span className={cn('text-[10px] font-bold', isDay7 ? 'text-[#8A6210]' : 'text-[#8B7355]')}>
          第 {reward.day} 天
        </span>

        <span
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-black tabular-nums',
            isDay7 ? 'text-[#8A6210]' : 'text-[#5C4033]'
          )}
        >
          {reward.gold !== undefined && (
            <span className="flex items-center gap-0.5">
              <GoldIcon size={13} />×{reward.gold}
            </span>
          )}
          {reward.gems !== undefined && (
            <span className="flex items-center gap-0.5">
              <GemIcon size={13} />×{reward.gems}
            </span>
          )}
          {reward.tickets !== undefined && (
            <span className="flex items-center gap-0.5">
              <TicketIcon size={13} />×{reward.tickets}
            </span>
          )}
        </span>

        <span
          className={cn(
            isDay7 ? 'text-[9px] font-black text-[#B8860B]' : 'text-[9px] text-[#8B7355]'
          )}
        >
          {isDay7 ? '传说大礼包' : reward.label}
        </span>
      </motion.div>
    </motion.div>
  )
}
