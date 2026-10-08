'use client'

import { motion } from 'framer-motion'
import { staminaTier } from '@/game/config'
import type { StaminaTierDef } from '@/game/config'
import { ConfigIcon } from '@/components/game/shared'
import { cn } from '@/lib/utils'

// ============ 妖怪体力徽章（五档：充沛/正常/疲惫/力竭/虚脱） ============
// 纯展示组件：StaminaBar 体力条（纯 DOM 无动画，性能敏感场景可用）；
// StaminaTierChip 横条（icon + 档位名 + 数值 + 效果说明），用于详情区体力状态行。

type BarSize = 'xs' | 'sm' | 'md'

const BAR_HEIGHT: Record<BarSize, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
}

/** 体力值净化（异常值回退 100，避免 NaN 样式） */
function safeStamina(v: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 100))
}

export interface StaminaBarProps {
  /** 当前体力 0-100 */
  value: number
  size?: BarSize
  /** 右侧显示 ⚡数值 */
  showText?: boolean
  className?: string
}

/**
 * 体力条：填充色/底色取档位定义色（充沛绿/正常青绿/疲惫琥珀/力竭红/虚脱灰紫）。
 * 纯 DOM 无动画（BattleField 等每帧重渲染场景安全）。
 * size: xs=h-1 / sm=h-1.5 / md=h-2.5；showText 时右侧显示 ⚡{数值}。
 */
export function StaminaBar({ value, size = 'sm', showText = false, className }: StaminaBarProps) {
  const v = safeStamina(value)
  const tier = staminaTier(v)
  const pct = Math.max(0, Math.min(100, v))

  if (showText) {
    return (
      <div className={cn('flex w-full items-center gap-1', className)}>
        <div
          role="progressbar"
          aria-label={`体力 ${Math.round(v)}（${tier.name}）`}
          aria-valuenow={Math.round(v)}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn('w-full min-w-0 flex-1 overflow-hidden rounded-full', BAR_HEIGHT[size])}
          style={{ background: 'rgba(120,113,108,0.18)' }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: tier.color }}
          />
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-black tabular-nums leading-none"
          style={{ color: tier.color }}
        >
          <ConfigIcon icon={tier.icon} size={10} />
          {Math.round(v)}
        </span>
      </div>
    )
  }

  return (
    <div
      role="progressbar"
      aria-label={`体力 ${Math.round(v)}（${tier.name}）`}
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('w-full overflow-hidden rounded-full', BAR_HEIGHT[size], className)}
      style={{ background: 'rgba(120,113,108,0.18)' }}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tier.color }} />
    </div>
  )
}

export interface StaminaTierChipProps {
  /** 当前体力 0-100 */
  value: number
  /** 紧凑模式：只显示 icon + 数值（卡池/角标用） */
  compact?: boolean
  className?: string
}

/** 档位标题提示文案：如「疲惫 · 30/100 · 打工效率 60% · 战斗攻速 -10%」 */
function tierTitle(tier: StaminaTierDef, v: number): string {
  return `${tier.name} · 体力 ${Math.round(v)}/100 · ${tier.desc}`
}

/**
 * 体力档位横条：icon + 档位名 + 数值（+ 效果 desc），颜色全部取档位定义色。
 * compact 时只显示 icon + 数值（小角标场景）。
 */
export function StaminaTierChip({ value, compact = false, className }: StaminaTierChipProps) {
  const v = safeStamina(value)
  const tier = staminaTier(v)
  const num = Math.round(v)

  if (compact) {
    return (
      <span
        title={tierTitle(tier, v)}
        aria-label={`体力 ${num}（${tier.name}）`}
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1 py-px text-[9px] font-black tabular-nums leading-tight',
          className
        )}
        style={{ background: tier.bg, borderColor: `${tier.color}99`, color: tier.color }}
      >
        <ConfigIcon icon={tier.icon} size={11} />
        <span>{num}</span>
      </span>
    )
  }

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      title={tierTitle(tier, v)}
      aria-label={`体力 ${num}（${tier.name}）`}
      className={cn(
        'inline-flex flex-col items-center gap-0.5 rounded-2xl border px-3 py-1.5 leading-tight',
        className
      )}
      style={{ background: tier.bg, borderColor: `${tier.color}66`, color: tier.color }}
    >
      <span className="flex items-center gap-1 text-[11px] font-black tabular-nums">
        <ConfigIcon icon={tier.icon} size={14} />
        <span>{tier.name}</span>
        <span className="opacity-60">·</span>
        <span>{num}/100</span>
      </span>
      <span className="text-[9px] font-medium opacity-85">{tier.desc}</span>
    </motion.span>
  )
}
