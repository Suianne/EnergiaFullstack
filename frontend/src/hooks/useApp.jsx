import { createContext, useContext, useMemo, useState } from 'react';
import { rank } from '../utils/topsis.js';
import { MUNICIPIOS, CRITERIOS } from '../services/mock.js';

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({children}) {
    const [municipios, setMunicipios] = useState(MUNICIPIOS)
    const [criterios, setCriterios] = useState(CRITERIOS)
    const ranking = useMemo(() => rank(municipios, criterios), [municipios, criterios])
    return <Ctx.Provider value={{municipios, setMunicipios, criterios, setCriterios, ranking}}>{children}</Ctx.Provider>
}