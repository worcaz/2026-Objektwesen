import type { ParcelRef } from './historyData';
import { TODAY_ISO } from './historyData';
import type { ViewMode } from '../MapPageV2/viewMode';
import { isViewMode } from '../MapPageV2/viewMode';

export type CompareMode = 'zeit' | 'parzellen';

export interface ShareState {
  parcels: ParcelRef[];
  mode: CompareMode;
  dates: string[];
  baseDate: string;
  pDate: string;
  view?: ViewMode;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const refToStr = (r: ParcelRef) => `${r.nummer}~${r.egrid}`;
const strToRef = (s: string): ParcelRef | null => {
  const [nummer, egrid] = s.split('~');
  return nummer && egrid ? { nummer, egrid } : null;
};

export function serializeState(s: ShareState): string {
  const p = new URLSearchParams();
  if (s.parcels.length) p.set('gs', s.parcels.map(refToStr).join(','));
  p.set('m', s.mode === 'zeit' ? 'z' : 'p');
  p.set('d', s.dates.join(','));
  p.set('b', s.baseDate);
  if (s.mode === 'parzellen') p.set('pd', s.pDate);
  if (s.view) p.set('v', s.view);
  return p.toString();
}

export function parseState(search: string): Partial<ShareState> {
  const p = new URLSearchParams(search);
  const out: Partial<ShareState> = {};
  const gs = p.get('gs');
  if (gs) {
    const parcels = gs.split(',').map(strToRef).filter((r): r is ParcelRef => r !== null).slice(0, 4);
    if (parcels.length) out.parcels = parcels;
  }
  const m = p.get('m');
  if (m === 'z' || m === 'p') out.mode = m === 'z' ? 'zeit' : 'parzellen';
  const d = p.get('d');
  if (d) {
    const dates = d.split(',').filter(x => ISO.test(x) && x <= TODAY_ISO).slice(0, 4);
    if (dates.length) out.dates = dates;
  }
  const b = p.get('b');
  if (b && ISO.test(b)) out.baseDate = b;
  const pd = p.get('pd');
  if (pd && ISO.test(pd)) out.pDate = pd;
  const v = p.get('v');
  if (isViewMode(v)) out.view = v;
  return out;
}
