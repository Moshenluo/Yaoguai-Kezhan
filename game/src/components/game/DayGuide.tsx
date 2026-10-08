'use client'

import { ConfigIcon } from './shared'

export type DayGuideStep = 1 | 2 | 3

const COPY: Record<DayGuideStep, { icon: string; title: string; body: string }> = {
  1: { icon: '/images/ui/facility-guestRoom.png', title: '点建筑，升级客栈', body: '院子里的针是设施。点开就能升级，白天收益会涨。' },
  2: { icon: '/images/ui/nav-yaokui.png', title: '小妖白天干活，入夜守店', body: '游走的是正在打工的小妖。体力要留着，晚上还得上阵。' },
  3: { icon: '/images/ui/status-moon.png', title: '天黑了就点这里守店', body: '右下角入夜是今晚主事。布阵守店，控血还能收服。' },
}

export function DayGuide({
  step,
  onNext,
  onSkip,
}: {
  step: DayGuideStep
  onNext: () => void
  onSkip: () => void
}) {
  const copy = COPY[step]
  return (
    <div className="pointer-events-none absolute inset-0 z-40" role="dialog" aria-label="客栈指引">
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="pointer-events-auto absolute inset-x-3 bottom-[6.4rem] z-10 rounded-2xl border border-[#D4A574]/70 bg-[#F5EFE3] px-3.5 py-3 shadow-lg">
        <div className="flex items-start gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8B2E24]/10">
            <ConfigIcon icon={copy.icon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-widest text-[#8B2E24]">
              指引 {step}/3
            </p>
            <p className="text-sm font-black text-[#4A3728]">{copy.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#6B5240]">{copy.body}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="h-9 rounded-lg px-3 text-[12px] font-bold text-[#8B7355] active:scale-95"
          >
            跳过
          </button>
          <button
            type="button"
            onClick={onNext}
            className="h-9 rounded-lg bg-gradient-to-r from-[#E8B84B] to-[#D4933D] px-4 text-[12px] font-black text-[#5C3A1E] shadow-sm active:scale-95"
          >
            {step === 3 ? '知道了' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  )
}
