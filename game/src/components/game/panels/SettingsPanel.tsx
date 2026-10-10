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
import { SKINS, skinUnlocked } from '@/game/config'
import type { SkinDef } from '@/game/config'
import { sfx } from '@/game/audio'
import { toast } from '@/hooks/use-toast'
import { ConfigIcon } from '@/components/game/shared'
import { cn } from '@/lib/utils'

function notify(title: string, description?: string) {
  const t = toast({ title, description })
  window.setTimeout(() => t.dismiss(), 2200)
}

/** 皮肤解锁判定（渲染用，规则与 config.skinUnlocked 一致，随 stats/tujian 实时更新） */
function skinAvailable(skin: SkinDef, wins: number, bossWins: number, tujianCount: number): boolean {
  if (skin.unlock.type === 'default') return true
  if (skin.unlock.type === 'wins') return wins >= skin.unlock.value
  if (skin.unlock.type === 'bossWins') return bossWins >= skin.unlock.value
  return tujianCount >= skin.unlock.value
}

/** 设置弹窗：音乐音效开关 / 客栈装扮（皮肤） / 统计数据 / 重置存档 */
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
  const skin = useGameStore((s) => s.skin)
  const signIn = useGameStore((s) => s.signIn)
  const toggleSetting = useGameStore((s) => s.toggleSetting)
  const setVolume = useGameStore((s) => s.setVolume)
  const resetGame = useGameStore((s) => s.resetGame)

  const [confirmReset, setConfirmReset] = useState(false)
  const [justWorn, setJustWorn] = useState<string | null>(null)

  const currentSkin = SKINS.find((s) => s.id === skin)

  const handleReset = () => {
    resetGame()
    setConfirmReset(false)
    onOpenChange(false)
    notify('存档已重置', '欢迎回到最初的妖怪客栈～')
  }

  const handlePickSkin = (id: string) => {
    sfx.play('click')
    const target = SKINS.find((s) => s.id === id)
    if (!target) return
    if (!skinUnlocked(useGameStore.getState(), id)) {
      const prog =
        target.unlock.type === 'wins'
          ? ` · 当前守店成功 ${stats.wins} 次`
          : target.unlock.type === 'bossWins'
            ? ` · 当前妖王夜守店成功 ${stats.bossWins} 次`
            : target.unlock.type === 'tujian'
              ? ` · 已收集 ${tujian.length} 只`
              : ''
      notify('该皮肤尚未解锁', `${target.unlockDesc}${prog}`)
      return
    }
    const res = useGameStore.getState().setSkin(id)
    if (res.ok) {
      setJustWorn(id)
      window.setTimeout(() => setJustWorn(null), 600)
      notify(res.message)
    } else {
      notify(res.message)
    }
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

        {/* 客栈装扮（皮肤） */}
        <div className="rounded-2xl border border-[#D4A574]/60 bg-white/70 p-3">
          <div className="mb-2 flex items-center justify-between px-0.5">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#4A3728]">
              <ConfigIcon icon="/images/ui/skin-lantern.png" size={16} />
              客栈装扮
            </p>
            <span className="max-w-[150px] truncate rounded-full bg-[#8B2E24]/10 px-2 py-0.5 text-[10px] font-bold text-[#8B2E24]">
              当前：{currentSkin?.name ?? '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SKINS.map((sk, i) => (
              <SkinCard
                key={sk.id}
                skin={sk}
                index={i}
                wide={sk.unlock.type === 'bossWins'}
                isCurrent={skin === sk.id}
                unlocked={skinAvailable(sk, stats.wins, stats.bossWins, tujian.length)}
                progressText={
                  sk.unlock.type === 'wins'
                    ? `进度 守店 ${stats.wins}/${sk.unlock.value}`
                    : sk.unlock.type === 'bossWins'
                      ? `进度 妖王 ${stats.bossWins}/${sk.unlock.value}`
                      : sk.unlock.type === 'tujian'
                        ? `进度 收集 ${tujian.length}/${sk.unlock.value}`
                        : null
                }
                justWorn={justWorn === sk.id}
                onPick={handlePickSkin}
              />
            ))}
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

/**
 * 皮肤卡片：预览色带（应用 SKINS filter）+ 名称描述 + 穿戴/解锁状态
 * wide=true 为横版满宽卡（血月妖楼：左侧大预览块 + 右侧名称/描述/解锁条件，血色主题）
 */
function SkinCard({
  skin,
  index,
  isCurrent,
  unlocked,
  progressText,
  justWorn,
  wide = false,
  onPick,
}: {
  skin: SkinDef
  index: number
  isCurrent: boolean
  unlocked: boolean
  progressText: string | null
  justWorn: boolean
  wide?: boolean
  onPick: (id: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 280, damping: 22 }}
      className={wide ? 'col-span-2' : undefined}
    >
      <motion.button
        type="button"
        onClick={() => onPick(skin.id)}
        whileTap={{ scale: 0.95 }}
        animate={{ scale: justWorn ? [1, 1.07, 1] : 1 }}
        transition={{ scale: { duration: 0.4 } }}
        aria-label={`客栈皮肤：${skin.name}${isCurrent ? '，穿戴中' : unlocked ? '，点击穿戴' : '，未解锁'}`}
        className={cn(
          'flex w-full rounded-xl border p-2 text-left shadow-sm',
          wide
            ? isCurrent
              ? 'flex-row items-center gap-3 border-red-700 bg-gradient-to-r from-[#5A1010] via-[#7A1616] to-[#3B0A0A] text-white'
              : unlocked
                ? 'flex-row items-center gap-3 border-red-800/40 bg-gradient-to-r from-[#4A0E0E] via-[#5C1212] to-[#2E0808] text-white'
                : 'flex-row items-center gap-3 border-red-900/25 bg-gradient-to-r from-[#332424]/60 via-[#2B1C1C]/60 to-[#241818]/60'
            : isCurrent
              ? 'flex-col gap-1.5 border-[#8B2E24] bg-[#8B2E24] text-white'
              : unlocked
                ? 'flex-col gap-1.5 border-[#8B2E24]/50 bg-white/85 hover:border-[#8B2E24]'
                : 'flex-col gap-1.5 border-stone-300/70 bg-stone-100/80'
        )}
      >
        {/* 皮肤色调预览带（filter 直观展示换肤效果；血月为左侧大预览块） */}
        <div
          className={cn(
            'relative overflow-hidden rounded-lg border',
            wide ? 'h-[72px] w-[72px] shrink-0 border-red-950/50' : 'h-9 border-[#D4A574]/40'
          )}
          style={skin.filter === 'none' ? undefined : { filter: skin.filter }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#C4D6A8] via-[#D9B98A] to-[#4E7545]" />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              wide ? 'drop-shadow-[0_0_6px_rgba(255,180,140,0.55)]' : ''
            )}
          >
            <ConfigIcon icon={wide ? skin.icon : '/images/ui/skin-default.png'} size={wide ? 36 : 18} />
          </span>
        </div>

        {wide ? (
          /* 横版：右侧名称 + 描述 + 解锁/穿戴状态 */
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <p
              className={cn(
                'truncate text-sm font-black',
                isCurrent || unlocked ? 'text-white' : 'text-stone-400'
              )}
            >
              {skin.name}
            </p>
            <p
              className={cn(
                'truncate text-[10px]',
                isCurrent || unlocked ? 'text-red-100/70' : 'text-stone-400'
              )}
            >
              {skin.desc}
            </p>
            {isCurrent ? (
              <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black text-[#8B1A1A]">
                ✓ 穿戴中
              </span>
            ) : unlocked ? (
              <span className="mt-0.5 inline-flex w-fit items-center rounded-full border border-red-300/60 px-2 py-0.5 text-[10px] font-black text-red-50">
                穿 戴
              </span>
            ) : (
              <div className="mt-0.5 flex flex-col gap-px">
                <p className="text-[9px] leading-tight text-stone-400">🔒 {skin.unlockDesc}</p>
                {progressText && (
                  <p className="text-[9px] font-bold leading-tight text-stone-500">{progressText}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 图标 + 名称 + 描述 */}
            <div className="flex items-start gap-1.5">
              <span className={cn('leading-none', !unlocked && 'opacity-50 grayscale')}>
                <ConfigIcon icon={skin.icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-xs font-black',
                    isCurrent ? 'text-white' : unlocked ? 'text-[#4A3728]' : 'text-stone-400'
                  )}
                >
                  {skin.name}
                </p>
                <p className={cn('truncate text-[9px]', isCurrent ? 'text-white/70' : 'text-[#8B7355]')}>
                  {skin.desc}
                </p>
              </div>
            </div>

            {/* 状态行 */}
            {isCurrent ? (
              <span className="inline-flex w-fit items-center rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black text-[#8B2E24]">
                ✓ 穿戴中
              </span>
            ) : unlocked ? (
              <span className="inline-flex w-fit items-center rounded-full border border-[#8B2E24]/60 px-2 py-0.5 text-[10px] font-black text-[#8B2E24]">
                穿 戴
              </span>
            ) : (
              <div className="flex min-h-[24px] flex-col justify-center gap-px">
                <p className="text-[9px] leading-tight text-stone-400">🔒 {skin.unlockDesc}</p>
                {progressText && <p className="text-[9px] font-bold leading-tight text-stone-500">{progressText}</p>}
              </div>
            )}
          </>
        )}
      </motion.button>
    </motion.div>
  )
}
