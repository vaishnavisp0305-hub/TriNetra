import { useEffect, useMemo, useRef, useState } from 'react'
import { RISK_COLOR, displayName } from '../constants'

const TAU = Math.PI * 2
const MONO = '"JetBrains Mono", ui-monospace, monospace'

/* ------------------------------------------------------------------ *
 * RadarFeed: simulated real-time sonar sweep. Contacts are synthetic;
 * it is a visual simulator, not a data source.
 * ------------------------------------------------------------------ */
export function RadarFeed({ onContact }) {
  const wrap = useRef(null)
  const cv = useRef(null)
  const cb = useRef(onContact)
  cb.current = onContact

  useEffect(() => {
    const canvas = cv.current
    const ctx = canvas.getContext('2d')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const speed = reduce ? 0.4 : 1.1 // rad/s
    const wedge = 1.1 // trailing arc, rad
    const contacts = []
    let w = 0, h = 0, angle = 0, last = performance.now(), nextSpawn = 0, raf

    const resize = () => {
      const r = wrap.current.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      w = r.width; h = r.height
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap.current)
    resize()

    const frame = (t) => {
      const dt = Math.min((t - last) / 1000, 0.1)
      last = t
      const prev = angle
      angle = (angle + speed * dt) % TAU
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 14

      ctx.fillStyle = '#030712'
      ctx.fillRect(0, 0, w, h)

      // range rings + cross-hair
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(0,240,255,0.14)'
      ctx.fillStyle = 'rgba(0,240,255,0.55)'
      ctx.font = `10px ${MONO}`
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, TAU); ctx.stroke()
        ctx.fillText(`${i * 25} m`, cx + 4, cy - (R * i) / 4 + 12)
      }
      ctx.beginPath()
      ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
      ctx.stroke()

      // sweep wedge (leading edge is brightest)
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(angle - wedge, cx, cy)
        const f = wedge / TAU
        g.addColorStop(0, 'rgba(0,240,255,0)')
        g.addColorStop(f, 'rgba(0,240,255,0.38)')
        g.addColorStop(Math.min(f + 0.0001, 1), 'rgba(0,240,255,0)')
        g.addColorStop(1, 'rgba(0,240,255,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill()
      }
      ctx.save()
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1.6
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.moveTo(cx, cy)
      ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle)); ctx.stroke()
      ctx.restore()

      // contacts
      if (t > nextSpawn && contacts.length < 9) {
        contacts.push({
          a: Math.random() * TAU, r: 0.18 + Math.random() * 0.78,
          size: 2.5 + Math.random() * 4.5, lit: 0, seen: false, born: t,
          id: `C-${Math.floor(100 + Math.random() * 900)}`,
        })
        nextSpawn = t + 1500 + Math.random() * 2500
      }
      for (let i = contacts.length - 1; i >= 0; i--) {
        const c = contacts[i]
        if (t - c.born > 45000) { contacts.splice(i, 1); continue }
        const crossed = prev <= angle ? c.a > prev && c.a <= angle : c.a > prev || c.a <= angle
        if (crossed) {
          c.lit = t
          if (!c.seen) {
            c.seen = true
            cb.current?.({
              id: c.id,
              bearing: Math.round(((c.a * 180) / Math.PI + 90) % 360),
              range: Math.round(c.r * 100),
              strong: c.size > 5,
            })
          }
        }
        if (!c.lit) continue
        const alpha = Math.max(0, 1 - (t - c.lit) / 4200)
        if (alpha <= 0) continue
        const col = c.size > 5 ? '251,191,36' : '0,240,255'
        const x = cx + R * c.r * Math.cos(c.a), y = cy + R * c.r * Math.sin(c.a)
        ctx.fillStyle = `rgba(${col},${alpha})`
        ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 12 * alpha
        ctx.beginPath(); ctx.arc(x, y, c.size, 0, TAU); ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = `rgba(${col},${alpha * 0.8})`
        ctx.font = `10px ${MONO}`
        ctx.fillText(c.id, x + c.size + 4, y + 3)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <div ref={wrap} className="relative mx-auto aspect-square w-full max-w-[640px]">
      <canvas
        ref={cv}
        role="img"
        aria-label="Simulated sonar radar sweep with detected contacts"
        className="absolute inset-0 h-full w-full rounded-full ring-1 ring-glow/30"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SonarCanvas: preprocessed sonar image + bounding-box overlay.
 * detections: [{id, cls, confidence, risk, box:{x,y,w,h} (0-1), status, manual}]
 * ------------------------------------------------------------------ */
function drawBox(ctx, d, { w, h }, selected) {
  const col = RISK_COLOR[d.risk] || '#00f0ff'
  const px = d.box.x * w, py = d.box.y * h, pw = d.box.w * w, ph = d.box.h * h
  ctx.save()
  ctx.globalAlpha = d.status === 'rejected' ? 0.35 : 1
  ctx.strokeStyle = col
  ctx.lineWidth = selected ? 2.5 : 1.5
  if (d.status === 'rejected') ctx.setLineDash([6, 4])
  if (selected) { ctx.shadowColor = col; ctx.shadowBlur = 14 }
  ctx.strokeRect(px, py, pw, ph)
  ctx.shadowBlur = 0; ctx.setLineDash([])

  const conf = d.manual ? 'manual' : `${Math.round(d.confidence * 100)}%`
  const mark = d.status === 'confirmed' ? ' ✓' : d.status === 'rejected' ? ' ✕' : ''
  const label = `${displayName(d.cls)} ${conf} · ${d.risk}${mark}`
  ctx.font = `11px ${MONO}`
  const tw = ctx.measureText(label).width + 10
  const ly = py > 20 ? py - 18 : py + ph
  ctx.fillStyle = col
  ctx.fillRect(px, ly, tw, 18)
  ctx.fillStyle = '#030712'
  ctx.fillText(label, px + 5, ly + 13)
  ctx.restore()
}

export default function SonarCanvas({ imageUrl, detections = [], selectedId, onSelect, scanning }) {
  const wrap = useRef(null)
  const cv = useRef(null)
  const [img, setImg] = useState(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!imageUrl) { setImg(null); return }
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const dims = useMemo(() => {
    if (!img || !width) return null
    const maxH = Math.max(320, window.innerHeight * 0.72)
    const s = Math.min(width / img.width, maxH / img.height)
    return { w: Math.round(img.width * s), h: Math.round(img.height * s) }
  }, [img, width])

  useEffect(() => {
    if (!img || !dims) return
    const c = cv.current, ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1
    c.width = dims.w * dpr; c.height = dims.h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf
    const paint = (t = 0) => {
      ctx.clearRect(0, 0, dims.w, dims.h)
      ctx.drawImage(img, 0, 0, dims.w, dims.h)
      detections.forEach((d) => drawBox(ctx, d, dims, d.id === selectedId))
      if (scanning) {
        const y = ((t / 1800) % 1) * dims.h
        const g = ctx.createLinearGradient(0, y - 70, 0, y)
        g.addColorStop(0, 'rgba(0,240,255,0)'); g.addColorStop(1, 'rgba(0,240,255,0.35)')
        ctx.fillStyle = g; ctx.fillRect(0, y - 70, dims.w, 70)
        ctx.fillStyle = '#00f0ff'; ctx.fillRect(0, y, dims.w, 1.5)
        raf = requestAnimationFrame(paint)
      }
    }
    paint()
    return () => cancelAnimationFrame(raf)
  }, [img, dims, detections, selectedId, scanning])

  const handleClick = (e) => {
    const r = cv.current.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height
    const hit = detections
      .filter((d) => nx >= d.box.x && nx <= d.box.x + d.box.w && ny >= d.box.y && ny <= d.box.y + d.box.h)
      .sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0]
    onSelect?.(hit ? hit.id : null)
  }

  return (
    <div ref={wrap} className="flex w-full justify-center">
      <canvas
        ref={cv}
        onClick={handleClick}
        role="img"
        aria-label={`Sonar scan with ${detections.length} detections`}
        style={dims ? { width: dims.w, height: dims.h } : undefined}
        className={`cursor-crosshair rounded-lg ring-1 ring-glow/25 ${dims ? '' : 'hidden'}`}
      />
    </div>
  )
}
