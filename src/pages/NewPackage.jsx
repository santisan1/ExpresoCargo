import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { CANONICAL_LOCALITIES, canonicalizeLocality, classifyPackage, getZoneLabel, isProcessableLocality } from '../services/classificationService'
import { createPackage, getDocument } from '../services/firestoreService'
import { generatePackageLabelPdf } from '../services/labelPdfService'
import { useNavigate } from '../utils/router'

function branchCity(branch) {
  return branch?.city || branch?.locality || branch?.name || branch?.label || ''
}

export default function NewPackage() {
  const { rules, zones, branches, settings } = useData(); const { profile } = useAuth(); const navigate = useNavigate()
  const [form, setForm] = useState(() => ({ guideNumber: `EC-${Date.now().toString().slice(-6)}`, barcodeValue: '', originCity: 'Córdoba Capital', destinationCity: 'Buenos Aires', originBranchId: '', destinationBranchId: '', recipientName: '', weightKg: 1, volumeM3: 0.01, bundles: 1, urgency: 'normal', productType: 'Paquetería' }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdPkg, setCreatedPkg] = useState(null)
  const branchByCity = useMemo(() => {
    const entries = (branches || [])
      .map((branch) => [canonicalizeLocality(branchCity(branch)), branch])
      .filter(([city]) => city)
    return new Map(entries)
  }, [branches])
  const localityOptions = CANONICAL_LOCALITIES
  const zoneId = useMemo(() => classifyPackage({ ...form, packageData: { productType: form.productType } }, rules), [form, rules])
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  function selectCity(field, branchField, value) {
    const canonical = canonicalizeLocality(value) || value
    const branch = branchByCity.get(canonical)
    setForm((prev) => ({ ...prev, [field]: canonical, [branchField]: branch?.id || '' }))
  }
  function validate() {
    const required = ['guideNumber', 'recipientName', 'originCity', 'destinationCity', 'weightKg', 'volumeM3', 'bundles', 'productType', 'urgency']
    if (required.some((key) => !String(form[key] ?? '').trim())) return 'Completá todos los campos obligatorios.'
    if (Number(form.weightKg) <= 0 || Number(form.volumeM3) <= 0 || Number(form.bundles) <= 0) return 'Peso, volumen y bultos deben ser mayores a cero.'
    if (!isProcessableLocality(form.originCity)) return 'El origen debe ser una localidad canónica procesable.'
    if (!isProcessableLocality(form.destinationCity)) return 'El destino debe ser una localidad canónica procesable o Localidad Desconocida.'
    return ''
  }
  const downloadCreatedLabel = () => generatePackageLabelPdf(createdPkg, zones).catch((err) => console.error(err.message || err))

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const validation = validate()
    if (validation) { setError(validation); return }
    setSaving(true); setError('')
    try {
      const id = await createPackage(form, { profile, rules, zones, defaultSlaHours: settings.defaultSlaHours })
      const pkg = await getDocument('packages', id)
      setCreatedPkg(pkg)
    } catch (err) {
      setError(err.message || 'No se pudo crear el paquete')
    } finally { setSaving(false) }
  }
  return <div className="page-stack narrow"><div className="page-title"><div><h2>Alta de paquete</h2><p>Clasificación automática antes de grabar en Firestore.</p></div></div>
    <form className="card form-grid" onSubmit={submit}>
      <label>Guía / código QR<input value={form.guideNumber} onChange={(e) => set('guideNumber', e.target.value)} required /></label>
      <label>Código de barras (opcional)<input value={form.barcodeValue} onChange={(e) => set('barcodeValue', e.target.value)} placeholder="Si queda vacío usa la guía" /></label>
      <label>Destinatario<input value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} required /></label>
      <label>Origen / localidad<select value={form.originCity} onChange={(e) => selectCity('originCity', 'originBranchId', e.target.value)} required>{localityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
      <label>Destino / localidad<select value={form.destinationCity} onChange={(e) => selectCity('destinationCity', 'destinationBranchId', e.target.value)} required>{localityOptions.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
      <label>Peso kg<input type="number" min="0.01" step="0.01" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} required /></label>
      <label>Volumen m³<input type="number" min="0.001" step="0.001" value={form.volumeM3} onChange={(e) => set('volumeM3', e.target.value)} required /></label>
      <label>Bultos<input type="number" min="1" value={form.bundles} onChange={(e) => set('bundles', e.target.value)} required /></label>
      <label>Urgencia<select value={form.urgency} onChange={(e) => set('urgency', e.target.value)} required><option value="normal">Normal</option><option value="urgente">Urgente</option></select></label>
      <label>Tipo de producto<input value={form.productType} onChange={(e) => set('productType', e.target.value)} required /></label>
      <div className="zone-preview"><small>Zona calculada</small><strong>{form.urgency === 'urgente' ? 'Zona U - Urgentes / Cross-Docking' : getZoneLabel(zoneId, zones)}</strong>{zoneId === 'zona-incidencias' && <span className="error-text">Destino no reconocido: se asignará Zona Incidencias para revisión.</span>}<span>Código visible/QR: {form.barcodeValue || form.guideNumber}</span></div>
      {error && <div className="error-box form-wide">{error}</div>}
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear paquete'}</button>
    </form>
    {createdPkg && <article className="card label-confirmation"><h3>Paquete creado correctamente</h3><p>Se creó el documento, el primer movimiento y el auditLog. Podés descargar la etiqueta PDF o abrir el detalle.</p><div className="actions"><button className="btn btn-primary" onClick={downloadCreatedLabel}>Descargar etiqueta PDF</button><button className="btn" onClick={() => navigate(`/packages/${createdPkg.id}`)}>Ir al detalle</button></div></article>}
  </div>
}
