import { useMemo, useState } from 'react'
import { changePackageStatus } from '../services/firestoreService'
import { can } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const ACTIONS = {
  created: [{ status: 'received', label: 'Recepcionar', permission: 'packages.receive', roles: ['operario', 'supervisor'] }],
  received: [{ status: 'classified', label: 'Clasificar', permission: 'packages.classify', roles: ['operario', 'supervisor'], primary: true }],
  classified: [{ status: 'dispatched', label: 'Despachar', permission: 'packages.dispatch', roles: ['supervisor'] }],
  dispatched: [{ status: 'delivered', label: 'Entregar', permission: 'packages.deliver', roles: ['supervisor'], success: true }],
  incident: [{ status: 'classified', label: 'Resolver y clasificar', permission: 'packages.classify', roles: ['supervisor'], primary: true }],
}

const CHECKPOINT_BY_STATUS = {
  received: 'Recepción',
  classified: 'Clasificación',
  dispatched: 'Despacho',
  delivered: 'Entrega',
  incident: 'Incidencias',
}

export default function OperationalActions({ pkg, onDone }) {
  const { profile } = useAuth(); const { zones, rules } = useData(); const [busy, setBusy] = useState(''); const [error, setError] = useState('')
  const status = pkg.currentStatus
  const actions = useMemo(() => (ACTIONS[status] || []).filter((action) => can(profile, action.permission, action.roles)), [profile, status])
  const canMarkIncident = !['delivered', 'incident'].includes(status) && can(profile, 'packages.incident', ['operario', 'supervisor'])
  async function run(nextStatus) {
    if (busy) return
    const notes = nextStatus === 'incident' ? window.prompt('Nota de incidencia') : window.prompt('Notas del movimiento (opcional)', '')
    if (nextStatus === 'incident' && !notes) return
    setBusy(nextStatus); setError('')
    try { await changePackageStatus(pkg, nextStatus, { profile, zones, rules, notes: notes || '', incidentReason: notes || '' }); await onDone?.() } catch (err) { setError(err.message || 'No se pudo aplicar la transición') } finally { setBusy('') }
  }
  if (status === 'delivered') return <div className="ops-actions"><div className="success-box">Flujo completado. No hay acciones operativas principales.</div></div>
  return <div className="ops-actions">
    {status === 'incident' && <div className="error-box">Estado de incidencia: {pkg.incidentReason || 'requiere revisión operativa'}.</div>}
    {error && <div className="error-box">{error}</div>}
    <div className="detail-grid checkpoint-grid"><span>Punto de control</span><strong>{CHECKPOINT_BY_STATUS[actions[0]?.status] || CHECKPOINT_BY_STATUS.incident}</strong></div>
    <div className="actions wrap">
      {actions.map((action) => <button key={action.status} className={`btn ${action.primary ? 'btn-primary' : ''} ${action.success ? 'btn-success' : ''}`} disabled={Boolean(busy)} onClick={() => run(action.status)}>{busy === action.status ? 'Guardando...' : action.label}</button>)}
      {canMarkIncident && <button className="btn btn-danger" disabled={Boolean(busy)} onClick={() => run('incident')}>{busy === 'incident' ? 'Guardando...' : 'Marcar incidencia'}</button>}
      {actions.length === 0 && !canMarkIncident && <p className="muted">No hay acciones disponibles para tu rol en este estado.</p>}
    </div>
  </div>
}
