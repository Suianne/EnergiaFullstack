import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'
import { registrarUsuario } from '../services/api.js'
import { PERFIS, NOME_PERFIL } from '../utils/perfis.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function Registro({ onLogin }) {
  const [f, setF] = useState({ nome: '', email: '', senha: '', confirmar: '', perfil: 'GESTOR', codigoAdmin: '' })
  const [info, setInfo] = useState({ primeiroUsuario: false, administradorComCodigo: false })
  const [erros, setErros] = useState({})
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    fetch(`${API}/auth/registro-info`).then((r) => r.json()).then(setInfo).catch(() => {})
  }, [])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const criar = async (e) => {
    e.preventDefault()
    const er = {}
    if (f.nome.trim().length < 2) er.nome = 'Informe seu nome'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = 'E-mail inválido'
    if (f.senha.length < 6) er.senha = 'Mínimo de 6 caracteres'
    if (f.confirmar !== f.senha) er.confirmar = 'As senhas não coincidem'
    if (f.perfil === 'ADMINISTRADOR' && !info.primeiroUsuario && !f.codigoAdmin) er.codigoAdmin = 'Informe o código de administrador'
    setErros(er)
    if (Object.keys(er).length) return

    setCarregando(true)
    try {
      const email = f.email.trim().toLowerCase()
      await registrarUsuario({ nome: f.nome.trim(), email, senha: f.senha, perfil: f.perfil, codigoAdmin: f.codigoAdmin || undefined })

      // Já entra logado depois de criar a conta.
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: f.senha }),
      })
      const dados = await res.json()
      if (!res.ok) throw new Error(dados.erro || 'Conta criada, mas não foi possível entrar. Faça login.')
      onLogin(dados.token, dados.usuario)
    } catch (err) {
      setErros({ geral: err.message })
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="login-icon">☀</span>
          <h1>Criar conta</h1>
          <p>Escolha o seu ator no sistema.</p>
        </div>

        <form onSubmit={criar} noValidate>
          <Field rotulo="Nome" value={f.nome} onChange={set('nome')} erro={erros.nome} autoComplete="name" />
          <Field rotulo="Email" type="email" value={f.email} onChange={set('email')} erro={erros.email} autoComplete="email" placeholder="seu@email.com" />
          <Field rotulo="Senha" type="password" value={f.senha} onChange={set('senha')} erro={erros.senha} autoComplete="new-password" />
          <Field rotulo="Confirmar senha" type="password" value={f.confirmar} onChange={set('confirmar')} erro={erros.confirmar} autoComplete="new-password" />

          <div className="field">
            <label htmlFor="perfil">Ator</label>
            <select id="perfil" value={f.perfil} onChange={set('perfil')}>
              <option value="GESTOR">{NOME_PERFIL.GESTOR}</option>
              <option value="PESQUISADOR">{NOME_PERFIL.PESQUISADOR}</option>
              <option value="ADMINISTRADOR" disabled={!info.primeiroUsuario && !info.administradorComCodigo}>{NOME_PERFIL.ADMINISTRADOR}</option>
            </select>
            <span className="nivel">{info.primeiroUsuario ? 'Esta é a primeira conta do sistema: ela será Administrador.' : PERFIS[f.perfil]}</span>
          </div>
          {f.perfil === 'ADMINISTRADOR' && !info.primeiroUsuario && (
            <Field rotulo="Código de administrador" type="password" value={f.codigoAdmin} onChange={set('codigoAdmin')} erro={erros.codigoAdmin} autoComplete="off" />
          )}

          {erros.geral && <span className="erro" role="alert">{erros.geral}</span>}

          <Button type="submit" disabled={carregando}>{carregando ? 'Criando...' : 'Criar conta'}</Button>
        </form>

        <p className="login-link">Já tem conta? <Link to="/login">Entrar</Link></p>
      </div>
    </div>
  )
}