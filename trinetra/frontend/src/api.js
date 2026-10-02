const ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:8000'
const BASE = `${ORIGIN}/api/v1/sonar`

async function handle(res) {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch { /* keep default message */ }
    throw new Error(msg)
  }
  return res.json()
}

// Abort slow requests so the UI shows an error instead of spinning forever.
async function timed(url, opts = {}, ms = 120000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`No response from the API after ${Math.round(ms / 1000)}s. Is the backend running at ${ORIGIN}?`)
    throw new Error(`Cannot reach the API at ${ORIGIN}. Start the backend (uvicorn app.main:app --port 8000).`)
  } finally {
    clearTimeout(t)
  }
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  health: () => timed(`${ORIGIN}/health`, {}, 4000).then(handle),
  async upload(file) {
    const fd = new FormData()
    fd.append('file', file)
    const r = await handle(await timed(`${BASE}/upload`, { method: 'POST', body: fd }))
    return { ...r, url: `${ORIGIN}${r.preview_url}` }
  },
  predict: (image_id, conf = 0.1) => timed(`${BASE}/predict`, json({ image_id, conf })).then(handle),
  verify: (payload) => timed(`${BASE}/verify`, json(payload)).then(handle),
  analytics: () => timed(`${BASE}/analytics`).then(handle),
}
