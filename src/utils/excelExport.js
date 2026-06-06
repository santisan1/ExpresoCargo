import { formatDate, getBundles, getDestination, getProductType, getRecipientName, getVolume, getWeight } from './format'

export const EXCEL_EXPORT_AVAILABLE = false
export const EXCEL_EXPORT_UNAVAILABLE_REASON = 'Exportación Excel deshabilitada: npm install xlsx falló en este entorno (403). Se mantiene CSV para evitar generar .xlsx corruptos.'

export function buildOperationalWorkbookData({ packages = [], alerts = [], zones = [] }) {
  const openAlerts = alerts.filter((alert) => alert.status !== 'resolved')
  const openAlertsFor = (packageId) => openAlerts.filter((alert) => alert.packageId === packageId).length
  const countStatus = (status) => packages.filter((pkg) => pkg.currentStatus === status).length
  const delayed = packages.filter((pkg) => pkg.delayAlert).length
  const incidentZone = zones.find((zone) => zone.id === 'zona-incidencias' || zone.code === 'INC')

  return {
    resumen: [
      ['Métrica', 'Valor'],
      ['Fecha de generación', formatDate(new Date())],
      ['Total paquetes', packages.length],
      ['Pendientes', countStatus('created')],
      ['Recepcionados', countStatus('received')],
      ['Clasificados', countStatus('classified')],
      ['Despachados', countStatus('dispatched')],
      ['Entregados', countStatus('delivered')],
      ['Incidencias activas', packages.filter((p) => p.currentStatus === 'incident' || openAlertsFor(p.id) > 0).length],
      ['Alertas abiertas', openAlerts.length],
      ['Urgentes', packages.filter((p) => p.urgency === 'urgente').length],
      ['Demorados', delayed],
      ['Zona incidencia', incidentZone?.name || incidentZone?.code || '—'],
    ],
    paquetes: packages.map((pkg) => ({
      Guía: pkg.guideNumber,
      Origen: pkg.originCity || '',
      Destino: getDestination(pkg),
      Destinatario: getRecipientName(pkg),
      Urgencia: pkg.urgency || 'normal',
      Zona: pkg.assignedZoneCode || pkg.assignedZoneId || '',
      Estado: pkg.currentStatus || '',
      'Último escaneo': pkg.lastScanAt ? formatDate(pkg.lastScanAt) : 'Sin escaneo',
      'Fecha creación': formatDate(pkg.createdAt),
      'Peso kg': getWeight(pkg),
      'Volumen m3': getVolume(pkg),
      Bultos: getBundles(pkg),
      Producto: getProductType(pkg),
      'Tiene incidencia': pkg.currentStatus === 'incident' || openAlertsFor(pkg.id) > 0 ? 'Sí' : 'No',
      'Motivo incidencia': pkg.incidentReason || '',
      'Alertas abiertas': openAlertsFor(pkg.id),
    })),
    alertas: alerts.map((alert) => ({
      Estado: alert.status === 'resolved' ? 'Resuelta' : 'Abierta',
      Severidad: alert.severity || 'medium',
      Tipo: alert.type || '',
      'Tipo incidencia': alert.incidentType || '',
      Guía: alert.guideNumber || alert.packageId || '',
      Mensaje: alert.message || '',
      'Fecha creación': formatDate(alert.createdAt),
      'Fecha resolución': alert.resolvedAt ? formatDate(alert.resolvedAt) : '',
      'Resuelta por': alert.resolvedByName || '',
      'Nota resolución': alert.resolutionNote || '',
    })),
    zonas: zones.map((zone) => ({
      Código: zone.code || zone.id,
      Nombre: zone.name || '',
      Tipo: zone.type || '',
      Destinos: Array.isArray(zone.destinations) ? zone.destinations.join(', ') : (zone.destinations || ''),
      Activa: zone.active === false ? 'No' : 'Sí',
    })),
  }
}

export async function exportOperationalExcel() {
  throw new Error(EXCEL_EXPORT_UNAVAILABLE_REASON)
}
