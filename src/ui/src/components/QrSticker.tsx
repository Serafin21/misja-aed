// "Paszport AED" sticker: QR code leading to the AED card (/aed/{id}). qrcode-generator – MIT licence.
import qrcode from 'qrcode-generator';
import { BRAND_NAME, BRAND_SLOGAN, heartRects } from './Brand';
import { Icon } from './ui';

export function aedCardUrl(id: string): string {
  return `${location.origin}/aed/${encodeURIComponent(id)}`;
}

export function qrSvg(text: string, cell = 4): { svg: string; size: number } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c * cell} ${r * cell}h${cell}v${cell}h-${cell}z`;
  const size = n * cell;
  return { svg: `<path d="${d}" fill="#0F3B2B"/>`, size };
}

export function QrSticker({ id, name }: { id: string; name: string }) {
  const url = aedCardUrl(id);
  const { svg: qr, size } = qrSvg(url, 6);
  const W = 420, H = 560, q = 300, qx = (W - q) / 2, s = q / size;
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const sticker = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" rx="28" fill="#1A7A50"/>${heartRects(30, 26, 11)}`
    + `<text x="100" y="52" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#fff">Paszport AED</text>`
    + `<text x="100" y="80" font-family="Arial, sans-serif" font-size="16" fill="#EDF2EC">${BRAND_NAME}</text>`
    + `<rect x="${qx - 14}" y="104" width="${q + 28}" height="${q + 28}" rx="16" fill="#fff"/>`
    + `<g transform="translate(${qx} 118) scale(${s})">${qr}</g>`
    + `<text x="${W / 2}" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="700" fill="#fff">Zeskanuj i potwierdź, że AED jest tutaj</text>`
    + `<text x="${W / 2}" y="498" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#EDF2EC">${esc(name.slice(0, 44))}</text>`
    + `<text x="${W / 2}" y="530" text-anchor="middle" font-family="Arial, sans-serif" font-weight="600" font-size="15" fill="#EDF2EC">${BRAND_SLOGAN}</text></svg>`;
  const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sticker)}`;
  return (
    <details className="details">
      <summary>Dla dysponenta: naklejka „Paszport AED” z kodem QR</summary>
      <p>Wydrukuj i naklej na szafkę. Kod QR prowadzi do tej karty: <code>{url}</code></p>
      <img src={href} alt={`Naklejka Paszport AED dla „${name}” z kodem QR prowadzącym do karty urządzenia`} width={W / 1.5} height={H / 1.5} className="sticker" />
      <p><a className="btn btn--secondary" href={href} download={`paszport_${id}.svg`}><Icon name="download" />Pobierz naklejkę (SVG)</a></p>
    </details>
  );
}
