import { useState } from 'react'
import { Check, Loader2, Plus, ShieldCheck, X } from 'lucide-react'
import { CLASS_OPTIONS, CLASS_RISK, RISKS, RISK_COLOR, displayName } from '../constants'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function BoxField({ label, value, onCommit }) {
  // Uncontrolled + commit on blur/Enter so partial typing ("1.") isn't clobbered.
  return (
    <label className="block">
      <span className="tele">{label} %</span>
      <input
        key={value}
        type="number" step="0.5" min="0" max="100"
        defaultValue={(value * 100).toFixed(1)}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="field mt-0.5"
      />
    </label>
  )
}

function DetectionCard({ d, selected, onSelect, onChange }) {
  const setBox = (k, pct) => {
    const v = clamp((parseFloat(pct) || 0) / 100, k === 'w' || k === 'h' ? 0.005 : 0, 1)
    const next = { ...d.box, [k]: v }
    if (next.x + next.w > 1) { if (k === 'x') next.x = 1 - next.w; else next.w = 1 - next.x }
    if (next.y + next.h > 1) { if (k === 'y') next.y = 1 - next.h; else next.h = 1 - next.y }
    onChange(d.id, { box: next, edited: true })
  }
  const color = RISK_COLOR[d.risk]

  return (
    <li
      className={`rounded-lg border p-3 transition-colors ${selected ? 'border-glow/60 bg-glow/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}
    >
      <button onClick={() => onSelect(d.id)} className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={selected}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span className="truncate font-medium text-slate-100">{displayName(d.cls)}</span>
          <span className="tele">{d.manual ? 'manual' : `${(d.confidence * 100).toFixed(1)}%`}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded px-1.5 py-0.5 font-mono text-[11px]" style={{ color, background: `${color}22` }}>{d.risk}</span>
          {d.status === 'confirmed' && <Check size={15} className="text-emerald-400" aria-label="confirmed" />}
          {d.status === 'rejected' && <X size={15} className="text-rose-400" aria-label="rejected" />}
        </span>
      </button>

      {selected && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="tele">class</span>
              <select
                className="field mt-0.5" value={d.cls}
                onChange={(e) => onChange(d.id, { cls: e.target.value, risk: CLASS_RISK[e.target.value] || d.risk, edited: true })}
              >
                {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{displayName(c)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="tele">risk priority</span>
              <select className="field mt-0.5" value={d.risk} onChange={(e) => onChange(d.id, { risk: e.target.value, edited: true })}>
                {RISKS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['x', 'y', 'w', 'h'].map((k) => (
              <BoxField key={k} label={k} value={d.box[k]} onCommit={(v) => setBox(k, v)} />
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-glow flex-1" onClick={() => onChange(d.id, { status: 'confirmed' })}>
              <Check size={15} /> Confirm detection
            </button>
            <button className="btn-ghost flex-1 hover:!border-rose-400/50 hover:!text-rose-300" onClick={() => onChange(d.id, { status: 'rejected' })}>
              <X size={15} /> Reject
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function VerificationPanel({ detections, selectedId, hasScan, saving, onSelect, onChange, onAdd, onSubmit }) {
  const [operator, setOperator] = useState('operator-01')
  const [log, setLog] = useState('')
  const undecided = detections.filter((d) => d.status === 'pending').length
  const canSave = hasScan && detections.length > 0 && undecided === 0 && !saving

  return (
    <section className="glass flex flex-col gap-4 p-4" aria-label="Human verification">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
          <ShieldCheck size={18} className="text-glow" /> Operator verification
        </h2>
        <span className="tele">{detections.length - undecided}/{detections.length} decided</span>
      </header>

      {!hasScan && <p className="text-sm text-slate-400">Upload a side-scan image. Detections appear here for you to confirm or reject before anything is stored.</p>}
      {hasScan && detections.length === 0 && (
        <p className="text-sm text-slate-400">No detections above the confidence threshold. Lower the threshold, or add an object the model missed.</p>
      )}

      <ul className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
        {detections.map((d) => (
          <DetectionCard key={d.id} d={d} selected={d.id === selectedId} onSelect={onSelect} onChange={onChange} />
        ))}
      </ul>

      {hasScan && (
        <button className="btn-ghost" onClick={onAdd}><Plus size={15} /> Add missed object</button>
      )}

      <div className="space-y-2 border-t border-white/10 pt-3">
        <label className="block">
          <span className="tele">operator</span>
          <input className="field mt-0.5" value={operator} maxLength={64} onChange={(e) => setOperator(e.target.value)} />
        </label>
        <label className="block">
          <span className="tele">inspection log</span>
          <textarea
            className="field mt-0.5 min-h-[76px] resize-y" value={log} maxLength={4000}
            placeholder="Sea state, sensor notes, why a detection was rejected…"
            onChange={(e) => setLog(e.target.value)}
          />
        </label>
        <button
          className="btn-glow w-full" disabled={!canSave}
          onClick={async () => { if (await onSubmit({ operator: operator.trim() || 'operator', log })) setLog('') }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {saving ? 'Saving…' : undecided ? `Decide ${undecided} more to save` : 'Save verified records'}
        </button>
      </div>
    </section>
  )
}
