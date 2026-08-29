'use client'

import { useEffect, useRef, useState } from 'react'
import { GRADE_COLOR, GRADE_LABEL, YAOGUAI_MAP, yaoImg } from '@/game/yaoguai'
import type { Grade } from '@/game/types'
import { cn } from '@/lib/utils'

/** 星级显示（高星微光） */
export function StarBadge({ star, size = 'sm' }: { star: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-[10px]'
  if (star >= 5) {
    return (
      <span className={cn(cls, 'inline-flex items-center gap-px animate-pulse')} aria-label={`${star}星`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="drop-shadow-[0_0_4px_rgba(232,184,75,0.9)]">
            ⭐
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className={cn(cls, 'inline-flex items-center gap-px')} aria-label={`${star}星`}>
      {Array.from({ length: star }).map((_, i) => (
        <span key={i}>⭐</span>
      ))}
    </span>
  )
}

/** 品级标签 */
export function GradeTag({ grade, className }: { grade: Grade; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
        GRADE_COLOR[grade],
        className
      )}
    >
      {GRADE_LABEL[grade]}
    </span>
  )
}

/** 妖怪头像（img 加载失败降级为首字圆形） */
export function YaoAvatar({
  id,
  size = 48,
  active = true,
  className,
}: {
  id: string
  size?: number
  active?: boolean
  className?: string
}) {
  const def = YAOGUAI_MAP[id]
  const [failed, setFailed] = useState(false)
  const border =
    def?.grade === 'rare'
      ? 'border-amber-400 shadow-[0_0_10px_rgba(232,184,75,0.45)]'
      : def?.grade === 'legend'
        ? 'border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
        : 'border-emerald-300'
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full border-2 bg-gradient-to-b from-stone-50 to-stone-200 dark:from-stone-800 dark:to-stone-900',
        border,
        !active && 'grayscale opacity-50',
        className
      )}
      style={{ width: size, height: size }}
    >
      {!failed && def ? (
         
        <img
          src={yaoImg(id)}
          alt={def.name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ background: def?.color ?? '#8B7355', fontSize: size * 0.36 }}
        >
          {def?.name?.[0] ?? '?'}
        </div>
      )}
    </div>
  )
}

/** 数字滚动动画（rAF + DOM 直写，避免重渲染级联） */
export function AnimNumber({ value, className }: { value: number; className?: string }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const cur = useRef(value)
  useEffect(() => {
    const from = cur.current
    const to = value
    if (from === to) return
    const start = performance.now()
    const dur = 300
    let raf = 0
    let unflashTimer = 0
    const step = (t: number) => {
      const p = Math.min((t - start) / dur, 1)
      const v = Math.round(from + (to - from) * p)
      cur.current = v
      if (spanRef.current) {
        spanRef.current.textContent = v.toLocaleString()
        spanRef.current.classList.add('text-amber-500')
      }
      if (p < 1) {
        raf = requestAnimationFrame(step)
      } else {
        unflashTimer = window.setTimeout(() => spanRef.current?.classList.remove('text-amber-500'), 250)
      }
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(unflashTimer)
    }
  }, [value])
  return (
    <span ref={spanRef} className={cn('tabular-nums transition-colors', className)}>
      {value.toLocaleString()}
    </span>
  )
}

/** 血条 */
export function HpBar({
  value,
  max,
  className,
  height = 6,
  color,
}: {
  value: number
  max: number
  className?: string
  height?: number
  color?: string
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const barColor = color ?? (pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-rose-500')
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-black/20', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-200', barColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** 资源图标 */
export function GoldIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-[10px] font-bold text-amber-900 shadow-inner" style={{ width: size, height: size }}>
      金
    </span>
  )
}

export function GemIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-sm bg-gradient-to-b from-teal-300 to-emerald-500 text-[10px] font-bold text-emerald-950" style={{ width: size, height: size }}>
      灵
    </span>
  )
}

export function TicketIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-gradient-to-b from-orange-300 to-orange-500 text-[10px] font-bold text-orange-950" style={{ width: size, height: size }}>
      券
    </span>
  )
}
