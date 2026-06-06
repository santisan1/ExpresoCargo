import PackageTable from '../components/PackageTable'
import { useData } from '../context/DataContext'
import { downloadCsv, formatDate, getBundles, getDestination, getRecipientName, getVolume, getWeight } from '../utils/format'
import { EXCEL_EXPORT_AVAILABLE, EXCEL_EXPORT_UNAVAILABLE_REASON, exportOperationalExcel } from '../utils/excelExport'

export default function Reports() {
  const { packages, alerts, zones } = useData()
  const delivered = packages.filter((p) => p.currentStatus === 'delivered').length
  const onTime = Math.round((delivered / Math.max(packages.length, 1)) * 100)
  const openAlertsFor = (packageId) => alerts.filter((a) => a.packageId === packageId && a.status !== 'resolved').length
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
    openAlertsFor(p.id),
  ])
  return <div className="page-stack"><div className="page-title"><div><h2>Reportes</h2><p>Resumen ejecutivo y exportación simulada para ERP.</p></div><div className="actions"><button className="btn" onClick={() => downloadCsv('reporte-operativo.csv', [['guideNumber','barcodeValue','originCity','destinationCity','assignedZoneCode','urgency','currentStatus','lastScanAt','recipientName','weightKg','volumeM3','bundles','hasIncident','openAlertsCount'], ...exportRows])}>Exportar CSV para ERP</button><button className="btn btn-primary" disabled={!EXCEL_EXPORT_AVAILABLE} title={!EXCEL_EXPORT_AVAILABLE ? EXCEL_EXPORT_UNAVAILABLE_REASON : ''} onClick={() => exportOperationalExcel({ packages, alerts, zones })}>Exportar Excel operativo</button></div></div>{!EXCEL_EXPORT_AVAILABLE && <div className="warning-box">{EXCEL_EXPORT_UNAVAILABLE_REASON}</div>}<section className="grid three"><article className="card report-metric"><small>Total procesado</small><strong>{packages.length}</strong></article><article className="card report-metric"><small>% entregados</small><strong>{onTime}%</strong></article><article className="card report-metric"><small>Alertas abiertas</small><strong>{alerts.filter((a) => a.status !== 'resolved').length}</strong></article></section><article className="card"><h3>Base operativa</h3><PackageTable packages={packages} alerts={alerts} zones={zones} /></article></div>
}
