'use client'

import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GradeTag, YaoAvatar } from '@/components/game/shared'
import { useGameStore } from '@/game/store'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import { cn } from '@/lib/utils'

export interface RecruitResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 招募到的妖怪 id 数组 */
  results: string[]
  /** 本次新收录（招募前不在图鉴中）的妖怪 id */
  newIds?: string[]
  /** 继续招募回调（不传则不显示「继续招募」按钮） */
  onContinue?: () => void
}

/**
 * 招募结果弹窗 —— 单抽翻转入场 / 十连 stagger 弹入
 */
export function RecruitResultDialog({
  open,
  onOpenChange,
  results,
  newIds,
  onContinue,
}: RecruitResultDialogProps) {
  const owned = useGameStore((s) => s.owned)
  const isTen = results.length > 1
  const newCount = results.filter((id) => isNew(id)).length
  /** 本次抽卡批次 key（继续招募时重播入场动画） */
  const batchKey = results.join(',')

  function isNew(id: string): boolean {
    if (newIds) return newIds.includes(id)
    // 未传 newIds 时降级判断：当前仅持有 1 只视为新收录
    return (owned[id]?.count ?? 0) <= 1
  }

  if (results.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] rounded-3xl border-2 border-[#D4A574]/80 bg-gradient-to-b from-[#FAF6ED] to-[#F1EADA] p-5">
        <DialogHeader className="items-center space-y-0.5">
          <DialogTitle className="text-lg font-black tracking-[0.2em] text-[#2D5A3D]">
            {isTen ? '十连 · 妖籍入册' : '招募结果'}
          </DialogTitle>
          <DialogDescription>
            {newCount > 0 ? (
              <span className="font-bold text-amber-600">本次新收录 {newCount} 只！</span>
            ) : (
              <span>皆为旧识，化作修行资粮</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isTen ? (
          /* 十连：网格依次弹入 */
          <div className="grid grid-cols-5 gap-1.5 py-1">
            {results.map((id, i) => {
              const def = YAOGUAI_MAP[id]
              if (!def) return null
              const rare = def.grade !== 'normal'
              return (
                <motion.div
                  key={`${batchKey}-${id}-${i}`}
                  initial={{ scale: 0, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 320, damping: 20 }}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 rounded-xl border bg-white/85 p-1.5',
                    rare
                      ? 'border-amber-400 shadow-[0_0_10px_rgba(232,184,75,0.55)]'
                      : 'border-[#D4A574]/50'
                  )}
                >
                  {isNew(id) && (
                    <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-red-500 px-1 text-[8px] font-black leading-4 text-white shadow">
                      新
                    </span>
                  )}
                  <YaoAvatar id={id} size={44} />
                  <span className="max-w-full truncate text-[9px] font-bold text-stone-700">{def.name}</span>
                </motion.div>
              )
            })}
          </div>
        ) : (
          /* 单抽：翻转入场 */
          <div className="flex justify-center py-2" style={{ perspective: 900 }}>
            {results.slice(0, 1).map((id) => {
              const def = YAOGUAI_MAP[id]
              if (!def) return null
              const rare = def.grade !== 'normal'
              return (
                <motion.div
                  key={`single-${batchKey}-${id}`}
                  initial={{ rotateY: 180, opacity: 0, scale: 0.7 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.65, ease: 'easeOut' }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className={cn(
                    'relative flex w-44 flex-col items-center gap-2 rounded-3xl border-2 bg-white/90 p-5',
                    rare
                      ? 'border-amber-400 shadow-[0_0_22px_rgba(232,184,75,0.55)]'
                      : 'border-[#D4A574]/70'
                  )}
                >
                  {isNew(id) && (
                    <motion.span
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="absolute -top-3 rounded-full bg-gradient-to-r from-[#E8B84B] to-[#D4933D] px-2.5 py-0.5 text-[10px] font-black text-white shadow-md"
                    >
                      新收录!
                    </motion.span>
                  )}
                  <YaoAvatar id={id} size={88} />
                  <span className="text-base font-black text-stone-800">{def.name}</span>
                  <GradeTag grade={def.grade} />
                </motion.div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2">
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="h-12 flex-1 rounded-xl border-2 border-[#2D5A3D]/50 bg-[#2D5A3D]/10 text-sm font-black text-[#2D5A3D] transition-transform active:scale-95"
            >
              继续招募
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-12 flex-1 rounded-xl bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-sm font-black text-white shadow-md shadow-amber-500/30 transition-transform active:scale-95"
          >
            收下
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
