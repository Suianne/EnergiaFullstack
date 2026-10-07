import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { rank } from '../utils/topsis.js'
import { useAuth } from './useAuth.jsx'
import { listarMunicipios, listarCriterios } from '../services/api.js'
import { MUNICIPIOS, CRITERIOS } from '../services/mock.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const { logado } = useAuth()
  const [municipios, setMunicipios] = useState(MUNICIPIOS)
  const [criterios, setCriterios] = useState(CRITERIOS)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!logado) return

    setCarregando(true)
    Promise.all([listarMunicipios(), listarCriterios()])
      .then(([m, c]) => {
        if (Array.isArray(m) && m.length > 0) setMunicipios(m)
        if (Array.isArray(c) && c.length > 0) {
          setCriterios(c.map((cr) => ({ ...cr, peso: Number(cr.peso) || 0 })))
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [logado])

  const ranking = useMemo(() => {
    try {
      return rank(municipios, criterios)
    } catch {
      return []
    }
  }, [municipios, criterios])

  return (
    <Ctx.Provider value={{ municipios, setMunicipios, criterios, setCriterios, ranking, carregando }}>
      {children}
    </Ctx.Provider>
  )
}
