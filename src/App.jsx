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

function CurrentPage({ profile }) {
  const location = useLocation()
  const initialRoute = getInitialRoute(profile)
  const path = ['/', '/app', '/login'].includes(location.pathname) ? initialRoute : location.pathname

  if (!canAccessRoute(profile, path)) return <AccessDenied profile={profile} />
  if (path === '/dashboard') return <Dashboard />
  if (path === '/scan') return <Scan />
  if (path === '/packages') return <Packages />
  if (path === '/packages/new') return <NewPackage />
  if (path.startsWith('/packages/')) return <PackageDetail id={path.split('/')[2]} />
  if (path === '/alerts') return <Alerts />
  if (path === '/reports') return <Reports />
  if (path === '/settings') return <Settings />
  return <AccessDenied profile={profile} />
}

function AuthenticatedApp() {
  const { authError, profile } = useAuth()

  return <DataProvider><Layout>{authError && <div className="error-box">{authError}</div>}<CurrentPage profile={profile} /></Layout></DataProvider>
}

function ProtectedApp() {
  const { authUser, isAuthenticated, authInitializing, profileLoading, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const initialRoute = getInitialRoute(profile)

  useEffect(() => {
    if (authInitializing || profileLoading) return
    if (!isAuthenticated && location.pathname !== '/login') navigate('/login')
    if (isAuthenticated && ['/login', '/', '/app'].includes(location.pathname)) navigate(initialRoute)
    if (isAuthenticated && profile?.role === 'operario' && location.pathname === '/dashboard') navigate('/scan')
  }, [authInitializing, profileLoading, isAuthenticated, location.pathname, navigate, initialRoute, profile?.role])

  if (authInitializing) return <div className="boot">Validando sesión operativa...</div>
  if (authUser && profileLoading && !profile) return <div className="boot">Cargando perfil operativo...</div>
  if (!isAuthenticated) return <Login />
  return <AuthenticatedApp />
}

export default function App() {
  return <RouterProvider><AuthProvider><ProtectedApp /></AuthProvider></RouterProvider>
}
