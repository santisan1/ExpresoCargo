import StatusBadge from './StatusBadge'
import { formatDate } from '../utils/format'

export default function TraceabilityTimeline({ movements = [] }) {
  return <div className="timeline">
    {movements.length === 0 && <p className="empty">Sin movimientos registrados.</p>}
    {movements.map((movement) => <article className="timeline-item" key={movement.id}>
      <div className="dot" /><div><StatusBadge status={movement.status} /><h4>{movement.scanPoint || 'Punto operativo'}</h4><p>{movement.notes || 'Movimiento operativo'}</p><small>{formatDate(movement.scannedAt)} · {movement.scannedBy || movement.scannedByUid} · {movement.zoneCode || movement.zoneId || 'Sin zona'}</small></div>
    </article>)}
  </div>
}
