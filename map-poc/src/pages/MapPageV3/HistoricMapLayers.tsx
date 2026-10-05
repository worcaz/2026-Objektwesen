import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Geometry, Polygon, MultiPolygon, Position } from 'geojson';

// ─── Historic aerial imagery (swisstopo WMTS) ────────────────────────────────
// NOTE: URL pattern/time values follow swisstopo's WMTS scheme but are not verified against
// the live service from the development sandbox — adjust here if the service differs.
const AERIAL_BASE = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default';
const AERIAL_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a> – SWISSIMAGE';
export const AERIAL_FIRST_YEAR = 2017;

export const aerialUrl = (year: number | 'current') => `${AERIAL_BASE}/${year}/3857/{z}/{x}/{y}.jpeg`;

/** Aerial year used for a Stichtag (clamped to the available range). */
export function aerialYearFor(iso: string): { year: number; clamped: boolean } {
  const y = Number(iso.slice(0, 4));
  const max = new Date().getFullYear() - 1;
  const year = Math.min(max, Math.max(AERIAL_FIRST_YEAR, y));
  return { year, clamped: year !== y };
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

function ringsOf(g: Polygon | MultiPolygon): Position[][] {
  return g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
}

function centroid(g: Polygon | MultiPolygon): [number, number] {
  const ring = ringsOf(g)[0];
  const n = ring.length;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}

/** Scales a polygon about its centroid (mock for "Parzelle vor/nach einer Mutation"). */
export function scaleGeometry(g: Polygon | MultiPolygon, factor: number): Polygon | MultiPolygon {
  const [cx, cy] = centroid(g);
  const sc = (p: Position): Position => [cx + (p[0] - cx) * factor, cy + (p[1] - cy) * factor];
  return g.type === 'Polygon'
    ? { type: 'Polygon', coordinates: g.coordinates.map(r => r.map(sc)) }
    : { type: 'MultiPolygon', coordinates: g.coordinates.map(poly => poly.map(r => r.map(sc))) };
}

/** Rectangle of roughly `areaM2` around a point (used when no real geometry is known). */
export function mockPolygon(center: L.LatLng, areaM2: number): Polygon {
  const side = Math.sqrt(Math.max(areaM2, 100));
  const w = side * 1.25;
  const h = side / 1.25;
  const dLat = h / 2 / 111_320;
  const dLng = w / 2 / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const { lat, lng } = center;
  return {
    type: 'Polygon',
    coordinates: [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]],
  };
}

const isPoly = (g: Geometry | null): g is Polygon | MultiPolygon => !!g && (g.type === 'Polygon' || g.type === 'MultiPolygon');

// ─── Layers (render inside MapContainer) ─────────────────────────────────────

export interface HistoricMapLayersProps {
  /** Real parcel geometry if the parcel was clicked on the map */
  geometry: Geometry | null;
  /** Changes whenever a parcel was chosen via search/example → center the map on it */
  focusToken: number;
  hasParcel: boolean;
  areaNow: number;
  areaThen: number;
  mapDate: string;
  showAerial: boolean;
  /** 0 = today, 100 = Stichtag */
  blend: number;
  showOutlines: boolean;
  onAerialStatus: (msg: string | null) => void;
}

export default function HistoricMapLayers(p: HistoricMapLayersProps) {
  const map = useMap();
  const [mock, setMock] = useState<Polygon | null>(null);
  const [tileErrors, setTileErrors] = useState(0);

  const { year, clamped } = aerialYearFor(p.mapDate);
  const isToday = p.mapDate >= new Date().toISOString().slice(0, 10);

  // Mock geometry for parcels without known outline, centered on the current map view.
  useEffect(() => {
    if (!p.hasParcel) { setMock(null); return; }
    if (!isPoly(p.geometry)) setMock(mockPolygon(map.getCenter(), p.areaNow));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.hasParcel, p.geometry, p.focusToken]);

  const nowGeom: Polygon | MultiPolygon | null = isPoly(p.geometry) ? p.geometry : mock;

  // Pan/zoom to a parcel chosen via search.
  useEffect(() => {
    if (p.focusToken === 0 || !nowGeom) return;
    const b = L.geoJSON(nowGeom).getBounds();
    if (b.isValid()) map.fitBounds(b.pad(1.2), { maxZoom: 18, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusToken, mock]);

  const thenGeom = useMemo(() => {
    if (!nowGeom || p.areaNow <= 0 || p.areaThen <= 0) return null;
    return scaleGeometry(nowGeom, Math.sqrt(p.areaThen / p.areaNow));
  }, [nowGeom, p.areaNow, p.areaThen]);

  useEffect(() => { setTileErrors(0); }, [year, p.showAerial]);
  const { onAerialStatus } = p;
  useEffect(() => {
    if (!p.showAerial) { onAerialStatus(null); return; }
    if (isToday) { onAerialStatus('Luftbild: aktueller Stand'); return; }
    const base = `Luftbild ${year}${clamped ? ' (nächstverfügbarer Stand)' : ''}`;
    onAerialStatus(tileErrors > 6 ? `${base} – vom Dienst nicht geliefert` : base);
  }, [p.showAerial, isToday, year, clamped, tileErrors, onAerialStatus]);

  return (
    <>
      {p.showAerial && (
        <TileLayer url={aerialUrl('current')} attribution={AERIAL_ATTRIBUTION} opacity={1} maxZoom={19} />
      )}
      {p.showAerial && !isToday && (
        <TileLayer
          key={year}
          url={aerialUrl(year)}
          attribution={AERIAL_ATTRIBUTION}
          opacity={p.blend / 100}
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileErrors(n => n + 1) }}
        />
      )}

      {p.showOutlines && thenGeom && !isToday && (
        <GeoJSON
          key={`then-${p.mapDate}-${p.areaThen}-${p.focusToken}`}
          data={thenGeom}
          style={{ color: '#1d4ed8', weight: 2.5, dashArray: '7 5', fillColor: '#1d4ed8', fillOpacity: 0.08 }}
        />
      )}
      {p.showOutlines && nowGeom && (
        <GeoJSON
          key={`now-${p.focusToken}-${mock ? 'm' : 'r'}-${isPoly(p.geometry) ? JSON.stringify(p.geometry).length : 0}`}
          data={nowGeom}
          style={{ color: '#e67e22', weight: 2.5, fillColor: '#e67e22', fillOpacity: isToday ? 0.2 : 0.05 }}
        />
      )}
    </>
  );
}
