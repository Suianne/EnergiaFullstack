import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { rankCompleto } from '../utils/topsis.js'
import { useAuth } from './useAuth.jsx'
import { listarMunicipios, listarCriterios } from '../services/api.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const { logado } = useAuth()
  const [municipios, setMunicipios] = useState([])
  const [criterios, setCriterios] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    if (!logado) return
    setCarregando(true)
    setErro('')
    try {
      const [m, c] = await Promise.all([listarMunicipios(), listarCriterios()])
      if (Array.isArray(m)) setMunicipios(m)
      if (Array.isArray(c)) setCriterios(c.map((cr) => ({ ...cr, peso: Number(cr.peso) || 0, tipo: cr.tipo || 'beneficio' })))
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [logado])

  useEffect(() => {
    if (!logado) {
      setMunicipios([])
      setCriterios([])
      return
    }
    recarregar()
  }, [logado, recarregar])

  // Ranking calculado no cliente (pré-visualização ao vivo ao mexer nos pesos)
  const { ranking, excluidos } = useMemo(() => {
    try {
      return rankCompleto(municipios, criterios)
    } catch {
      return { ranking: [], excluidos: [] }
    }
  }, [municipios, criterios])

  return (
    <Ctx.Provider value={{ municipios, setMunicipios, criterios, setCriterios, ranking, excluidos, carregando, erro, recarregar }}>
      {children}
    </Ctx.Provider>
  )
}
