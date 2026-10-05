// Colored map-legend symbols shared by the object info panel and the v3 comparison.

const ZONENPLAN_SYMBOL_PATH = 'M -10,-10 L 10,0 L 10,10 L -10,10 L -10,-10 Z';
const BODENBEDECKUNG_SYMBOL_PATH = 'M 0,-10 L 10,0 L 0,10 L -10,0 L 0,-10 Z';
const TINY_SYMBOL_STROKE = 'rgba(104, 104, 104, 1)';

function normalizeLegendLabel(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function getBodenbedeckungColor(label: string): string {
  const key = normalizeLegendLabel(label);
  if (key.includes('wald')) return 'rgba(76, 175, 80, 1)';
  if (key.includes('gewasser')) return 'rgba(78, 160, 220, 1)';
  if (key.includes('garten') || key.includes('landwirtschaft')) return 'rgba(147, 196, 84, 1)';
  if (key.includes('gebaude')) return 'rgba(159, 122, 85, 1)';
  if (key.includes('verkehr') || key.includes('befestigte')) return 'rgba(159, 166, 178, 1)';
  return 'rgba(208, 208, 208, 1)';
}

export function getZoneColor(zonentyp: string, gemeinde?: string): string {
  const key = normalizeLegendLabel(`${zonentyp} ${gemeinde ?? ''}`);
  if (key.includes('wald')) return 'rgba(76, 175, 80, 1)';
  if (key.includes('grunzone') || key.includes('grun')) return 'rgba(180, 229, 168, 1)';
  if (key.includes('arbeitszone') || key.includes('gewerbezone') || key.includes('industriezone')) return 'rgba(69, 135, 214, 1)';
  if (key.includes('zentrumszone') || key.includes('kern') || key.includes('dorfzone')) return 'rgba(217, 196, 157, 1)';
  if (key.includes('wohnzone w3')) return 'rgba(214, 169, 18, 1)';
  if (key.includes('wohnzone')) return 'rgba(247, 201, 38, 1)';
  if (key.includes('strasse') || key.includes('verkehrszone')) return 'rgba(168, 176, 185, 1)';
  return 'rgba(205, 214, 221, 1)';
}

export function TinyLegendSymbol({ fill, title, variant = 'zonenplan' }: { fill: string; title: string; variant?: 'zonenplan' | 'bodenbedeckung' }) {
  const path = variant === 'bodenbedeckung' ? BODENBEDECKUNG_SYMBOL_PATH : ZONENPLAN_SYMBOL_PATH;

  return (
    <span title={title} aria-hidden="true" className="tiny-legend-symbol">
      <svg viewBox="-10 -10 20 20" width="12" height="12">
        <path
          d={path}
          fill={fill}
          fillRule="evenodd"
          stroke={TINY_SYMBOL_STROKE}
          strokeDasharray="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit="4"
          strokeWidth="1.3333333333333333"
        />
      </svg>
    </span>
  );
}
