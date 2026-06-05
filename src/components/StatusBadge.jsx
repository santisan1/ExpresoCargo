import { STATUS_META } from '../utils/format'

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || '—', tone: 'gray' }
  return <span className={`badge badge-${meta.tone}`}>{meta.label}</span>
}
