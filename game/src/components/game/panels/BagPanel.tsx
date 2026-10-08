'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGameStore } from '@/game/store'
import { sfx } from '@/game/audio'
import {
  COOK_DISHES,
  COOK_STAMINA_BONUS,
  HASTE_TALISMAN,
  MATERIALS,
  MATERIALS_MAP,
  MATERIAL_CATS,
  MAT_RECIPES,
  matCap,
} from '@/game/config'
import type { MaterialCat } from '@/game/config'
import { ConfigIcon, GoldIcon } from '../shared'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface BagPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function notify(message: string) {
  const t = toast({ title: message })
  window.setTimeout(() => t.dismiss(), 2400)
}

/** 一键出售：基础素材保留底线（>20 的部分卖掉），高级素材与属性石不参与 */
const BASIC_KEEP: Record<string, number> = {
  meat: 20,
  rice: 20,
  salt: 20,
  wine: 20,
  wood: 20,
  stone: 20,
  iron: 20,
}

/** 剩余时长 mm:ss */
function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

/** 面板打开时才跑 1s 倒计时刷新（省性能；开启瞬间异步对时一次） */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const sync = () => setNow(Date.now())
    const t0 = window.setTimeout(sync, 0)
    const t = setInterval(sync, 1000)
    return () => {
      clearTimeout(t0)
      clearInterval(t)
    }
  }, [active])
  return now
}

/** 法宝道具使用入口映射：haste-talisman 可在仓库直接激活；其余道具需在对应场景使用 */
const PROP_USE_HINT: Record<string, string> = {
  'haste-talisman': '',
  'capture-net': '入夜后在捕捉面板点击张网',
  'boss-lure': '白天妖王夜入口焚香使用',
}

/** 素材卡：icon 圆底 + 名称/数量 + desc/售价 + 出售按钮（法宝道具附使用入口） */
function MaterialCard({ id }: { id: string }) {
  const def = MATERIALS_MAP[id]
  const held = useGameStore((s) => s.materials[id] ?? 0)
  const [usePulse, setUsePulse] = useState(false)
  if (!def) return null

  const handleSell = () => {
    const res = useGameStore.getState().sellMaterial(id, 1)
    notify(res.message)
    if (res.ok) sfx.play('coin')
  }

  /** 法宝直接激活（聚宝符）：调用 store action 并给出反馈 */
  const handleUseProp = () => {
    const res = useGameStore.getState().consumeHasteTalisman()
    notify(res.message)
    if (res.ok) {
      sfx.play('claim')
      setUsePulse(true)
      window.setTimeout(() => setUsePulse(false), 900)
    }
  }

  const useHint = PROP_USE_HINT[id]
  const directUse = id === 'haste-talisman'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-3 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#E8B84B] hover:shadow-md',
        held <= 0 && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C9A063] bg-gradient-to-b from-[#F7E6C4] to-[#E8C99B] text-xl shadow-inner',
            held <= 0 && 'grayscale'
          )}
          aria-hidden
        >
          <ConfigIcon icon={def.icon} size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <span className="truncate text-sm font-black text-stone-800">{def.name}</span>
            <span className="shrink-0 text-sm font-black tabular-nums text-[#B8860B]">
              ×{held}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] leading-tight text-stone-400">{def.desc}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-700">
            <GoldIcon size={11} /> {def.sellPrice}/个
          </p>
        </div>
      </div>
      {/* 法宝道具：使用提示 / 直接激活按钮（聚宝符） */}
      {useHint !== undefined && (
        <>
          {directUse ? (
            <button
              type="button"
              disabled={held <= 0}
              onClick={handleUseProp}
              aria-label={`激活${HASTE_TALISMAN.name}（${HASTE_TALISMAN.minutes} 分钟挂机收益 ×${HASTE_TALISMAN.mult}）`}
              className={cn(
                'h-10 w-full rounded-xl text-xs font-black transition active:scale-95',
                held > 0
                  ? 'bg-gradient-to-b from-[#7BA05B] to-[#5D8A43] text-white shadow-md shadow-emerald-800/20'
                  : 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none'
              )}
            >
              {usePulse ? '✨ 已激活！' : `激活 · 收益×${HASTE_TALISMAN.mult}`}
            </button>
          ) : (
            <p className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[#7BA05B]/50 bg-[#F2F7EC]/70 text-[10px] font-bold text-[#5D8A43]">
              💡 {useHint}
            </p>
          )}
        </>
      )}
      <button
        type="button"
        disabled={held <= 0}
        onClick={handleSell}
        className={cn(
          'h-10 w-full rounded-xl text-xs font-black transition active:scale-95',
          held > 0
            ? 'bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-white shadow-md shadow-amber-700/20'
            : 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none'
        )}
      >
        出售×1
      </button>
    </div>
  )
}

/** 灶火做饭：三道菜 + 当前增益倒计时 */
function CookSection({ now }: { now: number }) {
  const materials = useGameStore((s) => s.materials)
  const cooking = useGameStore((s) => s.cooking)
  const active = cooking.until > now

  const handleCook = (dishId: string) => {
    const res = useGameStore.getState().cookDish(dishId)
    notify(res.message)
    if (res.ok) sfx.play('upgrade')
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-0.5">
        <p className="text-xs font-black text-[#8B2E24]">🍳 灶火做饭</p>
        <p className="text-[9px] text-stone-400">上菜限时提升挂机收益</p>
      </div>

      {/* 体力恢复联动提示（与 config.staminaRegenRate 的烹饪加成同源） */}
      <div className="flex items-center gap-1.5 rounded-xl border border-[#8B2E24]/25 bg-[#E8DFD0]/60 px-2.5 py-1.5 text-[10px] font-bold leading-snug text-[#8B2E24]">
        <span aria-hidden>🍲</span>
        <span>烹饪期间全体妖怪体力恢复 +{Math.round(COOK_STAMINA_BONUS * 100)}%</span>
      </div>

      {/* 当前增益状态条 */}
      {active && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl border-2 border-[#E8B84B] bg-gradient-to-r from-[#FBF0D4] to-[#F5E3B8] px-3 py-2"
        >
          <motion.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="text-lg"
            aria-hidden
          >
            🔥
          </motion.span>
          <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-[#8A5A1E]">
            🍽️ {cooking.dish ?? '佳肴'} 效果中 · 金币+
            {Math.round(cooking.goldMult * 100)}%
            {cooking.gemMult > 0 && ` · 灵石+${Math.round(cooking.gemMult * 100)}%`}
          </p>
          <span className="shrink-0 rounded-lg bg-white/70 px-2 py-0.5 text-[11px] font-black tabular-nums text-[#B8860B]">
            {fmtRemain(cooking.until - now)}
          </span>
        </motion.div>
      )}

      {/* 菜谱卡 */}
      <div className="flex flex-col gap-2">
        {COOK_DISHES.map((dish) => {
          const costs = Object.entries(dish.cost)
          const ok = costs.every(([id, n]) => (materials[id] ?? 0) >= n)
          return (
            <div
              key={dish.id}
              className="flex items-center gap-3 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-3 shadow-sm"
            >
              <span aria-hidden>
                <ConfigIcon icon={dish.icon} size={28} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-stone-800">{dish.name}</p>
                <p className="text-[10px] leading-tight text-stone-400">{dish.desc}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {costs.map(([id, n]) => {
                    const def = MATERIALS_MAP[id]
                    const have = materials[id] ?? 0
                    return (
                      <span
                        key={id}
                        className={cn(
                          'text-[11px] font-bold tabular-nums',
                          have >= n ? 'text-[#6B5240]' : 'text-rose-600'
                        )}
                      >
                        {def?.icon ? <ConfigIcon icon={def.icon} size={14} /> : null}×{n}
                        <span className="ml-0.5 text-[9px] text-stone-400">({have})</span>
                      </span>
                    )
                  })}
                </div>
              </div>
              <button
                type="button"
                disabled={!ok}
                onClick={() => handleCook(dish.id)}
                className={cn(
                  'h-10 min-w-[64px] shrink-0 rounded-xl px-3 text-[13px] font-black transition active:scale-95',
                  ok
                    ? 'bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-white shadow-md shadow-amber-700/25'
                    : 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none'
                )}
              >
                开火
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** 万物合成：5 低级 → 1 高级 */
function SynthSection() {
  const materials = useGameStore((s) => s.materials)

  const handleSynth = (recipeId: string) => {
    const res = useGameStore.getState().synthMaterial(recipeId)
    notify(res.message)
    if (res.ok) sfx.play('upgrade')
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-0.5">
        <p className="text-xs font-black text-[#8B2E24]">🧰 万物合成</p>
        <p className="text-[9px] text-stone-400">低级建材聚成高级货</p>
      </div>
      <div className="flex flex-col gap-2">
        {MAT_RECIPES.map((r) => {
          const from = MATERIALS_MAP[r.from.id]
          const to = MATERIALS_MAP[r.to.id]
          const haveFrom = materials[r.from.id] ?? 0
          const haveTo = materials[r.to.id] ?? 0
          const ok = haveFrom >= r.from.n
          return (
            <div
              key={r.id}
              className="flex items-center gap-2.5 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-3 shadow-sm"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-black text-stone-800">
                  <span className={cn('inline-flex items-center gap-0.5', haveFrom >= r.from.n ? '' : 'text-rose-600')}>
                    {r.from.n}×{from?.icon ? <ConfigIcon icon={from.icon} size={16} /> : null}
                    <span className="ml-0.5 text-[11px] font-bold">{from?.name}</span>
                  </span>
                  <span className="text-[#B8860B]" aria-hidden>
                    ➜
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    {r.to.n}×{to?.icon ? <ConfigIcon icon={to.icon} size={16} /> : null}
                    <span className="ml-0.5 text-[11px] font-bold">{to?.name}</span>
                  </span>
                </div>
                <p className="text-[10px] tabular-nums text-stone-400">
                  持有：{from?.name}×{haveFrom} · {to?.name}×{haveTo}
                </p>
              </div>
              <button
                type="button"
                disabled={!ok}
                onClick={() => handleSynth(r.id)}
                className={cn(
                  'h-10 min-w-[68px] shrink-0 rounded-xl px-3 text-[13px] font-black transition active:scale-95',
                  ok
                    ? 'bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-white shadow-md shadow-amber-700/25'
                    : 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none'
                )}
              >
                合成
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * 仓库面板 —— 三类素材管理 / 灶火做饭 / 万物合成 / 出售
 */
export function BagPanel({ open, onOpenChange }: BagPanelProps) {
  const materials = useGameStore((s) => s.materials)
  const facilities = useGameStore((s) => s.facilities)
  const [tab, setTab] = useState<MaterialCat>('food')

  const now = useNow(open)
  const cap = matCap({ facilities })
  const total = Object.values(materials).reduce((a, b) => a + (b ?? 0), 0)
  const pct = cap > 0 ? Math.min(100, (total / cap) * 100) : 0
  const warn = pct > 80
  const catMaterials = MATERIALS.filter((m) => m.cat === tab)

  /** 一键出售该类基础素材（>20 的部分） */
  const handleSellSurplus = (cat: MaterialCat) => {
    const s = useGameStore.getState()
    const targets = MATERIALS.filter(
      (m) => m.cat === cat && (BASIC_KEEP[m.id] ?? 0) > 0 && (s.materials[m.id] ?? 0) > BASIC_KEEP[m.id]
    )
    if (targets.length === 0) {
      notify('没有多余的基础素材（各留 20 个备用）')
      return
    }
    let gold = 0
    let count = 0
    for (const m of targets) {
      const n = (s.materials[m.id] ?? 0) - (BASIC_KEEP[m.id] ?? 0)
      const res = s.sellMaterial(m.id, n)
      if (res.ok) {
        gold += n * m.sellPrice
        count += n
      }
    }
    if (count > 0) {
      sfx.play('coin')
      notify(`清仓 ${count} 件，入账 ${gold.toLocaleString()} 金币`)
    }
  }

  const handleTabChange = (key: MaterialCat) => {
    if (key !== tab) {
      sfx.play('click')
      setTab(key)
    }
  }

  const catMeta = MATERIAL_CATS.find((c) => c.key === tab)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="panel-sheet mx-auto h-[78vh] max-h-[78vh] max-w-[480px] rounded-t-[28px]">
        <DrawerHeader className="pb-1">
          <DrawerTitle className="panel-title text-center text-xl">
            仓 库
          </DrawerTitle>
          <DrawerDescription className="sr-only">素材仓库与灶火做饭、合成</DrawerDescription>

          {/* 存储上限进度条 */}
          <div className="mx-auto mt-1 w-4/5">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold">
              <span className="text-[#8B7355]">存储 {total.toLocaleString()} / {cap.toLocaleString()}</span>
              {warn && <span className="text-orange-600">快满了，卖点货腾地方！</span>}
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-[#EADFC8]"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="仓库存储进度"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  warn
                    ? 'bg-gradient-to-r from-orange-400 to-orange-600'
                    : 'bg-gradient-to-r from-[#E8C97A] to-[#D4933D]'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="mx-auto mt-1 h-px w-4/5 bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
        </DrawerHeader>

        {/* 分类 Tabs（滑块式高亮；四类含法宝道具） */}
        <div className="mx-3 mb-2 grid grid-cols-4 gap-1 rounded-xl bg-[#EADFC8] p-1" data-vaul-no-drag>
          {MATERIAL_CATS.map((c) => {
            const activeTab = tab === c.key
            const catTotal = MATERIALS.filter((m) => m.cat === c.key).reduce(
              (a, m) => a + (materials[m.id] ?? 0),
              0
            )
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => handleTabChange(c.key)}
                aria-pressed={activeTab}
                className={cn(
                  'relative flex h-11 flex-col items-center justify-center rounded-lg text-[11px] font-black transition active:scale-95',
                  activeTab ? 'text-[#8A5A1E]' : 'text-[#8B7355]'
                )}
              >
                {activeTab && (
                  <motion.span
                    layoutId="bag-cat-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <ConfigIcon icon={c.icon} size={14} />
                  {c.name}
                </span>
                <span
                  className={cn(
                    'relative z-10 text-[9px] font-bold tabular-nums',
                    activeTab ? 'text-[#B8860B]' : 'opacity-60'
                  )}
                >
                  共 {catTotal}
                </span>
              </button>
            )
          })}
        </div>

        {/* 内容区 */}
        <div
          data-vaul-no-drag
          className="mx-3 mb-3 flex min-h-0 flex-1 rounded-2xl border border-[#D4A574]/40 bg-white/50 p-1"
        >
          <ScrollArea className="h-full w-full">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex flex-col gap-3 p-2"
            >
              {tab === 'food' && <CookSection now={now} />}
              {tab === 'build' && <SynthSection />}

              {/* 分类标题 + 一键出售 */}
              <div className="flex items-center justify-between gap-2 px-0.5">
                <p className="flex min-w-0 items-center gap-1 truncate text-[11px] font-bold text-[#8B7355]">
                  {catMeta?.icon ? <ConfigIcon icon={catMeta.icon} size={14} /> : null} {catMeta?.desc}
                </p>
                {tab !== 'growth' && tab !== 'prop' ? (
                  <button
                    type="button"
                    onClick={() => handleSellSurplus(tab)}
                    className="h-9 shrink-0 rounded-full border border-[#D4A574] bg-[#FBF0D4] px-3 text-[11px] font-black text-[#8A5A1E] transition active:scale-95"
                  >
                    出售多余
                  </button>
                ) : (
                  <span className="shrink-0 text-[9px] text-stone-400">
                    {tab === 'prop' ? '法宝珍贵，请按需使用' : '属性石珍贵，不支持一键出售'}
                  </span>
                )}
              </div>

              {/* 素材网格（2 列） */}
              <div className="grid grid-cols-2 gap-2">
                {catMaterials.map((m) => (
                  <MaterialCard key={m.id} id={m.id} />
                ))}
              </div>
            </motion.div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
