'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfigIcon, HpBar, StarBadge, YaoAvatar } from '@/components/game/shared'
import { StaminaTierChip } from '@/components/game/StaminaBadge'
import { useGameStore } from '@/game/store'
import {
  GATHER_ACC_CAP,
  GATHER_AFFINITY,
  GATHER_STAMINA_COST_MULT,
  GATHER_TASKS,
  MAT_CAP_BASE,
  MATERIALS_MAP,
  gatherRateOf,
  matCap,
} from '@/game/config'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import type { OwnedYaoguai } from '@/game/types'
import { sfx } from '@/game/audio'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface GatherPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 数值净化：undefined / NaN 一律回退 0（历史崩溃教训：渲染层绝不信任存档字段） */
function safeNum(v: number | undefined | null): number {
  return Number.isFinite(v as number) ? (v as number) : 0
}

/** 空档兜底常量（模块级稳定引用，避免选择器每次返回新对象引发重渲染风暴） */
const EMPTY_GATHER = { assignments: {} as Record<string, string>, acc: {} as Record<string, number> }
const EMPTY_OWNED: Record<string, OwnedYaoguai> = {}
const EMPTY_MATS: Record<string, number> = {}

/** 采集位选择器行数据 */
interface PickerRow {
  id: string
  name: string
  star: number
  stamina: number
  /** 本任务亲和加成（0 = 无） */
  aff: number
  /** 打工中（任命会自动撤下打工位，由 store 保证） */
  deployed: boolean
  /** 已在其他采集位出野 */
  gathering: boolean
  /** 当前任命在本采集位（金边高亮） */
  current: boolean
}

/**
 * 采集位选择器 —— 列出全部持有妖怪（count>0），按本任务亲和降序（亲和大户排前），
 * 每行：头像 + 名 + 星级 + 亲和 pill + 体力档位 chip + 状态徽章（打工中🛖/出野中🎒），
 * 点击行即任命。
 */
function GathererPicker({
  taskId,
  currentId,
  onPick,
}: {
  taskId: string
  /** 当前任命在该采集位的妖怪 id（金边高亮；undefined = 空位） */
  currentId?: string
  onPick: (yaoguaiId: string) => void
}) {
  const owned = useGameStore((s) => s.owned ?? EMPTY_OWNED)
  const gather = useGameStore((s) => s.gather ?? EMPTY_GATHER)

  // 行数据：亲和降序 → 星级降序 → 名字兜底排序（保证列表稳定）
  const rows = useMemo<PickerRow[]>(() => {
    const gatheringIds = new Set(Object.values(gather?.assignments ?? {}))
    return Object.entries(owned)
      .filter(([id, o]) => (o?.count ?? 0) > 0 && YAOGUAI_MAP[id])
      .map(([id, o]) => ({
        id,
        name: YAOGUAI_MAP[id]?.name ?? id,
        star: Math.max(1, o?.star ?? 1),
        stamina: o?.stamina ?? 100,
        aff: GATHER_AFFINITY[id]?.[taskId] ?? 0,
        deployed: o?.deployed === true,
        gathering: gatheringIds.has(id),
        current: id === currentId,
      }))
      .sort((a, b) => b.aff - a.aff || b.star - a.star || a.name.localeCompare(b.name))
  }, [owned, gather, taskId, currentId])

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-[11px] font-bold text-stone-400">暂无可派遣的妖怪，先去招募几只吧</p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <button
          type="button"
          key={row.id}
          onClick={() => onPick(row.id)}
          aria-label={`派遣${row.name}出野采集`}
          className={cn(
            'flex min-h-[48px] w-full items-center gap-2 rounded-lg px-1.5 text-left transition-colors',
            row.current
              ? 'border-2 border-[#E8B84B] bg-amber-50/80'
              : 'border-2 border-transparent hover:bg-amber-50/50 active:bg-amber-50/80',
          )}
        >
          <YaoAvatar id={row.id} size={36} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-[12px] font-black text-stone-800">
              {row.name}
              <StarBadge star={row.star} size="sm" />
            </p>
            <span className="mt-0.5 flex flex-wrap items-center gap-1">
              {/* 本任务亲和：绿 pill 显眼透出（玩家核心诉求「某些妖怪可以提高采集效率」） */}
              {row.aff > 0 && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-black text-emerald-700">
                  +{Math.round(row.aff * 100)}%
                </span>
              )}
              {row.current ? (
                <span className="rounded-full bg-[#E8B84B]/20 px-1.5 py-px text-[9px] font-black text-[#8A5A1E]">现任</span>
              ) : row.gathering ? (
                <span className="rounded-full bg-[#8B2E24]/10 px-1.5 py-px text-[9px] font-black text-[#8B2E24]">出野</span>
              ) : null}
              {row.deployed && (
                <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-black text-[#8A5A1E]">打工</span>
              )}
            </span>
          </div>
          <StaminaTierChip value={row.stamina} compact />
        </button>
      ))}
    </div>
  )
}

/**
 * 山野采集队面板（V1.3 材料采集系统 UI）
 *
 * 遣妖出野采集素材：每任务一位采集妖，速率 = 基础 × 亲和 × 星级 × 等级 × 体力档位效率；
 * 出野体力消耗为打工的 70%（不享受休息恢复）；累积上限 60 个/任务，采收入仓受仓库容量限制。
 */
export function GatherPanel({ open, onOpenChange }: GatherPanelProps) {
  const { toast } = useToast()

  // ---- 原始值选择器（?? 兜底：存档异常也不至于渲染层崩溃，沿用 ShopPanel 防护约定） ----
  const gather = useGameStore((s) => s.gather ?? EMPTY_GATHER)
  const owned = useGameStore((s) => s.owned ?? EMPTY_OWNED)
  const innLevel = useGameStore((s) => s.innLevel ?? 1)
  const materials = useGameStore((s) => s.materials ?? EMPTY_MATS)
  const gatherTotal = useGameStore((s) => s.stats?.gatherTotal ?? 0)
  const facilities = useGameStore((s) => s.facilities)

  // 当前展开选择器的任务 id（null = 全收起；同一时刻至多一个任务展开）
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  // ---- 派生值（渲染层 useMemo） ----

  // 各任务当前速率（个/小时）：gatherRateOf 需要完整存档 → getState 快照传入；
  // 依赖 gather/owned 引用变化重算（出野妖每秒扣体力 → owned 换引用 → 体力档位效率联动刷新）
  const rates = useMemo<Record<string, number>>(() => {
    const snap = useGameStore.getState()
    const r: Record<string, number> = {}
    for (const t of GATHER_TASKS) r[t.id] = gatherRateOf(snap, t.id)
    return r
  }, [gather, owned])

  // 仓库容量（依赖 facilities 引用：仓库升级时重算；异常值回退基础容量）
  const cap = useMemo(() => {
    const c = matCap(useGameStore.getState())
    return Number.isFinite(c) ? c : MAT_CAP_BASE
  }, [facilities])

  // 仓库库存合计
  const stockTotal = useMemo(
    () => Object.values(materials).reduce((a, b) => a + safeNum(b), 0),
    [materials]
  )

  // 已派遣位数
  const assignedCount = useMemo(
    () => Object.values(gather.assignments).filter(Boolean).length,
    [gather]
  )

  // 可采收总数（各任务累积取整求和，与 collectGather 的取整口径一致）
  const accTotal = useMemo(
    () => Object.values(gather.acc).reduce((a, b) => a + Math.floor(safeNum(b)), 0),
    [gather]
  )

  const room = Math.max(0, cap - stockTotal)
  const warehouseFull = room <= 0
  const canCollect = accTotal >= 1 && !warehouseFull
  // 实际可入账数量（受仓库剩余容量限制）
  const collectCount = Math.min(accTotal, room)

  /** 采收全部：collectGather → claim 音效 + 入账 toast（失败仅透出 store 文案） */
  const handleCollect = () => {
    const res = useGameStore.getState().collectGather()
    if (res.ok) {
      sfx.play('claim')
      toast({ title: '采收入账', description: res.message, duration: 2800 })
    } else {
      toast({ title: res.message, duration: 2800 })
    }
  }

  /** 任命采集妖：click 音效 → assignGatherer → toast 结果（成功后收起选择器） */
  const handleAssign = (taskId: string, yid: string) => {
    sfx.play('click')
    const res = useGameStore.getState().assignGatherer(taskId, yid)
    toast({ title: res.message, duration: 2800 })
    if (res.ok) setExpandedTask(null)
  }

  /** 召回该采集位（任命传 null = 清空） */
  const handleRecall = (taskId: string) => {
    sfx.play('click')
    const res = useGameStore.getState().assignGatherer(taskId, null)
    toast({ title: res.message, duration: 2800 })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="panel-sheet mx-auto h-[78vh] max-h-[78vh] max-w-[480px] rounded-t-[28px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="panel-title text-center text-xl">
            山野采集
          </DrawerTitle>
          <DrawerDescription className="sr-only">山野采集队 · 遣妖出野采集山货素材</DrawerDescription>
          <p className="text-center text-[11px] font-bold tracking-[0.15em] text-stone-500">
            遣妖出野 · 采集山货
          </p>
          <div className="mx-auto mt-1 h-px w-4/5 bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
        </DrawerHeader>

        <div
          data-vaul-no-drag
          className="mx-3 mb-3 flex min-h-0 flex-1 rounded-2xl border border-[#D4A574]/40 bg-white/50 p-1"
        >
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col gap-3 p-2">
              {/* 总览条：派遣 / 累计采收 / 仓库余量 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border-2 border-[#D4A574]/45 bg-white/70 px-3 py-2 text-[11px] font-bold text-stone-600"
              >
                <span>
                  🎒 已派遣 <span className="font-black text-[#8B2E24]">{assignedCount}/{GATHER_TASKS.length}</span> 位
                </span>
                <span className="text-stone-300">·</span>
                <span>
                  🌾 累计采收 <span className="font-black tabular-nums text-[#8B2E24]">{gatherTotal.toLocaleString()}</span> 个
                </span>
                <span className="text-stone-300">·</span>
                <span className={cn(warehouseFull && 'text-[#C0392B]')}>
                  🏠 仓库 <span className="font-black tabular-nums">{stockTotal}/{cap}</span>
                  {warehouseFull && '（已满）'}
                </span>
              </motion.div>

              {/* 收取按钮：无可收灰态 / 可收金色渐变（呼吸提醒） */}
              <motion.button
                type="button"
                disabled={!canCollect}
                onClick={handleCollect}
                animate={canCollect ? { scale: [1, 1.02, 1] } : undefined}
                transition={canCollect ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : undefined}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl text-sm font-black shadow-md transition-transform active:scale-95',
                  canCollect
                    ? 'bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-white shadow-amber-700/30'
                    : 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none',
                )}
              >
                {canCollect ? (
                  <>
                    <ConfigIcon icon="/images/ui/nav-gather.png" size={16} />
                    采收全部（共 {collectCount} 个）
                  </>
                ) : accTotal >= 1 ? (
                  <>
                    <ConfigIcon icon="/images/ui/facility-warehouse.png" size={16} />
                    仓库已满 · 先去仓库清清货
                  </>
                ) : (
                  '暂无可收取产出'
                )}
              </motion.button>

              {/* 任务卡 ×7（stagger 弹入） */}
              {GATHER_TASKS.map((task, i) => {
                const locked = innLevel < task.unlockInnLevel
                const mat = MATERIALS_MAP[task.material]
                const yid = gather.assignments[task.id]
                const o = yid ? owned[yid] : undefined
                const yName = yid ? (YAOGUAI_MAP[yid]?.name ?? '妖怪') : ''
                // 任命妖的本任务亲和（绿 pill 显眼透出）
                const aff = yid ? (GATHER_AFFINITY[yid]?.[task.id] ?? 0) : 0
                const rate = safeNum(rates[task.id])
                const acc = safeNum(gather.acc[task.id])
                const accFull = acc >= GATHER_ACC_CAP
                const expanded = expandedTask === task.id

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.05 + i * 0.09 }}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border-2 p-3.5 shadow-sm',
                      locked ? 'border-stone-300/70 bg-white/45 saturate-[0.6]' : 'border-[#D4A574]/60 bg-white/85',
                    )}
                  >
                    {/* 头部：任务图标（解锁后摇摆）+ 名称/描述 + 产出素材 pill */}
                    <div className="flex items-center gap-3">
                      <motion.span
                        animate={locked ? undefined : { rotate: [0, -6, 6, 0] }}
                        transition={locked ? undefined : { repeat: Infinity, duration: 3.2 }}
                        aria-hidden
                      >
                        <ConfigIcon icon={task.icon} size={32} />
                      </motion.span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-stone-800">
                          {task.name}
                          {locked && (
                            <span className="ml-1.5 inline-flex align-middle" aria-label="未解锁">
                              <ConfigIcon icon="/images/ui/status-lock.png" size={12} />
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-stone-400">{task.desc}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D4A574]/50 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">
                        {mat?.icon ? <ConfigIcon icon={mat.icon} size={14} /> : null}
                        {mat?.name ?? task.material}
                      </span>
                    </div>

                    {locked ? (
                      /* 未解锁：灰态提示 */
                      <p className="mt-2.5 flex items-center justify-center gap-1 rounded-xl bg-stone-200/60 px-2 py-2 text-center text-[11px] font-bold text-stone-500">
                        <ConfigIcon icon="/images/ui/status-lock.png" size={12} />
                        客栈 {task.unlockInnLevel} 级解锁此采集位
                      </p>
                    ) : (
                      <>
                        {/* 速率行：当前速率（一位小数）+ 任命妖亲和 pill */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[11px] font-black tabular-nums text-[#8B2E24]">
                            ⚡ {rate.toFixed(1)} 个/小时
                          </span>
                          {yid && aff > 0 && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-black text-emerald-700">
                              亲和 +{Math.round(aff * 100)}%
                            </span>
                          )}
                        </div>

                        {/* 累积进度条（复用 HpBar；满仓变琥珀提示及时采收） */}
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
                            <span className="text-stone-400">累积产出（上限 {GATHER_ACC_CAP}）</span>
                            <span className={cn('tabular-nums', accFull ? 'text-[#B9770E]' : 'text-stone-600')}>
                              已累积 {Math.floor(acc)} 个{accFull ? ' · 已满' : ''}
                            </span>
                          </div>
                          <HpBar
                            value={acc}
                            max={GATHER_ACC_CAP}
                            height={6}
                            color={accFull ? 'bg-[#D4933D]' : 'bg-[#E8B84B]'}
                          />
                        </div>

                        {/* 采集位区：已任命（点击头像区可换人）/ 空位（虚线框派遣） */}
                        {yid ? (
                          <div className="mt-2.5 flex items-stretch gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedTask(expanded ? null : task.id)}
                              aria-label={`更换「${task.name}」的采集妖怪`}
                              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border-2 border-[#5C3A24]/35 bg-[#F6ECD5]/80 p-2 text-left transition-transform active:scale-[0.98]"
                            >
                              <YaoAvatar id={yid} size={40} />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 truncate text-[13px] font-black text-stone-800">
                                  {yName}
                                  <StarBadge star={Math.max(1, o?.star ?? 1)} size="sm" />
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5">
                                  <StaminaTierChip value={o?.stamina ?? 100} compact />
                                  <span className="text-[9px] font-bold text-stone-400">🎒 出野中</span>
                                </span>
                              </span>
                              <span className="shrink-0 self-center text-[9px] font-bold text-stone-400">
                                {expanded ? '收起 ▴' : '更换 ▾'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecall(task.id)}
                              className="h-9 shrink-0 self-center rounded-xl border border-stone-300 bg-white/75 px-3 text-xs font-black text-stone-500 transition-transform active:scale-95"
                            >
                              召回
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedTask(expanded ? null : task.id)}
                            aria-label={`为「${task.name}」派遣采集妖怪`}
                            className="mt-2.5 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#D4A574]/70 bg-amber-50/40 text-[13px] font-black text-[#A87B3D] transition-transform active:scale-[0.98]"
                          >
                            {expanded ? '收起妖怪名册 ▴' : '＋ 派遣妖怪'}
                          </button>
                        )}

                        {/* 选择器：AnimatePresence 卡内展开（按亲和降序，当前任命金边高亮） */}
                        <AnimatePresence initial={false}>
                          {expanded && (
                            <motion.div
                              key="picker"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#D4A574]/45 bg-white/75 p-1.5">
                                <p className="px-1 pb-1 text-[9px] font-bold text-stone-400">
                                  遣谁出野？· 已按采集亲和排序（任命打工妖会自动撤下打工位）
                                </p>
                                <GathererPicker
                                  taskId={task.id}
                                  currentId={yid}
                                  onPick={(rowId) => handleAssign(task.id, rowId)}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </motion.div>
                )
              })}

              {/* 底部说明条（数值同源：体力折扣 / 累积上限取自 config 常量） */}
              <p className="rounded-xl bg-stone-800/90 px-3 py-2 text-center text-[10px] leading-relaxed text-stone-300">
                出野采集体力消耗为打工的 {Math.round(GATHER_STAMINA_COST_MULT * 100)}%（不享受休息恢复） ·
                体力越充沛效率越高 · 累积上限 {GATHER_ACC_CAP} 个/任务，请及时采收 · 素材入仓受仓库容量限制
              </p>
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
