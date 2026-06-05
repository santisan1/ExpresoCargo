import AlertTable from '../components/AlertTable'
import KpiCard from '../components/KpiCard'
import PackageTable from '../components/PackageTable'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { recalculateAlerts } from '../services/firestoreService'
import { hoursSince } from '../utils/format'
import { useNavigate } from '../utils/router'

export default function Dashboard() {
  const { packages, alerts, zones } = useData(); const { profile } = useAuth(); const navigate = useNavigate()
  const openAlerts = alerts.filter((a) => a.status !== 'resolved')
  const total = packages.length || 1
  const delayed = packages.filter((p) => p.currentStatus !== 'delivered' && (p.delayAlert || hoursSince(p.lastScanAt || p.createdAt) > Number(p.slaHours || 8)))
  const kpis = [
    ['Total paquetes', packages.length, 'en Firestore', '📦', 'blue'], ['Pendientes', packages.filter((p) => ['created','received'].includes(p.currentStatus)).length, 'por clasificar', '⏱', 'gray'],
    ['Clasificados', packages.filter((p) => p.currentStatus === 'classified').length, 'listos para dock', '▣', 'indigo'], ['Despachados', packages.filter((p) => p.currentStatus === 'dispatched').length, 'en ruta', '🚚', 'orange'],
    ['Entregados', packages.filter((p) => p.currentStatus === 'delivered').length, 'flujo cerrado', '✓', 'green'], ['Incidencias', packages.filter((p) => p.hasIncident || p.currentStatus === 'incident').length, `${Math.round((packages.filter((p) => p.hasIncident).length / total) * 100)}% error`, '!', 'red'],
    ['Alertas abiertas', openAlerts.length, 'requieren acción', '⚠', 'red'], ['Tasa de error', `${Math.round((packages.filter((p) => p.hasIncident).length / total) * 100)}%`, 'incidencias/total', '%', 'gray'],
  ]
  const counts = ['created','received','classified','dispatched','delivered','incident'].map((s) => ({ s, c: packages.filter((p) => p.currentStatus === s).length }))
  return <div className="page-stack"><div className="page-title"><div><h2>Dashboard de supervisión</h2><p>KPIs operativos en tiempo real con listeners de Firestore.</p></div><button className="btn btn-primary" onClick={() => recalculateAlerts(packages, profile)}>Recalcular alertas</button></div>
    <section className="kpi-grid">{kpis.map(([label, value, hint, icon, tone]) => <KpiCard key={label} label={label} value={value} hint={hint} icon={icon} tone={tone} />)}</section>
    <section className="grid two"><article className="card"><h3>Paquetes por estado</h3><div className="bar-chart">{counts.map((item) => <div key={item.s} className="bar-row"><span>{item.s}</span><div><i style={{ width: `${Math.max((item.c / total) * 100, 4)}%` }} /></div><strong>{item.c}</strong></div>)}</div></article><article className="card"><h3>Alertas abiertas</h3><AlertTable alerts={openAlerts} compact /></article></section>
    <article className="card"><h3>Urgentes / demorados / mal clasificados</h3><PackageTable packages={packages.filter((p) => p.urgency === 'urgente' || p.hasIncident || delayed.some((d) => d.id === p.id)).slice(0, 8)} alerts={alerts} zones={zones} onOpen={(pkg) => navigate(`/packages/${pkg.id}`)} /></article>
  </div>
}
