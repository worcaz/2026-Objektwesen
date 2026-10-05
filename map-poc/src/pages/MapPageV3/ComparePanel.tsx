import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuCalendarPlus, LuX, LuHistory, LuChevronDown, LuChevronRight, LuSearch,
  LuLink, LuCheck, LuFileSpreadsheet, LuPrinter, LuGitBranch,
} from 'react-icons/lu';
import type { ObjectInfo } from '../MapPageV2/mockData';
import { TinyLegendSymbol, getBodenbedeckungColor, getZoneColor } from '../MapPageV2/LegendSymbol';
import type { CmpRow } from './compareModel';
import { buildGroups, cellChanged, rowChanged } from './compareModel';
import type { HistoryEvent, ParcelRef } from './historyData';
import {
  TODAY_ISO, MIN_STICHTAG, buildHistory, snapshotAt, formatDate, yearsAgoIso, eventsBetween, eventAffectsRow,
} from './historyData';
import type { CompareMode } from './urlState';
import Timeline from './Timeline';
import { exportCsv, exportPdf } from './exportCompare';

export const MAX_COLUMNS = 4;
const PRESETS = [1, 5, 10, 20, 30];

interface Col {
  key: string;
  title: string;
  sub?: string;
  info: ObjectInfo;
  stateIndex: number;
  date: string;
}

function RowLabel({ row }: { row: CmpRow }) {
  if (!row.symbol) return <>{row.label}</>;
  const fill = row.symbol.variant === 'bodenbedeckung' ? getBodenbedeckungColor(row.symbol.key) : getZoneColor(row.symbol.key);
  return (
    <span className="cmp-legend-line">
      <TinyLegendSymbol fill={fill} title={row.label} variant={row.symbol.variant} />
      <span>{row.label}</span>
    </span>
  );
}

function CompareCell({
  row, idx, baseIdx, events, onJump,
}: { row: CmpRow; idx: number; baseIdx: number; events: HistoryEvent[]; onJump: (ev: HistoryEvent[]) => void }) {
  const cell = row.cells[idx];
  const base = row.cells[baseIdx];
  const isBase = idx === baseIdx;
  const changed = !isBase && cellChanged(cell, base);
  const clickable = changed && events.length > 0;
  const cls = `cmp-cell${changed ? ' cmp-cell--changed' : ''}${clickable ? ' cmp-cell--link' : ''}`;
  const title = clickable
    ? `Ausgelöst durch: ${events.map(e => `${e.title} (${formatDate(e.date)})`).join(', ')} – klicken für Details`
    : undefined;
  const props = { className: cls, title, onClick: clickable ? () => onJump(events) : undefined };

  if (cell.absent) {
    return <td {...props}><span className="cmp-empty">nicht vorhanden</span></td>;
  }
  if (row.kind === 'scalar') {
    return <td {...props}>{cell.lines[0]}</td>;
  }
  const removed = isBase || base.absent ? [] : base.lines.filter(l => !cell.lines.includes(l));
  return (
    <td {...props}>
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

export interface ComparePanelProps {
  parcels: ObjectInfo[];
  mode: CompareMode;
  onModeChange: (m: CompareMode) => void;
  dates: string[];
  onDatesChange: (d: string[]) => void;
  baseDate: string;
  onBaseDateChange: (d: string) => void;
  pDate: string;
  onPDateChange: (d: string) => void;
  onRemoveParcel: (egrid: string) => void;
  onAddParcelRef: (ref: ParcelRef) => void;
  onCopyLink: () => Promise<boolean>;
}

export default function ComparePanel(p: ComparePanelProps) {
  const { parcels, mode, dates, baseDate, pDate } = p;
  const primary = parcels[0];

  const histories = useMemo(() => parcels.map(buildHistory), [parcels]);
  const history = histories[0];

  const sortedDates = useMemo(() => [...new Set(dates)].sort().reverse(), [dates]);
  const [baseParcel, setBaseParcel] = useState(0);
  const [pickDate, setPickDate] = useState('');
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [search, setSearch] = useState('');
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set());
  const [hl, setHl] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const eventRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const cols: Col[] = useMemo(() => {
    if (mode === 'zeit') {
      return sortedDates.map(d => {
        const s = snapshotAt(history, d);
        return {
          key: d, title: d === TODAY_ISO ? 'Heute' : formatDate(d), sub: d === TODAY_ISO ? formatDate(d) : undefined,
          info: s.info, stateIndex: s.stateIndex, date: d,
        };
      });
    }
    return parcels.map((info, i) => {
      const s = snapshotAt(histories[i], pDate);
      return {
        key: info.egrid, title: `Grundstück ${info.grundstueckNummer}`, sub: info.gemeinde,
        info: s.info, stateIndex: s.stateIndex, date: pDate,
      };
    });
  }, [mode, sortedDates, history, histories, parcels, pDate]);

  const baseIdx = mode === 'zeit'
    ? Math.max(0, sortedDates.indexOf(baseDate))
    : Math.min(baseParcel, cols.length - 1);
  const groups = useMemo(() => buildGroups(cols.map(c => c.info)), [cols]);

  // ── Stichtage (Zeitvergleich) ──
  const full = sortedDates.length >= MAX_COLUMNS;
  const addDate = (iso: string) => {
    if (!iso || iso > TODAY_ISO || iso < MIN_STICHTAG || sortedDates.includes(iso) || full) return;
    p.onDatesChange([...sortedDates, iso]);
  };
  const removeDate = (iso: string) => {
    if (sortedDates.length > 1) p.onDatesChange(sortedDates.filter(d => d !== iso));
  };
  const moveDate = (from: string, to: string) => {
    p.onDatesChange(sortedDates.map(d => (d === from ? to : d)));
    if (baseDate === from) p.onBaseDateChange(to);
  };

  // ── Filter (Zeilen) ──
  const q = search.trim().toLowerCase();
  const rowMatches = (r: CmpRow) =>
    !q || r.label.toLowerCase().includes(q) || r.cells.some(c => c.lines.some(l => l.toLowerCase().includes(q)));

  const visibleGroups = groups
    .filter(g => !hiddenGroups.has(g.id))
    .map(g => {
      const rows: CmpRow[] = [];
      let pending: CmpRow[] = [];
      for (const r of g.rows) {
        if (r.kind === 'sub') { pending = r.section ? [r] : [...pending.filter(x => x.section), r]; continue; }
        if (onlyChanges && !rowChanged(r, baseIdx)) continue;
        if (!rowMatches(r)) continue;
        if (pending.length) { rows.push(...pending); pending = []; }
        rows.push(r);
      }
      const changes = g.rows.filter(r => rowChanged(r, baseIdx)).length;
      return { ...g, rows, changes };
    })
    .filter(g => (!onlyChanges && !q) || g.rows.length > 0);

  // ── Zusammenfassung ──
  const totalChanged = groups.reduce((n, g) => n + g.rows.filter(r => rowChanged(r, baseIdx)).length, 0);
  const changedGroups = groups.filter(g => g.rows.some(r => rowChanged(r, baseIdx))).length;
  const summary = useMemo(() => {
    if (mode !== 'zeit') {
      return `${totalChanged} ${totalChanged === 1 ? 'Feld unterscheidet' : 'Felder unterscheiden'} sich in ${changedGroups} ${changedGroups === 1 ? 'Bereich' : 'Bereichen'} zwischen den Grundstücken.`;
    }
    if (sortedDates.length < 2) return 'Wähle mindestens zwei Stichtage, um Unterschiede zu sehen.';
    const oldest = sortedDates[sortedDates.length - 1];
    const newest = sortedDates[0];
    const evs = eventsBetween(history, oldest, newest);
    const byType = new Map<string, number>();
    evs.forEach(e => byType.set(e.title, (byType.get(e.title) ?? 0) + 1));
    const top = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${n}× ${t}`);
    return `Zwischen ${formatDate(oldest)} und ${newest === TODAY_ISO ? 'heute' : formatDate(newest)}: ` +
      `${evs.length} ${evs.length === 1 ? 'Ereignis' : 'Ereignisse'}${top.length ? ` (${top.join(', ')})` : ''}; ` +
      `${totalChanged} ${totalChanged === 1 ? 'geändertes Feld' : 'geänderte Felder'} in ${changedGroups} ${changedGroups === 1 ? 'Bereich' : 'Bereichen'}.`;
  }, [mode, sortedDates, history, totalChanged, changedGroups]);

  // ── Ereignisse: Filter, Sprung aus Zelle ──
  const eventTypes = useMemo(() => [...new Set(history.events.map(e => e.title))], [history]);
  const shownEvents = history.events.filter(e => typeFilter.size === 0 || typeFilter.has(e.title));

  const toggleIn = (set: Set<string>, v: string) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };

  const jumpTo = (evs: HistoryEvent[]) => {
    setTypeFilter(new Set());
    setHl(new Set(evs.map(e => e.id)));
    setOpenEvents(prev => new Set([...prev, ...evs.map(e => e.id)]));
    setTimeout(() => eventRefs.current[evs[0].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };
  useEffect(() => {
    if (hl.size === 0) return;
    const t = setTimeout(() => setHl(new Set()), 4500);
    return () => clearTimeout(t);
  }, [hl]);

  // ── Export & Link ──
  const exportData = () => ({
    title: mode === 'zeit'
      ? `Historischer Vergleich – Grundstück ${primary.grundstueckNummer}`
      : `Grundstücksvergleich am ${formatDate(pDate)}`,
    subtitle: mode === 'zeit'
      ? `${primary.gemeinde} · EGRID ${primary.egrid} · Stichtage ${sortedDates.map(formatDate).join(', ')}`
      : `Grundstücke ${parcels.map(i => i.grundstueckNummer).join(', ')} · Stichtag ${formatDate(pDate)}`,
    columns: cols.map(c => ({ title: c.title, sub: c.sub })),
    groups: visibleGroups.map(g => ({ id: g.id, title: g.title, rows: g.rows })),
    baseIdx,
    events: mode === 'zeit' ? history.events : [],
  });
  const copyLink = async () => {
    const ok = await p.onCopyLink();
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2200); }
  };

  const eventsFor = (row: CmpRow, col: Col): HistoryEvent[] =>
    mode === 'zeit' && col.key !== cols[baseIdx].key
      ? eventsBetween(history, col.date, cols[baseIdx].date).filter(e => eventAffectsRow(e, row.id))
      : [];

  return (
    <div className="cmp">
      {/* Modus */}
      <div className="cmp-modes" role="tablist" aria-label="Vergleichsart">
        <button type="button" role="tab" aria-selected={mode === 'zeit'}
          className={`cmp-mode${mode === 'zeit' ? ' cmp-mode--active' : ''}`} onClick={() => p.onModeChange('zeit')}>
          <LuHistory size={14} /> Zeitvergleich
        </button>
        <button type="button" role="tab" aria-selected={mode === 'parzellen'}
          className={`cmp-mode${mode === 'parzellen' ? ' cmp-mode--active' : ''}`} onClick={() => p.onModeChange('parzellen')}>
          <LuGitBranch size={14} /> Grundstücke vergleichen
        </button>
        <span className="cmp-modes__spacer" />
        <button type="button" className="cmp-tool" onClick={copyLink} title="Link zu diesem Vergleich kopieren">
          {copied ? <LuCheck size={14} /> : <LuLink size={14} />} {copied ? 'Kopiert' : 'Link'}
        </button>
        <button type="button" className="cmp-tool" onClick={() => exportCsv(exportData(), `vergleich-${primary.grundstueckNummer}.csv`)} title="Als Excel-Tabelle (CSV) exportieren">
          <LuFileSpreadsheet size={14} /> Excel
        </button>
        <button type="button" className="cmp-tool" onClick={() => { if (!exportPdf(exportData())) window.alert('Bitte Pop-ups für diese Seite erlauben.'); }} title="Als PDF drucken / speichern">
          <LuPrinter size={14} /> PDF
        </button>
      </div>

      {mode === 'zeit' ? (
        <div className="cmp-section">
          <div className="cmp-section__title">Stichtage wählen <span className="cmp-muted">(max. {MAX_COLUMNS})</span></div>

          <Timeline
            events={history.events}
            dates={sortedDates}
            baseDate={cols[baseIdx]?.key ?? baseDate}
            maxDates={MAX_COLUMNS}
            onMoveDate={moveDate}
            onAddDate={addDate}
          />

          <div className="cmp-chips">
            {sortedDates.map(d => (
              <span key={d} className="cmp-chip">
                {d === TODAY_ISO ? 'Heute' : formatDate(d)}
                {sortedDates.length > 1 && (
                  <button type="button" aria-label={`Stichtag ${formatDate(d)} entfernen`} onClick={() => removeDate(d)}>
                    <LuX size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="cmp-add">
            <input type="date" className="cmp-date" value={pickDate} min={MIN_STICHTAG} max={TODAY_ISO}
              disabled={full} onChange={e => setPickDate(e.target.value)} aria-label="Eigenes Stichtag-Datum" />
            <button type="button" className="cmp-btn" disabled={full || !pickDate}
              onClick={() => { addDate(pickDate); setPickDate(''); }}>
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
      ) : (
        <div className="cmp-section">
          <div className="cmp-section__title">Grundstücke <span className="cmp-muted">(max. {MAX_COLUMNS})</span></div>
          <div className="cmp-chips">
            {parcels.map(i => (
              <span key={i.egrid} className="cmp-chip">
                Grundstück {i.grundstueckNummer} · {i.gemeinde}
                {parcels.length > 1 && (
                  <button type="button" aria-label={`Grundstück ${i.grundstueckNummer} entfernen`} onClick={() => p.onRemoveParcel(i.egrid)}>
                    <LuX size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="cmp-muted cmp-hint">
            {parcels.length < MAX_COLUMNS
              ? 'Weitere Grundstücke in der Karte anklicken oder über die Suche hinzufügen.'
              : 'Maximale Anzahl erreicht – entferne ein Grundstück, um ein anderes hinzuzufügen.'}
          </div>
          <div className="cmp-add">
            <label className="cmp-muted" htmlFor="cmp-pdate">Stichtag:</label>
            <input id="cmp-pdate" type="date" className="cmp-date" value={pDate} min={MIN_STICHTAG} max={TODAY_ISO}
              onChange={e => e.target.value && e.target.value <= TODAY_ISO && p.onPDateChange(e.target.value)} />
            <button type="button" className="cmp-preset" onClick={() => p.onPDateChange(TODAY_ISO)}>Heute</button>
          </div>
        </div>
      )}

      {/* Zusammenfassung + Filter */}
      <div className="cmp-summary" role="status">{summary}</div>

      <div className="cmp-filters">
        <div className="cmp-search">
          <LuSearch size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Felder und Werte durchsuchen…" aria-label="Tabelle durchsuchen" />
          {search && <button type="button" aria-label="Suche leeren" onClick={() => setSearch('')}><LuX size={13} /></button>}
        </div>
        <label className="cmp-check">
          <input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)} />
          Nur Unterschiede
        </label>
      </div>
      <div className="cmp-presets">
        <span className="cmp-muted">Bereiche:</span>
        {groups.map(g => (
          <button key={g.id} type="button" aria-pressed={!hiddenGroups.has(g.id)}
            className={`cmp-preset${hiddenGroups.has(g.id) ? '' : ' cmp-preset--on'}`}
            onClick={() => setHiddenGroups(prev => toggleIn(prev, g.id))}>
            {g.title}
          </button>
        ))}
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
              {cols.map((c, i) => {
                const isBase = i === baseIdx;
                return (
                  <th key={c.key} className={`cmp-th${isBase ? ' cmp-th--base' : ''}`}>
                    <div className="cmp-th__date">{c.title}</div>
                    {c.sub && <div className="cmp-th__sub">{c.sub}</div>}
                    <label className="cmp-th__base">
                      <input type="radio" name="cmp-base" checked={isBase}
                        onChange={() => (mode === 'zeit' ? p.onBaseDateChange(c.key) : setBaseParcel(i))} />
                      Vergleichsbasis
                    </label>
                    {!isBase && c.stateIndex === cols[baseIdx].stateIndex && mode === 'zeit' && <div className="cmp-th__same">wie Basis</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map(g => {
              const isCollapsed = collapsed.has(g.id);
              return [
                <tr key={g.id} className="cmp-grouprow" onClick={() => setCollapsed(prev => toggleIn(prev, g.id))}>
                  <th colSpan={cols.length + 1} scope="colgroup" className="cmp-group">
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
                      <th colSpan={cols.length + 1} scope="colgroup" className="cmp-sub"><RowLabel row={row} /></th>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <th scope="row" className="cmp-rowlabel"><RowLabel row={row} /></th>
                      {cols.map((c, i) => (
                        <CompareCell key={c.key} row={row} idx={i} baseIdx={baseIdx} events={eventsFor(row, c)} onJump={jumpTo} />
                      ))}
                    </tr>
                  ),
                )),
              ];
            })}
            {visibleGroups.length === 0 && (
              <tr><td className="cmp-cell" colSpan={cols.length + 1}>Keine Einträge für die gewählten Filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Änderungshistorie */}
      <div className="cmp-section">
        <div className="cmp-section__title"><LuHistory size={14} /> Änderungshistorie · Grundstück {primary.grundstueckNummer}</div>
        <div className="cmp-presets cmp-presets--tight">
          <button type="button" className={`cmp-preset${typeFilter.size === 0 ? ' cmp-preset--on' : ''}`} onClick={() => setTypeFilter(new Set())}>Alle</button>
          {eventTypes.map(t => (
            <button key={t} type="button" aria-pressed={typeFilter.has(t)}
              className={`cmp-preset${typeFilter.has(t) ? ' cmp-preset--on' : ''}`}
              onClick={() => setTypeFilter(prev => toggleIn(prev, t))}>
              {t}
            </button>
          ))}
        </div>
        <ol className="cmp-timeline">
          {shownEvents.map(ev => {
            const active = sortedDates.includes(ev.date);
            const open = openEvents.has(ev.id);
            return (
              <li key={ev.id} ref={el => { eventRefs.current[ev.id] = el; }}
                className={`cmp-event${hl.has(ev.id) ? ' cmp-event--hl' : ''}`}>
                <div className="cmp-event__head">
                  <span className="cmp-event__date">{formatDate(ev.date)}</span>
                  <button type="button" className="cmp-event__title" aria-expanded={open}
                    onClick={() => setOpenEvents(prev => toggleIn(prev, ev.id))}>
                    {open ? <LuChevronDown size={13} /> : <LuChevronRight size={13} />} {ev.title}
                  </button>
                  {mode === 'zeit' && (
                    <button type="button" className="cmp-preset" disabled={active || full} onClick={() => addDate(ev.date)}
                      title="Zustand ab diesem Datum als Stichtag hinzufügen">
                      {active ? 'gewählt' : '+ Stichtag'}
                    </button>
                  )}
                </div>
                <div className="cmp-event__desc">{ev.description}</div>
                {open && (
                  <dl className="cmp-event__proof">
                    <dt>Stelle</dt><dd>{ev.stelle}</dd>
                    <dt>Beleg</dt><dd>{ev.beleg}</dd>
                    {ev.herkunft && (
                      <>
                        <dt>Herkunft</dt>
                        <dd>
                          {ev.herkunft.map(h => (
                            <button key={h.egrid} type="button" className="cmp-preset"
                              disabled={parcels.some(x => x.egrid === h.egrid) || parcels.length >= MAX_COLUMNS}
                              onClick={() => p.onAddParcelRef(h)} title="Dieses Grundstück im Grundstücksvergleich hinzufügen">
                              Nr. {h.nummer} vergleichen
                            </button>
                          ))}
                        </dd>
                      </>
                    )}
                  </dl>
                )}
              </li>
            );
          })}
          {shownEvents.length === 0 && <li className="cmp-muted">Keine Ereignisse für diesen Filter.</li>}
        </ol>
        <div className="cmp-muted cmp-note">Mock-Daten: Historie, Stellen und Belegnummern sind für die Demonstration generiert.</div>
      </div>
    </div>
  );
}

