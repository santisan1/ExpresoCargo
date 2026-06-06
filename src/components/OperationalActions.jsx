import { useMemo, useState } from 'react'
import ActionModal from './ActionModal'
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

const ACTION_COPY = {
  received: ['Recepcionar paquete', 'Confirmá la recepción del paquete en el punto operativo.', 'Notas del movimiento (opcional)'],
  classified: ['Clasificar paquete', 'Confirmá la clasificación automática/manual y dejá una nota si corresponde.', 'Notas del movimiento (opcional)'],
  dispatched: ['Despachar paquete', 'Confirmá la salida a distribución.', 'Notas del movimiento (opcional)'],
  delivered: ['Entregar paquete', 'Confirmá la entrega final. El sistema cerrará alertas abiertas relacionadas.', 'Notas del movimiento (opcional)'],
  incident: ['Marcar incidencia', 'Registrá el motivo operativo para trazabilidad y alertas.', 'Detalle de incidencia'],
}

export default function OperationalActions({ pkg, onDone }) {
  const { profile } = useAuth(); const { zones, rules } = useData(); const [busy, setBusy] = useState(''); const [error, setError] = useState('')
  const [modal, setModal] = useState(null); const [notes, setNotes] = useState('')
  const status = pkg.currentStatus
  const actions = useMemo(() => (ACTIONS[status] || []).filter((action) => can(profile, action.permission, action.roles)), [profile, status])
  const canMarkIncident = !['delivered', 'incident'].includes(status) && can(profile, 'packages.incident', ['operario', 'supervisor'])
  function openModal(nextStatus) { setError(''); setNotes(''); setModal(nextStatus) }
  async function confirm() {
    const nextStatus = modal
    if (!nextStatus || busy) return
    if (nextStatus === 'incident' && !notes.trim()) return
    setBusy(nextStatus); setError('')
    try { await changePackageStatus(pkg, nextStatus, { profile, zones, rules, notes: notes.trim(), incidentReason: notes.trim() }); setModal(null); await onDone?.() } catch (err) { setError(err.message || 'No se pudo aplicar la transición') } finally { setBusy('') }
  }
  if (status === 'delivered') return <div className="ops-actions"><div className="success-box">Flujo completado. No hay acciones operativas principales.</div></div>
  const copy = ACTION_COPY[modal] || []
  return <div className="ops-actions">
    {status === 'incident' && <div className="error-box">Estado de incidencia: {pkg.incidentReason || 'requiere revisión operativa'}.</div>}
    {error && !modal && <div className="error-box">{error}</div>}
    <div className="detail-grid checkpoint-grid"><span>Punto de control</span><strong>{CHECKPOINT_BY_STATUS[actions[0]?.status] || CHECKPOINT_BY_STATUS.incident}</strong></div>
    <div className="actions wrap">
      {actions.map((action) => <button key={action.status} className={`btn ${action.primary ? 'btn-primary' : ''} ${action.success ? 'btn-success' : ''}`} disabled={Boolean(busy)} onClick={() => openModal(action.status)}>{busy === action.status ? 'Guardando...' : action.label}</button>)}
      {canMarkIncident && <button className="btn btn-danger" disabled={Boolean(busy)} onClick={() => openModal('incident')}>{busy === 'incident' ? 'Guardando...' : 'Marcar incidencia'}</button>}
      {actions.length === 0 && !canMarkIncident && <p className="muted">No hay acciones disponibles para tu rol en este estado.</p>}
    </div>
    <ActionModal open={Boolean(modal)} title={copy[0]} description={copy[1]} fieldLabel={copy[2]} required={modal === 'incident'} value={notes} onChange={setNotes} loading={Boolean(busy)} error={error} onCancel={() => !busy && setModal(null)} onConfirm={confirm} />
  </div>
}
