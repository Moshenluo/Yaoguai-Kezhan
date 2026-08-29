import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// 运营数据看板（飞书联动·游戏数据自动汇总 雏形）
// GET /api/game/stats → 全量拉取 PlayerSave / TelemetryEvent 后内存聚合
// 指标：新增用户 / DAU / D1 留存 / 人均广告 / 捉妖成功率 / 战斗胜率 / 关卡分布 / 招募
// 说明：数据量小（单机 SQLite），不做复杂原生 SQL；日界按服务器本地时区自然日（Asia/Shanghai 语境）

/** 本地时区自然日 key（年-月-日） */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** 保留 3 位小数（0.6667 → 0.667），避免看板出现长浮点 */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** payload 是 JSON 字符串，解析失败/非对象时返回空对象，绝不抛错 */
function safeParse(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw)
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function GET() {
  try {
    const [saves, events] = await Promise.all([db.playerSave.findMany(), db.telemetryEvent.findMany()])

    const now = new Date()
    const today = dayKey(now)
    const yesterday = dayKey(new Date(now.getTime() - 86_400_000))

    // ---- 今日活跃（DAU）：今日有任意 telemetry 事件的去重 playerId ----
    const todayActive = new Set<string>()
    for (const e of events) {
      if (e.playerId && dayKey(e.createdAt) === today) todayActive.add(e.playerId)
    }

    // ---- D1 留存：昨日创建的存档中今日仍活跃的比例；分母为 0 则 null ----
    const yesterdaySaves = saves.filter((s) => dayKey(s.createdAt) === yesterday)
    const d1 =
      yesterdaySaves.length > 0
        ? round3(yesterdaySaves.filter((s) => todayActive.has(s.id)).length / yesterdaySaves.length)
        : null

    // ---- 分事件类型聚合 ----
    // battle_end: { victory, waveReached, captured, doubled, bossNight }
    let battleTotal = 0
    let victories = 0
    let waveSum = 0
    let waveCount = 0
    let bossTotal = 0
    let bossVictories = 0
    // capture: { yaoguaiId, grade, success, attempts, adBonus, bossNight }
    let captureAttempts = 0
    let captureSuccesses = 0
    const captureByYaoguai = new Map<string, number>()
    // ad_view: { scene }
    let adViews = 0
    const adViewers = new Set<string>()
    // recruit: { kind, count, rareCount }
    let recruitTotal = 0
    let recruitRare = 0

    for (const e of events) {
      const p = safeParse(e.payload)
      switch (e.kind) {
        case 'battle_end': {
          battleTotal += 1
          const victory = p.victory === true
          if (victory) victories += 1
          if (p.bossNight === true) {
            bossTotal += 1
            if (victory) bossVictories += 1
          }
          if (typeof p.waveReached === 'number' && Number.isFinite(p.waveReached)) {
            waveSum += p.waveReached
            waveCount += 1
          }
          break
        }
        case 'capture': {
          captureAttempts += 1
          if (p.success === true) {
            captureSuccesses += 1
            if (typeof p.yaoguaiId === 'string' && p.yaoguaiId) {
              captureByYaoguai.set(p.yaoguaiId, (captureByYaoguai.get(p.yaoguaiId) ?? 0) + 1)
            }
          }
          break
        }
        case 'ad_view': {
          adViews += 1
          if (e.playerId) adViewers.add(e.playerId)
          break
        }
        case 'recruit': {
          recruitTotal += typeof p.count === 'number' && p.count > 0 ? p.count : 1
          if (typeof p.rareCount === 'number' && p.rareCount > 0) recruitRare += p.rareCount
          break
        }
        default:
          break
      }
    }

    // 捉妖 top3（按成功收服次数，同数按 id 排序保证稳定）
    const topYaoguai = Array.from(captureByYaoguai.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
      .slice(0, 3)

    // 玩家关卡分布（PlayerSave.level 快速索引字段）
    const levelMap = new Map<number, number>()
    for (const s of saves) {
      levelMap.set(s.level, (levelMap.get(s.level) ?? 0) + 1)
    }
    const levelDist = Array.from(levelMap.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level - b.level)

    // 人均广告 = 观看数 / 看过广告的去重玩家数（无有效 playerId 时为 null）
    const adsPerPlayer = adViewers.size > 0 ? round3(adViews / adViewers.size) : null
    const captureRate = captureAttempts > 0 ? round3(captureSuccesses / captureAttempts) : null
    const winRate = battleTotal > 0 ? round3(victories / battleTotal) : null
    const bossWinRate = bossTotal > 0 ? round3(bossVictories / bossTotal) : null
    const avgWave = waveCount > 0 ? round3(waveSum / waveCount) : null

    return NextResponse.json({
      ok: true,
      generatedAt: now.toISOString(),
      totals: {
        players: saves.length,
        todayNew: saves.filter((s) => dayKey(s.createdAt) === today).length,
        dau: todayActive.size,
        totalEvents: events.length,
      },
      retention: { d1 },
      ads: { views: adViews, perPlayer: adsPerPlayer },
      capture: { attempts: captureAttempts, successes: captureSuccesses, rate: captureRate, topYaoguai },
      battle: {
        total: battleTotal,
        victories,
        winRate,
        avgWave,
        bossTotal,
        bossVictories,
        bossWinRate,
        levelDist,
      },
      recruit: { total: recruitTotal, rare: recruitRare },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
