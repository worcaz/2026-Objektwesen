import type { ObjectInfo } from '../MapPageV2/mockData';
import { buildDummyInfo } from '../MapPageV2/mockData';

// ─── Mock history ─────────────────────────────────────────────────────────────
// A parcel's history is a deterministic list of events (Handänderung, Neubau, …),
// newest first. The state at a given Stichtag is derived from the current state by
// reverting every event that happened after that date.

export interface ParcelRef {
  nummer: string;
  egrid: string;
}

export interface HistoryEvent {
  id: string;
  /** ISO date (yyyy-mm-dd) */
  date: string;
  /** Event type, also used as filter category */
  title: string;
  description: string;
  /** Comparison row ids this event changes (matched as id === p || id.startsWith(p + '-')) */
  affects: string[];
  /** Authority that issued the change */
  stelle: string;
  /** Reference number of the underlying document */
  beleg: string;
  /** Parcels this parcel was created from (Teilung / Zusammenlegung) */
  herkunft?: ParcelRef[];
}

/** Does a change event explain a difference in the given comparison row? */
export function eventAffectsRow(ev: HistoryEvent, rowId: string): boolean {
  return ev.affects.some(p => rowId === p || rowId.startsWith(p + '-'));
}

export interface ParcelHistory {
  info: ObjectInfo;
  events: HistoryEvent[];
  /** states[0] = current state; states[i] = state before events[i-1] */
  states: ObjectInfo[];
}

/** Full object state at one Stichtag. */
export interface Snapshot {
  stichtag: string;
  /** Index into ParcelHistory.states, used to tell whether two Stichtage share the same version */
  stateIndex: number;
  info: ObjectInfo;
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
    revert: (a, alt) => ({ ...a, eigentuemer: alt.eigentuemer, erwerbsarten: alt.erwerbsarten }),
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
    title: 'Mutation (Teilung / Zusammenlegung)',
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
  {
    title: 'Umbau / Neubewertung Gebäude',
    describe: (cur, prev) =>
      `Gebäude ${cur.gebaeude[0]?.nr}: Versicherungswert ${prev.gebaeude[0]?.versicherungswert} → ${cur.gebaeude[0]?.versicherungswert}, ` +
      `Wohnungen ${prev.gebaeude[0]?.anzahlWohnungen} → ${cur.gebaeude[0]?.anzahlWohnungen}`,
    revert: (a, _alt, h) => ({
      ...a,
      gebaeude: a.gebaeude.map((g, i) => i !== 0 ? g : {
        ...g,
        versicherungswert: `CHF ${Math.round(parseArea(g.versicherungswert) * (0.7 + (h % 20) / 100) / 1000) * 1000}`
          .replace(/\B(?=(\d{3})+(?!\d))/g, "'"),
        anzahlWohnungen: String(Math.max(0, parseArea(g.anzahlWohnungen) - 1)),
      }),
    }),
    applicable: a => a.gebaeude.length > 0 && parseArea(a.gebaeude[0].anzahlWohnungen) > 0,
  },
  {
    title: 'Bauprojekt abgeschlossen',
    describe: (cur, prev) => {
      const added = cur.bauprojekte.find(p => !prev.bauprojekte.some(x => x.dossierNr === p.dossierNr));
      return added ? `Projekt «${added.bezeichnung}» (${added.dossierNr}) erfasst` : 'Bauprojekt erfasst';
    },
    revert: a => ({ ...a, bauprojekte: a.bauprojekte.slice(0, -1) }),
    applicable: a => a.bauprojekte.length > 1,
  },
  {
    title: 'Gemeindefusion / Gebietsänderung',
    describe: (cur, prev) => `Gemeinde ${prev.gemeinde} (${prev.bfsNr}) → ${cur.gemeinde} (${cur.bfsNr}), Grundbuch ${prev.grundbuchNr} → ${cur.grundbuchNr}`,
    revert: (a, alt) => ({ ...a, gemeinde: alt.gemeinde, bfsNr: alt.bfsNr, grundbuchNr: alt.grundbuchNr }),
    applicable: (a, alt) => a.gemeinde !== alt.gemeinde,
  },
  {
    title: 'Flurnamen-Anpassung',
    describe: (cur, prev) => `Flurname ${prev.flurname} → ${cur.flurname}`,
    revert: (a, alt) => ({ ...a, flurname: alt.flurname }),
    applicable: (a, alt) => a.flurname !== alt.flurname,
  },
  {
    title: 'Wechsel Nachführungsgeometer',
    describe: (cur, prev) => `${prev.nachfuehrungsgeometer.office} → ${cur.nachfuehrungsgeometer.office}`,
    revert: (a, alt) => ({ ...a, nachfuehrungsgeometer: alt.nachfuehrungsgeometer }),
    applicable: (a, alt) => a.nachfuehrungsgeometer.office !== alt.nachfuehrungsgeometer.office,
  },
  {
    title: 'Neuorganisation Grundbuchamt',
    describe: (cur, prev) => `${prev.grundbuchamtKontakt.office} → ${cur.grundbuchamtKontakt.office}`,
    revert: (a, alt) => ({ ...a, grundbuchamtKontakt: alt.grundbuchamtKontakt }),
    applicable: (a, alt) => a.grundbuchamtKontakt.office !== alt.grundbuchamtKontakt.office,
  },
  {
    title: 'Grundbuchgeschäft abgeschlossen',
    describe: (cur, prev) => `Offene Geschäfte: ${prev.offeneGeschaefte.length} → ${cur.offeneGeschaefte.length}`,
    revert: (a, alt) => ({ ...a, offeneGeschaefte: alt.offeneGeschaefte }),
    applicable: (a, alt) => a.offeneGeschaefte.join() !== alt.offeneGeschaefte.join(),
  },
  {
    title: 'Anmerkung eingetragen',
    describe: (cur, prev) => {
      const added = cur.anmerkungen.find(x => !prev.anmerkungen.includes(x));
      return added ? `Neu: ${added}` : 'Anmerkung eingetragen';
    },
    revert: a => ({ ...a, anmerkungen: a.anmerkungen.slice(0, -1) }),
    applicable: a => a.anmerkungen.length > 0,
  },
];


interface EventMeta {
  affects: string[];
  prefix: string;
  stelle: (after: ObjectInfo) => string;
}

const EVENT_META: Record<string, EventMeta> = {
  'Handänderung':                       { affects: ['owner', 'form', 'erwerb'], prefix: 'Tagebuch-Nr.', stelle: i => i.grundbuchamtKontakt.office },
  'Neubau Gebäude':                     { affects: ['geb'], prefix: 'Baubewilligung', stelle: i => `Gemeinde ${i.gemeinde}` },
  'Mutation (Teilung / Zusammenlegung)': { affects: ['flaeche'], prefix: 'Mutations-Nr.', stelle: i => i.nachfuehrungsgeometer.office },
  'Revision Nutzungsplanung':           { affects: ['zone', 'boden'], prefix: 'RRB-Nr.', stelle: i => `Gemeinde ${i.gemeinde} / Regierungsrat` },
  'Neuschätzung Katasterwert':          { affects: ['kat'], prefix: 'Schätzungs-Nr.', stelle: () => 'Dienststelle Steuern' },
  'Grundpfandrecht errichtet':          { affects: ['pfand'], prefix: 'Tagebuch-Nr.', stelle: i => i.grundbuchamtKontakt.office },
  'Dienstbarkeit begründet':            { affects: ['dienst'], prefix: 'Tagebuch-Nr.', stelle: i => i.grundbuchamtKontakt.office },
  'Umbau / Neubewertung Gebäude':       { affects: ['geb'], prefix: 'Schätzung GVL-Nr.', stelle: () => 'Gebäudeversicherung Luzern (GVL)' },
  'Bauprojekt abgeschlossen':           { affects: ['bp'], prefix: 'Baubewilligung', stelle: i => `Gemeinde ${i.gemeinde}` },
  'Gemeindefusion / Gebietsänderung':   { affects: ['gemeinde', 'gb'], prefix: 'RRB-Nr.', stelle: () => 'Kanton Luzern, Regierungsrat' },
  'Flurnamen-Anpassung':                { affects: ['flur'], prefix: 'Verfügung-Nr.', stelle: i => i.nachfuehrungsgeometer.office },
  'Wechsel Nachführungsgeometer':       { affects: ['ng'], prefix: 'Verfügung-Nr.', stelle: () => 'Amt für Geoinformation' },
  'Neuorganisation Grundbuchamt':       { affects: ['gba'], prefix: 'Verfügung-Nr.', stelle: () => 'Justiz- und Sicherheitsdepartement' },
  'Grundbuchgeschäft abgeschlossen':    { affects: ['offen'], prefix: 'Tagebuch-Nr.', stelle: i => i.grundbuchamtKontakt.office },
  'Anmerkung eingetragen':              { affects: ['anm'], prefix: 'Tagebuch-Nr.', stelle: i => i.grundbuchamtKontakt.office },
};

export function buildHistory(info: ObjectInfo): ParcelHistory {
  const seed = info.egrid + info.grundstueckNummer;
  const h = hashStr(seed);

  // Event dates, newest first, strictly decreasing.
  const eventCount = 7 + (h % 4);
  let year = new Date().getFullYear() - 1 - (h % 2);
  const dates: string[] = [];
  for (let i = 0; i < eventCount; i++) {
    const hh = hashStr(seed + 'd' + i);
    dates.push(`${year}-${pad(1 + (hh % 12))}-${pad(1 + ((hh >> 3) % 28))}`);
    year -= 1 + (hh % 4);
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
    if (idx === -1) idx = 2; // Mutation is always applicable (may repeat)
    used.add(idx);
    const tpl = TEMPLATES[idx];
    const before = tpl.revert(after, alt, hashStr(seed + 'r' + i));
    const meta = EVENT_META[tpl.title];
    const hr = hashStr(seed + 'b' + i);
    const nummerNum = parseInt(info.grundstueckNummer, 10) || 1000;
    const herkunft: ParcelRef[] | undefined = tpl.title.startsWith('Mutation')
      ? Array.from({ length: 1 + (hr % 2) }, (_, k) => ({
          nummer: String(Math.max(1, nummerNum - 1 - k - (hr % 7))),
          egrid: `CH${String(hashStr(`${seed}-origin-${i}-${k}`) % 1000000000000).padStart(12, '0')}`,
        }))
      : undefined;
    const baseDescription = tpl.describe(after, before);
    events.push({
      id: `${seed}-${i}`,
      date,
      title: tpl.title,
      description: herkunft
        ? `${baseDescription} · entstanden aus Nr. ${herkunft.map(p => p.nummer).join(' und ')}`
        : baseDescription,
      affects: meta.affects,
      stelle: meta.stelle(after),
      beleg: `${meta.prefix} ${date.slice(0, 4)}/${100 + (hr % 9000)}`,
      herkunft,
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
  return { stichtag: isoDate, stateIndex, info: history.states[stateIndex] };
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

/** Events that happened after `from` and up to (including) `to` (ISO dates). */
export function eventsBetween(history: ParcelHistory, from: string, to: string): HistoryEvent[] {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return history.events.filter(e => e.date > lo && e.date <= hi);
}
