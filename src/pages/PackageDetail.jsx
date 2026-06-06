import { useEffect, useState } from 'react'
import AlertTable from '../components/AlertTable'
import OperationalActions from '../components/OperationalActions'
import PackageLabel from '../components/PackageLabel'
import StatusBadge from '../components/StatusBadge'
import TraceabilityTimeline from '../components/TraceabilityTimeline'
import { useData } from '../context/DataContext'
import { subscribeDocument, subscribePackageMovements } from '../services/firestoreService'
import { getZoneLabel } from '../services/classificationService'
import { formatDate, getBundles, getDestination, getProductType, getRecipientName, getVolume, getWeight } from '../utils/format'

export default function PackageDetail({ id }) {
  const { alerts, zones } = useData(); const [pkg, setPkg] = useState(null); const [movements, setMovements] = useState([])
  useEffect(() => { let cleanups = []; Promise.all([subscribeDocument('packages', id, setPkg), subscribePackageMovements(id, setMovements)]).then((u) => cleanups = u); return () => cleanups.forEach((u) => u?.()) }, [id])
  if (!pkg) return <div className="card">Cargando paquete...</div>
  const related = alerts.filter((a) => a.packageId === id)
  return <div className="page-stack"><div className="page-title"><div><h2>Detalle de trazabilidad</h2><p>Guía {pkg.guideNumber} · QR/barra {pkg.barcodeValue || pkg.qrPayload}</p></div><div className="actions"><button className="btn btn-primary" onClick={() => window.print()}>Imprimir etiqueta</button><StatusBadge status={pkg.currentStatus} /></div></div>
    <section className="grid two"><article className="card"><h3>Datos principales</h3><div className="detail-grid"><span>Estado actual</span><strong><StatusBadge status={pkg.currentStatus} /></strong><span>Destinatario</span><strong>{getRecipientName(pkg)}</strong><span>Origen</span><strong>{pkg.originCity || '—'}</strong><span>Destino</span><strong>{getDestination(pkg)}</strong><span>Zona esperada</span><strong>{getZoneLabel(pkg.expectedZoneId || pkg.assignedZoneId, zones)}</strong><span>Zona asignada</span><strong>{getZoneLabel(pkg.assignedZoneId || pkg.assignedZoneCode, zones)} · {pkg.assignedZoneCode || '—'}</strong><span>Ubicación actual</span><strong>{pkg.currentLocation || '—'}</strong><span>Último escaneo</span><strong>{formatDate(pkg.lastScanAt)}</strong><span>Peso / Volumen / Bultos</span><strong>{getWeight(pkg)} kg · {getVolume(pkg)} m³ · {getBundles(pkg)}</strong><span>Producto</span><strong>{getProductType(pkg)}</strong><span>Urgencia</span><strong>{pkg.urgency || 'normal'}</strong></div></article><article className="card"><h3>Acciones operativas</h3><OperationalActions pkg={pkg} /></article></section>
    <PackageLabel pkg={pkg} zones={zones} />
    <section className="grid two"><article className="card"><h3>Historial de movimientos</h3><p className="muted">Orden cronológico: más antiguo arriba y más nuevo abajo.</p><TraceabilityTimeline movements={movements} /></article><article className="card"><h3>Alertas relacionadas</h3><AlertTable alerts={related} /></article></section>
  </div>
}
