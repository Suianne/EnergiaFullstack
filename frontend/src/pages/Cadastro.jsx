import { useState } from "react"
import { useApp } from "../hooks/useApp.jsx"
import Card from '../components/Card.jsx'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'
import { buscarCep, criarMunicipio, importarMunicipiosIBGE, popularDadosApis } from '../services/api.js'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const vazio = { ibge: '', cep: '', nome: '', uf: '' }

// Resumo legível do que veio da importação/atualização de um estado.
function resumoLote(r) {
  const partes = [r.mensagem]
  if (r.semDadosIBGE) partes.push(`${r.semDadosIBGE} sem população/PIB no IBGE (ficam fora do ranking).`)
  if (r.semGeracaoRenovavel) partes.push(`${r.semGeracaoRenovavel} sem geração renovável constatada pela ANEEL.`)
  if (r.aneel?.nomesNaoCasados?.length) partes.push(`Nomes da ANEEL sem correspondência no IBGE: ${r.aneel.nomesNaoCasados.join(', ')}.`)
  return partes.join(' ')
}

export default function Cadastro() {
  const { municipios, recarregar } = useApp()
  const [f, setF] = useState(vazio)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [msgManual, setMsgManual] = useState({ texto: '', aviso: false })

  // Estado inteiro (IBGE + ANEEL)
  const [ufImport, setUfImport] = useState('')
  const [ocupado, setOcupado] = useState('') // '', 'importar' ou 'atualizar'
  const [msgImport, setMsgImport] = useState({ texto: '', erro: false })

  const cep = async (valor) => {
    const numero = valor.replace(/\D/g, '')
    if (numero.length !== 8) return
    try {
      const dados = await buscarCep(numero)
      setF((atual) => ({ ...atual, ...dados }))
      setErros((atual) => ({ ...atual, cep: '' }))
    } catch (e) {
      setErros((atual) => ({ ...atual, cep: e.message }))
    }
  }

  const salvar = async (e) => {
    e.preventDefault()
    const er = {}
    if (!/^\d{7}$/.test(f.ibge)) er.ibge = 'Código IBGE com 7 dígitos'
    else if (municipios.some((m) => m.codigoIbge === f.ibge)) er.ibge = 'Município já cadastrado'
    setErros(er)
    setMsgManual({ texto: '', aviso: false })
    if (Object.keys(er).length) return

    setSalvando(true)
    try {
      // O servidor confirma nome/UF no IBGE e busca IBGE + ANEEL na mesma operação.
      const r = await criarMunicipio({ codigoIbge: f.ibge })
      setMsgManual(r.aviso
        ? { texto: r.aviso, aviso: true }
        : { texto: `${r.municipio.nome}/${r.municipio.uf} cadastrado com dados do IBGE e da ANEEL${r.semGeracaoRenovavel ? ' (sem geração renovável constatada)' : ''}.`, aviso: false })
      setF(vazio)
      recarregar()
    } catch (err) {
      setErros({ geral: err.message })
    } finally {
      setSalvando(false)
    }
  }

  const executar = (tipo, acao) => async () => {
    if (!UFS.includes(ufImport)) return setMsgImport({ texto: 'Selecione o estado.', erro: true })
    setOcupado(tipo)
    setMsgImport({ texto: '', erro: false })
    try {
      const r = await acao(ufImport)
      setMsgImport({ texto: resumoLote(r), erro: false })
      recarregar()
    } catch (err) {
      setMsgImport({ texto: `Erro: ${err.message}`, erro: true })
    } finally {
      setOcupado('')
    }
  }

  const comDados = municipios.filter((m) => m.dadosAtualizadosEm).length

  return (
    <>
      <header className="head">
        <div>
          <h1>Cadastro de municípios</h1>
          <p>Todo município entra já com os dados do IBGE e da ANEEL</p>
        </div>
      </header>

      <Card titulo="Importar estado (IBGE + ANEEL)">
        <div className="form" style={{ gap: '0.75rem' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Importa todos os municípios do estado e já busca população, PIB (IBGE) e geração renovável (ANEEL).
            Se alguma fonte estiver fora do ar, nada é gravado.
          </p>
          <div className="row" style={{ gap: '0.5rem', alignItems: 'end' }}>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor="uf-import">Estado</label>
              <select id="uf-import" value={ufImport} onChange={(e) => setUfImport(e.target.value)}>
                <option value="">UF</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Button onClick={executar('importar', importarMunicipiosIBGE)} disabled={!!ocupado}>
              {ocupado === 'importar' ? 'Importando…' : 'Importar estado'}
            </Button>
            <Button variante="secundario" onClick={executar('atualizar', popularDadosApis)} disabled={!!ocupado}>
              {ocupado === 'atualizar' ? 'Atualizando…' : 'Atualizar dados do estado'}
            </Button>
          </div>
          {msgImport.texto && <p className={msgImport.erro ? 'erro' : 'sucesso'}>{msgImport.texto}</p>}
        </div>
      </Card>

      <div style={{ marginTop: '1rem' }}>
        <Card titulo="Cadastro manual">
          <form className="form" onSubmit={salvar} noValidate>
            <Field
              rotulo="CEP (opcional, preenche o código IBGE)"
              value={f.cep}
              onChange={(e) => {
                const valor = e.target.value
                setF((atual) => ({ ...atual, cep: valor }))
                cep(valor)
              }}
              erro={erros.cep}
              placeholder="40020-000"
            />
            <Field
              rotulo="Código IBGE"
              value={f.ibge}
              onChange={(e) => setF({ ...f, ibge: e.target.value })}
              erro={erros.ibge}
              inputMode="numeric"
              maxLength={7}
            />
            {f.nome && <p className="nivel">CEP encontrado: {f.nome}/{f.uf}</p>}
            {erros.geral && <p className="erro">{erros.geral}</p>}
            {msgManual.texto && <p className={msgManual.aviso ? 'aviso' : 'sucesso'}>{msgManual.texto}</p>}
            <div style={{ alignSelf: 'end' }}>
              <Button type="submit" disabled={salvando}>{salvando ? 'Buscando dados…' : 'Salvar município'}</Button>
            </div>
          </form>
        </Card>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Card titulo={`${municipios.length} municípios cadastrados (${comDados} com dados IBGE/ANEEL)`}>
          <div className="tablewrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Município</th><th>UF</th><th>Código IBGE</th><th>Geração renovável (ANEEL)</th></tr></thead>
              <tbody>{municipios.map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td><td>{m.uf}</td><td>{m.codigoIbge}</td>
                  <td>{!m.dadosAtualizadosEm
                    ? <span style={{ color: 'var(--muted)' }}>Sem dados</span>
                    : m.semGeracaoRenovavel
                      ? <span className="tag sem-geracao">Sem geração constatada</span>
                      : <span className="tag com-geracao">{m.usinasRenovaveis} usina(s)</span>}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}
