import { useEffect } from 'react'
import './App.css'
import Layout from './components/Layout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Alerts from './pages/Alerts'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import NewPackage from './pages/NewPackage'
import PackageDetail from './pages/PackageDetail'
import Packages from './pages/Packages'
import Reports from './pages/Reports'
import Scan from './pages/Scan'
import Settings from './pages/Settings'
import { canAccessRoute } from './utils/format'
import { RouterProvider, useLocation, useNavigate } from './utils/router'

function getInitialRoute(profile) {
  return profile?.role === 'operario' ? '/scan' : '/dashboard'
}

function AccessDenied({ profile }) {
  return <div className="card"><h2>Acceso denegado</h2><p>Tu rol ({profile?.role}) no tiene permisos para esta pantalla.</p></div>
}

function ProtectedApp() {
  const { isAuthenticated, loading, authError, profile } = useAuth()
  const location = useLocation(); const navigate = useNavigate()
  const initialRoute = getInitialRoute(profile)

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated && location.pathname !== '/login') navigate('/login')
    if (isAuthenticated && ['/login', '/', '/app'].includes(location.pathname)) navigate(initialRoute)
    if (isAuthenticated && profile?.role === 'operario' && location.pathname === '/dashboard') navigate('/scan')
  }, [loading, isAuthenticated, location.pathname, navigate, initialRoute, profile?.role])

  if (loading) return <div className="boot">Validando sesión operativa...</div>
  if (!isAuthenticated) return <Login />

  const path = ['/', '/app', '/login'].includes(location.pathname) ? initialRoute : location.pathname
  let page
  if (!canAccessRoute(profile, path)) page = <AccessDenied profile={profile} />
  else if (path === '/dashboard') page = <Dashboard />
  else if (path === '/scan') page = <Scan />
  else if (path === '/packages') page = <Packages />
  else if (path === '/packages/new') page = <NewPackage />
  else if (path.startsWith('/packages/')) page = <PackageDetail id={path.split('/')[2]} />
  else if (path === '/alerts') page = <Alerts />
  else if (path === '/reports') page = <Reports />
  else if (path === '/settings') page = <Settings />
  else page = <AccessDenied profile={profile} />
  return <DataProvider><Layout>{authError && <div className="error-box">{authError}</div>}{page}</Layout></DataProvider>
}

export default function App() {
  return <RouterProvider><AuthProvider><ProtectedApp /></AuthProvider></RouterProvider>
}
