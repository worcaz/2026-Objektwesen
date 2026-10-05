import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuCalendarPlus, LuX, LuHistory, LuChevronDown, LuChevronRight, LuSearch,
  LuLink, LuCheck, LuFileSpreadsheet, LuPrinter, LuGitBranch, LuPlus, LuListFilter, LuChevronUp, LuGitCompare,
} from 'react-icons/lu';
import type { ReactNode } from 'react';
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
  /** false = normal object view at one Stand; true = comparison */
  compare: boolean;
  stand: string;
  onStandChange: (d: string) => void;
  onStartCompare: (kind: CompareMode, withDate?: string) => void;
  onEndCompare: () => void;
}

/** Small dropdown that closes on outside click / Escape. */
function Popover({ label, icon, children, align = 'left', primary = false }: { label: string; icon?: ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="cmp-popwrap" ref={ref}>
      <button type="button" className={`cmp-tool${primary ? ' cmp-tool--primary' : ''}${open ? ' cmp-tool--open' : ''}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {icon} {label}
      </button>
      {open && <div className={`cmp-pop cmp-pop--${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export default function ComparePanel(p: ComparePanelProps) {
  const { parcels, mode, dates, baseDate, pDate, compare, stand } = p;
  const primary = parcels[0];

  const histories = useMemo(() => parcels.map(buildHistory), [parcels]);
  const history = histories[0];

  const sortedDates = useMemo(() => [...new Set(dates)].sort().reverse(), [dates]);
  const [baseParcel, setBaseParcel] = useState(0);
  const [pickDate, setPickDate] = useState('');
  const [onlyChangesPref, setOnlyChanges] = useState(true);
  const [search, setSearch] = useState('');
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [openEvents, setOpenEvents] = useState<Set<string>>(new Set());
  const [hl, setHl] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const eventRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const cols: Col[] = useMemo(() => {
    if (!compare) {
      const s = snapshotAt(history, stand);
      return [{
        key: stand, title: stand === TODAY_ISO ? 'Heute' : formatDate(stand), sub: stand === TODAY_ISO ? formatDate(stand) : 'Stand',
        info: s.info, stateIndex: s.stateIndex, date: stand,
      }];
    }
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
  }, [compare, stand, mode, sortedDates, history, histories, parcels, pDate]);

  const baseIdx = !compare ? 0 : mode === 'zeit'
    ? Math.max(0, sortedDates.indexOf(baseDate))
    : Math.min(baseParcel, cols.length - 1);
  const groups = useMemo(() => buildGroups(cols.map(c => c.info)), [cols]);
  // With a single column there is nothing to diff, so show everything.
  const onlyChanges = onlyChangesPref && cols.length > 1;

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
    if (!compare) return '';
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
  }, [compare, mode, sortedDates, history, totalChanged, changedGroups]);

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
    title: !compare
      ? `Grundstück ${primary.grundstueckNummer} – Stand ${formatDate(stand)}`
      : mode === 'zeit'
      ? `Historischer Vergleich – Grundstück ${primary.grundstueckNummer}`
      : `Grundstücksvergleich am ${formatDate(pDate)}`,
    subtitle: !compare
      ? `${primary.gemeinde} · EGRID ${primary.egrid}`
      : mode === 'zeit'
      ? `${primary.gemeinde} · EGRID ${primary.egrid} · Stichtage ${sortedDates.map(formatDate).join(', ')}`
      : `Grundstücke ${parcels.map(i => i.grundstueckNummer).join(', ')} · Stichtag ${formatDate(pDate)}`,
    columns: cols.map(c => ({ title: c.title, sub: c.sub })),
    groups: visibleGroups.map(g => ({ id: g.id, title: g.title, rows: g.rows })),
    baseIdx,
    events: !compare || mode === 'zeit' ? history.events : [],
  });
  const copyLink = async () => {
    const ok = await p.onCopyLink();
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2200); }
  };

  const eventsFor = (row: CmpRow, col: Col): HistoryEvent[] =>
    compare && mode === 'zeit' && col.key !== cols[baseIdx].key
      ? eventsBetween(history, col.date, cols[baseIdx].date).filter(e => eventAffectsRow(e, row.id))
      : [];

  const hasDiffs = totalChanged > 0;
  const sinceStand = eventsBetween(history, stand, TODAY_ISO).length;
  const oldestYear = history.events.length ? history.events[history.events.length - 1].date.slice(0, 4) : null;

  return (
    <div className="cmp">
      <div className="cmp-controls">
        {/* Zeile 1: Vergleichsart + Werkzeuge */}
        <div className="cmp-modes" role={compare ? 'tablist' : undefined} aria-label="Vergleichsart">
          {!compare ? (
            <Popover label="Vergleichen" icon={<LuGitCompare size={14} />} primary>
              {close => (
                <div className="cmp-startmenu">
                  <button type="button" onClick={() => { close(); p.onStartCompare('zeit'); }}>
                    <LuHistory size={15} /> <span><b>Mit früherem Stand</b><small>Heutigen Stand mit einem früheren Stichtag vergleichen</small></span>
                  </button>
                  <button type="button" onClick={() => { close(); p.onStartCompare('parzellen'); }}>
                    <LuGitBranch size={15} /> <span><b>Mit anderem Grundstück</b><small>Mehrere Grundstücke nebeneinander stellen</small></span>
                  </button>
                </div>
              )}
            </Popover>
          ) : (
            <>
              <button type="button" role="tab" aria-selected={mode === 'zeit'}
                className={`cmp-mode${mode === 'zeit' ? ' cmp-mode--active' : ''}`} onClick={() => p.onModeChange('zeit')}>
                <LuHistory size={14} /> Zeitvergleich
              </button>
              <button type="button" role="tab" aria-selected={mode === 'parzellen'}
                className={`cmp-mode${mode === 'parzellen' ? ' cmp-mode--active' : ''}`} onClick={() => p.onModeChange('parzellen')}>
                <LuGitBranch size={14} /> Grundstücke
              </button>
              <button type="button" className="cmp-tool" onClick={p.onEndCompare} title="Zurück zur Einzelansicht">
                <LuX size={14} /> Vergleich beenden
              </button>
            </>
          )}
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

        {/* Zeile 2: Stichtage (Zeitstrahl) bzw. Grundstücke */}
        {controlsOpen && (!compare || mode === 'zeit') && (
          <div className="cmp-time">
            <Timeline
              events={history.events}
              dates={compare ? sortedDates : [stand]}
              baseDate={compare ? (cols[baseIdx]?.key ?? baseDate) : stand}
              maxDates={compare ? MAX_COLUMNS : 99}
              lockToday={compare}
              onMoveDate={compare ? moveDate : (_from, to) => p.onStandChange(to)}
              onAddDate={compare ? addDate : (iso => p.onStandChange(iso))}
              onRemoveDate={removeDate}
            />
            <div className="cmp-timebar">
              <Popover label={compare ? 'Stichtag' : 'Stand wählen'} icon={compare ? <LuPlus size={14} /> : <LuCalendarPlus size={14} />}>
                {close => {
                  const lock = compare && full;
                  const choose = (iso: string) => { if (compare) addDate(iso); else p.onStandChange(iso); close(); };
                  return (
                    <div className="cmp-addpop">
                      <div className="cmp-pop__title">
                        {compare ? 'Stichtag hinzufügen' : 'Stand ansehen am'} {lock && <span className="cmp-muted">(max. {MAX_COLUMNS} erreicht)</span>}
                      </div>
                      <div className="cmp-add">
                        <input type="date" className="cmp-date" value={pickDate} min={MIN_STICHTAG} max={TODAY_ISO}
                          disabled={lock} onChange={e => setPickDate(e.target.value)} aria-label="Datum" />
                        <button type="button" className="cmp-btn" disabled={lock || !pickDate}
                          onClick={() => { choose(pickDate); setPickDate(''); }}>
                          <LuCalendarPlus size={14} /> {compare ? 'Hinzufügen' : 'Anzeigen'}
                        </button>
                      </div>
                      <div className="cmp-presets">
                        {!compare && <button type="button" className="cmp-preset" disabled={stand === TODAY_ISO} onClick={() => choose(TODAY_ISO)}>Heute</button>}
                        {PRESETS.map(y => (
                          <button key={y} type="button" className="cmp-preset"
                            disabled={lock || (compare ? sortedDates : [stand]).includes(yearsAgoIso(y))}
                            onClick={() => choose(yearsAgoIso(y))}>
                            vor {y} {y === 1 ? 'Jahr' : 'Jahren'}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }}
              </Popover>
              <span className="cmp-timelegend"><i className="tl-dot" /> Änderung am Grundstück (anklicken = {compare ? 'Stichtag' : 'Stand ansehen'})</span>
            </div>
          </div>
        )}
        {controlsOpen && compare && mode === 'parzellen' && (
          <div className="cmp-time">
            <div className="cmp-chips">
              {parcels.map(i => (
                <span key={i.egrid} className="cmp-chip">
                  Nr. {i.grundstueckNummer} · {i.gemeinde}
                  {parcels.length > 1 && (
                    <button type="button" aria-label={`Grundstück ${i.grundstueckNummer} entfernen`} onClick={() => p.onRemoveParcel(i.egrid)}>
                      <LuX size={13} />
                    </button>
                  )}
                </span>
              ))}
              <span className="cmp-muted">
                {parcels.length < MAX_COLUMNS ? 'Weitere in der Karte anklicken oder suchen' : 'Maximum erreicht'}
              </span>
            </div>
            <div className="cmp-add">
              <label className="cmp-muted" htmlFor="cmp-pdate">Stichtag:</label>
              <input id="cmp-pdate" type="date" className="cmp-date" value={pDate} min={MIN_STICHTAG} max={TODAY_ISO}
                onChange={e => e.target.value && e.target.value <= TODAY_ISO && p.onPDateChange(e.target.value)} />
              <button type="button" className="cmp-preset" onClick={() => p.onPDateChange(TODAY_ISO)}>Heute</button>
            </div>
          </div>
        )}

        {/* Zeile 3: Suche, Filter */}
        <div className="cmp-toolbar2">
          <div className="cmp-search">
            <LuSearch size={14} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Felder und Werte suchen…" aria-label="Tabelle durchsuchen" />
            {search && <button type="button" aria-label="Suche leeren" onClick={() => setSearch('')}><LuX size={13} /></button>}
          </div>
          {compare && (
            <label className="cmp-switch" title={cols.length < 2 ? 'Mindestens zwei Spalten nötig' : undefined}>
              <input type="checkbox" checked={onlyChangesPref} disabled={cols.length < 2} onChange={e => setOnlyChanges(e.target.checked)} />
              Nur Unterschiede
            </label>
          )}
          <Popover label={hiddenGroups.size ? `Bereiche (${groups.length - hiddenGroups.size}/${groups.length})` : 'Bereiche'} icon={<LuListFilter size={14} />} align="right">
            {() => (
              <div className="cmp-groupmenu">
                {groups.map(g => (
                  <label key={g.id} className="cmp-check">
                    <input type="checkbox" checked={!hiddenGroups.has(g.id)} onChange={() => setHiddenGroups(prev => toggleIn(prev, g.id))} />
                    {g.title}
                  </label>
                ))}
              </div>
            )}
          </Popover>
          <button type="button" className="cmp-tool" aria-expanded={controlsOpen} onClick={() => setControlsOpen(o => !o)}
            title={controlsOpen ? 'Zeitstrahl ausblenden' : 'Zeitstrahl einblenden'}>
            <LuChevronUp size={14} className={controlsOpen ? '' : 'cmp-flip'} /> {!compare ? 'Zeitstrahl' : mode === 'zeit' ? 'Stichtage' : 'Grundstücke'}
          </button>
        </div>

        {compare ? (
          <div className="cmp-summary" role="status">
            <span>{summary}</span>
            <span className="cmp-legend">
              <span className="cmp-item--added cmp-legend__sw">neu</span>
              <span className="cmp-item--removed cmp-legend__sw">entfallen</span>
            </span>
          </div>
        ) : (
          <div className="cmp-summary cmp-summary--teaser" role="status">
            <span>
              {stand === TODAY_ISO
                ? <>Aktueller Stand. {history.events.length > 0 ? `Seit ${oldestYear} sind ${history.events.length} Änderungen erfasst.` : 'Keine früheren Änderungen erfasst.'}</>
                : <>Stand vom {formatDate(stand)} – seither {sinceStand} {sinceStand === 1 ? 'Änderung' : 'Änderungen'}.</>}
            </span>
            {history.events.length > 0 && (
              <button type="button" className="cmp-linkbtn" onClick={() => p.onStartCompare('zeit', stand === TODAY_ISO ? undefined : stand)}>
                {stand === TODAY_ISO ? 'Mit früherem Stand vergleichen' : 'Mit heute vergleichen'} →
              </button>
            )}
          </div>
        )}
      </div>

      <div className="cmp-body">
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
                    {cols.length > 1 && (
                      <label className="cmp-th__base">
                        <input type="radio" name="cmp-base" checked={isBase}
                          onChange={() => (mode === 'zeit' ? p.onBaseDateChange(c.key) : setBaseParcel(i))} />
                        Vergleichsbasis
                      </label>
                    )}
                    {compare && !isBase && c.stateIndex === cols[baseIdx].stateIndex && mode === 'zeit' && <div className="cmp-th__same">wie Basis</div>}
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
              <tr>
                <td className="cmp-cell cmp-empty-row" colSpan={cols.length + 1}>
                  {onlyChanges && !hasDiffs && !q
                    ? <>Zwischen den gewählten Ständen gibt es keine Unterschiede. <button type="button" className="cmp-linkbtn" onClick={() => setOnlyChanges(false)}>Alle Felder anzeigen</button></>
                    : 'Keine Einträge für die gewählten Filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Änderungshistorie */}
        <div className="cmp-section cmp-history">
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
                    {!compare ? (
                      <button type="button" className="cmp-preset" disabled={stand === ev.date} onClick={() => p.onStandChange(ev.date)}
                        title="Zustand ab diesem Datum anzeigen">
                        {stand === ev.date ? 'angezeigt' : 'Stand ansehen'}
                      </button>
                    ) : mode === 'zeit' && (
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
    </div>
  );
}
