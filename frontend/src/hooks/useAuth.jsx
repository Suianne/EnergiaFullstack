import { createContext, useContext, useState, useEffect } from 'react'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function lerStorage() {
  try {
    const token = localStorage.getItem('token')
    const usuario = JSON.parse(localStorage.getItem('usuario'))
    if (token && usuario) return { token, usuario }
  } catch {}
  return null
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(lerStorage)

  useEffect(() => {
    if (auth) {
      localStorage.setItem('token', auth.token)
      localStorage.setItem('usuario', JSON.stringify(auth.usuario))
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
    }
  }, [auth])

  const login = (token, usuario) => setAuth({ token, usuario })

  const logout = () => setAuth(null)

  const temPermissao = (...perfisPermitidos) => {
    if (!auth) return false
    return perfisPermitidos.includes(auth.usuario.perfil)
  }

  return (
    <AuthCtx.Provider value={{
      usuario: auth?.usuario ?? null,
      token: auth?.token ?? null,
      logado: !!auth,
      login,
      logout,
      temPermissao,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}
