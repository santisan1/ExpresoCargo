import { useState } from 'react'
import ActionModal from './ActionModal'
import { resolveAlert } from '../services/firestoreService'
import { can, formatDate } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function AlertTable({ alerts = [], compact = false }) {
  const { profile } = useAuth(); const [selected, setSelected] = useState(null); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const visibleAlerts = compact ? alerts.filter((alert) => alert.status !== 'resolved') : alerts
  async function confirmResolve() {
    if (!selected || busy) return
    setBusy(true); setError('')
    try { await resolveAlert(selected, profile, note.trim()); setSelected(null); setNote('') } catch (err) { setError(err.message || 'No se pudo resolver la alerta') } finally { setBusy(false) }
  }
  return <div className="table-wrap">
    <table className="data-table">
      <thead><tr><th>Estado</th><th>Severidad</th><th>Tipo</th>{!compact && <th>Incidencia</th>}{!compact && <th>Etapa</th>}<th>Guía</th><th>Mensaje</th>{!compact && <th>Creada</th>}{!compact && <th>Resuelta</th>}<th></th></tr></thead>
      <tbody>
        {visibleAlerts.length === 0 && <tr><td colSpan={compact ? 6 : 10} className="empty">Sin alertas para mostrar</td></tr>}
        {visibleAlerts.map((alert) => <tr key={alert.id}>
          <td><span className={alert.status === 'resolved' ? 'pill' : 'pill pill-hot'}>{alert.status === 'resolved' ? 'Resuelta' : 'Abierta'}</span></td>
          <td><span className={`severity severity-${alert.severity || 'medium'}`}>{alert.severity || 'medium'}</span></td>
          <td>{alert.type}</td>{!compact && <td>{alert.incidentType || '—'}</td>}{!compact && <td>{alert.incidentCheckpoint || alert.incidentStage || '—'}</td>}<td>{alert.guideNumber || '—'}</td><td>{alert.message}</td>{!compact && <td>{formatDate(alert.createdAt)}</td>}{!compact && <td>{alert.resolvedAt ? `${formatDate(alert.resolvedAt)} · ${alert.resolvedByName || 'Usuario operativo'}` : '—'}</td>}
          <td>{alert.status !== 'resolved' && can(profile, 'alerts.resolve', ['supervisor']) ? <button className="btn btn-ghost" onClick={() => { setSelected(alert); setNote(''); setError('') }}>Resolver y continuar</button> : null}</td>
        </tr>)}
      </tbody>
    </table>
    <ActionModal open={Boolean(selected)} title="Resolver y continuar" description="Confirmá la resolución. Si no quedan alertas abiertas, se limpiará la incidencia activa del paquete y volverá al último estado operativo válido." fieldLabel="Nota de resolución (opcional)" value={note} onChange={setNote} loading={busy} error={error} onCancel={() => !busy && setSelected(null)} onConfirm={confirmResolve} />
  </div>
}
