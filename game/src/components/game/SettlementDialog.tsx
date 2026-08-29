'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { AdDialog } from '@/components/game/AdDialog'
import { GemIcon, GoldIcon, TicketIcon, YaoAvatar } from '@/components/game/shared'
import { MATERIALS_MAP, WAVES } from '@/game/config'
import { sfx } from '@/game/audio'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import type { BattleResult } from '@/game/types'

export interface SettlementDialogProps {
  open: boolean
  result: BattleResult | null
  /** 看广告双倍（外层处理翻倍后再发奖） */
  onDouble: () => void
  /** 返回客栈 */
  onReturn: () => void
  /** 下一关（胜利）/ 重新挑战（失败） */
  onNext: () => void
}

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
 * 夜战结算弹窗 —— 胜负结算 / 广告双倍 / 再战
 */
export function SettlementDialog({ open, result, onDouble, onReturn, onNext }: SettlementDialogProps) {
  const [doubled, setDoubled] = useState(false)
  const [adOpen, setAdOpen] = useState(false)
  const rewardedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      setDoubled(false)
      rewardedRef.current = false
    } else if (result) {
      // 开榜即奏胜/败音效
      sfx.play(result.victory ? 'victory' : 'failed')
    }
  }, [open, result])

  const confetti = useMemo<ConfettiPiece[]>(() => {
    if (!result?.victory) return []
    // 妖王夜胜利：红金妖气色系 / 普通胜利：金棕喜庆色系
    const colors = result.bossNight
      ? ['#E86A4A', '#E8B84B', '#C93A3A', '#FFD9B0', '#D4A574']
      : ['#E8B84B', '#D4A574', '#F5F0E8', '#E8C97A', '#C98A3D']
    return Array.from({ length: 26 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      dur: 2.2 + Math.random() * 1.8,
      size: 5 + Math.random() * 5,
      color: colors[i % colors.length],
      round: Math.random() > 0.5,
    }))
  }, [result])

  if (!result) return null

  const mult = doubled ? 2 : 1
  const gold = result.gold * mult
  const gems = result.gems * mult
  const tickets = result.tickets * mult
  const victory = result.victory
  const bossNight = !!result.bossNight
  // 参战妖怪经验列表（id → 获得经验；空则不展示该区）
  const expList = Object.entries(result.expGained ?? {}).filter(([id]) => !!YAOGUAI_MAP[id])
  // 战利素材列表（id → 获得数量；空则不展示该区）
  const matList = Object.entries(result.materialsGained ?? {}).filter(
    ([id, n]) => !!MATERIALS_MAP[id] && n > 0
  )

  const handleAdReward = () => {
    if (rewardedRef.current) return
    rewardedRef.current = true
    setDoubled(true)
    onDouble()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={() => undefined}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[92vh] max-w-[440px] gap-0 overflow-y-auto rounded-3xl border-2 border-[#D4A574] bg-gradient-to-b from-[#FAF5EA] to-[#F2E9D5] p-0"
        >
          {/* 加深遮罩 */}
          <div className="pointer-events-none fixed inset-0 -z-10 bg-black/40" />

          <DialogTitle className="sr-only">夜战结算</DialogTitle>
          <DialogDescription className="sr-only">夜间守店战斗结算</DialogDescription>

          {/* 胜利彩带（金色纸屑） */}
          {victory && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
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
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 480, opacity: [0, 1, 1, 0], rotate: 360 }}
                  transition={{
                    duration: c.dur,
                    delay: c.delay,
                    repeat: Infinity,
                    repeatDelay: 0.6,
                    ease: 'linear',
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative flex flex-col items-center gap-3 px-5 pb-5 pt-7 text-center">
            {victory ? (
              <>
                <motion.div
                  initial={{ scale: 0, rotate: -24 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                  className="text-5xl"
                >
                  {bossNight ? '👹' : '🏆'}
                </motion.div>
                <motion.h2
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className={
                    bossNight
                      ? 'text-2xl font-black tracking-[0.15em] text-[#A83A2A] drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]'
                      : 'text-2xl font-black tracking-[0.15em] text-[#C9922A] drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]'
                  }
                >
                  {bossNight ? '👹 妖王退散 👹' : '✨ 守店成功 ✨'}
                </motion.h2>
                <p className="text-xs text-stone-500">
                  {bossNight
                    ? `传说妖王臣服，妖王亲卫尽退，客栈声威大振（奖励已翻倍发放）`
                    : `五波妖众尽退，第 ${result.waveReached} 波收官，客栈安然无恙`}
                </p>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                  className="text-5xl"
                >
                  {bossNight ? '👹' : '💔'}
                </motion.div>
                <motion.h2
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  className={
                    bossNight
                      ? 'text-2xl font-black tracking-[0.15em] text-[#7A2E2E]'
                      : 'text-2xl font-black tracking-[0.15em] text-rose-700'
                  }
                >
                  {bossNight ? '妖王太过强大' : '客栈被攻破'}
                </motion.h2>
                <p className="text-sm text-stone-600">
                  坚持到第 <b className="text-rose-600">{result.waveReached}</b> 波 / 共 {WAVES.length} 波
                </p>
              </>
            )}

            {/* 奖励清单 */}
            <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-[#E8B84B]/60 bg-white/85 p-4">
              {!victory && <p className="text-[10px] font-black tracking-widest text-stone-400">安慰奖励</p>}
              <motion.div
                key={gold}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 16 }}
                className="flex items-center gap-2 text-3xl font-black tabular-nums text-[#C9922A]"
              >
                <GoldIcon size={26} /> +{gold}
              </motion.div>
              {(gems > 0 || tickets > 0) && (
                <div className="flex items-center gap-4 text-sm font-black text-stone-700">
                  {gems > 0 && (
                    <span className="flex items-center gap-1">
                      <GemIcon size={15} /> 灵石 +{gems}
                    </span>
                  )}
                  {tickets > 0 && (
                    <span className="flex items-center gap-1">
                      <TicketIcon size={15} /> 招募券 +{tickets}
                    </span>
                  )}
                </div>
              )}
              {victory && result.captured.length > 0 && (
                <div className="w-full border-t border-dashed border-[#D4A574]/70 pt-2">
                  <p className="mb-1.5 text-xs font-black text-stone-600">
                    {bossNight ? '👑 收服妖王与亲卫 ×' : '🕸️ 收服妖怪 ×'}{result.captured.length}
                  </p>
                  <div className="flex flex-wrap items-start justify-center gap-2.5">
                    {result.captured.map((id, i) => (
                      <motion.div
                        key={`${id}-${i}`}
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.3 + i * 0.12, type: 'spring', stiffness: 300, damping: 16 }}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <YaoAvatar id={id} size={40} />
                        <span className="text-[9px] font-bold text-stone-500">
                          {YAOGUAI_MAP[id]?.name ?? id}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {/* 参战妖怪经验（胜负均结算；满级未入列则不展示） */}
              {expList.length > 0 && (
                <div className="w-full border-t border-dashed border-[#D4A574]/70 pt-2">
                  <p className="mb-1.5 text-xs font-black text-stone-600">⬆️ 参战妖怪经验</p>
                  <div className="flex flex-wrap items-start justify-center gap-2.5">
                    {expList.map(([id, exp], i) => (
                      <motion.div
                        key={id}
                        initial={{ scale: 0, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 300, damping: 16 }}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <YaoAvatar id={id} size={36} />
                        <span className="text-[9px] font-bold text-stone-500">
                          {YAOGUAI_MAP[id]?.name ?? id}
                        </span>
                        <span className="text-[9px] font-black tabular-nums text-emerald-600">
                          +{exp} 经验
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {/* 战利素材（击杀/收服/通关掉落入仓库） */}
              {matList.length > 0 && (
                <div className="w-full border-t border-dashed border-[#D4A574]/70 pt-2">
                  <p className="mb-1.5 text-xs font-black text-stone-600">📦 战利素材</p>
                  <div className="flex flex-wrap items-start justify-center gap-2.5">
                    {matList.map(([id, n], i) => (
                      <motion.div
                        key={id}
                        initial={{ scale: 0, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 300, damping: 16 }}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <span className="text-2xl" aria-hidden>
                          {MATERIALS_MAP[id]?.icon ?? '📦'}
                        </span>
                        <span className="text-[9px] font-bold text-stone-500">
                          {MATERIALS_MAP[id]?.name ?? id}
                        </span>
                        <span className="text-[9px] font-black tabular-nums text-[#B8860B]">×{n}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!victory && (
              <p className="text-xs text-stone-500">
                {bossNight ? '妖王夜不设惩罚，重整旗鼓随时再战！' : '小妖们已尽力，客栈无损，明夜再战！'}
              </p>
            )}

            {/* 看广告双倍 */}
            {!doubled ? (
              <motion.button
                type="button"
                onClick={() => setAdOpen(true)}
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F0C75E] via-[#E8B84B] to-[#D4933D] text-base font-black text-[#5C3A1E] shadow-lg shadow-amber-500/40 transition-transform active:scale-95"
              >
                📺 看广告双倍领取
              </motion.button>
            ) : (
              <div className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-[#E8B84B] bg-amber-50 text-sm font-black text-[#B8860B]">
                已双倍 ✓
              </div>
            )}

            {/* 底部操作 */}
            <div className="flex w-full gap-2.5">
              <button
                type="button"
                onClick={onReturn}
                className="h-12 flex-1 rounded-2xl border-2 border-[#2D5A3D]/40 bg-white/80 text-sm font-black text-[#2D5A3D] transition-transform active:scale-95"
              >
                返回客栈
              </button>
              <button
                type="button"
                onClick={onNext}
                className="h-12 flex-1 rounded-2xl bg-[#2D5A3D] text-sm font-black text-[#F5F0E8] shadow-md transition-transform active:scale-95"
              >
                {bossNight && victory ? '返回客栈 ✓' : victory ? '下一关 ➜' : '重新挑战'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 双倍奖励广告 */}
      <AdDialog
        scene="reward-double"
        open={adOpen}
        onOpenChange={setAdOpen}
        onReward={handleAdReward}
      />
    </>
  )
}
