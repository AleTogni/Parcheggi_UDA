import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// MARKER PARCHEGGI (Ora accetta 'isHovered' per ingrandirsi dinamicamente)
const createCustomIcon = (colorClass, isHovered) => {
  // Se è "hoverato", aggiungiamo un'ombra più marcata, uno scale più grande e lo portiamo in primo piano
  const hoverStyle = isHovered 
    ? 'scale-125 ring-4 ring-white/50 shadow-2xl z-[1000]' 
    : 'hover:scale-110';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${colorClass} transition-all duration-300 transform ${hoverStyle}">
            <div class="w-2 h-2 bg-white rounded-full"></div>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// MARKER UTENTE (Pallino Blu)
const userIcon = L.divIcon({
  className: 'user-marker',
  html: `<div class="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// BOTTONE GPS
function LocationControl({ setUserLoc }) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleLocate = () => {
    setIsLocating(true);
    map.locate({ setView: true, maxZoom: 15 });
    
    map.once('locationfound', (e) => {
      setUserLoc(e.latlng);
      setIsLocating(false);
    });
    
    map.once('locationerror', (e) => {
      alert("Impossibile accedere alla posizione. Verifica i permessi del browser.");
      setIsLocating(false);
    });
  };

  return (
    <div className="absolute bottom-6 right-6 z-[400]">
      <button 
        onClick={handleLocate}
        disabled={isLocating}
        className="bg-white text-blue-600 w-12 h-12 rounded-full shadow-lg border border-gray-100 hover:bg-blue-50 transition-all flex items-center justify-center focus:outline-none disabled:opacity-50"
        title="Trovami"
      >
        <svg className={`w-6 h-6 ${isLocating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
}

// COMPONENTE PRINCIPALE (Aggiunti hoveredParkingId e setHoveredParkingId)
export default function ParkingMap({ parkings, onMarkerClick, userLoc, setUserLoc, hoveredParkingId, setHoveredParkingId }) {
  const bresciaCoords = [45.5415, 10.2245];

  const ztlCoords = [
    [45.5435, 10.2150], 
    [45.5445, 10.2260], 
    [45.5360, 10.2280], 
    [45.5350, 10.2180]  
  ];

  return (
    <div className="rounded-3xl overflow-hidden shadow-inner border-4 border-white mb-10 h-[400px] lg:h-[500px] z-0 relative">
      <MapContainer center={bresciaCoords} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* ZTL */}
        <Polygon positions={ztlCoords} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 2, dashArray: '5, 5' }}>
          <Tooltip sticky className="font-bold text-red-700">Zona a Traffico Limitato (ZTL)</Tooltip>
        </Polygon>

        {/* GPS */}
        <LocationControl setUserLoc={setUserLoc} />

        {/* MARKER UTENTE */}
        {userLoc && (
          <Marker position={userLoc} icon={userIcon}>
            <Tooltip permanent direction="top" className="font-bold text-blue-900">Tu sei qui</Tooltip>
          </Marker>
        )}

        {/* MARKER PARCHEGGI */}
        {parkings.map((p) => {
          const ratio = p.occupati / (p.postitot || 1);
          let markerColor = "bg-emerald-500";
          if (ratio >= 1) markerColor = "bg-red-500";
          else if (ratio >= 0.5) markerColor = "bg-blue-500";

          const isHovered = hoveredParkingId === p.idparcheggio;

          return (
            <Marker 
              key={p.idparcheggio} 
              position={[p.latitudine, p.longitudine]}
              icon={createCustomIcon(markerColor, isHovered)}
              eventHandlers={{ 
                click: () => onMarkerClick(p.idparcheggio),
                // Nuovi eventi per il sync con la lista
                mouseover: () => setHoveredParkingId(p.idparcheggio),
                mouseout: () => setHoveredParkingId(null)
              }}
              // Alza lo z-index nativo del marker se è in hover
              zIndexOffset={isHovered ? 1000 : 0}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}