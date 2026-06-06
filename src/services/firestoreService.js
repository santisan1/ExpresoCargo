import { getFirebase } from '../firebase'
import { classifyPackage, getZoneCode, getZoneLabel } from './classificationService'
import { can, hoursSince, STATUS_FLOW } from '../utils/format'

const MOVEMENT_TITLES = {
  created: 'Alta de paquete',
  received: 'Recepción',
  classified: 'Clasificación',
  dispatched: 'Despacho',
  delivered: 'Entrega',
  incident: 'Incidencia',
}

const CHECKPOINTS = {
  created: 'Pre-guía',
  received: 'Recepción',
  classified: 'Clasificación',
  dispatched: 'Despacho',
  delivered: 'Entrega',
  incident: 'Incidencias',
}

async function sdk() {
  return getFirebase()
}

function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]))
  }
  return value
}

function actorName(profile) {
  return profile?.displayName || profile?.name || profile?.email || 'Usuario operativo'
}

function requirePermission(profile, permission, roles = []) {
  if (!can(profile, permission, roles)) throw new Error('Acceso denegado para esta operación')
}

function assertAllowedTransition(pkg, nextStatus, profile) {
  if (!pkg?.id) throw new Error('Paquete inválido')
  if (pkg.currentStatus === nextStatus) throw new Error(`El paquete ya está en estado ${nextStatus}`)
  if (pkg.currentStatus === 'delivered') throw new Error('El flujo ya fue completado')
  if (pkg.currentStatus === 'incident' && nextStatus !== 'classified' && nextStatus !== 'dispatched' && nextStatus !== 'delivered' && !can(profile, 'packages.status.override')) {
    throw new Error('La incidencia requiere resolución o permiso de supervisión antes de continuar')
  }
  if (nextStatus === 'incident') return
  const currentIndex = STATUS_FLOW.indexOf(pkg.currentStatus)
  const nextIndex = STATUS_FLOW.indexOf(nextStatus)
  if (currentIndex === -1 || nextIndex === -1) throw new Error(`Transición no permitida: ${pkg.currentStatus} → ${nextStatus}`)
  if (nextIndex === currentIndex + 1) return
  if (can(profile, 'packages.status.override')) return
  throw new Error(`Transición no permitida: ${pkg.currentStatus} → ${nextStatus}`)
}

export async function subscribeCollection(path, callback, orderField = null) {
  const { db, firestore } = await sdk()
  const ref = firestore.collection(db, path)
  const q = orderField ? firestore.query(ref, firestore.orderBy(orderField)) : ref
  return firestore.onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
}

export async function getDocument(path, id) {
  const { db, firestore } = await sdk()
  const snap = await firestore.getDoc(firestore.doc(db, path, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function subscribeDocument(path, id, callback) {
  const { db, firestore } = await sdk()
  return firestore.onSnapshot(firestore.doc(db, path, id), (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null))
}

export async function subscribePackageMovements(packageId, callback) {
  const { db, firestore } = await sdk()
  const ref = firestore.collection(db, 'packages', packageId, 'movements')
  const q = firestore.query(ref, firestore.orderBy('scannedAt', 'asc'))
  return firestore.onSnapshot(q, (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
}

async function getFirstByField(firestore, ref, field, value) {
  if (!value) return null
  const snap = await firestore.getDocs(firestore.query(ref, firestore.where(field, '==', value), firestore.limit(1)))
  return snap.docs[0] || null
}

export async function findPackageByCode(code) {
  const value = String(code || '').trim()
  if (!value) return null
  const { db, firestore } = await sdk()
  const packagesRef = firestore.collection(db, 'packages')
  const found = await getFirstByField(firestore, packagesRef, 'guideNumber', value)
    || await getFirstByField(firestore, packagesRef, 'barcodeValue', value)
    || await getFirstByField(firestore, packagesRef, 'qrPayload', value)
  return found ? { id: found.id, ...found.data() } : null
}

export async function ensureUniquePackageCode(guideNumber, barcodeValue, currentId = null) {
  const { db, firestore } = await sdk()
  const packagesRef = firestore.collection(db, 'packages')
  const values = [...new Set([guideNumber, barcodeValue].map((value) => String(value || '').trim()).filter(Boolean))]
  for (const value of values) {
    const matches = await Promise.all([
      getFirstByField(firestore, packagesRef, 'guideNumber', value),
      getFirstByField(firestore, packagesRef, 'barcodeValue', value),
    ])
    if (matches.some((docSnap) => docSnap && docSnap.id !== currentId)) return false
  }
  return true
}

export async function createPackage(form, { profile, rules, zones, defaultSlaHours = 8 }) {
  requirePermission(profile, 'packages.create', ['admin', 'supervisor'])
  const { db, firestore } = await sdk()
  const guideNumber = String(form.guideNumber || '').trim()
  const barcodeValue = String(form.barcodeValue || guideNumber).trim()
  if (!guideNumber || !barcodeValue) throw new Error('La guía/código es obligatoria')
  if (!(await ensureUniquePackageCode(guideNumber, barcodeValue))) throw new Error('Ya existe un paquete con esta guía/código')
  const packageRef = firestore.doc(firestore.collection(db, 'packages'))
  const normalized = {
    guideNumber,
    barcodeValue,
    qrPayload: String(form.qrPayload || barcodeValue || guideNumber).trim(),
    originBranchId: form.originBranchId || null,
    destinationBranchId: form.destinationBranchId || null,
    originCity: form.originCity,
    destinationCity: form.destinationCity,
    recipient: { name: form.recipientName, phone: form.recipientPhone || '', address: form.recipientAddress || '' },
    packageData: {
      weightKg: Number(form.weightKg || 0),
      volumeM3: Number(form.volumeM3 || 0),
      bundles: Number(form.bundles || 1),
      productType: form.productType || 'General',
    },
    urgency: form.urgency || 'normal',
    priorityLabel: form.urgency === 'urgente' ? 'Alta' : 'Normal',
    currentStatus: 'created',
    currentLocation: 'Alta de paquete',
    lastScanAt: firestore.serverTimestamp(),
    scanDueMinutes: Number(form.scanDueMinutes || 120),
    hasIncident: false,
    incidentReason: null,
    delayAlert: false,
    noScanAlert: false,
    source: 'app',
  }
  const assignedZoneId = classifyPackage(normalized, rules)
  const packageData = clean({
    ...normalized,
    assignedZoneId,
    assignedZoneCode: getZoneCode(assignedZoneId, zones),
    expectedZoneId: assignedZoneId,
    slaHours: Number(form.slaHours || defaultSlaHours),
    createdAt: firestore.serverTimestamp(),
    updatedAt: firestore.serverTimestamp(),
    estimatedDispatchAt: firestore.serverTimestamp(),
  })
  const batch = firestore.writeBatch(db)
  batch.set(packageRef, packageData)
  batch.set(firestore.doc(firestore.collection(db, 'packages', packageRef.id, 'movements')), clean({
    packageId: packageRef.id,
    status: 'created',
    zoneCode: packageData.assignedZoneCode,
    zoneId: assignedZoneId,
    checkpoint: CHECKPOINTS.created,
    scanPoint: CHECKPOINTS.created,
    title: MOVEMENT_TITLES.created,
    notes: 'Paquete creado desde ExpressoCargo Logistics MVP.',
    scannedByUid: profile.uid,
    scannedByName: actorName(profile),
    scannedBy: actorName(profile),
    scannedAt: firestore.serverTimestamp(),
    source: 'app',
  }))
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({
    action: 'package.created', entityType: 'package', entityId: packageRef.id, packageId: packageRef.id, guideNumber: packageData.guideNumber,
    performedByUid: profile.uid, performedByName: actorName(profile), actorUid: profile.uid, actorName: actorName(profile),
    message: `Alta de paquete ${packageData.guideNumber}`, createdAt: firestore.serverTimestamp(), source: 'app',
  }))
  await batch.commit()
  return packageRef.id
}

export async function changePackageStatus(pkg, nextStatus, { profile, zones = [], rules = [], notes = '', incidentReason = '' }) {
  const permissions = {
    received: ['packages.receive', ['operario', 'supervisor']],
    classified: ['packages.classify', ['operario', 'supervisor']],
    dispatched: ['packages.dispatch', ['supervisor']],
    delivered: ['packages.deliver', ['supervisor']],
    incident: ['packages.incident', ['operario', 'supervisor']],
  }
  const [permission, roles] = permissions[nextStatus] || []
  requirePermission(profile, permission, roles)
  assertAllowedTransition(pkg, nextStatus, profile)

  const fresh = await getDocument('packages', pkg.id)
  if (!fresh) throw new Error('Paquete no encontrado')
  assertAllowedTransition(fresh, nextStatus, profile)

  const { db, firestore } = await sdk()
  const packageRef = firestore.doc(db, 'packages', pkg.id)
  const batch = firestore.writeBatch(db)
  let assignedZoneId = fresh.assignedZoneId || fresh.expectedZoneId || null
  let currentLocation = CHECKPOINTS[nextStatus]
  let hasIncident = Boolean(fresh.hasIncident)
  let updates = {}

  if (nextStatus === 'classified') {
    const expectedZoneId = classifyPackage(fresh, rules)
    assignedZoneId = expectedZoneId
    currentLocation = getZoneLabel(expectedZoneId, zones)
    updates.expectedZoneId = expectedZoneId
    updates.assignedZoneCode = getZoneCode(expectedZoneId, zones)
    if (!expectedZoneId || expectedZoneId === 'zona-incidencias') {
      hasIncident = true
      await queueAlertIfMissing(batch, firestore, db, fresh, 'wrong_zone', 'medium', `Clasificación requiere revisión: ${fresh.destinationCity || 'destino sin regla'}`)
    }
  }

  if (nextStatus === 'incident') {
    hasIncident = true
    currentLocation = 'Mesa de incidencias'
    updates.incidentReason = incidentReason || notes || 'Incidencia operativa'
    await queueAlertIfMissing(batch, firestore, db, fresh, 'incident', 'high', incidentReason || notes || 'Paquete marcado con incidencia')
  }

  if (nextStatus === 'delivered') {
    await resolvePackageAlerts(batch, firestore, db, fresh.id, profile)
    currentLocation = 'Entrega confirmada'
    hasIncident = false
    updates.incidentReason = null
    updates.delayAlert = false
    updates.noScanAlert = false
  }

  updates = clean({
    ...updates,
    currentStatus: nextStatus,
    currentLocation,
    assignedZoneId,
    assignedZoneCode: getZoneCode(assignedZoneId, zones) || fresh.assignedZoneCode,
    hasIncident,
    lastScanAt: firestore.serverTimestamp(),
    updatedAt: firestore.serverTimestamp(),
  })

  const checkpoint = CHECKPOINTS[nextStatus]
  const title = MOVEMENT_TITLES[nextStatus]
  batch.update(packageRef, updates)
  batch.set(firestore.doc(firestore.collection(db, 'packages', fresh.id, 'movements')), clean({
    packageId: fresh.id,
    status: nextStatus,
    zoneCode: updates.assignedZoneCode || '',
    zoneId: assignedZoneId,
    checkpoint,
    scanPoint: checkpoint,
    title,
    notes: notes || (nextStatus === 'incident' ? updates.incidentReason : `${title} mediante escaneo operativo.`),
    scannedByUid: profile.uid,
    scannedByName: actorName(profile),
    scannedBy: actorName(profile),
    scannedAt: firestore.serverTimestamp(),
    source: 'app',
  }))
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({
    action: nextStatus === 'incident' ? 'package.incident_created' : 'package.status_changed',
    entityType: 'package', entityId: fresh.id, packageId: fresh.id, guideNumber: fresh.guideNumber,
    performedByUid: profile.uid, performedByName: actorName(profile), actorUid: profile.uid, actorName: actorName(profile),
    message: nextStatus === 'incident' ? `Incidencia creada para ${fresh.guideNumber}` : `${fresh.guideNumber}: ${fresh.currentStatus} → ${nextStatus}`,
    createdAt: firestore.serverTimestamp(), source: 'app', notes,
  }))
  await batch.commit()
}

async function queueAlertIfMissing(batch, firestore, db, pkg, type, severity, message) {
  const q = firestore.query(firestore.collection(db, 'alerts'), firestore.where('packageId', '==', pkg.id), firestore.where('type', '==', type), firestore.where('status', '==', 'open'), firestore.limit(1))
  const snap = await firestore.getDocs(q)
  if (!snap.empty) return
  const ref = firestore.doc(firestore.collection(db, 'alerts'))
  batch.set(ref, clean({ packageId: pkg.id, guideNumber: pkg.guideNumber, type, severity, message, status: 'open', createdAt: firestore.serverTimestamp(), updatedAt: firestore.serverTimestamp(), source: 'app' }))
}

async function resolvePackageAlerts(batch, firestore, db, packageId, profile, types = null) {
  const q = firestore.query(firestore.collection(db, 'alerts'), firestore.where('packageId', '==', packageId), firestore.where('status', '==', 'open'))
  const snap = await firestore.getDocs(q)
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data()
    if (!types || types.includes(data.type)) batch.update(docSnap.ref, { status: 'resolved', resolvedAt: firestore.serverTimestamp(), resolvedByUid: profile?.uid || null, resolvedByName: actorName(profile), updatedAt: firestore.serverTimestamp() })
  })
}

export async function resolveAlert(alert, profile, resolutionNote = '') {
  requirePermission(profile, 'alerts.resolve', ['supervisor'])
  const { db, firestore } = await sdk()
  const batch = firestore.writeBatch(db)
  batch.update(firestore.doc(db, 'alerts', alert.id), clean({ status: 'resolved', resolvedAt: firestore.serverTimestamp(), resolvedByUid: profile.uid, resolvedByName: actorName(profile), resolutionNote, updatedAt: firestore.serverTimestamp() }))
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({
    action: 'alert.resolved', entityType: 'alert', entityId: alert.id, alertId: alert.id, packageId: alert.packageId,
    performedByUid: profile.uid, performedByName: actorName(profile), actorUid: profile.uid, actorName: actorName(profile),
    message: `Alerta ${alert.type || alert.id} resuelta`, createdAt: firestore.serverTimestamp(), source: 'app', notes: resolutionNote,
  }))
  await batch.commit()
}

export async function recalculateAlerts(packages, profile) {
  requirePermission(profile, 'alerts.recalculate', ['supervisor'])
  const { db, firestore } = await sdk()
  const batch = firestore.writeBatch(db)
  for (const pkg of packages) {
    if (pkg.currentStatus === 'delivered') continue
    const basis = pkg.lastScanAt || pkg.createdAt
    if (pkg.currentStatus === 'created' && !pkg.lastScanAt && !pkg.noScanAlert) {
      await queueAlertIfMissing(batch, firestore, db, pkg, 'no_scan', 'medium', `Guía ${pkg.guideNumber} creada sin escaneo operativo`)
      batch.update(firestore.doc(db, 'packages', pkg.id), { noScanAlert: true, updatedAt: firestore.serverTimestamp() })
    }
    const sla = Number(pkg.slaHours || Math.max((pkg.scanDueMinutes || 120) / 60, 1))
    if (hoursSince(basis) > sla && !pkg.delayAlert) {
      await queueAlertIfMissing(batch, firestore, db, pkg, 'delay', 'high', `Guía ${pkg.guideNumber} supera SLA de ${sla} h`)
      batch.update(firestore.doc(db, 'packages', pkg.id), { delayAlert: true, updatedAt: firestore.serverTimestamp() })
    }
  }
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({ action: 'alerts.recalculate', entityType: 'alert', performedByUid: profile.uid, performedByName: actorName(profile), actorUid: profile.uid, actorName: actorName(profile), message: 'Recalculo de alertas operativas', createdAt: firestore.serverTimestamp(), source: 'app' }))
  await batch.commit()
}
