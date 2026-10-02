import { useRef, useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'

const OK = ['.png', '.tif', '.tiff', '.dcm', '.dicom', '.jpg', '.jpeg']

export default function UploadZone({ onFile, busyText }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState(null)

  const take = (file) => {
    if (!file) return
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!OK.includes(ext)) return setErr(`${ext || 'That file'} isn't supported. Use PNG, TIFF or DICOM.`)
    setErr(null)
    onFile(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]) }}
      className={`glass flex min-h-[420px] flex-col items-center justify-center gap-3 border-dashed p-8 text-center transition-colors ${over ? '!border-glow bg-glow/[0.06]' : ''}`}
    >
      {busyText ? (
        <>
          <Loader2 className="animate-spin text-glow" size={36} />
          <p className="font-mono text-sm text-glow">{busyText}</p>
        </>
      ) : (
        <>
          <UploadCloud size={40} className="text-glow" />
          <p className="text-lg font-medium text-slate-100">Drop a side-scan sonar image</p>
          <p className="tele">PNG · TIFF · DICOM · up to 25 MB</p>
          <button className="btn-glow mt-2" onClick={() => input.current.click()}>Choose file</button>
          <input ref={input} type="file" hidden accept={OK.join(',')} onChange={(e) => { take(e.target.files[0]); e.target.value = '' }} />
        </>
      )}
      {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
    </div>
  )
}
