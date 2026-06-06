/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getFirebase } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authInitializing, setAuthInitializing] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const profileCacheRef = useRef(new Map())

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}

    async function loadProfile(user, firestore, db) {
      const cachedProfile = profileCacheRef.current.get(user.uid)
      if (cachedProfile) {
        setProfile(cachedProfile)
        return
      }

      setProfileLoading(true)
      try {
        const profileRef = firestore.doc(db, 'users', user.uid)
        const profileSnap = await firestore.getDoc(profileRef)
        if (cancelled) return
        if (!profileSnap.exists()) {
          setProfile(null)
          setAuthError('Usuario sin perfil operativo')
          return
        }
        const data = { id: profileSnap.id, uid: user.uid, ...profileSnap.data() }
        if (data.active === false) {
          setProfile(null)
          setAuthError('Usuario inactivo')
          return
        }
        profileCacheRef.current.set(user.uid, data)
        setProfile(data)
        await firestore.updateDoc(profileRef, { lastLoginAt: firestore.serverTimestamp() }).catch(() => {})
      } catch (error) {
        if (!cancelled) {
          setProfile(null)
          setAuthError(error.message || 'No se pudo validar el perfil operativo')
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }

    getFirebase().then(({ auth, authSdk, db, firestore }) => {
      if (cancelled) return
      unsubscribe = authSdk.onAuthStateChanged(auth, async (user) => {
        if (cancelled) return
        setAuthError('')
        setAuthUser(user)
        if (!user) {
          setProfile(null)
          setProfileLoading(false)
          setAuthInitializing(false)
          return
        }
        await loadProfile(user, firestore, db)
        if (!cancelled) setAuthInitializing(false)
      })
    }).catch((error) => {
      if (!cancelled) {
        setAuthError(error.message || 'No se pudo inicializar Firebase')
        setAuthInitializing(false)
        setProfileLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
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

  const value = useMemo(() => ({
    authUser,
    profile,
    authInitializing,
    profileLoading,
    loading: authInitializing,
    authError,
    login,
    logout,
    isAuthenticated: Boolean(profile),
  }), [authUser, profile, authInitializing, profileLoading, authError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
