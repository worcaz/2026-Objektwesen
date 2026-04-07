import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { LuHouse, LuSearch, LuX } from 'react-icons/lu';
import { PiCrane } from 'react-icons/pi';
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

// ─── Object info model & dummy data ──────────────────────────────────────────

interface BuildingInfo   { nr: string; egid: string; bezeichnung: string; status: string; }
interface ProjectInfo    { dossierNr: string; bezeichnung: string; status: string; }
interface BodenbedeckungEntry { label: string; area: string; }
interface ZonenplanEntry    { zonentyp: string; gemeinde: string; flaeche: string; anteil: string; }
interface ObjectInfo {
  grundstueckNummer: string;
  egrid:             string;
  grundstueckArt:    string;
  eigentuemer:       string;
  gemeinde:          string;
  bfsNr:             string;
  grundbuchNr:       string;
  flurname:          string;
  bodenbedeckung:       BodenbedeckungEntry[];
  grundnutzungZonenplan: ZonenplanEntry[];
  flaecheGrundbuch:      string;
  gebaeude:          BuildingInfo[];
  bauprojekte:       ProjectInfo[];
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DUMMY_OWNERS: string[] = [
  'Hans Müller, Luzern', 'Petra Rösch, Zug', 'Immobilien AG, Zug',
  'Familie Berger, Schwyz', 'Kanton Luzern', 'Max Huber, Bern',
];
const DUMMY_GEMEINDEN: Array<{ name: string; bfs: string; gb: string }> = [
  { name: 'Luzern',        bfs: '1061', gb: 'GB Luzern'        },
  { name: 'Zug',           bfs: '1711', gb: 'GB Zug'           },
  { name: 'Kriens',        bfs: '1063', gb: 'GB Kriens'        },
  { name: 'Emmen',         bfs: '1024', gb: 'GB Emmen'         },
  { name: 'Horw',          bfs: '1059', gb: 'GB Horw'          },
  { name: 'Cham',          bfs: '1702', gb: 'GB Cham'          },
];
const DUMMY_FLURNAMEN: string[] = [
  'Im Grund', 'Auf der Matte', 'Unterdorf', 'Zelgli', 'Brühl', 'Hintere Gasse', 'Rainweg',
];
const DUMMY_BODENBEDECKUNG: BodenbedeckungEntry[][] = [
  [
    { label: 'Gartenanlage',             area: '692 m²' },
    { label: 'Gebäude (150)',             area: '277 m²' },
    { label: 'Gebäude (150a)',            area: '37 m²'  },
    { label: 'fliessendes Gewässer',      area: '7 m²'   },
    { label: 'übrige befestigte Fläche',  area: '251 m²' },
  ],
  [
    { label: 'Gebäude (12)',              area: '410 m²' },
    { label: 'Verkehrsfläche',            area: '185 m²' },
    { label: 'Gartenanlage',             area: '320 m²' },
  ],
  [
    { label: 'Landwirtschaftsfläche',     area: '1’840 m²' },
    { label: 'Gebäude (Scheune)',         area: '180 m²' },
  ],
  [
    { label: 'Wald',                     area: '2’300 m²' },
    { label: 'fliessendes Gewässer',      area: '45 m²'  },
  ],
  [
    { label: 'Gebäude (7)',               area: '560 m²' },
    { label: 'übrige befestigte Fläche',  area: '380 m²' },
    { label: 'Gartenanlage',             area: '210 m²' },
  ],
  [
    { label: 'Verkehrsfläche',            area: '900 m²' },
    { label: 'Best. ohne bes. Nutzung',  area: '120 m²' },
  ],
];
const DUMMY_GRUNDNUTZUNG: ZonenplanEntry[][] = [
  [
    { zonentyp: 'Strasse',                     gemeinde: 'Verkehrszone',         flaeche: '108 m²',  anteil: '14%'  },
    { zonentyp: 'Kern- oder Dorfzone bis 17m', gemeinde: 'Kernzone B Markt',     flaeche: '641 m²',  anteil: '86%'  },
  ],
  [
    { zonentyp: 'Wohnzone W2',                 gemeinde: 'Wohnzone 2-geschossig', flaeche: '920 m²',  anteil: '100%' },
  ],
  [
    { zonentyp: 'Gewerbezone',                 gemeinde: 'Gewerbezone GE',        flaeche: '1200 m²', anteil: '75%'  },
    { zonentyp: 'Strasse',                     gemeinde: 'Verkehrszone',          flaeche: '400 m²',  anteil: '25%'  },
  ],
  [
    { zonentyp: 'Wohnzone W3',                 gemeinde: 'Wohnzone 3-geschossig', flaeche: '750 m²',  anteil: '62%'  },
    { zonentyp: 'Grünzone',                    gemeinde: 'Öffentliche Grünfläche', flaeche: '460 m²', anteil: '38%'  },
  ],
  [
    { zonentyp: 'Industriezone',               gemeinde: 'Industriezone I',        flaeche: '3400 m²', anteil: '100%' },
  ],
  [
    { zonentyp: 'Wohnzone W4',                 gemeinde: 'Wohnzone 4-geschossig', flaeche: '2100 m²', anteil: '88%'  },
    { zonentyp: 'Strasse',                     gemeinde: 'Verkehrszone',          flaeche: '290 m²',  anteil: '12%'  },
  ],
];
const DUMMY_ARTEN: string[] = [
  'Liegenschaft',
  'Selbständiges und dauerndes Recht (z. B. Baurecht)',
  'Bergwerk',
  'Miteigentumsanteil an Grundstück',
];
const DUMMY_BUILDINGS: BuildingInfo[] = [
  { nr: '609.140',  egid: '192557',    bezeichnung: '',       status: 'abgebrochen' },
  { nr: '609.140a', egid: '191911198', bezeichnung: 'Carport', status: 'bestehend'   },
  { nr: 'n.v.',     egid: '504085015', bezeichnung: '',       status: 'bestehend'   },
  { nr: '312.005',  egid: '200341872', bezeichnung: 'Wohnhaus', status: 'bestehend'  },
  { nr: '415.002',  egid: '300118540', bezeichnung: 'Nebengebäude', status: 'abgebrochen' },
  { nr: 'n.v.',     egid: '601234567', bezeichnung: 'Garage',  status: 'bestehend'   },
];
const DUMMY_PROJECTS: ProjectInfo[] = [
  { dossierNr: '2025-0660', bezeichnung: 'Umnutzung Gebäude Nr. 134a zu Abstell- und Lagerfläche für Malerbetrieb (nachträglich) und Einbau Spaltanlage in Gebäude Nr. 134d', status: 'Leitentscheid' },
  { dossierNr: '2022-4426', bezeichnung: 'Neubau einer Niederspannungsrohranlage und Abbruch der bestehenden Freileitung',                                                         status: 'Abgeschlossen'  },
  { dossierNr: '2017-1977', bezeichnung: 'Anbau Garage + Holzschnitzellager',                                                                                                       status: 'Abgeschlossen'  },
  { dossierNr: '2026-0572', bezeichnung: 'Einbau Wohnung',                                                                                                                          status: 'Leitentscheid'  },
  { dossierNr: '2024-0637', bezeichnung: 'Fassadensanierung und Anbau Balkone',                                                                                                     status: 'Abgeschlossen'  },
];

function buildDummyInfo(seed: string, nummer?: string, egrid?: string): ObjectInfo {
  const h = hashStr(seed);
  const gemeinde = DUMMY_GEMEINDEN[h % DUMMY_GEMEINDEN.length];
  const flaeche = 200 + (h % 4800);
  return {
    grundstueckNummer: nummer ?? `${1000 + (h % 8000)}`,
    egrid:             egrid  ?? `CH${String(h % 1000000000000).padStart(12, '0')}`,
    grundstueckArt:    DUMMY_ARTEN[h % DUMMY_ARTEN.length],
    eigentuemer:       DUMMY_OWNERS[h % DUMMY_OWNERS.length],
    gemeinde:          gemeinde.name,
    bfsNr:             gemeinde.bfs,
    grundbuchNr:       gemeinde.gb,
    flurname:          DUMMY_FLURNAMEN[h % DUMMY_FLURNAMEN.length],
    bodenbedeckung:       DUMMY_BODENBEDECKUNG[h % DUMMY_BODENBEDECKUNG.length],
    grundnutzungZonenplan: DUMMY_GRUNDNUTZUNG[h % DUMMY_GRUNDNUTZUNG.length],
    flaecheGrundbuch:      `${flaeche.toLocaleString('de-CH')} m²`,
    gebaeude:          DUMMY_BUILDINGS.slice(0, 1 + (h % 3)),
    bauprojekte:       DUMMY_PROJECTS.slice(0, 1 + (h % DUMMY_PROJECTS.length)),
  };
}

function infoFromParcel(p: RealParcelProps): ObjectInfo {
  return buildDummyInfo(p.EGRIS_EGRID ?? p.Nummer ?? 'parcel', p.Nummer, p.EGRIS_EGRID);
}

interface SearchResult { label: string; subLabel: string; info: ObjectInfo; }

function buildSearchResults(query: string): SearchResult[] {
  return [0, 1].map(i => {
    const info = buildDummyInfo(query + i);
    return {
      label:    `Grundstück ${info.grundstueckNummer} (${info.grundstueckArt})`,
      subLabel: `${info.egrid} — ${info.eigentuemer}`,
      info,
    };
  });
}

// ─── Fixed-position overlays ──────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: 32, zIndex: 1000,
      background: 'rgba(255,255,255,0.92)', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      padding: '14px 20px',
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
      fontSize: 14, color: '#c0392b',
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
      padding: '10px 14px',
      fontSize: 13, color: '#555',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LuSearch size={13} /> Zoom in to level {MIN_ZOOM_FOR_PARCELS}+ to load interactive parcels
      </span>
    </div>
  );
}

// ─── Object info panel & search ──────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  'bestehend':      { bg: '#d4edda', color: '#155724' },
  'abgebrochen':    { bg: '#f8d7da', color: '#721c24' },
  'projektiert':    { bg: '#cce5ff', color: '#004085' },
  'Abgeschlossen':  { bg: '#e2e3e5', color: '#383d41' },
  'Leitentscheid':  { bg: '#fff3cd', color: '#856404' },
  'Bewilligt':      { bg: '#d4edda', color: '#155724' },
  'In Bearbeitung': { bg: '#fff3cd', color: '#856404' },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: '#666', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#1a1a1a', textAlign: 'right', fontSize: mono ? 12 : 13 }}>
        {value}
      </span>
    </div>
  );
}

function CollapsibleZonenplan({ entries }: { entries: ZonenplanEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Grundnutzung Zonenplan</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0 8px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 3, borderBottom: '1px solid #f0f0f0' }}>
            <span>Zonentyp</span>
            <span>Gemeinde</span>
            <span style={{ textAlign: 'right' }}>Fläche</span>
            <span style={{ textAlign: 'right' }}>Anteil</span>
          </div>
          {entries.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0 8px', fontSize: 12, alignItems: 'baseline' }}>
              <span style={{ color: '#555' }}>{e.zonentyp}</span>
              <span style={{ color: '#555' }}>{e.gemeinde}</span>
              <span style={{ fontWeight: 600, color: '#1a1a1a', textAlign: 'right' }}>{e.flaeche}</span>
              <span style={{ fontWeight: 600, color: '#1a1a1a', textAlign: 'right' }}>{e.anteil}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleBauprojekte({ entries }: { entries: ProjectInfo[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Bauprojekte</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0 8px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 3, borderBottom: '1px solid #f0f0f0' }}>
            <span>Dossier</span>
            <span>Bezeichnung</span>
            <span>Status</span>
          </div>
          {entries.map((p, i) => {
            const c = STATUS_BADGE[p.status] ?? { bg: '#eee', color: '#555' };
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0 8px', fontSize: 12, alignItems: 'baseline', padding: '2px 0' }}>
                <span style={{ color: '#555', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.dossierNr}</span>
                <span style={{ color: '#1a1a1a' }}>{p.bezeichnung}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{p.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollapsibleGebaeude({ entries }: { entries: BuildingInfo[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Gebäude</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: '0 8px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 3, borderBottom: '1px solid #f0f0f0' }}>
            <span>Nr.</span>
            <span>EGID</span>
            <span>Bezeichnung</span>
            <span>Status</span>
          </div>
          {entries.map((g, i) => {
            const c = STATUS_BADGE[g.status] ?? { bg: '#eee', color: '#555' };
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: '0 8px', fontSize: 12, alignItems: 'center', padding: '2px 0' }}>
                <span style={{ color: '#555', whiteSpace: 'nowrap' }}>{g.nr}</span>
                <span style={{ color: '#888', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{g.egid}</span>
                <span style={{ color: '#1a1a1a' }}>{g.bezeichnung}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{g.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollapsibleBodenbedeckung({ entries }: { entries: BodenbedeckungEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Bodenbedeckung</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#555' }}>{e.label}</span>
              <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{e.area}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectInfoPanel({ info, onClose }: { info: ObjectInfo; onClose: () => void }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #ddd', borderTop: 'none',
      borderRadius: '0 0 10px 10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'rgba(0,159,227,0.9)', color: '#fff',
        padding: '9px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 500, fontSize: 17 }}>Grundstück {info.grundstueckNummer}</span>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}
          aria-label="Schliessen"><LuX size={30} /></button>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <Section title="Stammdaten">
          <FieldRow label="Grundstücknummer"              value={info.grundstueckNummer} />
          <FieldRow label="Eidg. Grundstück-ID (EGRID)"  value={info.egrid} />
          <FieldRow label="Gemeinde (BFS-Nr.)"            value={`${info.gemeinde} (${info.bfsNr})`} />
          <FieldRow label="Grundbuch (GB-Nr.)"            value={info.grundbuchNr} />
          <FieldRow label="Grundstückart"                value={info.grundstueckArt} />
          <FieldRow label="Flurnamen"                     value={info.flurname} />
          <CollapsibleBodenbedeckung entries={info.bodenbedeckung} />
          <FieldRow label="Fläche (grundbuchlich)"        value={info.flaecheGrundbuch} />
          <FieldRow label="Eigentümer"                   value={info.eigentuemer} />
        </Section>

        <CollapsibleZonenplan entries={info.grundnutzungZonenplan} />
        <CollapsibleGebaeude entries={info.gebaeude} />
        <CollapsibleBauprojekte entries={info.bauprojekte} />
      </div>
    </div>
  );
}

function SearchPanel({
  objectInfo, onSelect, onClose,
}: {
  objectInfo: ObjectInfo | null;
  onSelect:   (info: ObjectInfo) => void;
  onClose:    () => void;
}) {
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDropdown(false); return; }
    const t = setTimeout(() => { setResults(buildSearchResults(query)); setShowDropdown(true); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasPanel = objectInfo !== null;
  const showDrop = showDropdown && results.length > 0 && !hasPanel;

  return (
    <div style={{
      position: 'fixed', top: 60, left: 25, zIndex: 1500,
      width: 400,
    }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}><LuSearch size={17} color="#888" /></span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && !hasPanel && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Grundstück suchen…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 14px 11px 38px',
            border: '1px solid #ddd',
            borderRadius: (showDrop || hasPanel) ? '8px 8px 0 0' : 8,
            fontSize: 15, outline: 'none',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            background: '#fff',
          }}
        />
      </div>

      {/* Dropdown */}
      {showDrop && (
        <div style={{
          background: '#fff', border: '1px solid #ddd', borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {results.map((r, i) => (
            <div key={i}
              onMouseDown={() => { onSelect(r.info); setQuery(r.label); setShowDropdown(false); }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f5f9ff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.subLabel}</div>
            </div>
          ))}
        </div>
      )}

      {/* Info panel */}
      {hasPanel && (
        <ObjectInfoPanel info={objectInfo} onClose={() => { onClose(); setQuery(''); }} />
      )}
    </div>
  );
}

function WmsToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', bottom: 90, right: 16, zIndex: 1000,
        background: '#fff', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        padding: '10px 14px', fontSize: 13,
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

export default function MapPageV2() {
  const [wmsVisible,  setWmsVisible]  = useState(true);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [objectInfo,  setObjectInfo]  = useState<ObjectInfo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(14);

  const showZoomHint = currentZoom < MIN_ZOOM_FOR_PARCELS && !loading && !objectInfo && !error;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      <Header />

      <MapContainer center={MAP_CENTER} zoom={14} zoomControl={false} style={{ width: '100%', flex: 1 }}>

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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

        <ZoomControl position="bottomright" />

        <ParcelLayer
          onFeatureSelect={props => setObjectInfo(props ? infoFromParcel(props) : null)}
          onLoadingChange={setLoading}
          onError={setError}
          onZoomChange={setCurrentZoom}
        />

      </MapContainer>

      {loading && <LoadingOverlay />}
      {error && !loading && <ErrorBox message={error} onClose={() => setError(null)} />}
      {showZoomHint && <ZoomHint />}

      <SearchPanel
        objectInfo={objectInfo}
        onSelect={setObjectInfo}
        onClose={() => setObjectInfo(null)}
      />

      <WmsToggle visible={wmsVisible} onToggle={() => setWmsVisible(v => !v)} />
    </div>
  );
}
