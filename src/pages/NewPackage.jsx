import { useMemo, useState } from 'react'
import PackageLabel from '../components/PackageLabel'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { classifyPackage, getZoneLabel } from '../services/classificationService'
import { createPackage, getDocument } from '../services/firestoreService'
import { useNavigate } from '../utils/router'

const DEMO_LOCALITIES = ['Córdoba Capital', 'Villa Carlos Paz', 'Cosquín', 'La Falda', 'Río Cuarto', 'Villa María', 'San Francisco', 'Buenos Aires', 'Rosario', 'Mendoza', 'Santa Fe', 'Tucumán']

function branchCity(branch) {
  return branch?.city || branch?.locality || branch?.name || branch?.label || ''
}

export default function NewPackage() {
  const { rules, zones, branches, settings } = useData(); const { profile } = useAuth(); const navigate = useNavigate()
  const [form, setForm] = useState(() => ({ guideNumber: `EC-${Date.now().toString().slice(-6)}`, barcodeValue: '', originCity: 'Córdoba Capital', destinationCity: 'Buenos Aires', originBranchId: '', destinationBranchId: '', recipientName: '', weightKg: 1, volumeM3: 0.01, bundles: 1, urgency: 'normal', productType: 'Paquetería' }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdPkg, setCreatedPkg] = useState(null)
  const localityOptions = useMemo(() => {
    const fromBranches = (branches || []).map((branch) => branchCity(branch)).filter(Boolean)
    const fromZones = (zones || []).flatMap((zone) => zone.destinations || zone.localities || [])
    return [...new Set([...fromBranches, ...fromZones, ...DEMO_LOCALITIES])].sort((a, b) => a.localeCompare(b, 'es'))
  }, [branches, zones])
  const zoneId = useMemo(() => classifyPackage({ ...form, packageData: { productType: form.productType } }, rules), [form, rules])
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  function selectCity(field, branchField, value) {
    const branch = (branches || []).find((item) => item.id === value)
    if (branch) setForm((prev) => ({ ...prev, [branchField]: branch.id, [field]: branchCity(branch) }))
    else setForm((prev) => ({ ...prev, [branchField]: '', [field]: value }))
  }
  function validate() {
    const required = ['guideNumber', 'recipientName', 'originCity', 'destinationCity', 'weightKg', 'volumeM3', 'bundles', 'productType', 'urgency']
    if (required.some((key) => !String(form[key] ?? '').trim())) return 'Completá todos los campos obligatorios.'
    if (Number(form.weightKg) <= 0 || Number(form.volumeM3) <= 0 || Number(form.bundles) <= 0) return 'Peso, volumen y bultos deben ser mayores a cero.'
    return ''
  }
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
      <label>Origen / localidad<input list="origin-options" value={form.originCity} onChange={(e) => selectCity('originCity', 'originBranchId', e.target.value)} required /><datalist id="origin-options">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branchCity(branch)}</option>)}{localityOptions.map((city) => <option key={city} value={city} />)}</datalist></label>
      <label>Destino / localidad<input list="destination-options" value={form.destinationCity} onChange={(e) => selectCity('destinationCity', 'destinationBranchId', e.target.value)} required /><datalist id="destination-options">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branchCity(branch)}</option>)}{localityOptions.map((city) => <option key={city} value={city} />)}</datalist></label>
      <label>Peso kg<input type="number" min="0.01" step="0.01" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} required /></label>
      <label>Volumen m³<input type="number" min="0.001" step="0.001" value={form.volumeM3} onChange={(e) => set('volumeM3', e.target.value)} required /></label>
      <label>Bultos<input type="number" min="1" value={form.bundles} onChange={(e) => set('bundles', e.target.value)} required /></label>
      <label>Urgencia<select value={form.urgency} onChange={(e) => set('urgency', e.target.value)} required><option value="normal">Normal</option><option value="urgente">Urgente</option></select></label>
      <label>Tipo de producto<input value={form.productType} onChange={(e) => set('productType', e.target.value)} required /></label>
      <div className="zone-preview"><small>Zona calculada</small><strong>{form.urgency === 'urgente' ? 'Cross-Docking/Urgente' : getZoneLabel(zoneId, zones)}</strong>{zoneId === 'zona-incidencias' && <span className="error-text">Destino no reconocido: se asignará Zona Incidencias para revisión.</span>}<span>Código visible/QR: {form.barcodeValue || form.guideNumber}</span></div>
      {error && <div className="error-box form-wide">{error}</div>}
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear paquete'}</button>
    </form>
    {createdPkg && <article className="card label-confirmation"><h3>Paquete creado correctamente</h3><p>Se creó el documento, el primer movimiento y el auditLog. Podés imprimir la etiqueta o abrir el detalle.</p><PackageLabel pkg={createdPkg} zones={zones} /><div className="actions"><button className="btn btn-primary" onClick={() => window.print()}>Imprimir etiqueta</button><button className="btn" onClick={() => navigate(`/packages/${createdPkg.id}`)}>Ir al detalle</button></div></article>}
  </div>
}
