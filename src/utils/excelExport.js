import { formatDate, getBundles, getDestination, getProductType, getRecipientName, getVolume, getWeight, hoursSince, toDate } from './format'

export const EXCEL_EXPORT_AVAILABLE = true
export const EXCEL_EXPORT_UNAVAILABLE_REASON = ''

const EXCELJS_CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
const FILE_SAVER_CDN = 'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js'

function loadScript(src, globalCheck) {
  if (globalCheck()) return Promise.resolve(globalCheck())
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(globalCheck()), { once: true })
      existing.addEventListener('error', () => reject(new Error(`No se pudo cargar ${src}`)), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => globalCheck() ? resolve(globalCheck()) : reject(new Error(`La libreria no quedo disponible: ${src}`))
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(script)
  })
}

async function loadExcelJS() {
  return loadScript(EXCELJS_CDN, () => window.ExcelJS)
}

async function saveBlob(blob, filename) {
  const fileSaver = await loadScript(FILE_SAVER_CDN, () => window.saveAs).catch(() => null)
  if (fileSaver) {
    fileSaver(blob, filename)
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const EMPTY = '—'

function valueOrDash(value) {
  return value === undefined || value === null || value === '' ? EMPTY : value
}

function dateOrDash(value) {
  return value ? formatDate(value) : EMPTY
}

function openAlerts(alerts) {
  return alerts.filter((alert) => alert.status !== 'resolved')
}

function openAlertsFor(alerts, packageId) {
  return openAlerts(alerts).filter((alert) => alert.packageId === packageId)
}

function averageHours(values) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0)
  if (!valid.length) return EMPTY
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2))
}

function hoursBetween(start, end) {
  const a = toDate(start)
  const b = toDate(end)
  if (!a || !b) return null
  return (b.getTime() - a.getTime()) / 36e5
}

function byPackageMovements(movements = []) {
  return movements.reduce((map, movement) => {
    const key = movement.packageId || movement.id
    if (!key) return map
    const list = map.get(key) || []
    list.push(movement)
    map.set(key, list)
    return map
  }, new Map())
}

export function buildOperationalWorkbookData({ packages = [], alerts = [], zones = [], movements = [] }) {
  const activeAlerts = openAlerts(alerts)
  const movementMap = byPackageMovements(movements)
  const countStatus = (status) => packages.filter((pkg) => pkg.currentStatus === status).length
  const delayed = packages.filter((pkg) => pkg.currentStatus !== 'delivered' && (pkg.delayAlert || hoursSince(pkg.lastScanAt || pkg.createdAt) > Number(pkg.slaHours || 8)))
  const firstByStatus = (pkg, status) => (movementMap.get(pkg.id) || []).find((movement) => movement.status === status)?.scannedAt
  const avgReceptionToClassification = averageHours(packages.map((pkg) => hoursBetween(firstByStatus(pkg, 'received'), firstByStatus(pkg, 'classified'))))
  const avgTotal = averageHours(packages.map((pkg) => hoursBetween(pkg.createdAt, firstByStatus(pkg, 'delivered') || (pkg.currentStatus === 'delivered' ? pkg.lastScanAt : null))))

  return {
    resumen: [
      ['Metrica', 'Valor'],
      ['Fecha de generacion', formatDate(new Date())],
      ['Total paquetes', packages.length],
      ['Creados', countStatus('created')],
      ['Recepcionados', countStatus('received')],
      ['Clasificados', countStatus('classified')],
      ['Despachados', countStatus('dispatched')],
      ['Entregados', countStatus('delivered')],
      ['Incidencias', packages.filter((p) => p.currentStatus === 'incident' || p.hasIncident || openAlertsFor(alerts, p.id).length > 0).length],
      ['Alertas abiertas', activeAlerts.length],
      ['Urgentes', packages.filter((p) => p.urgency === 'urgente').length],
      ['Fuera de SLA', delayed.length],
      ['Tiempo promedio recepcion-clasificacion (h)', avgReceptionToClassification],
      ['Tiempo promedio total (h)', avgTotal],
    ],
    paquetes: packages.map((pkg) => ({
      Guia: valueOrDash(pkg.guideNumber),
      Codigo: valueOrDash(pkg.barcodeValue || pkg.qrPayload),
      Origen: valueOrDash(pkg.originCity),
      Destino: valueOrDash(getDestination(pkg)),
      Destinatario: valueOrDash(getRecipientName(pkg)),
      Urgencia: valueOrDash(pkg.urgency || 'normal'),
      Zona: valueOrDash(pkg.assignedZoneCode || pkg.assignedZoneId),
      Estado: valueOrDash(pkg.currentStatus),
      'Ultimo escaneo': dateOrDash(pkg.lastScanAt),
      'Fecha creacion': dateOrDash(pkg.createdAt),
      'Peso kg': getWeight(pkg),
      'Volumen m3': getVolume(pkg),
      Bultos: getBundles(pkg),
      Producto: valueOrDash(getProductType(pkg)),
      'Tiene incidencia activa': pkg.currentStatus === 'incident' || pkg.hasIncident || openAlertsFor(alerts, pkg.id).length > 0 ? 'Si' : 'No',
      'Motivo incidencia': valueOrDash(pkg.incidentReason),
      'Etapa incidencia': valueOrDash(pkg.incidentCheckpoint || pkg.incidentStage),
      'Alertas abiertas': openAlertsFor(alerts, pkg.id).length,
    })),
    alertas: alerts.map((alert) => ({
      Estado: alert.status === 'resolved' ? 'Resuelta' : 'Abierta',
      Severidad: valueOrDash(alert.severity || 'medium'),
      Tipo: valueOrDash(alert.type),
      'Tipo incidencia': valueOrDash(alert.incidentType),
      'Etapa incidencia': valueOrDash(alert.incidentCheckpoint || alert.incidentStage),
      Guia: valueOrDash(alert.guideNumber || alert.packageId),
      Mensaje: valueOrDash(alert.message),
      Creada: dateOrDash(alert.createdAt),
      Resuelta: dateOrDash(alert.resolvedAt),
      'Resuelta por': valueOrDash(alert.resolvedByName),
    })),
    zonas: zones.map((zone) => ({
      Codigo: valueOrDash(zone.code || zone.id),
      Nombre: valueOrDash(zone.name),
      Tipo: valueOrDash(zone.type),
      Destinos: valueOrDash(Array.isArray(zone.destinations) ? zone.destinations.join(', ') : (zone.destinations || zone.localities)),
      Activa: zone.active === false ? 'No' : 'Si',
    })),
    movimientos: movements.map((movement) => ({
      Guia: valueOrDash(movement.guideNumber || packages.find((pkg) => pkg.id === movement.packageId)?.guideNumber),
      Estado: valueOrDash(movement.status),
      Titulo: valueOrDash(movement.title),
      'Punto de control': valueOrDash(movement.checkpoint || movement.scanPoint),
      Zona: valueOrDash(movement.zoneCode || movement.zoneId),
      Usuario: valueOrDash(movement.scannedByName || movement.scannedBy),
      'Fecha/hora': dateOrDash(movement.scannedAt || movement.createdAt),
      Nota: valueOrDash(movement.notes),
    })),
  }
}

function styleWorksheet(worksheet) {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: worksheet.columnCount } }
  const header = worksheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2742' } }
  header.alignment = { vertical: 'middle' }
  header.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
  })
  worksheet.columns.forEach((column) => {
    let width = 12
    column.eachCell({ includeEmpty: true }, (cell) => {
      width = Math.max(width, Math.min(String(cell.value ?? '').length + 2, 36))
    })
    column.width = width
  })
}

function addArraySheet(workbook, name, rows) {
  const worksheet = workbook.addWorksheet(name)
  rows.forEach((row) => worksheet.addRow(row.map(valueOrDash)))
  styleWorksheet(worksheet)
}

function addObjectSheet(workbook, name, objects) {
  const worksheet = workbook.addWorksheet(name)
  const headers = Object.keys(objects[0] || {})
  worksheet.addRow(headers)
  objects.forEach((object) => worksheet.addRow(headers.map((header) => valueOrDash(object[header]))))
  styleWorksheet(worksheet)
}

export async function exportOperationalExcel({ packages = [], alerts = [], zones = [], movements = [] }) {
  const data = buildOperationalWorkbookData({ packages, alerts, zones, movements })
  const ExcelJS = await loadExcelJS()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ExpressoCargo Logistics MVP'
  workbook.created = new Date()
  workbook.modified = new Date()
  addArraySheet(workbook, 'Resumen', data.resumen)
  addObjectSheet(workbook, 'Paquetes', data.paquetes)
  addObjectSheet(workbook, 'Alertas', data.alertas)
  addObjectSheet(workbook, 'Zonas', data.zonas)
  addObjectSheet(workbook, 'Movimientos', data.movimientos)
  const buffer = await workbook.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)
  await saveBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `expresocargo-operativo-${today}.xlsx`)
}
