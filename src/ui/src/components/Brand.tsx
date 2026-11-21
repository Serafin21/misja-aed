import type { ReactElement } from 'react';

// Brand system chosen by the team (TL): "AED w danych" – logo 3 (pixel heart) + logo 2 as map pin.
// Colours: zieleń ratunkowa #1A7A50, głęboka zieleń #0F3B2B, szron #EDF2EC, bursztyn #E2A23B,
// bursztyn ciemny #B9791A, szałwia szara #6B7570. Source files: brand/ (TL).

export const BRAND_NAME = 'AED w danych';
export const BRAND_SLOGAN = '1 wiersz = 1 AED = szansa na życie';

// 5×5 grid of the pixel heart; 'a' = amber cell ("Twoje AED").
const HEART: string[] = [
  '.g.g.',
  'ggggg',
  'ggagg',
  '.ggg.',
  '..g..',
];

export function LogoMark({ size = 40, mono, title }: { size?: number; mono?: 'white' | 'dark'; title?: string }) {
  const cells: ReactElement[] = [];
  HEART.forEach((row, y) => row.split('').forEach((c, x) => {
    if (c === '.') return;
    const fill = mono === 'white' ? (c === 'a' ? '#E2A23B' : '#fff') : mono === 'dark' ? (c === 'a' ? '#E2A23B' : '#0F3B2B') : (c === 'a' ? '#E2A23B' : '#1A7A50');
    cells.push(<rect key={`${x}-${y}`} x={x * 10 + 1} y={y * 10 + 1} width={8.4} height={8.4} rx={1.8} fill={fill} />);
  }));
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} focusable="false">
      {title && <title>{title}</title>}
      {cells}
    </svg>
  );
}

export type PinKind = 'ok' | 'closed' | 'private' | 'unknown';

/** Map pin as an SVG string (Leaflet divIcon). State = colour + shape + badge, never colour alone (WCAG 1.4.1). */
export function pinSvg(kind: PinKind, osm = false): string {
  const outline = kind === 'unknown' ? '#6B7570' : '#fff';
  const fill = kind === 'ok' ? '#1A7A50' : kind === 'unknown' ? '#fff' : '#B9791A';
  const heart = kind === 'unknown' ? '#6B7570' : '#fff';
  const bolt = kind === 'unknown' ? '#fff' : kind === 'ok' ? '#E2A23B' : '#B9791A';
  const dash = osm ? ' stroke-dasharray="4 2.5"' : '';
  const badge = kind === 'closed'
    ? '<circle cx="33" cy="8" r="6.5" fill="#fff" stroke="#0F3B2B" stroke-width="1.6"/><path d="M33 4.8V8l2.2 1.4" stroke="#0F3B2B" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    : kind === 'private'
      ? '<circle cx="33" cy="8" r="6.5" fill="#fff" stroke="#0F3B2B" stroke-width="1.6"/><rect x="30.2" y="7.4" width="5.6" height="4.2" rx=".8" fill="#0F3B2B"/><path d="M31.4 7.4V6.2a1.6 1.6 0 0 1 3.2 0v1.2" stroke="#0F3B2B" stroke-width="1.3" fill="none"/>'
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52" aria-hidden="true" focusable="false">`
    + `<path d="M20 50S4 32.5 4 19.5a16 16 0 0 1 32 0C36 32.5 20 50 20 50z" fill="${fill}" stroke="${outline}" stroke-width="2.6"${dash}/>`
    + `<path d="M20 29.5s-8.6-5.3-8.6-11.2a4.6 4.6 0 0 1 8.6-2.3 4.6 4.6 0 0 1 8.6 2.3c0 5.9-8.6 11.2-8.6 11.2z" fill="${heart}"/>`
    + `<path d="M21.2 14.2l-4.4 7.2h3.2l-1.2 5.4 4.4-7.4H20z" fill="${bolt}"/>`
    + badge + '</svg>';
}

export function Pin({ kind, size = 28 }: { kind: PinKind; size?: number }) {
  return <span className="pin-inline" style={{ width: size * (40 / 52), height: size }} dangerouslySetInnerHTML={{ __html: pinSvg(kind) }} />;
}

/** Pixel heart as SVG markup (for generated files such as the provider badge). */
export function heartRects(x0: number, y0: number, cell: number, color = '#fff'): string {
  let out = '';
  HEART.forEach((row, y) => row.split('').forEach((c, x) => {
    if (c === '.') return;
    out += `<rect x="${x0 + x * cell}" y="${y0 + y * cell}" width="${cell * 0.84}" height="${cell * 0.84}" rx="${cell * 0.18}" fill="${c === 'a' ? '#E2A23B' : color}"/>`;
  }));
  return out;
}
