/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getFirebase } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let unsubscribe = () => {}
    getFirebase().then(({ auth, authSdk, db, firestore }) => {
      unsubscribe = authSdk.onAuthStateChanged(auth, async (user) => {
        setLoading(true)
        setAuthError('')
        setAuthUser(user)
        if (!user) {
          setProfile(null)
          setLoading(false)
          return
        }
        try {
          const profileRef = firestore.doc(db, 'users', user.uid)
          const profileSnap = await firestore.getDoc(profileRef)
          if (!profileSnap.exists()) {
            setProfile(null)
            setAuthError('Usuario sin perfil operativo')
            setLoading(false)
            return
          }
          const data = { id: profileSnap.id, uid: user.uid, ...profileSnap.data() }
          if (data.active === false) {
            setProfile(null)
            setAuthError('Usuario inactivo')
            setLoading(false)
            return
          }
          await firestore.updateDoc(profileRef, { lastLoginAt: firestore.serverTimestamp() }).catch(() => {})
          setProfile(data)
        } catch (error) {
          setProfile(null)
          setAuthError(error.message || 'No se pudo validar el perfil operativo')
        } finally {
          setLoading(false)
        }
      })
    }).catch((error) => {
      setAuthError(error.message || 'No se pudo inicializar Firebase')
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  async function login(email, password) {
    const { auth, authSdk } = await getFirebase()
    setAuthError('')
    await authSdk.signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    const { auth, authSdk } = await getFirebase()
    await authSdk.signOut(auth)
  }

  const value = useMemo(() => ({ authUser, profile, loading, authError, login, logout, isAuthenticated: Boolean(profile) }), [authUser, profile, loading, authError])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
