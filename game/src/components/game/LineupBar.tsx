'use client'

import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { LineupEntry } from '@/game/engine'
import type { NightRole, YaoguaiDef } from '@/game/types'
import { SLOTS, lineupSynergy, slotUnlockAt, staminaTier } from '@/game/config'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import { useGameStore } from '@/game/store'
import { useToast } from '@/hooks/use-toast'
import { StarBadge, YaoAvatar } from './shared'
import { ElementBadge } from './ElementBadge'
import { StaminaTierChip } from './StaminaBadge'
import { cn } from '@/lib/utils'

// ============ 夜晚塔防 · 布阵栏 ============
// 点选式布阵：点击卡池妖怪进入「选中」态 → 点击站位槽放置；点击已上阵槽位移除。
// 站位扩容：前 4 格基础开放，第 5/6 格随客栈等级解锁（锁定格显示解锁条件）。

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
        toast({ title: `🔒 站位 ${slot + 1} 尚未解锁`, description: `客栈升至 ${slotUnlockAt(slot)} 级后开放（当前 ${innLevel} 级）`, duration: 2400 })
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
    <div className="shrink-0 border-t border-white/10 bg-[#161233] px-3 pb-2 pt-2">
      {/* 敌军来袭倒计时 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-amber-100/90">⏳ 敌军来袭</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-amber-300">
          {Math.ceil(Math.max(0, countdown))}
        </span>
      </div>

      {/* 站位槽（6 格：3×2 网格；锁定格显示解锁条件） */}
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {Array.from({ length: SLOTS.length }, (_, slot) => {
          const entry = lineup[slot] ?? null
          const locked = slot >= maxSlots
          const unlockLv = slotUnlockAt(slot)
          if (locked) {
            return (
              <div
                key={slot}
                aria-label={`站位 ${slot + 1} 未解锁`}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] py-2 opacity-70"
              >
                <span className="text-base leading-none opacity-70">🔒</span>
                <span className="mt-1 text-[9px] font-bold text-stone-500">客栈{unlockLv}级解锁</span>
                <span className="text-[8px] text-stone-600">当前 {innLevel} 级</span>
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
                className="group relative flex flex-col items-center rounded-xl border border-amber-200/30 bg-amber-100/5 py-1.5 active:scale-95"
              >
                <YaoAvatar id={entry.yaoguaiId} size={44} />
                <span className="mt-0.5 max-w-full truncate px-1 text-[10px] text-stone-200">
                  {def?.name ?? entry.yaoguaiId}
                </span>
                <StarBadge star={entry.star} />
                {entry.level > 1 && (
                  <span className="rounded-full bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-300">
                    Lv.{entry.level}
                  </span>
                )}
                <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1 text-[9px] text-rose-300 opacity-0 transition-opacity group-hover:opacity-100">
                  ✕
                </span>
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
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-2.5 active:scale-95',
                selected
                  ? 'animate-pulse border-amber-300/80 bg-amber-200/10'
                  : 'border-white/20 bg-white/[0.03]'
              )}
            >
              <span className="text-lg leading-none opacity-60">{selected ? '✚' : '⚔️'}</span>
              <span className="mt-1 text-[9px] text-stone-300">{selected ? '点击放置' : `站位${slot + 1}`}</span>
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
          className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5"
        >
          <span className="text-[10px] font-black text-emerald-300">🌿 相生加成</span>
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
        <p className="mb-2 text-center text-[9px] text-stone-400">
          🌿 上阵相生属性妖怪（如 金+水）可获全队加成
        </p>
      )}

      {/* 体力预警条：阵中疲惫/力竭将受 debuff；全体虚脱无法布阵红色提示 */}
      {allCollapse ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          role="alert"
          className="mb-2 flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-500/15 px-2 py-1.5 text-[10px] font-black text-rose-200"
        >
          💀 全体妖怪体力虚脱，无法布阵 · 明天恢复后再战
        </motion.div>
      ) : weakInLineup.length > 0 ? (
        <motion.div
          key={weakInLineup.map((w) => w.name).join('/')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          role="status"
          className="mb-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-xl border border-amber-300/40 bg-amber-400/10 px-2 py-1.5"
        >
          <span className="text-[10px] font-black text-amber-300">⚠️ 阵中妖怪体力不支</span>
          {weakInLineup.map((w) => (
            <span key={w.name} className="text-[10px] font-bold" style={{ color: w.tier.color === '#C0392B' ? '#FCA5A5' : '#FCD34D' }}>
              {w.tier.icon}{w.name}
            </span>
          ))}
          <span className="text-[10px] font-bold text-amber-200/90">
            将受{weakInLineup.some((w) => w.tier.key === 'exhausted') ? '攻速/攻击' : '攻速'} debuff
          </span>
        </motion.div>
      ) : null}

      {/* 站位扩容提示 */}
      {maxSlots < SLOTS.length && (
        <p className="mb-1.5 text-center text-[9px] text-amber-200/60">
          💡 升级客栈可解锁更多站位（当前 {maxSlots}/{SLOTS.length} 格）
        </p>
      )}

      {/* 妖怪卡池（横向滚动） */}
      {pool.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 py-3 text-center text-[11px] text-stone-400">
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
                    ? 'border-white/10 bg-white/[0.03] opacity-45'
                    : 'border-white/15 bg-white/[0.05]',
                  isSelected && !placed && !collapse && 'border-amber-300 bg-amber-200/15 ring-2 ring-amber-300/70',
                  collapse && 'grayscale opacity-60'
                )}
              >
                {placed && (
                  <span className="absolute right-0.5 top-0.5 rounded-full bg-stone-900/90 px-1 text-[8px] text-stone-300">
                    阵中
                  </span>
                )}
                {/* 体力角标（左上：档位 icon + 数值；与右上「阵中」错开） */}
                {!placed && (
                  <span className="absolute left-0.5 top-0.5 z-10">
                    <StaminaTierChip value={p.stamina} compact />
                  </span>
                )}
                {/* 虚脱标签（右下，与体力角标错开） */}
                {collapse && (
                  <span
                    className="absolute bottom-0.5 right-0.5 z-10 rounded-full border border-[#6B4E8E]/70 bg-[#EAE2F3] px-1 text-[9px] font-black leading-tight text-[#6B4E8E]"
                  >
                    💀虚脱
                  </span>
                )}
                <YaoAvatar id={p.id} size={40} active={!collapse} />
                <span className="mt-0.5 flex w-full items-center justify-center gap-0.5 px-0.5">
                  <span className="max-w-full truncate text-[10px] text-stone-200">{p.def.name}</span>
                  <ElementBadge element={p.def.element} size="xs" hideNone />
                </span>
                <StarBadge star={p.star} />
                {p.level > 1 && (
                  <span className="mt-0.5 rounded-full bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-300">
                    Lv.{p.level}
                  </span>
                )}
                <span className="mt-0.5 text-[8px] text-stone-400">{p.def.nightRoleName}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 快捷操作 */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 rounded-lg border border-white/15 bg-white/5 py-1.5 text-[11px] text-stone-200 active:scale-95"
        >
          🧹 清空布阵
        </button>
        <button
          type="button"
          onClick={handleAuto}
          className="flex-1 rounded-lg border border-amber-300/40 bg-amber-400/15 py-1.5 text-[11px] font-medium text-amber-200 active:scale-95"
        >
          ⚡ 自动布阵
        </button>
      </div>
    </div>
  )
}
