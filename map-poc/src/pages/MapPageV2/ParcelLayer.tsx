import { useState, useEffect, useRef, useCallback } from 'react';
import { GeoJSON as GeoJSONLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import type { RealParcelProps } from '../../wfsService';
import {
  fetchParcelsByBbox,
  buildMockFeatures,
  MIN_ZOOM_FOR_PARCELS,
} from '../../wfsService';

const DESKTOP_AUTO_CENTER_MIN_WIDTH = 1024;
const INFO_PANEL_DESKTOP_WIDTH = 520;
const INFO_PANEL_LEFT_MARGIN = 24;

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

function autoCenterParcelOnDesktop(map: L.Map, latlng: L.LatLng): boolean {
  if (typeof window === 'undefined' || window.innerWidth < DESKTOP_AUTO_CENTER_MIN_WIDTH) return false;

  const size = map.getSize();
  const panelWidth = Math.min(INFO_PANEL_DESKTOP_WIDTH, Math.max(0, size.x - (INFO_PANEL_LEFT_MARGIN * 2)));
  const visibleStartX = INFO_PANEL_LEFT_MARGIN + panelWidth;

  if (panelWidth <= 0 || size.x <= visibleStartX + 120) return false;

  const targetPoint = L.point(visibleStartX + ((size.x - visibleStartX) / 2), size.y / 2);
  const currentPoint = map.latLngToContainerPoint(latlng);
  const delta = currentPoint.subtract(targetPoint);

  if (Math.abs(delta.x) < 6 && Math.abs(delta.y) < 6) return false;

  const nextCenterPoint = map.project(map.getCenter(), map.getZoom()).add(delta);
  const nextCenter = map.unproject(nextCenterPoint, map.getZoom());
  map.panTo(nextCenter, { animate: true, duration: 0.35 });
  return true;
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
  hasOpenInfoPanel: boolean;
}

function ParcelLayer({ onFeatureSelect, onLoadingChange, onError, onZoomChange, hasOpenInfoPanel }: ParcelLayerProps) {
  const map = useMap();

  const [parcels,  setParcels]  = useState<FeatureCollection | null>(null);
  // Key increments each time new data arrives, forcing GeoJSONLayer to remount.
  const [layerKey, setLayerKey] = useState(0);

  // Tracks the Leaflet Path layer that is currently highlighted.
  // Direct mutation avoids a React re-render on every click.
  const highlightedRef = useRef<L.Path | null>(null);

  // AbortController so panning quickly cancels the previous in-flight request.
  const abortRef = useRef<AbortController | null>(null);
  const skipNextMoveLoadRef = useRef(false);

  // Keep the latest callback props in a ref so event handlers never go stale.
  const cbRef = useRef({ onFeatureSelect, onLoadingChange, onError, onZoomChange, hasOpenInfoPanel });
  useEffect(() => {
    cbRef.current = { onFeatureSelect, onLoadingChange, onError, onZoomChange, hasOpenInfoPanel };
  });

  // Stable async function — recreated only when `map` changes (never in practice).
  const loadParcels = useCallback(async () => {
    const zoom  = map.getZoom();
    const { onFeatureSelect, onLoadingChange, onError, onZoomChange } = cbRef.current;

    onZoomChange(zoom);

    if (zoom < MIN_ZOOM_FOR_PARCELS) {
      setParcels(null);
      return;
    }

    // Cancel any outstanding request before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    onLoadingChange(true);
    onError(null);
    highlightedRef.current = null; // clear stale ref before data changes

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

    const handler = () => {
      if (skipNextMoveLoadRef.current) {
        skipNextMoveLoadRef.current = false;
        return;
      }
      void loadParcels();
    };
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
    layer.on('click', (event: L.LeafletMouseEvent) => {
      // Reset the previously highlighted polygon.
      if (highlightedRef.current) {
        highlightedRef.current.setStyle(VECTOR_STYLE);
      }
      // Highlight the clicked polygon.
      (layer as L.Path).setStyle(VECTOR_HIGHLIGHT_STYLE);
      highlightedRef.current = layer as L.Path;

      if (!cbRef.current.hasOpenInfoPanel) {
        const didAutoCenter = autoCenterParcelOnDesktop(map, event.latlng);
        if (didAutoCenter) {
          skipNextMoveLoadRef.current = true;
        }
      }

      // Notify parent to show the info box.
      cbRef.current.onFeatureSelect(feature.properties as RealParcelProps);
    });
  }, [map]);

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

export default ParcelLayer;
