import { useState } from "react"
import { useApp } from "../hooks/useApp.jsx"
import { useAuth } from "../hooks/useAuth.jsx"
import Card from '../components/Card.jsx'
import Field from '../components/Field.jsx'
import Button from '../components/Button.jsx'
import { buscarCep, criarMunicipio, importarMunicipiosIBGE, popularDadosApis } from '../services/api.js'

const vazio = { nome: '', uf: '', ibge: '', cep: '' }

export default function Cadastro() {
  const { municipios, recarregar } = useApp()
  const { usuario } = useAuth()
  const [f, setF] = useState(vazio)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)

  // Estado para importação IBGE + ANEEL
  const [ufImport, setUfImport] = useState('')
  const [importando, setImportando] = useState(false)
  const [populando, setPopulando] = useState(false)
  const [msgImport, setMsgImport] = useState('')

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

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
    if (f.nome.trim().length < 2) er.nome = 'Informe o nome'
    if (!/^\d{7}$/.test(f.ibge)) er.ibge = 'Código IBGE com 7 dígitos'
    if (!/^[A-Za-z]{2}$/.test(f.uf)) er.uf = 'UF com 2 letras'
    if (municipios.some((m) => m.codigoIbge === f.ibge)) er.ibge = 'Município já cadastrado'
    setErros(er)
    if (Object.keys(er).length) return

    setSalvando(true)
    try {
      await criarMunicipio({
        nome: f.nome.trim(),
        uf: f.uf.toUpperCase(),
        codigoIbge: f.ibge,
      })
      setF(vazio)
      recarregar()
    } catch (err) {
      setErros({ geral: err.message })
    } finally {
      setSalvando(false)
    }
  }

  const handleImportarIBGE = async () => {
    if (!/^[A-Za-z]{2}$/.test(ufImport)) return setMsgImport('Informe a UF com 2 letras.')
    setImportando(true)
    setMsgImport('')
    try {
      const r = await importarMunicipiosIBGE(ufImport.toUpperCase())
      setMsgImport(`${r.importados} importados, ${r.ignorados} já existiam (total IBGE: ${r.total}).`)
      recarregar()
    } catch (err) {
      setMsgImport(`Erro: ${err.message}`)
    } finally {
      setImportando(false)
    }
  }

  const handlePopularDados = async () => {
    if (!/^[A-Za-z]{2}$/.test(ufImport)) return setMsgImport('Informe a UF com 2 letras.')
    setPopulando(true)
    setMsgImport('')
    try {
      const r = await popularDadosApis(ufImport.toUpperCase(), 15)
      setMsgImport(r.mensagem)
      recarregar()
    } catch (err) {
      setMsgImport(`Erro: ${err.message}`)
    } finally {
      setPopulando(false)
    }
  }

  const isAdmin = usuario?.perfil === 'ADMINISTRADOR'

  return (
    <>
      <header className="head">
        <div>
          <h1>Cadastro de municípios</h1>
          <p>Busque por CEP ou informe o código IBGE</p>
        </div>
      </header>

      {isAdmin && (
        <Card titulo="Importação em lote (IBGE + ANEEL)">
          <div className="form" style={{ gap: '0.75rem' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              Importe municípios do IBGE e alimente os critérios TOPSIS com dados reais do IBGE (população, PIB) e da ANEEL (geração distribuída).
            </p>
            <div className="row" style={{ gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
              <Field
                rotulo="UF"
                value={ufImport}
                onChange={(e) => setUfImport(e.target.value)}
                maxLength={2}
                placeholder="BA"
                style={{ maxWidth: 100 }}
              />
              <Button onClick={handleImportarIBGE} disabled={importando || populando}>
                {importando ? 'Importando…' : '1. Importar municípios (IBGE)'}
              </Button>
              <Button variante="secundario" onClick={handlePopularDados} disabled={importando || populando}>
                {populando ? 'Buscando dados…' : '2. Popular critérios (IBGE + ANEEL)'}
              </Button>
            </div>
            {msgImport && <p style={{ color: 'var(--cta)', fontSize: '0.875rem' }}>{msgImport}</p>}
          </div>
        </Card>
      )}

      <Card titulo="Cadastro manual">
        <form className="form" onSubmit={salvar} noValidate>
          <Field
            rotulo="CEP"
            value={f.cep}
            onChange={(e) => {
              const valor = e.target.value
              setF((atual) => ({ ...atual, cep: valor }))
              cep(valor)
            }}
            erro={erros.cep}
            placeholder="40020-000"
          />
          <Field rotulo="Município" value={f.nome} onChange={set('nome')} erro={erros.nome} />
          <Field rotulo="UF" value={f.uf} onChange={set('uf')} erro={erros.uf} maxLength={2} />
          <Field rotulo="Código IBGE" value={f.ibge} onChange={set('ibge')} erro={erros.ibge} inputMode="numeric" />
          {erros.geral && <p style={{ color: 'var(--alta)', fontSize: '0.875rem' }}>{erros.geral}</p>}
          <div style={{ alignSelf: 'end' }}>
            <Button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar município'}</Button>
          </div>
        </form>
      </Card>

      <p style={{ margin: '1rem 0', color: 'var(--muted)' }}>{municipios.length} municípios cadastrados</p>
    </>
  )
}
