export const STATUS_META = {
  created: { label: 'Creado', tone: 'gray' },
  received: { label: 'Recepcionado', tone: 'blue' },
  classified: { label: 'Clasificado', tone: 'indigo' },
  dispatched: { label: 'Despachado', tone: 'orange' },
  delivered: { label: 'Entregado', tone: 'green' },
  incident: { label: 'Incidencia', tone: 'red' },
  CREADO: { label: 'Creado', tone: 'gray' },
  RECEPCIONADO: { label: 'Recepcionado', tone: 'blue' },
  CLASIFICADO: { label: 'Clasificado', tone: 'indigo' },
  DESPACHADO: { label: 'Despachado', tone: 'orange' },
  ENTREGADO: { label: 'Entregado', tone: 'green' },
  INCIDENCIA: { label: 'Incidencia', tone: 'red' },
}

export const STATUS_FLOW = ['created', 'received', 'classified', 'dispatched', 'delivered']

export function toDate(value) {
  if (!value) return null
  if (value.toDate) return value.toDate()
  if (value.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value) {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function hoursSince(value) {
  const date = toDate(value)
  if (!date) return 0
  return (Date.now() - date.getTime()) / 36e5
}

export function getRecipientName(pkg) {
  return pkg?.recipient?.name || pkg?.recipientName || 'Sin destinatario'
}

export function getDestination(pkg) {
  return pkg?.destinationCity || pkg?.destinationBranch || 'Sin destino'
}

export function getWeight(pkg) {
  return pkg?.packageData?.weightKg ?? pkg?.weightKg ?? 0
}

export function getVolume(pkg) {
  return pkg?.packageData?.volumeM3 ?? pkg?.volumeM3 ?? 0
}

export function getBundles(pkg) {
  return pkg?.packageData?.bundles ?? pkg?.bundles ?? 1
}

export function getProductType(pkg) {
  return pkg?.packageData?.productType || pkg?.productType || 'General'
}

export const ROUTE_PERMISSIONS = {
  '/dashboard': ['dashboard.view', ['supervisor']],
  '/scan': ['scan.view', ['operario', 'supervisor']],
  '/packages': ['packages.view', ['operario', 'supervisor']],
  '/packages/new': ['packages.create', ['supervisor']],
  '/alerts': ['alerts.view', ['supervisor']],
  '/reports': ['reports.view', ['supervisor']],
  '/settings': ['settings.view', ['supervisor']],
}

export function can(profile, permission, roles = []) {
  if (!profile || !permission) return false
  if (profile.role === 'admin') return true
  if (permission === 'packages.create' && profile.role === 'supervisor') return true
  if (profile.permissions?.includes(permission)) return true
  return roles.includes(profile.role)
}

export function canAccessRoute(profile, path) {
  if (path.startsWith('/packages/') && path !== '/packages/new') return can(profile, 'packages.view', ['operario', 'supervisor'])
  const [permission, roles] = ROUTE_PERMISSIONS[path] || []
  return can(profile, permission, roles)
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('\r', ' ').replaceAll('\n', ' ').replaceAll('"', '""')}"`).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
