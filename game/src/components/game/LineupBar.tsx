'use client'

import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { LineupEntry } from '@/game/engine'
import type { NightRole, YaoguaiDef } from '@/game/types'
import { SLOTS, lineupSynergy, slotUnlockAt, staminaTier } from '@/game/config'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import { useGameStore } from '@/game/store'
import { useToast } from '@/hooks/use-toast'
import { ConfigIcon, StarBadge, YaoAvatar } from './shared'
import { ElementBadge } from './ElementBadge'
import { StaminaTierChip } from './StaminaBadge'
import { cn } from '@/lib/utils'

/** 体力档位图：使用 config 图标路径（ConfigIcon） */
function StaminaMark({
  icon,
  title,
  color,
}: {
  icon: string
  title: string
  color: string
}) {
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-black/70 leading-none shadow-md"
      style={{ borderColor: color }}
    >
      <ConfigIcon icon={icon} size={12} />
    </span>
  )
}

// ============ 夜晚塔防 · 布阵栏 ============
// 点选式布阵：点击卡池妖怪进入「选中」态 → 点击站位槽放置；点击已上阵槽位移除。
// 站位扩容：前 4 格基础开放，第 5/6 格随客栈等级解锁；底栏单行 6 槽以免挡住战场。

export interface LineupBarProps {
  /** 长度 6（前 4 基础 + 2 扩容），索引即站位 slot */
  lineup: Array<LineupEntry | null>
  /** 玩家持有妖怪 id（count>0） */
  ownedIds: string[]
  onPlace: (slot: number, yaoguaiId: string) => void
  onRemove: (slot: number) => void
  /** 剩余秒数 */
  countdown: number
  /** 受控选中妖怪（与战场站位格联动），不传则组件内部管理 */
  selectedId?: string | null
  onSelectCard?: (id: string | null) => void
  /** 当前可用站位数（4/5/6，随客栈等级） */
  maxSlots?: number
  /** 客栈等级（锁定格提示用） */
  innLevel?: number
}

/** 自动布阵优先级：tank > allround > ranged/mage > healer > controller > assassin > support */
const ROLE_PRIORITY: Record<NightRole, number> = {
  tank: 0,
  allround: 1,
  ranged: 2,
  mage: 3,
  healer: 4,
  controller: 5,
  assassin: 6,
  support: 7,
}

interface PoolItem {
  id: string
  def: YaoguaiDef
  star: number
  level: number
  /** 当前体力（卡池角标/虚脱拦截用） */
  stamina: number
}

export function LineupBar({
  lineup,
  ownedIds,
  onPlace,
  onRemove,
  countdown,
  selectedId,
  onSelectCard,
  maxSlots = SLOTS.length,
  innLevel = 1,
}: LineupBarProps) {
  const [innerSelected, setInnerSelected] = useState<string | null>(null)
  const selected = selectedId !== undefined ? selectedId : innerSelected
  const owned = useGameStore((s) => s.owned)
  const { toast } = useToast()

  const setSelected = useCallback(
    (id: string | null) => {
      setInnerSelected(id)
      onSelectCard?.(id)
    },
    [onSelectCard]
  )

  // 倒计时进度条：本组件随 prep 阶段挂载/卸载，首帧倒计时即该阶段上限（首波 8s / 后续 6s），
  // 阶段内倒计时单调递减，用 state 初始值锁定分母即可，无需额外同步
  const [phaseMax] = useState(() => Math.max(countdown, 1))
  const pct = Math.max(0, Math.min(100, (countdown / phaseMax) * 100))

  // 卡池：按夜战定位优先级 + 星级排序
  const pool = useMemo<PoolItem[]>(() => {
    return ownedIds
      .map((id) => ({
        id,
        def: YAOGUAI_MAP[id],
        star: owned[id]?.star ?? 1,
        level: owned[id]?.level ?? 1,
        stamina: owned[id]?.stamina ?? 100,
      }))
      .filter((p): p is PoolItem => p.def != null)
      .sort(
        (a, b) =>
          ROLE_PRIORITY[a.def.nightRole] - ROLE_PRIORITY[b.def.nightRole] || b.star - a.star
      )
  }, [ownedIds, owned])

  const inLineup = useCallback((id: string) => lineup.some((l) => l?.yaoguaiId === id), [lineup])

  // 阵容相生加成（上阵妖怪属性 → lineupSynergy）
  const synergy = useMemo(() => {
    const defs = lineup
      .filter((l): l is LineupEntry => l != null)
      .map((l) => ({ element: YAOGUAI_MAP[l.yaoguaiId]?.element ?? null }))
    return lineupSynergy(defs)
  }, [lineup])
  const synergyKey = synergy.pairs.map((p) => p.pair.join('+')).join('/')

  // 阵中体力不支预警（疲惫/力竭受攻速/攻击 debuff；虚脱不可上阵不会出现在阵中）
  const weakInLineup = useMemo(() => {
    return lineup
      .filter((l): l is LineupEntry => l != null)
      .map((l) => {
        const stamina = owned[l.yaoguaiId]?.stamina ?? l.stamina ?? 100
        return { name: YAOGUAI_MAP[l.yaoguaiId]?.name ?? l.yaoguaiId, tier: staminaTier(stamina) }
      })
      .filter((w) => w.tier.key === 'tired' || w.tier.key === 'exhausted')
  }, [lineup, owned])

  // 全体虚脱：无妖可上阵（卡池非空但全部 collapse；<0.01 容差与 DayScreen 横幅同约定，覆盖休息妖秒级恢复的浮点漂移）
  const allCollapse = useMemo(
    () => pool.length > 0 && pool.every((p) => p.stamina < 0.01 || !staminaTier(p.stamina).battleOk),
    [pool]
  )

  const handleSlotClick = useCallback(
    (slot: number) => {
      if (slot >= maxSlots) {
        toast({ title: `站位 ${slot + 1} 尚未解锁`, description: `客栈升至 ${slotUnlockAt(slot)} 级后开放（当前 ${innLevel} 级）`, duration: 2400 })
        return
      }
      if (!selected) {
        toast({ title: '先点选下方妖怪卡，再点站位槽部署', duration: 2400 })
        return
      }
      onPlace(slot, selected)
      setSelected(null)
    },
    [selected, onPlace, setSelected, toast, maxSlots, innLevel]
  )

  const handleCardClick = useCallback(
    (id: string) => {
      if (inLineup(id)) return // 阵中置灰，需先在站位槽移除
      const o = owned[id]
      // 虚脱拦截：体力耗尽不可上阵（夜战措辞，不引导白天操作；<0.01 容差与卡面 💀虚脱 标签保持一致）
      const st = o?.stamina ?? 100
      if (st < 0.01 || !staminaTier(st).battleOk) {
        toast({
          title: `💀 ${YAOGUAI_MAP[id]?.name ?? '该妖怪'}体力虚脱，无法上阵`,
          description: '体力耗尽需好好休息，明天恢复后再战',
          duration: 2400,
        })
        return
      }
      setSelected(selected === id ? null : id)
    },
    [inLineup, owned, selected, setSelected, toast]
  )

  const handleAuto = useCallback(() => {
    for (let i = 0; i < lineup.length; i++) onRemove(i)
    // 自动布阵跳过虚脱妖怪（体力不 battleOk 不可上阵，<0.01 容差同上）
    pool
      .filter((p) => p.stamina >= 0.01 && staminaTier(p.stamina).battleOk)
      .slice(0, maxSlots)
      .forEach((p, i) => onPlace(i, p.id))
  }, [onRemove, onPlace, pool, maxSlots, lineup.length])

  const handleClear = useCallback(() => {
    for (let i = 0; i < lineup.length; i++) onRemove(i)
  }, [onRemove, lineup.length])

  return (
    <div className="mx-1.5 mb-1 shrink-0 overflow-hidden rounded-2xl border-2 border-[#5C3A24]/55 shadow-lg">
      <div className="ui-wood px-3 py-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-display text-xs font-bold tracking-wider text-[#FFE9B8]">敌军来袭</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/35">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E8B84B] to-[#D4933D] transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-[#E8B84B]">
            {Math.ceil(Math.max(0, countdown))}
          </span>
        </div>
      </div>
      <div className="bg-gradient-to-b from-[#2C241C] to-[#1C1915] px-2.5 pb-1.5 pt-1.5">

      {/* 站位槽：单行 6 格，少挡战场 */}
      <div className="mb-1.5 grid grid-cols-6 gap-0.5">
        {Array.from({ length: SLOTS.length }, (_, slot) => {
          const entry = lineup[slot] ?? null
          const locked = slot >= maxSlots
          const unlockLv = slotUnlockAt(slot)
          if (locked) {
            return (
              <div
                key={slot}
                aria-label={`站位 ${slot + 1} 未解锁，客栈${unlockLv}级开放`}
                className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#FFE9B8]/15 bg-black/20 py-1 opacity-70"
              >
                <ConfigIcon icon="/images/ui/status-lock.png" size={12} />
                <span className="mt-0.5 text-[7px] font-bold leading-none text-[#E6DCC8]/50">{unlockLv}级</span>
              </div>
            )
          }
          if (entry) {
            const def = YAOGUAI_MAP[entry.yaoguaiId]
            return (
              <button
                key={slot}
                type="button"
                aria-label={`移除站位 ${slot + 1} 的 ${def?.name ?? ''}`}
                onClick={() => onRemove(slot)}
                className="relative flex flex-col items-center rounded-lg border border-[#E8B84B]/40 bg-[#E8B84B]/10 py-0.5 active:scale-95"
              >
                <YaoAvatar id={entry.yaoguaiId} size={30} />
                <span className="mt-0.5 max-w-full truncate px-0.5 text-[7px] leading-none text-[#E6DCC8]">
                  {def?.name ?? entry.yaoguaiId}
                </span>
                {(() => {
                  const st = owned[entry.yaoguaiId]?.stamina ?? entry.stamina ?? 100
                  const tier = staminaTier(st)
                  if (tier.key === 'full' || tier.key === 'normal') return null
                  return (
                    <span className="absolute left-0 top-0 z-10 scale-90">
                      <StaminaMark icon={tier.icon} title={tier.desc} color={tier.color} />
                    </span>
                  )
                })()}
              </button>
            )
          }
          return (
            <button
              key={slot}
              type="button"
              aria-label={`站位 ${slot + 1} 放置妖怪`}
              onClick={() => handleSlotClick(slot)}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border border-dashed py-1 active:scale-95',
                selected
                  ? 'animate-pulse border-[#E8B84B]/80 bg-[#E8B84B]/12'
                  : 'border-[#FFE9B8]/20 bg-black/20'
              )}
            >
              <ConfigIcon icon="/images/ui/slot-pad.png" size={16} className="opacity-70" />
              <span className="mt-0.5 text-[7px] leading-none text-[#E6DCC8]/70">{selected ? '放' : `${slot + 1}`}</span>
            </button>
          )
        })}
      </div>

      {/* 相生加成汇总条（上阵属性对 lineupSynergy 实时检测） */}
      {synergy.pairs.length > 0 ? (
        <motion.div
          key={synergyKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          role="status"
          aria-label={`阵容相生加成：攻击+${Math.round(synergy.atkPct * 100)}%，生命+${Math.round(synergy.hpPct * 100)}%`}
          className="mb-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-2 py-1"
        >
          <span className="text-[10px] font-black text-emerald-300">相生加成</span>
          {synergy.pairs.map((p) => (
            <span
              key={p.pair.join('+')}
              className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-200"
            >
              <ElementBadge element={p.pair[0]} size="xs" />
              <span aria-hidden>+</span>
              <ElementBadge element={p.pair[1]} size="xs" />
              <span>
                全队{p.kind === 'atk' ? '攻击' : '生命'}+{Math.round(p.value * 100)}%
              </span>
            </span>
          ))}
          <span className="text-[10px] font-black tabular-nums text-emerald-300">
            合计 攻+{Math.round(synergy.atkPct * 100)}% · 血+{Math.round(synergy.hpPct * 100)}%
          </span>
        </motion.div>
      ) : (
        <p className="mb-1.5 text-center text-[8px] text-[#E6DCC8]/45">
          相生属性可获全队加成
        </p>
      )}

      {/* 体力预警条：阵中疲惫/力竭将受 debuff；全体虚脱无法布阵红色提示 */}
      {allCollapse ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          role="alert"
          className="mb-1.5 flex items-center justify-center gap-1.5 rounded-xl border border-[#8B2E24]/55 bg-[#8B2E24]/20 px-2 py-1 text-[10px] font-black text-[#F5A9A0]"
        >
          全体妖怪体力虚脱，无法布阵 · 明天恢复后再战
        </motion.div>
      ) : weakInLineup.length > 0 ? (
        <motion.div
          key={weakInLineup.map((w) => w.name).join('/')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          role="status"
          className="mb-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-xl border border-[#E8B84B]/45 bg-[#E8B84B]/12 px-2 py-1"
        >
          <span className="text-[10px] font-black text-[#E8B84B]">阵中妖怪体力不支</span>
          {weakInLineup.map((w) => (
            <span key={w.name} className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: w.tier.color === '#C0392B' ? '#FCA5A5' : '#FCD34D' }}>
              <StaminaMark icon={w.tier.icon} title={w.tier.desc} color={w.tier.color} />
              {w.name}
            </span>
          ))}
          <span className="text-[10px] font-bold text-[#FFE9B8]/90">
            将受{weakInLineup.some((w) => w.tier.key === 'exhausted') ? '攻速/攻击' : '攻速'} debuff
          </span>
        </motion.div>
      ) : null}

      {/* 妖怪卡池（横向滚动） */}
      {pool.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#FFE9B8]/20 py-3 text-center text-[11px] text-[#E6DCC8]/55">
          暂无可上阵妖怪，白天多招募些伙伴吧
        </div>
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {pool.map((p) => {
            const placed = inLineup(p.id)
            const isSelected = selected === p.id
            const tier = staminaTier(p.stamina)
            // 虚脱判定与拦截/标签同源（<0.01 容差）
            const collapse = p.stamina < 0.01 || !tier.battleOk
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleCardClick(p.id)}
                aria-label={`选择 ${p.def.name}${collapse ? '（体力虚脱不可上阵）' : ''}`}
                aria-disabled={collapse || undefined}
                className={cn(
                  'relative flex w-16 shrink-0 flex-col items-center rounded-xl border py-1.5 active:scale-95',
                  placed
                    ? 'border-[#FFE9B8]/10 bg-black/25 opacity-45'
                    : 'border-[#FFE9B8]/18 bg-black/30',
                  isSelected && !placed && !collapse && 'border-[#E8B84B] bg-[#E8B84B]/15 ring-2 ring-[#E8B84B]/60',
                  collapse && 'grayscale opacity-60'
                )}
              >
                {placed && (
                  <span className="absolute right-0.5 top-0.5 rounded-full bg-[#1C1915]/90 px-1 text-[8px] text-[#E6DCC8]/70">
                    阵中
                  </span>
                )}
                {!placed && (
                  <span className="absolute left-0.5 top-0.5 z-10">
                    <StaminaTierChip value={p.stamina} compact />
                  </span>
                )}
                {collapse && (
                  <span className="absolute bottom-0.5 right-0.5 z-10 rounded-full border border-[#6B4E8E]/70 bg-[#EAE2F3] px-1 text-[9px] font-black leading-tight text-[#6B4E8E]">
                    虚脱
                  </span>
                )}
                <YaoAvatar id={p.id} size={40} active={!collapse} />
                <span className="mt-0.5 flex w-full items-center justify-center gap-0.5 px-0.5">
                  <span className="max-w-full truncate text-[10px] text-[#E6DCC8]">{p.def.name}</span>
                  <ElementBadge element={p.def.element} size="xs" hideNone />
                </span>
                <StarBadge star={p.star} />
                {p.level > 1 && (
                  <span className="mt-0.5 rounded-full bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-300">
                    Lv.{p.level}
                  </span>
                )}
                <span className="mt-0.5 text-[8px] text-[#E6DCC8]/45">{p.def.nightRoleName}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 快捷操作 */}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 rounded-lg border border-[#FFE9B8]/20 bg-black/25 py-1 text-[11px] text-[#E6DCC8] active:scale-95"
        >
          清空布阵
        </button>
        <button
          type="button"
          onClick={handleAuto}
          disabled={allCollapse}
          className="flex-1 rounded-lg border border-[#E8B84B]/45 bg-[#E8B84B]/18 py-1 text-[11px] font-medium text-[#FFE9B8] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          自动布阵
        </button>
      </div>
      </div>
    </div>
  )
}
