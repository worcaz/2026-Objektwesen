import type { ObjectInfo, ContactInfo, BuildingInfo, ProjectInfo } from '../MapPageV2/mockData';

// Turns N object states into comparable rows, grouped like the info panel
// (Stammdaten, Grundstück, Gebäude, Bauprojekte, Zuständige Stellen).

export interface Cell {
  lines: string[];
  /** Entity (e.g. a building) did not exist at this Stichtag */
  absent?: boolean;
}

export interface CmpRow {
  id: string;
  label: string;
  /** scalar: one value; list: items are diffed individually; sub: sub-heading row without cells */
  kind: 'scalar' | 'list' | 'sub';
  cells: Cell[];
}

export interface CmpGroup {
  id: string;
  title: string;
  rows: CmpRow[];
}

const dash = (s: string) => (s && s.trim() ? s : '–');

function scalar(id: string, label: string, infos: ObjectInfo[], get: (i: ObjectInfo) => string): CmpRow {
  return { id, label, kind: 'scalar', cells: infos.map(i => ({ lines: [dash(get(i))] })) };
}

function list(id: string, label: string, infos: ObjectInfo[], get: (i: ObjectInfo) => string[]): CmpRow {
  return { id, label, kind: 'list', cells: infos.map(i => ({ lines: get(i) })) };
}

function ownerLines(i: ObjectInfo): string[] {
  const e = i.eigentuemer;
  if (e.beteiligungen?.length) {
    return e.beteiligungen.flatMap(b =>
      b.parteien.map(p => `${p.name} – ${b.grundstueck}${b.anteil ? ` (${b.anteil})` : ''}`),
    );
  }
  return e.parteien.map(p => p.name);
}

function contactRows(prefix: string, infos: ObjectInfo[], get: (i: ObjectInfo) => ContactInfo): CmpRow[] {
  const c = (id: string, label: string, f: (c: ContactInfo) => string) =>
    scalar(`${prefix}-${id}`, label, infos, i => f(get(i)));
  return [
    c('office', 'Stelle', x => x.office),
    c('person', 'Kontaktperson', x => x.person),
    c('addr', 'Adresse', x => `${x.street}, ${x.city}`),
    c('phone', 'Telefon', x => x.phone),
    c('mail', 'E-Mail', x => x.email),
    c('web', 'Website', x => x.website),
  ];
}

/** One sub-heading plus attribute rows per entity, entities matched across Stichtage by key. */
function entityRows<T>(
  prefix: string,
  infos: ObjectInfo[],
  getAll: (i: ObjectInfo) => T[],
  key: (t: T) => string,
  heading: (t: T) => string,
  attrs: { label: string; get: (t: T) => string }[],
): CmpRow[] {
  const keys: string[] = [];
  const firstSeen = new Map<string, T>();
  for (const info of infos) {
    for (const t of getAll(info)) {
      const k = key(t);
      if (!firstSeen.has(k)) { firstSeen.set(k, t); keys.push(k); }
    }
  }
  const rows: CmpRow[] = [];
  for (const k of keys) {
    rows.push({ id: `${prefix}-${k}-h`, label: heading(firstSeen.get(k)!), kind: 'sub', cells: [] });
    attrs.forEach((a, idx) => {
      rows.push({
        id: `${prefix}-${k}-${idx}`,
        label: a.label,
        kind: 'scalar',
        cells: infos.map(info => {
          const t = getAll(info).find(x => key(x) === k);
          return t ? { lines: [dash(a.get(t))] } : { lines: [], absent: true };
        }),
      });
    });
  }
  return rows;
}

export function buildGroups(infos: ObjectInfo[]): CmpGroup[] {
  const stammdaten: CmpRow[] = [
    scalar('nr', 'Grundstücknummer', infos, i => i.grundstueckNummer),
    scalar('egrid', 'EGRID', infos, i => i.egrid),
    scalar('gemeinde', 'Gemeinde (BFS-Nr.)', infos, i => `${i.gemeinde} (${i.bfsNr})`),
    scalar('gb', 'Grundbuch (GB-Nr.)', infos, i => i.grundbuchNr),
    scalar('art', 'Grundstückart', infos, i => i.grundstueckArt),
    scalar('flur', 'Flurnamen', infos, i => i.flurname),
    list('boden', 'Bodenbedeckung', infos, i => i.bodenbedeckung.map(b => `${b.label} (${b.area})`)),
    scalar('flaeche', 'Fläche (grundbuchlich)', infos, i => i.flaecheGrundbuch),
    list('zone', 'Grundnutzung Zonenplan', infos, i =>
      i.grundnutzungZonenplan.map(z => `${z.zonentyp} – ${z.gemeinde} (${z.flaeche}, ${z.anteil})`)),
  ];

  const grundstueck: CmpRow[] = [
    list('owner', 'Eigentümer', infos, ownerLines),
    scalar('form', 'Eigentumsform', infos, i => i.eigentuemer.eigentumsform),
    scalar('kat', 'Katasterwert', infos, i => i.katasterwert),
    list('dienst', 'Dienstbarkeiten / Grundlasten', infos, i => i.dienstbarkeiten),
    list('anm', 'Anmerkungen', infos, i => i.anmerkungen),
    list('pfand', 'Grundpfandrechte', infos, i => i.grundpfandrechte),
    list('erwerb', 'Erwerbsarten', infos, i => i.erwerbsarten),
    list('offen', 'Offene Geschäfte', infos, i => i.offeneGeschaefte),
  ];

  const gebaeude = entityRows<BuildingInfo>(
    'geb', infos, i => i.gebaeude, g => `${g.nr}|${g.egid}`,
    g => `Gebäude ${g.nr}`,
    [
      { label: 'Kategorie',            get: g => g.gebaeudekategorie },
      { label: 'Status',               get: g => g.gebaeudestatus },
      { label: 'Baujahr / Bauperiode', get: g => g.baujahrBauperiode },
      { label: 'Adresse',              get: g => g.adresse },
      { label: 'EGID',                 get: g => g.egid },
      { label: 'Versicherungs-Nr.',    get: g => g.versicherungsNr },
      { label: 'Versicherungswert',    get: g => g.versicherungswert },
      { label: 'Anzahl Wohnungen',     get: g => g.anzahlWohnungen },
      { label: 'Koordinaten',          get: g => g.koordinaten },
      { label: 'Verwaltung',           get: g => g.verwaltungGebaeude },
    ],
  );

  const bauprojekte = entityRows<ProjectInfo>(
    'bp', infos, i => i.bauprojekte, p => p.dossierNr,
    p => `Dossier ${p.dossierNr}`,
    [
      { label: 'Bezeichnung',               get: p => p.bezeichnung },
      { label: 'Status',                    get: p => p.status },
      { label: 'Amtl. Baudossier-Nr.',      get: p => p.amtlicheBaudossierNr },
      { label: 'Eidg. Projekt-ID',          get: p => p.eidgProjektidentifikator },
      { label: 'Projektierte Wohnungen',    get: p => p.anzahlProjektierteWohnungen },
      { label: 'Art der Arbeiten',          get: p => p.artDerArbeiten },
      { label: 'Art der Bauwerke',          get: p => p.artDerBauwerke },
      { label: 'Typ der Bauwerke',          get: p => p.typDerBauwerke },
    ],
  );

  const stellen: CmpRow[] = [
    { id: 'ng-h', label: 'Nachführungsgeometer', kind: 'sub', cells: [] },
    ...contactRows('ng', infos, i => i.nachfuehrungsgeometer),
    { id: 'gba-h', label: 'Grundbuchamt', kind: 'sub', cells: [] },
    ...contactRows('gba', infos, i => i.grundbuchamtKontakt),
  ];

  return [
    { id: 'stamm',  title: 'Stammdaten',         rows: stammdaten },
    { id: 'gs',     title: 'Grundstück',         rows: grundstueck },
    { id: 'geb',    title: 'Gebäude',            rows: gebaeude },
    { id: 'bp',     title: 'Bauprojekte',        rows: bauprojekte },
    { id: 'stellen', title: 'Zuständige Stellen', rows: stellen },
  ];
}

/** Does this cell differ from the base cell? */
export function cellChanged(cell: Cell, base: Cell): boolean {
  return Boolean(cell.absent) !== Boolean(base.absent) || cell.lines.join('\n') !== base.lines.join('\n');
}

export function rowChanged(row: CmpRow, baseIdx: number): boolean {
  if (row.kind === 'sub') return false;
  return row.cells.some((c, i) => i !== baseIdx && cellChanged(c, row.cells[baseIdx]));
}
