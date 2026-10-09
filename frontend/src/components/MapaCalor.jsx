import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { faixa } from '../utils/topsis.js'

const CENTRO_BRASIL = [-14.2, -51.9]

const coordenada = (i, chave, alternativa) => {
  const v = i[chave] ?? i[alternativa]
  const n = Number(v)
  return v != null && Number.isFinite(n) ? n : null
}

// Enquadra o mapa nos pontos (o MapContainer só usa "center" na montagem).
// Depende de uma chave textual dos pontos para não reenquadrar a cada render.
function AjustarVisao({ pontos }) {
  const map = useMap()
  const chave = pontos.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (!pontos.length) {
      map.setView(CENTRO_BRASIL, 4)
    } else if (pontos.length === 1) {
      map.setView(pontos[0], 9)
    } else {
      map.fitBounds(pontos, { padding: [24, 24], maxZoom: 10 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, chave])
  return null
}

// itens: [{ nome, lat|latitude, lng|longitude, valor }] com valor normalizado de 0 a 1
export default function MapaCalor({ itens, altura = 340 }) {
  const comCoordenada = itens
    .map((i) => ({ ...i, _lat: coordenada(i, 'lat', 'latitude'), _lng: coordenada(i, 'lng', 'longitude') }))
    .filter((i) => i._lat !== null && i._lng !== null)
  const pontos = comCoordenada.map((i) => [i._lat, i._lng])
  const semCoordenada = itens.length - comCoordenada.length

  return (
    <div className="map">
      <MapContainer center={CENTRO_BRASIL} zoom={4} style={{ height: altura }} scrollWheelZoom={false}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <AjustarVisao pontos={pontos} />
        {comCoordenada.map((i) => (
          <CircleMarker
            key={i.id ?? i.codigoIbge ?? i.nome}
            center={[i._lat, i._lng]}
            radius={6 + i.valor * 14}
            pathOptions={{ color: faixa(i.valor).cor, fillColor: faixa(i.valor).cor, fillOpacity: 0.6 }}
          >
            <Tooltip>{i.nome}{i.uf ? ` - ${i.uf}` : ''}: {i.valor.toFixed(2)}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {semCoordenada > 0 && (
        <p className="ajuda" style={{ marginTop: '0.5rem' }}>
          {semCoordenada} município(s) sem coordenadas não aparecem no mapa. Use "Atualizar dados" na tela de Municípios.
        </p>
      )}
    </div>
  )
}
