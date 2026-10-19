'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { BOSS_SKILL_TEXT, type BattleEngine } from '@/game/engine'
import type { BattleDefender, BattleEnemy, BattleState, FloatText } from '@/game/types'
import { CAPTURE_HP_THRESHOLD, ELITE_AFFIXES, SLOTS, SKILL_FX_IMG, SKILL_ICON, regionDef, slotUnlockAt } from '@/game/config'
import { sfx } from '@/game/audio'
import { HpBar, YaoFigure, ConfigIcon } from './shared'
import { ElementBadge } from './ElementBadge'
import { cn } from '@/lib/utils'

/** 守卫体力档位角标（config 路径 / ConfigIcon） */
const DEFENDER_STAMINA_MARK: Partial<
  Record<BattleDefender['staminaTier'], { icon: string; title: string; color: string }>
> = {
  tired: { icon: '/images/ui/stamina-tired.png', title: '体力疲惫：战斗攻速 -10%', color: '#FCD34D' },
  exhausted: { icon: '/images/ui/stamina-exhausted.png', title: '体力力竭：攻击 -20% 攻速 -25%', color: '#FCA5A5' },
}

function DefenderStaminaMark({
  mark,
}: {
  mark: { icon: string; title: string; color: string }
}) {
  return (
    <span
      title={mark.title}
      aria-label={mark.title}
      className="absolute -left-2 -top-2 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-black/70 leading-none shadow-md"
      style={{ borderColor: mark.color }}
    >
      <ConfigIcon icon={mark.icon} size={12} />
    </span>
  )
}

// ============ 夜晚塔防 · 战斗场景渲染 ============
// 性能约定：所有单位/浮字均为绝对定位轻量 DOM，敌人仅用 CSS transition 平滑 left，
// 血条/浮字每帧即时更新，不触发重布局。

export interface BattleFieldProps {
  engine: BattleEngine
  state: BattleState
  /** 点击可捕捉敌人（选中为收服目标） */
  onCapture: (enemy: BattleEnemy) => void
  /** 当前收服目标 uid（战场高亮选中） */
  selectedUid?: string | null
  /** 放归残血保护的精英 */
  onRelease: (enemy: BattleEnemy) => void
  /** prep 阶段点击站位格（布阵联动），战斗中可忽略 */
  onSelectSlot?: (slot: number) => void
  /** 妖王夜模式：血月夜空 + 暗红氛围 + 传说妖王渲染 */
  bossNight?: boolean
  /** 战斗区域（2 = 水墨幽谷：场景水墨滤镜 + 野妖水墨风皮肤） */
  region?: 1 | 2 | 3
  /** 当前可用站位数（第 5/6 格随客栈等级解锁） */
  maxSlots?: number
  /** 客栈等级（锁定格角标用） */
  innLevel?: number
}

/** 浮字配色（damage=白/红 crit=大号橙 heal=绿 gold=金 capture=金大号 skill=青） */
const FLOAT_STYLE: Record<FloatText['type'], string> = {
  damage: 'text-[13px] text-[#F5EFE3] [text-shadow:0_0_5px_#8B2E24,0_1px_2px_#2a0c0c]',
  crit: 'text-[20px] font-black text-[#E8B84B] [text-shadow:0_0_10px_#8B2E24,0_1px_3px_#3a1010]',
  heal: 'text-[14px] text-emerald-200 [text-shadow:0_0_6px_#14532d]',
  gold: 'text-[13px] font-black text-[#E8B84B] [text-shadow:0_0_6px_#8B2E24]',
  capture: 'text-xl font-black text-amber-200 drop-shadow-[0_0_10px_rgba(232,184,75,0.9)]',
  skill: 'text-[12px] text-[#E6DCC8] [text-shadow:0_0_6px_#1a1520]',
}

/** 妖王专属技能浮字配色：白泽紫 / 饕餮红（大号发光，让玩家强烈感知） */
const BOSS_SKILL_FLOAT_STYLE: Record<string, string> = {
  [BOSS_SKILL_TEXT.baize]: 'text-[15px] font-black text-purple-300 drop-shadow-[0_0_14px_rgba(192,132,252,0.9)]',
  [BOSS_SKILL_TEXT.taotie]: 'text-[15px] font-black text-red-400 drop-shadow-[0_0_14px_rgba(239,68,68,0.95)]',
}

/** 夜空星点（避开路径区） */
const NIGHT_STARS = [
  { left: '8%', top: '9%', delay: '0s' },
  { left: '22%', top: '5%', delay: '0.7s' },
  { left: '38%', top: '12%', delay: '1.4s' },
  { left: '55%', top: '6%', delay: '0.4s' },
  { left: '68%', top: '13%', delay: '1.1s' },
  { left: '80%', top: '7%', delay: '1.8s' },
  { left: '90%', top: '16%', delay: '0.9s' },
  { left: '15%', top: '18%', delay: '2.2s' },
]

/**
 * 战场动效 keyframes（以组件内 <style> 注入，不污染全局样式表）。
 * 注意：keyframes 名带 yg- 前缀避免冲突。
 */
const BATTLE_CSS = `
@keyframes yg-float-kf { 0% { transform: translateY(0); opacity: 1 } 100% { transform: translateY(-40px); opacity: 0 } }
.yg-float { animation: yg-float-kf 1s ease-out forwards; }
@keyframes yg-float-heal-kf { 0% { transform: translateY(0); opacity: 1 } 100% { transform: translateY(-52px); opacity: 0 } }
.yg-float-heal { animation: yg-float-heal-kf 1.15s ease-out forwards; }
@keyframes yg-hit-flash-kf { 0% { opacity: 0.55 } 100% { opacity: 0 } }
.yg-hit-flash { animation: yg-hit-flash-kf 0.18s ease-out forwards; }
@keyframes yg-shake-kf { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-5px) rotate(-0.6deg) } 40% { transform: translateX(5px) rotate(0.6deg) } 60% { transform: translateX(-3px) } 80% { transform: translateX(3px) } }
.yg-shake-a { animation: yg-shake-kf 0.4s ease; }
.yg-shake-b { animation: yg-shake-kf 0.4s ease; }
@keyframes yg-capture-glow-kf { 0%,100% { filter: drop-shadow(0 0 4px rgba(232,184,75,0.55)) } 50% { filter: drop-shadow(0 0 14px rgba(232,184,75,0.95)) } }
.yg-capture-glow { animation: yg-capture-glow-kf 1.1s ease-in-out infinite; }
@keyframes yg-capture-selected-kf { 0%,100% { box-shadow: 0 0 0 2px rgba(139,46,36,0.85), 0 0 10px rgba(232,184,75,0.7) } 50% { box-shadow: 0 0 0 4px rgba(139,46,36,1), 0 0 18px rgba(232,184,75,0.95) } }
.yg-capture-selected { animation: yg-capture-selected-kf 0.9s ease-in-out infinite; }
@keyframes yg-cast-kf { 0% { transform: scale(1.3); filter: drop-shadow(0 0 12px rgba(103,232,249,0.9)) } 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(103,232,249,0)) } }
.yg-cast { animation: yg-cast-kf 0.55s ease-out; }
.yg-cast-icon { animation: yg-cast-icon-kf 0.55s ease-out; }
@keyframes yg-cast-icon-kf { 0% { opacity: 0; transform: translateX(-50%) scale(0.4) } 30% { opacity: 1; transform: translateX(-50%) scale(1.18) } 70% { opacity: 1; transform: translateX(-50%) scale(1) } 100% { opacity: 0; transform: translateX(-50%) scale(1.1) } }
.yg-fx { mix-blend-mode: screen; animation: yg-fx-kf 0.8s ease-out forwards; }
@keyframes yg-fx-kf { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.45) } 28% { opacity: 1; transform: translate(-50%, -50%) scale(1.12) } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4) } }
@keyframes yg-twinkle-kf { 0%,100% { opacity: 0.15 } 50% { opacity: 0.9 } }
.yg-twinkle { animation: yg-twinkle-kf 2.8s ease-in-out infinite; }
@keyframes yg-fog-kf { 0%,100% { opacity: 0.45 } 50% { opacity: 0.95 } }
.yg-fog { animation: yg-fog-kf 7s ease-in-out infinite; }
@keyframes yg-shield-kf { 0%,100% { opacity: 0.5 } 50% { opacity: 0.95 } }
.yg-shield { animation: yg-shield-kf 1.6s ease-in-out infinite; }
.yg-shield-gold { animation: yg-shield-kf 1.2s ease-in-out infinite; }
@keyframes yg-boss-aura-kf { 0%,100% { filter: drop-shadow(0 0 6px rgba(251,113,133,0.45)) } 50% { filter: drop-shadow(0 0 18px rgba(251,113,133,0.95)) } }
.yg-boss-aura { animation: yg-boss-aura-kf 2s ease-in-out infinite; }
`

// ---------- 敌人 ----------

interface EnemyViewProps {
  enemy: BattleEnemy
  now: number
  capturable: boolean
  selected: boolean
  hitTick: number
  onCapture: (enemy: BattleEnemy) => void
  onRelease: (enemy: BattleEnemy) => void
  /** 区域视觉滤镜（区域二水墨风野妖；精英/妖王保持本色） */
  skinFilter?: string
}

/** 引擎坐标防御：异常值（undefined/NaN）回退，避免渲染出 "undefined%" 无效样式 */
function safeCoord(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback
}

/** 敌人单元：memo 化——对象引用未变（未移动/未受伤）时跳过重渲染，10fps emit 下大幅省帧 */
const EnemyView = memo(function EnemyView({ enemy: e, now, capturable, selected, hitTick, onCapture, onRelease, skinFilter }: EnemyViewProps) {
  const [imgFailed, setImgFailed] = useState(false)

  // 传说妖王（妖王夜第 5 波 BOSS）：专属强化渲染
  const legend = e.kind.startsWith('boss:')

  const statusIcons: string[] = []
  if (e.stunnedUntil > now) statusIcons.push('/images/ui/status-stun.png')
  if (e.slowedUntil > now) statusIcons.push('/images/ui/status-slow.png')
  if (e.charmedUntil > now) statusIcons.push('/images/ui/status-charm.png')
  if (e.burningUntil > now) statusIcons.push('/images/ui/status-burn.png')
  if (e.markedUntil > now) statusIcons.push('/images/ui/status-mark.png')

  const inCaptureWindow =
    !e.dead && e.elite && !!e.yaoguaiId && e.hp / e.maxHp <= CAPTURE_HP_THRESHOLD
  const interactive = capturable || inCaptureWindow || e.protectedFlag
  const ex = safeCoord(e.x, -6) // 异常坐标的敌人先悬在入场口外

  return (
    <div
      className="pointer-events-none absolute z-[10] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${ex}%`, top: `${e.lane}%`, transition: 'left 120ms linear' }}
    >
      {/* 运宝小妖名称（宝箱波：金色 + 打掉有宝提示） */}
      {e.treasure && (
        <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 animate-pulse whitespace-nowrap rounded-full border border-amber-300/50 bg-[#3d2a08]/85 px-1.5 py-px text-[9px] font-black text-amber-200 shadow-[0_0_8px_rgba(232,184,75,0.45)]">
          运宝小妖 · 打掉有宝
        </div>
      )}
      {/* 精英/妖王名称（野性难驯：石灰色 + 🚫 标记） */}
      {e.elite && (
        <div
          className={cn(
            'absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-medium',
            legend
              ? 'border border-rose-300/40 bg-[#3d0f1d]/85 text-[10px] font-black text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
              : e.uncapturable
                ? 'border border-stone-300/40 bg-stone-950/85 font-bold text-stone-200'
                : 'bg-black/55 text-amber-200'
          )}
        >
          {e.affix && (
            <span
              className="ml-1 inline-block rounded px-1 align-middle text-[9px] font-bold"
              style={{ color: ELITE_AFFIXES[e.affix].color, background: 'rgba(0,0,0,0.45)' }}
            >
              {ELITE_AFFIXES[e.affix].name}
            </span>
          )}
          {e.name}
          {e.uncapturable && (
            <span className="ml-0.5 inline-flex align-middle">
              <ConfigIcon icon="/images/ui/status-lock.png" size={10} />
            </span>
          )}
        </div>
      )}
      {/* 头顶血条（妖王更宽更高；可捕捉变金色） */}
      <div
        className="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2"
        style={{ width: e.size + (legend ? 22 : 6) }}
      >
        <HpBar
          value={e.hp}
          max={e.maxHp}
          height={legend ? 7 : 5}
          color={capturable ? 'bg-amber-400' : e.treasure ? 'bg-amber-300' : legend ? 'bg-rose-400' : e.uncapturable && e.elite ? 'bg-stone-400' : undefined}
        />
      </div>
      {/* 落地阴影：让单位有「踩在场地上」的实体感 */}
      <span
        aria-hidden
        className="absolute left-1/2 top-full -translate-x-1/2 rounded-[50%] bg-black/45 blur-[2px]"
        style={{ width: e.size * 0.92, height: Math.max(6, e.size * 0.2), marginTop: -Math.max(4, e.size * 0.12) }}
      />
      {/* 本体 */}
      <div
        className={cn(
          'relative rounded-[30%]',
          e.treasure && 'ring-2 ring-amber-300/90 animate-pulse',
          e.elite && !legend && (e.uncapturable ? 'ring-2 ring-stone-400/70' : 'ring-2 ring-amber-300/80'),
          legend && 'ring-2 ring-rose-400/90 shadow-[0_0_16px_rgba(244,63,94,0.5)]',
          legend && !capturable && !selected && 'yg-boss-aura',
          capturable && !selected && 'yg-capture-glow'
        )}
      >
        {hitTick > 0 && (
          <span
            key={hitTick}
            aria-hidden
            className="yg-hit-flash pointer-events-none absolute inset-0 rounded-[30%] bg-[#F5EFE3]"
          />
        )}
        {selected && (
          <div
            aria-hidden
            className={cn(
              'yg-capture-selected pointer-events-none absolute -inset-1.5 rounded-[30%] border-[3px]',
              e.uncapturable ? 'border-stone-300' : 'border-[#E8B84B]'
            )}
          />
        )}
        {selected && !e.uncapturable && (
          <span className="absolute -bottom-0.5 -right-1 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#E8B84B] bg-[#8B2E24] shadow-[0_0_6px_rgba(232,184,75,0.65)]">
            <ConfigIcon icon="/images/ui/prop-capture-net.png" size={12} />
          </span>
        )}
        {imgFailed ? (
          <div
            className="flex items-center justify-center rounded-full bg-stone-800 font-bold text-stone-200 ring-1 ring-white/20"
            style={{ width: e.size, height: e.size, fontSize: Math.round(e.size * 0.34) }}
          >
            {e.name[0]}
          </div>
        ) : (
          <img
            src={e.img}
            alt={e.name}
            draggable={false}
            className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]"
            style={{ height: e.size, width: 'auto', filter: skinFilter && skinFilter !== 'none' && !legend ? skinFilter : undefined }}
            onError={() => setImgFailed(true)}
          />
        )}
        {/* 状态角标 */}
        {statusIcons.length > 0 && (
          <div className="absolute -right-1.5 -top-1 flex gap-px rounded-full bg-black/60 px-1 text-[10px] leading-4">
            {statusIcons.map((s) => (
              <ConfigIcon key={s} icon={s} size={12} />
            ))}
          </div>
        )}
        {/* 属性徽章（左上角小圆点，不遮挡血条与右上状态角标；精英必然有属性，野妖概率携带） */}
        {e.element && (
          <span className="absolute -left-1.5 -top-1.5 z-10">
            <ElementBadge element={e.element} size="xs" />
          </span>
        )}
        {/* 残血保护罩：可收服金色「护」/ 野性难驯石灰色「野」 */}
        {e.protectedFlag && (
          <div
            className={cn(
              'absolute -inset-1 flex items-center justify-center rounded-[30%] border-2',
              e.uncapturable
                ? 'border-stone-300/80 bg-stone-300/10'
                : 'yg-shield-gold border-amber-300/90 bg-amber-200/15'
            )}
          >
            <span
              className={cn(
                'text-[11px] font-black drop-shadow',
                e.uncapturable ? 'text-stone-200' : 'text-amber-200'
              )}
            >
              {e.uncapturable ? '野' : '护'}
            </span>
          </div>
        )}
      </div>
      {/* 交互层：可捕捉/野性难驯目标点击选中（查看底部面板状态） */}
      {interactive && (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={
            selected
              ? `当前收服目标 ${e.name}`
              : capturable
                ? `选中收服目标 ${e.name}`
                : e.uncapturable
                  ? `查看目标 ${e.name}（野性难驯）`
                  : e.name
          }
          className="pointer-events-auto absolute -inset-2 rounded-full"
          onClick={(ev) => {
            ev.stopPropagation()
            if (capturable || e.uncapturable || inCaptureWindow) onCapture(e)
          }}
        />
      )}
      {/* 放归按钮（残血保护怪） */}
      {e.protectedFlag && (
        <button
          type="button"
          className="pointer-events-auto absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300/50 bg-stone-950/85 px-2 py-0.5 text-[10px] font-medium text-amber-200 active:scale-95"
          onClick={(ev) => {
            ev.stopPropagation()
            onRelease(e)
          }}
        >
          放归
        </button>
      )}
    </div>
  )
}, (prev, next) => {
  // 对象引用未变 + 交互态未变 → 跳过；hp/x/状态变化必换引用（引擎 emit 前已重建）
  return (
    prev.enemy === next.enemy &&
    prev.capturable === next.capturable &&
    prev.selected === next.selected &&
    prev.hitTick === next.hitTick &&
    prev.skinFilter === next.skinFilter
  )
})

// ---------- 防守妖怪 ----------

interface DefenderViewProps {
  defender: BattleDefender
  slotY: number
  now: number
  floatTexts: FloatText[]
  /** prep 阶段显示名牌 */
  showLabel: boolean
}

/** 防守妖单元：memo 化——对象引用未变（未受伤/未放技能）时跳过重渲染 */
const DefenderView = memo(function DefenderView({ defender: d, slotY, now, floatTexts, showLabel }: DefenderViewProps) {
  const size = d.star >= 4 ? 52 : d.star >= 2 ? 46 : 42
  const shielded = !d.dead && d.shieldUntil > now
  // 技能释放：最近 0.55s 内出现与本防守者同 x 坐标的 skill 浮字
  const casting =
    !d.dead &&
    floatTexts.some((f) => f.type === 'skill' && now - f.born < 0.55 && Math.abs(f.x - d.x) < 1.5)

  return (
    <div
      className="pointer-events-none absolute z-[9] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${d.x}%`, top: `${slotY}%` }}
    >
      {/* 头顶血条 */}
      <div className="absolute bottom-full left-1/2 mb-1 w-12 -translate-x-1/2">
        <HpBar value={d.hp} max={d.maxHp} height={4} />
      </div>
      <div className={cn('relative', casting && 'yg-cast')}>
        <YaoFigure id={d.yaoguaiId} size={size} active={!d.dead} className={d.dead ? 'opacity-40' : undefined} />
        {/* 技能图标闪现（V1.5 试点：已生成图标表的妖怪才有，随施术窗口弹出） */}
        {casting && SKILL_ICON[d.yaoguaiId] && (
          <img
            src={SKILL_ICON[d.yaoguaiId]}
            alt=""
            aria-hidden
            draggable={false}
            width={30}
            height={30}
            className="yg-cast-icon pointer-events-none absolute -top-4 left-1/2 z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          />
        )}
        {d.dead && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ConfigIcon icon="/images/ui/stamina-collapse.png" size={22} />
          </div>
        )}
        {/* 等级徽章（>Lv.1 显示，绿系小 pill，与星标名片不遮挡） */}
        {d.level > 1 && !d.dead && (
          <span className="absolute -bottom-1 -left-1.5 z-10 rounded-full border border-[#E8B84B]/30 bg-[#2C241C]/95 px-1 py-px text-[8px] font-black tabular-nums leading-[11px] text-[#E8B84B] shadow-md shadow-black/50">
            Lv.{d.level}
          </span>
        )}
        {/* 属性徽章（右上角，与左下 Lv 徽章错开） */}
        {d.element && !d.dead && (
          <span className="absolute -right-1.5 -top-1.5 z-10">
            <ElementBadge element={d.element} size="xs" />
          </span>
        )}
        {!d.dead && DEFENDER_STAMINA_MARK[d.staminaTier] && (
          <DefenderStaminaMark mark={DEFENDER_STAMINA_MARK[d.staminaTier]!} />
        )}
        {/* 旋龟护盾罩 */}
        {shielded && (
          <div className="yg-shield absolute -inset-1.5 rounded-full border-2 border-cyan-300/70 bg-cyan-300/15" />
        )}
      </div>
      {/* prep 名牌 */}
      {showLabel && !d.dead && (
        <div className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-1.5 py-px text-[9px] text-stone-200">
          {d.name}·{d.star}★{d.level > 1 ? `·Lv.${d.level}` : ''}
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  return (
    prev.defender === next.defender &&
    prev.slotY === next.slotY &&
    prev.floatTexts === next.floatTexts &&
    prev.showLabel === next.showLabel
  )
})

// ---------- 主组件 ----------

export function BattleField({
  engine,
  state,
  onCapture,
  onRelease,
  onSelectSlot,
  selectedUid = null,
  bossNight = false,
  region = 1,
  maxSlots = SLOTS.length,
  innLevel = 1,
}: BattleFieldProps) {
  const [bgFailed, setBgFailed] = useState(false)
  // 客栈受击震动：key=innHp 的变化重放 CSS 动画（受损时才加动画类，修复回满不震动）
  const innDamaged = state.innHp < state.innMaxHp
  // 区域主题：区域二水墨幽谷 / 区域三沸火赤川（场景滤镜 + 野妖换皮；妖王夜固定区域一无滤镜）
  const reg = regionDef(region)
  const themed = !bossNight && region !== 1
  const inkMode = !bossNight && region === 2
  const fireMode = !bossNight && region === 3

  // ---- 战斗音效（状态变化检测，非每帧轮询） ----
  // 客栈受击：血量下降时闷响
  const prevInnHp = useRef(state.innHp)
  useEffect(() => {
    if (state.innHp < prevInnHp.current) sfx.play('innHit')
    prevInnHp.current = state.innHp
  }, [state.innHp])
  // 击杀：killCount 增长时短促哒声
  const prevKills = useRef(state.killCount)
  useEffect(() => {
    if (state.killCount > prevKills.current) sfx.play('kill')
    prevKills.current = state.killCount
  }, [state.killCount])
  const now = state.elapsed

  // 防守妖只关心 skill 浮字（其余浮字变化不触发其重渲染——配合 DefenderView memo）
  // 用 ref 保持引用稳定：skill 集合未变时沿用旧数组
  const skillFloatRef = useRef<{ src: FloatText[]; out: FloatText[] }>({ src: [], out: [] })
  const skillFloatTexts = (() => {
    const filtered = state.floatTexts.filter((f) => f.type === 'skill')
    const prev = skillFloatRef.current
    const same =
      prev.src === state.floatTexts ||
      (prev.out.length === filtered.length && prev.out.every((f, i) => f === filtered[i]))
    if (!same) {
      skillFloatRef.current = { src: state.floatTexts, out: filtered }
      return filtered
    }
    return prev.out
  })()

  // 技能：新技能浮字出现时嗖声（浮字 id 单调递增，取最新的 skill 类型）
  const prevSkillId = useRef(0)
  useEffect(() => {
    const newest = skillFloatTexts.length > 0 ? skillFloatTexts[skillFloatTexts.length - 1] : null
    if (newest && newest.id > prevSkillId.current) {
      prevSkillId.current = newest.id
      sfx.play('skill')
    }
  }, [skillFloatTexts])
  const isPrep = state.phase === 'prep'

  return (
    <div className="relative h-full w-full touch-manipulation select-none overflow-hidden bg-[#1C1915]">
      <style>{BATTLE_CSS}</style>

      {/* 背景（加载失败降级墨色夜空；区域二水墨/区域三火色滤镜） */}
      {!bgFailed ? (
        <img
          src={reg.scene}
          alt={inkMode ? '水墨幽谷夜色' : fireMode ? '沸火赤川夜色' : '夜色客栈外'}
          draggable={false}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          style={themed ? { filter: reg.sceneFilter } : undefined}
          onError={() => setBgFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0 z-0"
          style={{ background: 'linear-gradient(180deg, #1C1915 0%, #2C241C 48%, #3a3228 78%, #1C1915 100%)' }}
        />
      )}

      {/* 场景 scrim：压暗背景、抬高单位可读性（不挡交互） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: bossNight
            ? 'linear-gradient(180deg, rgba(28,10,14,0.28) 0%, rgba(20,8,10,0.12) 40%, rgba(20,8,10,0.18) 100%)'
            : 'linear-gradient(180deg, rgba(28,25,21,0.32) 0%, rgba(20,18,15,0.1) 42%, rgba(20,18,15,0.22) 100%)',
        }}
      />

      {/* 夜空：场景图已含月亮；仅妖王夜加血月角标，区域用 PNG 而非 emoji */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        {bossNight && (
          <div
            aria-hidden
            className="absolute right-[8%] top-[3%] h-9 w-9 rounded-full"
            style={{
              background: 'radial-gradient(circle at 36% 32%, #ffb4a6 0%, #e2554a 45%, #8f1f28 80%, #5c0f1e 100%)',
              boxShadow: '0 0 26px 7px rgba(226,85,74,0.42), inset -4px -3px 10px rgba(60,6,16,0.55)',
            }}
          />
        )}
        {NIGHT_STARS.map((s, i) => (
          <span
            key={i}
            className={cn(
              'yg-twinkle absolute h-[3px] w-[3px] rounded-full',
              bossNight ? 'bg-rose-200/80' : 'bg-[#FFE9B8]/80'
            )}
            style={{ left: s.left, top: s.top, animationDelay: s.delay }}
          />
        ))}
      </div>

      {bossNight && (
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              'linear-gradient(180deg, rgba(120,20,32,0.18) 0%, rgba(90,14,26,0.05) 38%, rgba(90,14,26,0.08) 62%, rgba(60,8,18,0.24) 100%)',
          }}
        />
      )}

      {inkMode && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                'linear-gradient(180deg, rgba(74,68,88,0.26) 0%, rgba(58,54,68,0.08) 34%, rgba(58,54,68,0.12) 60%, rgba(46,44,54,0.28) 100%)',
            }}
          />
          <div className="absolute right-[3%] top-[3%] z-[2] opacity-80">
            <ConfigIcon icon="/images/ui/region-2.png" size={22} />
          </div>
        </>
      )}

      {fireMode && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                'linear-gradient(180deg, rgba(168,64,47,0.22) 0%, rgba(124,45,31,0.06) 34%, rgba(140,50,30,0.1) 60%, rgba(92,29,16,0.3) 100%)',
            }}
          />
          <div className="absolute right-[3%] top-[3%] z-[2] opacity-85">
            <ConfigIcon icon="/images/ui/region-3.png" size={22} />
          </div>
        </>
      )}

      {state.fogTriggered && (
        <div
          className="yg-fog pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              'linear-gradient(105deg, rgba(122,112,168,0.16) 0%, transparent 38%, rgba(122,112,168,0.2) 72%, rgba(122,112,168,0.1) 100%)',
          }}
        />
      )}

      {/* 路径柔光：抬亮妖道带（战斗图石板路 42%~56%） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 z-[3]"
        style={{
          top: '40%',
          height: '18%',
          background:
            'radial-gradient(ellipse 88% 70% at 48% 50%, rgba(232,184,75,0.09) 0%, transparent 72%)',
        }}
      />

      {/* 站位石座 */}
      {SLOTS.map((s) => {
        const occupied = state.defenders.some((d) => d.slot === s.slot)
        const locked = s.slot >= maxSlots
        if (locked) {
          return (
            <div
              key={s.slot}
              aria-label={`站位 ${s.slot + 1} 未解锁，需客栈 ${slotUnlockAt(s.slot)} 级`}
              className="absolute z-[5] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              <img src="/images/ui/slot-pad.png" alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain opacity-40 grayscale" />
              <ConfigIcon icon="/images/ui/status-lock.png" size={16} />
              <span className="relative mt-0.5 text-[7px] font-bold leading-none text-[#E6DCC8]/80">
                {slotUnlockAt(s.slot)}级
              </span>
            </div>
          )
        }
        return (
          <button
            key={s.slot}
            type="button"
            aria-label={`站位 ${s.slot + 1}`}
            onClick={() => onSelectSlot?.(s.slot)}
            className={cn(
              'absolute z-[5] h-14 w-14 -translate-x-1/2 -translate-y-1/2',
              !occupied && isPrep && 'animate-pulse'
            )}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            <img
              src="/images/ui/slot-pad.png"
              alt=""
              draggable={false}
              className={cn(
                'absolute inset-0 h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]',
                occupied ? 'opacity-70' : 'opacity-95'
              )}
            />
            {!occupied && (
              <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-black text-[#FFE9B8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {s.slot + 1}
              </span>
            )}
          </button>
        )
      })}

      {/* 客栈寿元：战斗图右缘已画山门，血条挂在山门上方（敌人受击点 x=94/lane 44-54 同一区域） */}
      <div className="absolute right-[2%] top-[30%] z-[8] w-[26%]">
        <div key={state.innHp} className={cn('rounded-xl border border-[#E8B84B]/25 bg-black/45 px-1.5 py-1 backdrop-blur-[2px]', innDamaged && 'yg-shake-a')}>
          <div className="text-center text-[9px] font-bold tracking-wider text-[#FFE9B8]/90">客栈</div>
          <HpBar value={state.innHp} max={state.innMaxHp} height={6} color="bg-[#C0392B]" />
          <div className="mt-0.5 text-center text-[8px] tabular-nums text-[#E6DCC8]/90">
            {state.innHp} / {state.innMaxHp}
          </div>
        </div>
      </div>

      {/* 防守妖怪 */}
      {state.defenders.map((d) => (
        <DefenderView
          key={d.uid}
          defender={d}
          slotY={SLOTS[d.slot]?.y ?? SLOTS[0].y}
          now={now}
          floatTexts={skillFloatTexts}
          showLabel={isPrep}
        />
      ))}

      {/* 敌人（left 120ms linear 平滑移动；浮字/血条即时；区域二野妖水墨皮肤） */}
      {state.enemies.map((e) => {
        // 以引擎为唯一判定源：captureRate>0 即「精英且血量已进捕捉窗口」
        const capturable = !e.dead && engine.captureRate(e, false, 0) > 0
        let hitTick = 0
        for (const f of state.floatTexts) {
          if (
            (f.type === 'damage' || f.type === 'crit') &&
            now - f.born < 0.18 &&
            Math.abs(f.x - e.x) < 3.2 &&
            Math.abs(f.y - e.lane) < 8 &&
            f.id > hitTick
          ) {
            hitTick = f.id
          }
        }
        return (
          <EnemyView
            key={e.uid}
            enemy={e}
            now={now}
            capturable={capturable}
            selected={selectedUid === e.uid}
            hitTick={hitTick}
            onCapture={onCapture}
            onRelease={onRelease}
            skinFilter={themed ? reg.enemyFilter : undefined}
          />
        )
      })}

      {/* 浮动文字（同格错开；治疗略慢上浮；妖王技能浮字专属紫/红配色） */}
      {state.floatTexts.map((f) => {
        const bucket = `${Math.round(safeCoord(f.x, 50))}:${Math.round(safeCoord(f.y, 40))}`
        const same = state.floatTexts
          .filter((o) => `${Math.round(safeCoord(o.x, 50))}:${Math.round(safeCoord(o.y, 40))}` === bucket)
          .sort((a, b) => a.id - b.id)
        const idx = same.findIndex((o) => o.id === f.id)
        const shift = (idx - (same.length - 1) / 2) * 3.2
        return (
          <div
            key={f.id}
            className="pointer-events-none absolute z-[25] -translate-x-1/2"
            style={{ left: `${safeCoord(f.x, 50) + shift}%`, top: `${safeCoord(f.y, 40)}%` }}
          >
            <span
              className={cn(
                'inline-block whitespace-nowrap font-bold',
                f.type === 'heal' ? 'yg-float-heal' : 'yg-float',
                BOSS_SKILL_FLOAT_STYLE[f.text] ?? cn('drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]', FLOAT_STYLE[f.type])
              )}
            >
              {f.text}
            </span>
          </div>
        )
      })}

      {/* 技能特效（V1.5）：黑底发光贴图 screen blend 叠加，缩放+淡入淡出；未上线贴图的类别跳过 */}
      {state.skillFx.map((f) => {
        const img = SKILL_FX_IMG[f.kind]
        if (!img) return null
        return (
          <img
            key={f.id}
            src={img}
            alt=""
            aria-hidden
            draggable={false}
            className="yg-fx pointer-events-none absolute z-[24]"
            style={{
              left: `${safeCoord(f.x, 50)}%`,
              top: `${safeCoord(f.y, 40)}%`,
              width: f.kind === 'slash' ? '26%' : '18%',
            }}
          />
        )
      })}

      {/* prep 布阵倒计时 */}
      {isPrep && (
        <div className="absolute left-1/2 top-[4.5rem] z-[31] -translate-x-1/2 overflow-hidden rounded-2xl border-2 border-[#5C3A24]/50 shadow-lg">
          <div className="ui-wood px-4 py-1 text-center">
            <div className="text-[10px] font-bold tracking-wider text-[#FFE9B8]/90">
              {bossNight
                ? `妖王亲卫 第 ${state.wave} 波来袭`
                : inkMode
                  ? `水墨幽谷 · 第 ${state.wave} 波`
                  : fireMode
                    ? `沸火赤川 · 第 ${state.wave} 波`
                    : `第 ${state.wave} 波来袭`}
            </div>
          </div>
          <div className="bg-gradient-to-b from-[#FAF5EA]/95 to-[#E8DFD0]/95 px-5 py-2 text-center backdrop-blur-sm">
            <div className="font-display text-3xl font-black tabular-nums leading-tight text-[#8B2E24]">
              {Math.ceil(Math.max(0, state.prepCountdown))}
            </div>
            <div className="text-[9px] text-[#5C3A24]/75">下方调整布阵 · 光圈点击上阵</div>
            {/* 妖潮预览：下一波敌人成分（精英词缀保持临场惊喜） */}
            {(() => {
              const pk = engine.peekWave()
              const parts: string[] = []
              if (pk.minions) parts.push(`小妖×${pk.minions}`)
              if (pk.brutes) parts.push(`山怪×${pk.brutes}`)
              if (pk.sprites) parts.push(`精怪×${pk.sprites}`)
              if (pk.elitePct > 0) parts.push(`⚠精英 ${Math.round(pk.elitePct * 100)}%`)
              if (pk.hasBoss) parts.push('👹压阵')
              return (
                <div className="mt-1 border-t border-[#5C3A24]/15 pt-1 text-[9px] font-bold text-[#5C3A24]/85">
                  妖潮 · {parts.join(' ')}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* 夜色暗角 vignette（抬高中心单位可读性） */}
      <div
        className="pointer-events-none absolute inset-0 z-[30]"
        style={
          bossNight
            ? {
                boxShadow: 'inset 0 0 100px 28px rgba(38,6,14,0.75)',
                background: 'radial-gradient(ellipse at 50% 48%, transparent 48%, rgba(88,10,20,0.38) 100%)',
              }
            : {
                boxShadow: 'inset 0 0 90px 24px rgba(28,25,21,0.7)',
                background: 'radial-gradient(ellipse at 50% 48%, transparent 50%, rgba(28,25,21,0.36) 100%)',
              }
        }
      />
    </div>
  )
}
