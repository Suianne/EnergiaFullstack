import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { login as loginApi } from '../services/api.js'

export default function Login() {
  const { login } = useAuth()
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
      const dados = await loginApi(email.trim().toLowerCase(), senha)
      login(dados.token, dados.usuario)
    } catch (err) {
      setErro(err.message || 'Erro ao fazer login.')
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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />
          <Field
            rotulo="Senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
          />

          {erro && <span className="erro" role="alert">{erro}</span>}

          <Button type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <p className="login-footer">
          Ainda não tem conta? <Link to="/registro">Criar conta</Link>
        </p>
      </div>
    </div>
  )
}
