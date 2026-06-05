import { useState } from 'react'
import OperationalActions from '../components/OperationalActions'
import StatusBadge from '../components/StatusBadge'
import { useData } from '../context/DataContext'
import { findPackageByCode } from '../services/firestoreService'
import { getZoneLabel } from '../services/classificationService'
import { getDestination, getRecipientName } from '../utils/format'
import { Link } from '../utils/router'

export default function Scan() {
  const { alerts, zones, packages } = useData(); const [code, setCode] = useState(''); const [pkg, setPkg] = useState(null); const [message, setMessage] = useState('')
  async function search(value = code) { setMessage('Buscando...'); const found = await findPackageByCode(value.trim()); setPkg(found); setMessage(found ? '' : 'No se encontró paquete para ese código') }
  function simulate() { const candidate = packages[0]; if (candidate) { setCode(candidate.guideNumber); setPkg(candidate); } }
  const pkgAlerts = pkg ? alerts.filter((a) => a.packageId === pkg.id && a.status !== 'resolved') : []
  return <div className="page-stack narrow"><div className="page-title"><div><h2>Escaneo operativo</h2><p>Input manual compatible con lector de barra/QR. Cámara simulada para MVP.</p></div></div><article className="scan-card"><label>Código de guía / QR<input className="scan-input" autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Ej: EC-000458" /></label><div className="actions"><button className="btn btn-primary" onClick={() => search()}>Buscar</button><button className="btn" onClick={simulate}>Simular escaneo</button></div>{message && <p className="muted">{message}</p>}</article>
    {pkg && <article className={`package-card ${pkg.urgency === 'urgente' ? 'urgent-card' : ''}`}><div className="package-head"><div><small>Guía</small><h3>{pkg.guideNumber}</h3><p>{getRecipientName(pkg)} · {getDestination(pkg)}</p></div><StatusBadge status={pkg.currentStatus} /></div><div className="info-grid"><div><small>Zona asignada</small><strong>{getZoneLabel(pkg.assignedZoneId, zones)}</strong></div><div><small>Urgencia</small><strong>{pkg.urgency}</strong></div><div><small>Alertas</small><strong>{pkgAlerts.length}</strong></div><div><small>QR/barra</small><strong>{pkg.barcodeValue || pkg.qrPayload}</strong></div></div>{pkgAlerts.map((a) => <div key={a.id} className="error-box">{a.type}: {a.message}</div>)}<OperationalActions pkg={pkg} /><Link to={`/packages/${pkg.id}`} className="btn btn-ghost">Ver trazabilidad completa</Link></article>}
  </div>
}
