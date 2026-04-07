import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Header from '../components/Header';

// Fix Leaflet's default marker icons broken by Vite's bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

import 'leaflet/dist/leaflet.css';

// ─── Fake data helpers ────────────────────────────────────────────────────────

const OWNERS = [
  { name: 'Maria Meier',  address: 'Luzernerstrasse 17, 6284 Gelfingen' },
  { name: 'Hans Müller',  address: 'Dorfstrasse 4, 6010 Kriens' },
  { name: 'Anna Keller',  address: 'Seepromenade 12, 6354 Vitznau' },
  { name: 'Peter Bauer',  address: 'Hauptgasse 33, 6430 Schwyz' },
  { name: 'Sandra Wolf',  address: 'Bahnhofstrasse 8, 6003 Luzern' },
];

interface ParcelInfo {
  lat: number;
  lng: number;
  parcelId: number;
  owner: string;
  ownerAddress: string;
  area: number;
}

function generateParcel(lat: number, lng: number): ParcelInfo {
  return {
    lat,
    lng,
    parcelId: Math.floor(10000 + Math.random() * 90000),
    ...(() => { const o = OWNERS[Math.floor(Math.random() * OWNERS.length)]; return { owner: o.name, ownerAddress: o.address }; })(),
    area: Math.floor(200 + Math.random() * 4800),
  };
}

// ─── ClickHandler (must live inside MapContainer) ─────────────────────────────

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── MapPage ──────────────────────────────────────────────────────────────────

const MAP_CENTER: [number, number] = [47.0502, 8.3093];

export default function MapPage() {
  const [parcel, setParcel] = useState<ParcelInfo | null>(null);

  function handleMapClick(lat: number, lng: number) {
    setParcel(generateParcel(lat, lng));
  }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <MapContainer
        center={MAP_CENTER}
        zoom={14}
        style={{ width: '100%', flex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler onMapClick={handleMapClick} />

        {parcel && (
          <Marker position={[parcel.lat, parcel.lng]} />
        )}
      </MapContainer>

      {/* Floating info box */}
      {parcel && (
        <div style={{
          position:     'fixed',
          bottom:       24,
          left:         24,
          zIndex:       1000,
          background:   '#fff',
          borderRadius: 10,
          boxShadow:    '0 4px 20px rgba(0,0,0,0.15)',
          padding:      '18px 22px',
          minWidth:     240,
          fontFamily:   'system-ui, sans-serif',
          fontSize:     14,
          lineHeight:   1.8,
          color:        '#1a1a1a',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ fontSize: 15 }}>Parzelle #{parcel.parcelId}</strong>
            <button
              onClick={() => setParcel(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', lineHeight: 1 }}
              aria-label="Schliessen"
            >×</button>
          </div>

          <div style={{ color: '#555', fontSize: 12, marginBottom: 10 }}>
            {parcel.lat.toFixed(5)}, {parcel.lng.toFixed(5)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 16px' }}>
            <span style={{ color: '#888' }}>Eigentümer</span>
            <span style={{ fontWeight: 600 }}>{parcel.owner}</span>
            <span style={{ color: '#888' }}></span>
            <span style={{ color: '#555', fontSize: 13 }}>{parcel.ownerAddress}</span>
            <span style={{ color: '#888' }}>Fläche</span>
            <span style={{ fontWeight: 600 }}>{parcel.area.toLocaleString()} m²</span>
          </div>
        </div>
      )}
    </div>
  );
}
