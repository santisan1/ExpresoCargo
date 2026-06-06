import { resolveAlert } from '../services/firestoreService'
import { can, formatDate } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function AlertTable({ alerts = [], compact = false }) {
  const { profile } = useAuth()
  const visibleAlerts = compact ? alerts.filter((alert) => alert.status !== 'resolved') : alerts
  return <div className="table-wrap">
    <table className="data-table">
      <thead><tr><th>Estado</th><th>Severidad</th><th>Tipo</th><th>Guía</th><th>Mensaje</th>{!compact && <th>Creada</th>}{!compact && <th>Resuelta</th>}<th></th></tr></thead>
      <tbody>
        {visibleAlerts.length === 0 && <tr><td colSpan={compact ? 6 : 8} className="empty">Sin alertas para mostrar</td></tr>}
        {visibleAlerts.map((alert) => <tr key={alert.id}>
          <td><span className={alert.status === 'resolved' ? 'pill' : 'pill pill-hot'}>{alert.status === 'resolved' ? 'Resuelta' : 'Abierta'}</span></td>
          <td><span className={`severity severity-${alert.severity || 'medium'}`}>{alert.severity || 'medium'}</span></td>
          <td>{alert.type}</td><td>{alert.guideNumber || alert.packageId}</td><td>{alert.message}</td>{!compact && <td>{formatDate(alert.createdAt)}</td>}{!compact && <td>{alert.resolvedAt ? `${formatDate(alert.resolvedAt)} · ${alert.resolvedByName || alert.resolvedByUid || ''}` : '—'}</td>}
          <td>{alert.status !== 'resolved' && can(profile, 'alerts.resolve', ['supervisor']) ? <button className="btn btn-ghost" onClick={() => resolveAlert(alert, profile)}>Resolver</button> : null}</td>
        </tr>)}
      </tbody>
    </table>
  </div>
}
