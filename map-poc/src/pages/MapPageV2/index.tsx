import { useState, useEffect } from 'react';
import { TbLoaderQuarter } from 'react-icons/tb';
import { MapContainer, TileLayer, WMSTileLayer } from 'react-leaflet';
import L from 'leaflet';



// ─── Fix Leaflet's default marker icons broken by Vite's bundler ──────────────
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
import './MapPageV2.css';


// ─── WMS Configuration ───────────────────────────────────────────────────────
// Raster tile overlay: shows cadastral boundaries Switzerland-wide.
// Purely visual — click interaction is handled by the WFS vector layer below.
// WMS Capabilities: https://geodienste.ch/db/avc_0/deu?SERVICE=WMS&REQUEST=GetCapabilities
const WMS_URL         = 'https://wfs.geodienste.ch/avc_0/deu';
const WMS_LAYERS      = 'Liegenschaften';
const WMS_ATTRIBUTION = '&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Amtliche Vermessung';

const LUFTBILD_WMS_URL = 'https://wfs.geodienste.ch/luftbild/deu';
const LUFTBILD_LAYERS = 'luftbild_ag,luftbild_lu,luftbild_zg,luftbild_zh';
const LUFTBILD_ATTRIBUTION = '&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Luftbild AG/ZG/ZH/LU';

const WALDGRENZEN_WMS_URL = 'https://wfs.geodienste.ch/npl_waldgrenzen_v1_2_0/deu';
const WALDGRENZEN_LAYERS = 'daten';
const WALDGRENZEN_ATTRIBUTION = '&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Statische Waldgrenzen';

const NUTZUNGSPLANUNG_WMS_URL = 'https://geodienste.ch/db/npl_nutzungsplanung_v1_2_0/deu';
const NUTZUNGSPLANUNG_LAYERS = 'daten';
const NUTZUNGSPLANUNG_ATTRIBUTION = '&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Nutzungsplanung';

const GEFAHRENKARTE_WMS_URL = 'https://geodienste.ch/db/gefahrenkarten_v1_3_0/deu';
const GEFAHRENKARTE_LAYERS = 'daten';
const GEFAHRENKARTE_ATTRIBUTION = '&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Gefahrenkarten';


import Header from '../../components/Header';
import type { ObjectInfo } from './mockData';
import { infoFromParcel } from './mockData';
import SearchPanel from './ObjectInfoPanel';
import DummyChatbotWidget from './ChatbotWidget';
import MapLayerSelectorControl, { CustomZoomControl } from './MapLayerSelectorControl';
import ParcelLayer from './ParcelLayer';


// ─── Fixed-position overlays ──────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div className="loading-overlay">
      <TbLoaderQuarter size={18} className="loading-spinner" />
      Lade Parzellen…
    </div>
  );
}

function ErrorBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="error-box">
      <div className="error-box__header">
        <strong>Error</strong>
        <button onClick={onClose} className="error-box__close" aria-label="Close">×</button>
      </div>
      <div className="error-box__message">{message}</div>
    </div>
  );
}


// ─── App ─────────────────────────────────────────────────────────────────────

// Map center: Aarau, Switzerland (zoom 14).
const MAP_CENTER: [number, number] = [47.3925, 8.0442];

export default function MapPageV2() {
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [objectInfo,  setObjectInfo]  = useState<ObjectInfo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(14);
  const [isLayerSelectorOpen, setIsLayerSelectorOpen] = useState(false);
  const [showAmtlicheVermessung, setShowAmtlicheVermessung] = useState(true);
  const [showLuftbild, setShowLuftbild] = useState(false);
  const [showWaldgrenzen, setShowWaldgrenzen] = useState(false);
  const [showNutzungsplanung, setShowNutzungsplanung] = useState(false);
  const [showGefahrenkarte, setShowGefahrenkarte] = useState(false);
  const [amtlicheVermessungOpacity, setAmtlicheVermessungOpacity] = useState(0.7);
  const [luftbildOpacity, setLuftbildOpacity] = useState(1);
  const [waldgrenzenOpacity, setWaldgrenzenOpacity] = useState(0.9);
  const [nutzungsplanungOpacity, setNutzungsplanungOpacity] = useState(0.8);
  const [gefahrenkarteOpacity, setGefahrenkarteOpacity] = useState(0.8);

  useEffect(() => {
    if (objectInfo) {
      setIsLayerSelectorOpen(false);
    }
  }, [objectInfo]);

  return (
    <div className="mapv2-page">

      <Header onAccountMenuOpen={() => setIsLayerSelectorOpen(false)} />

      <MapContainer center={MAP_CENTER} zoom={14} zoomControl={false} className="mapv2-container">

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showAmtlicheVermessung && (
          <WMSTileLayer
            url={WMS_URL}
            layers={WMS_LAYERS}
            format="image/png"
            transparent={true}
            version="1.3.0"
            opacity={amtlicheVermessungOpacity}
            attribution={WMS_ATTRIBUTION}
          />
        )}

        {showLuftbild && (
          <WMSTileLayer
            url={LUFTBILD_WMS_URL}
            layers={LUFTBILD_LAYERS}
            format="image/jpeg"
            transparent={false}
            version="1.3.0"
            opacity={luftbildOpacity}
            attribution={LUFTBILD_ATTRIBUTION}
          />
        )}

        {showWaldgrenzen && (
          <WMSTileLayer
            url={WALDGRENZEN_WMS_URL}
            layers={WALDGRENZEN_LAYERS}
            format="image/png"
            transparent={true}
            version="1.3.0"
            opacity={waldgrenzenOpacity}
            attribution={WALDGRENZEN_ATTRIBUTION}
          />
        )}

        {showNutzungsplanung && (
          <WMSTileLayer
            url={NUTZUNGSPLANUNG_WMS_URL}
            layers={NUTZUNGSPLANUNG_LAYERS}
            format="image/png"
            transparent={true}
            version="1.3.0"
            opacity={nutzungsplanungOpacity}
            attribution={NUTZUNGSPLANUNG_ATTRIBUTION}
          />
        )}

        {showGefahrenkarte && (
          <WMSTileLayer
            url={GEFAHRENKARTE_WMS_URL}
            layers={GEFAHRENKARTE_LAYERS}
            format="image/png"
            transparent={true}
            version="1.3.0"
            opacity={gefahrenkarteOpacity}
            attribution={GEFAHRENKARTE_ATTRIBUTION}
          />
        )}

        <CustomZoomControl />

        <MapLayerSelectorControl
          showAmtlicheVermessung={showAmtlicheVermessung}
          onToggleAmtlicheVermessung={setShowAmtlicheVermessung}
          amtlicheVermessungOpacity={amtlicheVermessungOpacity}
          onChangeAmtlicheVermessungOpacity={setAmtlicheVermessungOpacity}
          showLuftbild={showLuftbild}
          onToggleLuftbild={setShowLuftbild}
          luftbildOpacity={luftbildOpacity}
          onChangeLuftbildOpacity={setLuftbildOpacity}
          showWaldgrenzen={showWaldgrenzen}
          onToggleWaldgrenzen={setShowWaldgrenzen}
          waldgrenzenOpacity={waldgrenzenOpacity}
          onChangeWaldgrenzenOpacity={setWaldgrenzenOpacity}
          showNutzungsplanung={showNutzungsplanung}
          onToggleNutzungsplanung={setShowNutzungsplanung}
          nutzungsplanungOpacity={nutzungsplanungOpacity}
          onChangeNutzungsplanungOpacity={setNutzungsplanungOpacity}
          showGefahrenkarte={showGefahrenkarte}
          onToggleGefahrenkarte={setShowGefahrenkarte}
          gefahrenkarteOpacity={gefahrenkarteOpacity}
          onChangeGefahrenkarteOpacity={setGefahrenkarteOpacity}
          open={isLayerSelectorOpen}
          onOpenChange={setIsLayerSelectorOpen}
        />

        <ParcelLayer
          onFeatureSelect={props => setObjectInfo(props ? infoFromParcel(props) : null)}
          onLoadingChange={setLoading}
          onError={setError}
          onZoomChange={setCurrentZoom}
          hasOpenInfoPanel={Boolean(objectInfo)}
        />

      </MapContainer>

      {loading && <LoadingOverlay />}
      {error && !loading && <ErrorBox message={error} onClose={() => setError(null)} />}

      <SearchPanel
        objectInfo={objectInfo}
        onSelect={setObjectInfo}
        onClose={() => setObjectInfo(null)}
        onActivate={() => setIsLayerSelectorOpen(false)}
        onInfoPanelClick={() => setIsLayerSelectorOpen(false)}
      />

      <DummyChatbotWidget />
    </div>
  );
}
