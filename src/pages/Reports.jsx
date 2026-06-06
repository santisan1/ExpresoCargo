import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PackageTable from '../components/PackageTable'
import { useData } from '../context/DataContext'
import { downloadCsv, formatDate, getBundles, getDestination, getRecipientName, getVolume, getWeight, STATUS_META } from '../utils/format'
import { EXCEL_EXPORT_AVAILABLE, EXCEL_EXPORT_UNAVAILABLE_REASON, exportOperationalExcel } from '../utils/excelExport'

const COLORS = ['#1268b3', '#22c55e', '#fb923c', '#8b5cf6', '#ef4444', '#64748b']
const STATUS_ORDER = ['created', 'received', 'classified', 'dispatched', 'delivered', 'incident']

function groupCount(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item) || 'Sin dato'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function rowsFromCounts(counts) {
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

export default function Reports() {
  const { packages, alerts, zones, movements } = useData()
  const openAlertsFor = (packageId) => alerts.filter((a) => a.packageId === packageId && a.status !== 'resolved').length
  const delivered = packages.filter((p) => p.currentStatus === 'delivered').length
  const pending = packages.length - delivered
  const openAlerts = alerts.filter((a) => a.status !== 'resolved')
  const charts = useMemo(() => ({
    estados: STATUS_ORDER.map((status) => ({ name: STATUS_META[status].label, value: packages.filter((p) => p.currentStatus === status).length })),
    zonas: rowsFromCounts(groupCount(packages, (p) => p.assignedZoneCode || p.assignedZoneId)),
    tipos: rowsFromCounts(groupCount(openAlerts, (a) => a.incidentType || a.type)),
    etapas: rowsFromCounts(groupCount(openAlerts, (a) => a.incidentCheckpoint || a.incidentStage || 'Sin etapa')),
    urgencias: [{ name: 'Urgentes', value: packages.filter((p) => p.urgency === 'urgente').length }, { name: 'Normales', value: packages.filter((p) => p.urgency !== 'urgente').length }],
    entrega: [{ name: 'Entregados', value: delivered }, { name: 'Pendientes', value: pending }],
  }), [packages, openAlerts, delivered, pending])
  const onTime = Math.round((delivered / Math.max(packages.length, 1)) * 100)
  const incidentRate = Math.round((packages.filter((p) => p.hasIncident || p.currentStatus === 'incident' || openAlertsFor(p.id) > 0).length / Math.max(packages.length, 1)) * 100)
  const today = new Date().toISOString().slice(0, 10)
  const exportRows = packages.map((p) => [
    p.guideNumber,
    p.barcodeValue || p.qrPayload || '',
    p.originCity || '',
    getDestination(p),
    p.assignedZoneCode || p.assignedZoneId || '',
    p.urgency || '',
    p.currentStatus || '',
    p.lastScanAt ? formatDate(p.lastScanAt) : 'Sin escaneo',
    getRecipientName(p),
    getWeight(p),
    getVolume(p),
    getBundles(p),
    p.currentStatus === 'incident' || openAlertsFor(p.id) > 0 ? 'true' : 'false',
    p.incidentType || '',
    p.incidentCheckpoint || p.incidentStage || '',
    openAlertsFor(p.id),
  ])
  return <div className="page-stack"><div className="page-title"><div><h2>Reportes</h2><p>Resumen ejecutivo, visualizaciones y exportaciones operativas para ERP.</p></div><div className="actions"><button className="btn" onClick={() => downloadCsv(`packages-erp-${today}.csv`, [['guideNumber','barcodeValue','originCity','destinationCity','assignedZoneCode','urgency','currentStatus','lastScanAt','recipientName','weightKg','volumeM3','bundles','hasIncident','incidentType','incidentStage','openAlertsCount'], ...exportRows])}>Exportar CSV para ERP</button><button className="btn btn-primary" disabled={!EXCEL_EXPORT_AVAILABLE} title={!EXCEL_EXPORT_AVAILABLE ? EXCEL_EXPORT_UNAVAILABLE_REASON : ''} onClick={() => exportOperationalExcel({ packages, alerts, zones, movements })}>Exportar Excel operativo</button></div></div>{!EXCEL_EXPORT_AVAILABLE && <div className="warning-box">{EXCEL_EXPORT_UNAVAILABLE_REASON}</div>}
    <section className="grid three"><article className="card report-metric"><small>Total procesado</small><strong>{packages.length}</strong></article><article className="card report-metric"><small>Tasa de entrega</small><strong>{onTime}%</strong></article><article className="card report-metric"><small>Tasa de incidencia</small><strong>{incidentRate}%</strong></article></section>
    <article className="card"><h3>Resumen ejecutivo</h3><p className="muted">Operación con {delivered} paquetes entregados, {pending} pendientes, {openAlerts.length} alertas abiertas y {packages.filter((p) => p.urgency === 'urgente' && p.currentStatus !== 'delivered').length} urgentes pendientes.</p></article>
    <section className="grid two"><article className="card chart-card"><h3>Estados</h3><ResponsiveContainer width="100%" height={250}><BarChart data={charts.estados}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#1268b3" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></article><article className="card chart-card"><h3>Zonas</h3><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={charts.zonas} dataKey="value" nameKey="name" innerRadius={48} outerRadius={86}>{charts.zonas.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></article></section>
    <section className="grid three"><article className="card chart-card"><h3>Incidencias por tipo</h3><ResponsiveContainer width="100%" height={220}><BarChart data={charts.tipos}><XAxis dataKey="name" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></article><article className="card chart-card"><h3>Incidencias por etapa</h3><ResponsiveContainer width="100%" height={220}><BarChart data={charts.etapas}><XAxis dataKey="name" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></article><article className="card chart-card"><h3>Urgentes vs normales</h3><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={charts.urgencias} dataKey="value" nameKey="name" outerRadius={78}>{charts.urgencias.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></article></section>
    <section className="grid two"><article className="card chart-card"><h3>Entregados vs pendientes</h3><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={charts.entrega} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78}>{charts.entrega.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></article><article className="card"><h3>Exportaciones disponibles</h3><p className="muted">CSV con punto y coma y BOM UTF-8 para Excel regional español/Argentina. Excel operativo generado con ExcelJS y hojas Resumen, Paquetes, Alertas, Zonas y Movimientos.</p></article></section>
    <article className="card"><h3>Base operativa</h3><PackageTable packages={packages} alerts={alerts} zones={zones} /></article></div>
}
