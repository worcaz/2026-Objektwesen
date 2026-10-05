export type ViewMode = 'map' | 'hybrid' | 'data';

export const VIEW_MODE_STORAGE_KEY = 'objektwesen.viewMode';

export function isViewMode(v: unknown): v is ViewMode {
  return v === 'map' || v === 'hybrid' || v === 'data';
}

/** Desktop width (px) of the object info panel per view mode. */
export const INFO_PANEL_DESKTOP_WIDTH: Record<ViewMode, number> = {
  map: 360,
  hybrid: 520,
  data: 640,
};

export const DATA_PANEL_WIDTH_STORAGE_KEY = 'objektwesen.dataPanelWidth';
export const DATA_PANEL_MIN_WIDTH = 360;
export const DATA_PANEL_DEFAULT_WIDTH = 760;
/** Max share of the viewport the data panel may take (keep in sync with MapPageV2.css). */
export const DATA_PANEL_MAX_VW = 0.8;

export function clampDataPanelWidth(w: number): number {
  const max = Math.max(DATA_PANEL_MIN_WIDTH, Math.floor(window.innerWidth * DATA_PANEL_MAX_VW));
  return Math.min(max, Math.max(DATA_PANEL_MIN_WIDTH, Math.round(w)));
}
