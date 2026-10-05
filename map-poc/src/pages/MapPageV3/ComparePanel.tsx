import { useMemo, useState } from 'react';
import { LuCalendarPlus, LuX, LuHistory } from 'react-icons/lu';
import type { ObjectInfo } from '../MapPageV2/mockData';
import type { Snapshot } from './historyData';
import {
  TODAY_ISO, MIN_STICHTAG, buildHistory, snapshotAt, formatDate, yearsAgoIso,
} from './historyData';

const MAX_COLUMNS = 4;
const PRESETS = [1, 5, 10, 20, 30];

type RowDef =
  | { key: keyof Snapshot; label: string; kind: 'scalar' }
  | { key: keyof Snapshot; label: string; kind: 'list' };

const ROWS: RowDef[] = [
  { key: 'eigentuemer',      label: 'Eigentümer',          kind: 'list' },
  { key: 'eigentumsform',    label: 'Eigentumsform',       kind: 'scalar' },
  { key: 'flaeche',          label: 'Fläche (Grundbuch)',  kind: 'scalar' },
  { key: 'grundstueckArt',   label: 'Grundstückart',       kind: 'scalar' },
  { key: 'katasterwert',     label: 'Katasterwert',        kind: 'scalar' },
  { key: 'zonenplan',        label: 'Grundnutzung',        kind: 'list' },
  { key: 'bodenbedeckung',   label: 'Bodenbedeckung',      kind: 'list' },
  { key: 'gebaeude',         label: 'Gebäude',             kind: 'list' },
  { key: 'dienstbarkeiten',  label: 'Dienstbarkeiten',     kind: 'list' },
  { key: 'grundpfandrechte', label: 'Grundpfandrechte',    kind: 'list' },
  { key: 'anmerkungen',      label: 'Anmerkungen',         kind: 'list' },
];

function asList(v: Snapshot[keyof Snapshot]): string[] {
  return Array.isArray(v) ? v : [String(v)];
}

function CompareCell({ row, snap, base, isBase }: { row: RowDef; snap: Snapshot; base: Snapshot; isBase: boolean }) {
  if (row.kind === 'scalar') {
    const val = String(snap[row.key]);
    const changed = !isBase && val !== String(base[row.key]);
    return <td className={changed ? 'cmp-cell cmp-cell--changed' : 'cmp-cell'}>{val}</td>;
  }
  const items = asList(snap[row.key]);
  const baseItems = asList(base[row.key]);
  const removed = isBase ? [] : baseItems.filter(i => !items.includes(i));
  const hasChange = !isBase && (removed.length > 0 || items.some(i => !baseItems.includes(i)));
  return (
    <td className={hasChange ? 'cmp-cell cmp-cell--changed' : 'cmp-cell'}>
      {items.length === 0 && removed.length === 0 && <span className="cmp-empty">–</span>}
      {items.map(i => (
        <div key={i} className={!isBase && !baseItems.includes(i) ? 'cmp-item cmp-item--added' : 'cmp-item'}>{i}</div>
      ))}
      {removed.map(i => (
        <div key={i} className="cmp-item cmp-item--removed" title="Im Vergleichsstand vorhanden, hier nicht">{i}</div>
      ))}
    </td>
  );
}

export default function ComparePanel({ info }: { info: ObjectInfo }) {
  const history = useMemo(() => buildHistory(info), [info]);

  const [dates, setDates] = useState<string[]>([TODAY_ISO, yearsAgoIso(10)]);
  const [baseDate, setBaseDate] = useState<string>(TODAY_ISO);
  const [pickDate, setPickDate] = useState('');
  const [onlyChanges, setOnlyChanges] = useState(false);

  const sorted = useMemo(() => [...new Set(dates)].sort().reverse(), [dates]);
  const effectiveBase = sorted.includes(baseDate) ? baseDate : sorted[0];
  const snaps = useMemo(() => sorted.map(d => snapshotAt(history, d)), [sorted, history]);
  const base = snaps[sorted.indexOf(effectiveBase)];

  const addDate = (iso: string) => {
    if (!iso || iso > TODAY_ISO || iso < MIN_STICHTAG) return;
    setDates(prev => (prev.includes(iso) || prev.length >= MAX_COLUMNS ? prev : [...prev, iso]));
  };
  const removeDate = (iso: string) => setDates(prev => (prev.length > 1 ? prev.filter(d => d !== iso) : prev));
  const full = sorted.length >= MAX_COLUMNS;

  const visibleRows = ROWS.filter(row => {
    if (!onlyChanges) return true;
    return snaps.some(s => JSON.stringify(s[row.key]) !== JSON.stringify(base[row.key]));
  });

  return (
    <div className="cmp">
      <div className="cmp-section">
        <div className="cmp-section__title">Stichtage wählen <span className="cmp-muted">(max. {MAX_COLUMNS})</span></div>

        <div className="cmp-chips">
          {sorted.map(d => (
            <span key={d} className="cmp-chip">
              {d === TODAY_ISO ? 'Heute' : formatDate(d)}
              {sorted.length > 1 && (
                <button type="button" aria-label={`Stichtag ${formatDate(d)} entfernen`} onClick={() => removeDate(d)}>
                  <LuX size={13} />
                </button>
              )}
            </span>
          ))}
        </div>

        <div className="cmp-add">
          <input
            type="date"
            className="cmp-date"
            value={pickDate}
            min={MIN_STICHTAG}
            max={TODAY_ISO}
            disabled={full}
            onChange={e => setPickDate(e.target.value)}
            aria-label="Eigenes Stichtag-Datum"
          />
          <button
            type="button"
            className="cmp-btn"
            disabled={full || !pickDate}
            onClick={() => { addDate(pickDate); setPickDate(''); }}
          >
            <LuCalendarPlus size={14} /> Hinzufügen
          </button>
        </div>

        <div className="cmp-presets">
          <span className="cmp-muted">Schnellwahl:</span>
          {PRESETS.map(y => (
            <button key={y} type="button" className="cmp-preset" disabled={full} onClick={() => addDate(yearsAgoIso(y))}>
              vor {y} {y === 1 ? 'Jahr' : 'Jahren'}
            </button>
          ))}
        </div>
      </div>

      <div className="cmp-toolbar">
        <label className="cmp-check">
          <input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />
          Nur Unterschiede anzeigen
        </label>
        <span className="cmp-legend">
          <span className="cmp-item--added cmp-legend__sw">neu</span>
          <span className="cmp-item--removed cmp-legend__sw">entfallen</span>
        </span>
      </div>

      <div className="cmp-scroll">
        <table className="cmp-table">
          <thead>
            <tr>
              <th className="cmp-th cmp-th--label" />
              {snaps.map(s => {
                const isBase = s.stichtag === effectiveBase;
                return (
                  <th key={s.stichtag} className={`cmp-th${isBase ? ' cmp-th--base' : ''}`}>
                    <div className="cmp-th__date">{s.stichtag === TODAY_ISO ? 'Heute' : formatDate(s.stichtag)}</div>
                    {s.stichtag === TODAY_ISO && <div className="cmp-th__sub">{formatDate(TODAY_ISO)}</div>}
                    <label className="cmp-th__base">
                      <input type="radio" name="cmp-base" checked={isBase} onChange={() => setBaseDate(s.stichtag)} />
                      Vergleichsbasis
                    </label>
                    {!isBase && s.stateIndex === base.stateIndex && <div className="cmp-th__same">wie Basis</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => (
              <tr key={row.key}>
                <th scope="row" className="cmp-rowlabel">{row.label}</th>
                {snaps.map(s => (
                  <CompareCell key={s.stichtag} row={row} snap={s} base={base} isBase={s.stichtag === effectiveBase} />
                ))}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr><td className="cmp-cell" colSpan={snaps.length + 1}>Zwischen den gewählten Stichtagen gibt es keine Unterschiede.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="cmp-section">
        <div className="cmp-section__title"><LuHistory size={14} /> Änderungshistorie</div>
        <ol className="cmp-timeline">
          {history.events.map(ev => {
            const active = sorted.includes(ev.date);
            return (
              <li key={ev.id} className="cmp-event">
                <div className="cmp-event__head">
                  <span className="cmp-event__date">{formatDate(ev.date)}</span>
                  <span className="cmp-event__title">{ev.title}</span>
                  <button
                    type="button"
                    className="cmp-preset"
                    disabled={active || full}
                    onClick={() => addDate(ev.date)}
                    title="Zustand ab diesem Datum als Stichtag hinzufügen"
                  >
                    {active ? 'gewählt' : '+ Stichtag'}
                  </button>
                </div>
                <div className="cmp-event__desc">{ev.description}</div>
              </li>
            );
          })}
        </ol>
        <div className="cmp-muted cmp-note">Mock-Daten: die Historie ist für die Demonstration generiert.</div>
      </div>
    </div>
  );
}
