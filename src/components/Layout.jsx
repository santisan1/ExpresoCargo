import { Link, useLocation } from '../utils/router'
import { useAuth } from '../context/AuthContext'
import { can } from '../utils/format'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦', roles: ['admin', 'supervisor'] },
  { to: '/scan', label: 'Escaneo', icon: '⌗', roles: ['admin', 'supervisor', 'operario'] },
  { to: '/packages', label: 'Paquetes', icon: '▤', roles: ['admin', 'supervisor', 'operario'] },
  { to: '/alerts', label: 'Alertas', icon: '⚠', roles: ['admin', 'supervisor'] },
  { to: '/reports', label: 'Reportes', icon: '↧', roles: ['admin', 'supervisor'] },
  { to: '/settings', label: 'Settings', icon: '⚙', roles: ['admin', 'supervisor'] },
]

export default function Layout({ children }) {
  const { profile, logout } = useAuth()
  const location = useLocation()
  const visible = nav.filter((item) => item.roles.includes(profile?.role) || profile?.role === 'admin')
  return <div className="shell">
    <aside className="sidebar">
      <Link to="/dashboard" className="brand"><span className="brand-mark">C</span><div><strong>CargoFlow MVP</strong><small>Expreso Cargo</small></div></Link>
      <nav>{visible.map((item) => <Link key={item.to} to={item.to} className={location.pathname === item.to ? 'active' : ''}><span>{item.icon}</span>{item.label}</Link>)}</nav>
      <div className="side-note">Integración simulada para MVP académico. Firestore + Auth, sin backend.</div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><h1>CargoFlow MVP - Expreso Cargo</h1><p>Sectorización, clasificación automática y trazabilidad QR/barra.</p></div>
        <div className="user-box"><div><strong>{profile?.displayName || profile?.name}</strong><small>{profile?.role} · {profile?.sector}</small></div><button className="btn btn-ghost" onClick={logout}>Salir</button></div>
      </header>
      {!can(profile, 'dashboard.view', ['supervisor', 'operario']) && null}
      {children}
    </main>
  </div>
}
