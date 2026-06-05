import { resolveAlert } from '../services/firestoreService'
import { can, formatDate } from '../utils/format'
import { useAuth } from '../context/AuthContext'

export default function AlertTable({ alerts = [], compact = false }) {
  const { profile } = useAuth()
  const openAlerts = alerts.filter((alert) => alert.status !== 'resolved')
  return <div className="table-wrap">
    <table className="data-table">
      <thead><tr><th>Severidad</th><th>Tipo</th><th>Guía</th><th>Mensaje</th>{!compact && <th>Creada</th>}<th></th></tr></thead>
      <tbody>
        {openAlerts.length === 0 && <tr><td colSpan={compact ? 5 : 6} className="empty">Sin alertas abiertas</td></tr>}
        {openAlerts.map((alert) => <tr key={alert.id}>
          <td><span className={`severity severity-${alert.severity || 'medium'}`}>{alert.severity || 'medium'}</span></td>
          <td>{alert.type}</td><td>{alert.guideNumber}</td><td>{alert.message}</td>{!compact && <td>{formatDate(alert.createdAt)}</td>}
          <td>{can(profile, 'alerts.resolve', ['supervisor']) && <button className="btn btn-ghost" onClick={() => resolveAlert(alert, profile)}>Resolver</button>}</td>
        </tr>)}
      </tbody>
    </table>
  </div>
}
