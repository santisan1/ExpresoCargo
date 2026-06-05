import PackageTable from '../components/PackageTable'
import { useData } from '../context/DataContext'
import { downloadCsv, getDestination } from '../utils/format'

export default function Reports() {
  const { packages, alerts, zones } = useData()
  const delivered = packages.filter((p) => p.currentStatus === 'delivered').length
  const onTime = Math.round((delivered / Math.max(packages.length, 1)) * 100)
  return <div className="page-stack"><div className="page-title"><div><h2>Reportes</h2><p>Resumen ejecutivo y exportación simulada para ERP.</p></div><button className="btn btn-primary" onClick={() => downloadCsv('reporte-operativo.csv', [['Guia','Destino','Estado','Alertas'], ...packages.map((p) => [p.guideNumber, getDestination(p), p.currentStatus, alerts.filter((a) => a.packageId === p.id).length])])}>Exportar reporte</button></div><section className="grid three"><article className="card report-metric"><small>Total procesado</small><strong>{packages.length}</strong></article><article className="card report-metric"><small>% entregados</small><strong>{onTime}%</strong></article><article className="card report-metric"><small>Alertas abiertas</small><strong>{alerts.filter((a) => a.status !== 'resolved').length}</strong></article></section><article className="card"><h3>Base operativa</h3><PackageTable packages={packages} alerts={alerts} zones={zones} /></article></div>
}
