import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { registrar } from '../services/api.js'
import { PERFIS, PERFIS_PUBLICOS, DESCRICAO_PERFIL } from '../utils/perfis.js'

const vazio = { nome: '', email: '', senha: '', confirmar: '', perfil: 'GESTOR' }

export default function Registro() {
  const { login } = useAuth()
  const [f, setF] = useState(vazio)
  const [erros, setErros] = useState({})
  const [carregando, setCarregando] = useState(false)

  const set = (k) => (e) => setF((atual) => ({ ...atual, [k]: e.target.value }))

  const validar = () => {
    const er = {}
    if (f.nome.trim().length < 2) er.nome = 'Informe seu nome.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) er.email = 'Email inválido.'
    if (f.senha.length < 6) er.senha = 'A senha deve ter no mínimo 6 caracteres.'
    if (f.senha !== f.confirmar) er.confirmar = 'As senhas não conferem.'
    if (!PERFIS_PUBLICOS.includes(f.perfil)) er.perfil = 'Escolha um perfil.'
    return er
  }

  const criar = async (e) => {
    e.preventDefault()
    const er = validar()
    setErros(er)
    if (Object.keys(er).length) return

    setCarregando(true)
    try {
      const r = await registrar({
        nome: f.nome.trim(),
        email: f.email.trim().toLowerCase(),
        senha: f.senha,
        perfil: f.perfil,
      })
      // O backend já devolve o token: entra direto.
      login(r.token, r.usuario)
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
          <p>Plataforma de Vulnerabilidade Social Energética</p>
        </div>

        <form onSubmit={criar} noValidate>
          <Field rotulo="Nome" value={f.nome} onChange={set('nome')} erro={erros.nome} autoComplete="name" />
          <Field rotulo="Email" type="email" value={f.email} onChange={set('email')} erro={erros.email} autoComplete="email" />
          <Field rotulo="Senha" type="password" value={f.senha} onChange={set('senha')} erro={erros.senha} autoComplete="new-password" />
          <Field rotulo="Confirmar senha" type="password" value={f.confirmar} onChange={set('confirmar')} erro={erros.confirmar} autoComplete="new-password" />

          <fieldset className="perfis">
            <legend>Nível de acesso</legend>
            {PERFIS_PUBLICOS.map((p) => (
              <label key={p} className={`perfil-opcao ${f.perfil === p ? 'ativo' : ''}`}>
                <input type="radio" name="perfil" value={p} checked={f.perfil === p} onChange={set('perfil')} />
                <span>
                  <strong>{PERFIS[p]}</strong>
                  <small>{DESCRICAO_PERFIL[p]}</small>
                </span>
              </label>
            ))}
            {erros.perfil && <span className="erro" role="alert">{erros.perfil}</span>}
          </fieldset>

          <p className="ajuda">
            O perfil Administrador é concedido por um administrador na tela de Usuários.
            O primeiro usuário cadastrado no sistema torna-se administrador automaticamente.
          </p>

          {erros.geral && <span className="erro" role="alert">{erros.geral}</span>}

          <Button type="submit" disabled={carregando}>
            {carregando ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>

        <p className="login-footer">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
