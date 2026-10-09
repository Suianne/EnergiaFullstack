import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import { listarUsuarios, alterarPerfilUsuario, removerUsuario } from '../services/api.js'
import { PERFIS, NOME_PERFIL } from '../utils/perfis.js'

export default function Usuarios() {
  const { usuario: eu } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')

  const carregar = useCallback(() => {
    listarUsuarios().then(setUsuarios).catch((e) => setErro(e.message))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const mudarPerfil = async (u, perfil) => {
    setErro(''); setMsg('')
    try {
      await alterarPerfilUsuario(u.id, perfil)
      setMsg(`${u.nome} agora é ${NOME_PERFIL[perfil]}. A mudança vale a partir do próximo login dessa pessoa.`)
      carregar()
    } catch (e) {
      setErro(e.message)
    }
  }

  const excluir = async (u) => {
    if (!window.confirm(`Excluir a conta de ${u.nome}?`)) return
    setErro(''); setMsg('')
    try {
      await removerUsuario(u.id)
      carregar()
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <>
      <header className="head">
        <div><h1>Usuários</h1><p>Cada pessoa escolhe o ator ao se cadastrar. Aqui você pode ajustar o nível de cada uma.</p></div>
      </header>

      <Card titulo="Níveis de acesso">
        <ul style={{ paddingLeft: '1.1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          {Object.entries(PERFIS).map(([k, d]) => <li key={k}><strong>{NOME_PERFIL[k]}:</strong> {d}</li>)}
        </ul>
      </Card>

      <div style={{ marginTop: '1rem' }}>
        <Card>
          {erro && <p className="erro" role="alert">{erro}</p>}
          {msg && <p className="sucesso">{msg}</p>}
          <div className="tablewrap"><table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Nível</th><th /></tr></thead>
            <tbody>{usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}{u.id === eu?.id && ' (você)'}</td>
                <td>{u.email}</td>
                <td>
                  <select aria-label={`Nível de ${u.nome}`} value={u.perfil} onChange={(e) => mudarPerfil(u, e.target.value)}>
                    {Object.keys(PERFIS).map((k) => <option key={k} value={k}>{NOME_PERFIL[k]}</option>)}
                  </select>
                </td>
                <td>{u.id !== eu?.id && <Button variante="ghost" onClick={() => excluir(u)}>Excluir</Button>}</td>
              </tr>))}
            </tbody>
          </table></div>
        </Card>
      </div>
    </>
  )
}