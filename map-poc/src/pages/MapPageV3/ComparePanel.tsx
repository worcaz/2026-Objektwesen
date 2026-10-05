import { useMemo, useState } from 'react';
import { LuCalendarPlus, LuX, LuHistory, LuChevronDown, LuChevronRight } from 'react-icons/lu';
import type { ObjectInfo } from '../MapPageV2/mockData';
import type { CmpRow } from './compareModel';
import { buildGroups, cellChanged, rowChanged } from './compareModel';
import {
  TODAY_ISO, MIN_STICHTAG, buildHistory, snapshotAt, formatDate, yearsAgoIso,
} from './historyData';

const MAX_COLUMNS = 4;
const PRESETS = [1, 5, 10, 20, 30];

function CompareCell({ row, idx, baseIdx }: { row: CmpRow; idx: number; baseIdx: number }) {
  const cell = row.cells[idx];
  const base = row.cells[baseIdx];
  const isBase = idx === baseIdx;
  const changed = !isBase && cellChanged(cell, base);

  if (cell.absent) {
    return <td className={changed ? 'cmp-cell cmp-cell--changed' : 'cmp-cell'}><span className="cmp-empty">nicht vorhanden</span></td>;
  }
  if (row.kind === 'scalar') {
    return <td className={changed ? 'cmp-cell cmp-cell--changed' : 'cmp-cell'}>{cell.lines[0]}</td>;
  }
  const removed = isBase || base.absent ? [] : base.lines.filter(l => !cell.lines.includes(l));
  return (
    <td className={changed ? 'cmp-cell cmp-cell--changed' : 'cmp-cell'}>
      {cell.lines.length === 0 && removed.length === 0 && <span className="cmp-empty">–</span>}
      {cell.lines.map(l => (
        <div key={l} className={!isBase && !base.absent && !base.lines.includes(l) ? 'cmp-item cmp-item--added' : 'cmp-item'}>{l}</div>
      ))}
      {removed.map(l => (
        <div key={l} className="cmp-item cmp-item--removed" title="Im Vergleichsstand vorhanden, hier nicht">{l}</div>
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
  const baseIdx = sorted.indexOf(effectiveBase);
  const base = snaps[baseIdx];
  const groups = useMemo(() => buildGroups(snaps.map(s => s.info)), [snaps]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) =>
    setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const addDate = (iso: string) => {
    if (!iso || iso > TODAY_ISO || iso < MIN_STICHTAG) return;
    setDates(prev => (prev.includes(iso) || prev.length >= MAX_COLUMNS ? prev : [...prev, iso]));
  };
  const removeDate = (iso: string) => setDates(prev => (prev.length > 1 ? prev.filter(d => d !== iso) : prev));
  const full = sorted.length >= MAX_COLUMNS;

  // Rows to show per group; sub-headings only when a row of their block is visible.
  const visibleGroups = groups
    .map(g => {
      const rows: CmpRow[] = [];
      let pendingSub: CmpRow | null = null;
      for (const r of g.rows) {
        if (r.kind === 'sub') { pendingSub = r; continue; }
        if (onlyChanges && !rowChanged(r, baseIdx)) continue;
        if (pendingSub) { rows.push(pendingSub); pendingSub = null; }
        rows.push(r);
      }
      const changes = g.rows.filter(r => rowChanged(r, baseIdx)).length;
      return { ...g, rows, changes };
    })
    .filter(g => !onlyChanges || g.rows.length > 0);

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
            {visibleGroups.map(g => {
              const isCollapsed = collapsed.has(g.id);
              return [
                <tr key={g.id} className="cmp-grouprow" onClick={() => toggleGroup(g.id)}>
                  <th colSpan={snaps.length + 1} scope="colgroup" className="cmp-group">
                    <span className="cmp-group__inner">
                      {isCollapsed ? <LuChevronRight size={15} /> : <LuChevronDown size={15} />}
                      {g.title}
                      {g.changes > 0 && (
                        <span className="cmp-group__badge">{g.changes} {g.changes === 1 ? 'Änderung' : 'Änderungen'}</span>
                      )}
                    </span>
                  </th>
                </tr>,
                ...(isCollapsed ? [] : g.rows.map(row =>
                  row.kind === 'sub' ? (
                    <tr key={row.id} className="cmp-subrow">
                      <th colSpan={snaps.length + 1} scope="colgroup" className="cmp-sub">{row.label}</th>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <th scope="row" className="cmp-rowlabel">{row.label}</th>
                      {snaps.map((s, i) => <CompareCell key={s.stichtag} row={row} idx={i} baseIdx={baseIdx} />)}
                    </tr>
                  ),
                )),
              ];
            })}
            {visibleGroups.length === 0 && (
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
