export default function KpiCard({ label, value, hint, icon, tone = 'blue' }) {
  return <article className="kpi-card">
    <div className={`kpi-icon kpi-${tone}`}>{icon}</div>
    <div><p>{label}</p><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
  </article>
}
