import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { rank } from '../utils/topsis.js'
import { useAuth } from './useAuth.jsx'
import { listarMunicipios, listarCriterios } from '../services/api.js'
import { MUNICIPIOS, CRITERIOS } from '../services/mock.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const { logado } = useAuth()
  const [municipios, setMunicipios] = useState([])
  const [criterios, setCriterios] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!logado) {
      setMunicipios([])
      setCriterios([])
      setCarregando(false)
      return
    }

    setCarregando(true)
    Promise.all([listarMunicipios(), listarCriterios()])
      .then(([m, c]) => {
        setMunicipios(m)
        setCriterios(c)
      })
      .catch(() => {
        // Fallback para dados mock se a API não estiver disponível
        setMunicipios(MUNICIPIOS)
        setCriterios(CRITERIOS)
      })
      .finally(() => setCarregando(false))
  }, [logado])

  const ranking = useMemo(() => rank(municipios, criterios), [municipios, criterios])

  return (
    <Ctx.Provider value={{ municipios, setMunicipios, criterios, setCriterios, ranking, carregando }}>
      {children}
    </Ctx.Provider>
  )
}
