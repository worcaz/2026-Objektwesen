import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { LuMinus, LuPlus, LuX } from 'react-icons/lu';
import { SlLayers } from 'react-icons/sl';

function CustomZoomControl() {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
  }, []);

  return (
    <div ref={containerRef} className="zoom-control">
      <button type="button" aria-label="Zoom in" className="zoom-btn zoom-btn--top" onClick={() => map.zoomIn()}>
        <LuPlus size={16} />
      </button>
      <button type="button" aria-label="Zoom out" className="zoom-btn" onClick={() => map.zoomOut()}>
        <LuMinus size={16} />
      </button>
    </div>
  );
}

function MapLayerSelectorControl({
  showAmtlicheVermessung,
  onToggleAmtlicheVermessung,
  amtlicheVermessungOpacity,
  onChangeAmtlicheVermessungOpacity,
  showLuftbild,
  onToggleLuftbild,
  luftbildOpacity,
  onChangeLuftbildOpacity,
  showWaldgrenzen,
  onToggleWaldgrenzen,
  waldgrenzenOpacity,
  onChangeWaldgrenzenOpacity,
  showNutzungsplanung,
  onToggleNutzungsplanung,
  nutzungsplanungOpacity,
  onChangeNutzungsplanungOpacity,
  showGefahrenkarte,
  onToggleGefahrenkarte,
  gefahrenkarteOpacity,
  onChangeGefahrenkarteOpacity,
  open,
  onOpenChange,
}: {
  showAmtlicheVermessung: boolean;
  onToggleAmtlicheVermessung: (next: boolean) => void;
  amtlicheVermessungOpacity: number;
  onChangeAmtlicheVermessungOpacity: (next: number) => void;
  showLuftbild: boolean;
  onToggleLuftbild: (next: boolean) => void;
  luftbildOpacity: number;
  onChangeLuftbildOpacity: (next: number) => void;
  showWaldgrenzen: boolean;
  onToggleWaldgrenzen: (next: boolean) => void;
  waldgrenzenOpacity: number;
  onChangeWaldgrenzenOpacity: (next: number) => void;
  showNutzungsplanung: boolean;
  onToggleNutzungsplanung: (next: boolean) => void;
  nutzungsplanungOpacity: number;
  onChangeNutzungsplanungOpacity: (next: number) => void;
  showGefahrenkarte: boolean;
  onToggleGefahrenkarte: (next: boolean) => void;
  gefahrenkarteOpacity: number;
  onChangeGefahrenkarteOpacity: (next: number) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMapClick = (event: L.LeafletMouseEvent) => {
      const originalTarget = event.originalEvent?.target;
      if (originalTarget instanceof Node && containerRef.current?.contains(originalTarget)) {
        return;
      }

      onOpenChange(false);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, onOpenChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only disable scroll propagation — disableClickPropagation would prevent React onClick from firing
    L.DomEvent.disableScrollPropagation(container);

    const stopPropagation = (event: Event) => {
      event.stopPropagation();
    };

    // Do NOT include 'click' here — stopping click propagation at the container level prevents
    // the native event from reaching React's root listener, so the button onClick would never fire.
    const eventNames: Array<keyof HTMLElementEventMap> = ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'dblclick'];
    eventNames.forEach((eventName) => container.addEventListener(eventName, stopPropagation));

    return () => {
      eventNames.forEach((eventName) => container.removeEventListener(eventName, stopPropagation));
    };
  }, []);

  const renderLayerRow = (
    label: string,
    checked: boolean,
    onToggle: (next: boolean) => void,
    opacity: number,
    onOpacityChange: (next: number) => void,
  ) => (
    <div className="layer-row">
      <label className="layer-row__label">
        <span>{label}</span>
        {/* Toggle switch */}
        <span
          role="switch"
          aria-checked={checked}
          onClick={() => onToggle(!checked)}
          className="toggle-switch"
          style={{ background: checked ? '#009fe3' : '#d1d5db' }}
        >
          <span className={`toggle-thumb${checked ? ' toggle-thumb--on' : ''}`} />
        </span>
      </label>

      <div className="layer-opacity-control" style={{ opacity: checked ? 1 : 0.45 }}>
        <div className="layer-opacity-header">
          <span>Transparenz</span>
          <span>{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(opacity * 100)}
          onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
          disabled={!checked}
          className="layer-range"
        />
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="layer-selector">
      {open && (
        <div className="layer-panel">
          <div className="layer-panel__title">Karteninhalt</div>

          {renderLayerRow(
            'Amtliche Vermessung',
            showAmtlicheVermessung,
            onToggleAmtlicheVermessung,
            amtlicheVermessungOpacity,
            onChangeAmtlicheVermessungOpacity,
          )}
          {renderLayerRow(
            'Luftbild AG / ZG / ZH / LU',
            showLuftbild,
            onToggleLuftbild,
            luftbildOpacity,
            onChangeLuftbildOpacity,
          )}
          {renderLayerRow(
            'Statische Waldgrenzen',
            showWaldgrenzen,
            onToggleWaldgrenzen,
            waldgrenzenOpacity,
            onChangeWaldgrenzenOpacity,
          )}
          {renderLayerRow(
            'Nutzungsplanung',
            showNutzungsplanung,
            onToggleNutzungsplanung,
            nutzungsplanungOpacity,
            onChangeNutzungsplanungOpacity,
          )}
          {renderLayerRow(
            'Gefahrenkarte',
            showGefahrenkarte,
            onToggleGefahrenkarte,
            gefahrenkarteOpacity,
            onChangeGefahrenkarteOpacity,
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? 'Karteninhalt schliessen' : 'Karteninhalt öffnen'}
        title={open ? 'Karteninhalt schliessen' : 'Karteninhalt öffnen'}
        className="layer-toggle-btn"
      >
        {open ? <LuX size={18} /> : <SlLayers size={16} />}
      </button>
    </div>
  );
}

export { CustomZoomControl };
export default MapLayerSelectorControl;
