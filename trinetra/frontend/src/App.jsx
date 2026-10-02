import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, Network, Radar, RotateCcw, UploadCloud } from 'lucide-react'
import { api } from './api'
import SonarCanvas, { RadarFeed } from './components/SonarCanvas'
import UploadZone from './components/UploadZone'
import VerificationPanel from './components/VerificationPanel'
import Analytics from './components/Analytics'
import Architecture from './components/Architecture'

const TABS = [
  { id: 'feed', label: 'Live feed', icon: Activity },
  { id: 'analyze', label: 'Analyze scan', icon: UploadCloud },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'architecture', label: 'Architecture', icon: Network },
]

export default function App() {
  const [tab, setTab] = useState('analyze')
  const [clock, setClock] = useState(() => new Date())
  const [link, setLink] = useState(null) // null=checking, object=online, false=offline

  const [scan, setScan] = useState(null)
  const [dets, setDets] = useState([])
  const [meta, setMeta] = useState(null)
  const [selected, setSelected] = useState(null)
  const [stage, setStage] = useState(null)
  const [error, setError] = useState(null)
  const [threshold, setThreshold] = useState(0.35)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [contacts, setContacts] = useState([])

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const ping = () => api.health().then(setLink).catch(() => setLink(false))
    ping()
    const t = setInterval(ping, 10000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Confidence gate: the server returns everything >= 0.10; the operator's threshold filters the view.
  const visible = useMemo(() => dets.filter((d) => d.manual || d.confidence >= threshold), [dets, threshold])

  const runFile = useCallback(async (file) => {
    setError(null); setDets([]); setSelected(null); setMeta(null); setScan(null)
    try {
      setStage('Filtering noise (despeckle + CLAHE)…')
      const s = await api.upload(file)
      setScan(s)
      setStage('Running detector…')
      const p = await api.predict(s.image_id, 0.1)
      setDets(p.detections.map((d) => ({ ...d, status: 'pending' })))
      setMeta({ latency: p.latency_ms, model: p.model, demo: p.demo_mode, pre: s.preprocess_ms })
    } catch (e) {
      setError(e.message)
      setScan(null)
    } finally {
      setStage(null)
    }
  }, [])

  const updateDet = (id, patch) => setDets((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const addManual = () => {
    const id = `m-${Date.now()}`
    setDets((all) => [...all, {
      id, cls: 'cube', confidence: 1, risk: 'Medium', manual: true, status: 'pending',
      box: { x: 0.4, y: 0.4, w: 0.15, h: 0.15 },
    }])
    setSelected(id)
  }

  const reset = () => { setScan(null); setDets([]); setMeta(null); setSelected(null); setError(null) }

  const submit = async ({ operator, log }) => {
    setSaving(true); setError(null)
    try {
      const r = await api.verify({
        image_id: scan.image_id, operator, log,
        detections: visible.map((d) => ({
          id: d.id, cls: d.cls, confidence: d.confidence, risk: d.risk, box: d.box,
          status: d.status, edited: !!d.edited, manual: !!d.manual,
        })),
      })
      setToast(`Saved ${r.saved} records (${r.confirmed} confirmed, ${r.rejected} rejected)`)
      reset()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const onContact = useCallback((c) => setContacts((l) => [{ ...c, t: new Date() }, ...l].slice(0, 8)), [])

  const dot = link ? 'bg-emerald-400' : link === false ? 'bg-rose-500' : 'bg-amber-400'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-glow/10 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Radar className="text-glow drop-shadow-[0_0_8px_#00f0ff]" size={26} />
            <div>
              <div className="text-lg font-semibold leading-none tracking-wide text-slate-50">TRINETRA</div>
              <div className="tele mt-0.5">AI-powered sonar intelligence</div>
            </div>
          </div>

          <nav className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto" aria-label="Sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                className={`btn shrink-0 ${tab === id ? 'bg-glow/10 text-glow shadow-[inset_0_-2px_0_#00f0ff]' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>

          <div className="tele flex items-center gap-3 text-right">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              {link ? (link.demo_mode ? 'api online · demo model' : 'api online') : link === false ? 'api offline' : 'connecting…'}
            </span>
            <span>{clock.toISOString().slice(11, 19)} UTC</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {toast && <div role="status" className="glass mb-4 border-emerald-400/40 px-4 py-2 text-sm text-emerald-300">{toast}</div>}
        {error && (
          <div role="alert" className="glass mb-4 flex items-start gap-2 border-rose-400/40 px-4 py-3 text-sm text-rose-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {tab === 'feed' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="glass p-4">
              <RadarFeed onContact={onContact} />
              <p className="tele mt-3 text-center">simulated feed · sweep 1.1 rad/s · range 100 m</p>
            </div>
            <aside className="glass p-4">
              <h2 className="mb-3 font-semibold text-slate-100">Contact log</h2>
              {contacts.length === 0 ? (
                <p className="text-sm text-slate-400">Waiting for the sweep to reach a contact…</p>
              ) : (
                <ul className="space-y-2 font-mono text-xs">
                  {contacts.map((c) => (
                    <li key={c.id + c.t} className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className={c.strong ? 'text-amber-300' : 'text-glow'}>{c.id}</span>
                      <span className="text-slate-400">brg {String(c.bearing).padStart(3, '0')}° · {c.range} m</span>
                      <span className="text-slate-500">{c.t.toISOString().slice(11, 19)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}

        {tab === 'analyze' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-3">
              {!scan ? (
                <UploadZone onFile={runFile} busyText={stage} />
              ) : (
                <div className="glass space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="tele">
                      {scan.filename} · {scan.width}×{scan.height}
                      {meta && ` · filter ${meta.pre} ms · inference ${meta.latency} ms`}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="tele flex items-center gap-2">
                        confidence ≥ {Math.round(threshold * 100)}%
                        <input
                          type="range" min="0.1" max="0.9" step="0.05" value={threshold}
                          onChange={(e) => setThreshold(+e.target.value)}
                          className="w-32 accent-[#00f0ff]" aria-label="Confidence threshold"
                        />
                      </label>
                      <button className="btn-ghost" onClick={reset}><RotateCcw size={14} /> New scan</button>
                    </div>
                  </div>
                  {meta?.demo && (
                    <p className="flex items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
                      <AlertTriangle size={14} /> Demo mode: no trained model is loaded, so the app can only mark bright acoustic contacts. It cannot name objects. Pick the class yourself, or train the model (backend/training/README.md).
                    </p>
                  )}
                  <SonarCanvas
                    imageUrl={scan.url} detections={visible} selectedId={selected}
                    onSelect={setSelected} scanning={!!stage}
                  />
                  {stage && <p className="text-center font-mono text-sm text-glow">{stage}</p>}
                </div>
              )}
            </div>

            <VerificationPanel
              detections={visible} selectedId={selected} hasScan={!!scan && !stage} saving={saving}
              onSelect={setSelected} onChange={updateDet} onAdd={addManual} onSubmit={submit}
            />
          </div>
        )}

        {tab === 'analytics' && <Analytics />}
        {tab === 'architecture' && <Architecture />}
      </main>
    </div>
  )
}
