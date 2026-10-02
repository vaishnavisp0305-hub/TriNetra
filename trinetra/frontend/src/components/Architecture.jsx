import { useState } from 'react'
import { ChevronRight, Database, Eye, Filter, Gauge, Server, ShieldCheck, LayoutDashboard, BrainCircuit } from 'lucide-react'

const PIPELINE = [
  { id: 'ui', icon: LayoutDashboard, title: 'React console', tech: 'React · Vite · Tailwind · Recharts',
    what: 'Operators upload scans, watch the simulated feed, review detections and read analytics.',
    where: 'frontend/src/App.jsx' },
  { id: 'api', icon: Server, title: 'FastAPI gateway', tech: 'Python · FastAPI · Pydantic',
    what: 'Validates requests, serves processed images and exposes four versioned endpoints.',
    where: 'backend/app/main.py', endpoint: '/api/v1/sonar/*' },
  { id: 'cv', icon: Filter, title: 'OpenCV filtering', tech: 'Non-local-means · median · CLAHE',
    what: 'Decodes PNG/TIFF/DICOM, removes speckle noise and lifts local contrast before inference.',
    where: 'backend/app/preprocess.py', endpoint: 'POST /upload' },
  { id: 'model', icon: BrainCircuit, title: 'PyTorch inference', tech: 'YOLOv8 · UATD weights · Torchvision',
    what: 'Returns boxes, class, confidence and a risk priority. Falls back to a flagged demo heuristic when no weights exist.',
    where: 'backend/app/detector.py', endpoint: 'POST /predict' },
  { id: 'gate', icon: Gauge, title: 'Confidence gate', tech: 'Operator-set threshold',
    what: 'Low-confidence detections are hidden from review so operators focus on what matters. Manual additions bypass the gate.',
    where: 'frontend/src/App.jsx (threshold slider)' },
  { id: 'human', icon: ShieldCheck, title: 'Human verification', tech: 'Confirm · reject · edit · log',
    what: 'Nothing is stored until an operator decides on every detection. Edited boxes and notes travel with the record.',
    where: 'frontend/src/components/VerificationPanel.jsx', endpoint: 'POST /verify' },
  { id: 'db', icon: Database, title: 'Result storage', tech: 'SQLite → PostgreSQL',
    what: 'Scans, model output and verified records. Analytics are aggregated straight from these tables.',
    where: 'backend/app/db.py', endpoint: 'GET /analytics' },
]

const OFFLINE = {
  id: 'data', icon: Eye, title: 'Dataset & training (offline)', tech: 'UATD · SIH PS 26057 · PyTorch · OpenCV',
  what: 'UATD side-scan sonar dataset, converted to YOLO format, augmented and used to train the detector. Verified records can seed the next labeled set.',
  where: 'backend/weights/uatd_yolov8.pt',
}

export default function Architecture() {
  const [sel, setSel] = useState('model')
  const node = [...PIPELINE, OFFLINE].find((n) => n.id === sel)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">How a scan moves through TRINETRA</h2>
      <div className="glass p-4">
        <ol className="flex flex-wrap items-stretch gap-y-3">
          {PIPELINE.map((n, i) => {
            const Icon = n.icon
            const on = sel === n.id
            return (
              <li key={n.id} className="flex items-center">
                <button
                  onClick={() => setSel(n.id)} aria-pressed={on}
                  className={`flex h-24 w-32 flex-col items-start justify-between rounded-lg border p-2.5 text-left transition-all ${on ? 'border-glow bg-glow/10 shadow-[0_0_20px_rgba(0,240,255,0.25)]' : 'border-white/10 hover:border-glow/40'}`}
                >
                  <Icon size={18} className={on ? 'text-glow' : 'text-slate-400'} />
                  <span className="text-sm font-medium leading-tight text-slate-100">{n.title}</span>
                </button>
                {i < PIPELINE.length - 1 && <ChevronRight size={18} className="mx-1 shrink-0 text-glow/50" aria-hidden />}
              </li>
            )
          })}
        </ol>
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
          <span className="tele">feeds the model:</span>
          <button
            onClick={() => setSel('data')} aria-pressed={sel === 'data'}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${sel === 'data' ? 'border-glow bg-glow/10 text-glow' : 'border-white/10 text-slate-300 hover:border-glow/40'}`}
          >
            <Eye size={16} /> {OFFLINE.title}
          </button>
        </div>
      </div>

      <div className="glass space-y-3 p-5">
        <h3 className="text-xl font-semibold text-slate-100">{node.title}</h3>
        <p className="max-w-prose text-slate-300">{node.what}</p>
        <dl className="grid gap-3 font-mono text-xs sm:grid-cols-3">
          <div><dt className="text-slate-500">stack</dt><dd className="mt-0.5 text-glow">{node.tech}</dd></div>
          <div><dt className="text-slate-500">source</dt><dd className="mt-0.5 text-slate-300">{node.where}</dd></div>
          {node.endpoint && <div><dt className="text-slate-500">endpoint</dt><dd className="mt-0.5 text-slate-300">{node.endpoint}</dd></div>}
        </dl>
      </div>
    </div>
  )
}
