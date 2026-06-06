import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import { getZoneLabel } from './classificationService'
import { formatDate, getBundles, getDestination, getVolume, getWeight } from '../utils/format'

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

function text(doc, value, x, y, options) {
  doc.text(safe(value), x, y, options)
}

function labelValue(doc, label, value, x, y, valueX, maxWidth = 40) {
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  text(doc, label, x, y)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'normal')
  text(doc, value, valueX, y, { maxWidth })
}

async function createQrDataUrl(qrValue) {
  try {
    return await QRCode.toDataURL(qrValue, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 520,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
  } catch (error) {
    console.error('No se pudo generar el QR de la etiqueta con la dependencia npm qrcode.', error)
    // Si este error aparece en build/runtime, verificá que `qrcode` esté instalado en package.json/node_modules.
    throw new Error('No se pudo generar el QR de la etiqueta. Verificá la dependencia qrcode.', { cause: error })
  }
}

export async function generatePackageLabelPdf(packageData, zones = []) {
  const qrValue = String(packageData?.qrPayload || packageData?.barcodeValue || packageData?.guideNumber || 'SIN-CODIGO')
  const qrDataUrl = await createQrDataUrl(qrValue)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a6',
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFillColor(15, 39, 66)
  doc.rect(0, 0, pageWidth, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  text(doc, 'ExpressoCargo Logistics MVP', 8, 12.8)
  doc.setFontSize(9)
  text(doc, 'Etiqueta operativa', pageWidth - 8, 12.5, { align: 'right' })

  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.4)
  doc.roundedRect(6, 25, pageWidth - 12, pageHeight - 31, 3, 3)

  doc.addImage(qrDataUrl, 'PNG', 12, 32, 48, 48)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  text(doc, 'Codigo QR operativo', 36, 85, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  text(doc, qrValue, 36, 90, { align: 'center', maxWidth: 50 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  text(doc, 'Guia', 68, 36)
  doc.setFontSize(21)
  text(doc, packageData?.guideNumber, 68, 47, { maxWidth: 70 })
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  text(doc, `Codigo visible: ${safe(packageData?.barcodeValue || qrValue)}`, 68, 55, { maxWidth: 72 })

  const zoneCode = safe(packageData?.assignedZoneCode, '')
  const zoneLabel = getZoneLabel(packageData?.assignedZoneId || packageData?.assignedZoneCode, zones)
  const rows = [
    ['Destino/localidad', getDestination(packageData)],
    ['Zona asignada', zoneCode ? `${zoneLabel} (${zoneCode})` : zoneLabel],
    ['Urgencia', packageData?.urgency || 'normal'],
    ['Bultos', getBundles(packageData)],
    ['Peso', `${getWeight(packageData)} kg`],
    ['Volumen', `${getVolume(packageData)} m3`],
    ['Fecha de creacion', formatDate(packageData?.createdAt)],
  ]

  let y = 64
  rows.forEach(([label, value]) => {
    labelValue(doc, label, value, 68, y, 101)
    y += 6.4
  })

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(8, pageHeight - 10, pageWidth - 16, 5, 1, 1, 'F')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(6.5)
  text(doc, 'Operacion Logistica - Creacion de etiqueta en una pagina A6 horizontal', 10, pageHeight - 6.5)

  doc.save(`etiqueta-${safe(packageData?.guideNumber || qrValue, 'paquete')}.pdf`)
}
