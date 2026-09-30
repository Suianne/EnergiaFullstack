export default function Button ({variante = 'primario', children, ...rest}) {
    return <button className={`btn ${variante}`} {...rest}>{children}</button>
}