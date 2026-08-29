'use client'

import { useEffect, useRef, useState } from 'react'
import { BOSS_SKILL_TEXT, type BattleEngine } from '@/game/engine'
import type { BattleDefender, BattleEnemy, BattleState, FloatText } from '@/game/types'
import { SLOTS, regionDef, slotUnlockAt } from '@/game/config'
import { sfx } from '@/game/audio'
import { HpBar, YaoAvatar } from './shared'
import { ElementBadge } from './ElementBadge'
import { cn } from '@/lib/utils'

/** 守卫体力档位角标（纯 DOM，无 framer-motion——战场每帧重渲染性能约定） */
const DEFENDER_STAMINA_MARK: Partial<Record<BattleDefender['staminaTier'], { icon: string; title: string; color: string }>> = {
  tired: { icon: '😪', title: '体力疲惫：战斗攻速 -10%', color: '#FCD34D' },
  exhausted: { icon: '🥵', title: '体力力竭：攻击 -20% 攻速 -25%', color: '#FCA5A5' },
}

// ============ 夜晚塔防 · 战斗场景渲染 ============
// 性能约定：所有单位/浮字均为绝对定位轻量 DOM，敌人仅用 CSS transition 平滑 left，
// 血条/浮字每帧即时更新，不触发重布局。

export interface BattleFieldProps {
  engine: BattleEngine
  state: BattleState
  /** 点击可捕捉敌人（选中为收服目标） */
  onCapture: (enemy: BattleEnemy) => void
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
  damage: 'text-[13px] text-rose-100',
  crit: 'text-lg text-orange-400',
  heal: 'text-[13px] text-emerald-300',
  gold: 'text-[13px] text-amber-300',
  capture: 'text-xl font-black text-amber-200 drop-shadow-[0_0_10px_rgba(232,184,75,0.9)]',
  skill: 'text-[12px] text-cyan-200',
}

/** 妖王专属技能浮字配色：白泽紫 / 饕餮红（大号发光，让玩家强烈感知） */
const BOSS_SKILL_FLOAT_STYLE: Record<string, string> = {
  [BOSS_SKILL_TEXT.baize]: 'text-[15px] font-black text-purple-300 drop-shadow-[0_0_14px_rgba(192,132,252,0.9)]',
  [BOSS_SKILL_TEXT.taotie]: 'text-[15px] font-black text-red-400 drop-shadow-[0_0_14px_rgba(239,68,68,0.95)]',
}

/** 石板路纹理 */
const ROAD_BACKGROUND = [
  'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 48px)',
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.26) 0 2px, transparent 2px 34px)',
  'linear-gradient(180deg, rgba(28,24,48,0.42) 0%, rgba(21,18,38,0.68) 28%, rgba(21,18,38,0.68) 72%, rgba(28,24,48,0.42) 100%)',
].join(', ')

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
@keyframes yg-shake-kf { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-5px) rotate(-0.6deg) } 40% { transform: translateX(5px) rotate(0.6deg) } 60% { transform: translateX(-3px) } 80% { transform: translateX(3px) } }
.yg-shake-a { animation: yg-shake-kf 0.4s ease; }
.yg-shake-b { animation: yg-shake-kf 0.4s ease; }
@keyframes yg-capture-glow-kf { 0%,100% { filter: drop-shadow(0 0 4px rgba(232,184,75,0.55)) } 50% { filter: drop-shadow(0 0 14px rgba(232,184,75,0.95)) } }
.yg-capture-glow { animation: yg-capture-glow-kf 1.1s ease-in-out infinite; }
@keyframes yg-cast-kf { 0% { transform: scale(1.3); filter: drop-shadow(0 0 12px rgba(103,232,249,0.9)) } 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(103,232,249,0)) } }
.yg-cast { animation: yg-cast-kf 0.55s ease-out; }
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
  onCapture: (enemy: BattleEnemy) => void
  onRelease: (enemy: BattleEnemy) => void
  /** 区域视觉滤镜（区域二水墨风野妖；精英/妖王保持本色） */
  skinFilter?: string
}

/** 引擎坐标防御：异常值（undefined/NaN）回退，避免渲染出 "undefined%" 无效样式 */
function safeCoord(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback
}

function EnemyView({ enemy: e, now, capturable, onCapture, onRelease, skinFilter }: EnemyViewProps) {
  const [imgFailed, setImgFailed] = useState(false)

  // 传说妖王（妖王夜第 5 波 BOSS）：专属强化渲染
  const legend = e.kind.startsWith('boss:')

  // 状态角标：⚡眩晕 🐌减速 💜魅惑 🔥灼烧 🎯标记
  const statusIcons: string[] = []
  if (e.stunnedUntil > now) statusIcons.push('⚡')
  if (e.slowedUntil > now) statusIcons.push('🐌')
  if (e.charmedUntil > now) statusIcons.push('💜')
  if (e.burningUntil > now) statusIcons.push('🔥')
  if (e.markedUntil > now) statusIcons.push('🎯')

  const interactive = capturable || e.protectedFlag
  const ex = safeCoord(e.x, -6) // 异常坐标的敌人先悬在入场口外

  return (
    <div
      className="pointer-events-none absolute z-[10] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${ex}%`, top: `${e.lane}%`, transition: 'left 120ms linear' }}
    >
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
          {e.name}
          {e.uncapturable && <span className="ml-0.5">🚫</span>}
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
          color={capturable ? 'bg-amber-400' : legend ? 'bg-rose-400' : e.uncapturable && e.elite ? 'bg-stone-400' : undefined}
        />
      </div>
      {/* 本体 */}
      <div
        className={cn(
          'relative rounded-full',
          e.elite && !legend && (e.uncapturable ? 'ring-2 ring-stone-400/70' : 'ring-2 ring-amber-300/80'),
          legend && 'ring-2 ring-rose-400/90 shadow-[0_0_16px_rgba(244,63,94,0.5)]',
          legend && !capturable && 'yg-boss-aura',
          capturable && 'yg-capture-glow'
        )}
      >
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
            width={e.size}
            height={e.size}
            draggable={false}
            className="rounded-full"
            style={skinFilter && skinFilter !== 'none' && !legend ? { filter: skinFilter } : undefined}
            onError={() => setImgFailed(true)}
          />
        )}
        {/* 状态角标 */}
        {statusIcons.length > 0 && (
          <div className="absolute -right-1.5 -top-1 flex gap-px rounded-full bg-black/60 px-1 text-[10px] leading-4">
            {statusIcons.map((s) => (
              <span key={s}>{s}</span>
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
              'absolute -inset-1 flex items-center justify-center rounded-full border-2',
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
          aria-label={capturable ? `选中收服目标 ${e.name}` : e.uncapturable ? `查看目标 ${e.name}（野性难驯）` : e.name}
          className="pointer-events-auto absolute -inset-2 rounded-full"
          onClick={(ev) => {
            ev.stopPropagation()
            if (capturable || e.uncapturable) onCapture(e)
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
}

// ---------- 防守妖怪 ----------

interface DefenderViewProps {
  defender: BattleDefender
  slotY: number
  now: number
  floatTexts: FloatText[]
  /** prep 阶段显示名牌 */
  showLabel: boolean
}

function DefenderView({ defender: d, slotY, now, floatTexts, showLabel }: DefenderViewProps) {
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
      <div className={cn('relative rounded-full', casting && 'yg-cast')}>
        <YaoAvatar id={d.yaoguaiId} size={size} active={!d.dead} className={d.dead ? 'opacity-40' : undefined} />
        {d.dead && <div className="absolute inset-0 flex items-center justify-center text-lg">💀</div>}
        {/* 等级徽章（>Lv.1 显示，绿系小 pill，与星标名片不遮挡） */}
        {d.level > 1 && !d.dead && (
          <span className="absolute -bottom-1 -left-1.5 z-10 rounded-full bg-emerald-600/95 px-1 py-px text-[8px] font-black tabular-nums leading-[11px] text-emerald-50 shadow-md shadow-black/50">
            Lv.{d.level}
          </span>
        )}
        {/* 属性徽章（右上角，与左下 Lv 徽章错开） */}
        {d.element && !d.dead && (
          <span className="absolute -right-1.5 -top-1.5 z-10">
            <ElementBadge element={d.element} size="xs" />
          </span>
        )}
        {/* 体力档位角标（左上角：疲惫😪/力竭🥵，与右上属性徽章/左下 Lv 徽章错开，不遮头顶血条） */}
        {!d.dead && DEFENDER_STAMINA_MARK[d.staminaTier] && (
          <span
            title={DEFENDER_STAMINA_MARK[d.staminaTier]!.title}
            aria-label={DEFENDER_STAMINA_MARK[d.staminaTier]!.title}
            className="absolute -left-2 -top-2 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-black/70 text-[10px] leading-none shadow-md"
            style={{ borderColor: DEFENDER_STAMINA_MARK[d.staminaTier]!.color }}
          >
            {DEFENDER_STAMINA_MARK[d.staminaTier]!.icon}
          </span>
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
}

// ---------- 主组件 ----------

export function BattleField({
  engine,
  state,
  onCapture,
  onRelease,
  onSelectSlot,
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
  // 技能：新技能浮字出现时嗖声（浮字 id 单调递增，取最新的 skill 类型）
  const prevSkillId = useRef(0)
  useEffect(() => {
    const skills = state.floatTexts.filter((f) => f.type === 'skill')
    const newest = skills.length > 0 ? skills[skills.length - 1] : null
    if (newest && newest.id > prevSkillId.current) {
      prevSkillId.current = newest.id
      sfx.play('skill')
    }
  }, [state.floatTexts])

  const now = state.elapsed
  const isPrep = state.phase === 'prep'

  return (
    <div className="relative h-full w-full touch-manipulation select-none overflow-hidden bg-[#0d0b24]">
      <style>{BATTLE_CSS}</style>

      {/* 背景（加载失败降级深蓝紫渐变夜空；区域二水墨/区域三火色滤镜） */}
      {!bgFailed ? (
        <img
          src="/images/scene/scene-night.png"
          alt={inkMode ? '水墨幽谷夜色' : fireMode ? '沸火赤川夜色' : '夜色客栈外'}
          draggable={false}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          style={themed ? { filter: reg.sceneFilter } : undefined}
          onError={() => setBgFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0 z-0"
          style={{ background: 'linear-gradient(180deg, #0a0926 0%, #171338 48%, #241f4d 78%, #171338 100%)' }}
        />
      )}

      {/* 夜空装饰：血月（妖王夜）/ 月亮 + 闪烁星点 */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        {bossNight ? (
          <div
            aria-hidden
            className="absolute right-[10%] top-[4%] h-8 w-8 rounded-full"
            style={{
              background: 'radial-gradient(circle at 36% 32%, #ffb4a6 0%, #e2554a 45%, #8f1f28 80%, #5c0f1e 100%)',
              boxShadow: '0 0 26px 7px rgba(226,85,74,0.42), inset -4px -3px 10px rgba(60,6,16,0.55)',
            }}
          />
        ) : (
          <div className="absolute right-[10%] top-[4%] text-xl opacity-90 drop-shadow-[0_0_8px_rgba(255,250,220,0.5)]">🌙</div>
        )}
        {NIGHT_STARS.map((s, i) => (
          <span
            key={i}
            className={cn(
              'yg-twinkle absolute text-[9px]',
              bossNight ? 'text-rose-200/75' : 'text-white/80'
            )}
            style={{ left: s.left, top: s.top, animationDelay: s.delay }}
          >
            ✦
          </span>
        ))}
      </div>

      {/* 妖王夜暗红氛围层（替代妖雾层位置，妖王夜不出妖雾） */}
      {bossNight && (
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              'linear-gradient(180deg, rgba(120,20,32,0.18) 0%, rgba(90,14,26,0.05) 38%, rgba(90,14,26,0.08) 62%, rgba(60,8,18,0.24) 100%)',
          }}
        />
      )}

      {/* 水墨幽谷氛围层：谷雾如墨，笔锋藏杀（区域二专属，与妖雾层叠加） */}
      {inkMode && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                'linear-gradient(180deg, rgba(74,68,88,0.30) 0%, rgba(58,54,68,0.10) 34%, rgba(58,54,68,0.14) 60%, rgba(46,44,54,0.34) 100%)',
            }}
          />
          {/* 远山淡墨笔触（静态装饰，营造水墨画意） */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[6%] z-[2] h-[16%] opacity-50"
            style={{
              background:
                'radial-gradient(ellipse 34% 88% at 12% 100%, rgba(30,32,40,0.55), transparent 70%), radial-gradient(ellipse 40% 100% at 38% 100%, rgba(44,46,56,0.4), transparent 72%), radial-gradient(ellipse 36% 92% at 66% 100%, rgba(30,32,40,0.5), transparent 70%), radial-gradient(ellipse 30% 84% at 90% 100%, rgba(44,46,56,0.42), transparent 74%)',
            }}
          />
          <div className="absolute right-[10%] top-[3%] z-[1] text-lg opacity-80 drop-shadow-[0_0_8px_rgba(220,226,235,0.4)]">🖌️</div>
        </>
      )}

      {/* 沸火赤川氛围层：地脉沸腾，熔岩暗涌（区域三专属，与妖雾层叠加） */}
      {fireMode && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{
              background:
                'linear-gradient(180deg, rgba(168,64,47,0.26) 0%, rgba(124,45,31,0.08) 34%, rgba(140,50,30,0.12) 60%, rgba(92,29,16,0.36) 100%)',
            }}
          />
          {/* 远处熔岩脊线（静态装饰，火光暗涌） */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[7%] z-[2] h-[14%] opacity-60"
            style={{
              background:
                'radial-gradient(ellipse 30% 80% at 16% 100%, rgba(122,36,20,0.6), transparent 72%), radial-gradient(ellipse 42% 96% at 46% 100%, rgba(94,26,14,0.45), transparent 74%), radial-gradient(ellipse 34% 84% at 74% 100%, rgba(122,36,20,0.55), transparent 72%), radial-gradient(ellipse 28% 78% at 94% 100%, rgba(94,26,14,0.5), transparent 76%)',
            }}
          />
          <div className="absolute right-[10%] top-[3%] z-[1] text-lg opacity-85 drop-shadow-[0_0_10px_rgba(255,150,90,0.5)]">🌋</div>
        </>
      )}

      {/* 妖雾氛围层 */}
      {state.fogTriggered && (
        <div
          className="yg-fog pointer-events-none absolute inset-0 z-[2]"
          style={{
            background:
              'linear-gradient(105deg, rgba(122,112,168,0.16) 0%, transparent 38%, rgba(122,112,168,0.2) 72%, rgba(122,112,168,0.1) 100%)',
          }}
        />
      )}

      {/* 石板路：覆盖单位活动带（lane 26-66 / 站位 y 26-62） */}
      <div className="absolute inset-x-0 z-[3]" style={{ top: '24%', height: '50%' }}>
        <div className="h-full w-full border-y border-white/10" style={{ background: ROAD_BACKGROUND }} />
      </div>

      {/* 站位光圈（空置呼吸闪烁；锁定格灰显示解锁等级） */}
      {SLOTS.map((s) => {
        const occupied = state.defenders.some((d) => d.slot === s.slot)
        const locked = s.slot >= maxSlots
        if (locked) {
          return (
            <div
              key={s.slot}
              aria-label={`站位 ${s.slot + 1} 未解锁，需客栈 ${slotUnlockAt(s.slot)} 级`}
              className="absolute z-[5] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-dashed border-white/10 bg-black/25"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              <span className="text-[11px] leading-none opacity-60">🔒</span>
              <span className="mt-0.5 text-[7px] font-bold leading-none text-stone-400">{slotUnlockAt(s.slot)}级</span>
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
              'absolute z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors',
              occupied
                ? 'h-14 w-14 border-white/15 bg-white/5'
                : isPrep
                  ? 'h-14 w-14 animate-pulse border-amber-200/60 bg-amber-100/10'
                  : 'h-12 w-12 border-white/10 bg-white/5'
            )}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
          >
            {!occupied && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-amber-100/60">
                {s.slot + 1}
              </span>
            )}
          </button>
        )
      })}

      {/* 客栈（右侧，受击 shake） */}
      <div className="absolute right-[1%] top-[28%] z-[8] w-[22%]">
        <div className="mb-1 text-center">
          <div className="text-[10px] font-medium text-amber-100/90 drop-shadow">🏮 妖怪客栈</div>
          <HpBar value={state.innHp} max={state.innMaxHp} height={6} color="bg-rose-400" />
          <div className="mt-0.5 text-[9px] tabular-nums text-stone-200/90">
            {state.innHp} / {state.innMaxHp}
          </div>
        </div>
        <div key={state.innHp} className={innDamaged ? 'yg-shake-a' : undefined}>
          {/* 屋顶 */}
          <div className="relative z-10 mx-[-6%] h-3.5 rounded-t-md border border-amber-200/20 bg-gradient-to-b from-[#8a3d4e] to-[#52222f] shadow-lg" />
          {/* 主体 */}
          <div className="relative flex h-24 flex-col items-center justify-end gap-1 rounded-b-md border-x border-b border-amber-200/15 bg-gradient-to-b from-[#3b2c21] to-[#221810] pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base drop-shadow-[0_0_6px_rgba(232,120,60,0.6)]">🏮</span>
              <div className="flex flex-col gap-1">
                <div className="h-3.5 w-5 rounded-sm bg-amber-300/80 shadow-[0_0_8px_rgba(232,184,75,0.7)]" />
                <div className="h-3.5 w-5 rounded-sm bg-amber-300/50 shadow-[0_0_6px_rgba(232,184,75,0.45)]" />
              </div>
              <span className="text-base drop-shadow-[0_0_6px_rgba(232,120,60,0.6)]">🏮</span>
            </div>
            {/* 大门 */}
            <div className="h-6 w-7 rounded-t-md border border-stone-900 bg-stone-950/90" />
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
          floatTexts={state.floatTexts}
          showLabel={isPrep}
        />
      ))}

      {/* 敌人（left 120ms linear 平滑移动；浮字/血条即时；区域二野妖水墨皮肤） */}
      {state.enemies.map((e) => {
        // 以引擎为唯一判定源：captureRate>0 即「精英且血量已进捕捉窗口」
        const capturable = !e.dead && engine.captureRate(e, false, 0) > 0
        return (
          <EnemyView
            key={e.uid}
            enemy={e}
            now={now}
            capturable={capturable}
            onCapture={onCapture}
            onRelease={onRelease}
            skinFilter={themed ? reg.enemyFilter : undefined}
          />
        )
      })}

      {/* 浮动文字（向上飘 40px 渐隐 1s；妖王技能浮字专属紫/红配色） */}
      {state.floatTexts.map((f) => (
        <div
          key={f.id}
          className="pointer-events-none absolute z-[25] -translate-x-1/2"
          style={{ left: `${safeCoord(f.x, 50)}%`, top: `${safeCoord(f.y, 40)}%` }}
        >
          <span
            className={cn(
              'yg-float inline-block whitespace-nowrap font-bold',
              BOSS_SKILL_FLOAT_STYLE[f.text] ?? cn('drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]', FLOAT_STYLE[f.type])
            )}
          >
            {f.text}
          </span>
        </div>
      ))}

      {/* prep 布阵倒计时 */}
      {isPrep && (
        <div className="absolute left-1/2 top-3 z-[26] -translate-x-1/2 rounded-2xl border border-amber-200/30 bg-black/60 px-4 py-2 text-center backdrop-blur-sm">
          <div className="text-[10px] text-amber-100/80">
            {bossNight
              ? `妖王亲卫 第 ${state.wave} 波来袭倒计时`
              : inkMode
                ? `水墨幽谷 · 第 ${state.wave} 波来袭倒计时`
                : fireMode
                  ? `沸火赤川 · 第 ${state.wave} 波来袭倒计时`
                  : `第 ${state.wave} 波来袭倒计时`}
          </div>
          <div className="text-3xl font-black tabular-nums leading-tight text-amber-300 drop-shadow-[0_0_10px_rgba(232,184,75,0.4)]">
            {Math.ceil(Math.max(0, state.prepCountdown))}
          </div>
          <div className="text-[9px] text-stone-300">下方调整布阵 · 光圈点击上阵</div>
        </div>
      )}

      {/* 夜色暗角 vignette（妖王夜变体：暗血红调） */}
      <div
        className="pointer-events-none absolute inset-0 z-[30]"
        style={
          bossNight
            ? {
                boxShadow: 'inset 0 0 100px 30px rgba(38,6,14,0.8)',
                background: 'radial-gradient(ellipse at 50% 46%, transparent 54%, rgba(88,10,20,0.36) 100%)',
              }
            : {
                boxShadow: 'inset 0 0 90px 26px rgba(6,5,20,0.72)',
                background: 'radial-gradient(ellipse at 50% 46%, transparent 58%, rgba(6,5,20,0.28) 100%)',
              }
        }
      />
    </div>
  )
}
