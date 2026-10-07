import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { rank } from '../utils/topsis.js'
import { useAuth } from './useAuth.jsx'
import { listarMunicipios, listarCriterios } from '../services/api.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const { logado } = useAuth()
  const [municipios, setMunicipios] = useState([])
  const [criterios, setCriterios] = useState([])
  const [carregando, setCarregando] = useState(false)

  const recarregar = useCallback(() => {
    if (!logado) return
    setCarregando(true)
    Promise.all([listarMunicipios(), listarCriterios()])
      .then(([m, c]) => {
        if (Array.isArray(m)) setMunicipios(m)
        if (Array.isArray(c)) {
          setCriterios(c.map((cr) => ({ ...cr, peso: Number(cr.peso) || 0 })))
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [logado])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  const ranking = useMemo(() => {
    try {
      return rank(municipios, criterios)
    } catch {
      return []
    }
  }, [municipios, criterios])

  return (
    <Ctx.Provider value={{ municipios, setMunicipios, criterios, setCriterios, ranking, carregando, recarregar }}>
      {children}
    </Ctx.Provider>
  )
}
