'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGameStore } from '@/game/store'
import { sfx } from '@/game/audio'
import {
  FACILITIES,
  FACILITY_ABILITY_ENHANCE,
  FACILITY_ABILITY_LEVEL,
  MATERIALS_MAP,
  REST_BONUS_BASE,
  REST_BONUS_PER_GUESTROOM,
  facilityCost,
  facilityMatCost,
} from '@/game/config'
import type { FacilityConfig } from '@/game/config'
import type { GameSave } from '@/game/types'
import { ConfigIcon, GoldIcon, HpBar } from '../shared'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type FacilityKey = keyof GameSave['facilities']

export interface FacilityPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 打开时高亮并滚动到的设施 */
  focusKey?: keyof GameSave['facilities']
}

function notify(title: string, description?: string) {
  const t = toast({ title, description })
  window.setTimeout(() => t.dismiss(), 2200)
}

function formatRate(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1)
}

/** 定位徽章：普通设施用 roleColor 配色，全局设施用金色 */
function RolePill({ cfg }: { cfg: FacilityConfig }) {
  if (cfg.role === 'global') {
    return (
      <span className="rounded-full border border-[#E8B84B]/80 bg-[#E8B84B]/25 px-1.5 py-px text-[10px] font-black text-[#8A5A1E]">
        全局
      </span>
    )
  }
  return (
    <span
      className="rounded-full border px-1.5 py-px text-[10px] font-black"
      style={{
        color: cfg.roleColor,
        backgroundColor: `${cfg.roleColor}14`,
        borderColor: `${cfg.roleColor}59`,
      }}
    >
      {cfg.roleName}
    </span>
  )
}

/** 特殊能力行（三态：未解锁 / 已解锁 / 已强化） */
function AbilityRow({ level, cfg }: { level: number; cfg: FacilityConfig }) {
  const ability = cfg.ability
  if (level >= FACILITY_ABILITY_ENHANCE) {
    // 已强化：金色更醒目 + 呼吸光晕
    return (
      <motion.div
        animate={{
          boxShadow: [
            '0 0 0px rgba(232,184,75,0)',
            '0 0 10px rgba(232,184,75,0.55)',
            '0 0 0px rgba(232,184,75,0)',
          ],
        }}
        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
        className="rounded-xl border-2 border-[#E8B84B] bg-gradient-to-r from-[#FBF0D4] to-[#F5E3B8] px-2.5 py-1.5"
      >
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug">
          <span className="font-black text-[#B8860B]">✦</span>
          <span className="font-black text-[#8A5A1E]">{ability.name}</span>
          <span className="rounded-full bg-[#E8B84B] px-1.5 py-px text-[9px] font-black text-white shadow-sm">
            已强化
          </span>
          <span className="w-full text-[#8B7355]">
            {ability.desc}
            <span className="font-bold text-[#B8860B]"> {ability.enhanceDesc}</span>
          </span>
        </span>
      </motion.div>
    )
  }
  if (level >= FACILITY_ABILITY_LEVEL) {
    // 已解锁未强化：金色高亮边框 + 能力名小徽章（更醒目，信息结构不变）
    return (
      <div className="rounded-xl border border-[#E8B84B]/70 bg-[#FBF0D4]/90 px-2.5 py-1.5">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug">
          <span className="font-black text-[#B8860B]">✓</span>
          <span className="rounded-full bg-gradient-to-b from-[#E8B84B] to-[#D4943C] px-1.5 py-px text-[10px] font-black text-white shadow-sm">
            {ability.name}
          </span>
          <span className="text-[#8B7355]">{ability.desc}</span>
        </span>
      </div>
    )
  }
  // 未解锁
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-[#C9B896] bg-[#F5F0E4]/60 px-2.5 py-1.5 text-[11px] leading-snug text-[#A89880]">
      <span>🔒</span>
      <span className="font-bold">{ability.name}</span>
      <span className="opacity-70">· Lv.{FACILITY_ABILITY_LEVEL} 解锁</span>
    </div>
  )
}

export function FacilityPanel({ open, onOpenChange, focusKey }: FacilityPanelProps) {
  const gold = useGameStore((s) => s.gold)
  const facilities = useGameStore((s) => s.facilities)
  const materials = useGameStore((s) => s.materials)
  const innLevel = useGameStore((s) => s.innLevel)
  const owned = useGameStore((s) => s.owned)
  const workerLimitFn = useGameStore((s) => s.workerLimit)
  const upgradeFacility = useGameStore((s) => s.upgradeFacility)

  // 总金币收益速率（基础 × 妖怪打工加成）
  const totalRate = useMemo(
    () => useGameStore.getState().goldRate(),
    [innLevel, owned, facilities, gold]
  )
  const workerLimit = useMemo(() => workerLimitFn(), [workerLimitFn, facilities])

  const [highlight, setHighlight] = useState<FacilityKey | null>(null)
  const [burst, setBurst] = useState<FacilityKey | null>(null)
  const cardRefs = useRef<Partial<Record<FacilityKey, HTMLDivElement | null>>>({})
  const prevOpen = useRef(false)

  // 打开时高亮 focusKey 并滚动到该卡片（打开中切换 focusKey 同样生效）
  useEffect(() => {
    if (!open) {
      prevOpen.current = false
      return
    }
    const firstOpen = !prevOpen.current
    prevOpen.current = true
    if (!focusKey) return
    setHighlight(focusKey)
    // 用 rAF 收敛式滚动代替 scrollIntoView：抽屉入场动画（transform）会干扰
    // scrollIntoView 的几何计算，导致聚焦卡片被顶出视口（手机端只露出 3/4）。
    // 逐帧重算目标位置直到动画停稳、目标值不再变化。
    const scrollCardIntoView = (card: HTMLDivElement) => {
      const vp = card.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null
      if (!vp) return
      let last = Number.NaN
      const tick = () => {
        const target = Math.max(
          0,
          card.getBoundingClientRect().top -
            vp.getBoundingClientRect().top +
            vp.scrollTop -
            (vp.clientHeight - card.offsetHeight) / 2
        )
        if (Number.isNaN(last) || Math.abs(target - last) > 1) {
          last = target
          vp.scrollTo({ top: target })
          requestAnimationFrame(tick)
        }
      }
      requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => {
      const card = cardRefs.current[focusKey]
      if (card) scrollCardIntoView(card)
    }, firstOpen ? 500 : 60)
    const clear = setTimeout(() => setHighlight(null), 2800)
    return () => {
      clearTimeout(timer)
      clearTimeout(clear)
    }
  }, [open, focusKey])

  // 升级飘字自动消失
  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(null), 900)
    return () => clearTimeout(t)
  }, [burst])

  const handleUpgrade = (key: FacilityKey) => {
    const cfg = FACILITIES.find((f) => f.key === key)
    if (!cfg) return
    const state = useGameStore.getState()
    const lv = state.facilities[key]
    if (lv >= cfg.maxLevel) return
    // 建造门槛（温泉汤院需客栈 5 级；store 内静默 return，这里负责提示）
    if (cfg.unlockInnLevel && state.innLevel < cfg.unlockInnLevel) {
      notify('尚未解锁', `${cfg.name}需客栈达到 ${cfg.unlockInnLevel} 级才能建造`)
      return
    }
    const cost = facilityCost(cfg, lv)
    if (state.gold < cost) {
      notify('金币不足', `${lv === 0 ? '建造' : '升级'}${cfg.name}还需 ${(cost - gold).toLocaleString()} 金币`)
      return
    }
    // Lv.4+ 建材本地校验（store 内静默 return，这里负责提示）
    const matCost = facilityMatCost(key, lv)
    const lacking = Object.entries(matCost).filter(([id, n]) => (state.materials[id] ?? 0) < n)
    if (lacking.length > 0) {
      notify(
        '建材不足',
        `还缺 ${lacking
          .map(([id, n]) => `${MATERIALS_MAP[id]?.name ?? id}×${n - (state.materials[id] ?? 0)}`)
          .join('、')}`
      )
      return
    }
    upgradeFacility(key)
    sfx.play('upgrade')
    setBurst(key)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="panel-sheet mx-auto max-w-[480px] rounded-t-3xl">
        <DrawerHeader className="pb-2 text-center">
          <DrawerTitle className="panel-title text-lg tracking-wide">
            客栈设施
          </DrawerTitle>
          <DrawerDescription className="text-xs font-medium leading-relaxed text-[#8B7355]">
            设施等级提升白天收益与对应定位妖怪的夜晚战力
            <br />
            当前总收益 <span className="font-bold text-[#B8860B]">+{formatRate(totalRate)}</span> 金币/秒
            （含妖怪打工加成）
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea data-vaul-no-drag className="h-[62vh] max-h-[62vh] px-4 pb-6">
          <div className="flex flex-col gap-3 pt-1">
            {FACILITIES.map((cfg) => {
              const level = facilities[cfg.key]
              const cost = facilityCost(cfg, level)
              const isMax = level >= cfg.maxLevel
              const isBuilt = level > 0
              // Lv.4+ 升级建材消耗（本地校验库存，不足则禁用按钮）
              const matCost = facilityMatCost(cfg.key, level)
              const matEntries = Object.entries(matCost)
              const matOk = matEntries.every(([id, n]) => (materials[id] ?? 0) >= n)
              const affordable = gold >= cost
              const isHighlight = highlight === cfg.key
              // 建造门槛：客栈等级不足时锁定（温泉汤院需客栈 5 级，其余设施无此字段不受影响）
              const innNeed = cfg.unlockInnLevel ?? 0
              const innLocked = innNeed > 0 && innLevel < innNeed
              return (
                <div
                  key={cfg.key}
                  ref={(el) => {
                    cardRefs.current[cfg.key] = el
                  }}
                  className={cn(
                    'relative overflow-visible rounded-2xl border p-3 shadow-sm transition-all',
                    isHighlight
                      ? 'border-[#E8B84B] bg-amber-50 ring-2 ring-[#E8B84B]/70'
                      : 'border-[#D4A574]/50 bg-white/70'
                  )}
                >
                  {/* 升级 +1 飘字 */}
                  <AnimatePresence>
                    {burst === cfg.key && (
                      <motion.span
                        key="burst"
                        initial={{ opacity: 0, y: 0, scale: 0.7 }}
                        animate={{ opacity: 1, y: -26, scale: 1.1 }}
                        exit={{ opacity: 0, y: -36 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="pointer-events-none absolute right-4 top-3 z-10 rounded-full bg-[#8B2E24] px-2 py-0.5 text-[11px] font-bold text-[#F5D77E] shadow-lg"
                      >
                        +1 级 ✨
                      </motion.span>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        'relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border shadow-inner outline outline-1 outline-offset-[-3px]',
                        isBuilt
                          ? 'border-[#C9A063] bg-gradient-to-b from-[#F7E6C4] to-[#E8C99B] outline-[#C9A227]/45'
                          : 'border-stone-300 bg-stone-100 opacity-70 grayscale outline-transparent'
                      )}
                    >
                      <ConfigIcon icon={cfg.icon} size={52} />
                      {isBuilt && (
                        <span className="absolute -bottom-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#5C3A24] bg-gradient-to-b from-[#F7DE8B] to-[#D4933D] px-1 text-[10px] font-black leading-none text-[#5C3A24] shadow-md">
                          {level}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-[17px] text-[#4A3728]">{cfg.name}</span>
                        <RolePill cfg={cfg} />
                        {!isBuilt && (
                          <span className="rounded-md bg-stone-200 px-1.5 py-0.5 text-[11px] font-black text-[#8A8378]">
                            未建造
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#8B7355]">{cfg.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpgrade(cfg.key)}
                      disabled={isMax || !matOk || innLocked}
                      aria-label={innLocked ? `${cfg.name}需客栈 ${innNeed} 级解锁建造` : undefined}
                      className={cn(
                        'flex h-11 min-w-[92px] shrink-0 items-center justify-center gap-1 rounded-xl text-[13px] font-bold shadow-md transition active:scale-95',
                        isMax || !matOk || innLocked
                          ? 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none'
                          : affordable
                            ? 'bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-white shadow-amber-700/25'
                            : 'bg-stone-200/90 text-stone-400 shadow-none'
                      )}
                    >
                      {innLocked ? (
                        `🔒 客栈${innNeed}级`
                      ) : isMax ? (
                        '已满级'
                      ) : (
                        <>
                          {!isBuilt && <span>建造</span>}
                          <GoldIcon size={13} />
                          {cost.toLocaleString()}
                        </>
                      )}
                    </button>
                  </div>

                  {/* 建造门槛锁定面板：客栈等级进度（仅温泉汤院等带 unlockInnLevel 的设施出现） */}
                  {innLocked && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-dashed border-[#C9B896] bg-[#F5F0E4]/70 px-2.5 py-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1 text-[#8B7355]">
                      <ConfigIcon icon="/images/ui/status-lock.png" size={12} />
                      客栈 {innNeed} 级解锁建造
                    </span>
                        <span className="tabular-nums text-[#8B7355]">
                          {innLevel}/{innNeed}
                        </span>
                      </div>
                      <HpBar
                        value={Math.min(innLevel, innNeed)}
                        max={innNeed}
                        height={6}
                        color="bg-[#B8860B]"
                      />
                    </div>
                  )}

                  {/* 白天收益行 */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl bg-[#E6DCC8]/80 px-2.5 py-1.5 text-[11px] text-[#6B5240]">
                    <span aria-hidden>
                      <ConfigIcon icon="/images/ui/ui-sun.png" size={13} />
                    </span>
                    <span>
                      每级 <span className="font-bold text-[#B8860B]">+{cfg.goldPerLevel}</span> 金币/秒
                    </span>
                    <span className="opacity-40">·</span>
                    <span>
                      当前产出 <span className="font-bold text-[#B8860B]">{formatRate(level * cfg.goldPerLevel)}</span>/秒
                    </span>
                  </div>

                  {/* 温泉：全体休息体力恢复联动（与 config.staminaRegenRate 温泉乘区同源：每级 +8%，Lv.3 硫磺疗愈 ×1.5） */}
                  {cfg.key === 'hotSpring' && level > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-xl border border-[#8B2E24]/25 bg-[#E8DFD0]/70 px-2.5 py-1.5 text-[11px] leading-snug text-[#8B2E24]">
                      <span aria-hidden>
                        <ConfigIcon icon="/images/ui/facility-hotSpring.png" size={13} />
                      </span>
                      <span>
                        全体妖怪休息体力恢复 +
                        <span className="font-black text-[#1E5C34]">{Math.round(level * 8)}%</span>
                        {level >= FACILITY_ABILITY_LEVEL ? '（硫磺疗愈 ×1.5）' : ''}
                      </span>
                    </div>
                  )}

                  {/* 客房：体力恢复联动说明（与 config.staminaRegenRate 同源的加成数值） */}
                  {cfg.key === 'guestRoom' && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-xl border border-[#8B2E24]/25 bg-[#E8DFD0]/70 px-2.5 py-1.5 text-[11px] leading-snug text-[#8B2E24]">
                      <span aria-hidden>
                        <ConfigIcon icon="/images/ui/facility-guestRoom.png" size={13} />
                      </span>
                      <span>
                        客房等级越高，休息中的妖怪体力恢复越快
                        <span className="font-black text-[#1E5C34]">
                          （当前 +
                          {Math.round(
                            (REST_BONUS_BASE + Math.min(level, 5) * REST_BONUS_PER_GUESTROOM) * 100
                          )}
                          %）
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Lv.4+ 建材消耗（库存不足红色）；Lv.4 前给小提示 */}
                  {matEntries.length > 0 ? (
                    <div
                      className={cn(
                        'mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border px-2.5 py-1.5 text-[11px]',
                        matOk
                          ? 'border-[#D4A574]/40 bg-[#E6DCC8]/80'
                          : 'border-rose-300 bg-rose-50/80'
                      )}
                    >
                      <span className="inline-flex items-center gap-1 font-bold text-[#6B5240]">
                        <ConfigIcon icon="/images/ui/cat-build.png" size={13} />
                        {level === 0 ? '建造还需' : '升级还需'}
                      </span>
                      {matEntries.map(([id, n]) => {
                        const have = materials[id] ?? 0
                        return (
                          <span
                            key={id}
                            title={`${MATERIALS_MAP[id]?.name ?? id}（持有 ${have}）`}
                            className={cn(
                              'font-black tabular-nums',
                              have >= n ? 'text-[#6B5240]' : 'text-rose-600'
                            )}
                          >
                            <span className="inline-flex items-center gap-1">
                              {MATERIALS_MAP[id]?.icon ? (
                                <ConfigIcon icon={MATERIALS_MAP[id]!.icon} size={14} />
                              ) : null}
                              {MATERIALS_MAP[id]?.name}×{n}
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    isBuilt &&
                    level < 3 && (
                      <p className="mt-1 px-1 text-[9px] text-[#A89880]">
                        Lv.4 起升级需建材（杂货铺有售）
                      </p>
                    )
                  )}

                  {/* 夜晚联动行 */}
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-gradient-to-r from-[#8B2E24] to-[#5C3A24] px-2.5 py-1.5 text-[11px] leading-snug text-[#EDE6D4] shadow-inner">
                    <span className="shrink-0 drop-shadow-[0_0_3px_rgba(232,184,75,0.6)]" aria-hidden>
                      <ConfigIcon icon="/images/ui/status-moon.png" size={13} />
                    </span>
                    <span className="min-w-0 flex-1">{cfg.nightDesc}</span>
                  </div>

                  {/* 特殊能力行（Lv.3 解锁 / Lv.5 强化） */}
                  <div className="mt-1.5">
                    <AbilityRow level={level} cfg={cfg} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-[#8B7355]/80">
            设施 Lv.{FACILITY_ABILITY_LEVEL} 解锁特殊能力 · Lv.{FACILITY_ABILITY_ENHANCE} 强化
            <br />
            升级客房可增加打工位（当前 {workerLimit} 个）
          </p>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}
