import { useEffect, useRef, useState } from 'react'
import OperationalActions from '../components/OperationalActions'
import StatusBadge from '../components/StatusBadge'
import { useData } from '../context/DataContext'
import { findPackageByCode } from '../services/firestoreService'
import { getZoneLabel } from '../services/classificationService'
import { getDestination, getRecipientName } from '../utils/format'
import { Link } from '../utils/router'

const HTML5_QRCODE_CDN = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'

function loadHtml5Qrcode() {
  if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${HTML5_QRCODE_CDN}"]`)
    if (existing) { existing.addEventListener('load', () => resolve(window.Html5Qrcode)); existing.addEventListener('error', reject); return }
    const script = document.createElement('script')
    script.src = HTML5_QRCODE_CDN; script.async = true
    script.onload = () => window.Html5Qrcode ? resolve(window.Html5Qrcode) : reject(new Error('No se pudo inicializar el lector de cámara. Usá el input manual.'))
    script.onerror = () => reject(new Error('No se pudo cargar el lector de cámara. Usá el input manual como fallback.'))
    document.head.appendChild(script)
  })
}

export default function Scan() {
  const { alerts, zones, packages } = useData(); const [code, setCode] = useState(''); const [pkg, setPkg] = useState(null); const [message, setMessage] = useState(''); const [cameraOn, setCameraOn] = useState(false)
  const scannerRef = useRef(null); const scannerId = 'html5-qrcode-preview'
  async function search(value = code) {
    const trimmed = String(value || '').trim()
    if (!trimmed) return
    setMessage('Buscando...')
    const found = await findPackageByCode(trimmed)
    setPkg(found); setMessage(found ? `Paquete encontrado para ${trimmed}` : 'No se encontró paquete para ese código')
    return found
  }
  function simulate() { const candidate = packages[0]; if (candidate) { setCode(candidate.guideNumber); setPkg(candidate); } }
  async function stopCamera() {
    try { await scannerRef.current?.stop?.() } catch { /* ignore cleanup */ }
    try { await scannerRef.current?.clear?.() } catch { /* ignore cleanup */ }
    scannerRef.current = null
    setCameraOn(false)
  }
  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite cámara desde esta pantalla. Usá el input manual.')
      const Html5Qrcode = await loadHtml5Qrcode()
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras.length) throw new Error('No se detectó cámara disponible. Usá el input manual.')
      const scanner = new Html5Qrcode(scannerId)
      scannerRef.current = scanner
      setCameraOn(true); setMessage('Cámara activa. Apuntá al QR o código de barras.')
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, async (decodedText) => {
        setCode(decodedText); setMessage(`Código detectado: ${decodedText}`)
        const found = await search(decodedText)
        if (found) await stopCamera()
      })
    } catch (err) {
      await stopCamera()
      const text = err.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Podés continuar con el input manual.' : (err.message || 'No se pudo abrir la cámara. Usá el input manual.')
      setMessage(text)
    }
  }
  useEffect(() => () => { stopCamera() }, [])
  const pkgAlerts = pkg ? alerts.filter((a) => a.packageId === pkg.id && a.status !== 'resolved') : []
  return <div className="page-stack narrow"><div className="page-title"><div><h2>Escaneo operativo</h2><p>Input manual compatible con lector de barra/QR y cámara real con fallback amigable.</p></div></div><article className="scan-card"><label>Código de guía / QR<input className="scan-input" autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Ej: EC-000458" /></label><div className="actions wrap"><button className="btn btn-primary" onClick={() => search()}>Buscar</button><button className="btn" onClick={simulate}>Simular escaneo</button><button className="btn" onClick={startCamera} disabled={cameraOn}>Activar cámara</button><button className="btn btn-danger" onClick={stopCamera} disabled={!cameraOn}>Detener cámara</button></div><div id={scannerId} className={`camera-preview ${cameraOn ? '' : 'hidden'}`} />{message && <p className="muted">{message}</p>}</article>
    {pkg && <article className={`package-card ${pkg.urgency === 'urgente' ? 'urgent-card' : ''}`}><div className="package-head"><div><small>Guía</small><h3>{pkg.guideNumber}</h3><p>{getRecipientName(pkg)} · {getDestination(pkg)}</p></div><StatusBadge status={pkg.currentStatus} /></div><div className="info-grid"><div><small>Zona asignada</small><strong>{getZoneLabel(pkg.assignedZoneId || pkg.assignedZoneCode, zones)}</strong></div><div><small>Urgencia</small><strong>{pkg.urgency}</strong></div><div><small>Alertas</small><strong>{pkgAlerts.length ? pkgAlerts.length : 'Sin alertas'}</strong></div><div><small>QR/barra</small><strong>{pkg.qrPayload || pkg.barcodeValue}</strong></div></div>{pkgAlerts.map((a) => <div key={a.id} className="error-box">{a.type}: {a.message}</div>)}<OperationalActions pkg={pkg} onDone={() => search(code)} /><Link to={`/packages/${pkg.id}`} className="btn btn-ghost">Ver trazabilidad completa</Link></article>}
  </div>
}
