'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Video, Volume2 } from 'lucide-react'
import { AD_SCENES } from '@/game/config'
import type { AdScene } from '@/game/config'
import { useGameStore } from '@/game/store'
import { trackEvent } from '@/game/cloud'
import { cn } from '@/lib/utils'

/**
 * 模拟激励视频广告弹窗（IAA 变现演示）
 * 倒计时结束后可领取奖励 onReward（内部已统计 watchAd）
 */
export function AdDialog({
  scene,
  open,
  onOpenChange,
  onReward,
}: {
  scene: AdScene
  open: boolean
  onOpenChange: (open: boolean) => void
  onReward: () => void
}) {
  const cfg = AD_SCENES[scene]
  const watchAd = useGameStore((s) => s.watchAd)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] rounded-2xl border-amber-200 bg-gradient-to-b from-stone-50 to-amber-50/80 p-5 dark:from-stone-900 dark:to-stone-900">
        <AdPlayer key={`${scene}-${open}`} scene={scene} cfg={cfg} watchAd={watchAd} onDone={() => onOpenChange(false)} onReward={onReward} />
      </DialogContent>
    </Dialog>
  )
}

function AdPlayer({
  scene,
  cfg,
  watchAd,
  onDone,
  onReward,
}: {
  scene: AdScene
  cfg: { title: string; desc: string; duration: number }
  watchAd: () => void
  onDone: () => void
  onReward: () => void
}) {
  const [left, setLeft] = useState(cfg.duration)
  const [done, setDone] = useState(false)
  const [rewarded, setRewarded] = useState(false)

  useEffect(() => {
    if (done) return
    const t = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          setDone(true)
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [done])

  const claim = useCallback(() => {
    if (!done || rewarded) return
    watchAd()
    trackEvent('ad_view', { scene }) // 运营埋点：一次完整观看领奖记一次
    setRewarded(true)
    onReward()
    onDone()
  }, [done, rewarded, watchAd, onReward, onDone, scene])

  const progress = useMemo(() => ((cfg.duration - left) / cfg.duration) * 100, [cfg.duration, left])

  return (
    <>
      <DialogHeader className="items-center space-y-1.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <Video className="h-6 w-6 text-amber-600" />
        </div>
        <DialogTitle className="text-center text-lg font-bold text-stone-800 dark:text-stone-100">
          激励视频 · {cfg.title}
        </DialogTitle>
        <DialogDescription className="text-center text-sm text-stone-500 dark:text-stone-400">{cfg.desc}</DialogDescription>
      </DialogHeader>

      {/* 模拟广告播放区 */}
      <div className="relative mt-2 overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-br from-emerald-900 via-stone-800 to-stone-900 p-6 text-center dark:border-stone-700">
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/80">
          <Volume2 className="h-3 w-3" /> 广告
        </div>
        <p className="animate-pulse text-sm font-medium tracking-widest text-amber-200/90">妖怪客栈 · 灵感来自《山海经》</p>
        <p className="mt-1 text-[11px] text-stone-300">看广告免费获得游戏福利，支持独立开发者 🎁</p>
        {!done && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5 bg-white/10" />
            <p className="mt-1.5 text-[11px] text-white/60">还需观看 {left} 秒…</p>
          </div>
        )}
        {done && <p className="mt-3 text-xs font-bold text-emerald-300">✓ 观看完成</p>}
      </div>

      <Button
        onClick={claim}
        disabled={!done}
        className={cn(
          'h-11 w-full rounded-xl text-base font-bold',
          done
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30 animate-pulse'
            : 'bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-600'
        )}
      >
        {done ? '领取奖励' : '广告播放中…'}
      </Button>
      <p className="text-center text-[10px] text-stone-400">全程主动观看 · 无强制广告 · 合规变现演示</p>
    </>
  )
}
