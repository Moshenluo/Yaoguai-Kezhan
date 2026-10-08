'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ConfigIcon } from '@/components/game/shared'
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
      <DialogContent className="max-w-[340px] gap-0 overflow-hidden rounded-2xl border-2 border-[#5C3A24]/55 bg-transparent p-0 shadow-2xl">
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
      <div className="ui-wood px-4 py-3">
        <DialogHeader className="items-center space-y-1.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FFE9B8]/20 bg-black/30">
            {/* video.png 缺失时用 play.png 作激励视频标识 */}
            <ConfigIcon icon="/images/ui/play.png" size={22} />
          </div>
          <DialogTitle className="font-display text-center text-lg font-bold tracking-wider text-[#FFE9B8]">
            激励视频 · {cfg.title}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-[#E6DCC8]/75">{cfg.desc}</DialogDescription>
        </DialogHeader>
      </div>

      <div className="bg-gradient-to-b from-[#FAF5EA] to-[#E8DFD0] px-4 pb-4 pt-3">
        {/* 模拟广告播放区 */}
        <div className="relative overflow-hidden rounded-xl border border-[#5C3A24]/35 bg-gradient-to-br from-[#2C241C] via-[#1C1915] to-[#3a2018] p-6 text-center">
          <div className="absolute right-2 top-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#E6DCC8]/85">
            广告
          </div>
          <p className="animate-pulse text-sm font-medium tracking-widest text-[#E8B84B]/90">
            妖怪客栈 · 灵感来自《山海经》
          </p>
          <p className="mt-1 text-[11px] text-[#E6DCC8]/70">看广告免费获得游戏福利，支持独立开发者</p>
          {!done && (
            <div className="mt-3">
              <Progress value={progress} className="h-1.5 bg-white/10" />
              <p className="mt-1.5 text-[11px] text-[#E6DCC8]/55">还需观看 {left} 秒…</p>
            </div>
          )}
          {done && <p className="mt-3 text-xs font-bold text-emerald-300">✓ 观看完成</p>}
        </div>

        <Button
          onClick={claim}
          disabled={!done}
          className={cn(
            'mt-3 h-11 w-full rounded-xl text-base font-bold',
            done
              ? 'bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-[#5C3A1E] shadow-lg shadow-amber-700/25 animate-pulse'
              : 'bg-[#E8DFD0] text-[#5C3A24]/40'
          )}
        >
          {done ? '领取奖励' : '广告播放中…'}
        </Button>
        <p className="mt-2 text-center text-[10px] text-[#5C3A24]/50">全程主动观看 · 无强制广告 · 合规变现演示</p>
      </div>
    </>
  )
}
