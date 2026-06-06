export const CANONICAL_LOCALITIES = [
  'Córdoba Capital',
  'Villa Carlos Paz',
  'Cosquín',
  'La Falda',
  'Río Cuarto',
  'Villa María',
  'San Francisco',
  'Buenos Aires',
  'Rosario',
  'Mendoza',
  'Santa Fe',
  'Tucumán',
  'Localidad Desconocida',
]

const LOCALITY_ALIASES = new Map([
  ['cordoba', 'Córdoba Capital'],
  ['cordoba capital', 'Córdoba Capital'],
  ['córdoba', 'Córdoba Capital'],
  ['córdoba capital', 'Córdoba Capital'],
  ['carlos paz', 'Villa Carlos Paz'],
  ['villa carlos paz', 'Villa Carlos Paz'],
  ['cosquin', 'Cosquín'],
  ['cosquín', 'Cosquín'],
  ['la falda', 'La Falda'],
  ['rio cuarto', 'Río Cuarto'],
  ['río cuarto', 'Río Cuarto'],
  ['villa maria', 'Villa María'],
  ['villa maría', 'Villa María'],
  ['san francisco', 'San Francisco'],
  ['buenos aires', 'Buenos Aires'],
  ['rosario', 'Rosario'],
  ['mendoza', 'Mendoza'],
  ['santa fe', 'Santa Fe'],
  ['tucuman', 'Tucumán'],
  ['tucumán', 'Tucumán'],
  ['localidad desconocida', 'Localidad Desconocida'],
])

const CITY_ZONE = new Map([
  ['Córdoba Capital', 'zona-a-cordoba-capital'],
  ['Villa Carlos Paz', 'zona-b-sierras'],
  ['Cosquín', 'zona-b-sierras'],
  ['La Falda', 'zona-b-sierras'],
  ['Río Cuarto', 'zona-c-interior-cordoba'],
  ['Villa María', 'zona-c-interior-cordoba'],
  ['San Francisco', 'zona-c-interior-cordoba'],
  ['Buenos Aires', 'zona-d-nacional'],
  ['Rosario', 'zona-d-nacional'],
  ['Mendoza', 'zona-d-nacional'],
  ['Santa Fe', 'zona-d-nacional'],
  ['Tucumán', 'zona-d-nacional'],
  ['Localidad Desconocida', 'zona-incidencias'],
])

const FALLBACK_ZONE_CODE = {
  'zona-u-urgentes-crossdock': 'URGENTE',
  'zona-a-cordoba-capital': 'ZONA-A',
  'zona-b-sierras': 'ZONA-B',
  'zona-c-interior-cordoba': 'ZONA-C',
  'zona-d-nacional': 'ZONA-D',
  'zona-incidencias': 'INC',
}

export function normalizeLocalityKey(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

export function canonicalizeLocality(value) {
  const raw = String(value || '').trim().replace(/\s+/g, ' ')
  if (!raw) return ''
  return LOCALITY_ALIASES.get(raw.toLowerCase()) || LOCALITY_ALIASES.get(normalizeLocalityKey(raw)) || ''
}

export function isProcessableLocality(value) {
  return Boolean(canonicalizeLocality(value))
}

export function classifyPackage(pkg, rules = []) {
  if (pkg.urgency === 'urgente') return 'zona-u-urgentes-crossdock'
  const canonicalDestination = canonicalizeLocality(pkg.destinationCity)
  if (canonicalDestination) return CITY_ZONE.get(canonicalDestination) || 'zona-incidencias'

  const activeRules = rules.filter((rule) => rule.active !== false).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  for (const rule of activeRules) {
    const { field, op, value } = rule.condition || {}
    const fieldValue = pkg[field] ?? pkg.packageData?.[field] ?? pkg.recipient?.[field]
    if (op === '==' && fieldValue === value) return rule.assignZoneId
    if (op === 'in' && Array.isArray(value) && value.includes(fieldValue)) return rule.assignZoneId
  }
  return 'zona-incidencias'
}

export function getZoneLabel(zoneId, zones = []) {
  if (!zoneId) return 'Sin zona definida'
  const zone = zones.find((item) => item.id === zoneId || item.code === zoneId)
  return zone ? `${zone.name || zone.code}${zone.dock ? ` · ${zone.dock}` : ''}` : (FALLBACK_ZONE_CODE[zoneId] || zoneId)
}

export function getZoneCode(zoneId, zones = []) {
  const zone = zones.find((item) => item.id === zoneId || item.code === zoneId)
  return zone?.code || FALLBACK_ZONE_CODE[zoneId] || zoneId || ''
}
