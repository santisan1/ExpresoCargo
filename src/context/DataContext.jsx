/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeCollection } from '../services/firestoreService'

const DataContext = createContext(null)
const COLLECTION_KEYS = ['packages', 'alerts', 'zones', 'branches', 'rules', 'users', 'settings']
const DEFAULT_SETTINGS = { defaultSlaHours: 8, scanPoints: ['Recepción', 'Clasificación', 'Dock despacho', 'Entrega'] }

export function DataProvider({ children }) {
  const [packages, setPackages] = useState([])
  const [alerts, setAlerts] = useState([])
  const [zones, setZones] = useState([])
  const [branches, setBranches] = useState([])
  const [rules, setRules] = useState([])
  const [users, setUsers] = useState([])
  const [movements] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [pendingCollections, setPendingCollections] = useState(() => new Set(COLLECTION_KEYS))

  useEffect(() => {
    let cancelled = false
    const cleanups = []

    const markLoaded = (key) => {
      if (cancelled) return
      setPendingCollections((current) => {
        if (!current.has(key)) return current
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }

    const subscribe = async (key, path, setter, orderField = null) => {
      try {
        const unsubscribe = await subscribeCollection(path, (items) => {
          setter(items)
          markLoaded(key)
        }, orderField)
        if (cancelled) unsubscribe?.()
        else cleanups.push(unsubscribe)
      } catch {
        markLoaded(key)
      }
    }

    subscribe('packages', 'packages', setPackages)
    subscribe('alerts', 'alerts', setAlerts)
    subscribe('zones', 'zones', setZones)
    subscribe('branches', 'branches', setBranches)
    subscribe('rules', 'classificationRules', setRules, 'priority')
    subscribe('users', 'users', setUsers)
    subscribe('settings', 'settings', (items) => setSettings((prev) => ({ ...prev, ...(items.find((item) => item.id === 'main') || items[0] || {}) })))

    return () => {
      cancelled = true
      cleanups.forEach((unsubscribe) => unsubscribe?.())
    }
  }, [])

  const derivedMovements = useMemo(() => (movements.length ? movements : packages.map((pkg) => ({
    packageId: pkg.id,
    guideNumber: pkg.guideNumber,
    status: pkg.currentStatus,
    title: 'Ultimo estado conocido',
    checkpoint: pkg.currentLocation,
    zoneCode: pkg.assignedZoneCode,
    scannedByName: 'Sistema',
    scannedAt: pkg.lastScanAt || pkg.createdAt,
    notes: 'Movimiento derivado para reportes MVP.',
  }))), [movements, packages])

  const dataLoading = pendingCollections.size > 0
  const value = useMemo(() => ({
    packages,
    alerts,
    zones,
    branches,
    rules,
    users,
    movements: derivedMovements,
    settings,
    dataLoading,
    loading: dataLoading,
  }), [packages, alerts, zones, branches, rules, users, derivedMovements, settings, dataLoading])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
