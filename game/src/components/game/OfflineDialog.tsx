'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AdDialog } from './AdDialog'
import { useGameStore } from '@/game/store'
import { sfx } from '@/game/audio'
import { AnimNumber, GoldIcon, GemIcon } from './shared'
import { toast } from '@/hooks/use-toast'

/** 秒 → 「X小时Y分钟」 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时${m > 0 ? ` ${m} 分钟` : ''}`
  if (m > 0) return `${m} 分钟`
  return `${seconds} 秒`
}

function notify(title: string, description?: string) {
  const t = toast({ title, description })
  window.setTimeout(() => t.dismiss(), 2200)
}

/**
 * 离线收益结算弹窗
 * 由父组件传入 open（建议 open = pendingOffline !== null），数据从 store 读取
 */
export function OfflineDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pending = useGameStore((s) => s.pendingOffline)
  const settleOffline = useGameStore((s) => s.settleOffline)
  const dismissOffline = useGameStore((s) => s.dismissOffline)
  const addGold = useGameStore((s) => s.addGold)
  const addGems = useGameStore((s) => s.addGems)

  const [adOpen, setAdOpen] = useState(false)

  const handleClose = (o: boolean) => {
    if (!o && adOpen) return // 广告播放中禁止误关
    if (!o && useGameStore.getState().pendingOffline) dismissOffline()
    onOpenChange(o)
  }

  const handleClaim = () => {
    sfx.play('claim')
    settleOffline()
    onOpenChange(false)
  }

  const handleDoubleReward = () => {
    const p = useGameStore.getState().pendingOffline
    if (p) {
      sfx.play('claim')
      settleOffline() // 领取基础份
      addGold(p.gold) // 广告双倍：再发一份
      addGems(p.gems)
      notify('双倍领取成功！', `金币 +${(p.gold * 2).toLocaleString()} · 灵石 +${p.gems * 2}`)
    }
    setAdOpen(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open && pending !== null} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={!adOpen}
        className="max-w-[340px] rounded-2xl border-[#D4A574] bg-gradient-to-b from-[#FBF5E8] to-[#F3E7CC] p-5"
      >
        <DialogHeader className="items-center space-y-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2D5A3D]/10 text-2xl">🌙</div>
          <DialogTitle className="text-lg font-bold text-[#4A3728]">掌柜的回来啦！</DialogTitle>
          <DialogDescription className="text-sm text-[#8B7355]">
            离线 {pending ? formatDuration(pending.seconds) : '—'}，妖怪们替你看店：
          </DialogDescription>
        </DialogHeader>

        {pending && (
          <div className="rounded-2xl border border-[#D4A574]/70 bg-white/70 p-4 text-center shadow-inner">
            <div className="flex items-center justify-center gap-2">
              <GoldIcon size={22} />
              <AnimNumber value={pending.gold} className="text-3xl font-black text-[#B8860B]" />
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#0F766E]">
              <GemIcon size={15} />
              <span>+{pending.gems} 灵石</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3.5 pt-1">
          <button
            type="button"
            onClick={() => setAdOpen(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-sm font-bold text-white shadow-md shadow-amber-600/25 transition active:scale-95"
          >
            🎬 看广告 · 双倍领取
          </button>
          <button
            type="button"
            onClick={handleClaim}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#2D5A3D]/45 bg-[#F5F0E8] text-sm font-bold text-[#2D5A3D] transition hover:border-[#2D5A3D]/70 hover:bg-[#EFE6D2] active:scale-95"
          >
            不看了，直接领取
          </button>
        </div>
        <p className="text-center text-[10px] text-[#8B7355]/80">离线收益按 60% 效率结算，最长累计 8 小时</p>
      </DialogContent>

      {/* 广告播放期间禁止主弹窗误关 */}
      <AdDialog scene="idle-speed" open={adOpen} onOpenChange={setAdOpen} onReward={handleDoubleReward} />
    </Dialog>
  )
}
