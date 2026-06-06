import { getZoneLabel } from './classificationService'
import { formatDate, getBundles, getDestination, getVolume, getWeight } from '../utils/format'

function esc(value) { return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)') }
function safe(value, fallback = '—') { return value === undefined || value === null || value === '' ? fallback : value }
function pdfText(x, y, size, text, opts = {}) { return `BT /F${opts.bold ? 2 : 1} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET\n` }
function rect(x, y, w, h, color = '0.06 0.15 0.26 rg') { return `${color}\n${x} ${y} ${w} ${h} re f\n` }
function strokeRect(x, y, w, h, color = '0.06 0.15 0.26 RG') { return `${color}\n${x} ${y} ${w} ${h} re S\n` }
function hashCells(value) {
  const text = String(value || 'SIN-CODIGO')
  let seed = 0
  for (let i = 0; i < text.length; i += 1) seed = ((seed << 5) - seed + text.charCodeAt(i)) | 0
  const size = 29
  return Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size); const col = index % size
    const finder = (r, c) => r >= 0 && r < 7 && c >= 0 && c < 7 && (r === 0 || c === 0 || r === 6 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
    if (finder(row, col) || finder(row, col - (size - 7)) || finder(row - (size - 7), col)) return true
    return ((Math.abs(seed) + row * 17 + col * 31 + text.charCodeAt((row + col) % text.length)) % 7) < 3
  })
}
function qrCommands(value, x, y, size) {
  const cells = hashCells(value); const modules = 29; const cell = size / modules
  let out = rect(x - 6, y - 6, size + 12, size + 12, '1 1 1 rg') + strokeRect(x - 6, y - 6, size + 12, size + 12)
  cells.forEach((on, index) => {
    if (!on) return
    const row = Math.floor(index / modules); const col = index % modules
    out += rect(x + col * cell, y + size - (row + 1) * cell, cell + 0.05, cell + 0.05)
  })
  return out
}
function makePdf(content) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 420] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'; const offsets = [0]
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return pdf
}

export function generatePackageLabelPdf(packageData, zones = []) {
  const code = packageData?.qrPayload || packageData?.barcodeValue || packageData?.guideNumber || 'SIN-CODIGO'
  let content = ''
  content += rect(0, 360, 595, 60)
  content += pdfText(30, 390, 20, 'ExpressoCargo Logistics MVP', { bold: true })
  content += pdfText(410, 390, 13, 'Etiqueta operativa', { bold: true })
  content += strokeRect(24, 24, 547, 312)
  content += qrCommands(code, 42, 150, 150)
  content += pdfText(40, 122, 10, 'QR / código operativo', { bold: true })
  content += pdfText(40, 104, 11, code)
  content += pdfText(220, 300, 12, 'Guía', { bold: true })
  content += pdfText(220, 268, 32, safe(packageData?.guideNumber), { bold: true })
  content += pdfText(220, 238, 12, `Código visible: ${safe(packageData?.barcodeValue || code)}`)
  const rows = [
    ['Destino/localidad', getDestination(packageData)],
    ['Zona asignada', `${getZoneLabel(packageData?.assignedZoneId || packageData?.assignedZoneCode, zones)} (${safe(packageData?.assignedZoneCode)})`],
    ['Urgencia', packageData?.urgency || 'normal'],
    ['Bultos', getBundles(packageData)],
    ['Peso', `${getWeight(packageData)} kg`],
    ['Volumen', `${getVolume(packageData)} m3`],
    ['Fecha de creación', formatDate(packageData?.createdAt)],
  ]
  rows.forEach(([label, value], index) => {
    const y = 205 - index * 24
    content += pdfText(220, y, 10, label, { bold: true })
    content += pdfText(340, y, 10, String(value))
  })
  const blob = new Blob([makePdf(content)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `etiqueta-${packageData?.guideNumber || code}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
