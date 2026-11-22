// Subset of OSM opening_hours, mirroring CONTRACT §7 (server is the source of truth;
// this is used only in mock mode and for human-readable display).

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const DAY_PL: Record<string, string> = {
  Mo: 'pon.', Tu: 'wt.', We: 'śr.', Th: 'czw.', Fr: 'pt.', Sa: 'sob.', Su: 'niedz.',
};
const DAY_PL_FULL: Record<string, string> = {
  Mo: 'poniedziałek', Tu: 'wtorek', We: 'środa', Th: 'czwartek', Fr: 'piątek', Sa: 'sobota', Su: 'niedziela',
};

interface Rule { days: Set<number>; ranges: [number, number][]; off: boolean }

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function parseDays(spec: string): Set<number> | null {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [a, b] = part.split('-');
    const ia = DAYS.indexOf(a as (typeof DAYS)[number]);
    if (ia < 0) return null;
    if (b === undefined) { out.add(ia); continue; }
    const ib = DAYS.indexOf(b as (typeof DAYS)[number]);
    if (ib < 0) return null;
    for (let i = ia; ; i = (i + 1) % 7) { out.add(i); if (i === ib) break; }
  }
  return out;
}

function parseRanges(spec: string): [number, number][] | null {
  const out: [number, number][] = [];
  for (const part of spec.split(',')) {
    const [a, b] = part.trim().split('-');
    const s = toMin(a ?? '');
    const e = toMin(b ?? '');
    if (s === null || e === null) return null;
    out.push([s, e]);
  }
  return out;
}

export function parseOpeningHours(value: string | null | undefined): Rule[] | null {
  if (!value) return null;
  const v = value.trim();
  if (v === '24/7') return [{ days: new Set([0, 1, 2, 3, 4, 5, 6]), ranges: [[0, 1440]], off: false }];
  const rules: Rule[] = [];
  for (const raw of v.split(';')) {
    const r = raw.trim();
    if (!r) continue;
    const tokens = r.split(/\s+/);
    let days = new Set([0, 1, 2, 3, 4, 5, 6]);
    let rest = tokens;
    if (/^[A-Z][a-z]/.test(tokens[0])) {
      const d = parseDays(tokens[0]);
      if (!d) return null;
      days = d;
      rest = tokens.slice(1);
    }
    if (rest.length !== 1) return null;
    if (rest[0] === 'off' || rest[0] === 'closed') { rules.push({ days, ranges: [], off: true }); continue; }
    const ranges = parseRanges(rest[0]);
    if (!ranges) return null;
    rules.push({ days, ranges, off: false });
  }
  return rules.length ? rules : null;
}

/** Weekday index (0 = Monday) and minutes since midnight in Europe/Warsaw. */
export function warsawNow(date = new Date()): { day: number; min: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  return { day, min: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** true / false, or null when the value cannot be interpreted. Later rules override earlier ones. */
export function isOpenNow(value: string | null | undefined, date = new Date()): boolean | null {
  const rules = parseOpeningHours(value);
  if (!rules) return null;
  const { day, min } = warsawNow(date);
  const prev = (day + 6) % 7;
  let open = false;
  for (const r of rules) {
    if (r.days.has(day)) {
      open = !r.off && r.ranges.some(([s, e]) => (e > s ? min >= s && min < e : min >= s));
    }
    // range crossing midnight from the previous day, e.g. Fr 20:00-02:00
    if (!r.off && r.days.has(prev) && r.ranges.some(([s, e]) => e < s && min < e)) open = true;
  }
  return open;
}

function fmtDays(spec: string, full = false): string {
  const dict = full ? DAY_PL_FULL : DAY_PL;
  return spec.split(',').map((p) => p.split('-').map((d) => dict[d] ?? d).join('–')).join(', ');
}

const MONTH_PL: Record<string, string> = {
  Jan: 'sty.', Feb: 'lut.', Mar: 'mar.', Apr: 'kwi.', May: 'maj', Jun: 'cze.', Jul: 'lip.', Aug: 'sie.', Sep: 'wrz.', Oct: 'paź.', Nov: 'lis.', Dec: 'gru.',
};
/** Hours outside the supported subset (months, holidays…): word-by-word Polish version instead of raw OSM syntax. */
function translateRaw(value: string): string[] {
  const word = (w: string) => MONTH_PL[w] ?? DAY_PL[w] ?? ({ PH: 'święta', SH: 'ferie', off: 'nieczynne', closed: 'nieczynne', open: 'otwarte' } as Record<string, string>)[w] ?? w;
  return value.split(';').map((part) => part.trim()).filter(Boolean)
    .map((part) => part.replace(/[A-Za-z]+/g, word).replace(/(\d)-(\d)/g, '$1–$2').replace(/(\.|\p{L})-(\p{L})/gu, '$1–$2').replace(/,(?=\S)/g, ', ').replace(/ (?=\d{2}:\d{2}|nieczynne|otwarte)/, ': '));
}

/** "Mo-Fr 08:00-16:00; Sa 10:00-14:00" → ["pon.–pt.: 08:00–16:00", "sob.: 10:00–14:00"] */
export function describeHours(value: string | null | undefined): string[] {
  if (!value) return ['brak informacji'];
  if (value.trim() === '24/7') return ['całą dobę, 7 dni w tygodniu'];
  if (!parseOpeningHours(value)) return translateRaw(value);
  return value.split(';').map((raw) => {
    const t = raw.trim().split(/\s+/);
    const hasDays = /^[A-Z][a-z]/.test(t[0]);
    const days = hasDays ? fmtDays(t[0]) : 'codziennie';
    const time = hasDays ? t[1] : t[0];
    if (time === 'off' || time === 'closed') return `${days}: nieczynne`;
    return `${days}: ${time.replace(/-/g, '–').replace(/,/g, ', ')}`;
  });
}
