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
