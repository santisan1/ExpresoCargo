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

export function can(profile, permission, roles = []) {
  if (!profile) return false
  if (profile.role === 'admin') return true
  if (profile.permissions?.includes(permission)) return true
  return roles.includes(profile.role)
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
