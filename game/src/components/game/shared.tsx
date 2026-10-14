'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GRADE_COLOR, GRADE_LABEL, YAOGUAI_MAP, yaoImg } from '@/game/yaoguai'
import type { Grade } from '@/game/types'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

/** 统一轻提示（替代各面板重复定义的 notify）：单条 toast，2.2s 自动消失 */
export function notify(title: string, description?: string) {
  const t = toast({ title, description })
  window.setTimeout(() => t.dismiss(), 2200)
}

/** 星级显示（金星徽，高星微光） */
export function StarBadge({ star, size = 'sm' }: { star: number; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 14 : size === 'md' ? 12 : 10
  const count = Math.max(0, Math.min(5, star))
  return (
    <span className={cn('inline-flex items-center gap-px', star >= 5 && 'animate-pulse')} aria-label={`${star}星`}>
      {Array.from({ length: count }).map((_, i) => (
        <img
          key={i}
          src="/images/ui/ui-star.png"
          alt=""
          width={px}
          height={px}
          draggable={false}
          className={cn('inline-block object-contain', star >= 5 && 'drop-shadow-[0_0_4px_rgba(232,184,75,0.9)]')}
        />
      ))}
    </span>
  )
}

/** 品级标签 */
export function GradeTag({ grade, className }: { grade: Grade; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm',
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
      ? 'border-amber-400 ring-1 ring-amber-300/50'
      : def?.grade === 'legend'
        ? 'border-rose-400 ring-1 ring-rose-300/40'
        : 'border-[#5E9C7E]/70 ring-1 ring-[#5E9C7E]/20'
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full border-2 bg-gradient-to-b from-[#FFF9EE] to-[#E8DFD0]',
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
          className="font-display flex h-full w-full items-center justify-center font-bold text-white"
          style={{ background: def?.color ?? '#8B7355', fontSize: size * 0.36 }}
        >
          {def?.name?.[0] ?? '?'}
        </div>
      )}
    </div>
  )
}

/** 整身小立绘「棋子」：主屏游走与夜战守卫共用，与敌人同风格（整身像 + 落地影子） */
export function YaoFigure({
  id,
  size,
  active = true,
  className,
  children,
}: {
  id: string
  size: number
  active?: boolean
  className?: string
  children?: ReactNode
}) {
  const def = YAOGUAI_MAP[id]
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('relative inline-flex flex-col items-center', className)} style={{ height: size }}>
      {!failed ? (
        <img
          src={yaoImg(id)}
          alt={def?.name ?? id}
          draggable={false}
          className={cn('max-w-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]', !active && 'opacity-40 grayscale')}
          style={{ height: size, width: 'auto' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-stone-800 font-bold text-stone-200 ring-1 ring-white/20"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
        >
          {def?.name?.[0] ?? '?'}
        </div>
      )}
      {/* 落地影子：与敌人单位同款 */}
      <span
        aria-hidden
        className="absolute left-1/2 top-full -translate-x-1/2 rounded-[50%] bg-black/45 blur-[2px]"
        style={{ width: size * 0.92, height: Math.max(6, size * 0.2), marginTop: -Math.max(4, size * 0.12) }}
      />
      {children}
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
  const barColor = color ?? (pct > 50 ? 'bg-[#3E9B72]' : pct > 25 ? 'bg-amber-500' : 'bg-rose-500')
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

/** 配置里的 icon：路径则渲染 PNG，否则保留 emoji/字符兼容 */
export function ConfigIcon({
  icon,
  size = 20,
  className,
}: {
  icon: string
  size?: number
  className?: string
}) {
  if (icon.startsWith('/')) {
    return (
      <img
        src={icon}
        alt=""
        aria-hidden
        width={size}
        height={size}
        draggable={false}
        className={cn('inline-block shrink-0 object-contain', className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center leading-none', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.85) }}
    >
      {icon}
    </span>
  )
}

/** 资源图标（山海志怪统一素材） */
export function GoldIcon({ size = 16 }: { size?: number }) {
  return <ConfigIcon icon="/images/ui/gold.png" size={size} />
}

export function GemIcon({ size = 16 }: { size?: number }) {
  return <ConfigIcon icon="/images/ui/gem.png" size={size} />
}

export function TicketIcon({ size = 16 }: { size?: number }) {
  return <ConfigIcon icon="/images/ui/ticket.png" size={size} />
}
