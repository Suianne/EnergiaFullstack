export default function Card({titulo, children, className = ''}) {
    return <section className={`card ${className}`}>{titulo && <h2>{titulo}</h2>}{children}</section>
}