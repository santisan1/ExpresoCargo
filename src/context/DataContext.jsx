/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeCollection } from '../services/firestoreService'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [packages, setPackages] = useState([])
  const [alerts, setAlerts] = useState([])
  const [zones, setZones] = useState([])
  const [branches, setBranches] = useState([])
  const [rules, setRules] = useState([])
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState({ defaultSlaHours: 8, scanPoints: ['Recepción', 'Clasificación', 'Dock despacho', 'Entrega'] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const cleanups = []
    Promise.all([
      subscribeCollection('packages', setPackages),
      subscribeCollection('alerts', setAlerts),
      subscribeCollection('zones', setZones),
      subscribeCollection('branches', setBranches),
      subscribeCollection('classificationRules', setRules, 'priority'),
      subscribeCollection('users', setUsers),
      subscribeCollection('settings', (items) => setSettings((prev) => ({ ...prev, ...(items.find((item) => item.id === 'main') || items[0] || {}) }))),
    ]).then((unsubs) => {
      cleanups.push(...unsubs)
      if (mounted) setLoading(false)
    }).catch(() => mounted && setLoading(false))
    return () => {
      mounted = false
      cleanups.forEach((unsubscribe) => unsubscribe?.())
    }
  }, [])

  const value = useMemo(() => ({ packages, alerts, zones, branches, rules, users, settings, loading }), [packages, alerts, zones, branches, rules, users, settings, loading])
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
