import { useCallback, useEffect, useState } from 'react'
import Card from '../components/Card.jsx'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { listarUsuarios, criarUsuario, atualizarPerfilUsuario, removerUsuario } from '../services/api.js'
import { PERFIS, DESCRICAO_PERFIL, rotuloPerfil } from '../utils/perfis.js'

const vazio = { nome: '', email: '', senha: '', perfil: 'GESTOR' }

export default function Usuarios() {
  const { usuario: eu } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState({ tipo: '', texto: '' })
  const [ocupado, setOcupado] = useState(null) // id em alteração
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(null)
  const [f, setF] = useState(vazio)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setUsuarios(await listarUsuarios())
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.message })
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const set = (k) => (e) => setF((atual) => ({ ...atual, [k]: e.target.value }))

  const criar = async (e) => {
    e.preventDefault()
    const er = {}
    if (f.nome.trim().length < 2) er.nome = 'Informe o nome.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) er.email = 'Email inválido.'
    if (f.senha.length < 6) er.senha = 'Mínimo de 6 caracteres.'
    setErros(er)
    if (Object.keys(er).length) return

    setSalvando(true)
    setMsg({ tipo: '', texto: '' })
    try {
      await criarUsuario({ nome: f.nome.trim(), email: f.email.trim().toLowerCase(), senha: f.senha, perfil: f.perfil })
      setF(vazio)
      setMsg({ tipo: 'ok', texto: 'Usuário criado.' })
      carregar()
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message })
    } finally {
      setSalvando(false)
    }
  }

  const mudarPerfil = async (u, perfil) => {
    if (perfil === u.perfil) return
    setOcupado(u.id)
    setMsg({ tipo: '', texto: '' })
    try {
      await atualizarPerfilUsuario(u.id, perfil)
      setMsg({ tipo: 'ok', texto: `${u.nome} agora é ${rotuloPerfil(perfil)}.` })
      carregar()
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message })
    } finally {
      setOcupado(null)
    }
  }

  const remover = async (u) => {
    setOcupado(u.id)
    setMsg({ tipo: '', texto: '' })
    try {
      await removerUsuario(u.id)
      setMsg({ tipo: 'ok', texto: `${u.nome} foi removido.` })
      setConfirmandoRemocao(null)
      carregar()
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message })
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      <header className="head">
        <div>
          <h1>Usuários e níveis de acesso</h1>
          <p>Defina quem é Administrador, Pesquisador ou Gestor público</p>
        </div>
      </header>

      {msg.texto && <p className={`alerta ${msg.tipo}`} role="status">{msg.texto}</p>}

      <div className="grid two">
        <Card titulo="Perfis">
          <ul className="lista-simples">
            {Object.keys(PERFIS).map((p) => (
              <li key={p}><strong>{PERFIS[p]}</strong> — {DESCRICAO_PERFIL[p]}</li>
            ))}
          </ul>
        </Card>

        <Card titulo="Novo usuário">
          <form className="form" onSubmit={criar} noValidate>
            <Field rotulo="Nome" value={f.nome} onChange={set('nome')} erro={erros.nome} />
            <Field rotulo="Email" type="email" value={f.email} onChange={set('email')} erro={erros.email} />
            <Field rotulo="Senha inicial" type="password" value={f.senha} onChange={set('senha')} erro={erros.senha} autoComplete="new-password" />
            <div className="field">
              <label htmlFor="novo-perfil">Perfil</label>
              <select id="novo-perfil" value={f.perfil} onChange={set('perfil')}>
                {Object.keys(PERFIS).map((p) => <option key={p} value={p}>{PERFIS[p]}</option>)}
              </select>
            </div>
            <div style={{ alignSelf: 'end' }}>
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Criar usuário'}</Button>
            </div>
          </form>
        </Card>
      </div>

      <Card titulo={`Usuários cadastrados (${usuarios.length})`} className="mt">
        {carregando ? <p className="ajuda">Carregando…</p> : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Desde</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const souEu = u.id === eu?.id
                  return (
                    <tr key={u.id}>
                      <td>{u.nome}{souEu && <span className="badge neutro" style={{ marginLeft: 6 }}>você</span>}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          aria-label={`Perfil de ${u.nome}`}
                          value={u.perfil}
                          disabled={ocupado === u.id || souEu}
                          onChange={(e) => mudarPerfil(u, e.target.value)}
                          style={{ width: 'auto' }}
                        >
                          {Object.keys(PERFIS).map((p) => <option key={p} value={p}>{PERFIS[p]}</option>)}
                        </select>
                      </td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-'}</td>
                      <td>
                        {souEu ? <span className="ajuda">—</span> : confirmandoRemocao === u.id ? (
                          <span className="row">
                            <Button variante="perigo" onClick={() => remover(u)} disabled={ocupado === u.id}>Confirmar</Button>
                            <Button variante="ghost" onClick={() => setConfirmandoRemocao(null)}>Cancelar</Button>
                          </span>
                        ) : (
                          <Button variante="ghost" onClick={() => setConfirmandoRemocao(u.id)} disabled={ocupado === u.id}>Remover</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
