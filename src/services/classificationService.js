const FALLBACK_CITY_ZONE = new Map([
  ['córdoba capital', 'zona-a-cordoba-capital'],
  ['cordoba capital', 'zona-a-cordoba-capital'],
  ['villa carlos paz', 'zona-b-sierras'],
  ['cosquín', 'zona-b-sierras'],
  ['cosquin', 'zona-b-sierras'],
  ['la falda', 'zona-b-sierras'],
  ['río cuarto', 'zona-c-interior-cordoba'],
  ['rio cuarto', 'zona-c-interior-cordoba'],
  ['villa maría', 'zona-c-interior-cordoba'],
  ['villa maria', 'zona-c-interior-cordoba'],
  ['san francisco', 'zona-c-interior-cordoba'],
  ['buenos aires', 'zona-d-nacional'],
  ['rosario', 'zona-d-nacional'],
  ['mendoza', 'zona-d-nacional'],
  ['santa fe', 'zona-d-nacional'],
  ['tucumán', 'zona-d-nacional'],
  ['tucuman', 'zona-d-nacional'],
])

const FALLBACK_ZONE_CODE = {
  'zona-u-urgentes-crossdock': 'URGENTE',
  'zona-a-cordoba-capital': 'ZONA-A',
  'zona-b-sierras': 'ZONA-B',
  'zona-c-interior-cordoba': 'ZONA-C',
  'zona-d-nacional': 'ZONA-D',
  'zona-incidencias': 'INC',
}

export function classifyPackage(pkg, rules = []) {
  const activeRules = rules.filter((rule) => rule.active !== false).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
  for (const rule of activeRules) {
    const { field, op, value } = rule.condition || {}
    const fieldValue = pkg[field] ?? pkg.packageData?.[field] ?? pkg.recipient?.[field]
    if (op === '==' && fieldValue === value) return rule.assignZoneId
    if (op === 'in' && Array.isArray(value) && value.includes(fieldValue)) return rule.assignZoneId
  }
  if (pkg.urgency === 'urgente') return 'zona-u-urgentes-crossdock'
  return FALLBACK_CITY_ZONE.get(String(pkg.destinationCity || '').toLowerCase().trim()) || 'zona-incidencias'
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
