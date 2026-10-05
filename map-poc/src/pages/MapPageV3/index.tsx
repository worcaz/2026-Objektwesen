import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMap } from 'react-leaflet';
import { LuSearch, LuX, LuHistory } from 'react-icons/lu';
import { TbLoaderQuarter } from 'react-icons/tb';
import 'leaflet/dist/leaflet.css';
import '../MapPageV2/MapPageV2.css';
import './MapPageV3.css';

import Header from '../../components/Header';
import { CustomZoomControl } from '../MapPageV2/MapLayerSelectorControl';
import ParcelLayer from '../MapPageV2/ParcelLayer';
import type { ObjectInfo, SearchResult } from '../MapPageV2/mockData';
import { buildDummyInfo, buildSearchResults, infoFromParcel } from '../MapPageV2/mockData';
import ComparePanel from './ComparePanel';
import ViewModeSwitcher from '../MapPageV2/ViewModeSwitcher';
import DataPanelResizer from '../MapPageV2/DataPanelResizer';
import type { ViewMode } from '../MapPageV2/viewMode';
import {
  VIEW_MODE_STORAGE_KEY, isViewMode,
  DATA_PANEL_WIDTH_STORAGE_KEY, DATA_PANEL_DEFAULT_WIDTH,
} from '../MapPageV2/viewMode';

// Example parcel for the empty state: Grundstück 3814 in Schötz (matches the v2 mockup data).
const EXAMPLE_INFO: ObjectInfo = {
  ...buildDummyInfo('80698814', '3814', 'CH000080698814'),
  flurname: 'Allmend',
  flaecheGrundbuch: "1'414 m²",
};

const MAP_CENTER: [number, number] = [47.3925, 8.0442];

function MapResizer({ trigger }: { trigger: string }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map, trigger]);
  return null;
}

export default function MapPageV3() {
  const [objectInfo, setObjectInfo] = useState<ObjectInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return isViewMode(stored) ? stored : 'hybrid';
    } catch {
      return 'hybrid';
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  // Data-view panel width: shared with v2 (same storage key), user-resizable.
  const [dataPanelWidth, setDataPanelWidth] = useState<number>(() => {
    try {
      const stored = Number(window.localStorage.getItem(DATA_PANEL_WIDTH_STORAGE_KEY));
      return stored > 0 ? stored : DATA_PANEL_DEFAULT_WIDTH;
    } catch {
      return DATA_PANEL_DEFAULT_WIDTH;
    }
  });
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(DATA_PANEL_WIDTH_STORAGE_KEY, String(dataPanelWidth)); } catch { /* ignore */ }
  }, [dataPanelWidth]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Set when the query was filled programmatically (selection), so no new dropdown opens.
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) { skipSearchRef.current = false; return; }
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => { setResults(buildSearchResults(query)); setShowDropdown(true); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const select = (info: ObjectInfo, label?: string) => {
    setObjectInfo(info);
    setShowDropdown(false);
    if (label !== undefined) { skipSearchRef.current = true; setQuery(label); setResults([]); }
  };

  return (
    <div
      className={`mapv3-page mapv3-page--${viewMode}${resizing ? ' mapv3-page--resizing' : ''}`}
      style={{ '--data-panel-w': `${dataPanelWidth}px` } as React.CSSProperties}
    >
      <Header extras={<ViewModeSwitcher value={viewMode} onChange={setViewMode} />} />

      <div className="mapv3-body">
        <aside className="mapv3-panel">
          <div className="mapv3-search">
            <div className="search-input-wrapper">
              <span className="search-icon"><LuSearch size={17} color="#888" /></span>
              <input
                className="search-input mapv3-search__input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="Grundstück suchen…"
              />
            </div>
            {showDropdown && results.length > 0 && (
              <div className="search-dropdown mapv3-search__dropdown">
                {results.map((r, i) => (
                  <div key={i} className="search-dropdown-item"
                    onMouseDown={() => select(r.info, r.label)}>
                    <div className="search-dropdown-item__label">{r.label}</div>
                    <div className="search-dropdown-item__sub">{r.subLabel}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {objectInfo ? (
            <>
              <div className="info-panel__header mapv3-panel__head">
                <span className="info-panel__title">
                  Historischer Vergleich · Grundstück {objectInfo.grundstueckNummer}
                </span>
                <button className="info-panel__close" aria-label="Schliessen"
                  onClick={() => { setObjectInfo(null); setQuery(''); }}>
                  <LuX size={24} />
                </button>
              </div>
              <div className="mapv3-panel__sub">{objectInfo.gemeinde} · {objectInfo.egrid}</div>
              <div className="mapv3-panel__body">
                <ComparePanel info={objectInfo} />
              </div>
            </>
          ) : (
            <div className="mapv3-empty">
              <LuHistory size={34} />
              <h2>Historische Daten vergleichen</h2>
              <p>Wähle ein Grundstück in der Karte oder über die Suche. Danach kannst du den heutigen Stand
                mit früheren Ständen vergleichen und beliebige Stichtage auswählen.</p>
              <button type="button" className="cmp-btn"
                onClick={() => { const i = EXAMPLE_INFO; select(i, `Grundstück ${i.grundstueckNummer}`); }}>
                Beispiel laden
              </button>
            </div>
          )}
        </aside>

        <div className="mapv3-mapwrap">
          <MapContainer center={MAP_CENTER} zoom={16} zoomControl={false} className="mapv3-map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <WMSTileLayer
              url="https://wfs.geodienste.ch/avc_0/deu"
              layers="Liegenschaften"
              format="image/png"
              transparent
              version="1.3.0"
              opacity={0.7}
              attribution='&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Amtliche Vermessung'
            />
            <MapResizer trigger={`${viewMode}-${Boolean(objectInfo)}-${dataPanelWidth}`} />
            <CustomZoomControl />
            <ParcelLayer
              onFeatureSelect={props => setObjectInfo(props ? infoFromParcel(props) : null)}
              onLoadingChange={setLoading}
              onError={setError}
              onZoomChange={() => {}}
              hasOpenInfoPanel={Boolean(objectInfo)}
              viewMode="map"
            />
          </MapContainer>
          {loading && (
            <div className="loading-overlay" style={{ position: 'absolute' }}>
              <TbLoaderQuarter size={18} className="loading-spinner" /> Lade Parzellen…
            </div>
          )}
          {error && !loading && (
            <div className="error-box" style={{ position: 'absolute' }}>
              <div className="error-box__header">
                <strong>Error</strong>
                <button onClick={() => setError(null)} className="error-box__close" aria-label="Close">×</button>
              </div>
              <div className="error-box__message">{error}</div>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'data' && (
        <DataPanelResizer width={dataPanelWidth} onResize={setDataPanelWidth} onDragChange={setResizing} />
      )}
    </div>
  );
}
