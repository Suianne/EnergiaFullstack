import { useState } from "react"
import { useApp } from "../hooks/useApp.jsx"
import Card from '../components/Card.jsx'
import Field from '../components/Field.jsx'
import Buttom from '../components/Button.jsx'
import { buscarCep } from '../services/api.js'

const vazio = {nome: '', uf: '', ibge: '', cep: '' }

export default function Cadastro(){
    const { municipios, setMunicipios, criterios } = useApp()
    const [f, setF] = useState(vazio)
    const [erros, setErros] = useState({})
    const set = (k) => (e) => setF({...f, [k]: e.target.value })
    const cep = async () => {
        if (!f.cep) return
        try { setF({ ...f, ...(await buscarCep(f.cep)) }); setErros({ ...erros, cep: '' }) }
        catch (e) {setErros({...erros, cep: e.message}) }
    }
    
    const salvar = (e) => {
        e.preventDefault()
        const er = {}
        if (f.nome.trim().length < 2) er.nome = 'Informe o nome'
        if (!/^\d{7}$/.test(f.ibge)) er.ibge = 'Código IBGE com 7 dígitos'
        if (!/^[A-Za-z]{2}$/.test(f.uf)) er.uf = 'UF com 2 letras'
        if (municipios.some((m) => m.ibge === f.ibge)) er.ibge = 'Município já cadastrado'
        setErros(er)
        if (Object.keys(er).length) return
        const valores = Object.fromEntries(criterios.map((c) => [c.id, 1]))
        setMunicipios([...municipios, { ...f, uf: f.uf.toUpperCase(), lat: -12.5, lng: -40, valores }])
        setF(vazio)
    }

    return (
        <>
            <header className="head"><div><h1>Cadastro de municípios</h1><p>Busque por CEP ou informe o código IBGE</p></div></header>
              <Card>
                <form className="form" onSubmit={salvar} noValidate>
                  <Field rotulo="CEP" value={f.cep} onChange={set('cep')} onBlur={cep} erro={erros.cep} placeholder="40020-000" />
                  <Field rotulo="Município" value={f.nome} onChange={set('nome')} erro={erros.nome} />
                  <Field rotulo="UF" value={f.uf} onChange={set('uf')} erro={erros.uf} maxLength={2} />
                  <Field rotulo="Código IBGE" value={f.ibge} onChange={set('ibge')} erro={erros.ibge} inputMode="numeric" />
                  <div style={{ alignSelf: 'end' }}><Button type="submit">Salvar município</Button></div>
                </form>
              </Card>
              <p style={{ margin: '1rem 0', color: 'var(--muted)' }}>{municipios.length} municípios cadastrados</p>
        </>
    )
}