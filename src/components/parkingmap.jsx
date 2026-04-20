import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// ICONA SPECIALE PER L'UTENTE (Pallino blu pulsante)
const userIcon = L.divIcon({
  className: 'user-marker',
  html: `<div class="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// COMPONENTE INTERNO: Controlla la posizione GPS
function LocationControl({ setUserLoc }) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleLocate = () => {
    setIsLocating(true);
    // Chiede al browser la posizione e zooma automaticamente
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
        className="bg-white text-blue-600 w-12 h-12 rounded-full shadow-lg border border-gray-100 hover:bg-blue-50 transition-all flex items-center justify-center group focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
        title="Trovami"
      >
        <svg className={`w-6 h-6 ${isLocating ? 'animate-spin' : 'group-hover:scale-110 transition-transform'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
}

export default function ParkingMap({ parkings, onMarkerClick }) {
  const bresciaCoords = [45.5415, 10.2245];
  const [userLoc, setUserLoc] = useState(null);

  return (
    <div className="rounded-3xl overflow-hidden shadow-inner border-4 border-white mb-10 h-[400px] z-0 relative">
      <MapContainer center={bresciaCoords} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* INIETTA IL PULSANTE GPS NELLA MAPPA */}
        <LocationControl setUserLoc={setUserLoc} />

        {/* DISEGNA L'UTENTE SE LA POSIZIONE È STATA TROVATA */}
        {userLoc && (
          <Marker position={userLoc} icon={userIcon}>
            <Popup><div className="font-bold text-blue-900">Tu sei qui</div></Popup>
          </Marker>
        )}

        {/* DISEGNA I PARCHEGGI */}
        {parkings.map((p) => {
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