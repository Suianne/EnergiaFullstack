import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../hooks/useApp.jsx'
import Card from '../components/Card.jsx'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'
import {
  buscarCep,
  criarMunicipio,
  listarMunicipiosIBGE,
  resumoAneel,
  importarMunicipiosIBGE,
  atualizarDadosUF,
  atualizarDadosMunicipio,
  removerMunicipio,
  resetarDados,
} from '../services/api.js'
import { UFS } from '../utils/perfis.js'
import { normalizarNome, fmtNum } from '../utils/topsis.js'

// Municípios por chamada na importação em lote (pequeno para caber no tempo limite do Vercel)
const LOTE = 8
const MAX_ETAPAS = 150

function BadgeGeracao({ m }) {
  if (!m.aneelConsultada) return <span className="badge neutro">ANEEL não consultada</span>
  return m.geracaoRenovavel
    ? <span className="badge ok">Com geração renovável</span>
    : <span className="badge alerta">Sem geração renovável</span>
}

export default function Cadastro() {
  const { municipios, criterios, recarregar } = useApp()

  // ── Cadastro individual ──────────────────────────────────────────
  const [uf, setUf] = useState('')
  const [lista, setLista] = useState([])
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [aneel, setAneel] = useState(null)
  const [carregandoAneel, setCarregandoAneel] = useState(false)
  const [erroFontes, setErroFontes] = useState('')
  const [codigo, setCodigo] = useState('')
  const [busca, setBusca] = useState('')
  const [cep, setCep] = useState('')
  const [erroCep, setErroCep] = useState('')
  const codigoPendente = useRef('') // CEP escolheu um município antes de a lista da UF chegar
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erroCadastro, setErroCadastro] = useState('')

  const mudarUf = (nova) => {
    setUf(nova)
    setCodigo('')
    setBusca('')
    setErroFontes('')
    setCarregandoLista(!!nova)
    setCarregandoAneel(!!nova)
    if (!nova) {
      setLista([])
      setAneel(null)
    }
  }

  // Ao escolher a UF: carrega a lista do IBGE e o resumo da ANEEL para aquele estado
  useEffect(() => {
    if (!uf) return undefined
    let ativo = true

    listarMunicipiosIBGE(uf)
      .then((l) => {
        if (!ativo) return
        setLista(l)
        if (codigoPendente.current && l.some((m) => m.codigoIbge === codigoPendente.current)) {
          setCodigo(codigoPendente.current)
          codigoPendente.current = ''
        }
      })
      .catch((e) => ativo && setErroFontes((atual) => `${atual} IBGE: ${e.message}`.trim()))
      .finally(() => ativo && setCarregandoLista(false))

    resumoAneel(uf)
      .then((r) => ativo && setAneel(r))
      .catch((e) => {
        if (!ativo) return
        setAneel(null)
        setErroFontes((atual) => `${atual} ANEEL: ${e.message}`.trim())
      })
      .finally(() => ativo && setCarregandoAneel(false))

    return () => {
      ativo = false
    }
  }, [uf])

  const aneelPorNome = useMemo(() => {
    const mapa = new Map()
    for (const m of aneel?.municipios || []) mapa.set(normalizarNome(m.nome), m)
    return mapa
  }, [aneel])

  const cadastrados = useMemo(() => new Set(municipios.map((m) => m.codigoIbge)), [municipios])

  const listaFiltrada = useMemo(() => {
    const termo = normalizarNome(busca)
    return termo ? lista.filter((m) => normalizarNome(m.nome).includes(termo)) : lista
  }, [lista, busca])

  const selecionado = lista.find((m) => m.codigoIbge === codigo) || null
  const previaAneel = selecionado ? aneelPorNome.get(normalizarNome(selecionado.nome)) || null : null
  const jaCadastrado = selecionado ? cadastrados.has(selecionado.codigoIbge) : false

  const consultarCep = async (valor) => {
    setCep(valor)
    setErroCep('')
    const numero = valor.replace(/\D/g, '')
    if (numero.length !== 8) return
    try {
      const d = await buscarCep(numero)
      if (d.uf !== uf) {
        codigoPendente.current = d.codigoIbge
        mudarUf(d.uf)
      } else {
        setCodigo(d.codigoIbge)
      }
    } catch (e) {
      setErroCep(e.message)
    }
  }

  const salvar = async (e) => {
    e.preventDefault()
    if (!selecionado || jaCadastrado) return
    setSalvando(true)
    setErroCadastro('')
    setResultado(null)
    try {
      const r = await criarMunicipio({ codigoIbge: selecionado.codigoIbge })
      setResultado(r)
      setCodigo('')
      setBusca('')
      recarregar()
    } catch (err) {
      setErroCadastro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  // ── Importação em lote ───────────────────────────────────────────
  const [ufLote, setUfLote] = useState('')
  const [progresso, setProgresso] = useState('')
  const [rodandoLote, setRodandoLote] = useState(false)

  const rodarEmEtapas = async (nome, chamada) => {
    if (!ufLote) return setProgresso('Escolha a UF.')
    setRodandoLote(true)
    setProgresso(`${nome}: iniciando…`)
    try {
      let total = 0
      const avisos = new Set()
      for (let etapa = 1; etapa <= MAX_ETAPAS; etapa++) {
        const r = await chamada(ufLote, LOTE)
        total += r.importados ?? r.atualizados ?? 0
        ;(r.avisos || []).forEach((a) => avisos.add(a))
        setProgresso(`${nome}: ${total} processado(s)${r.restantes ? `, restam ${r.restantes}` : ''}…`)
        const processadosNaEtapa = r.importados ?? r.atualizados ?? 0
        if (r.completo || processadosNaEtapa === 0) {
          const erros = r.erros?.length ? ` ${r.erros.length} com erro (ex.: ${r.erros[0].municipio}: ${r.erros[0].erro}).` : ''
          const pendentes = !r.completo && r.restantes ? ` ${r.restantes} ainda pendente(s): as fontes não responderam; tente mais tarde.` : ''
          setProgresso(`${nome} concluída: ${total} processado(s).${erros}${pendentes}${avisos.size ? ` Aviso: ${[...avisos][0]}` : ''}`)
          break
        }
      }
      recarregar()
    } catch (err) {
      setProgresso(`Erro: ${err.message}`)
    } finally {
      setRodandoLote(false)
    }
  }

  // ── Tabela de cadastrados ────────────────────────────────────────
  const [filtroUf, setFiltroUf] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [confirmando, setConfirmando] = useState(null)
  const [msgTabela, setMsgTabela] = useState('')

  const porChave = useMemo(() => Object.fromEntries(criterios.map((c) => [c.chave, c])), [criterios])
  const valor = (m, chave, casas = 0) => {
    const c = porChave[chave]
    return c ? fmtNum(m.valores?.[c.id], casas) : '-'
  }
  const completo = (m) => criterios.filter((c) => c.peso > 0).every((c) => m.valores?.[c.id] != null)

  const listaCadastrados = useMemo(
    () => (filtroUf ? municipios.filter((m) => m.uf === filtroUf) : municipios),
    [municipios, filtroUf],
  )

  const atualizarUm = async (m) => {
    setOcupado(m.id)
    setMsgTabela('')
    try {
      const r = await atualizarDadosMunicipio(m.id)
      setMsgTabela(`${m.nome}: dados atualizados.${r.avisos?.length ? ` Aviso: ${r.avisos[0]}` : ''}`)
      recarregar()
    } catch (err) {
      setMsgTabela(`Erro ao atualizar ${m.nome}: ${err.message}`)
    } finally {
      setOcupado(null)
    }
  }

  const removerUm = async (m) => {
    setOcupado(m.id)
    setMsgTabela('')
    try {
      await removerMunicipio(m.id)
      setMsgTabela(`${m.nome} removido.`)
      setConfirmando(null)
      recarregar()
    } catch (err) {
      setMsgTabela(`Erro ao remover ${m.nome}: ${err.message}`)
    } finally {
      setOcupado(null)
    }
  }

  // ── Reset ────────────────────────────────────────────────────────
  const [confirmacaoReset, setConfirmacaoReset] = useState('')
  const [resetando, setResetando] = useState(false)
  const [msgReset, setMsgReset] = useState('')

  const resetar = async () => {
    setResetando(true)
    setMsgReset('')
    try {
      const r = await resetarDados(confirmacaoReset.trim().toUpperCase())
      setMsgReset(r.mensagem)
      setConfirmacaoReset('')
      recarregar()
    } catch (err) {
      setMsgReset(`Erro: ${err.message}`)
    } finally {
      setResetando(false)
    }
  }

  const selectUf = (valorAtual, aoMudar, id) => (
    <select id={id} value={valorAtual} onChange={(e) => aoMudar(e.target.value)}>
      <option value="">Selecione a UF</option>
      {UFS.map((u) => <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>)}
    </select>
  )

  return (
    <>
      <header className="head">
        <div>
          <h1>Municípios</h1>
          <p>Ao adicionar um município, os dados do IBGE (população, PIB, coordenadas) e da ANEEL (geração renovável) são buscados na hora</p>
        </div>
      </header>

      <div className="grid two">
        <Card titulo="Adicionar município">
          <form className="form" onSubmit={salvar} noValidate>
            <div className="field">
              <label htmlFor="uf">Estado (UF)</label>
              {selectUf(uf, mudarUf, 'uf')}
            </div>
            <Field rotulo="Ou localize pelo CEP" value={cep} onChange={(e) => consultarCep(e.target.value)} erro={erroCep} placeholder="40020-000" inputMode="numeric" />

            {uf && (
              <>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="busca">Município</label>
                  <input id="busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar pelo nome…" disabled={carregandoLista} />
                  <select
                    aria-label="Município"
                    size={8}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    disabled={carregandoLista}
                    style={{ marginTop: '0.35rem' }}
                  >
                    {carregandoLista && <option value="">Carregando municípios do IBGE…</option>}
                    {!carregandoLista && listaFiltrada.map((m) => (
                      <option key={m.codigoIbge} value={m.codigoIbge}>
                        {m.nome}{cadastrados.has(m.codigoIbge) ? ' ✓ cadastrado' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="ajuda">
                    {carregandoAneel
                      ? 'Consultando usinas renováveis da ANEEL…'
                      : aneel
                        ? `ANEEL/SIGA: ${aneel.usinasRenovaveis} usina(s) renovável(is) em operação em ${aneel.municipiosComGeracao} município(s) de ${uf}.`
                        : 'ANEEL indisponível: o município será cadastrado sem os dados de geração (atualize depois).'}
                  </span>
                </div>

                {selecionado && (
                  <div className="previa" style={{ gridColumn: '1 / -1' }}>
                    <strong>{selecionado.nome} - {selecionado.uf}</strong> <span className="ajuda">(IBGE {selecionado.codigoIbge})</span>
                    <div style={{ marginTop: '0.35rem' }}>
                      {jaCadastrado ? (
                        <span className="badge neutro">Já cadastrado</span>
                      ) : !aneel ? (
                        <span className="badge neutro">Geração renovável: não consultada</span>
                      ) : previaAneel ? (
                        <span className="badge ok">
                          {previaAneel.usinas} usina(s) renovável(is) · {fmtNum(previaAneel.potenciaKw)} kW
                          {previaAneel.fontes && ` · solar ${previaAneel.fontes.solar}, eólica ${previaAneel.fontes.eolica}, hídrica ${previaAneel.fontes.hidrica}, biomassa ${previaAneel.fontes.biomassa}`}
                        </span>
                      ) : (
                        <span className="badge alerta">Sem geração renovável constatada pela ANEEL</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {erroFontes && <p className="erro" style={{ gridColumn: '1 / -1' }}>{erroFontes}</p>}
            {erroCadastro && <p className="erro" style={{ gridColumn: '1 / -1' }}>{erroCadastro}</p>}

            <div style={{ alignSelf: 'end' }}>
              <Button type="submit" disabled={!selecionado || jaCadastrado || salvando}>
                {salvando ? 'Buscando dados e salvando…' : 'Adicionar com dados IBGE + ANEEL'}
              </Button>
            </div>
          </form>

          {resultado && (
            <div className="alerta ok" style={{ marginTop: '1rem' }}>
              <strong>{resultado.municipio.nome} - {resultado.municipio.uf}</strong> cadastrado.
              <ul className="lista-simples">
                <li>População: {fmtNum(resultado.coleta.populacao)} hab</li>
                <li>PIB per capita: R$ {fmtNum(resultado.coleta.pibPerCapita, 2)}</li>
                <li>
                  Geração renovável (ANEEL):{' '}
                  {resultado.coleta.aneel
                    ? `${resultado.coleta.aneel.usinas} usina(s), ${fmtNum(resultado.coleta.aneel.potenciaKw)} kW`
                    : 'não consultada'}
                </li>
                <li>Coordenadas: {resultado.coleta.coordenadas ? `${resultado.coleta.coordenadas.latitude}, ${resultado.coleta.coordenadas.longitude}` : 'não obtidas'}</li>
              </ul>
              {resultado.avisos?.length > 0 && <p className="ajuda">Avisos: {resultado.avisos.join(' ')}</p>}
            </div>
          )}
        </Card>

        <Card titulo="Importação em lote por UF (IBGE + ANEEL)">
          <div className="form" style={{ gap: '0.75rem' }}>
            <p className="ajuda" style={{ gridColumn: '1 / -1' }}>
              Importa todos os municípios do estado com população, PIB, coordenadas e geração renovável.
              O processamento é feito em etapas de {LOTE} municípios; aguarde a conclusão.
            </p>
            <div className="field">
              <label htmlFor="uf-lote">Estado (UF)</label>
              {selectUf(ufLote, setUfLote, 'uf-lote')}
            </div>
            <div className="row" style={{ alignSelf: 'end' }}>
              <Button onClick={() => rodarEmEtapas('Importação', importarMunicipiosIBGE)} disabled={rodandoLote || !ufLote}>
                {rodandoLote ? 'Processando…' : 'Importar municípios da UF'}
              </Button>
              <Button variante="secundario" onClick={() => rodarEmEtapas('Atualização', atualizarDadosUF)} disabled={rodandoLote || !ufLote}>
                Atualizar dados pendentes
              </Button>
            </div>
            {progresso && <p className="ajuda" style={{ gridColumn: '1 / -1' }} role="status">{progresso}</p>}
          </div>
        </Card>
      </div>

      <Card className="mt" titulo={`Municípios cadastrados (${listaCadastrados.length}${filtroUf ? ` de ${municipios.length}` : ''})`}>
        <div className="row" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="filtro-uf" className="ajuda">Filtrar por UF</label>
          <select id="filtro-uf" value={filtroUf} onChange={(e) => setFiltroUf(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Todas</option>
            {[...new Set(municipios.map((m) => m.uf))].sort().map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {msgTabela && <span className="ajuda" role="status">{msgTabela}</span>}
        </div>
        <div className="tablewrap">
          <table className="compacta">
            <thead>
              <tr>
                <th>Município</th><th>UF</th><th>População</th><th>PIB per capita (R$)</th>
                <th>Potência renov. (kW)</th><th>Usinas</th><th>Geração renovável</th><th>Dados</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {listaCadastrados.map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td>
                  <td>{m.uf}</td>
                  <td>{valor(m, 'populacao')}</td>
                  <td>{valor(m, 'pib_per_capita', 2)}</td>
                  <td>{valor(m, 'potencia_renovavel')}</td>
                  <td>{valor(m, 'usinas_renovaveis')}</td>
                  <td><BadgeGeracao m={m} /></td>
                  <td>{completo(m) ? <span className="badge ok">Completo</span> : <span className="badge alerta">Incompleto</span>}</td>
                  <td>
                    {confirmando === m.id ? (
                      <span className="row">
                        <Button variante="perigo" onClick={() => removerUm(m)} disabled={ocupado === m.id}>Confirmar</Button>
                        <Button variante="ghost" onClick={() => setConfirmando(null)}>Cancelar</Button>
                      </span>
                    ) : (
                      <span className="row">
                        <Button variante="ghost" onClick={() => atualizarUm(m)} disabled={ocupado === m.id}>
                          {ocupado === m.id ? '…' : 'Atualizar dados'}
                        </Button>
                        <Button variante="ghost" onClick={() => setConfirmando(m.id)} disabled={ocupado === m.id}>Remover</Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {listaCadastrados.length === 0 && (
                <tr><td colSpan={9} className="ajuda">Nenhum município cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt perigo-zona" titulo="Reset dos dados">
        <p className="ajuda">
          Apaga todos os municípios, valores da matriz de decisão, critérios e simulações. Os usuários são mantidos.
          Os critérios padrão são recriados. Digite <strong>RESETAR</strong> para confirmar.
        </p>
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <input aria-label="Confirmação" value={confirmacaoReset} onChange={(e) => setConfirmacaoReset(e.target.value)} placeholder="RESETAR" style={{ maxWidth: 180 }} />
          <Button variante="perigo" onClick={resetar} disabled={resetando || confirmacaoReset.trim().toUpperCase() !== 'RESETAR'}>
            {resetando ? 'Apagando…' : 'Apagar todos os dados'}
          </Button>
        </div>
        {msgReset && <p className="ajuda" style={{ marginTop: '0.5rem' }} role="status">{msgReset}</p>}
      </Card>
    </>
  )
}
