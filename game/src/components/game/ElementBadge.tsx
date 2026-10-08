'use client'

import { motion } from 'framer-motion'
import { ELEMENTS, counteredBy, countersOf } from '@/game/config'
import type { Element } from '@/game/types'
import { cn } from '@/lib/utils'
import { ConfigIcon } from '@/components/game/shared'

// ============ 妖怪属性徽章（五行 + 光暗） ============
// 纯展示组件：ElementBadge 圆形小徽章（卡片/头像角标）；
// ElementChip 横条（icon + 属性名 + 克制关系），用于详情区属性行。

type BadgeSize = 'xs' | 'sm' | 'md'

const BADGE_SIZE: Record<BadgeSize, string> = {
  xs: 'h-3.5 w-3.5 text-[8px]',
  sm: 'h-[18px] w-[18px] text-[10px]',
  md: 'h-6 w-6 text-xs',
}

/** 属性完整提示文案：如「火 · 克金 · 被水克」 */
function elementTitle(e: Element): string {
  const el = ELEMENTS[e]
  return `${el.name}属性 · 克${ELEMENTS[countersOf(e)].name} · 被${ELEMENTS[counteredBy(e)].name}克（${el.desc}）`
}

export interface ElementBadgeProps {
  element: Element | null
  size?: BadgeSize
  /** 无属性时不渲染（默认渲染灰色「无」徽章） */
  hideNone?: boolean
  className?: string
}

/**
 * 圆形属性小徽章：背景 ELEMENTS.bg / 文字与边框 ELEMENTS.color，单字属性名。
 * size: xs≈14px / sm≈18px / md≈24px。
 */
export function ElementBadge({ element, size = 'sm', hideNone = false, className }: ElementBadgeProps) {
  const sizeCls = BADGE_SIZE[size]

  if (!element) {
    if (hideNone) return null
    return (
      <span
        title="无属性（不受五行克制影响）"
        aria-label="无属性"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-stone-300 bg-stone-100 font-bold leading-none text-stone-400',
          sizeCls,
          className
        )}
      >
        无
      </span>
    )
  }

  const el = ELEMENTS[element]
  return (
    <span
      title={elementTitle(element)}
      aria-label={`${el.name}属性`}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-black leading-none',
        sizeCls,
        className
      )}
      style={{ background: el.bg, borderColor: el.color, color: el.color }}
    >
      {el.name}
    </span>
  )
}

export interface ElementChipProps {
  element: Element | null
  /** 弱化展示（置灰） */
  dim?: boolean
  className?: string
}

/**
 * 横条属性说明：icon + 属性名 + 克什么 + 被什么克（如「🔥 火 · 克金 · 被水克」）。
 * 无属性渲染灰色「无属性」。
 */
export function ElementChip({ element, dim = false, className }: ElementChipProps) {
  if (!element) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-[11px] font-bold leading-tight text-stone-400',
          dim && 'opacity-50',
          className
        )}
      >
        无属性
      </span>
    )
  }

  const el = ELEMENTS[element]
  const counterName = ELEMENTS[countersOf(element)].name
  const counteredName = ELEMENTS[counteredBy(element)].name
  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      title={elementTitle(element)}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-tight',
        dim && 'opacity-50 grayscale',
        className
      )}
      style={{ background: el.bg, borderColor: `${el.color}88`, color: el.color }}
    >
      <ConfigIcon icon={el.icon} size={14} />
      <span>{el.name}</span>
      <span className="opacity-70">·</span>
      <span>克{counterName}</span>
      <span className="opacity-70">·</span>
      <span>被{counteredName}克</span>
    </motion.span>
  )
}
