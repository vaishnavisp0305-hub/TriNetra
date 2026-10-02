import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RefreshCw } from 'lucide-react'
import { api } from '../api'
import { RISKS, RISK_COLOR, displayName } from '../constants'

const tip = {
  contentStyle: { background: '#0b1220', border: '1px solid rgba(0,240,255,0.25)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
}
const axis = { stroke: '#475569', tick: { fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' } }

function Stat({ label, value, unit }) {
  return (
    <div className="glass p-4">
      <div className="tele">{label}</div>
      <div className="mt-1 font-mono text-3xl text-slate-100">
        {value}{unit && <span className="ml-1 text-sm text-slate-400">{unit}</span>}
      </div>
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('model') // 'model' | 'verified'

  const load = () => {
    setError(null)
    api.analytics().then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error) return <div className="glass p-6 text-rose-300">Could not load analytics: {error}</div>
  if (!data) return <div className="glass p-6 tele">Loading analytics…</div>

  const dist = source === 'model' ? data.risk_distribution : data.verified_risk_distribution
  const pie = RISKS.map((r) => ({ name: r, value: dist[r] || 0 }))
  const pieTotal = pie.reduce((a, b) => a + b.value, 0)
  const precision = data.operator_precision == null ? '–' : `${Math.round(data.operator_precision * 100)}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">System analytics</h2>
        <button className="btn-ghost" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="total scans" value={data.total_scans} />
        <Stat label="objects detected" value={data.total_detections} />
        <Stat label="avg detection latency" value={data.avg_latency_ms} unit="ms" />
        <Stat label="operator-confirmed" value={precision} unit={precision === '–' ? '' : '%'} />
      </div>

      {data.total_scans === 0 ? (
        <div className="glass p-8 text-center text-slate-400">No scans yet. Analyze a sonar image and the charts fill in here.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="glass p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-slate-100">Risk distribution</h3>
              <div className="flex gap-1 rounded-lg border border-white/10 p-0.5" role="group" aria-label="Data source">
                {[['model', 'Model output'], ['verified', 'Verified']].map(([id, label]) => (
                  <button key={id} onClick={() => setSource(id)} aria-pressed={source === id}
                    className={`rounded-md px-2 py-1 text-xs ${source === id ? 'bg-glow/15 text-glow' : 'text-slate-400 hover:text-slate-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {pieTotal === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">{source === 'verified' ? 'No confirmed detections saved yet.' : 'No detections yet.'}</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-56 flex-1">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pie} dataKey="value" innerRadius="58%" outerRadius="88%" stroke="#030712" strokeWidth={2}>
                        {pie.map((p) => <Cell key={p.name} fill={RISK_COLOR[p.name]} />)}
                      </Pie>
                      <Tooltip {...tip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 font-mono text-xs">
                  {pie.map((p) => (
                    <li key={p.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLOR[p.name] }} />
                      <span className="w-16 text-slate-300">{p.name}</span>
                      <span className="text-slate-400">{p.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="glass p-4">
            <h3 className="mb-2 font-medium text-slate-100">Detection latency <span className="tele">(ms, last 20 scans)</span></h3>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={data.latency_series}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="scan" {...axis} />
                  <YAxis {...axis} width={44} />
                  <Tooltip {...tip} />
                  <Line type="monotone" dataKey="ms" stroke="#00f0ff" strokeWidth={2} dot={{ r: 3, fill: '#00f0ff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="glass p-4 lg:col-span-2">
            <h3 className="mb-2 font-medium text-slate-100">Classification confidence log <span className="tele">(latest 40 detections, colored by risk)</span></h3>
            <div className="h-60">
              <ResponsiveContainer>
                <BarChart data={data.confidence_log}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="n" {...axis} />
                  <YAxis domain={[0, 1]} {...axis} width={44} />
                  <Tooltip {...tip} formatter={(v, _n, p) => [`${(v * 100).toFixed(1)}% · ${displayName(p.payload.cls)} · ${p.payload.risk}`, 'confidence']} />
                  <Bar dataKey="confidence" radius={[3, 3, 0, 0]}>
                    {data.confidence_log.map((r) => <Cell key={r.n} fill={RISK_COLOR[r.risk]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
