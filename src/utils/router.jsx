/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const RouterContext = createContext(null)

export function RouterProvider({ children }) {
  const [location, setLocation] = useState({ pathname: window.location.pathname || '/', search: window.location.search })
  useEffect(() => {
    const onPop = () => setLocation({ pathname: window.location.pathname, search: window.location.search })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to)
    setLocation({ pathname: window.location.pathname, search: window.location.search })
  }, [])
  return <RouterContext.Provider value={{ location, navigate }}>{children}</RouterContext.Provider>
}

export function useLocation() { return useContext(RouterContext).location }
export function useNavigate() { return useContext(RouterContext).navigate }

export function Link({ to, children, className = '', onClick, target, ...props }) {
  const navigate = useNavigate()
  const handleClick = (event) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || target) return
    event.preventDefault()
    navigate(to)
  }

  return <a href={to} className={className} target={target} onClick={handleClick} {...props}>{children}</a>
}
