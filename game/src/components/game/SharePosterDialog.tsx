'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGameStore } from '@/game/store'
import { YAOGUAI, YAOGUAI_MAP, yaoImg } from '@/game/yaoguai'
import type { Grade } from '@/game/types'
import { notify } from './shared'

/** 海报物理像素（预览按 CSS 等比缩放，保存为全尺寸 PNG） */
const W = 900
const H = 1560
/** 海报标题字体：楷体优先，系统无楷体回退宋体 */
const KAITI = `'KaiTi','STKaiti','Kaiti SC','SimSun',serif`
/** 品级描边色（与 YaoAvatar 边框同调） */
const GRADE_HEX: Record<Grade, string> = { normal: '#5E9C7E', rare: '#E8A33D', legend: '#E0657A' }
const GRADE_WEIGHT: Record<Grade, number> = { legend: 3, rare: 2, normal: 1 }

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 手绘风客栈海报：纸底墨框 + 金字招牌 + 经营数据 + 招牌妖灵头像墙 */
async function drawPoster(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const s = useGameStore.getState()
  const openDays = Math.max(1, Math.floor((Date.now() - s.stats.createdAt) / 86400000) + 1)
  const wins = s.stats.wins + s.stats.winsRegion2 + s.stats.winsRegion3
  /** 招牌妖灵：品级 > 星级 > 等级，取前 8 */
  const showcase = Object.entries(s.owned)
    .filter(([id]) => YAOGUAI_MAP[id])
    .sort((a, b) => {
      const da = YAOGUAI_MAP[a[0]]
      const db = YAOGUAI_MAP[b[0]]
      return GRADE_WEIGHT[db.grade] - GRADE_WEIGHT[da.grade] || b[1].star - a[1].star || b[1].level - a[1].level
    })
    .slice(0, 8)
    .map(([id]) => id)

  // ---- 纸底 + 双层边框（墨 + 金） ----
  ctx.fillStyle = '#F7EFDD'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#3A2E22'
  ctx.lineWidth = 10
  roundRectPath(ctx, 22, 22, W - 44, H - 44, 26)
  ctx.stroke()
  ctx.strokeStyle = '#C9A254'
  ctx.lineWidth = 3
  roundRectPath(ctx, 42, 42, W - 84, H - 84, 18)
  ctx.stroke()

  ctx.textAlign = 'center'

  // ---- 抬头：金句 + 招牌 + 玩家名 ----
  ctx.fillStyle = '#8A7B63'
  ctx.font = `30px ${KAITI}`
  ctx.fillText('山 海 有 灵 · 万 妖 来 栖', W / 2, 116)
  ctx.fillStyle = '#8B2E24'
  ctx.font = `900 110px ${KAITI}`
  ctx.fillText('妖怪客栈', W / 2, 240)
  ctx.strokeStyle = '#C9A254'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(W / 2 - 190, 268)
  ctx.lineTo(W / 2 + 190, 268)
  ctx.stroke()
  ctx.fillStyle = '#3A2E22'
  ctx.font = `38px ${KAITI}`
  ctx.fillText(`「 ${s.playerName} 」的客栈`, W / 2, 336)

  // ---- 客栈立绘（加载失败则留白） ----
  const inn = await loadImg('/images/ui/battle-inn.png')
  if (inn) {
    const scale = Math.min(560 / inn.width, 400 / inn.height)
    const dw = inn.width * scale
    const dh = inn.height * scale
    ctx.drawImage(inn, (W - dw) / 2, 372 + (400 - dh) / 2, dw, dh)
  }

  // ---- 经营数据四联 ----
  const stats: Array<[string, string]> = [
    ['开店天数', `${openDays}`],
    ['客栈等级', `Lv.${s.innLevel}`],
    ['收录妖灵', `${s.tujian.length}/${YAOGUAI.length}`],
    ['守店胜场', `${wins}`],
  ]
  const colW = (W - 160) / stats.length
  stats.forEach(([label, value], i) => {
    const cx = 80 + colW * i + colW / 2
    ctx.fillStyle = '#8B2E24'
    ctx.font = `900 52px ${KAITI}`
    ctx.fillText(value, cx, 856)
    ctx.fillStyle = '#8A7B63'
    ctx.font = `26px ${KAITI}`
    ctx.fillText(label, cx, 898)
    if (i > 0) {
      ctx.strokeStyle = '#D8C9A8'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(80 + colW * i, 812)
      ctx.lineTo(80 + colW * i, 908)
      ctx.stroke()
    }
  })

  // ---- 招牌妖灵头像墙（最多两行四列） ----
  ctx.fillStyle = '#3A2E22'
  ctx.font = `34px ${KAITI}`
  ctx.fillText('— 招 牌 妖 灵 —', W / 2, 976)
  const imgs = await Promise.all(showcase.map((id) => loadImg(yaoImg(id))))
  const perRow = 4
  const r = 74
  const gapX = (W - 240) / perRow
  const single = showcase.length <= perRow
  if (showcase.length === 0) {
    ctx.fillStyle = '#8A7B63'
    ctx.font = `30px ${KAITI}`
    ctx.fillText('客栈初开 · 万妖待栖', W / 2, 1130)
  }
  showcase.forEach((id, i) => {
    const row = single ? 0 : Math.floor(i / perRow)
    const col = i % perRow
    const cx = 120 + gapX * col + gapX / 2
    const cy = single ? 1130 : row === 0 ? 1076 : 1286
    const def = YAOGUAI_MAP[id]
    const img = imgs[i]
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    if (img) {
      const scale = Math.max((r * 2) / img.width, (r * 2) / img.height)
      ctx.drawImage(img, cx - (img.width * scale) / 2, cy - (img.height * scale) / 2, img.width * scale, img.height * scale)
    } else {
      // 图片缺失回退：纯色底 + 首字（与 YaoAvatar 回退同理）
      ctx.fillStyle = def?.color ?? '#8B7355'
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      ctx.fillStyle = '#FFF'
      ctx.font = `900 ${r}px ${KAITI}`
      ctx.fillText(def?.name?.[0] ?? '?', cx, cy + r * 0.35)
    }
    ctx.restore()
    ctx.strokeStyle = GRADE_HEX[def?.grade ?? 'normal']
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#3A2E22'
    ctx.font = `26px ${KAITI}`
    ctx.fillText(def?.name ?? '', cx, cy + r + 40)
  })

  // ---- 页脚 ----
  const now = new Date()
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`
  ctx.strokeStyle = '#D8C9A8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, 1448)
  ctx.lineTo(W - 120, 1448)
  ctx.stroke()
  ctx.fillStyle = '#8A7B63'
  ctx.font = `26px ${KAITI}`
  ctx.fillText(`山海有灵 · 客栈有约　${dateStr}`, W / 2, 1492)
}

export interface SharePosterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 分享海报弹窗：canvas 实时绘制预览，一键保存 PNG（纯前端零依赖） */
export function SharePosterDialog({ open, onOpenChange }: SharePosterDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open || !canvasRef.current) return
    setReady(false)
    let cancelled = false
    void drawPoster(canvasRef.current).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) {
        notify('图片生成失败，请截图分享')
        return
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `妖怪客栈海报-${Date.now()}.png`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      notify('海报已保存，快去分享吧～')
    }, 'image/png')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] rounded-3xl border-2 ui-paper p-4">
        <DialogHeader className="items-center space-y-1 pb-1">
          <DialogTitle className="text-base font-black text-[#8B2E24]">客栈海报</DialogTitle>
          <DialogDescription className="sr-only">客栈经营海报预览与保存</DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-2xl border border-[#D4A574]/60">
          <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#F7EFDD]/80 text-xs font-bold text-stone-500">
              绘制中…
            </div>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!ready}
          className="h-11 w-full rounded-xl bg-gradient-to-r from-[#E8B84B] to-[#D4933D] text-sm font-black text-white shadow-md shadow-amber-500/30 transition-transform active:scale-95"
        >
          保存图片
        </Button>
        <p className="text-center text-[10px] text-stone-400">保存后可分享给好友，也可直接截图分享</p>
      </DialogContent>
    </Dialog>
  )
}
