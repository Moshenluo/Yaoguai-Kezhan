import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// 云存档：保存 / 读取 / 运营事件上报
// GET  /api/game/save?id=xxx         → 读取存档
// POST /api/game/save                → 保存存档 { id?, data }
// POST /api/game/save?event=telemetry → 运营事件 { playerId?, kind, payload }

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
  }
  try {
    const save = await db.playerSave.findUnique({ where: { id } })
    if (!save) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, save: { id: save.id, name: save.name, data: save.data, level: save.level } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const isTelemetry = req.nextUrl.searchParams.get('event') === 'telemetry'
  try {
    const body = await req.json()

    if (isTelemetry) {
      const { playerId, kind, payload } = body as { playerId?: string; kind: string; payload?: unknown }
      if (!kind) {
        return NextResponse.json({ ok: false, error: 'missing kind' }, { status: 400 })
      }
      await db.telemetryEvent.create({
        data: {
          playerId: playerId ?? null,
          kind,
          payload: JSON.stringify(payload ?? {}),
        },
      })
      return NextResponse.json({ ok: true })
    }

    // 存档
    const { id, data, level } = body as { id?: string; data: string; level?: number }
    if (!data) {
      return NextResponse.json({ ok: false, error: 'missing data' }, { status: 400 })
    }
    let saveId = id
    if (saveId) {
      const exists = await db.playerSave.findUnique({ where: { id: saveId } })
      if (exists) {
        await db.playerSave.update({
          where: { id: saveId },
          data: { data, level: level ?? exists.level },
        })
      } else {
        await db.playerSave.create({ data: { id: saveId, data, level: level ?? 1 } })
      }
    } else {
      const created = await db.playerSave.create({ data: { data, level: level ?? 1 } })
      saveId = created.id
    }
    return NextResponse.json({ ok: true, id: saveId })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
