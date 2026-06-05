import AlertTable from '../components/AlertTable'
import { useData } from '../context/DataContext'

export default function Alerts() {
  const { alerts } = useData()
  return <div className="page-stack"><div className="page-title"><div><h2>Alertas tempranas</h2><p>Demoras, no scan, zona incorrecta e incidencias operativas.</p></div></div><AlertTable alerts={alerts} /></div>
}
