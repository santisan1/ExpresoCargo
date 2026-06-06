import { useState } from 'react'
import { Link, useLocation } from '../utils/router'
import { useAuth } from '../context/AuthContext'
import { canAccessRoute } from '../utils/format'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/scan', label: 'Escaneo', icon: '⌗' },
  { to: '/packages', label: 'Paquetes', icon: '▤' },
  { to: '/packages/new', label: 'Nuevo paquete', icon: '+' },
  { to: '/alerts', label: 'Alertas', icon: '⚠' },
  { to: '/reports', label: 'Reportes', icon: '↧' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout({ children }) {
  const { profile, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const visible = nav.filter((item) => canAccessRoute(profile, item.to))
  const closeMenu = () => setMenuOpen(false)
  return <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
    <button className="mobile-overlay" type="button" aria-label="Cerrar menú" onClick={closeMenu} />
    <aside className="sidebar">
      <Link to="/dashboard" className="brand" onClick={closeMenu}><span className="brand-mark">🚚</span><div><strong>ExpressoCargo Logistics MVP</strong><small>Operación logística</small></div></Link>
      <nav>{visible.map((item) => <Link key={item.to} to={item.to} onClick={closeMenu} className={location.pathname === item.to ? 'active' : ''}><span>{item.icon}</span>{item.label}</Link>)}</nav>
      <div className="side-note">Integración simulada para MVP académico. Firestore + Auth, sin backend.</div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button className="hamburger" type="button" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>☰</button>
        <div className="topbar-title"><h1>ExpressoCargo Logistics MVP</h1><p>Sectorización, clasificación automática y trazabilidad QR/barra.</p></div>
        <div className="user-box"><div><strong>{profile?.displayName || profile?.name}</strong><small>{profile?.role} · {profile?.sector}</small></div><button className="btn btn-ghost" onClick={logout}>Salir</button></div>
      </header>
      {children}
    </main>
  </div>
}
