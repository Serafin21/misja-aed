// In-browser implementation of CONTRACT §5 on data/sample/ – used until Model A's API is up.
import type { WynikImportu, Aed, AedDetail, AedFilters, AedPoint, AedView, ListMeta, Pochodzenie, RaportWalidacji, Zrodlo } from '../api/types';
import { availableNow, haversine } from '../lib/format';
import { ageDays, computeState } from '../lib/dataState';
import geo from './aed_ujednolicone.json';
import pochodzenie from './aed_pochodzenie.json';
import raport from './raport_walidacji_przyklad.json';
import zrodla from './zrodla.json';

const records: Aed[] = (geo as { features: { properties: Aed }[] }).features.map((f) => ({ ...f.properties }));
const confirmations = new Map<string, { liczba: number; ostatnie: string | null }>();
const reports: { id: string; lat: number; lon: number; opis: string; czas: string; status: string }[] = [
  { id: 'ZGL-0001', lat: 52.2401, lon: 21.0203, opis: 'AED w aptece przy rynku, za ladą', czas: '2026-11-21T12:40', status: 'do_weryfikacji' },
];

const delay = <T,>(v: T, ms = 150) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const norm = (s: string) => s.toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '');

function withAvailability(a: Aed): AedView {
  const v: AedView = { ...a };
  v.dostepny_teraz = availableNow(v);
  // CR-TL-1: in sample mode freshness is computed here (365-day threshold), like the API does
  v.stan_danych = computeState(v.data_weryfikacji);
  v.wiek_danych_dni = ageDays(v.data_weryfikacji);
  return v;
}

export function mockListAed(f: AedFilters): Promise<{ items: AedView[]; meta: ListMeta }> {
  let items = records.map(withAvailability);
  if (f.q) {
    const q = norm(f.q);
    items = items.filter((a) => norm([a.nazwa_obiektu, a.miejscowosc, a.gmina, a.ulica ?? '', a.opis_lokalizacji].join(' ')).includes(q));
  }
  if (f.wojewodztwo) items = items.filter((a) => a.wojewodztwo === f.wojewodztwo);
  if (f.gmina) items = items.filter((a) => norm(a.gmina).includes(norm(f.gmina!)));
  if (f.dostep) items = items.filter((a) => a.dostep === f.dostep);
  if (f.dostepne_teraz) items = items.filter((a) => a.dostepny_teraz === true);
  if (f.pokaz_mobilne === false) items = items.filter((a) => !a.mobilny);
  const per = f.per_page ?? 100;
  const page = f.page ?? 1;
  return delay({ items: items.slice((page - 1) * per, page * per), meta: { count: items.length, page, per_page: per } });
}

export function mockPoints(): Promise<AedPoint[]> {
  return delay(records.map(withAvailability).map((a) => ({
    id_aed: a.id_aed, lat: a.szerokosc_geograficzna, lon: a.dlugosc_geograficzna,
    dostepny_teraz: a.dostepny_teraz ?? null, stan_danych: a.stan_danych ?? 'nieaktualne', osm: a.licencja === 'ODbL-1.0',
    dostep: a.dostep, wiek_danych_dni: ageDays(a.data_weryfikacji), mobilny: a.mobilny, wojewodztwo: a.wojewodztwo || null,
  })));
}

export function mockByIds(ids: string[]): Promise<AedView[]> {
  const by = new Map(records.map(withAvailability).map((a) => [a.id_aed, a]));
  return delay(ids.map((i) => by.get(i)).filter((a): a is AedView => !!a));
}

export function mockNearest(lat: number, lon: number, limit: number, onlyNow: boolean): Promise<AedView[]> {
  let items = records.map(withAvailability).map((a) => ({
    ...a, odleglosc_m: haversine(lat, lon, a.szerokosc_geograficzna, a.dlugosc_geograficzna),
  }));
  if (onlyNow) items = items.filter((a) => a.dostepny_teraz === true);
  items.sort((a, b) => a.odleglosc_m - b.odleglosc_m);
  return delay(items.slice(0, limit));
}

export function mockGetAed(id: string): Promise<AedDetail | null> {
  const a = records.find((r) => r.id_aed === id);
  if (!a) return delay(null);
  return delay({
    aed: withAvailability(a),
    pochodzenie: (pochodzenie as Pochodzenie[]).filter((p) => p.id_aed === id),
    potwierdzenia: confirmations.get(id) ?? { liczba: 0, ostatnie: null },
  });
}

export function mockConfirm(id: string): Promise<{ ok: true }> {
  const prev = confirmations.get(id) ?? { liczba: 0, ostatnie: null };
  const now = new Date();
  const iso = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`;
  confirmations.set(id, { liczba: prev.liczba + 1, ostatnie: iso });
  return delay({ ok: true });
}

export function mockReport(lat: number, lon: number, opis: string): Promise<{ id: string; status: string }> {
  const id = `ZGL-${String(reports.length + 1).padStart(4, '0')}`;
  reports.push({ id, lat, lon, opis, czas: new Date().toISOString().slice(0, 16), status: 'do_weryfikacji' });
  return delay({ id, status: 'do_weryfikacji' });
}

export function mockReports() { return delay(reports.filter((r) => r.status === 'do_weryfikacji')); }
export function mockDecide(id: string, decyzja: string, _rekord?: Record<string, unknown>) {
  const r = reports.find((x) => x.id === id);
  if (r) r.status = decyzja;
  return delay({ ok: true });
}

// Demo accounts as in .env.example (sample mode only – the real API checks passwords from .env).
const DEMO_PASSWORDS: Record<string, string> = { dysponent: 'dysponent-demo', moderator: 'moderator-demo' };
export function mockLogin(login: 'dysponent' | 'moderator', haslo: string) {
  if (DEMO_PASSWORDS[login] !== haslo) return Promise.reject(new Error('Nieprawidłowy login lub hasło.'));
  return delay({ token: `${login}.demo`, rola: login });
}

export function mockSources(): Promise<Zrodlo[]> { return delay(zrodla as Zrodlo[]); }

export function mockValidation(fileName: string): Promise<RaportWalidacji> {
  return delay({ ...(raport as RaportWalidacji), plik: fileName || (raport as RaportWalidacji).plik }, 400);
}

export function mockStats() {
  const woj: Record<string, number> = {};
  const src: Record<string, number> = {};
  for (const a of records) {
    woj[a.wojewodztwo] = (woj[a.wojewodztwo] ?? 0) + 1;
    src[a.zrodlo_danych] = (src[a.zrodlo_danych] ?? 0) + 1;
  }
  return delay({
    liczba_aed: records.length,
    liczba_dysponentow: new Set(records.map((r) => r.dysponent_nazwa)).size,
    wg_wojewodztw: woj,
    wg_zrodel: src,
  });
}

export const mockAll = records;

export function mockApprove(r: RaportWalidacji): Promise<WynikImportu> {
  const scalone = r.duplikaty.length;
  return delay({ dodane: Math.max(0, r.poprawne - scalone), zaktualizowane: 0, scalone, odrzucone: r.bledy }, 300);
}
