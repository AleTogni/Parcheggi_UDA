import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function ParkingMap({ parkings }) {
  const bresciaCenter = [45.539, 10.220];

  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-lg border-4 border-white mb-8 z-0">
      <MapContainer center={bresciaCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {parkings?.map((p) => (
          <Marker key={p.idParcheggio} position={[p.latitudine || 45.539, p.longitudine || 10.220]}>
            <Popup>
              <div className="p-1">
                <h3 className="font-bold">{p.nome}</h3>
                <p className="text-sm">Posti totali: {p.postiTot}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}