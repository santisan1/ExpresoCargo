import { getZoneLabel } from '../services/classificationService'
import { formatDate, getBundles, getDestination, getVolume, getWeight } from '../utils/format'

function hashCode(value) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function QrPreview({ value = '' }) {
  const safeValue = String(value || 'SIN-CODIGO')
  const seed = hashCode(safeValue)
  const size = 13
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size)
    const col = index % size
    const topLeft = row < 4 && col < 4
    const topRight = row < 4 && col > size - 5
    const bottomLeft = row > size - 5 && col < 4
    const finder = topLeft || topRight || bottomLeft
    if (finder) {
      const localRow = topRight ? row : bottomLeft ? row - (size - 4) : row
      const localCol = topRight ? col - (size - 4) : col
      return localRow === 0 || localCol === 0 || localRow === 3 || localCol === 3 || (localRow === 1 && localCol === 1) || (localRow === 2 && localCol === 2)
    }
    return ((seed + row * 17 + col * 31 + safeValue.charCodeAt((row + col) % safeValue.length)) % 5) < 2
  })
  return <div className="qr-preview" aria-label={`QR ${safeValue}`}>{cells.map((filled, index) => <span key={index} className={filled ? 'on' : ''} />)}</div>
}

function getLabelCode(pkg) {
  return pkg?.qrPayload || pkg?.barcodeValue || pkg?.guideNumber || ''
}

export default function PackageLabel({ pkg, zones = [] }) {
  if (!pkg) return null
  const code = getLabelCode(pkg)
  return <section className="print-label" aria-label="Etiqueta imprimible">
    <header><strong>ExpressoCargo Logistics MVP</strong><small>Etiqueta operativa</small></header>
    <div className="label-main"><QrPreview value={code} /><div><small>Guía</small><h2>{pkg.guideNumber}</h2><p className="barcode-value">{code}</p></div></div>
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
