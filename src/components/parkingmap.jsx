import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icone Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

function MapController({ center }) {
  const map = useMap();
  if (center) map.flyTo(center, 15);
  return null;
}

export default function ParkingMap({ parkings, onMarkerClick, selectedLocation }) {
  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-inner mb-8 z-0">
      <MapContainer center={[45.539, 10.220]} zoom={14} className="h-full w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapController center={selectedLocation} />
        {parkings.map((p) => (
          <Marker 
            key={p.idparcheggio} 
            position={[p.latitudine || 45.539, p.longitudine || 10.220]}
            eventHandlers={{ click: () => onMarkerClick(p.idparcheggio) }}
          >
            <Popup><b className="text-emerald-700">{p.nome}</b><br/>{p.occupati}/{p.postitot} posti</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}