'use client'

// 云存档 + 运营事件上报（轻量，失败静默不打扰玩家）

const PID_KEY = 'yaoguai-inn-player-id'

export function getPlayerId(): string {
  if (typeof window === 'undefined') return ''
  let pid = window.localStorage.getItem(PID_KEY)
  if (!pid) {
    pid = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    window.localStorage.setItem(PID_KEY, pid)
  }
  return pid
}

export async function saveCloud(data: unknown, level: number): Promise<void> {
  try {
    const res = await fetch('/api/game/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: getPlayerId(), data: JSON.stringify(data), level }),
    })
    void res
  } catch {
    // 离线静默
  }
}

export async function trackEvent(kind: string, payload?: unknown): Promise<void> {
  try {
    await fetch('/api/game/save?event=telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: getPlayerId(), kind, payload }),
    })
  } catch {
    // 静默
  }
}
