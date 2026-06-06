import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AlertTable from '../components/AlertTable'
import KpiCard from '../components/KpiCard'
import PackageTable from '../components/PackageTable'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { recalculateAlerts } from '../services/firestoreService'
import { getZoneLabel } from '../services/classificationService'
import { can, hoursSince, STATUS_META, toDate } from '../utils/format'
import { useNavigate } from '../utils/router'

const STATUS_ORDER = ['created', 'received', 'classified', 'dispatched', 'delivered', 'incident']
const COLORS = ['#64748b', '#38bdf8', '#8b5cf6', '#fb923c', '#22c55e', '#ef4444', '#0ea5e9']

function groupCount(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item) || 'Sin dato'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function toRows(counts) {
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

export default function Dashboard() {
  const { packages, alerts, zones, movements } = useData(); const { profile } = useAuth(); const navigate = useNavigate()
  const metrics = useMemo(() => {
    const openAlerts = alerts.filter((a) => a.status !== 'resolved')
    const delayed = packages.filter((p) => p.currentStatus !== 'delivered' && (p.delayAlert || hoursSince(p.lastScanAt || p.createdAt) > Number(p.slaHours || 8)))
    const activeIncidents = packages.filter((p) => p.hasIncident || p.currentStatus === 'incident' || openAlerts.some((a) => a.packageId === p.id)).length
    const delivered = packages.filter((p) => p.currentStatus === 'delivered').length
    const pendingOperational = packages.filter((p) => ['created', 'received', 'incident'].includes(p.currentStatus)).length
    const total = Math.max(packages.length, 1)
    return { openAlerts, delayed, activeIncidents, delivered, pendingOperational, deliveryRate: Math.round((delivered / total) * 100), incidentRate: Math.round((activeIncidents / total) * 100) }
  }, [packages, alerts])
  const charts = useMemo(() => {
    const stateRows = STATUS_ORDER.map((status) => ({ name: STATUS_META[status].label, value: packages.filter((pkg) => pkg.currentStatus === status).length }))
    const zoneRows = toRows(groupCount(packages, (pkg) => pkg.assignedZoneCode || getZoneLabel(pkg.assignedZoneId, zones)))
    const incidentTypeRows = toRows(groupCount(alerts.filter((a) => a.status !== 'resolved'), (alert) => alert.incidentType || alert.type))
    const incidentStageRows = toRows(groupCount(alerts.filter((a) => a.status !== 'resolved'), (alert) => alert.incidentCheckpoint || alert.incidentStage || 'Sin etapa'))
    const movementRows = toRows(groupCount((movements?.length ? movements : packages).slice(0, 80), (item) => {
      const date = toDate(item.scannedAt || item.lastScanAt || item.createdAt)
      return date ? `${String(date.getHours()).padStart(2, '0')}:00` : 'Sin hora'
    })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return { stateRows, zoneRows, incidentTypeRows, incidentStageRows, movementRows }
  }, [packages, alerts, zones, movements])
  const kpis = [
    ['Total paquetes', packages.length, 'en Firestore', '📦', 'blue'], ['Pendientes operativos', metrics.pendingOperational, 'recepción/clasificación/revisión', '⏱', 'gray'],
    ['Recepcionados', packages.filter((p) => p.currentStatus === 'received').length, 'en playa', '↧', 'blue'], ['Clasificados', packages.filter((p) => p.currentStatus === 'classified').length, 'listos para dock', '▣', 'indigo'],
    ['Despachados', packages.filter((p) => p.currentStatus === 'dispatched').length, 'en ruta', '🚚', 'orange'], ['Entregados', metrics.delivered, `${metrics.deliveryRate}% tasa entrega`, '✓', 'green'],
    ['Incidencias activas', metrics.activeIncidents, `${metrics.incidentRate}% tasa incidencia`, '!', 'red'], ['Alertas abiertas', metrics.openAlerts.length, 'requieren acción', '⚠', 'red'],
    ['Urgentes pendientes', packages.filter((p) => p.urgency === 'urgente' && p.currentStatus !== 'delivered').length, 'cross-docking', '⚡', 'orange'], ['Fuera de SLA', metrics.delayed.length, 'demorados', '⏳', 'red'],
  ]
  return <div className="page-stack"><div className="page-title"><div><h2>Dashboard de supervisión</h2><p>KPIs y gráficos operativos en tiempo real con datos de Firestore.</p></div>{can(profile, 'alerts.recalculate', ['supervisor']) && <button className="btn btn-primary" onClick={() => recalculateAlerts(packages, profile)}>Recalcular alertas</button>}</div>
    <section className="kpi-grid">{kpis.map(([label, value, hint, icon, tone]) => <KpiCard key={label} label={label} value={value} hint={hint} icon={icon} tone={tone} />)}</section>
    <section className="grid two"><article className="card chart-card"><h3>Paquetes por estado</h3><ResponsiveContainer width="100%" height={260}><BarChart data={charts.stateRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#1268b3" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></article><article className="card chart-card"><h3>Paquetes por zona</h3><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={charts.zoneRows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} paddingAngle={2}>{charts.zoneRows.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></article></section>
    <section className="grid three"><article className="card chart-card"><h3>Incidencias por tipo</h3><ResponsiveContainer width="100%" height={220}><BarChart data={charts.incidentTypeRows}><XAxis dataKey="name" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></article><article className="card chart-card"><h3>Incidencias por etapa</h3><ResponsiveContainer width="100%" height={220}><BarChart data={charts.incidentStageRows}><XAxis dataKey="name" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></article><article className="card chart-card"><h3>Movimientos por hora</h3><ResponsiveContainer width="100%" height={220}><BarChart data={charts.movementRows}><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></article></section>
    <section className="grid two"><article className="card"><h3>Alertas abiertas</h3><AlertTable alerts={metrics.openAlerts} compact /></article><article className="card"><h3>Urgentes / demorados / incidencias</h3><PackageTable packages={packages.filter((p) => p.urgency === 'urgente' || p.hasIncident || metrics.delayed.some((d) => d.id === p.id)).slice(0, 8)} alerts={alerts} zones={zones} onOpen={(pkg) => navigate(`/packages/${pkg.id}`)} /></article></section>
  </div>
}
