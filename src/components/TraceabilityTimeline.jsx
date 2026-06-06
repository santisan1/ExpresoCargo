import StatusBadge from './StatusBadge'
import { formatDate, STATUS_META, toDate } from '../utils/format'
import { buildUsersMap, getOperationalUserName } from '../utils/userDisplay'

const TITLES = { created: 'Alta de paquete', received: 'Recepción', classified: 'Clasificación', dispatched: 'Despacho', delivered: 'Entrega', incident: 'Incidencia' }
const CHECKPOINTS = { created: 'Pre-guía', received: 'Recepción', classified: 'Clasificación', dispatched: 'Despacho', delivered: 'Entrega', incident: 'Incidencias' }

export default function TraceabilityTimeline({ movements = [], users = [] }) {
  const usersById = buildUsersMap(users)
  const sorted = [...movements].sort((a, b) => (toDate(a.scannedAt)?.getTime() || 0) - (toDate(b.scannedAt)?.getTime() || 0))
  return <div className="timeline">
    {sorted.length === 0 && <p className="empty">Sin movimientos registrados.</p>}
    {sorted.map((movement) => {
      const userName = getOperationalUserName(movement.scannedByUid, movement.scannedByName || movement.scannedBy, usersById)
      return <article className="timeline-item" key={movement.id}>
        <div className="dot" /><div><h4>{movement.title || TITLES[movement.status] || movement.scanPoint || 'Movimiento operativo'}</h4><div className="timeline-meta"><span>Estado: <StatusBadge status={movement.status} /></span><span>Fecha/hora: <strong>{formatDate(movement.scannedAt)}</strong></span><span>Usuario: <strong>{userName}</strong></span><span>Punto de control: <strong>{movement.checkpoint || movement.scanPoint || CHECKPOINTS[movement.status] || 'Punto operativo'}</strong></span><span>Zona: <strong>{movement.zoneCode || movement.zoneId || 'Sin zona'}</strong></span></div><p>Nota: {movement.notes || 'Movimiento operativo sin nota.'}</p><small>{STATUS_META[movement.status]?.label || movement.status}</small></div>
      </article>
    })}
  </div>
}
