// E2 filters computed in the browser on the whole-Poland point layer (GET /aed/punkty): instant, with counts.
// Three groups (OR inside a group, AND between groups) + area. Empty group = no restriction.
import type { AedPoint } from '../api/types';

export type Dostepnosc = 'teraz' | 'zamkniete' | 'uprawnieni' | 'nieznane';
export type Aktualnosc = 'aktualne' | 'stare' | 'brak_daty';
export type Zrodlo = 'dysponent' | 'osm';

export interface PointFilters {
  dostepnosc: Dostepnosc[];
  aktualnosc: Aktualnosc[];
  zrodlo: Zrodlo[];
  mobilne: boolean;
  wojewodztwo: string;
}

export const EMPTY: PointFilters = { dostepnosc: [], aktualnosc: [], zrodlo: [], mobilne: true, wojewodztwo: '' };

export const DOSTEPNOSC: { v: Dostepnosc; label: string; hint: string }[] = [
  { v: 'teraz', label: 'Dostępne teraz', hint: 'otwarte o tej godzinie' },
  { v: 'zamkniete', label: 'Teraz zamknięte', hint: 'poza godzinami albo niesprawne' },
  { v: 'nieznane', label: 'Godziny nieznane', hint: 'sprawdź na miejscu' },
  { v: 'uprawnieni', label: 'Tylko dla uprawnionych', hint: 'np. pracownicy, OSP' },
];

export const AKTUALNOSC: { v: Aktualnosc; label: string; hint: string }[] = [
  { v: 'aktualne', label: 'Aktualne', hint: 'sprawdzone w ostatnich 12 mies.' },
  { v: 'stare', label: 'Nieaktualne', hint: 'sprawdzone ponad rok temu' },
  { v: 'brak_daty', label: 'Bez daty sprawdzenia', hint: 'nie wiadomo, kiedy sprawdzono' },
];

export const ZRODLO: { v: Zrodlo; label: string; hint: string }[] = [
  { v: 'dysponent', label: 'Od instytucji', hint: 'dane od właścicieli AED' },
  { v: 'osm', label: 'OpenStreetMap', hint: 'dane społeczności (ODbL)' },
];

export function dostepnosc(p: AedPoint): Dostepnosc {
  if (p.dostep === 'prywatny') return 'uprawnieni';
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

export function readFilters(search: string): PointFilters & { q: string; gmina: string } {
  const p = new URLSearchParams(search);
  // backwards compatible with the old ?dostepne_teraz=true / ?dostep=prywatny links
  const dost = list(p.get('dostepnosc'), DOSTEPNOSC.map((o) => o.v));
  if (!dost.length && p.get('dostepne_teraz') === 'true') dost.push('teraz');
  return {
    dostepnosc: dost,
    aktualnosc: list(p.get('aktualnosc'), AKTUALNOSC.map((o) => o.v)),
    zrodlo: list(p.get('zrodlo'), ZRODLO.map((o) => o.v)),
    mobilne: p.get('mobilne') !== 'false',
    wojewodztwo: p.get('wojewodztwo') ?? '',
    q: p.get('q') ?? '',
    gmina: p.get('gmina') ?? '',
  };
}

export function writeFilters(f: PointFilters & { q: string; gmina: string }, p: URLSearchParams): URLSearchParams {
  if (f.q) p.set('q', f.q);
  if (f.gmina) p.set('gmina', f.gmina);
  if (f.wojewodztwo) p.set('wojewodztwo', f.wojewodztwo);
  if (f.dostepnosc.length) p.set('dostepnosc', f.dostepnosc.join(','));
  if (f.aktualnosc.length) p.set('aktualnosc', f.aktualnosc.join(','));
  if (f.zrodlo.length) p.set('zrodlo', f.zrodlo.join(','));
  if (!f.mobilne) p.set('mobilne', 'false');
  return p;
}
