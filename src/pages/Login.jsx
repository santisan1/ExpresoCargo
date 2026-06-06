import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const demos = ['admin@expresocargo.com', 'supervisor@expresocargo.com', 'operario@expresocargo.com', 'operario2@expresocargo.com']

export default function Login() {
  const { login, authError, profileLoading } = useAuth()
  const [email, setEmail] = useState('supervisor@expresocargo.com')
  const [password, setPassword] = useState('Demo1234!')
  const [submitting, setSubmitting] = useState(false)
  async function onSubmit(event) {
    event.preventDefault(); setSubmitting(true)
    try { await login(email, password) } finally { setSubmitting(false) }
  }
  return <section className="login-page">
    <div className="login-card"><div className="brand login-brand"><span className="brand-mark">C</span><div><strong>ExpressoCargo Logistics MVP</strong><small>Operación logística</small></div></div>
      <h1>Acceso operativo</h1><p>Autenticación real con Firebase Auth y perfil operativo desde Firestore.</p>
      <form onSubmit={onSubmit} className="form"><label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label><label>Contraseña<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>{authError && <div className="error-box">{authError}</div>}<button className="btn btn-primary" disabled={submitting || profileLoading}>{submitting || profileLoading ? 'Validando...' : 'Ingresar'}</button></form>
      <div className="demo-users"><small>Usuarios demo seed:</small>{demos.map((demo) => <button key={demo} onClick={() => { setEmail(demo); setPassword('Demo1234!') }}>{demo}</button>)}</div>
    </div>
  </section>
}
