'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AdDialog } from '@/components/game/AdDialog'
import { GemIcon, GoldIcon, TicketIcon } from '@/components/game/shared'
import { RecruitResultDialog } from '@/components/game/panels/RecruitResultDialog'
import { useGameStore } from '@/game/store'
import { RARE_IDS, YAOGUAI_MAP } from '@/game/yaoguai'
import { trackEvent } from '@/game/cloud'
import { sfx } from '@/game/audio'
import {
  ADVANCED_RARE_RATE,
  CAPTURE_NET,
  EXP_POTIONS,
  GROCERY_GEM,
  GROCERY_GOLD,
  HASTE_TALISMAN,
  NORMAL_RARE_RATE,
  RECRUIT_COST,
  STAMINA_POTIONS,
  regionDef,
} from '@/game/config'
import { ELEMENT_ORDER, MATERIALS_MAP, matCap, stoneIdFor } from '@/game/config'
import type { Element } from '@/game/types'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface ShopPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RecruitKind = 'normal' | 'ten' | 'advanced' | 'advancedTen' | 'free' | 'ticket'

function notify(message: string) {
  const t = toast({ title: message })
  window.setTimeout(() => t.dismiss(), 2400)
}

/**
 * 商店面板 —— 招募（免费/单抽/十连/高级/招募券/广告）、经验药水与道具预告
 */
export function ShopPanel({ open, onOpenChange }: ShopPanelProps) {
  // ?? 0 兑底：即使存档异常也不至于渲染层崩溃
  const gold = useGameStore((s) => s.gold ?? 0)
  const gems = useGameStore((s) => s.gems ?? 0)
  const tickets = useGameStore((s) => s.tickets ?? 0)
  const potions = useGameStore((s) => s.potions)
  // ?? 0 兑底：即使存档异常也不至于渲染层崩溃
  const staminaPotions = useGameStore(
    (s) => s.staminaPotions ?? { small: 0, medium: 0, large: 0 }
  )
  const freeUsed = useGameStore((s) => s.daily?.freeRecruitUsed === true)
  // 法宝铺持有量（响应式）
  const materials = useGameStore((s) => s.materials)
  // 招募池随区域轮换（V1.3.1）：当前驻扎区域与本区独占稀有
  const region = useGameStore((s) => s.region ?? 1) as 1 | 2 | 3
  const regionRares = RARE_IDS.filter((id) => {
    const def = YAOGUAI_MAP[id]
    return !def.spawnRegions || def.spawnRegions.includes(region)
  })
  const regionInfo = regionDef(region)

  const [resultOpen, setResultOpen] = useState(false)
  const [resultIds, setResultIds] = useState<string[]>([])
  const [newIds, setNewIds] = useState<string[]>([])
  const [lastKind, setLastKind] = useState<RecruitKind | null>(null)
  const [adOpen, setAdOpen] = useState(false)

  const doRecruit = (kind: RecruitKind): boolean => {
    const st = useGameStore.getState()
    const before = new Set(st.tujian)
    const res = st.recruit(kind)
    if (!res.ok) {
      notify(res.message ?? '招募失败')
      return false
    }
    trackEvent('recruit', {
      kind,
      count: res.results.length,
      rareCount: res.results.filter((id) => YAOGUAI_MAP[id]?.grade === 'rare' || YAOGUAI_MAP[id]?.grade === 'legend')
        .length,
    })
    sfx.play('recruit')
    setResultIds(res.results)
    setNewIds(res.results.filter((id) => !before.has(id)))
    setLastKind(kind)
    setResultOpen(true)
    return true
  }

  /** 广告免费高级招募：广告补贴灵石，随高级招募立即消耗，等效免费 */
  const handleAdReward = () => {
    useGameStore.getState().addGems(RECRUIT_COST.advanced)
    doRecruit('advanced')
  }

  /** 购买经验药水 */
  const handleBuyPotion = (size: 'small' | 'medium' | 'large') => {
    const res = useGameStore.getState().buyPotion(size)
    notify(res.message)
    if (res.ok) sfx.play('coin')
  }

  /** 购买体力药水 */
  const handleBuyStaminaPotion = (size: 'small' | 'medium' | 'large') => {
    const res = useGameStore.getState().buyStaminaPotion(size)
    notify(res.message)
    if (res.ok) sfx.play('coin')
  }

  /** 杂货铺买素材：先校验余额与仓库容量，再扣费 + 入库（addMaterials 尊重上限） */
  const handleBuyMaterial = (id: string, price: number, currency: 'gold' | 'gems') => {
    const s = useGameStore.getState()
    const cap = matCap(s)
    const total = Object.values(s.materials).reduce((a, b) => a + (b ?? 0), 0)
    if (total >= cap) {
      notify('仓库已满，先去仓库清清货')
      return
    }
    if (currency === 'gold' ? s.gold < price : s.gems < price) {
      notify(currency === 'gold' ? '金币不足' : '灵石不足')
      return
    }
    if (currency === 'gold') s.addGold(-price)
    else s.addGems(-price)

    if (id === 'stone-bag') {
      // 属性石袋：随机开出七属性石×1
      const els: Element[] = ELEMENT_ORDER
      const el = els[Math.floor(Math.random() * els.length)]
      const sid = stoneIdFor(el)
      s.addMaterials({ [sid]: 1 })
      notify(`开出：${MATERIALS_MAP[sid]?.name ?? sid}×1`)
    } else {
      s.addMaterials({ [id]: 1 })
      notify(`购得 ${MATERIALS_MAP[id]?.name ?? id}×1`)
    }
    sfx.play('coin')
  }

  const canContinue = lastKind !== null && lastKind !== 'free'
  const handleContinue = () => {
    if (!lastKind || lastKind === 'free') {
      setResultOpen(false)
      return
    }
    const ok = doRecruit(lastKind)
    if (!ok) setResultOpen(false)
  }

  const options: Array<{
    key: Exclude<RecruitKind, 'free'>
    title: string
    badge?: string
    costNode: ReactNode
    sub: string
    disabled: boolean
  }> = [
    {
      key: 'normal',
      title: '普通招募 ×1',
      costNode: (
        <>
          <GoldIcon size={13} /> {RECRUIT_COST.normal}
        </>
      ),
      sub: '普通池 · 有小概率出稀有',
      disabled: gold < RECRUIT_COST.normal,
    },
    {
      key: 'ten',
      title: '普通十连',
      badge: '十连保底稀有',
      costNode: (
        <>
          <GoldIcon size={13} /> {RECRUIT_COST.ten}
        </>
      ),
      sub: '一口气招十只，必得稀有',
      disabled: gold < RECRUIT_COST.ten,
    },
    {
      key: 'advanced',
      title: '高级招募 ×1',
      costNode: (
        <>
          <GemIcon size={13} /> {RECRUIT_COST.advanced}
        </>
      ),
      sub: `稀有概率 ${Math.round(ADVANCED_RARE_RATE * 100)}%`,
      disabled: gems < RECRUIT_COST.advanced,
    },
    {
      key: 'advancedTen',
      title: '高级十连',
      badge: '必得稀有',
      costNode: (
        <>
          <GemIcon size={13} /> {RECRUIT_COST.advancedTen}
        </>
      ),
      sub: `稀有概率 ${Math.round(ADVANCED_RARE_RATE * 100)}% · 十连保底`,
      disabled: gems < RECRUIT_COST.advancedTen,
    },
    {
      key: 'ticket',
      title: '招募券 ×1',
      costNode: (
        <>
          <TicketIcon size={13} /> 1
        </>
      ),
      sub: `普通池 · 持有 ${tickets} 张`,
      disabled: tickets < 1,
    },
  ]

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="mx-auto h-[78vh] max-h-[78vh] max-w-[480px] rounded-t-[28px] border-x-2 border-t-[3px] border-[#D4A574] bg-gradient-to-b from-[#FAF6ED] to-[#F1EADA]">
          <DrawerHeader className="pb-1">
            <DrawerTitle className="text-center text-xl font-black tracking-[0.3em] text-[#2D5A3D]">
              商 店
            </DrawerTitle>
            <DrawerDescription className="sr-only">招募妖怪与道具购买</DrawerDescription>
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-stone-700">
              <span className="flex items-center gap-1">
                <GoldIcon size={15} /> {gold.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <GemIcon size={15} /> {Math.floor(gems)}
              </span>
              <span className="flex items-center gap-1">
                <TicketIcon size={15} /> {tickets}
              </span>
            </div>
            <div className="mx-auto mt-1 h-px w-4/5 bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
          </DrawerHeader>

          <div
            data-vaul-no-drag
            className="mx-3 mb-3 flex min-h-0 flex-1 rounded-2xl border border-[#D4A574]/40 bg-white/50 p-1"
          >
            <ScrollArea className="h-full w-full">
              <div className="flex flex-col gap-3 p-2">
                {/* 招募池区域轮换提示（V1.3.1）：稀有精怪随驻扎区域轮换 */}
                <div className="rounded-2xl border-2 border-[#8AB8A0]/70 bg-gradient-to-br from-[#EDF5EF] to-[#E2EEE5] p-3">
                  <p className="text-[11px] font-black text-[#2D5A3D]">
                    📍 招募池随区域轮换 · 当前：{regionInfo.icon} {regionInfo.name}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[#4A6B54]">
                    本区独占稀有：{regionRares.map((id) => YAOGUAI_MAP[id]?.name ?? id).join(' / ')}
                    <br />
                    在世界地图移驻别处后，能招到的稀有精怪也会随之轮换
                  </p>
                </div>

                {/* 每日免费招募 */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-[#E8B84B] bg-gradient-to-br from-[#FBF0D4] via-[#F7E7C0] to-[#F2DCA6] p-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={freeUsed ? undefined : { rotate: [0, -8, 8, 0] }}
                      transition={freeUsed ? undefined : { repeat: Infinity, duration: 2.4 }}
                      className={cn('text-4xl', freeUsed && 'grayscale opacity-50')}
                    >
                      🎁
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-[#8A5A1E]">每日免费招募</p>
                      <p className="text-[11px] text-[#A87B3D]">
                        {freeUsed ? '今日已领 · 明日 0 点刷新' : '掌柜的福利，白得一只小妖！'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={freeUsed}
                      onClick={() => doRecruit('free')}
                      className={cn(
                        'h-11 min-w-[92px] rounded-xl px-4 text-sm font-black transition-transform active:scale-95',
                        freeUsed
                          ? 'cursor-not-allowed bg-stone-200 text-stone-400'
                          : 'bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-white shadow-md shadow-amber-500/30'
                      )}
                    >
                      {freeUsed ? '今日已领' : '免费招募'}
                    </button>
                  </div>
                </div>

                {/* 招募按钮组 */}
                <div className="grid grid-cols-2 gap-2">
                  {options.map((opt) => (
                    <button
                      type="button"
                      key={opt.key}
                      disabled={opt.disabled}
                      onClick={() => doRecruit(opt.key)}
                      className={cn(
                        'relative flex flex-col items-start gap-1 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-3 text-left shadow-sm transition-transform active:scale-95',
                        opt.disabled && 'opacity-55'
                      )}
                    >
                      {opt.badge && (
                        <span className="absolute -top-2 right-2 rounded-full bg-[#E8B84B] px-2 py-px text-[9px] font-black text-white shadow-sm">
                          {opt.badge}
                        </span>
                      )}
                      <span className="text-sm font-black text-stone-800">{opt.title}</span>
                      <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums text-amber-700">
                        {opt.costNode}
                      </span>
                      <span className="text-[10px] text-stone-400">{opt.sub}</span>
                    </button>
                  ))}
                </div>

                {/* 广告免费高级招募 */}
                <button
                  type="button"
                  onClick={() => setAdOpen(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-[#E8B84B] bg-amber-50/70 p-3 transition-transform active:scale-95"
                >
                  <span className="text-2xl">📺</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-black text-[#8A5A1E]">免费高级招募</span>
                    <span className="block text-[10px] text-[#A87B3D]">
                      看段广告，免 {RECRUIT_COST.advanced} 灵石抽一次高级池（稀有
                      {Math.round(ADVANCED_RARE_RATE * 100)}%）
                    </span>
                  </span>
                  <span className="rounded-xl bg-[#E8B84B] px-3 py-2 text-xs font-black text-white shadow-sm">
                    看广告
                  </span>
                </button>

                {/* 概率公示（V1.3.1 更新：新概率 + 区域轮换 + 收服耗灵石） */}
                <p className="rounded-xl bg-stone-800/90 px-3 py-2 text-center text-[10px] leading-relaxed text-stone-300">
                  概率公示｜普通池（含招募券）：普通小妖 {Math.round((1 - NORMAL_RARE_RATE) * 1000) / 10}% / 本区稀有
                  {Math.round(NORMAL_RARE_RATE * 1000) / 10}%
                  <br />
                  高级池：普通小妖 {Math.round((1 - ADVANCED_RARE_RATE) * 100)}% / 本区稀有
                  {Math.round(ADVANCED_RARE_RATE * 100)}%（两种十连均保底 1 只稀有）
                  <br />
                  收服耗灵石：精英 5 / 妖王 20 · 野性难驯的稀有精英 30% 概率当夜不可收服
                </p>

                {/* 经验药水 */}
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-xs font-black text-[#2D5A3D]">🧪 经验药水</p>
                    <p className="text-[9px] text-stone-400">喂给妖怪提升等级</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {EXP_POTIONS.map((p) => {
                      const held = potions[p.id] ?? 0
                      const affordable = p.currency === 'gold' ? gold >= p.price : gems >= p.price
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-3 shadow-sm"
                        >
                          <motion.span
                            animate={held > 0 ? { rotate: [0, -6, 6, 0] } : undefined}
                            transition={held > 0 ? { repeat: Infinity, duration: 3.2 } : undefined}
                            className="text-2xl"
                            aria-hidden
                          >
                            {p.icon}
                          </motion.span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-stone-800">{p.name}</p>
                            <p className="text-[11px] font-bold text-emerald-700">经验 +{p.exp}</p>
                            <p className="text-[10px] text-stone-400">已持有 {held} 瓶</p>
                          </div>
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => handleBuyPotion(p.id)}
                            className={cn(
                              'flex h-11 min-w-[84px] shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-[13px] font-black transition active:scale-95',
                              affordable
                                ? 'bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-white shadow-md shadow-amber-700/25'
                                : 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none'
                            )}
                          >
                            {p.currency === 'gold' ? <GoldIcon size={13} /> : <GemIcon size={13} />}
                            {p.price}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-stone-400">
                    药水在【妖库→妖怪卡】中使用
                  </p>
                </div>

                {/* 体力药铺：三档体力药水（单只小/中 + 全体大） */}
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-xs font-black text-[#2D5A3D]">🏮 体力药铺</p>
                    <p className="text-[9px] text-stone-400">妖怪疲惫/力竭时喝一瓶回状态</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {STAMINA_POTIONS.map((p) => {
                      const held = staminaPotions[p.id] ?? 0
                      const affordable = p.currency === 'gold' ? gold >= p.price : gems >= p.price
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-3 shadow-sm"
                        >
                          <motion.span
                            animate={held > 0 ? { rotate: [0, -6, 6, 0] } : undefined}
                            transition={held > 0 ? { repeat: Infinity, duration: 3.2 } : undefined}
                            className="text-2xl"
                            aria-hidden
                          >
                            {p.icon}
                          </motion.span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-stone-800">
                              {p.name}
                              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-black text-[#8A5A1E]">
                                {p.target === 'all' ? '全体' : '单只'}
                              </span>
                            </p>
                            <p className="text-[11px] font-bold text-emerald-700">体力 +{p.value}</p>
                            <p className="text-[10px] text-stone-400">{p.desc} · 已持有 {held} 瓶</p>
                          </div>
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => handleBuyStaminaPotion(p.id)}
                            className={cn(
                              'flex h-11 min-w-[84px] shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-[13px] font-black transition active:scale-95',
                              affordable
                                ? 'bg-gradient-to-b from-[#E8B84B] to-[#D4943C] text-white shadow-md shadow-amber-700/25'
                                : 'cursor-not-allowed bg-stone-200 text-stone-400 shadow-none'
                            )}
                          >
                            {p.currency === 'gold' ? <GoldIcon size={13} /> : <GemIcon size={13} />}
                            {p.price}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-stone-400">
                    体力药水在【妖库→妖怪卡】中使用 · 妖库顶部可看广告全体恢复
                  </p>
                </div>

                {/* 杂货铺：食材与建材 */}
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-xs font-black text-[#2D5A3D]">🧺 杂货铺</p>
                    <p className="text-[9px] text-stone-400">仓库有空位才能购买</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {GROCERY_GOLD.map((g) => {
                      const def = MATERIALS_MAP[g.id]
                      const affordable = gold >= g.price
                      return (
                        <button
                          type="button"
                          key={g.id}
                          disabled={!affordable}
                          onClick={() => handleBuyMaterial(g.id, g.price, 'gold')}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-2.5 shadow-sm transition-transform active:scale-95',
                            !affordable && 'opacity-55'
                          )}
                        >
                          <span className="text-2xl" aria-hidden>
                            {def?.icon}
                          </span>
                          <span className="text-[11px] font-bold text-stone-700">{def?.name}</span>
                          <span className="flex h-6 items-center gap-1 rounded-lg bg-amber-50 px-2 text-[11px] font-black tabular-nums text-amber-700">
                            <GoldIcon size={11} /> {g.price}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {/* 灵石商品：妖丹 / 属性石袋 */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {GROCERY_GEM.map((g) => {
                      const affordable = gems >= g.price
                      return (
                        <button
                          type="button"
                          key={g.id}
                          disabled={!affordable}
                          onClick={() => handleBuyMaterial(g.id, g.price, 'gems')}
                          className={cn(
                            'flex items-center gap-2.5 rounded-2xl border-2 border-[#D4A574]/60 bg-white/85 p-2.5 text-left shadow-sm transition-transform active:scale-95',
                            !affordable && 'opacity-55'
                          )}
                        >
                          <span className="text-2xl" aria-hidden>
                            {g.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-black text-stone-800">{g.name}</span>
                            <span className="block text-[9px] leading-tight text-stone-400">{g.desc}</span>
                          </span>
                          <span className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-[11px] font-black tabular-nums text-emerald-700">
                            <GemIcon size={11} /> {g.price}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-stone-400">
                    食材下锅做饭 · 建材升级设施 · 妖丹可在仓库出售换金
                  </p>
                </div>

                {/* 法宝铺（V1.1 道具实装：缚妖网 / 聚宝符；妖王诱引香在上方灵石区） */}
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="text-xs font-black text-[#2D5A3D]">🧿 法宝铺</p>
                    <p className="text-[9px] text-stone-400">关键时刻的神器，存仓库随时取用</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: CAPTURE_NET.id,
                          icon: '🕸️',
                          name: CAPTURE_NET.name,
                          desc: CAPTURE_NET.desc,
                          price: CAPTURE_NET.price,
                          held: materials[CAPTURE_NET.id] ?? 0,
                          hint: '入夜后捕捉面板点击张网',
                        },
                        {
                          id: HASTE_TALISMAN.id,
                          icon: '🧿',
                          name: HASTE_TALISMAN.name,
                          desc: HASTE_TALISMAN.desc,
                          price: HASTE_TALISMAN.price,
                          held: materials[HASTE_TALISMAN.id] ?? 0,
                          hint: '可在仓库法宝页直接激活',
                        },
                      ] as const
                    ).map((it) => {
                      const affordable = gems >= it.price
                      return (
                        <div
                          key={it.id}
                          className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[#7BA05B]/50 bg-gradient-to-b from-white/95 to-[#F2F7EC] p-2.5 shadow-sm"
                        >
                          <span className="text-2xl" aria-hidden>
                            {it.icon}
                          </span>
                          <span className="text-[11px] font-black text-stone-800">{it.name}</span>
                          <span className="text-center text-[9px] leading-tight text-stone-500">{it.desc}</span>
                          <span className="text-[9px] font-bold tabular-nums text-stone-400">
                            已持有 {it.held}
                          </span>
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => handleBuyMaterial(it.id, it.price, 'gems')}
                            className={cn(
                              'mt-0.5 flex h-8 w-full items-center justify-center gap-1 rounded-xl text-[12px] font-black transition active:scale-95',
                              affordable
                                ? 'bg-gradient-to-b from-[#7BA05B] to-[#5D8A43] text-white shadow-md shadow-emerald-800/20'
                                : 'cursor-not-allowed bg-stone-200 text-stone-400'
                            )}
                          >
                            <GemIcon size={12} /> {it.price}
                          </button>
                          <span className="text-[8px] leading-tight text-stone-400">{it.hint}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-stone-400">
                    🕸️ 缚妖网本场夜战收服 +{Math.round(CAPTURE_NET.bonus * 100)}% · 🧿 聚宝符可叠加顺延
                  </p>
                </div>
              </div>
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>

      {/* 招募结果 */}
      <RecruitResultDialog
        open={resultOpen}
        onOpenChange={setResultOpen}
        results={resultIds}
        newIds={newIds}
        onContinue={canContinue ? handleContinue : undefined}
      />

      {/* 广告免费高级招募 */}
      <AdDialog
        scene="advanced-recruit"
        open={adOpen}
        onOpenChange={setAdOpen}
        onReward={handleAdReward}
      />
    </>
  )
}
