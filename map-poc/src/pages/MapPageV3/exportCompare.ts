import type { CmpGroup, CmpRow } from './compareModel';
import { cellChanged } from './compareModel';
import type { HistoryEvent } from './historyData';
import { formatDate } from './historyData';

export interface ExportColumn { title: string; sub?: string }

export interface ExportData {
  title: string;
  subtitle: string;
  columns: ExportColumn[];
  groups: CmpGroup[];
  baseIdx: number;
  events: HistoryEvent[];
}

const cellText = (row: CmpRow, idx: number): string => {
  const c = row.cells[idx];
  if (c.absent) return 'nicht vorhanden';
  return c.lines.join(' | ') || '–';
};

const changedCell = (row: CmpRow, idx: number, baseIdx: number) =>
  idx !== baseIdx && cellChanged(row.cells[idx], row.cells[baseIdx]);

const colLabel = (c: ExportColumn) => (c.sub ? `${c.title} (${c.sub})` : c.title);

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** Excel-friendly CSV (UTF-8 with BOM, semicolon separated). */
export function exportCsv(d: ExportData, filename: string) {
  const lines: string[] = [];
  const push = (cols: string[]) => lines.push(cols.map(csvEscape).join(';'));
  push([d.title]);
  push([d.subtitle]);
  push([`Erstellt am ${new Date().toLocaleDateString('de-CH')} – Mock-Daten`]);
  push([]);
  push(['Bereich', 'Feld', ...d.columns.map(colLabel), 'Änderung ggü. Vergleichsbasis']);
  for (const g of d.groups) {
    for (const r of g.rows) {
      if (r.kind === 'sub') { push([g.title, r.label]); continue; }
      const changed = r.cells.some((_, i) => changedCell(r, i, d.baseIdx));
      push([g.title, r.label, ...r.cells.map((_, i) => cellText(r, i)), changed ? 'ja' : '']);
    }
  }
  if (d.events.length) {
    push([]);
    push(['Änderungshistorie']);
    push(['Datum', 'Art', 'Beschreibung', 'Stelle', 'Beleg']);
    for (const e of d.events) push([formatDate(e.date), e.title, e.description, e.stelle, e.beleg]);
  }
  download(filename, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Opens a print-ready page; the user saves it as PDF via the print dialog. */
export function exportPdf(d: ExportData) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const head = `<tr><th></th>${d.columns.map((c, i) =>
    `<th${i === d.baseIdx ? ' class="base"' : ''}>${esc(c.title)}${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ''}${i === d.baseIdx ? '<div class="sub">Vergleichsbasis</div>' : ''}</th>`).join('')}</tr>`;
  const body = d.groups.map(g => {
    const rows = g.rows.map(r => {
      if (r.kind === 'sub') return `<tr class="subrow"><td colspan="${d.columns.length + 1}">${esc(r.label)}</td></tr>`;
      return `<tr><th>${esc(r.label)}</th>${r.cells.map((_, i) =>
        `<td class="${changedCell(r, i, d.baseIdx) ? 'chg' : ''}">${esc(cellText(r, i))}</td>`).join('')}</tr>`;
    }).join('');
    return `<tr class="group"><td colspan="${d.columns.length + 1}">${esc(g.title)}</td></tr>${rows}`;
  }).join('');
  const events = d.events.length
    ? `<h2>Änderungshistorie</h2><table class="ev"><tr><th>Datum</th><th>Art</th><th>Beschreibung</th><th>Stelle</th><th>Beleg</th></tr>${
        d.events.map(e => `<tr><td>${formatDate(e.date)}</td><td>${esc(e.title)}</td><td>${esc(e.description)}</td><td>${esc(e.stelle)}</td><td>${esc(e.beleg)}</td></tr>`).join('')
      }</table>`
    : '';
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font: 11px/1.4 Arial, sans-serif; color: #111; }
  h1 { font-size: 16px; margin: 0 0 2px; } h2 { font-size: 13px; margin: 18px 0 6px; }
  .meta { color: #555; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
  thead th { background: #f3f4f6; } th.base { box-shadow: inset 0 -3px 0 #009fe3; } .sub { font-weight: 400; color: #666; }
  tr.group td { background: #e8f3fa; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
  tr.subrow td { background: #f9fafb; font-weight: 700; }
  td.chg { background: #fff7d6; } tbody th { width: 150px; background: #fafafa; font-weight: 600; }
  tr { break-inside: avoid; }
</style></head><body>
<h1>${esc(d.title)}</h1>
<div class="meta">${esc(d.subtitle)} · Erstellt am ${new Date().toLocaleDateString('de-CH')} · Mock-Daten, nicht rechtsverbindlich · Gelb = Abweichung von der Vergleichsbasis</div>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
${events}
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });</script>
</body></html>`);
  w.document.close();
  return true;
}
