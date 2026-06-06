import { useMemo, useState } from 'react'
import PackageTable from '../components/PackageTable'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from '../utils/router'
import { can, downloadCsv, formatDate, getDestination, getProductType } from '../utils/format'
import { exportOperationalExcel } from '../utils/excelExport'

export default function Packages() {
  const { packages, alerts, zones } = useData(); const { profile } = useAuth(); const navigate = useNavigate()
  const [filters, setFilters] = useState({ text: '', status: '', urgency: '', zone: '' })
  const [routeOpen, setRouteOpen] = useState(false)
  const filtered = useMemo(() => packages.filter((p) => (!filters.text || `${p.guideNumber} ${p.barcodeValue} ${getDestination(p)}`.toLowerCase().includes(filters.text.toLowerCase())) && (!filters.status || p.currentStatus === filters.status) && (!filters.urgency || p.urgency === filters.urgency) && (!filters.zone || p.assignedZoneId === filters.zone)), [packages, filters])
  function exportCsv() { downloadCsv('packages-erp.csv', [['guideNumber','destinationCity','assignedZoneCode','urgency','currentStatus','lastScanAt','hasIncident','openAlerts'], ...filtered.map((p) => [p.guideNumber, getDestination(p), p.assignedZoneCode || p.assignedZoneId, p.urgency, p.currentStatus, formatDate(p.lastScanAt), Boolean(p.hasIncident), alerts.filter((a) => a.packageId === p.id && a.status !== 'resolved').length])]) }
  const dispatched = packages.filter((p) => p.currentStatus === 'dispatched')
  return <div className="page-stack"><div className="page-title"><div><h2>Listado de paquetes</h2><p>Filtros operativos y exportaciones simuladas WMS/TMS/ERP.</p></div><div className="actions">{can(profile, 'packages.create', ['supervisor']) && <Link to="/packages/new" className="btn btn-primary">Nuevo paquete</Link>}<button className="btn" onClick={exportCsv}>Exportar CSV para ERP</button><button className="btn" onClick={() => exportOperationalExcel({ packages: filtered, alerts, zones })}>Exportar Excel operativo</button><button className="btn" onClick={() => setRouteOpen(true)}>Generar hoja de ruta TMS</button></div></div>
    <div className="filters"><input placeholder="Buscar guía, QR o destino" value={filters.text} onChange={(e) => setFilters({ ...filters, text: e.target.value })} /><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Todos los estados</option><option value="created">Creado</option><option value="received">Recepcionado</option><option value="classified">Clasificado</option><option value="dispatched">Despachado</option><option value="delivered">Entregado</option><option value="incident">Incidencia</option></select><select value={filters.urgency} onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}><option value="">Urgencia</option><option value="normal">Normal</option><option value="urgente">Urgente</option></select><select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}><option value="">Todas las zonas</option>{zones.map((z) => <option key={z.id} value={z.id}>{z.name || z.code}</option>)}</select></div>
    <PackageTable packages={filtered} alerts={alerts} zones={zones} onOpen={(pkg) => navigate(`/packages/${pkg.id}`)} />
    {routeOpen && <div className="modal"><div className="modal-card"><h3>Hoja de ruta TMS simulada</h3><p className="muted">Integración simulada para MVP académico. No se conecta ningún TMS real.</p>{zones.map((zone) => <div key={zone.id} className="route-group"><strong>{zone.name || zone.code}</strong>{dispatched.filter((p) => p.assignedZoneId === zone.id).map((p) => <p key={p.id}>{p.guideNumber} · {getDestination(p)} · {getProductType(p)}</p>)}</div>)}<button className="btn btn-primary" onClick={() => setRouteOpen(false)}>Cerrar</button></div></div>}
  </div>
}
