import { useMemo, useRef, useState } from 'react';
import type { HistoryEvent } from './historyData';
import { TODAY_ISO, MIN_STICHTAG, formatDate } from './historyData';

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

interface TimelineProps {
  events: HistoryEvent[];
  dates: string[];
  baseDate: string;
  maxDates: number;
  /** "Heute" can't be moved while comparing (it is the fixed reference). */
  lockToday?: boolean;
  /** Replace one Stichtag by another date (drag). */
  onMoveDate: (from: string, to: string) => void;
  onAddDate: (iso: string) => void;
  onRemoveDate: (iso: string) => void;
}

/** Horizontal time axis: drag Stichtag pins, click the axis or an event marker to add one. */
export default function Timeline({ events, dates, baseDate, maxDates, lockToday = true, onMoveDate, onAddDate, onRemoveDate }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Drag handlers outlive a render; always call the newest props.
  const latest = useRef({ dates, onMoveDate });
  latest.current = { dates, onMoveDate };
  // While dragging, only this component re-renders (pin follows the pointer);
  // the new date is committed to the page (table, map, URL) on release.
  const [drag, setDrag] = useState<{ from: string; to: string } | null>(null);
  const shown = (iso: string) => (drag && drag.from === iso ? drag.to : iso);
  // Stable React keys per pin, so a dragged pin keeps its DOM element (and pointer capture) while its date changes.
  const pinKeys = useRef(new Map<string, string>());
  const keyCounter = useRef(0);
  const pinKey = (iso: string) => {
    let k = pinKeys.current.get(iso);
    if (!k) { k = `pin-${keyCounter.current++}`; pinKeys.current.set(iso, k); }
    return k;
  };

  const { tMin, tMax } = useMemo(() => {
    const earliest = events.length ? events[events.length - 1].date : MIN_STICHTAG;
    const min = Math.max(toTime(MIN_STICHTAG), toTime(earliest) - 365 * DAY);
    return { tMin: min, tMax: toTime(TODAY_ISO) };
  }, [events]);

  const pct = (iso: string) => Math.min(100, Math.max(0, ((toTime(iso) - tMin) / (tMax - tMin)) * 100));

  const isoAtClientX = (clientX: number): string => {
    const r = trackRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return toIso(tMin + frac * (tMax - tMin));
  };

  // Year ticks (about 6 labels)
  const ticks = useMemo(() => {
    const y0 = new Date(tMin).getUTCFullYear() + 1;
    const y1 = new Date(tMax).getUTCFullYear();
    const step = Math.max(1, Math.ceil((y1 - y0 + 1) / 6));
    const out: number[] = [];
    for (let y = y0; y <= y1; y += step) out.push(y);
    return out;
  }, [tMin, tMax]);

  const startPinDrag = (e: React.PointerEvent<HTMLButtonElement>, iso: string) => {
    if (lockToday && iso === TODAY_ISO) return; // "Heute" is fixed
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    let current = iso;
    let frame = 0;
    setDrag({ from: iso, to: iso });
    const move = (ev: PointerEvent) => {
      const next = isoAtClientX(ev.clientX);
      if (next === current || (next !== iso && latest.current.dates.includes(next))) return;
      current = next;
      // At most one update per frame.
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; setDrag({ from: iso, to: current }); });
    };
    const end = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      if (frame) cancelAnimationFrame(frame);
      setDrag(null);
      if (ev.type === 'pointerup' && current !== iso && !latest.current.dates.includes(current)) {
        // Keep the pin's DOM element (and focus) under its new date.
        const k = pinKey(iso);
        pinKeys.current.delete(iso);
        pinKeys.current.set(current, k);
        latest.current.onMoveDate(iso, current);
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };

  const stepPin = (e: React.KeyboardEvent, iso: string) => {
    if (lockToday && iso === TODAY_ISO) return;
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    const days = e.shiftKey ? 365 : 30;
    let next = toIso(toTime(iso) + delta * days * DAY);
    if (next > TODAY_ISO) next = TODAY_ISO;
    if (next < MIN_STICHTAG) next = MIN_STICHTAG;
    if (!dates.includes(next)) onMoveDate(iso, next);
  };

  return (
    <div className="tl">
      <div
        className="tl-track"
        ref={trackRef}
        onClick={e => {
          if ((e.target as HTMLElement).closest('.tl-pin, .tl-event')) return;
          if (dates.length < maxDates) onAddDate(isoAtClientX(e.clientX));
        }}
        title={dates.length < maxDates ? 'Auf die Achse klicken, um einen Stichtag zu setzen' : undefined}
      >
        <div className="tl-line" />
        {ticks.map(y => (
          <span key={y} className="tl-tick" style={{ left: `${pct(`${y}-01-01`)}%` }}>{y}</span>
        ))}

        {events.map(ev => (
          <button
            key={ev.id}
            type="button"
            className="tl-event"
            style={{ left: `${pct(ev.date)}%` }}
            title={`${formatDate(ev.date)} · ${ev.title}\n${ev.description}`}
            aria-label={`Ereignis ${ev.title} am ${formatDate(ev.date)} als Stichtag hinzufügen`}
            disabled={dates.includes(ev.date) || dates.length >= maxDates}
            onClick={() => onAddDate(ev.date)}
          />
        ))}

        {dates.map(d => {
          const at = shown(d);
          return (
          <div
            key={pinKey(d)}
            className={`tl-pin${d === baseDate ? ' tl-pin--base' : ''}${lockToday && d === TODAY_ISO ? ' tl-pin--fixed' : ''}${drag?.from === d ? ' tl-pin--dragging' : ''}`}
            style={{ left: `${pct(at)}%` }}
          >
            <span className="tl-pin__label" style={{ transform: `translateX(${pct(at) > 90 ? '-85%' : pct(at) < 10 ? '-15%' : '-50%'})` }}>
              {at === TODAY_ISO ? 'Heute' : formatDate(at)}
              {dates.length > 1 && (
                <button type="button" className="tl-pin__x" aria-label={`Stichtag ${formatDate(d)} entfernen`}
                  onClick={() => onRemoveDate(d)}>×</button>
              )}
            </span>
            <button
              type="button"
              className="tl-pin__handle"
              onPointerDown={e => startPinDrag(e, d)}
              onKeyDown={e => { stepPin(e, d); if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemoveDate(d); } }}
              aria-label={`Stichtag ${formatDate(d)}${lockToday && d === TODAY_ISO ? '' : ' – mit Pfeiltasten verschiebbar'}`}
            />
          </div>
          );
        })}
      </div>
    </div>
  );
}
