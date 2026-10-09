import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usuarioAtual, definirToken } from '../services/api.js'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function lerStorage() {
  try {
    const token = localStorage.getItem('token')
    const usuario = JSON.parse(localStorage.getItem('usuario'))
    if (token && usuario) return { token, usuario }
  } catch {
    // storage indisponível ou corrompido: começa deslogado
  }
  return null
}

function gravarStorage(sessao) {
  try {
    if (sessao) {
      localStorage.setItem('token', sessao.token)
      localStorage.setItem('usuario', JSON.stringify(sessao.usuario))
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
    }
  } catch {
    // sem storage: a sessão dura só enquanto a aba estiver aberta (o token fica em memória na API)
  }
}

// Token em memória + storage são atualizados ANTES do setState, para que qualquer
// requisição disparada pela re-renderização já saia autenticada.
function aplicarSessao(sessao) {
  definirToken(sessao?.token)
  gravarStorage(sessao)
  return sessao
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => aplicarSessao(lerStorage()))

  const login = useCallback((token, usuario) => setAuth(aplicarSessao({ token, usuario })), [])
  const logout = useCallback(() => setAuth(aplicarSessao(null)), [])

  // Qualquer chamada à API que receba 401 encerra a sessão
  useEffect(() => {
    window.addEventListener('auth:expirada', logout)
    return () => window.removeEventListener('auth:expirada', logout)
  }, [logout])

  // Ao entrar (ou reabrir o app), sincroniza perfil e token com o servidor:
  // um administrador pode ter alterado o nível de acesso deste usuário.
  const idUsuario = auth?.usuario?.id
  useEffect(() => {
    if (!idUsuario) return undefined
    let ativo = true
    usuarioAtual()
      .then((r) => {
        if (ativo && r?.token && r?.usuario) setAuth(aplicarSessao({ token: r.token, usuario: r.usuario }))
      })
      .catch(() => {
        // falha de rede: mantém a sessão local; 401 já é tratado pelo evento acima
      })
    return () => {
      ativo = false
    }
  }, [idUsuario])

  const temPermissao = useCallback(
    (...perfisPermitidos) => !!auth && perfisPermitidos.includes(auth.usuario.perfil),
    [auth],
  )

  return (
    <AuthCtx.Provider
      value={{
        usuario: auth?.usuario ?? null,
        token: auth?.token ?? null,
        logado: !!auth,
        login,
        logout,
        temPermissao,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}
