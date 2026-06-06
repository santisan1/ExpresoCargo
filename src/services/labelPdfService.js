import { getZoneLabel } from './classificationService'
import { formatDate, getBundles, getDestination, getVolume, getWeight } from '../utils/format'

const JSPDF_CDN = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
const QRCODE_CDN = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js'

function loadScript(src, globalCheck, errorLabel) {
  if (globalCheck()) return Promise.resolve(globalCheck())
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(globalCheck()), { once: true })
      existing.addEventListener('error', () => reject(new Error(errorLabel)), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => globalCheck() ? resolve(globalCheck()) : reject(new Error(errorLabel))
    script.onerror = () => reject(new Error(errorLabel))
    document.head.appendChild(script)
  })
}

function loadJsPdf() {
  return loadScript(JSPDF_CDN, () => window.jspdf?.jsPDF, 'No se pudo cargar jsPDF para generar la etiqueta.')
}

function loadQRCode() {
  return loadScript(QRCODE_CDN, () => window.QRCode, 'No se pudo cargar qrcode para generar la etiqueta.')
}

export function sanitizePdfText(value, fallback = '-') {
  const text = value === undefined || value === null || value === '' ? fallback : String(value)
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function safe(value, fallback = '-') {
  return sanitizePdfText(value, fallback)
}

export async function generatePackageLabelPdf(packageData, zones = []) {
  const [jsPDF, QRCode] = await Promise.all([loadJsPdf(), loadQRCode()])
  const code = packageData?.qrPayload || packageData?.barcodeValue || packageData?.guideNumber || 'SIN-CODIGO'
  const qrDataUrl = await QRCode.toDataURL(String(code), { errorCorrectionLevel: 'M', margin: 1, width: 520, color: { dark: '#0f172a', light: '#ffffff' } })
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a6', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFillColor(15, 39, 66)
  doc.rect(0, 0, pageWidth, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('ExpressoCargo Logistics MVP', 8, 12.8)
  doc.setFontSize(9)
  doc.text('Etiqueta operativa', pageWidth - 8, 12.5, { align: 'right' })

  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.4)
  doc.roundedRect(6, 25, pageWidth - 12, pageHeight - 31, 3, 3)

  doc.addImage(qrDataUrl, 'PNG', 12, 32, 48, 48)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('Codigo QR operativo', 36, 85, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(safe(code), 36, 90, { align: 'center', maxWidth: 50 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Guia', 68, 36)
  doc.setFontSize(21)
  doc.text(safe(packageData?.guideNumber), 68, 47, { maxWidth: 70 })
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(`Codigo visible: ${safe(packageData?.barcodeValue || code)}`, 68, 55, { maxWidth: 72 })

  const rows = [
    ['Destino/localidad', getDestination(packageData)],
    ['Zona asignada', `${getZoneLabel(packageData?.assignedZoneId || packageData?.assignedZoneCode, zones)} (${safe(packageData?.assignedZoneCode)})`],
    ['Urgencia', packageData?.urgency || 'normal'],
    ['Bultos', getBundles(packageData)],
    ['Peso', `${getWeight(packageData)} kg`],
    ['Volumen', `${getVolume(packageData)} m3`],
    ['Fecha de creacion', formatDate(packageData?.createdAt)],
  ]

  let y = 64
  rows.forEach(([label, value]) => {
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(safe(label), 68, y)
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'normal')
    doc.text(safe(value), 101, y, { maxWidth: 40 })
    y += 6.4
  })

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(8, pageHeight - 10, pageWidth - 16, 5, 1, 1, 'F')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(6.5)
  doc.text('Operacion Logistica - Creacion de etiqueta en una pagina A6 horizontal', 10, pageHeight - 6.5)

  doc.save(`etiqueta-${safe(packageData?.guideNumber || code, 'paquete')}.pdf`)
}
