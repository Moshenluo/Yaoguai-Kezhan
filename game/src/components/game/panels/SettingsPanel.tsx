'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useGameStore } from '@/game/store'
import { toast } from '@/hooks/use-toast'
import { ConfigIcon } from '@/components/game/shared'
import { cn } from '@/lib/utils'

function notify(title: string, description?: string) {
  const t = toast({ title, description })
  window.setTimeout(() => t.dismiss(), 2200)
}

/** 设置弹窗：音乐音效开关 / 统计数据 / 重置存档 */
export function SettingsPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const settings = useGameStore((s) => s.settings)
  const stats = useGameStore((s) => s.stats)
  const tujian = useGameStore((s) => s.tujian)
  const signIn = useGameStore((s) => s.signIn)
  const toggleSetting = useGameStore((s) => s.toggleSetting)
  const setVolume = useGameStore((s) => s.setVolume)
  const resetGame = useGameStore((s) => s.resetGame)

  const [confirmReset, setConfirmReset] = useState(false)

  const handleReset = () => {
    resetGame()
    setConfirmReset(false)
    onOpenChange(false)
    notify('存档已重置', '欢迎回到最初的妖怪客栈～')
  }

  const statCells: { label: string; value: string; accent?: boolean }[] = [
    { label: '累计金币', value: Math.floor(stats.totalGold).toLocaleString(), accent: true },
    { label: '收服妖怪', value: `${stats.totalCaptures}`, accent: true },
    { label: '图鉴收集', value: `${tujian.length}/13` },
    { label: '守店胜场', value: `${stats.wins}` },
    { label: '妖王退散', value: `${stats.bossWins}` },
    { label: '守店败场', value: `${stats.fails}` },
    { label: '累计签到', value: `${signIn.totalDays} 天` },
    { label: '观看广告', value: `${stats.adViews}` },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[360px] overflow-y-auto rounded-2xl border-2 ui-paper p-5">
        <DialogHeader className="items-center space-y-1">
          <motion.div
            initial={{ rotate: -120, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8B2E24]/10"
          >
            <ConfigIcon icon="/images/ui/settings.png" size={22} />
          </motion.div>
          <DialogTitle className="text-lg font-bold tracking-[0.2em] text-[#4A3728]">设置</DialogTitle>
          <DialogDescription className="text-xs text-[#8B7355]">调整游戏选项与查看经营数据</DialogDescription>
        </DialogHeader>

        {/* 音效开关 + 音量滑杆 */}
        <div className="divide-y divide-[#E4D4B4] overflow-hidden rounded-2xl border border-[#D4A574]/60 bg-white/70">
          <div className="flex h-12 items-center justify-between px-4">
            <span className="flex items-center gap-2 text-sm font-medium text-[#4A3728]">
              <span>背景音乐</span>
            </span>
            <Switch
              checked={settings.music}
              onCheckedChange={() => toggleSetting('music')}
              className="data-[state=checked]:bg-[#8B2E24]"
              aria-label="背景音乐"
            />
          </div>
          {/* 音乐音量（关词时置灰禁用） */}
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 transition-opacity',
              !settings.music && 'pointer-events-none opacity-40'
            )}
          >
            <span className="w-[52px] shrink-0 text-right text-xs text-[#8B7355]">
              {settings.bgmVolume <= 0 ? '🔇' : '🔈'}
            </span>
            <Slider
              value={[settings.bgmVolume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => setVolume('bgm', v[0] ?? 0.8)}
              aria-label="音乐音量"
              className="flex-1"
            />
            <span className="w-[34px] shrink-0 text-right text-[11px] font-bold tabular-nums text-[#4A3728]">
              {Math.round(settings.bgmVolume * 100)}%
            </span>
          </div>
          <div className="flex h-12 items-center justify-between px-4">
            <span className="flex items-center gap-2 text-sm font-medium text-[#4A3728]">
              🔊 <span>游戏音效</span>
            </span>
            <Switch
              checked={settings.sound}
              onCheckedChange={() => toggleSetting('sound')}
              className="data-[state=checked]:bg-[#8B2E24]"
              aria-label="游戏音效"
            />
          </div>
          {/* 音效音量（关词时置灰禁用） */}
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 transition-opacity',
              !settings.sound && 'pointer-events-none opacity-40'
            )}
          >
            <span className="w-[52px] shrink-0 text-right text-xs text-[#8B7355]">
              {settings.sfxVolume <= 0 ? '🔇' : '🔉'}
            </span>
            <Slider
              value={[settings.sfxVolume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => setVolume('sfx', v[0] ?? 0.8)}
              aria-label="音效音量"
              className="flex-1"
            />
            <span className="w-[34px] shrink-0 text-right text-[11px] font-bold tabular-nums text-[#4A3728]">
              {Math.round(settings.sfxVolume * 100)}%
            </span>
          </div>
        </div>

        {/* 统计数据（逐格入场） */}
        <div className="grid grid-cols-3 gap-2">
          {statCells.map((cell, i) => (
            <motion.div
              key={cell.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 + i * 0.04, duration: 0.25, ease: 'easeOut' }}
              className="rounded-xl border border-[#D4A574]/50 bg-white/60 px-1 py-2 text-center"
            >
              <p
                className={
                  cell.accent
                    ? 'truncate text-sm font-black text-[#B8860B]'
                    : 'truncate text-sm font-black text-[#5C4033]'
                }
              >
                {cell.value}
              </p>
              <p className="mt-0.5 text-[10px] text-[#8B7355]">{cell.label}</p>
            </motion.div>
          ))}
        </div>

        {/* 重置存档 */}
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-300/70 bg-rose-50 text-sm font-bold text-rose-600 shadow-sm transition active:scale-95"
        >
          🗑️ 重置存档
        </button>

        <p className="text-center text-[10px] tracking-wide text-[#8B7355]">
          妖怪客栈 v1.0 · 山海经企划
        </p>
      </DialogContent>

      {/* 二次确认 */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl border-2 ui-paper p-5">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="text-base font-bold text-[#4A3728]">重置存档？</AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed text-[#8B7355]">
              将清空全部进度（金币、妖怪、设施、图鉴与战绩），此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-center">
            <AlertDialogCancel className="h-10 rounded-xl border-[#D4A574] bg-white/80 px-5 text-[#5C4033] hover:bg-white active:scale-95">
              再想想
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="h-10 rounded-xl bg-rose-600 px-5 font-bold text-white hover:bg-rose-700 active:scale-95"
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
