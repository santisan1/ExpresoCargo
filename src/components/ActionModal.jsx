export default function ActionModal({ open, title, description, fieldLabel, value, onChange, required = false, loading = false, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onCancel, onConfirm, error }) {
  if (!open) return null
  return <div className="modal action-modal" role="dialog" aria-modal="true" aria-labelledby="action-modal-title">
    <div className="modal-card action-modal-card">
      <h3 id="action-modal-title">{title}</h3>
      {description && <p className="muted">{description}</p>}
      {fieldLabel && <label>{fieldLabel}{required ? ' *' : ''}<textarea rows="5" value={value} onChange={(event) => onChange?.(event.target.value)} placeholder={required ? 'Ingresá el detalle operativo requerido' : 'Notas opcionales para auditoría y trazabilidad'} autoFocus /></label>}
      {error && <div className="error-box">{error}</div>}
      <div className="actions modal-actions">
        <button className="btn" type="button" disabled={loading} onClick={onCancel}>{cancelLabel}</button>
        <button className="btn btn-primary" type="button" disabled={loading || (required && !String(value || '').trim())} onClick={onConfirm}>{loading ? 'Guardando...' : confirmLabel}</button>
      </div>
    </div>
  </div>
}
