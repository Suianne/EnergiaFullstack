import {MapContainer, TileLayer, CircleMarker, Tooltip} from 'react-leaflet'
import { faixa } from '../utils/topsis.js'

// itens: [{nome, lat, lng, valor }] com valor normalizado de 0 a 1
export default function MapaCalor({ itens, altura = 340}) {
    return (
        <div className="map">
            <MapContainer center={[-12.5, -40]} zoom={6} style={{height: altura}} scrollWheelZoom={false}>
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {itens.map((i) => (
                    <CircleMarker key={i.nome} center={[i.lat, i.lng]} radius={8 + i.valor * 14}
                        pathOptions={{ color: faixa(i.valor).cor, fillColor: faixa(i.valor).cor, fillOpacity: 0.6 }}>
                        <Tooltip>{i.nome}: {i.valor.toFixed(2)}</Tooltip>

                    </CircleMarker>
                ))}
            </MapContainer>
        </div>
    )
}