import { getFirebase } from '../firebase'
import { classifyPackage, getZoneCode, getZoneLabel } from './classificationService'
import { hoursSince } from '../utils/format'

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

export async function subscribeCollection(path, callback, orderField = null) {
  const { db, firestore } = await sdk()
  const ref = firestore.collection(db, path)
  const q = orderField ? firestore.query(ref, firestore.orderBy(orderField)) : ref
  return firestore.onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))))
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
  const q = firestore.query(ref, firestore.orderBy('scannedAt', 'desc'))
  return firestore.onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))))
}

export async function findPackageByCode(code) {
  const { db, firestore } = await sdk()
  const packagesRef = firestore.collection(db, 'packages')
  const guideQ = firestore.query(packagesRef, firestore.where('guideNumber', '==', code), firestore.limit(1))
  const barcodeQ = firestore.query(packagesRef, firestore.where('barcodeValue', '==', code), firestore.limit(1))
  const [guideSnap, barcodeSnap] = await Promise.all([firestore.getDocs(guideQ), firestore.getDocs(barcodeQ)])
  const doc = guideSnap.docs[0] || barcodeSnap.docs[0]
  return doc ? { id: doc.id, ...doc.data() } : null
}

export async function createPackage(form, { profile, rules, zones, defaultSlaHours = 8 }) {
  const { db, firestore } = await sdk()
  const packageRef = firestore.doc(firestore.collection(db, 'packages'))
  const normalized = {
    guideNumber: form.guideNumber.trim(),
    barcodeValue: form.guideNumber.trim(),
    qrPayload: form.guideNumber.trim(),
    originBranchId: form.originBranchId || form.originBranch || 'centro-cordoba',
    destinationBranchId: form.destinationBranchId || form.destinationBranch || 'destino-manual',
    originCity: form.originCity,
    destinationCity: form.destinationCity,
    recipient: { name: form.recipientName, phone: form.recipientPhone || '', address: form.recipientAddress || '' },
    packageData: {
      weightKg: Number(form.weightKg || 0),
      volumeM3: Number(form.volumeM3 || 0),
      bundles: Number(form.bundles || 1),
      productType: form.productType || 'General',
    },
    urgency: form.urgency,
    priorityLabel: form.urgency === 'urgente' ? 'Alta' : 'Normal',
    currentStatus: 'created',
    currentLocation: 'Pre-guía generada',
    lastScanAt: null,
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
    scannedByUid: profile.uid,
    scannedBy: profile.displayName || profile.name || profile.email,
    scannedAt: firestore.serverTimestamp(),
    scanPoint: 'Alta de paquete',
    notes: 'Paquete creado desde CargoFlow MVP',
    source: 'app',
  }))
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({
    action: 'package.create', packageId: packageRef.id, guideNumber: packageData.guideNumber, actorUid: profile.uid,
    actorName: profile.displayName || profile.name, createdAt: firestore.serverTimestamp(), source: 'app',
  }))
  await batch.commit()
  return packageRef.id
}

export async function changePackageStatus(pkg, nextStatus, { profile, zones = [], rules = [], scanPoint = 'Escaneo operativo', notes = '', incidentReason = '' }) {
  const { db, firestore } = await sdk()
  const packageRef = firestore.doc(db, 'packages', pkg.id)
  const batch = firestore.writeBatch(db)
  let assignedZoneId = pkg.assignedZoneId || pkg.expectedZoneId || null
  let currentLocation = scanPoint
  let hasIncident = Boolean(pkg.hasIncident)
  let updates = {}

  if (nextStatus === 'classified') {
    const expectedZoneId = classifyPackage(pkg, rules)
    assignedZoneId = expectedZoneId
    currentLocation = getZoneLabel(expectedZoneId, zones)
    updates.expectedZoneId = expectedZoneId
    updates.assignedZoneCode = getZoneCode(expectedZoneId, zones)
    if (!expectedZoneId || expectedZoneId === 'zona-incidencias') {
      hasIncident = true
      await queueAlert(batch, db, firestore, pkg, 'wrong_zone', 'medium', `Clasificación requiere revisión: ${pkg.destinationCity || 'destino sin regla'}`)
    }
  }

  if (nextStatus === 'incident') {
    hasIncident = true
    currentLocation = 'Mesa de incidencias'
    updates.incidentReason = incidentReason || notes || 'Incidencia operativa'
    await queueAlert(batch, db, firestore, pkg, 'incident', 'high', incidentReason || notes || 'Paquete marcado con incidencia')
  }

  if (nextStatus === 'delivered') {
    await resolvePackageAlerts(batch, db, firestore, pkg.id, ['delay', 'no_scan'])
    currentLocation = 'Entrega confirmada'
  }

  updates = clean({
    ...updates,
    currentStatus: nextStatus,
    currentLocation,
    assignedZoneId,
    hasIncident,
    lastScanAt: firestore.serverTimestamp(),
    updatedAt: firestore.serverTimestamp(),
  })

  batch.update(packageRef, updates)
  batch.set(firestore.doc(firestore.collection(db, 'packages', pkg.id, 'movements')), clean({
    packageId: pkg.id,
    status: nextStatus,
    zoneCode: getZoneCode(assignedZoneId, zones) || pkg.assignedZoneCode || '',
    zoneId: assignedZoneId,
    scannedByUid: profile.uid,
    scannedBy: profile.displayName || profile.name || profile.email,
    scannedAt: firestore.serverTimestamp(),
    scanPoint,
    notes,
    source: 'app',
  }))
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({
    action: `package.${nextStatus}`, packageId: pkg.id, guideNumber: pkg.guideNumber, actorUid: profile.uid,
    actorName: profile.displayName || profile.name, createdAt: firestore.serverTimestamp(), source: 'app', notes,
  }))
  await batch.commit()
}

async function queueAlert(batch, db, firestore, pkg, type, severity, message) {
  const ref = firestore.doc(firestore.collection(db, 'alerts'))
  batch.set(ref, clean({ packageId: pkg.id, guideNumber: pkg.guideNumber, type, severity, message, status: 'open', createdAt: firestore.serverTimestamp(), updatedAt: firestore.serverTimestamp(), source: 'app' }))
}

async function resolvePackageAlerts(batch, db, firestore, packageId, types) {
  const q = firestore.query(firestore.collection(db, 'alerts'), firestore.where('packageId', '==', packageId), firestore.where('status', '==', 'open'))
  const snap = await firestore.getDocs(q)
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data()
    if (types.includes(data.type)) batch.update(docSnap.ref, { status: 'resolved', updatedAt: firestore.serverTimestamp() })
  })
}

export async function resolveAlert(alert, profile) {
  const { db, firestore } = await sdk()
  const batch = firestore.writeBatch(db)
  batch.update(firestore.doc(db, 'alerts', alert.id), { status: 'resolved', updatedAt: firestore.serverTimestamp() })
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({ action: 'alert.resolve', alertId: alert.id, packageId: alert.packageId, actorUid: profile.uid, actorName: profile.displayName || profile.name, createdAt: firestore.serverTimestamp(), source: 'app' }))
  await batch.commit()
}

export async function recalculateAlerts(packages, profile) {
  const { db, firestore } = await sdk()
  const batch = firestore.writeBatch(db)
  packages.forEach((pkg) => {
    if (pkg.currentStatus === 'delivered') return
    const basis = pkg.lastScanAt || pkg.createdAt
    if (pkg.currentStatus === 'created' && !pkg.lastScanAt) {
      queueAlert(batch, db, firestore, pkg, 'no_scan', 'medium', `Guía ${pkg.guideNumber} creada sin escaneo operativo`)
      batch.update(firestore.doc(db, 'packages', pkg.id), { noScanAlert: true, updatedAt: firestore.serverTimestamp() })
    }
    const sla = Number(pkg.slaHours || Math.max((pkg.scanDueMinutes || 120) / 60, 1))
    if (hoursSince(basis) > sla) {
      queueAlert(batch, db, firestore, pkg, 'delay', 'high', `Guía ${pkg.guideNumber} supera SLA de ${sla} h`)
      batch.update(firestore.doc(db, 'packages', pkg.id), { delayAlert: true, updatedAt: firestore.serverTimestamp() })
    }
  })
  batch.set(firestore.doc(firestore.collection(db, 'auditLog')), clean({ action: 'alerts.recalculate', actorUid: profile.uid, actorName: profile.displayName || profile.name, createdAt: firestore.serverTimestamp(), source: 'app' }))
  await batch.commit()
}
