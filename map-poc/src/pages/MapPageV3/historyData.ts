import type { ObjectInfo } from '../MapPageV2/mockData';
import { buildDummyInfo } from '../MapPageV2/mockData';

// ─── Mock history ─────────────────────────────────────────────────────────────
// A parcel's history is a deterministic list of events (Handänderung, Neubau, …),
// newest first. The state at a given Stichtag is derived from the current state by
// reverting every event that happened after that date.

export interface HistoryEvent {
  id: string;
  /** ISO date (yyyy-mm-dd) */
  date: string;
  title: string;
  description: string;
}

export interface ParcelHistory {
  info: ObjectInfo;
  events: HistoryEvent[];
  /** states[0] = current state; states[i] = state before events[i-1] */
  states: ObjectInfo[];
}

/** Comparable, display-ready snapshot of one Stichtag. */
export interface Snapshot {
  stichtag: string;
  flaeche: string;
  grundstueckArt: string;
  eigentumsform: string;
  eigentuemer: string[];
  katasterwert: string;
  zonenplan: string[];
  bodenbedeckung: string[];
  gebaeude: string[];
  dienstbarkeiten: string[];
  grundpfandrechte: string[];
  anmerkungen: string[];
  /** Index into ParcelHistory.states, used to label the version */
  stateIndex: number;
}

export const TODAY_ISO = new Date().toISOString().slice(0, 10);
const EARLIEST_YEAR = 1992;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseArea(a: string): number {
  return Number(a.replace(/[^\d]/g, '')) || 0;
}
const formatArea = (n: number) => `${Math.max(50, Math.round(n)).toLocaleString('de-CH')} m²`;

interface EventTemplate {
  title: string;
  describe: (cur: ObjectInfo, prev: ObjectInfo) => string;
  /** Returns the state *before* the event, given the state after it. */
  revert: (after: ObjectInfo, alt: ObjectInfo, h: number) => ObjectInfo;
  applicable: (after: ObjectInfo, alt: ObjectInfo) => boolean;
}

const ownerNames = (i: ObjectInfo) =>
  (i.eigentuemer.beteiligungen
    ? i.eigentuemer.beteiligungen.flatMap(b => b.parteien.map(p => p.name))
    : i.eigentuemer.parteien.map(p => p.name)
  ).filter((n, idx, arr) => arr.indexOf(n) === idx);

const TEMPLATES: EventTemplate[] = [
  {
    title: 'Handänderung',
    describe: (cur, prev) => `Eigentümerwechsel: ${ownerNames(prev).join(', ') || '–'} → ${ownerNames(cur).join(', ') || '–'}`,
    revert: (a, alt) => ({ ...a, eigentuemer: alt.eigentuemer }),
    applicable: (a, alt) => ownerNames(a).join() !== ownerNames(alt).join(),
  },
  {
    title: 'Neubau Gebäude',
    describe: (cur, prev) => {
      const added = cur.gebaeude.find(g => !prev.gebaeude.some(p => p.nr === g.nr));
      return added ? `${added.gebaeudekategorie} (${added.nr}) erstellt, Baujahr ${added.baujahrBauperiode}` : 'Gebäude erstellt';
    },
    revert: a => ({ ...a, gebaeude: a.gebaeude.slice(0, -1) }),
    applicable: a => a.gebaeude.length > 1,
  },
  {
    title: 'Mutation (Flächenänderung)',
    describe: (cur, prev) => `Grundstücksfläche ${prev.flaecheGrundbuch} → ${cur.flaecheGrundbuch}`,
    revert: (a, _alt, h) => {
      const factor = 1.07 + (h % 18) / 100;
      return { ...a, flaecheGrundbuch: formatArea(parseArea(a.flaecheGrundbuch) * factor) };
    },
    applicable: () => true,
  },
  {
    title: 'Revision Nutzungsplanung',
    describe: (cur, prev) =>
      `Grundnutzung: ${prev.grundnutzungZonenplan.map(z => z.zonentyp).join(', ')} → ${cur.grundnutzungZonenplan.map(z => z.zonentyp).join(', ')}`,
    revert: (a, alt) => ({ ...a, grundnutzungZonenplan: alt.grundnutzungZonenplan, bodenbedeckung: alt.bodenbedeckung }),
    applicable: (a, alt) =>
      a.grundnutzungZonenplan.map(z => z.zonentyp).join() !== alt.grundnutzungZonenplan.map(z => z.zonentyp).join(),
  },
  {
    title: 'Neuschätzung Katasterwert',
    describe: (cur, prev) => `Katasterwert ${prev.katasterwert} → ${cur.katasterwert}`,
    revert: (a, alt) => ({ ...a, katasterwert: alt.katasterwert }),
    applicable: (a, alt) => a.katasterwert !== alt.katasterwert,
  },
  {
    title: 'Grundpfandrecht errichtet',
    describe: (cur, prev) => {
      const added = cur.grundpfandrechte.find(g => !prev.grundpfandrechte.includes(g));
      return added ? `Neu: ${added}` : 'Grundpfandrecht errichtet';
    },
    revert: a => ({ ...a, grundpfandrechte: a.grundpfandrechte.slice(0, -1) }),
    applicable: a => a.grundpfandrechte.length > 0,
  },
  {
    title: 'Dienstbarkeit begründet',
    describe: (cur, prev) => {
      const added = cur.dienstbarkeiten.find(d => !prev.dienstbarkeiten.includes(d));
      return added ? `Neu: ${added}` : 'Dienstbarkeit begründet';
    },
    revert: a => ({ ...a, dienstbarkeiten: a.dienstbarkeiten.slice(0, -1) }),
    applicable: a => a.dienstbarkeiten.length > 0,
  },
];

export function buildHistory(info: ObjectInfo): ParcelHistory {
  const seed = info.egrid + info.grundstueckNummer;
  const h = hashStr(seed);

  // Event dates, newest first, strictly decreasing.
  const eventCount = 4 + (h % 3);
  let year = new Date().getFullYear() - 1 - (h % 2);
  const dates: string[] = [];
  for (let i = 0; i < eventCount; i++) {
    const hh = hashStr(seed + 'd' + i);
    dates.push(`${year}-${pad(1 + (hh % 12))}-${pad(1 + ((hh >> 3) % 28))}`);
    year -= 2 + (hh % 5);
    if (year < EARLIEST_YEAR) break;
  }

  const states: ObjectInfo[] = [info];
  const events: HistoryEvent[] = [];
  const used = new Set<number>();

  dates.forEach((date, i) => {
    const after = states[i];
    const alt = buildDummyInfo(`${seed}-alt-${i}`);
    let idx = (h + i * 3) % TEMPLATES.length;
    for (let tries = 0; tries < TEMPLATES.length; tries++) {
      const cand = (idx + tries) % TEMPLATES.length;
      if (!used.has(cand) && TEMPLATES[cand].applicable(after, alt)) { idx = cand; break; }
      if (tries === TEMPLATES.length - 1) idx = -1;
    }
    if (idx === -1) idx = 2; // Mutation is always applicable
    used.add(idx);
    const tpl = TEMPLATES[idx];
    const before = tpl.revert(after, alt, hashStr(seed + 'r' + i));
    events.push({
      id: `${seed}-${i}`,
      date,
      title: tpl.title,
      description: tpl.describe(after, before),
    });
    states.push(before);
  });

  return { info, events, states };
}

/** Index of the state that was valid on the given ISO date. */
export function stateIndexAt(history: ParcelHistory, isoDate: string): number {
  let idx = 0;
  for (let i = 0; i < history.events.length; i++) {
    if (history.events[i].date > isoDate) idx = i + 1; // event happened after Stichtag → revert it
    else break;
  }
  return idx;
}

export function snapshotAt(history: ParcelHistory, isoDate: string): Snapshot {
  const stateIndex = stateIndexAt(history, isoDate);
  const s = history.states[stateIndex];
  return {
    stichtag: isoDate,
    stateIndex,
    flaeche: s.flaecheGrundbuch,
    grundstueckArt: s.grundstueckArt,
    eigentumsform: s.eigentuemer.eigentumsform,
    eigentuemer: ownerNames(s),
    katasterwert: s.katasterwert,
    zonenplan: s.grundnutzungZonenplan.map(z => `${z.zonentyp} (${z.flaeche})`),
    bodenbedeckung: s.bodenbedeckung.map(b => `${b.label} (${b.area})`),
    gebaeude: s.gebaeude.map(g => `${g.gebaeudekategorie} ${g.nr}, Bj. ${g.baujahrBauperiode}`),
    dienstbarkeiten: s.dienstbarkeiten,
    grundpfandrechte: s.grundpfandrechte,
    anmerkungen: s.anmerkungen,
  };
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function yearsAgoIso(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export const MIN_STICHTAG = `${EARLIEST_YEAR - 5}-01-01`;
