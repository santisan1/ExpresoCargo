import { useState } from 'react'
import { changePackageStatus } from '../services/firestoreService'
import { can } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function OperationalActions({ pkg }) {
  const { profile } = useAuth(); const { zones, rules, settings } = useData(); const [busy, setBusy] = useState('')
  const scanPoints = settings.scanPoints || ['Recepción', 'Clasificación', 'Dock despacho', 'Entrega']
  const [scanPoint, setScanPoint] = useState(scanPoints[0] || 'Escaneo operativo')
  async function run(status) {
    const notes = status === 'incident' ? window.prompt('Nota de incidencia') : window.prompt('Notas del movimiento (opcional)', '')
    if (status === 'incident' && !notes) return
    setBusy(status)
    try { await changePackageStatus(pkg, status, { profile, zones, rules, scanPoint, notes: notes || '', incidentReason: notes || '' }) } finally { setBusy('') }
  }
  const status = pkg.currentStatus
  return <div className="ops-actions"><label>Punto de control<select value={scanPoint} onChange={(e) => setScanPoint(e.target.value)}>{scanPoints.map((p) => <option key={p}>{p}</option>)}</select></label><div className="actions wrap">
    {status === 'created' && can(profile, 'packages.receive', ['operario','supervisor']) && <button className="btn" disabled={busy} onClick={() => run('received')}>Recepcionar</button>}
    {['created','received'].includes(status) && can(profile, 'packages.classify', ['operario','supervisor']) && <button className="btn btn-primary" disabled={busy} onClick={() => run('classified')}>Clasificar</button>}
    {['classified','incident'].includes(status) && can(profile, 'packages.dispatch', ['supervisor']) && <button className="btn" disabled={busy} onClick={() => run('dispatched')}>Despachar</button>}
    {status === 'dispatched' && can(profile, 'packages.deliver', ['supervisor']) && <button className="btn btn-success" disabled={busy} onClick={() => run('delivered')}>Entregar</button>}
    {!['delivered','incident'].includes(status) && can(profile, 'packages.incident', ['operario','supervisor']) && <button className="btn btn-danger" disabled={busy} onClick={() => run('incident')}>Marcar incidencia</button>}
  </div></div>
}
