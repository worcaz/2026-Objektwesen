// Swisstopo SWISSIMAGE (WMTS), jährliche Stände. Laut Capabilities verfügbar: current + 1973…Vorjahr.
const BASE = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default';

export const SWISSIMAGE_ATTRIBUTION = '&copy; <a href="https://www.swisstopo.admin.ch">swisstopo</a> – SWISSIMAGE';
export const SWISSIMAGE_FIRST_YEAR = 1973;
export const SWISSIMAGE_MAX_ZOOM = 19;

export const swissimageUrl = (year: number | 'current') => `${BASE}/${year}/3857/{z}/{x}/{y}.jpeg`;

/** Verfügbare Jahre, neueste zuerst. */
export function swissimageYears(): number[] {
  const last = new Date().getFullYear() - 1;
  return Array.from({ length: last - SWISSIMAGE_FIRST_YEAR + 1 }, (_, i) => last - i);
}
