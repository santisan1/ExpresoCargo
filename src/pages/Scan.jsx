import { useEffect, useRef, useState } from 'react'
import OperationalActions from '../components/OperationalActions'
import StatusBadge from '../components/StatusBadge'
import { useData } from '../context/DataContext'
import { findPackageByCode } from '../services/firestoreService'
import { getZoneLabel } from '../services/classificationService'
import { getDestination, getRecipientName } from '../utils/format'
import { Link } from '../utils/router'

export default function Scan() {
  const { alerts, zones, packages } = useData(); const [code, setCode] = useState(''); const [pkg, setPkg] = useState(null); const [message, setMessage] = useState(''); const [cameraOn, setCameraOn] = useState(false)
  const videoRef = useRef(null); const streamRef = useRef(null); const rafRef = useRef(null); const detectorRef = useRef(null)
  async function search(value = code) {
    const trimmed = String(value || '').trim()
    if (!trimmed) return
    setMessage('Buscando...')
    const found = await findPackageByCode(trimmed)
    setPkg(found); setMessage(found ? '' : 'No se encontró paquete para ese código')
  }
  function simulate() { const candidate = packages[0]; if (candidate) { setCode(candidate.guideNumber); setPkg(candidate); } }
  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }
  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite cámara desde esta pantalla')
      if (!('BarcodeDetector' in window)) throw new Error('El navegador no soporta detección nativa de QR/códigos. Usá el input manual como fallback.')
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'ean_8'] })
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true); setMessage('Cámara activa. Apuntá al QR o código de barras.')
      const scanFrame = async () => {
        if (!videoRef.current || !detectorRef.current) return
        try {
          const codes = await detectorRef.current.detect(videoRef.current)
          const rawValue = codes[0]?.rawValue
          if (rawValue) {
            setCode(rawValue); setMessage(`Código detectado: ${rawValue}`); await search(rawValue); stopCamera(); return
          }
        } catch (err) {
          setMessage(`No se pudo leer la cámara: ${err.message}`)
        }
        rafRef.current = requestAnimationFrame(scanFrame)
      }
      rafRef.current = requestAnimationFrame(scanFrame)
    } catch (err) {
      stopCamera(); setMessage(err.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Usá el input manual.' : err.message)
    }
  }
  useEffect(() => () => stopCamera(), [])
  const pkgAlerts = pkg ? alerts.filter((a) => a.packageId === pkg.id && a.status !== 'resolved') : []
  return <div className="page-stack narrow"><div className="page-title"><div><h2>Escaneo operativo</h2><p>Input manual compatible con lector de barra/QR y opción de cámara real si el navegador lo permite.</p></div></div><article className="scan-card"><label>Código de guía / QR<input className="scan-input" autoFocus value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Ej: EC-000458" /></label><div className="actions wrap"><button className="btn btn-primary" onClick={() => search()}>Buscar</button><button className="btn" onClick={simulate}>Simular escaneo</button><button className="btn" onClick={startCamera} disabled={cameraOn}>Activar cámara</button><button className="btn btn-danger" onClick={stopCamera} disabled={!cameraOn}>Detener cámara</button></div><video ref={videoRef} className={`camera-preview ${cameraOn ? '' : 'hidden'}`} muted playsInline />{message && <p className="muted">{message}</p>}</article>
    {pkg && <article className={`package-card ${pkg.urgency === 'urgente' ? 'urgent-card' : ''}`}><div className="package-head"><div><small>Guía</small><h3>{pkg.guideNumber}</h3><p>{getRecipientName(pkg)} · {getDestination(pkg)}</p></div><StatusBadge status={pkg.currentStatus} /></div><div className="info-grid"><div><small>Zona asignada</small><strong>{getZoneLabel(pkg.assignedZoneId || pkg.assignedZoneCode, zones)}</strong></div><div><small>Urgencia</small><strong>{pkg.urgency}</strong></div><div><small>Alertas</small><strong>{pkgAlerts.length}</strong></div><div><small>QR/barra</small><strong>{pkg.qrPayload || pkg.barcodeValue}</strong></div></div>{pkgAlerts.map((a) => <div key={a.id} className="error-box">{a.type}: {a.message}</div>)}<OperationalActions pkg={pkg} onDone={() => search(code)} /><Link to={`/packages/${pkg.id}`} className="btn btn-ghost">Ver trazabilidad completa</Link></article>}
  </div>
}
