import { formatDate, getBundles, getDestination, getProductType, getRecipientName, getVolume, getWeight } from './format'

function empty(value) { return value === undefined || value === null || value === '' ? '—' : value }
function xml(value) { return String(empty(value)).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
function sheetXml(rows) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><cols>${(rows[0] || []).map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="22" customWidth="1"/>`).join('')}</cols></worksheet>`
}
function crc32(str) { let crc = -1; for (let i = 0; i < str.length; i += 1) { crc ^= str.charCodeAt(i); for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) } return (crc ^ -1) >>> 0 }
function u16(n) { return String.fromCharCode(n & 255, (n >>> 8) & 255) }
function u32(n) { return String.fromCharCode(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255) }
function zip(files) {
  let offset = 0; const local = []; const central = []
  files.forEach(({ name, content }) => { const crc = crc32(content); const size = content.length
    local.push('PK\x03\x04' + u16(20) + u16(0) + u16(0) + u16(0) + u16(0) + u32(crc) + u32(size) + u32(size) + u16(name.length) + u16(0) + name + content)
    central.push('PK\x01\x02' + u16(20) + u16(20) + u16(0) + u16(0) + u16(0) + u16(0) + u32(crc) + u32(size) + u32(size) + u16(name.length) + u16(0) + u16(0) + u16(0) + u16(0) + u32(0) + u32(offset) + name)
    offset += local.at(-1).length
  })
  const centralData = central.join('')
  return local.join('') + centralData + 'PK\x05\x06' + u16(0) + u16(0) + u16(files.length) + u16(files.length) + u32(centralData.length) + u32(offset) + u16(0)
}
function downloadBinary(filename, data) { const bytes = Uint8Array.from(data, (char) => char.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }

export function exportOperationalExcel({ packages = [], alerts = [], zones = [] }) {
  const openAlerts = alerts.filter((alert) => alert.status !== 'resolved')
  const countStatus = (status) => packages.filter((pkg) => pkg.currentStatus === status).length
  const delayed = packages.filter((pkg) => pkg.delayAlert).length
  const incidentZone = zones.find((zone) => zone.id === 'zona-incidencias' || zone.code === 'INC')
  const packageRows = packages.map((pkg) => [pkg.guideNumber, getDestination(pkg), pkg.originCity, getRecipientName(pkg), pkg.urgency, pkg.assignedZoneCode || pkg.assignedZoneId, pkg.currentStatus, pkg.lastScanAt ? formatDate(pkg.lastScanAt) : 'Sin escaneo', formatDate(pkg.createdAt), getWeight(pkg), getVolume(pkg), getBundles(pkg), getProductType(pkg), pkg.hasIncident ? 'Sí' : 'No', pkg.incidentReason || '', openAlerts.filter((alert) => alert.packageId === pkg.id).length])
  const files = [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/><sheet name="Paquetes" sheetId="2" r:id="rId2"/><sheet name="Alertas" sheetId="3" r:id="rId3"/><sheet name="Zonas" sheetId="4" r:id="rId4"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml([['Métrica', 'Valor'], ['Fecha de generación', formatDate(new Date())], ['Total paquetes', packages.length], ['Pendientes', countStatus('created')], ['Recepcionados', countStatus('received')], ['Clasificados', countStatus('classified')], ['Despachados', countStatus('dispatched')], ['Entregados', countStatus('delivered')], ['Incidencias', packages.filter((p) => p.hasIncident || p.currentStatus === 'incident').length], ['Alertas abiertas', openAlerts.length], ['Urgentes', packages.filter((p) => p.urgency === 'urgente').length], ['Demorados', delayed], ['Zona incidencia', incidentZone?.name || incidentZone?.code || '—']]) },
    { name: 'xl/worksheets/sheet2.xml', content: sheetXml([['Guía','Destino','Origen','Destinatario','Urgencia','Zona','Estado','Último escaneo','Fecha creación','Peso kg','Volumen m3','Bultos','Producto','Tiene incidencia','Motivo incidencia','Alertas abiertas'], ...packageRows]) },
    { name: 'xl/worksheets/sheet3.xml', content: sheetXml([['Estado','Severidad','Tipo','Guía','Mensaje','Fecha creación','Fecha resolución','Resuelta por'], ...alerts.map((a) => [a.status === 'resolved' ? 'Resuelta' : 'Abierta', a.severity, a.type, a.guideNumber || a.packageId, a.message, formatDate(a.createdAt), a.resolvedAt ? formatDate(a.resolvedAt) : '', a.resolvedByName || ''])]) },
    { name: 'xl/worksheets/sheet4.xml', content: sheetXml([['Código','Nombre','Tipo','Destinos','Activa'], ...zones.map((z) => [z.code || z.id, z.name, z.type, Array.isArray(z.destinations) ? z.destinations.join(', ') : z.destinations, z.active === false ? 'No' : 'Sí'])]) },
  ]
  downloadBinary(`reporte-operativo-${new Date().toISOString().slice(0, 10)}.xlsx`, zip(files))
}
