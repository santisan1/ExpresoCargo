import StatusBadge from './StatusBadge'
import { formatDate, getDestination } from '../utils/format'
import { getZoneLabel } from '../services/classificationService'

export default function PackageTable({ packages = [], alerts = [], zones = [], onOpen }) {
  return <div className="table-wrap">
    <table className="data-table clickable">
      <thead><tr><th>Guía</th><th>Destino</th><th>Urgencia</th><th>Zona</th><th>Estado</th><th>Último escaneo</th><th>Alertas</th></tr></thead>
      <tbody>
        {packages.length === 0 && <tr><td colSpan="7" className="empty">No hay paquetes para los filtros aplicados</td></tr>}
        {packages.map((pkg) => {
          const count = alerts.filter((a) => a.packageId === pkg.id && a.status !== 'resolved').length
          return <tr key={pkg.id} onClick={() => onOpen?.(pkg)}>
            <td><strong>{pkg.guideNumber}</strong><small className="muted block">{pkg.barcodeValue}</small></td>
            <td>{getDestination(pkg)}</td>
            <td><span className={pkg.urgency === 'urgente' ? 'pill pill-hot' : 'pill'}>{pkg.urgency}</span></td>
            <td>{getZoneLabel(pkg.assignedZoneId, zones)}</td>
            <td><StatusBadge status={pkg.currentStatus} /></td>
            <td>{formatDate(pkg.lastScanAt || pkg.updatedAt)}</td>
            <td>{count ? <span className="alert-count">{count}</span> : '—'}</td>
          </tr>
        })}
      </tbody>
    </table>
  </div>
}
