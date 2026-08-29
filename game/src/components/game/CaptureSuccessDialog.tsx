'use client'

import { memo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import { Button } from '@/components/ui/button'
import { GradeTag, YaoAvatar } from './shared'

// ============ 夜晚塔防 · 收服成功弹窗 ============
// 全屏金光庆祝：星光粒子 + 大头像 + 出处/技能一句话；3 秒倒计时自动关闭继续战斗。

export interface CaptureSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  yaoguaiId: string
}

const AUTO_CLOSE_SECONDS = 3

/** 星光粒子布点（相对卡片） */
const SPARKLES: Array<{ left: string; top: string; char: string }> = [
  { left: '10%', top: '18%', char: '✨' },
  { left: '84%', top: '12%', char: '✦' },
  { left: '18%', top: '66%', char: '✦' },
  { left: '86%', top: '58%', char: '✨' },
  { left: '50%', top: '4%', char: '✨' },
]

const DIALOG_CSS = `
@keyframes yg-gold-pulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
.yg-gold-glow {
  background: radial-gradient(circle at 50% 42%, rgba(232,184,75,0.4) 0%, rgba(232,184,75,0.14) 34%, rgba(232,184,75,0.03) 62%, transparent 75%);
  animation: yg-gold-pulse 1.5s ease-in-out infinite;
}
@keyframes yg-aura-kf { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }
.yg-aura {
  box-shadow: 0 0 34px rgba(232,184,75,0.8), 0 0 90px rgba(232,184,75,0.35);
  animation: yg-aura-kf 2s ease-in-out infinite;
}
@keyframes yg-sparkle-kf { 0% { transform: translateY(0) scale(0.6); opacity: 0 } 25% { opacity: 1 } 100% { transform: translateY(-48px) scale(1.15); opacity: 0 } }
.yg-sparkle { animation: yg-sparkle-kf 1.9s ease-out infinite; }
`

function CaptureSuccessDialogImpl({ open, onOpenChange, yaoguaiId }: CaptureSuccessDialogProps) {
  const [left, setLeft] = useState(AUTO_CLOSE_SECONDS)

  // 倒计时自动关闭。父组件以 yaoguaiId 为 key 渲染，每次打开都是全新挂载，
  // 因此初始值即满额倒计时，无需在 effect 中同步重置。
  useEffect(() => {
    if (!open) return
    let remain = AUTO_CLOSE_SECONDS
    const timer = setInterval(() => {
      remain -= 1
      if (remain <= 0) {
        clearInterval(timer)
        setLeft(0)
        onOpenChange(false)
      } else {
        setLeft(remain)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [open, onOpenChange])

  if (!open) return null
  const def = YAOGUAI_MAP[yaoguaiId]
  if (!def) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <style>{DIALOG_CSS}</style>

      {/* 全屏金光背景 */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="yg-gold-glow absolute inset-0" />

      <motion.div
        initial={{ scale: 0.55, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 20 }}
        className="relative w-full max-w-[320px] overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-b from-[#241d40] to-[#171233] p-6 text-center shadow-[0_0_60px_rgba(232,184,75,0.25)]"
      >
        {/* 星光粒子 */}
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="yg-sparkle pointer-events-none absolute text-base text-amber-200"
            style={{ left: s.left, top: s.top, animationDelay: `${i * 0.3}s` }}
          >
            {s.char}
          </span>
        ))}

        <p className="text-xs font-medium tracking-[0.4em] text-amber-200/70">妖 · 捕获时刻</p>

        {/* 大头像金圈 */}
        <div className="yg-aura relative mx-auto mt-4 w-fit rounded-full">
          <YaoAvatar id={yaoguaiId} size={96} />
        </div>

        <h2 className="mt-4 text-xl font-black text-amber-100 drop-shadow-[0_0_12px_rgba(232,184,75,0.35)]">
          恭喜收服！{def.name}
        </h2>
        <div className="mt-2 flex justify-center">
          <GradeTag grade={def.grade} />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-stone-300">
          {def.origin} · {def.form}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-stone-400">
          技能「<span className="text-cyan-300">{def.skillName}</span>」：{def.skillDesc}
        </p>

        <Button
          onClick={() => onOpenChange(false)}
          className="mt-5 h-11 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-base font-bold text-white shadow-lg shadow-amber-500/30 active:scale-95"
        >
          继续战斗（{left}）
        </Button>
      </motion.div>
    </div>
  )
}

/** memo：夜战每帧重渲染下，弹窗内容仅在 open / 目标变化时重绘 */
export const CaptureSuccessDialog = memo(CaptureSuccessDialogImpl)
