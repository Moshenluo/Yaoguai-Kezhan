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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { ConfigIcon, GemIcon, GradeTag, StarBadge, YaoAvatar, YaoFigure } from '@/components/game/shared'
import { ElementBadge, ElementChip } from '@/components/game/ElementBadge'
import { StaminaBar, StaminaTierChip } from '@/components/game/StaminaBadge'
import { AdDialog } from '@/components/game/AdDialog'
import { STAR_UP_COST, useGameStore } from '@/game/store'
import { sfx } from '@/game/audio'
import {
  ELEMENTS,
  ELEMENT_STONE_MAX_LEVEL,
  EXP_POTIONS,
  LEVEL_BONUS,
  MATERIALS_MAP,
  MAX_STAR,
  JOB_STAMINA_COST,
  SKILL_LEVEL_BONUS,
  SKILL_MAX_LEVEL,
  STAMINA_POTIONS,
  expToNext,
  levelCapForStar,
  skillLevelCapForStar,
  skillUpCost,
  stoneIdFor,
  stoneUpCost,
  starBattleMultiplier,
  staminaRegenRate,
  staminaTier,
  yaoguaiPower,
} from '@/game/config'
import { YAOGUAI_MAP } from '@/game/yaoguai'
import type { Element, Grade, OwnedYaoguai, PotionStock, YaoguaiDef } from '@/game/types'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export interface YaokuiPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FilterTab = 'all' | Grade

const GRADE_ORDER: Record<Grade, number> = { legend: 0, rare: 1, normal: 2 }

function notify(message: string) {
  const t = toast({ title: message })
  window.setTimeout(() => t.dismiss(), 2400)
}

/**
 * 妖库面板 —— 妖怪收藏管理（升星 / 打工上阵）
 */
export function YaokuiPanel({ open, onOpenChange }: YaokuiPanelProps) {
  const owned = useGameStore((s) => s.owned)
  const workerLimit = useGameStore((s) => s.workerLimit())
  const potions = useGameStore((s) => s.potions)
  const autoRotate = useGameStore((s) => s.autoRotate === true)
  const [tab, setTab] = useState<FilterTab>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  // 喂药升级脉冲计数（每次升级 +1，驱动详情区金色 flash 重放）
  const [feedPulse, setFeedPulse] = useState(0)
  // 体力广告恢复弹窗
  const [adOpen, setAdOpen] = useState(false)

  const deployedCount = useMemo(
    () => Object.values(owned).filter((o) => o.deployed).length,
    [owned]
  )

  const entries = useMemo(
    () =>
      Object.entries(owned)
        .filter(([id]) => YAOGUAI_MAP[id])
        .sort((a, b) => {
          const ga = GRADE_ORDER[YAOGUAI_MAP[a[0]].grade]
          const gb = GRADE_ORDER[YAOGUAI_MAP[b[0]].grade]
          if (ga !== gb) return ga - gb
          if (b[1].star !== a[1].star) return b[1].star - a[1].star
          return YAOGUAI_MAP[b[0]].atk - YAOGUAI_MAP[a[0]].atk
        }),
    [owned]
  )

  const filtered = useMemo(
    () => (tab === 'all' ? entries : entries.filter(([id]) => YAOGUAI_MAP[id].grade === tab)),
    [entries, tab]
  )

  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: entries.length, normal: 0, rare: 0, legend: 0 }
    for (const [id] of entries) c[YAOGUAI_MAP[id].grade] += 1
    return c
  }, [entries])

  // 平均等级（顶部汇总）
  const avgLevel = useMemo(
    () => (entries.length === 0 ? 0 : entries.reduce((sum, [, o]) => sum + o.level, 0) / entries.length),
    [entries]
  )

  // 平均体力（顶部汇总；?? 100 兑底防脏档）
  const avgStamina = useMemo(
    () =>
      entries.length === 0
        ? 0
        : entries.reduce((sum, [, o]) => sum + (o.stamina ?? 100), 0) / entries.length,
    [entries]
  )

  const detailDef: YaoguaiDef | null = detailId ? (YAOGUAI_MAP[detailId] ?? null) : null
  const detailOwned: OwnedYaoguai | undefined = detailId ? owned[detailId] : undefined
  // 一键补充可用：存在体力不足的妖怪且小/中瓶有库存（大瓶灵石货不自动消耗）
  const spStock = useGameStore((s) => s.staminaPotions ?? { small: 0, medium: 0, large: 0 })
  const oneClickReady =
    entries.some(([, o]) => (o.stamina ?? 100) < 100) &&
    ((spStock.small ?? 0) > 0 || (spStock.medium ?? 0) > 0)

  const handleStarUp = (id: string) => {
    const res = useGameStore.getState().starUp(id)
    notify(res.message)
    if (res.ok) {
      sfx.play('levelup')
      setFlashId(id)
      window.setTimeout(() => setFlashId((v) => (v === id ? null : v)), 1100)
    }
  }

  const handleFeed = (id: string, size: 'small' | 'medium' | 'large') => {
    const res = useGameStore.getState().feedPotion(id, size)
    notify(res.message)
    if (res.ok) {
      const leveled = (res.levels ?? 0) > 0
      sfx.play(leveled ? 'levelup' : 'click')
      if (leveled) {
        setFeedPulse((n) => n + 1)
        setFlashId(id)
        window.setTimeout(() => setFlashId((v) => (v === id ? null : v)), 1100)
      }
    }
  }

  const handleToggleDeploy = (id: string) => {
    const res = useGameStore.getState().toggleDeploy(id)
    if (res.ok) sfx.play('click')
    notify(res.message)
  }

  const handleUpgradeStone = (el: Element) => {
    const res = useGameStore.getState().upgradeElementStone(el)
    notify(res.message)
    if (res.ok) sfx.play('claim')
  }

  /** 技能精进（V1.3 妖丹消耗）：成功播升级音效；素材不足时按钮置灰但可点击，由 store 返回精确缺口文案 */
  const handleUpgradeSkill = (id: string) => {
    const res = useGameStore.getState().upgradeSkill(id)
    if (res.ok) sfx.play('upgrade')
    else sfx.play('click')
    notify(res.message)
  }

  const handleUseStaminaPotion = (id: string | null, size: 'small' | 'medium' | 'large') => {
    const res = useGameStore.getState().useStaminaPotion(id, size)
    notify(res.message)
    if (res.ok) sfx.play('claim')
  }

  const handleAutoRotate = (on: boolean) => {
    useGameStore.getState().setAutoRotate(on)
    sfx.play('click')
    notify(on ? '自动轮换已开启：体力不足将自动休息换补' : '自动轮换已关闭')
  }

  /** 一键补充体力（V1.1）：智能消耗气力散补齐体力不足的妖怪 */
  const handleOneClickRecover = () => {
    const res = useGameStore.getState().oneClickStaminaRecover()
    notify(res.message)
    if (res.ok) sfx.play('claim')
    else sfx.play('click')
  }

  /** 广告恢复：全体体力 +50% */
  const handleAdReward = () => {
    const res = useGameStore.getState().recoverStaminaByAd()
    notify(res.message)
    if (res.ok) sfx.play('claim')
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="panel-sheet mx-auto h-[78vh] max-h-[78vh] max-w-[480px] rounded-t-[28px]">
          <DrawerHeader className="pb-1">
            <DrawerTitle className="panel-title text-center text-xl">
              妖 库
            </DrawerTitle>
            <DrawerDescription className="sr-only">管理收藏的妖怪，升星强化与安排白天打工</DrawerDescription>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center justify-center gap-1 text-[11px] text-stone-600">
                上岗
                <b className="text-[#8B2E24]">{deployedCount}</b>
                <span>/ 上限 {workerLimit}</span>
                <span className="ml-1 text-[10px] text-stone-400">（升级客房解锁更多）</span>
              </div>
              {/* 双线养成汇总：平均等级 + 药水库存 */}
              <div className="flex items-center justify-center gap-2 text-[11px] tabular-nums text-stone-600">
                <span>
                  均级 <b className="text-emerald-600">{avgLevel.toFixed(1)}</b>
                </span>
                <span className="text-[#D4A574]">·</span>
                <span className="inline-flex items-center gap-1">
                  <ConfigIcon icon="/images/ui/potion-exp-small.png" size={14} />
                  <b className="text-stone-700">{potions.small}</b>
                  <ConfigIcon icon="/images/ui/potion-exp-medium.png" size={14} />
                  <b className="text-stone-700">{potions.medium}</b>
                  <ConfigIcon icon="/images/ui/potion-exp-large.png" size={14} />
                  <b className="text-stone-700">{potions.large}</b>
                </span>
              </div>
              {/* 体力与轮换汇总：平均体力 + 广告恢复 + 自动轮换开关 */}
              <div className="flex w-full items-center justify-center gap-2 text-[11px] tabular-nums text-stone-600">
                <span>
                  均体 <b className="text-[#B9770E]">{Math.round(avgStamina)}</b>
                </span>
                <span className="text-[#D4A574]">·</span>
                <button
                  type="button"
                  onClick={handleOneClickRecover}
                  aria-label="一键补充体力（智能消耗气力散）"
                  title="智能消耗小/中瓶气力散：缺口≤30用小瓶、>30用中瓶，按体力从低到高补齐"
                  className={cn(
                    'flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] font-black shadow-sm transition-transform active:scale-95',
                    oneClickReady
                      ? 'border-[#8B2E24]/60 bg-emerald-50 text-[#8B2E24]'
                      : 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                  )}
                >
                  一键补充
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('click')
                    setAdOpen(true)
                  }}
                  className="flex h-8 items-center gap-1 rounded-full border border-[#E8B84B]/80 bg-amber-50 px-2.5 text-[10px] font-black text-[#8A5A1E] shadow-sm transition-transform active:scale-95"
                >
                  广告恢复
                </button>
              </div>
              <div className="flex w-full items-center justify-center gap-1.5">
                <label className="flex h-9 cursor-pointer items-center gap-1.5 text-[11px] font-bold text-stone-600">
                  <Switch checked={autoRotate} onCheckedChange={handleAutoRotate} aria-label="自动轮换开关" />
                  自动轮换
                </label>
                <span className="text-[9px] text-stone-400">体力&lt;20 自动休息换补</span>
              </div>
            </div>
            <div className="mx-auto mt-1 h-px w-4/5 bg-gradient-to-r from-transparent via-[#D4A574] to-transparent" />
          </DrawerHeader>

          <div className="px-4 pb-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
              <TabsList className="h-10 w-full justify-between rounded-xl border border-[#D4A574]/50 bg-white/70 p-1">
                <TabsTrigger
                  value="all"
                  className="rounded-lg text-xs data-[state=active]:bg-[#8B2E24] data-[state=active]:text-[#E6DCC8]"
                >
                  全部 {counts.all}
                </TabsTrigger>
                <TabsTrigger
                  value="normal"
                  className="rounded-lg text-xs data-[state=active]:bg-[#8B2E24] data-[state=active]:text-[#E6DCC8]"
                >
                  普通小妖 {counts.normal}
                </TabsTrigger>
                <TabsTrigger
                  value="rare"
                  className="rounded-lg text-xs data-[state=active]:bg-[#8B2E24] data-[state=active]:text-[#E6DCC8]"
                >
                  稀有精怪 {counts.rare}
                </TabsTrigger>
                <TabsTrigger
                  value="legend"
                  className="rounded-lg text-xs data-[state=active]:bg-[#8B2E24] data-[state=active]:text-[#E6DCC8]"
                >
                  传说 {counts.legend}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div
            data-vaul-no-drag
            className="mx-3 mb-3 flex min-h-0 flex-1 rounded-2xl border border-[#D4A574]/40 bg-white/50 p-1"
          >
            <ScrollArea className="h-full w-full">
              {filtered.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-stone-400">
                  <ConfigIcon icon="/images/ui/region-1.png" size={36} />
                  <p className="text-xs">这里还空空如也，去商店招募或夜间捉妖吧</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 p-1.5">
                  {filtered.map(([id, o]) => {
                    const def = YAOGUAI_MAP[id]
                    const upgradable = o.star < MAX_STAR && o.count >= (STAR_UP_COST[o.star + 1] ?? Infinity)
                    const cap = levelCapForStar(o.star)
                    const maxed = o.level >= cap
                    const need = maxed ? 0 : expToNext(o.level)
                    const expPct = maxed ? 100 : Math.min(100, (o.exp / Math.max(need, 1)) * 100)
                    const power = yaoguaiPower(def, o.star, o.level)
                    // 技能等级（老档缺省视为 1；>1 时卡片右上偏下加金底角标）
                    const skillLv = o.skillLevel ?? 1
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setDetailId(id)}
                        className="relative flex min-h-[150px] flex-col items-center gap-1 rounded-2xl border border-[#D4A574]/50 bg-white/80 p-2 shadow-sm transition-transform active:scale-95"
                      >
                        {o.deployed && (
                          <span className="absolute left-1 top-1 z-10 rounded-full bg-[#8B2E24] px-1.5 py-px text-[9px] font-bold text-[#E6DCC8] shadow">
                            打工中
                          </span>
                        )}
                        {/* 虚脱角标（右上，与左上「打工中」错开；z-11 盖住升可升星红点，体力优先感知；<0.01 容差覆盖休息妖秒级恢复的浮点漂移，与 DayScreen 横幅同约定） */}
                        {(o.stamina ?? 100) < 0.01 && (
                          <span
                            title="体力虚脱：无法打工与上阵，休息或用药水恢复"
                            aria-label="体力虚脱"
                            className="absolute right-1 top-1 z-[11] rounded-full border border-[#6B4E8E] bg-[#EAE2F3] px-1 py-px text-[10px] leading-tight shadow"
                          >
                            <ConfigIcon icon="/images/ui/stamina-collapse.png" size={12} />
                          </span>
                        )}
                        {/* 技能精进角标（右上偏下，与虚脱角标/升星红点垂直错开；金底白字，Lv.1 不显示不占位） */}
                        {skillLv > 1 && (
                          <span
                            title={`技能精进 Lv.${skillLv}：效果 +${Math.round((skillLv - 1) * SKILL_LEVEL_BONUS * 100)}%`}
                            aria-label={`技能精进等级 ${skillLv}`}
                            className="absolute right-1 top-7 z-[11] rounded-full bg-gradient-to-r from-[#E8B84B] to-[#D4933D] px-1 py-px text-[9px] font-black tabular-nums leading-tight text-white shadow"
                          >
                            ✨{skillLv}
                          </span>
                        )}
                        {upgradable && (
                          <span className="absolute right-1.5 top-1.5 z-10 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-red-500" />
                        )}
                        <div className="pt-1">
                          <YaoAvatar id={id} size={64} />
                        </div>
                        {/* 名字 + 属性徽章 */}
                        <span className="flex w-full items-center justify-center gap-1 px-1">
                          <span className="max-w-full truncate text-xs font-bold text-stone-800">{def.name}</span>
                          <ElementBadge element={def.element} size="sm" hideNone />
                        </span>
                        {/* 星级 + 等级徽章并列 */}
                        <div className="flex items-center gap-1">
                          <StarBadge star={o.star} size="sm" />
                          <span
                            className={cn(
                              'rounded-full px-1 py-px text-[8px] font-black tabular-nums leading-tight',
                              o.level > 1
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-stone-100 text-stone-400'
                            )}
                          >
                            Lv.{o.level}
                          </span>
                        </div>
                        {/* 经验条 */}
                        <div className="w-4/5">
                          <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200/90">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-300',
                                maxed ? 'bg-amber-400' : 'bg-emerald-500'
                              )}
                              style={{ width: `${expPct}%` }}
                            />
                          </div>
                          <div className="mt-px text-center text-[8px] leading-[10px] tabular-nums text-stone-400">
                            {maxed ? (
                              <span className="font-black text-amber-500">MAX</span>
                            ) : (
                              <span>
                                {o.exp}/{need}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* 体力条（五档配色：充沛绿/正常青/疲惫琥珀/力竭红/虚脱灰紫） */}
                        <div className="w-4/5">
                          <StaminaBar value={o.stamina ?? 100} size="xs" showText />
                        </div>
                        {/* 战力估值 + 持有 */}
                        <span className="text-[9px] tabular-nums text-stone-500">
                          ⚔️ 战力 <b className="text-stone-700">{power}</b>
                          <span className="mx-0.5 text-stone-300">·</span>持有 {o.count}
                        </span>
                        <AnimatePresence>
                          {flashId === id && (
                            <motion.div
                              key="starup-flash"
                              className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#E8B84B]"
                              style={{
                                background:
                                  'radial-gradient(circle, rgba(232,184,75,0.55) 0%, rgba(232,184,75,0) 72%)',
                              }}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1.12, 1.04, 1] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 1, times: [0, 0.3, 0.7, 1] }}
                            />
                          )}
                        </AnimatePresence>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DrawerContent>
      </Drawer>

      {/* 妖怪详情 */}
      <Dialog
        open={detailId !== null && detailDef !== null}
        onOpenChange={(o) => {
          if (!o) setDetailId(null)
        }}
      >
        <DialogContent className="max-h-[86vh] max-w-[400px] overflow-y-auto rounded-3xl border-2 ui-paper p-5">
          {detailDef && detailOwned && <YaoDetail
            def={detailDef}
            o={detailOwned}
            potions={potions}
            feedPulse={feedPulse}
            deployedCount={deployedCount}
            workerLimit={workerLimit}
            onStarUp={handleStarUp}
            onFeed={handleFeed}
            onToggleDeploy={handleToggleDeploy}
            onUpgradeStone={handleUpgradeStone}
            onUpgradeSkill={handleUpgradeSkill}
            onUseStaminaPotion={handleUseStaminaPotion}
          />}
          {detailDef && !detailOwned && (
            <p className="py-8 text-center text-sm text-stone-400">该妖怪数据缺失</p>
          )}
        </DialogContent>
      </Dialog>

      {/* 体力广告恢复（全体 +50%） */}
      <AdDialog
        scene="stamina-recover"
        open={adOpen}
        onOpenChange={setAdOpen}
        onReward={handleAdReward}
      />
    </>
  )
}

/** 妖怪详情内容（Dialog 内） */
function YaoDetail({
  def,
  o,
  potions,
  feedPulse,
  deployedCount,
  workerLimit,
  onStarUp,
  onFeed,
  onToggleDeploy,
  onUpgradeStone,
  onUpgradeSkill,
  onUseStaminaPotion,
}: {
  def: YaoguaiDef
  o: OwnedYaoguai
  potions: PotionStock
  /** 喂药升级脉冲（每次升级 +1，触发金色 flash 重放） */
  feedPulse: number
  deployedCount: number
  workerLimit: number
  onStarUp: (id: string) => void
  onFeed: (id: string, size: 'small' | 'medium' | 'large') => void
  onToggleDeploy: (id: string) => void
  onUpgradeStone: (el: Element) => void
  onUpgradeSkill: (id: string) => void
  onUseStaminaPotion: (id: string | null, size: 'small' | 'medium' | 'large') => void
}) {
  // 属性石强化所需状态（元素线）
  const elementBoost = useGameStore((s) => s.elementBoost)
  const materials = useGameStore((s) => s.materials)
  const gems = useGameStore((s) => s.gems ?? 0)
  // 技能精进消耗行所需货币（?? 0 兜底防脏档，历史崩溃教训）
  const gold = useGameStore((s) => s.gold ?? 0)
  // 体力与轮换所需状态（体力线）
  const staminaPotions = useGameStore((s) => s.staminaPotions ?? { small: 0, medium: 0, large: 0 })
  const guestRoom = useGameStore((s) => s.facilities?.guestRoom ?? 0)
  const cookingUntil = useGameStore((s) => s.cooking?.until ?? 0)
  // 是否存在未满体力的妖怪（大瓶全体药水按钮禁用判定）
  const anyStaminaLow = useGameStore((s) =>
    Object.values(s.owned).some((oo) => (oo.stamina ?? 100) < 100)
  )

  const mult = starBattleMultiplier(o.star)
  const atMax = o.star >= MAX_STAR
  const cost = atMax ? 0 : (STAR_UP_COST[o.star + 1] ?? 0)
  const canUp = !atMax && o.count >= cost
  const lack = Math.max(0, cost - o.count)
  const slotsFull = !o.deployed && deployedCount >= workerLimit

  // ---- 升级（经验线） ----
  const cap = levelCapForStar(o.star)
  const maxed = o.level >= cap
  const need = maxed ? 0 : expToNext(o.level)
  const expPct = maxed ? 100 : Math.min(100, (o.exp / Math.max(need, 1)) * 100)
  const power = yaoguaiPower(def, o.star, o.level)
  const lvlAtkMult = 1 + (o.level - 1) * LEVEL_BONUS.atk
  const lvlHpMult = 1 + (o.level - 1) * LEVEL_BONUS.hp
  const lvlAtkPct = Math.round((o.level - 1) * LEVEL_BONUS.atk * 100)
  const lvlHpPct = Math.round((o.level - 1) * LEVEL_BONUS.hp * 100)

  // ---- 属性石强化（元素线） ----
  const detailElement = def.element
  const stoneLv = detailElement ? (elementBoost[detailElement] ?? 0) : 0
  const stoneMaxed = stoneLv >= ELEMENT_STONE_MAX_LEVEL
  const stoneCost = detailElement && !stoneMaxed ? stoneUpCost(stoneLv) : { gems: 0, stones: 0 }
  const stoneMat = detailElement ? MATERIALS_MAP[stoneIdFor(detailElement)] : undefined
  const stoneStock = detailElement ? (materials[stoneIdFor(detailElement)] ?? 0) : 0
  const gemsOk = gems >= stoneCost.gems
  const stonesOk = stoneStock >= stoneCost.stones
  const canUpStone = detailElement != null && !stoneMaxed && gemsOk && stonesOk

  // ---- 体力状态（体力与轮换线） ----
  const stamina = o.stamina ?? 100
  const stTier = staminaTier(stamina)
  // 满体力判定取整后比较：打工妖每秒微量消耗（如 99.95）显示 ⚡100，按钮禁用需与显示一致
  const stMaxed = Math.round(stamina) >= 100
  // 打工按定位差异化消耗；休息按客房+灶火加成恢复
  const jobCost = JOB_STAMINA_COST[def.nightRole] ?? 6
  const cookingActive = cookingUntil > Date.now()
  const regen = staminaRegenRate(guestRoom, cookingActive)
  // 恢复速率固定显示一位小数（如 15.4/时）
  const regenText = regen.toFixed(1)

  // ---- 技能精进（V1.3 技能升级线：妖丹消耗，每级技能效果 +15%） ----
  // 老档 skillLevel 缺省视为 1；上限受星级约束（min(5, 星级+1)），封顶需先升星
  const skillLevel = o.skillLevel ?? 1
  const skillMaxed = skillLevel >= SKILL_MAX_LEVEL
  const skillCap = skillLevelCapForStar(o.star)
  const starCapped = skillLevel >= skillCap
  const skillBonusPct = Math.round((skillLevel - 1) * SKILL_LEVEL_BONUS * 100)
  const nextSkillCost = skillMaxed ? null : skillUpCost(skillLevel + 1)
  // 素材持有量全部 ?? 0 兜底；图标同源取自 MATERIALS_MAP（妖丹💊 / 稀有妖丹🔴）
  const pillNormalStock = materials['pill-normal'] ?? 0
  const pillRareStock = materials['pill-rare'] ?? 0
  const pillNormalIcon = MATERIALS_MAP['pill-normal']?.icon ?? '/images/ui/mat-pill-normal.png'
  const pillRareIcon = MATERIALS_MAP['pill-rare']?.icon ?? '/images/ui/mat-pill-rare.png'
  const skillGoldOk = gold >= (nextSkillCost?.gold ?? 0)
  const skillGemsOk = gems >= (nextSkillCost?.gems ?? 0)
  const skillPillOk = pillNormalStock >= (nextSkillCost?.pillNormal ?? 0)
  const skillPillRareOk = pillRareStock >= (nextSkillCost?.pillRare ?? 0)
  const canUpSkill =
    !skillMaxed &&
    !starCapped &&
    nextSkillCost != null &&
    skillGoldOk &&
    skillGemsOk &&
    skillPillOk &&
    skillPillRareOk

  const stats = [
    { icon: '/images/ui/stat-atk.png', label: '攻击', value: Math.round(def.atk * mult * lvlAtkMult).toString() },
    { icon: '/images/ui/stat-hp.png', label: '生命', value: Math.round(def.hp * mult * lvlHpMult).toString() },
    { icon: '/images/ui/stat-as.png', label: '攻速', value: `${def.attackSpeed}/秒` },
    { icon: '/images/ui/stat-range.png', label: '射程', value: `${def.range}格` },
  ]

  return (
    <div className="flex flex-col gap-3">
      <DialogHeader className="items-center space-y-1">
        <DialogTitle className="flex items-center gap-2 text-lg font-black text-[#8B2E24]">
          {def.name}
          <span className="text-xs font-normal text-stone-400">{def.pinyin}</span>
        </DialogTitle>
        <DialogDescription asChild>
          <span className="flex items-center gap-2">
            <GradeTag grade={def.grade} />
            <StarBadge star={o.star} size="md" />
            <motion.span
              key={`lv-${o.level}`}
              initial={{ scale: 1.45 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 12 }}
              className={cn(
                'rounded-full px-1.5 py-px text-[10px] font-black tabular-nums leading-tight',
                o.level > 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'
              )}
            >
              Lv.{o.level}
            </motion.span>
            <span className="text-[10px] text-stone-400">持有 {o.count} 只</span>
          </span>
        </DialogDescription>
      </DialogHeader>

      {/* 星铁式大立绘展示台：整身立绘 + 宣纸展台 + 顶部天光 */}
      <div className="relative flex items-end justify-center overflow-hidden rounded-2xl border border-[#5C3A24]/30 bg-gradient-to-b from-[#FBF3DE] via-[#F0E2C2] to-[#E3CFA6] py-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/55 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-3 w-3/5 -translate-x-1/2 rounded-full bg-[#5C3A24]/15 blur-[3px]" aria-hidden />
        <YaoFigure id={def.id} size={200} />
      </div>

      {/* 出处 · 古风引文 */}
      <div className="rounded-xl bg-stone-800/90 px-3 py-2.5 text-center">
        <p className="text-[11px] tracking-[0.2em] text-amber-100/90">「 {def.origin} 」</p>
        <p className="mt-1 text-[11px] leading-relaxed text-stone-300">{def.form}</p>
      </div>

      {/* 属性行（五行 + 光暗克制） */}
      <div className="flex items-center justify-center gap-2">
        <span className="shrink-0 text-[10px] font-bold text-stone-400">属性</span>
        {detailElement ? (
          <ElementChip element={detailElement} />
        ) : (
          <span className="text-[11px] text-stone-400">无属性 · 不受五行克制影响</span>
        )}
      </div>

      {/* 体力状态区块（体力与轮换线：档位/条/动态消耗恢复/药水） */}
      <div
        className="rounded-2xl border p-3"
        style={{ borderColor: `${stTier.color}55`, background: `${stTier.bg}80` }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-black text-stone-700">⚡ 体力状态</span>
          <span className="text-[10px] tabular-nums text-stone-500">
            {stMaxed ? '体力已满' : `${stTier.name}（${stTier.min}-${stTier.max} 区间）`}
          </span>
        </div>
        {/* 档位横条：icon + 档位名 + 数值 + 效果 desc */}
        <div className="mb-2 flex justify-center">
          <StaminaTierChip value={stamina} />
        </div>
        <StaminaBar value={stamina} size="md" showText />
        {/* 动态状态行：打工消耗（定位差异）/ 休息恢复（客房加成） */}
        <p className="mt-2 text-center text-[11px] font-bold text-stone-600">
          {o.deployed
            ? `🛖 打工中 · 消耗体力 ${jobCost}/时（${def.nightRoleName}定位）`
            : `😴 休息中 · 恢复体力 +${regenText}/时（客房 Lv.${guestRoom} 加成${cookingActive ? ' · 灶火增益中' : ''}）`}
        </p>
        {/* 体力药水（小瓶/中瓶单只；大瓶全体） */}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {STAMINA_POTIONS.filter((p) => p.target === 'single').map((p) => {
            const stock = staminaPotions[p.id] ?? 0
            const disabled = stMaxed || stock <= 0
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                aria-label={`使用${p.name}（库存${stock}）`}
                onClick={() => onUseStaminaPotion(def.id, p.id)}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border py-1.5 transition-transform active:scale-95',
                  disabled
                    ? 'cursor-not-allowed border-stone-200 bg-stone-100/70 text-stone-300'
                    : 'border-[#D4A574]/60 bg-white/90 text-stone-700 shadow-sm'
                )}
              >
                <span className={cn('leading-none', disabled && 'grayscale')} aria-hidden>
                  <ConfigIcon icon={p.icon} size={20} />
                </span>
                <span className="text-[10px] font-bold">体力 +{p.value}</span>
                <span
                  className={cn(
                    'text-[9px] font-black tabular-nums',
                    disabled ? 'text-stone-300' : stock > 0 ? 'text-[#B9770E]' : 'text-stone-400'
                  )}
                >
                  ×{stock}
                </span>
              </button>
            )
          })}
        </div>
        {/* 大瓶回元丹：全体恢复（体力线补充入口，库存/全体满体力时禁用） */}
        {(() => {
          const p = STAMINA_POTIONS.find((sp) => sp.target === 'all')
          if (!p) return null
          const stock = staminaPotions[p.id] ?? 0
          const disabled = !anyStaminaLow || stock <= 0
          return (
            <button
              type="button"
              disabled={disabled}
              aria-label={`使用${p.name}（库存${stock}）`}
              onClick={() => onUseStaminaPotion(null, p.id)}
              className={cn(
                'mt-1.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-black transition-transform active:scale-95',
                disabled
                  ? 'cursor-not-allowed border-stone-200 bg-stone-100/70 text-stone-300'
                  : 'border-[#D4A574]/60 bg-white/90 text-stone-700 shadow-sm'
              )}
            >
              <span aria-hidden className={cn(disabled && 'grayscale')}>
                <ConfigIcon icon={p.icon} size={16} />
              </span>
              <span>{p.name} · 全体 +{p.value}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[9px] font-black tabular-nums',
                  disabled ? 'bg-stone-200 text-stone-400' : 'bg-amber-100 text-[#8A5A1E]'
                )}
              >
                ×{stock}
              </span>
            </button>
          )
        })()}
      </div>

      {/* 白天 / 夜晚 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-2.5">
          <p className="flex items-center gap-1 text-[10px] font-black text-amber-700">
            <ConfigIcon icon="/images/ui/ui-sun.png" size={12} />
            白天 · {def.dayJobName}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-600">{def.dayBuff}</p>
        </div>
        <div className="rounded-2xl border border-[#8B2E24]/30 bg-[#8B2E24]/5 p-2.5">
          <p className="flex items-center gap-1 text-[10px] font-black text-[#8B2E24]">
            <ConfigIcon icon="/images/ui/status-moon.png" size={12} />
            夜晚 · {def.nightRoleName}
          </p>
          <p className="mt-1 text-[11px] font-bold text-stone-700">「{def.skillName}」</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">{def.skillDesc}</p>
          {/* 技能精进联动提示（数据同源；Lv.1 不透出避免 +0% 噪音，与卡片角标显隐同约定） */}
          {skillLevel > 1 && (
            <p className="mt-0.5 text-[10px] font-black tabular-nums text-[#C9922A]">
              ✨ 技能精进 Lv.{skillLevel}：效果 +{skillBonusPct}%
            </p>
          )}
        </div>
      </div>

      {/* 战斗四维 */}
      <div>
        <div className="grid grid-cols-4 gap-1.5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-[#D4A574]/50 bg-white/80 py-2"
            >
              <ConfigIcon icon={s.icon} size={18} />
              <span className="text-[9px] text-stone-400">{s.label}</span>
              <span className="text-xs font-black tabular-nums text-stone-800">{s.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-center text-[9px] tabular-nums text-stone-400">
          星级 ×{mult.toFixed(2)} · 等级 攻+{lvlAtkPct}% / 生命+{lvlHpPct}% · 综合战力{' '}
          <b className="text-[#C9922A]">{power}</b>
        </p>
      </div>

      {/* 喂养升级区块（经验线） */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-600/25 bg-emerald-50/60 p-3">
        <AnimatePresence>
          {feedPulse > 0 && (
            <motion.div
              key={`feed-flash-${feedPulse}`}
              className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#E8B84B]"
              style={{
                background:
                  'radial-gradient(circle, rgba(232,184,75,0.5) 0%, rgba(232,184,75,0) 72%)',
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1.08, 1.02, 1] }}
              transition={{ duration: 1, times: [0, 0.3, 0.7, 1] }}
            />
          )}
        </AnimatePresence>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-black text-stone-700">⚗️ 喂养升级</span>
          {maxed ? (
            <span className="text-[10px] font-black text-amber-600">已满级 · 升星解锁</span>
          ) : (
            <span className="text-[10px] tabular-nums text-stone-500">
              上限 Lv.{cap}（{o.star}★）
            </span>
          )}
        </div>
        {/* 等级 + 经验条 */}
        <div className="mb-2.5 flex items-center gap-2">
          <motion.span
            key={`feed-lv-${o.level}`}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 12 }}
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-black tabular-nums leading-none',
              o.level > 1
                ? 'bg-emerald-600 text-emerald-50 shadow-md shadow-emerald-600/30'
                : 'bg-stone-200 text-stone-400'
            )}
          >
            Lv.{o.level}
          </motion.span>
          <div className="min-w-0 flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/80">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  maxed
                    ? 'bg-gradient-to-r from-amber-300 to-amber-500'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                )}
                style={{ width: `${expPct}%` }}
              />
            </div>
            <div className="mt-0.5 text-right text-[9px] leading-none tabular-nums text-stone-400">
              {maxed ? (
                <span className="font-black text-amber-500">MAX</span>
              ) : (
                <span>
                  {o.exp} / {need}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* 三种经验药水 */}
        <div className="grid grid-cols-3 gap-1.5">
          {EXP_POTIONS.map((p) => {
            const stock = potions[p.id] ?? 0
            const disabled = maxed || stock <= 0
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                aria-label={`喂养${p.name}（库存${stock}）`}
                onClick={() => onFeed(def.id, p.id)}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border py-1.5 transition-transform active:scale-95',
                  disabled
                    ? 'cursor-not-allowed border-stone-200 bg-stone-100/70 text-stone-300'
                    : 'border-emerald-600/30 bg-white/90 text-stone-700 shadow-sm hover:border-emerald-500/60'
                )}
              >
                <span className={cn('leading-none', disabled && 'grayscale')}>
                  <ConfigIcon icon={p.icon} size={20} />
                </span>
                <span className="text-[10px] font-bold tabular-nums">+{p.exp}经验</span>
                <span
                  className={cn(
                    'text-[9px] font-black tabular-nums',
                    disabled ? 'text-stone-300' : stock > 0 ? 'text-emerald-600' : 'text-stone-400'
                  )}
                >
                  ×{stock}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 属性石强化区块（元素线：克制伤害 +5%/级） */}
      {detailElement ? (
        <div
          className="rounded-2xl border p-3"
          style={{
            borderColor: `${ELEMENTS[detailElement].color}55`,
            background: `${ELEMENTS[detailElement].bg}80`,
          }}
        >
          <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-black text-stone-700">
              {stoneMat?.icon ? <ConfigIcon icon={stoneMat.icon} size={14} /> : null}
              属性石强化 · {ELEMENTS[detailElement].name}属性
            </span>
            {stoneMaxed ? (
              <span className="text-[10px] font-black text-amber-500">✨ 已满级 +25%</span>
            ) : (
              <span className="text-[10px] tabular-nums text-stone-500">
                {stoneLv} / {ELEMENT_STONE_MAX_LEVEL} 级
              </span>
            )}
          </div>
          {/* 强化等级刻度条 */}
          <div className="mb-1.5 flex items-center gap-1">
            {Array.from({ length: ELEMENT_STONE_MAX_LEVEL }, (_, i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: i < stoneLv ? ELEMENTS[detailElement].color : 'rgba(120,113,108,0.18)' }}
              />
            ))}
          </div>
          <p className="mb-2 text-[10px] leading-relaxed text-stone-500">
            {ELEMENTS[detailElement].name}属性克制敌方时伤害 +30%，每级再加成{' '}
            <b className="font-black" style={{ color: ELEMENTS[detailElement].color }}>
              +{stoneLv * 5}%
            </b>
            （克制伤害合计 +{30 + stoneLv * 5}%）
          </p>
          {stoneMaxed ? (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 py-2 text-center text-xs font-black text-amber-600">
              ✨ {stoneMat?.name}已强化至满级，克制伤害 +25%
            </div>
          ) : (
            <>
              <div className="mb-1.5 flex items-center justify-center gap-3 text-[11px] tabular-nums">
                <span className={cn('flex items-center gap-1', gemsOk ? 'text-stone-600' : 'font-bold text-red-500')}>
                  <GemIcon size={12} />
                  {stoneCost.gems}
                  {!gemsOk && <span className="text-[9px]">灵石不足</span>}
                </span>
                <span className={cn('flex items-center gap-1', stonesOk ? 'text-stone-600' : 'font-bold text-red-500')}>
                  {stoneMat?.icon ? <ConfigIcon icon={stoneMat.icon} size={14} /> : null}
                  {stoneCost.stones}
                  <span className="text-[9px] text-stone-400">库存 {stoneStock}</span>
                </span>
              </div>
              <button
                type="button"
                disabled={!canUpStone}
                onClick={() => onUpgradeStone(detailElement)}
                className={cn(
                  'h-10 w-full rounded-xl text-sm font-black transition-transform active:scale-95',
                  canUpStone
                    ? 'bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-white shadow-md shadow-amber-500/30'
                    : 'cursor-not-allowed bg-stone-200 text-stone-400'
                )}
              >
                {canUpStone
                  ? `强化至 ${stoneLv + 1} 级 · 克制伤害 +${(stoneLv + 1) * 5}%`
                  : gemsOk
                    ? '属性石不足'
                    : '灵石不足'}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-stone-100/60 p-3">
          <p className="text-center text-xs font-black text-stone-500">🔷 属性石强化</p>
          <p className="mt-1 text-center text-[10px] leading-relaxed text-stone-400">
            无属性妖怪无法强化属性石（好在也不受五行克制影响）
          </p>
        </div>
      )}

      {/* ✨ 技能精进区块（V1.3 技能升级线：妖丹消耗，每级技能效果 +15%）
          置于属性石强化之后、升星之前——技能上限受星级约束，紧邻升星形成「精进受阻 → 升星解锁」动线 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="rounded-2xl border border-[#E8B84B]/55 bg-[#FCF4E0]/80 p-3"
      >
        {/* 标题行：区块名 + 技能名 pill + 技能描述小字 */}
        <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-xs font-black text-stone-700">✨ 技能精进</span>
          <span className="rounded-full bg-[#E8B84B]/25 px-2 py-px text-[10px] font-black text-[#8A5A1E]">
            「{def.skillName}」
          </span>
          <span className="text-[10px] leading-tight text-stone-400">{def.skillDesc}</span>
        </div>
        {/* 五级刻度点：已达成金色实心+序号 / 未达成灰空心 / 当前级呼吸高亮 */}
        <div className="mb-1 flex items-center justify-center gap-2.5">
          {Array.from({ length: SKILL_MAX_LEVEL }, (_, i) => {
            const lv = i + 1
            const achieved = lv <= skillLevel
            const current = lv === skillLevel
            return (
              <motion.span
                key={lv}
                animate={current ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={
                  current ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
                }
                aria-label={`技能等级 ${lv}${achieved ? '，已达成' : '，未达成'}`}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black tabular-nums leading-none',
                  achieved
                    ? 'border-[#D4933D] bg-gradient-to-b from-[#F5D98B] to-[#E8B84B] text-white shadow-sm'
                    : 'border-stone-300 bg-white/70 text-stone-300'
                )}
              >
                {lv}
              </motion.span>
            )
          })}
        </div>
        {/* 当前等级与总效果（升级瞬间数字弹跳重放，与喂养 Lv 徽章同款动效） */}
        <motion.p
          key={`skill-lv-${skillLevel}`}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 12 }}
          className="mb-2 text-center text-[11px] font-black tabular-nums text-stone-700"
        >
          Lv.{skillLevel} · 效果 +{skillBonusPct}%
        </motion.p>
        {/* 消耗行：升到下一级的消耗（仅展示非零项，持有/需求并列，不足项标红） */}
        {nextSkillCost != null && !starCapped && (
          <div className="mb-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] tabular-nums">
            <span className={cn('flex items-center gap-1', skillGoldOk ? 'text-stone-600' : 'font-bold text-red-500')}>
              <span aria-hidden>💰</span>
              {nextSkillCost.gold}
              <span className="text-[9px] text-stone-400">持有 {gold}</span>
            </span>
            {nextSkillCost.pillNormal > 0 && (
              <span className={cn('flex items-center gap-1', skillPillOk ? 'text-stone-600' : 'font-bold text-red-500')}>
                <ConfigIcon icon={pillNormalIcon} size={14} />
                {nextSkillCost.pillNormal}
                <span className="text-[9px] text-stone-400">持有 {pillNormalStock}</span>
              </span>
            )}
            {nextSkillCost.pillRare > 0 && (
              <span
                className={cn('flex items-center gap-1', skillPillRareOk ? 'text-stone-600' : 'font-bold text-red-500')}
              >
                <ConfigIcon icon={pillRareIcon} size={14} />
                {nextSkillCost.pillRare}
                <span className="text-[9px] text-stone-400">持有 {pillRareStock}</span>
              </span>
            )}
            {nextSkillCost.gems > 0 && (
              <span className={cn('flex items-center gap-1', skillGemsOk ? 'text-stone-600' : 'font-bold text-red-500')}>
                <span aria-hidden>💎</span>
                {nextSkillCost.gems}
                <span className="text-[9px] text-stone-400">持有 {gems}</span>
              </span>
            )}
          </div>
        )}
        {/* 升级按钮四态：满级 / 星级封顶 / 素材不足（置灰可点击，toast 提示缺口）/ 可升级 */}
        {skillMaxed ? (
          <div className="flex h-11 w-full items-center justify-center rounded-xl border border-amber-300/60 bg-amber-50/80 text-sm font-black text-amber-600">
            ✨ 已至臻境（Lv.{SKILL_MAX_LEVEL}）
          </div>
        ) : starCapped ? (
          <div className="flex h-11 w-full items-center justify-center rounded-xl border border-stone-300/70 bg-stone-100/80 text-sm font-black text-stone-500">
            <span className="inline-flex items-center gap-1">
              <ConfigIcon icon="/images/ui/ui-star.png" size={14} />
              需先升星（{o.star}星上限 Lv.{skillCap}）
            </span>
          </div>
        ) : (
          <button
            type="button"
            aria-label={canUpSkill ? `技能精进至 Lv.${skillLevel + 1}` : '精进素材不足，点击查看缺少的物资'}
            onClick={() => onUpgradeSkill(def.id)}
            className={cn(
              'h-11 w-full rounded-xl text-sm font-black transition-transform active:scale-95',
              canUpSkill
                ? 'bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-white shadow-md shadow-amber-500/30'
                : 'cursor-not-allowed bg-stone-200 text-stone-400'
            )}
          >
            {canUpSkill ? `精进 · Lv.${skillLevel}→Lv.${skillLevel + 1}` : '精进 · 素材不足（点击查看）'}
          </button>
        )}
      </motion.div>

      {/* 升星区块 */}
      <div className="rounded-2xl border border-[#D4A574]/50 bg-[#FAF5EA] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-black text-stone-700">
            <ConfigIcon icon="/images/ui/ui-star.png" size={13} />
            升星强化
          </span>
          {atMax ? (
            <span className="text-[10px] font-bold text-amber-600">已达最高星级</span>
          ) : (
            <span className="text-[10px] tabular-nums text-stone-500">
              {o.star} 星 → {o.star + 1} 星
            </span>
          )}
        </div>
        {!atMax && (
          <>
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="text-stone-500">消耗同名妖怪</span>
              <span className={cn('font-black tabular-nums', canUp ? 'text-emerald-600' : 'text-red-500')}>
                {o.count}/{cost}
              </span>
            </div>
            <button
              type="button"
              disabled={!canUp}
              onClick={() => onStarUp(def.id)}
              className={cn(
                'h-11 w-full rounded-xl text-sm font-black transition-transform active:scale-95',
                canUp
                  ? 'bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-white shadow-md shadow-amber-500/30'
                  : 'cursor-not-allowed bg-stone-200 text-stone-400'
              )}
            >
              {canUp ? `升至 ${o.star + 1} 星` : `还差 ${lack} 只`}
            </button>
          </>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-stone-400">{def.starUpDesc}</p>
      </div>

      {/* 打工切换 */}
      <div className="flex items-center justify-between rounded-2xl border border-[#D4A574]/50 bg-white/80 p-3">
        <div>
          <p className="text-xs font-black text-stone-700">🛖 白天打工</p>
          <p className="text-[10px] text-stone-500">
            {o.deployed ? '正在岗位上任劳任怨' : '正在妖库里呼呼大睡'}
          </p>
        </div>
        <button
          type="button"
          disabled={slotsFull}
          onClick={() => onToggleDeploy(def.id)}
          className={cn(
            'h-11 min-w-[88px] rounded-xl px-4 text-sm font-black transition-transform active:scale-95',
            o.deployed
              ? 'border border-[#8B2E24]/40 bg-[#8B2E24]/10 text-[#8B2E24]'
              : slotsFull
                ? 'cursor-not-allowed bg-stone-200 text-stone-400'
                : 'bg-[#8B2E24] text-[#E6DCC8] shadow-md'
          )}
        >
          {o.deployed ? '安排休息' : slotsFull ? '打工位已满' : '上岗打工'}
        </button>
      </div>
    </div>
  )
}
