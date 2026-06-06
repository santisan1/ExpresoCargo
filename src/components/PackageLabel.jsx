import { useEffect, useState } from 'react'
import { getZoneLabel } from '../services/classificationService'
import { formatDate, getBundles, getDestination, getVolume, getWeight } from '../utils/format'

const QR_CDN = 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'

function loadQrGenerator() {
  if (window.qrcode) return Promise.resolve(window.qrcode)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${QR_CDN}"]`)
    if (existing) { existing.addEventListener('load', () => resolve(window.qrcode)); existing.addEventListener('error', reject); return }
    const script = document.createElement('script')
    script.src = QR_CDN; script.async = true
    script.onload = () => window.qrcode ? resolve(window.qrcode) : reject(new Error('QR no disponible'))
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function fallbackCells(value) {
  const safeValue = String(value || 'SIN-CODIGO')
  let seed = 0
  for (let i = 0; i < safeValue.length; i += 1) seed = ((seed << 5) - seed + safeValue.charCodeAt(i)) | 0
  const size = 29
  return { size, cells: Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size); const col = index % size
    const finder = (r, c) => r >= 0 && r < 7 && c >= 0 && c < 7 && (r === 0 || c === 0 || r === 6 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
    if (finder(row, col) || finder(row, col - (size - 7)) || finder(row - (size - 7), col)) return true
    return ((Math.abs(seed) + row * 17 + col * 31 + safeValue.charCodeAt((row + col) % safeValue.length)) % 7) < 3
  }) }
}

function QrPreview({ value = '' }) {
  const [qr, setQr] = useState(null)
  useEffect(() => {
    let mounted = true
    loadQrGenerator().then((qrcode) => {
      const generated = qrcode(0, 'M')
      generated.addData(String(value || 'SIN-CODIGO'))
      generated.make()
      const size = generated.getModuleCount()
      const cells = Array.from({ length: size * size }, (_, index) => generated.isDark(Math.floor(index / size), index % size))
      if (mounted) setQr({ size, cells })
    }).catch(() => mounted && setQr(fallbackCells(value)))
    return () => { mounted = false }
  }, [value])
  const data = qr || fallbackCells(value)
  return <svg className="qr-svg" viewBox={`0 0 ${data.size} ${data.size}`} role="img" aria-label={`QR ${value}`} shapeRendering="crispEdges">
    <rect width={data.size} height={data.size} fill="#fff" />
    {data.cells.map((filled, index) => filled ? <rect key={index} x={index % data.size} y={Math.floor(index / data.size)} width="1" height="1" fill="#0f172a" /> : null)}
  </svg>
}

function getLabelCode(pkg) {
  return pkg?.qrPayload || pkg?.barcodeValue || pkg?.guideNumber || ''
}

export default function PackageLabel({ pkg, zones = [] }) {
  if (!pkg) return null
  const code = getLabelCode(pkg)
  return <section className="print-label print-only-label" aria-label="Etiqueta imprimible">
    <header><strong>ExpressoCargo Logistics MVP</strong><small>Etiqueta operativa</small></header>
    <div className="label-main"><QrPreview value={code} /><div><small>Guía</small><h2>{pkg.guideNumber}</h2><p className="barcode-value">{pkg.barcodeValue || code}</p></div></div>
    <div className="label-grid">
      <span>Destino/localidad</span><strong>{getDestination(pkg)}</strong>
      <span>Zona asignada</span><strong>{getZoneLabel(pkg.assignedZoneId || pkg.assignedZoneCode, zones)} ({pkg.assignedZoneCode || '—'})</strong>
      <span>Urgencia</span><strong>{pkg.urgency || 'normal'}</strong>
      <span>Bultos</span><strong>{getBundles(pkg)}</strong>
      <span>Peso</span><strong>{getWeight(pkg)} kg</strong>
      <span>Volumen</span><strong>{getVolume(pkg)} m³</strong>
      <span>Fecha de creación</span><strong>{formatDate(pkg.createdAt)}</strong>
    </div>
  </section>
}
