// E2 filters computed in the browser on the whole-Poland point layer (GET /aed/punkty): instant, with counts.
// Three groups (OR inside a group, AND between groups) + area. Empty group = no restriction.
import type { AedPoint } from '../api/types';

export type Dostepnosc = 'teraz' | 'zamkniete' | 'nieznane';
export type Aktualnosc = 'aktualne' | 'stare' | 'brak_daty';
export type Zrodlo = 'dysponent' | 'osm';

export interface PointFilters {
  dostepnosc: Dostepnosc[];
  aktualnosc: Aktualnosc[];
  zrodlo: Zrodlo[];
  mobilne: boolean;
  wojewodztwo: string;
  /** gmina chosen in the search (TERYT from PRG) – exact AED count in its boundaries */
  gmina: string;
  gminaNazwa: string;
}

export const EMPTY: PointFilters = { dostepnosc: [], aktualnosc: [], zrodlo: [], mobilne: true, wojewodztwo: '', gmina: '', gminaNazwa: '' };

export const DOSTEPNOSC: { v: Dostepnosc; label: string; hint: string }[] = [
  { v: 'teraz', label: 'Otwarte teraz', hint: 'można skorzystać o tej godzinie' },
  { v: 'zamkniete', label: 'Zamknięte teraz', hint: 'poza godzinami, niesprawne albo tylko dla uprawnionych' },
  { v: 'nieznane', label: 'Godziny nieokreślone', hint: 'brak godzin w danych – sprawdź na miejscu' },
];

export const AKTUALNOSC: { v: Aktualnosc; label: string; hint: string }[] = [
  { v: 'aktualne', label: 'W ostatnim roku', hint: 'dane sprawdzone w ciągu 12 miesięcy' },
  { v: 'stare', label: 'Ponad rok temu', hint: 'dane mogą być nieaktualne' },
  { v: 'brak_daty', label: 'Brak daty', hint: 'nie wiadomo, kiedy sprawdzono' },
];

export const ZRODLO: { v: Zrodlo; label: string; hint: string }[] = [
  { v: 'dysponent', label: 'Potwierdzone przez właściciela', hint: 'dane instytucji odpowiedzialnych za AED' },
  { v: 'osm', label: 'Do sprawdzenia', hint: 'z OpenStreetMap, niepotwierdzone' },
];

export function dostepnosc(p: AedPoint): Dostepnosc {
  if (p.dostep === 'prywatny') return 'zamkniete'; // not for bystanders
  return p.dostepny_teraz === true ? 'teraz' : p.dostepny_teraz === false ? 'zamkniete' : 'nieznane';
}

export function aktualnosc(p: AedPoint): Aktualnosc {
  if (p.stan_danych === 'aktualne') return 'aktualne';
  return p.wiek_danych_dni === null ? 'brak_daty' : 'stare'; // undefined (older API) counts as "stare"
}

export const zrodlo = (p: AedPoint): Zrodlo => (p.osm ? 'osm' : 'dysponent');

type Group = 'dostepnosc' | 'aktualnosc' | 'zrodlo';

function passes(p: AedPoint, f: PointFilters, skip?: Group): boolean {
  if (!f.mobilne && p.mobilny) return false;
  if (f.wojewodztwo && p.wojewodztwo !== undefined && p.wojewodztwo !== f.wojewodztwo) return false;
  if (f.gmina && p.gmina_teryt !== undefined && p.gmina_teryt !== f.gmina) return false;
  if (skip !== 'dostepnosc' && f.dostepnosc.length && !f.dostepnosc.includes(dostepnosc(p))) return false;
  if (skip !== 'aktualnosc' && f.aktualnosc.length && !f.aktualnosc.includes(aktualnosc(p))) return false;
  if (skip !== 'zrodlo' && f.zrodlo.length && !f.zrodlo.includes(zrodlo(p))) return false;
  return true;
}

export function applyFilters(points: AedPoint[], f: PointFilters, only?: Set<string> | null): AedPoint[] {
  return points.filter((p) => (!only || only.has(p.id_aed)) && passes(p, f));
}

/** Faceted counts: each option counted with the OTHER groups applied, so the numbers say what a click would show. */
export function counts(points: AedPoint[], f: PointFilters, only?: Set<string> | null) {
  const c = { dostepnosc: {} as Record<Dostepnosc, number>, aktualnosc: {} as Record<Aktualnosc, number>, zrodlo: {} as Record<Zrodlo, number> };
  for (const o of DOSTEPNOSC) c.dostepnosc[o.v] = 0;
  for (const o of AKTUALNOSC) c.aktualnosc[o.v] = 0;
  for (const o of ZRODLO) c.zrodlo[o.v] = 0;
  for (const p of points) {
    if (only && !only.has(p.id_aed)) continue;
    if (passes(p, f, 'dostepnosc')) c.dostepnosc[dostepnosc(p)]++;
    if (passes(p, f, 'aktualnosc')) c.aktualnosc[aktualnosc(p)]++;
    if (passes(p, f, 'zrodlo')) c.zrodlo[zrodlo(p)]++;
  }
  return c;
}

// ---------- URL (a link or a refresh keeps the filters) ----------
const list = <T extends string>(v: string | null, allowed: readonly T[]): T[] =>
  (v ?? '').split(',').filter((x): x is T => (allowed as readonly string[]).includes(x));

export function readFilters(search: string): PointFilters & { q: string } {
  const p = new URLSearchParams(search);
  // backwards compatible with the old ?dostepne_teraz=true links
  const dost = list(p.get('dostepnosc'), DOSTEPNOSC.map((o) => o.v));
  if (!dost.length && p.get('dostepne_teraz') === 'true') dost.push('teraz');
  return {
    dostepnosc: dost,
    aktualnosc: list(p.get('aktualnosc'), AKTUALNOSC.map((o) => o.v)),
    zrodlo: list(p.get('zrodlo'), ZRODLO.map((o) => o.v)),
    mobilne: p.get('mobilne') !== 'false',
    wojewodztwo: p.get('wojewodztwo') ?? '',
    gmina: /^\d{7}$/.test(p.get('gm') ?? '') ? p.get('gm')! : '',
    gminaNazwa: p.get('gmn') ?? '',
    q: p.get('q') ?? '',
  };
}

export function writeFilters(f: PointFilters & { q: string }, p: URLSearchParams): URLSearchParams {
  if (f.q) p.set('q', f.q);
  if (f.gmina) { p.set('gm', f.gmina); p.set('gmn', f.gminaNazwa); }
  if (f.wojewodztwo) p.set('wojewodztwo', f.wojewodztwo);
  if (f.dostepnosc.length) p.set('dostepnosc', f.dostepnosc.join(','));
  if (f.aktualnosc.length) p.set('aktualnosc', f.aktualnosc.join(','));
  if (f.zrodlo.length) p.set('zrodlo', f.zrodlo.join(','));
  if (!f.mobilne) p.set('mobilne', 'false');
  return p;
}
