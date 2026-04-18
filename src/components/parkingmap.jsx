import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// CREAZIONE DEL MARKER PERSONALIZZATO (Sostituisce quello base)
const createCustomIcon = (colorClass) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${colorClass} transition-all transform hover:scale-110">
            <div class="w-2 h-2 bg-white rounded-full"></div>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export default function ParkingMap({ parkings, onMarkerClick }) {
  const bresciaCoords = [45.5415, 10.2245];

  return (
    <div className="rounded-3xl overflow-hidden shadow-inner border-4 border-white mb-10 h-[400px] z-0">
      <MapContainer center={bresciaCoords} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {parkings.map((p) => {
          // Logica colore marker dinamica
          const ratio = p.occupati / (p.postitot || 1);
          let markerColor = "bg-emerald-500";
          if (ratio >= 1) markerColor = "bg-red-500";
          else if (ratio >= 0.5) markerColor = "bg-blue-500";

          return (
            <Marker 
              key={p.idparcheggio} 
              position={[p.latitudine, p.longitudine]}
              icon={createCustomIcon(markerColor)}
              eventHandlers={{ click: () => onMarkerClick(p.idparcheggio) }}
            >
              <Popup>
                <div className="font-bold text-emerald-900">{p.nome}</div>
                <div className="text-xs">{p.occupati} / {p.postitot} posti occupati</div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}