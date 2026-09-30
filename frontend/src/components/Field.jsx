import {useId} from 'react'
export default function Field({rotulo, erro, ...input}){
    const id = useId()
    return (
        <div className="field">
            <label htmlFor={id}>{rotulo}</label>
            <input id={id} aria-invalid={!!erro} {...input}/>
            {erro && <span className="erro" role="alert">{erro}</span>}
        </div>
    )
}