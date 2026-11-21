// In-browser implementation of CONTRACT §5 on data/sample/ – used until Model A's API is up.
import type { Miejsce, WynikImportu, Aed, AedDetail, AedFilters, AedPoint, AedView, ListMeta, Pochodzenie, RaportWalidacji, Zrodlo, Zbiory } from '../api/types';
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
  // CR-TL-6 placeholder until Model A sends meta.dostawca_podstawa: sample records are fictional providers' own AED
  const meta = a.licencja === 'ODbL-1.0' ? undefined
    : { warstwa: 'lista' as const, dostawca: a.dysponent_nazwa, dostawca_podstawa: 'wlasciciel' as const, fikcyjny_dostawca: true, licencja_zbioru: a.licencja };
  const view = withAvailability(a);
  return delay({
    aed: meta && !view.meta ? { ...view, meta } : view,
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
const DEMO_PASSWORDS: Record<string, string> = { dysponent: 'dysponent-demo', administrator: 'administrator-demo', moderator: 'moderator-demo' };
export function mockLogin(login: string, haslo: string) {
  if (DEMO_PASSWORDS[login] !== haslo) return Promise.reject(new Error('Nieprawidłowy login lub hasło.'));
  return delay({ token: `${login}.demo`, rola: (login === 'dysponent' ? 'dysponent' : 'administrator') as 'dysponent' | 'administrator', login, dysponent_nazwa: login === 'dysponent' ? 'Urząd Gminy Przykładowo' : null });
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

export function mockImportInfo(fileName: string) {
  const r = raport as RaportWalidacji;
  return delay({
    import_id: `demo-${fileName}`, liczba_wierszy: r.wiersze, kolumny: Object.keys(r.mapowanie),
    mapowanie_proponowane: { ...r.mapowanie, 'Uwagi wewnętrzne': '' },
    podglad: [{ 'Uwagi wewnętrzne': 'przegląd w marcu' }],
  }, 400);
}

export function mockCreateAed() {
  return delay({ id_aed: `AED-PL-DEMO${Math.floor(Math.random() * 1e6)}` }, 250);
}

/** Sample mode: localities known from the sample records (no geocoder). */
export function mockPlaces(q: string): Promise<Miejsce[]> {
  const n = q.toLowerCase();
  const by = new Map<string, AedView[]>();
  for (const a of records) if (a.miejscowosc && a.miejscowosc.toLowerCase().startsWith(n)) by.set(a.miejscowosc, [...(by.get(a.miejscowosc) ?? []), a]);
  return delay([...by.entries()].map(([m, rs]) => ({
    typ: 'miejscowosc' as const, nazwa: m, opis: 'miejscowość (dane przykładowe)', bbox: null,
    lat: rs.reduce((s, a) => s + a.szerokosc_geograficzna, 0) / rs.length, lon: rs.reduce((s, a) => s + a.dlugosc_geograficzna, 0) / rs.length,
  })));
}

/**
 * Placeholder for GET /zbiory (CR-TL-5 contract) until Model A ships it. The three providers are the fictional ones
 * from data/dostawcy/ (titles, record counts, licences, data dates as there); the last two rows only illustrate the
 * other statuses and are fictional as well.
 */
export function mockZbiory(): Promise<Zbiory> {
  const dgp = (id: string, slug: string) => `https://dane.gov.pl/pl/dataset/${id},${slug}`;
  const z: Zbiory = {
    atrapa: true,
    data: [
      { zbior_id: '990001', tytul: 'Defibrylatory AED – Urząd Gminy Przykładowo', dostawca: 'Urząd Gminy Przykładowo', zbior_url: dgp('990001', 'defibrylatory-aed-urzad-gminy-przykladowo'), status: 'wzorzec', nieaktualny: false, rekordy: 3, data_danych: '2026-11-02', licencja: 'CC0 1.0', problemy: [] },
      { zbior_id: '990003', tytul: 'Defibrylatory AED – MPK Przykładowo sp. z o.o.', dostawca: 'MPK Przykładowo sp. z o.o.', zbior_url: dgp('990003', 'defibrylatory-aed-mpk-przykladowo-sp-z-o-o'), status: 'wzorzec', nieaktualny: false, rekordy: 3, data_danych: '2026-11-15', licencja: 'CC0 1.0', problemy: [] },
      { zbior_id: '990002', tytul: 'Defibrylatory AED – Uczelnia Testowa', dostawca: 'Uczelnia Testowa', zbior_url: dgp('990002', 'defibrylatory-aed-uczelnia-testowa'), status: 'wzorzec', nieaktualny: true, rekordy: 2, data_danych: '2025-06-30', licencja: 'CC BY 4.0', problemy: ['Zbiór po terminie aktualizacji (co kwartał + 30 dni).'] },
      { zbior_id: '990004', tytul: 'Wykaz defibrylatorów – Gmina Przykładowa Druga', dostawca: 'Gmina Przykładowa Druga', zbior_url: null, status: 'przejsciowy', nieaktualny: false, rekordy: 4, data_danych: '2026-03-10', licencja: 'CC BY 4.0', problemy: ['Opublikowany przed wzorcem: brak pól data_weryfikacji i godziny_dostepnosci.'] },
      { zbior_id: '990005', tytul: 'Lokalizacje AED – Miasto Przykładowe', dostawca: 'Miasto Przykładowe', zbior_url: null, status: 'poza_lista', nieaktualny: false, rekordy: 12, data_danych: '2024-09-01', licencja: 'CC BY 4.0', problemy: ['Plik PDF zamiast CSV – nie da się odczytać maszynowo.'] },
    ],
    meta: { agregacja: null, warstwa_pomocnicza: { zrodlo: 'OpenStreetMap', licencja: 'ODbL-1.0', obiekty: 0 } },
  };
  return delay(z);
}
