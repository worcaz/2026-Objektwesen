import type { Feature, FeatureCollection } from 'geojson';

// ─── WFS Configuration ───────────────────────────────────────────────────────
// Service:      geodienste.ch — Amtliche Vermessung (Swiss official cadastral survey)
// Capabilities: https://geodienste.ch/db/avc_0/deu?SERVICE=WFS&REQUEST=GetCapabilities
// Feature type: ms:RESF  (Title: "Liegenschaften" = land parcels)
//
// To replace with a different WFS endpoint, update WFS_BASE_URL and WFS_TYPENAME.
//
// Coverage note: This service contains data only for subscribed Swiss cantons.
// Confirmed covered: VS (Valais), ZG (Zug), BL (Basel-Landschaft), SZ (Schwyz).
// Lucerne (LU) is NOT covered — mock data is used as fallback in that area.
//
// BBOX axis order: The server uses lat/lon (northing-first) for EPSG:4326.
// Response CRS:  WGS84 / CRS84 — standard GeoJSON lon/lat coordinates.

export const WFS_BASE_URL = 'https://wfs.geodienste.ch/avc_0/deu';
export const WFS_TYPENAME  = 'ms:RESF';

/** Minimum map zoom level at which the vector parcel layer is loaded.
 *  The service is optimised for 1:25 000 scale, roughly zoom 14–15. */
export const MIN_ZOOM_FOR_PARCELS = 15;

/** Maximum features per viewport BBOX request. Keeps response times short. */
export const MAX_FEATURES = 200;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Attributes returned by the ms:RESF WFS feature type. */
export interface RealParcelProps {
  BFSNr?:           number;
  NBIdent?:         string;
  Nummer?:          string;
  EGRIS_EGRID?:     string;
  Vollstaendigkeit?: string;
  Flaeche?:         number;
  Kanton?:          string;
  /** Internal marker — 'mock' when data is not from the real WFS. */
  _source?: 'wfs' | 'mock';
  [key: string]: unknown;
}

/** Maps WFS attribute names to human-readable English labels for the UI. */
export const PARCEL_ATTR_LABELS: Record<string, string> = {
  NBIdent:          'Parcel ID',
  Nummer:           'Number',
  EGRIS_EGRID:      'EGRID (national ID)',
  Flaeche:          'Area',
  Kanton:           'Canton',
  Vollstaendigkeit: 'Completeness',
  BFSNr:            'Municipality Nr.',
};

// ─── Real WFS fetch ──────────────────────────────────────────────────────────

/**
 * Requests all parcels (ms:RESF) within the given bounding box from the WFS.
 *
 * BBOX parameter order for EPSG:4326 on this server: minLat,minLng,maxLat,maxLng
 * (OGC northing-first axis order for geographic CRS).
 *
 * Pass an AbortSignal to cancel in-flight requests when the user pans/zooms.
 */
export async function fetchParcelsByBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  signal?: AbortSignal,
): Promise<FeatureCollection> {
  const params = new URLSearchParams({
    SERVICE:      'WFS',
    VERSION:      '2.0.0',
    REQUEST:      'GetFeature',
    TYPENAMES:    WFS_TYPENAME,
    SRSNAME:      'EPSG:4326',
    OUTPUTFORMAT: 'application/json; subtype=geojson',
    COUNT:        String(MAX_FEATURES),
    // Axis order: minLat,minLng,maxLat,maxLng (lat/lon = northing-first for EPSG:4326)
    BBOX: `${minLat},${minLng},${maxLat},${maxLng},urn:ogc:def:crs:EPSG::4326`,
  });

  const response = await fetch(`${WFS_BASE_URL}?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`WFS error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as { type?: string };

  if (data.type !== 'FeatureCollection') {
    throw new Error('WFS response is not a FeatureCollection');
  }

  // Tag each feature so the UI knows it came from the real service
  const fc = data as FeatureCollection;
  fc.features.forEach(f => {
    if (f.properties) (f.properties as RealParcelProps)._source = 'wfs';
  });

  return fc;
}

// ─── Mock fallback ───────────────────────────────────────────────────────────

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

/**
 * Generates realistic-looking fake parcel polygons distributed across a BBOX.
 * Used when the WFS returns no features (e.g. Lucerne canton not covered).
 * All features are tagged _source: 'mock' so the UI can display a badge.
 */
export function buildMockFeatures(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  count = 14,
): FeatureCollection {
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  const features: Feature[] = Array.from({ length: count }, (_, i) => {
    const cx = rand(minLng + lngSpan * 0.1, maxLng - lngSpan * 0.1);
    const cy = rand(minLat + latSpan * 0.1, maxLat - latSpan * 0.1);
    const hw = rand(lngSpan * 0.03, lngSpan * 0.08);
    const hh = rand(latSpan * 0.03, latSpan * 0.08);

    const props: RealParcelProps = {
      NBIdent:          `LU${String(Math.floor(Math.random() * 90_000) + 10_000)}`,
      Nummer:           String(Math.floor(Math.random() * 9_000) + 1_000),
      EGRIS_EGRID:      `CH${Math.floor(Math.random() * 9e11 + 1e11)}`,
      Flaeche:          Math.floor(rand(150, 5_000)),
      Kanton:           'LU',
      Vollstaendigkeit: 'vollstaendig',
      _source:          'mock',
    };

    return {
      type:     'Feature' as const,
      id:       `mock-${i}`,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [cx - hw, cy - hh],
          [cx + hw, cy - hh],
          [cx + hw, cy + hh],
          [cx - hw, cy + hh],
          [cx - hw, cy - hh],
        ]],
      },
      properties: props,
    };
  });

  return { type: 'FeatureCollection', features };
}
