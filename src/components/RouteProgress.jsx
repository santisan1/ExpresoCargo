import { STATUS_FLOW, STATUS_META } from '../utils/format'

const STEPS = [
  { status: 'created', label: 'Creado' },
  { status: 'received', label: 'Recepcionado' },
  { status: 'classified', label: 'Clasificado' },
  { status: 'dispatched', label: 'Despachado' },
  { status: 'delivered', label: 'Entregado' },
]

function inferIndex(pkg, movements = []) {
  if (pkg?.currentStatus !== 'incident') return STATUS_FLOW.indexOf(pkg?.currentStatus)
  const movementStatuses = movements.map((movement) => movement.status).filter((status) => STATUS_FLOW.includes(status))
  const last = movementStatuses.at(-1)
  return last ? STATUS_FLOW.indexOf(last) : 0
}

export default function RouteProgress({ pkg, movements = [] }) {
  const currentIndex = Math.max(inferIndex(pkg, movements), 0)
  const incident = pkg?.currentStatus === 'incident' || pkg?.hasIncident
  return <div className={`route-progress ${incident ? 'has-incident' : ''}`}>
    {STEPS.map((step, index) => {
      const completed = pkg?.currentStatus === 'delivered' || index < currentIndex
      const current = pkg?.currentStatus !== 'delivered' && index === currentIndex
      return <div className={`route-step ${completed ? 'completed' : ''} ${current ? 'current' : ''}`} key={step.status}>
        <span>{completed ? '✓' : index + 1}</span>
        <strong>{step.label}</strong>
        <small>{completed ? 'Completado' : current ? 'Actual' : 'Pendiente'}</small>
      </div>
    })}
    {incident && <div className="route-incident"><strong>{STATUS_META.incident.label}</strong><span>{pkg?.incidentReason || 'Revisión operativa pendiente'}</span></div>}
  </div>
}
