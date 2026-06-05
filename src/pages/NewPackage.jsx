import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { classifyPackage, getZoneLabel } from '../services/classificationService'
import { createPackage } from '../services/firestoreService'
import { useNavigate } from '../utils/router'

export default function NewPackage() {
  const { rules, zones, settings } = useData(); const { profile } = useAuth(); const navigate = useNavigate()
  const [form, setForm] = useState(() => ({ guideNumber: `EC-${Date.now().toString().slice(-6)}`, originCity: 'Córdoba Capital', destinationCity: 'Buenos Aires', recipientName: '', weightKg: 1, volumeM3: 0.01, bundles: 1, urgency: 'normal', productType: 'Paquetería' }))
  const [saving, setSaving] = useState(false)
  const zoneId = useMemo(() => classifyPackage({ ...form, packageData: { productType: form.productType } }, rules), [form, rules])
  async function submit(event) { event.preventDefault(); setSaving(true); try { const id = await createPackage(form, { profile, rules, zones, defaultSlaHours: settings.defaultSlaHours }); navigate(`/packages/${id}`) } finally { setSaving(false) } }
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  return <div className="page-stack narrow"><div className="page-title"><div><h2>Alta de paquete</h2><p>Clasificación automática antes de grabar en Firestore.</p></div></div><form className="card form-grid" onSubmit={submit}>
    <label>Guía / código QR<input value={form.guideNumber} onChange={(e) => set('guideNumber', e.target.value)} required /></label><label>Destinatario<input value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} required /></label><label>Origen<input value={form.originCity} onChange={(e) => set('originCity', e.target.value)} required /></label><label>Destino / localidad<input value={form.destinationCity} onChange={(e) => set('destinationCity', e.target.value)} required /></label><label>Peso kg<input type="number" step="0.01" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} /></label><label>Volumen m³<input type="number" step="0.001" value={form.volumeM3} onChange={(e) => set('volumeM3', e.target.value)} /></label><label>Bultos<input type="number" value={form.bundles} onChange={(e) => set('bundles', e.target.value)} /></label><label>Urgencia<select value={form.urgency} onChange={(e) => set('urgency', e.target.value)}><option value="normal">Normal</option><option value="urgente">Urgente</option></select></label><label>Tipo de producto<input value={form.productType} onChange={(e) => set('productType', e.target.value)} /></label>
    <div className="zone-preview"><small>Zona calculada</small><strong>{getZoneLabel(zoneId, zones)}</strong><span>Código visible/QR: {form.guideNumber}</span></div><button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear paquete'}</button>
  </form></div>
}
