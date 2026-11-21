// Opening hours picked from lists (no code typed by the user) → words for people + opening_hours syntax for the data.
export type HoursMode = '' | '24h' | 'hours' | 'unknown';
export interface DayHours { open: string; close: string } // '' = closed that day
export interface Hours { mode: HoursMode; days: DayHours[] } // days[0] = Monday

export const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const DAY_SHORT = ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'];
const DAY_OSM = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const emptyHours = (): Hours => ({ mode: '', days: DAY_NAMES.map(() => ({ open: '', close: '' })) });

/** 00:00 … 23:30 every 30 minutes (+ 24:00 as a closing time). */
export const TIMES: string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
export const CLOSE_TIMES = [...TIMES.slice(1), '24:00'];

const spoken = (t: string) => t.replace(/^0(\d)/, '$1'); // 08:00 → 8:00

/** Groups of consecutive days with the same hours. */
function groups(h: Hours): { from: number; to: number; open: string; close: string }[] {
  const out: { from: number; to: number; open: string; close: string }[] = [];
  h.days.forEach((d, i) => {
    if (!d.open || !d.close) return;
    const last = out[out.length - 1];
    if (last && last.to === i - 1 && last.open === d.open && last.close === d.close) last.to = i;
    else out.push({ from: i, to: i, open: d.open, close: d.close });
  });
  return out;
}

export function hoursError(h: Hours): string {
  if (h.mode !== 'hours') return '';
  const set = h.days.filter((d) => d.open || d.close);
  if (!set.length) return 'Wybierz godziny przynajmniej dla jednego dnia albo zaznacz „Nie wiem”.';
  const i = h.days.findIndex((d) => (d.open && !d.close) || (!d.open && d.close));
  if (i >= 0) return `${DAY_NAMES[i]}: wybierz godzinę otwarcia i zamknięcia.`;
  const j = h.days.findIndex((d) => d.open && d.close && d.close !== '24:00' && d.close <= d.open);
  if (j >= 0) return `${DAY_NAMES[j]}: godzina zamknięcia musi być późniejsza niż otwarcia.`;
  return '';
}

/** Words for people, e.g. "pon.–pt. 8:00–16:00; sob. 9:00–13:00". */
export function hoursInWords(h: Hours): string {
  if (h.mode === '24h') return 'Całą dobę, codziennie';
  if (h.mode === 'unknown' || h.mode === '') return 'Nie wiem';
  const g = groups(h);
  if (!g.length) return 'Nie wybrano godzin';
  return g.map((x) => `${DAY_SHORT[x.from]}${x.to > x.from ? `–${DAY_SHORT[x.to]}` : ''} ${spoken(x.open)}–${spoken(x.close)}`).join('; ');
}

/** Machine form (OpenStreetMap opening_hours), e.g. "Mo-Fr 08:00-16:00; Sa 09:00-13:00". Empty when unknown. */
export function hoursToOpeningHours(h: Hours): string {
  if (h.mode === '24h') return '24/7';
  if (h.mode !== 'hours' || hoursError(h)) return '';
  return groups(h).map((x) => `${DAY_OSM[x.from]}${x.to > x.from ? `-${DAY_OSM[x.to]}` : ''} ${x.open}-${x.close}`).join('; ');
}
