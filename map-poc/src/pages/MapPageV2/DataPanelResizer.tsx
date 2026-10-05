import {
  DATA_PANEL_MIN_WIDTH, DATA_PANEL_DEFAULT_WIDTH, clampDataPanelWidth,
} from './viewMode';

const DATA_PANEL_KEYBOARD_STEP = 24;

/** Drag handle on the right edge of the data-view side panel. */
export default function DataPanelResizer({
  width, onResize, onDragChange,
}: { width: number; onResize: (w: number) => void; onDragChange: (dragging: boolean) => void }) {
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    onDragChange(true);
    const move = (ev: PointerEvent) => onResize(clampDataPanelWidth(ev.clientX));
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      onDragChange(false);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  return (
    <div
      className="data-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite des Datenpanels ändern"
      aria-valuenow={width}
      aria-valuemin={DATA_PANEL_MIN_WIDTH}
      tabIndex={0}
      onPointerDown={startDrag}
      onDoubleClick={() => onResize(clampDataPanelWidth(DATA_PANEL_DEFAULT_WIDTH))}
      onKeyDown={e => {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); onResize(clampDataPanelWidth(width - DATA_PANEL_KEYBOARD_STEP)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onResize(clampDataPanelWidth(width + DATA_PANEL_KEYBOARD_STEP)); }
      }}
    />
  );
}
