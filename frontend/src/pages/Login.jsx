import { useState } from 'react'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setErro('')

    if (!email.trim() || !senha) {
      setErro('Preencha email e senha.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_URL || 'http://localhost:3000/api') + '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
        },
      )
      const dados = await res.json()

      if (!res.ok) {
        setErro(dados.erro || 'Erro ao fazer login.')
        return
      }

      onLogin(dados.token, dados.usuario)
    } catch {
      setErro('Não foi possível conectar ao servidor.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="login-icon">☀</span>
          <h1>Energia Renovável</h1>
          <p>Plataforma de Vulnerabilidade Social Energética</p>
        </div>

        <form onSubmit={entrar} noValidate>
          <Field
            rotulo="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />
          <Field
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
          />

          {erro && <span className="erro" role="alert">{erro}</span>}

          <Button type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
