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
  incident: ['Marcar incidencia', 'Seleccioná el tipo y registrá el detalle operativo para trazabilidad y alertas.', 'Nota / detalle de incidencia'],
}

const INCIDENT_TYPES = ['Etiqueta dañada', 'Destino incorrecto', 'Paquete demorado', 'Paquete dañado', 'Datos incompletos', 'Error de clasificación', 'Otro']

export default function OperationalActions({ pkg, onDone }) {
  const { profile } = useAuth(); const { zones, rules, alerts } = useData(); const [busy, setBusy] = useState(''); const [error, setError] = useState('')
  const [modal, setModal] = useState(null); const [notes, setNotes] = useState(''); const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0])
  const status = pkg.currentStatus
  const actions = useMemo(() => (ACTIONS[status] || []).filter((action) => can(profile, action.permission, action.roles)), [profile, status])
  const openIncidentAlerts = (alerts || []).filter((alert) => alert.packageId === pkg.id && alert.status !== 'resolved')
  const hasActiveIncident = status === 'incident' || openIncidentAlerts.some((alert) => alert.type === 'incident' || alert.type === 'wrong_zone')
  const canMarkIncident = !['delivered', 'incident'].includes(status) && can(profile, 'packages.incident', ['operario', 'supervisor'])
  const isOperatorWaitingDispatch = status === 'classified' && profile?.role === 'operario'
  function openModal(nextStatus) { setError(''); setNotes(''); setIncidentType(INCIDENT_TYPES[0]); setModal(nextStatus) }
  async function confirm() {
    const nextStatus = modal
    if (!nextStatus || busy) return
    if (nextStatus === 'incident' && !notes.trim()) return
    setBusy(nextStatus); setError('')
    try { await changePackageStatus(pkg, nextStatus, { profile, zones, rules, notes: notes.trim(), incidentReason: notes.trim(), incidentType }); setModal(null); await onDone?.() } catch (err) { setError(err.message || 'No se pudo aplicar la transición') } finally { setBusy('') }
  }
  if (status === 'delivered') return <div className="ops-actions"><div className="success-box">Flujo completado. No hay acciones operativas principales.</div></div>
  const copy = ACTION_COPY[modal] || []
  return <div className="ops-actions">
    {hasActiveIncident && <div className="error-box">Incidencia activa: {pkg.incidentType ? `${pkg.incidentType} · ` : ''}{pkg.incidentReason || 'requiere revisión operativa'}.</div>}
    {status === 'incident' && can(profile, 'alerts.resolve', ['supervisor']) && <div className="warning-box">Usá la acción “Resolver y continuar” en la alerta abierta para limpiar la incidencia y volver al flujo operativo.</div>}
    {isOperatorWaitingDispatch && <div className="warning-box">Clasificación finalizada. Pendiente de despacho por supervisor.</div>}
    {error && !modal && <div className="error-box">{error}</div>}
    <div className="detail-grid checkpoint-grid"><span>Punto de control</span><strong>{CHECKPOINT_BY_STATUS[actions[0]?.status] || CHECKPOINT_BY_STATUS.incident}</strong></div>
    <div className="actions wrap">
      {actions.map((action) => <button key={action.status} className={`btn ${action.primary ? 'btn-primary' : ''} ${action.success ? 'btn-success' : ''}`} disabled={Boolean(busy)} onClick={() => openModal(action.status)}>{busy === action.status ? 'Guardando...' : action.label}</button>)}
      {canMarkIncident && <button className="btn btn-danger" disabled={Boolean(busy)} onClick={() => openModal('incident')}>{busy === 'incident' ? 'Guardando...' : 'Marcar incidencia'}</button>}
      {actions.length === 0 && !canMarkIncident && <p className="muted">No hay acciones disponibles para tu rol en este estado.</p>}
    </div>
    <ActionModal open={Boolean(modal)} title={copy[0]} description={copy[1]} fieldLabel={copy[2]} required={modal === 'incident'} value={notes} onChange={setNotes} loading={Boolean(busy)} error={error} onCancel={() => !busy && setModal(null)} onConfirm={confirm}>
      {modal === 'incident' && <label>Tipo de incidencia *<select value={incidentType} onChange={(event) => setIncidentType(event.target.value)}>{INCIDENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}
    </ActionModal>
  </div>
}
