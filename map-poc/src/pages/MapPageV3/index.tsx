import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, useMap } from 'react-leaflet';
import type { Geometry } from 'geojson';
import { LuSearch, LuX, LuHistory, LuLayers, LuChevronUp, LuMap, LuListTree } from 'react-icons/lu';
import { TbLoaderQuarter } from 'react-icons/tb';
import 'leaflet/dist/leaflet.css';
import '../MapPageV2/MapPageV2.css';
import './MapPageV3.css';

import Header from '../../components/Header';
import { CustomZoomControl } from '../MapPageV2/MapLayerSelectorControl';
import ParcelLayer from '../MapPageV2/ParcelLayer';
import type { ObjectInfo, SearchResult } from '../MapPageV2/mockData';
import { buildSearchResults, infoFromParcel } from '../MapPageV2/mockData';
import ViewModeSwitcher from '../MapPageV2/ViewModeSwitcher';
import DataPanelResizer from '../MapPageV2/DataPanelResizer';
import type { ViewMode } from '../MapPageV2/viewMode';
import {
  VIEW_MODE_STORAGE_KEY, isViewMode,
  DATA_PANEL_WIDTH_STORAGE_KEY, DATA_PANEL_DEFAULT_WIDTH,
} from '../MapPageV2/viewMode';
import ComparePanel, { MAX_COLUMNS } from './ComparePanel';
import HistoricMapLayers from './HistoricMapLayers';
import { EXAMPLE_INFO, infoFromRef, refOf } from './parcelRef';
import { TODAY_ISO, buildHistory, snapshotAt, formatDate, yearsAgoIso } from './historyData';
import type { ParcelRef } from './historyData';
import type { CompareMode } from './urlState';
import { parseState, serializeState } from './urlState';
import { useMedia } from './useMedia';

const MAP_CENTER: [number, number] = [47.3925, 8.0442];

const parseArea = (a: string) => Number(a.replace(/[^\d]/g, '')) || 0;

function MapResizer({ trigger }: { trigger: string }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map, trigger]);
  return null;
}

// Initial state: URL (shared link) wins over defaults.
const initial = (() => {
  const s = typeof window !== 'undefined' ? parseState(window.location.search) : {};
  const dates = s.dates ?? [TODAY_ISO, yearsAgoIso(10)];
  const sorted = [...dates].sort().reverse();
  return {
    parcels: (s.parcels ?? []).map(infoFromRef) as ObjectInfo[],
    mode: s.mode ?? ('zeit' as CompareMode),
    dates,
    baseDate: s.baseDate && dates.includes(s.baseDate) ? s.baseDate : sorted[0],
    pDate: s.pDate ?? TODAY_ISO,
    compare: s.compare ?? false,
    stand: s.stand ?? TODAY_ISO,
    view: s.view,
  };
})();

export default function MapPageV3() {
  const [parcels, setParcels] = useState<ObjectInfo[]>(initial.parcels);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [focusToken, setFocusToken] = useState(initial.parcels.length ? 1 : 0);
  const [mode, setMode] = useState<CompareMode>(initial.mode);
  const [dates, setDates] = useState<string[]>(initial.dates);
  const [baseDate, setBaseDate] = useState<string>(initial.baseDate);
  const [pDate, setPDate] = useState<string>(initial.pDate);
  const [compare, setCompare] = useState<boolean>(initial.compare);
  const [stand, setStand] = useState<string>(initial.stand);

  // Map: Kartenstand (historic imagery / outlines)
  const [mapDate, setMapDate] = useState<string>(() => {
    const sorted = [...initial.dates].sort().reverse();
    return sorted[1] ?? sorted[0];
  });
  const [showAerial, setShowAerial] = useState(false);
  const [blend, setBlend] = useState(60);
  const [showOutlines, setShowOutlines] = useState(true);
  const [mapPanelOpen, setMapPanelOpen] = useState(() => !(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches));
  const [aerialStatus, setAerialStatus] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (initial.view) return initial.view;
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

  // Phones: either the map or the data, never both (Hybrid falls back to Karte).
  const phone = useMedia('(max-width: 768px)');
  const view: ViewMode = phone ? (viewMode === 'data' ? 'data' : 'map') : viewMode;

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

  // Search (triggered by typing only, so programmatic query updates never open the dropdown)
  const [query, setQuery] = useState(initial.parcels[0] ? `Grundstück ${initial.parcels[0].grundstueckNummer}` : '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchInput = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) { setResults([]); setShowDropdown(false); return; }
    searchTimer.current = setTimeout(() => { setResults(buildSearchResults(value)); setShowDropdown(true); }, 300);
  };

  const primary = parcels[0] ?? null;

  // Keep the map date valid when Stichtage change.
  useEffect(() => {
    if (!compare) return;
    const options = [...new Set(dates)];
    if (!options.includes(mapDate)) setMapDate([...options].sort().reverse()[1] ?? options[0]);
  }, [compare, dates, mapDate]);

  // Without a comparison the map simply shows the chosen Stand.
  const effectiveMapDate = compare ? mapDate : stand;

  // Keep the search field in sync with what is shown (map click, search, example, link).
  const primaryEgrid = primary?.egrid;
  useEffect(() => {
    setQuery((!compare || mode === 'zeit') && primary ? `Grundstück ${primary.grundstueckNummer}` : '');
    setResults([]);
    setShowDropdown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryEgrid, mode, compare]);

  // ── Selection logic ──
  const selectParcel = useCallback((info: ObjectInfo, geom: Geometry | null, focus: boolean) => {
    setParcels(prev => {
      if (compare && mode === 'parzellen' && prev.length > 0) {
        if (prev.some(x => x.egrid === info.egrid)) return prev;
        return prev.length >= MAX_COLUMNS ? prev : [...prev, info];
      }
      return [info];
    });
    if (!compare || mode !== 'parzellen' || parcels.length === 0) {
      setGeometry(geom);
      if (focus) setFocusToken(t => t + 1);
    }
  }, [compare, mode, parcels.length]);

  const selectFromSearch = (info: ObjectInfo) => {
    setShowDropdown(false);
    setResults([]);
    selectParcel(info, null, true);
  };

  const closePanel = () => { setParcels([]); setGeometry(null); };

  const removeParcel = (egrid: string) => {
    setParcels(prev => {
      const next = prev.filter(x => x.egrid !== egrid);
      if (prev[0]?.egrid === egrid) setGeometry(null);
      return next.length ? next : prev;
    });
  };

  const startCompare = (kind: CompareMode, withDate?: string) => {
    setCompare(true);
    setMode(kind);
    if (kind === 'zeit') {
      const other = withDate && withDate !== TODAY_ISO ? withDate : yearsAgoIso(10);
      setDates([TODAY_ISO, other]);
      setBaseDate(TODAY_ISO);
      setMapDate(other);
    } else {
      setPDate(stand);
    }
  };

  const endCompare = () => {
    setStand(mode === 'zeit' ? (baseDate || TODAY_ISO) : pDate);
    setCompare(false);
    setMode('zeit');
    setParcels(prev => prev.slice(0, 1));
  };

  const addParcelRef = (ref: ParcelRef) => {
    setCompare(true);
    setMode('parzellen');
    setPDate(prev => prev || TODAY_ISO);
    setParcels(prev => (prev.some(x => x.egrid === ref.egrid) || prev.length >= MAX_COLUMNS ? prev : [...prev, infoFromRef(ref)]));
  };

  // ── Share link / URL state ──
  const shareState = useMemo(() => ({
    parcels: parcels.map(refOf), mode, dates, baseDate, pDate, compare, stand, view: viewMode,
  }), [parcels, mode, dates, baseDate, pDate, compare, stand, viewMode]);

  useEffect(() => {
    const qs = parcels.length ? `?${serializeState(shareState)}` : window.location.pathname;
    window.history.replaceState(null, '', parcels.length ? `${window.location.pathname}${qs}` : qs);
  }, [shareState, parcels.length]);

  const copyLink = async (): Promise<boolean> => {
    const url = `${window.location.origin}${window.location.pathname}?${serializeState(shareState)}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      window.prompt('Link zum Kopieren:', url);
      return false;
    }
  };

  // ── Map: area at the chosen Kartenstand ──
  const areas = useMemo(() => {
    if (!primary) return { now: 0, then: 0 };
    const h = buildHistory(primary);
    return {
      now: parseArea(primary.flaecheGrundbuch),
      then: parseArea(snapshotAt(h, effectiveMapDate).info.flaecheGrundbuch),
    };
  }, [primary, effectiveMapDate]);

  const mapDateOptions = compare ? [...new Set(dates)].sort().reverse() : [stand];
  const panelTitle = !compare
    ? `Grundstück ${primary?.grundstueckNummer ?? ''}`
    : mode === 'zeit'
    ? `Historischer Vergleich · Grundstück ${primary?.grundstueckNummer ?? ''}`
    : `Grundstücksvergleich · ${parcels.length} ${parcels.length === 1 ? 'Grundstück' : 'Grundstücke'}`;

  return (
    <div
      className={`mapv3-page mapv3-page--${view}${phone ? ' mapv3-page--phone' : ''}${resizing ? ' mapv3-page--resizing' : ''}`}
      style={{ '--data-panel-w': `${dataPanelWidth}px` } as React.CSSProperties}
    >
      <Header extras={<ViewModeSwitcher value={view} onChange={setViewMode} modes={phone ? ['map', 'data'] : undefined} />} />

      <div className="mapv3-body">
        <aside className="mapv3-panel">
          <div className="mapv3-search">
            <div className="search-input-wrapper">
              <span className="search-icon"><LuSearch size={17} color="#888" /></span>
              <input
                className="search-input mapv3-search__input"
                value={query}
                onChange={e => onSearchInput(e.target.value)}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder={compare && mode === 'parzellen' && primary ? 'Weiteres Grundstück suchen…' : 'Grundstück suchen…'}
              />
            </div>
            {showDropdown && results.length > 0 && (
              <div className="search-dropdown mapv3-search__dropdown">
                {results.map((r, i) => (
                  <div key={i} className="search-dropdown-item" onMouseDown={() => selectFromSearch(r.info)}>
                    <div className="search-dropdown-item__label">{r.label}</div>
                    <div className="search-dropdown-item__sub">{r.subLabel}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {primary ? (
            <>
              <div className="info-panel__header mapv3-panel__head">
                <span className="info-panel__title">{panelTitle}</span>
                {phone && (
                  <button type="button" className="mapv3-peekbtn" onClick={() => setViewMode(view === 'map' ? 'data' : 'map')}>
                    {view === 'map' ? <><LuListTree size={15} /> Daten</> : <><LuMap size={15} /> Karte</>}
                  </button>
                )}
                <button className="info-panel__close" aria-label="Schliessen" onClick={closePanel}>
                  <LuX size={24} />
                </button>
              </div>
              <div className="mapv3-panel__sub">
                {!compare || mode === 'zeit'
                  ? `${primary.gemeinde} · ${primary.egrid}`
                  : parcels.map(i => `Nr. ${i.grundstueckNummer}`).join(' · ')}
              </div>
              <div className="mapv3-panel__body">
                <ComparePanel
                  parcels={parcels}
                  mode={mode}
                  onModeChange={setMode}
                  dates={dates}
                  onDatesChange={setDates}
                  baseDate={baseDate}
                  onBaseDateChange={setBaseDate}
                  pDate={pDate}
                  onPDateChange={setPDate}
                  onRemoveParcel={removeParcel}
                  onAddParcelRef={addParcelRef}
                  onCopyLink={copyLink}
                  compare={compare}
                  stand={stand}
                  onStandChange={setStand}
                  onStartCompare={startCompare}
                  onEndCompare={endCompare}
                />
              </div>
            </>
          ) : (
            <div className="mapv3-empty">
              <LuHistory size={34} />
              <h2>Objektdaten und ihre Geschichte</h2>
              <p>Wähle ein Grundstück in der Karte oder über die Suche. Du siehst dessen Daten und kannst sie zu einem
                früheren Stand ansehen. Auf Wunsch vergleichst du anschliessend Stände oder mehrere Grundstücke.</p>
              <button type="button" className="cmp-btn"
                onClick={() => selectFromSearch(EXAMPLE_INFO)}>
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
            <MapResizer trigger={`${view}-${parcels.length > 0}-${dataPanelWidth}`} />
            <CustomZoomControl />
            <HistoricMapLayers
              geometry={geometry}
              focusToken={focusToken}
              hasParcel={Boolean(primary)}
              areaNow={areas.now}
              areaThen={areas.then}
              mapDate={effectiveMapDate}
              showAerial={showAerial}
              blend={blend}
              showOutlines={showOutlines}
              onAerialStatus={setAerialStatus}
            />
            <ParcelLayer
              onFeatureSelect={(props, geom) => { if (props) selectParcel(infoFromParcel(props), geom ?? null, false); }}
              onLoadingChange={setLoading}
              onError={setError}
              onZoomChange={() => {}}
              hasOpenInfoPanel={Boolean(primary)}
              viewMode="map"
            />
          </MapContainer>

          {/* Kartenstand */}
          <div className={`mapv3-mapctl${mapPanelOpen ? '' : ' mapv3-mapctl--closed'}`}>
            <button type="button" className="mapv3-mapctl__toggle" aria-expanded={mapPanelOpen}
              onClick={() => setMapPanelOpen(o => !o)}>
              <LuLayers size={15} /> Kartenstand
              <span className="mapv3-mapctl__date">{effectiveMapDate === TODAY_ISO ? 'Heute' : formatDate(effectiveMapDate)}</span>
              <LuChevronUp size={15} className="mapv3-mapctl__chev" />
            </button>
            {mapPanelOpen && (
              <div className="mapv3-mapctl__body">
                {compare ? (
                  <label className="mapv3-mapctl__row">
                    <span>Stichtag</span>
                    <select value={effectiveMapDate} onChange={e => setMapDate(e.target.value)} disabled={!primary}>
                      {mapDateOptions.map(d => <option key={d} value={d}>{d === TODAY_ISO ? 'Heute' : formatDate(d)}</option>)}
                    </select>
                  </label>
                ) : (
                  <div className="mapv3-mapctl__row">
                    <span>Stand</span>
                    <span className="mapv3-mapctl__fixed">{stand === TODAY_ISO ? 'Heute' : formatDate(stand)} <small>(folgt der Tabelle)</small></span>
                  </div>
                )}
                <label className="mapv3-mapctl__check">
                  <input type="checkbox" checked={showOutlines} onChange={e => setShowOutlines(e.target.checked)} />
                  {compare || stand !== TODAY_ISO
                    ? <>Grenzen: heute <span className="mapv3-key mapv3-key--now" /> / Stichtag <span className="mapv3-key mapv3-key--then" /></>
                    : <>Parzellengrenze <span className="mapv3-key mapv3-key--now" /></>}
                </label>
                <label className="mapv3-mapctl__check">
                  <input type="checkbox" checked={showAerial} onChange={e => setShowAerial(e.target.checked)} />
                  Luftbild (swisstopo)
                </label>
                {showAerial && (
                  <>
                    <label className="mapv3-mapctl__row">
                      <span>Überblenden</span>
                      <input type="range" min={0} max={100} value={blend} onChange={e => setBlend(Number(e.target.value))}
                        aria-label="Überblendung zwischen heute und Stichtag" />
                    </label>
                    <div className="mapv3-mapctl__ends"><span>heute</span><span>Stichtag</span></div>
                    {aerialStatus && <div className="mapv3-mapctl__status">{aerialStatus}</div>}
                  </>
                )}
                {!primary && <div className="mapv3-mapctl__status">Wähle ein Grundstück, um Grenzen zu sehen.</div>}
              </div>
            )}
          </div>

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

      {view === 'data' && !phone && (
        <DataPanelResizer width={dataPanelWidth} onResize={setDataPanelWidth} onDragChange={setResizing} />
      )}
    </div>
  );
}
