import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  GeoJSON as GeoJSONLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import type { RealParcelProps } from '../wfsService';
import {
  fetchParcelsByBbox,
  buildMockFeatures,
  PARCEL_ATTR_LABELS,
  MIN_ZOOM_FOR_PARCELS,
} from '../wfsService';
import Header from '../components/Header';

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

// ─── WMS Configuration ───────────────────────────────────────────────────────
// Raster tile overlay: shows cadastral boundaries Switzerland-wide.
// Purely visual — click interaction is handled by the WFS vector layer below.
// WMS Capabilities: https://geodienste.ch/db/avc_0/deu?SERVICE=WMS&REQUEST=GetCapabilities
const WMS_URL         = 'https://wfs.geodienste.ch/avc_0/deu';
const WMS_LAYERS      = 'Liegenschaften';
const WMS_ATTRIBUTION = '&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Amtliche Vermessung';

// ─── Vector layer styles ─────────────────────────────────────────────────────

/** Default style for all parcel polygons. */
const VECTOR_STYLE: L.PathOptions = {
  color:       '#3388ff',
  weight:      1.5,
  fillColor:   '#3388ff',
  fillOpacity: 0.08,
};

/** Applied to the currently selected / clicked polygon. */
const VECTOR_HIGHLIGHT_STYLE: L.PathOptions = {
  color:       '#e67e22',
  weight:      2.5,
  fillColor:   '#e67e22',
  fillOpacity: 0.25,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HIDDEN_ATTR = new Set(['_source']);

function labelFor(key: string): string {
  return PARCEL_ATTR_LABELS[key] ?? key;
}

function formatValue(key: string, value: unknown): string {
  if (key === 'Flaeche' && typeof value === 'number') {
    return `${value.toLocaleString()} m²`;
  }
  if (value === null || value === undefined) return '—';
  return String(value);
}

// ─── Small shared sub-component ──────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{value}</span>
    </div>
  );
}

// ─── Fixed-position overlays ──────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: 32, zIndex: 1000,
      background: 'rgba(255,255,255,0.92)', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      padding: '14px 20px', fontFamily: 'system-ui, sans-serif',
      fontSize: 14, color: '#444', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>⏳</span> Loading parcels…
    </div>
  );
}

function ErrorBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: 32, zIndex: 1000,
      background: '#fff3f3', border: '1px solid #f5c5c5', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: '14px 20px', minWidth: 260,
      fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#c0392b',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Error</strong>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}
          aria-label="Close">×</button>
      </div>
      <div style={{ marginTop: 6 }}>{message}</div>
    </div>
  );
}

/** Shown when the map is zoomed out below the parcel-load threshold. */
function ZoomHint() {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: 32, zIndex: 1000,
      background: 'rgba(255,255,255,0.9)', borderRadius: 8,
      boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
      padding: '10px 14px', fontFamily: 'system-ui, sans-serif',
      fontSize: 13, color: '#555',
    }}>
      🔍 Zoom in to level {MIN_ZOOM_FOR_PARCELS}+ to load interactive parcels
    </div>
  );
}

/** Displays real WFS attributes (or mock data) for the selected parcel. */
function InfoBox({ props: parcel, onClose }: { props: RealParcelProps; onClose: () => void }) {
  const isMock = parcel._source === 'mock';
  const entries = Object.entries(parcel).filter(([k]) => !HIDDEN_ATTR.has(k));

  return (
    <div style={{
      position: 'fixed', bottom: 32, left: 32, zIndex: 1000,
      background: '#fff', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      padding: '20px 24px', minWidth: 290,
      fontFamily: 'system-ui, sans-serif', fontSize: 14, lineHeight: 1.7,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>
          Parcel
          {isMock && (
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 500,
              background: '#fff3cd', color: '#856404', padding: '1px 6px', borderRadius: 4,
            }}>
              mock
            </span>
          )}
        </span>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', padding: '0 2px' }}
          aria-label="Close">×</button>
      </div>

      {/* WFS attributes */}
      {entries.map(([key, value]) => (
        <Row key={key} label={labelFor(key)} value={formatValue(key, value)} />
      ))}
    </div>
  );
}

function WmsToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', bottom: 90, right: 16, zIndex: 1000,
        background: '#fff', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        padding: '10px 14px', fontFamily: 'system-ui, sans-serif', fontSize: 13,
        display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none', cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <input
        type="checkbox" checked={visible} onChange={onToggle}
        style={{ cursor: 'pointer', width: 15, height: 15 }}
        aria-label="Toggle WMS cadastral layer"
      />
      <span style={{ color: '#1a1a1a' }}>WMS: Cadastral (AV)</span>
    </div>
  );
}

// ─── ParcelLayer (must render inside MapContainer) ────────────────────────────
//
// This component manages the full lifecycle of the WFS vector parcel layer:
//
//  1. On mount and on every "moveend" / "zoomend" Leaflet event:
//     a. Read the current map zoom and bounding box.
//     b. If zoom < MIN_ZOOM_FOR_PARCELS → clear the layer (viewport too large).
//     c. Cancel any in-flight WFS request via AbortController.
//     d. Issue a new WFS GetFeature request with the current BBOX.
//     e. If the WFS returns 0 features (area not covered) → fall back to mock data.
//     f. Render the FeatureCollection as a Leaflet GeoJSON layer.
//
//  2. Per-feature click interaction (no React state re-renders involved):
//     • Each feature's Leaflet layer gets a "click" event handler via onEachFeature.
//     • On click: reset the previous highlight, apply VECTOR_HIGHLIGHT_STYLE to
//       the clicked layer via Leaflet's imperative l.setStyle() API, then notify
//       the parent with the feature's properties.
//     • Using direct Leaflet style manipulation (not re-keying the GeoJSONLayer)
//       means all other polygons stay rendered — only the highlight changes.

interface ParcelLayerProps {
  onFeatureSelect:  (props: RealParcelProps | null) => void;
  onLoadingChange:  (loading: boolean) => void;
  onError:          (msg: string | null) => void;
  onZoomChange:     (zoom: number) => void;
}

function ParcelLayer({ onFeatureSelect, onLoadingChange, onError, onZoomChange }: ParcelLayerProps) {
  const map = useMap();

  const [parcels,  setParcels]  = useState<FeatureCollection | null>(null);
  // Key increments each time new data arrives, forcing GeoJSONLayer to remount.
  const [layerKey, setLayerKey] = useState(0);

  // Tracks the Leaflet Path layer that is currently highlighted.
  // Direct mutation avoids a React re-render on every click.
  const highlightedRef = useRef<L.Path | null>(null);

  // AbortController so panning quickly cancels the previous in-flight request.
  const abortRef = useRef<AbortController | null>(null);

  // Keep the latest callback props in a ref so event handlers never go stale.
  const cbRef = useRef({ onFeatureSelect, onLoadingChange, onError, onZoomChange });
  useEffect(() => {
    cbRef.current = { onFeatureSelect, onLoadingChange, onError, onZoomChange };
  });

  // Stable async function — recreated only when `map` changes (never in practice).
  const loadParcels = useCallback(async () => {
    const zoom  = map.getZoom();
    const { onFeatureSelect, onLoadingChange, onError, onZoomChange } = cbRef.current;

    onZoomChange(zoom);

    if (zoom < MIN_ZOOM_FOR_PARCELS) {
      setParcels(null);
      onFeatureSelect(null);
      return;
    }

    // Cancel any outstanding request before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    onLoadingChange(true);
    onError(null);
    highlightedRef.current = null; // clear stale ref before data changes
    onFeatureSelect(null);

    try {
      const b = map.getBounds();
      let data = await fetchParcelsByBbox(
        b.getSouth(), b.getWest(), b.getNorth(), b.getEast(),
        controller.signal,
      );

      if (data.features.length === 0) {
        // WFS returned nothing for this viewport (canton not subscribed).
        // Generate mock parcels so the app remains interactive.
        data = buildMockFeatures(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
      }

      setParcels(data);
      setLayerKey(k => k + 1);
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      onError(err instanceof Error ? err.message : 'Failed to load parcel data.');
    } finally {
      onLoadingChange(false);
    }
  }, [map]);

  // Initial load on mount, and rebind Leaflet events.
  // useEffect deps [loadParcels, map] are both stable → runs exactly once.
  useEffect(() => {
    void loadParcels();

    const handler = () => void loadParcels();
    map.on('moveend', handler);
    map.on('zoomend', handler);

    return () => {
      map.off('moveend', handler);
      map.off('zoomend', handler);
      abortRef.current?.abort();
    };
  }, [loadParcels, map]);

  // onEachFeature is called by react-leaflet for every feature at mount.
  // Uses refs for all external values so no stale closures occur.
  const onEachFeature = useCallback((feature: Feature, layer: L.Layer) => {
    layer.on('click', () => {
      // Reset the previously highlighted polygon.
      if (highlightedRef.current) {
        highlightedRef.current.setStyle(VECTOR_STYLE);
      }
      // Highlight the clicked polygon.
      (layer as L.Path).setStyle(VECTOR_HIGHLIGHT_STYLE);
      highlightedRef.current = layer as L.Path;
      // Notify parent to show the info box.
      cbRef.current.onFeatureSelect(feature.properties as RealParcelProps);
    });
  }, []);

  if (!parcels) return null;

  return (
    <GeoJSONLayer
      key={layerKey}
      data={parcels}
      style={VECTOR_STYLE}
      onEachFeature={onEachFeature}
    />
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

// Map center: Lucerne, Switzerland (zoom 14).
//
// WFS parcel data note:
//   The geodienste.ch WFS (ms:RESF) does NOT currently cover Lucerne canton.
//   Mock parcels are shown at this location.
//   Navigate to one of these cantons for real WFS data:
//     • Zug (ZG)              — e.g. 47.17°N, 8.52°E
//     • Valais (VS)           — e.g. 46.23°N, 7.36°E
//     • Basel-Landschaft (BL) — e.g. 47.48°N, 7.73°E
const MAP_CENTER: [number, number] = [47.0502, 8.3093];

export default function MapPage() {
  const [wmsVisible,       setWmsVisible]       = useState(true);
  const [loading,          setLoading]           = useState(false);
  const [error,            setError]             = useState<string | null>(null);
  const [selectedFeature,  setSelectedFeature]   = useState<RealParcelProps | null>(null);
  const [currentZoom,      setCurrentZoom]       = useState(14);

  const showZoomHint = currentZoom < MIN_ZOOM_FOR_PARCELS && !loading && !selectedFeature && !error;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <MapContainer center={MAP_CENTER} zoom={14} zoomControl={false} style={{ width: '100%', flex: 1 }}>

        {/* ── Base layer: OpenStreetMap ───────────────────────────────────── */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/*
          ── WMS raster overlay: Amtliche Vermessung (Swiss cadastral survey) ─
          Renders cadastral boundaries as server-side tile images.
          Works Switzerland-wide regardless of WFS coverage.
          Toggled on/off by the checkbox in the top-right corner.
        */}
        {wmsVisible && (
          <WMSTileLayer
            url={WMS_URL}
            layers={WMS_LAYERS}
            format="image/png"
            transparent={true}
            version="1.3.0"
            opacity={0.7}
            attribution={WMS_ATTRIBUTION}
          />
        )}

        {/*
          ── WFS vector layer: interactive clickable parcels ─────────────────
          Fetches GeoJSON features from the WFS for the current viewport BBOX.
          Click any polygon to highlight it and open the info box.
          Only active at zoom ≥ MIN_ZOOM_FOR_PARCELS to limit data volume.
          Falls back to mock data when the WFS returns zero features.
        */}
        <ZoomControl position="bottomright" />

        <ParcelLayer
          onFeatureSelect={setSelectedFeature}
          onLoadingChange={setLoading}
          onError={setError}
          onZoomChange={setCurrentZoom}
        />

      </MapContainer>

      {/* ── Overlays rendered outside MapContainer in fixed positions ──── */}
      {loading    && <LoadingOverlay />}
      {error && !loading && <ErrorBox message={error} onClose={() => setError(null)} />}
      {selectedFeature && !loading && (
        <InfoBox props={selectedFeature} onClose={() => setSelectedFeature(null)} />
      )}
      {showZoomHint && <ZoomHint />}

      {/* WMS toggle — bottom-right corner */}
      <WmsToggle visible={wmsVisible} onToggle={() => setWmsVisible(v => !v)} />
    </div>
  );
}
