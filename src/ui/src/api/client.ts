// REST client for CONTRACT §5. Falls back to in-browser mocks (data/sample/) when the API is unreachable.
import * as mock from '../mocks/mockApi';
import type { PodstawaPublikacji, Zbiory, WynikImportu, Aed, AedDetail, AedMeta, AedFilters, AedPoint, AedView, ApiError, Miejsce, ListMeta, Pokrycie, Potwierdzenie, RaportWalidacji, Zrodlo } from './types';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const API_BASE = env.VITE_API_BASE || '/api/v1';
const MODE = env.VITE_USE_MOCKS ?? ''; // "1" mocks, "0" API only, "" auto

let usingMocks = MODE === '1';
const listeners = new Set<(m: boolean) => void>();
export const isMockMode = () => usingMocks;
export function onMockModeChange(fn: (m: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function setMock(v: boolean) { if (usingMocks !== v) { usingMocks = v; listeners.forEach((l) => l(v)); } }

export class HttpError extends Error {
  constructor(public status: number, public body: ApiError | null) {
    // 404 without our error body = the running API is older than the app (e.g. not restarted after git pull)
    super(body?.message ?? (status === 404 ? 'Serwer danych nie ma tej funkcji – uruchom go ponownie po pobraniu nowej wersji (git pull).' : `Błąd ${status}`));
  }
  /** Field-level messages from a 422 response ({ pole: komunikat }). */
  get fields(): Record<string, string> { return this.body?.fields ?? {}; }
}

class Unreachable extends Error {}

// ---------- auth (CONTRACT: POST /auth/login → Bearer token) ----------
/** docs/MODEL_ROL.md: dostawca (dysponent) and administrator (MC). */
export type Role = 'dysponent' | 'administrator';
export type Session = { token: string; rola: Role; login?: string; dysponent_nazwa?: string | null } | null;
const SESSION_KEY = 'aed.session';
function readSession(): Session {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
}
let session: Session = readSession();
const authListeners = new Set<(s: Session) => void>();
export const getSession = () => session;
export function onSessionChange(fn: (s: Session) => void) { authListeners.add(fn); return () => { authListeners.delete(fn); }; }
function setSession(s: Session) {
  session = s;
  try { if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SESSION_KEY); } catch { /* storage blocked – keep in memory */ }
  authListeners.forEach((l) => l(s));
}
export const logout = () => setSession(null);

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (session && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.token}`);
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { ...init, headers });
  } catch {
    throw new Unreachable();
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!isJson && (res.status === 404 || res.status >= 500 || res.ok)) throw new Unreachable(); // dev server / proxy without backend
  if (!res.ok) {
    const body = isJson ? ((await res.json()) as { error?: ApiError }) : null;
    if (res.status === 401 && session && !path.startsWith('/auth/')) {
      setSession(null); // token no longer valid (e.g. server restarted with a new AED_SECRET)
      throw new HttpError(401, { code: 'sesja_wygasla', message: 'Sesja wygasła. Zaloguj się ponownie.' });
    }
    throw new HttpError(res.status, body?.error ?? null);
  }
  return (await res.json()) as T;
}

/** Try the API; when it is unreachable (and mocks are allowed) use the mock implementation. */
async function withFallback<T>(real: () => Promise<T>, fake: () => Promise<T>): Promise<T> {
  if (usingMocks) return fake();
  try {
    const r = await real();
    setMock(false);
    return r;
  } catch (e) {
    if (e instanceof Unreachable && MODE !== '0') { setMock(true); return fake(); }
    if (e instanceof Unreachable) throw new Error('Serwer danych jest niedostępny. Spróbuj ponownie za chwilę.');
    throw e;
  }
}

type ItemMeta = { stan_danych?: AedView['stan_danych']; wiek_danych_dni?: number | null } & AedMeta;
type JsonApiItem<T> = { type: string; id: string; attributes: T; meta?: ItemMeta };
// CR-TL-1: freshness lives in meta – copy it next to the attributes
const flat = <T extends object>(i: JsonApiItem<T>) => ({
  ...(i.attributes as T), id_aed: i.id,
  ...(i.meta?.stan_danych ? { stan_danych: i.meta.stan_danych, wiek_danych_dni: i.meta.wiek_danych_dni ?? null } : {}),
  ...(i.meta ? { meta: i.meta } : {}),
} as T & { id_aed: string; meta?: AedMeta } & Omit<ItemMeta, keyof AedMeta>);

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function listAed(f: AedFilters) {
  return withFallback(
    async () => {
      const r = await http<{ data: JsonApiItem<AedView>[]; meta: ListMeta }>(
        `/aed${qs({ q: f.q, wojewodztwo: f.wojewodztwo, gmina: f.gmina, dostep: f.dostep, dostepne_teraz: f.dostepne_teraz, page: f.page, per_page: f.per_page ?? 100 })}`,
      );
      let items = r.data.map(flat);
      if (f.pokaz_mobilne === false) items = items.filter((a) => !a.mobilny);
      return { items, meta: r.meta };
    },
    () => mock.mockListAed(f),
  );
}

export function nearestAed(lat: number, lon: number, limit = 5, onlyNow = false, warstwa: 'lista' | 'pomocnicza' = 'lista') {
  return withFallback(
    async () => {
      const r = await http<{ data: JsonApiItem<AedView>[] }>(`/aed/najblizsze${qs({ lat: lat.toFixed(6), lon: lon.toFixed(6), limit, tylko_dostepne_teraz: onlyNow, warstwa })}`);
      return r.data.map(flat);
    },
    () => (warstwa === 'lista' ? mock.mockNearest(lat, lon, limit, onlyNow) : Promise.resolve([])),
  );
}

export function getAed(id: string): Promise<AedDetail | null> {
  return withFallback(
    async () => {
      try {
        const r = await http<{ data: JsonApiItem<Aed>; pochodzenie?: AedDetail['pochodzenie']; potwierdzenia?: AedDetail['potwierdzenia'] }>(`/aed/${encodeURIComponent(id)}`);
        return { aed: flat(r.data), pochodzenie: r.pochodzenie ?? [], potwierdzenia: r.potwierdzenia ?? { liczba: 0, ostatnie: null } };
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      }
    },
    () => mock.mockGetAed(id),
  );
}

export function confirmAed(id: string, body: Potwierdzenie) {
  return withFallback(
    () => http<{ ok: boolean }>(`/aed/${encodeURIComponent(id)}/potwierdzenia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    () => mock.mockConfirm(id),
  );
}

/** Citizen report. Optional details (hours, cabinet) and a photo (data URI, shrunk in the browser) – HANDOFF A #8. */
export type TypZgloszenia = 'brak' | 'awaria' | 'brak_dostepu' | 'bledne_polozenie' | 'inne' | 'nowe';
export interface ZgloszenieExtra { godziny_dostepnosci?: string; szafka_zamknieta?: boolean; instrukcja_dostepu?: string; zdjecie?: string;
  /** AED the report is about (from its card) – goes to its provider; none = device outside the list (administrator) */
  id_aed?: string; typ?: TypZgloszenia; email?: string }
export function reportAed(lat: number, lon: number, opis: string, extra: ZgloszenieExtra = {}) {
  return withFallback(
    () => http<{ id: string; status: string; meta?: { trafia_do?: string; komunikat?: string } }>(`/zgloszenia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lon, opis, ...extra }) }),
    () => mock.mockReport(lat, lon, opis),
  );
}

export function listSources() {
  return withFallback(async () => {
    const r = await http<{ data: (JsonApiItem<Zrodlo> | Zrodlo)[] } | Zrodlo[]>(`/zrodla`);
    const arr = Array.isArray(r) ? r : r.data;
    return arr.map((x) => ('attributes' in x ? { ...x.attributes, kod_zrodla: x.id } : x)) as Zrodlo[];
  }, () => mock.mockSources());
}

/** GET /zbiory (CR-TL-5). Until A ships the endpoint (404 / unreachable) the contract placeholder is shown, marked `atrapa`. */
export async function listProviderDatasets(): Promise<Zbiory> {
  if (usingMocks) return mock.mockZbiory();
  try {
    return await http<Zbiory>(`/zbiory`);
  } catch (e) {
    if (e instanceof Unreachable || (e instanceof HttpError && e.status === 404)) return mock.mockZbiory();
    throw e;
  }
}

export function getStats() {
  return withFallback(async () => {
    // API answers { data: {...} } (JSON API style); older drafts returned the object directly.
    const r = await http<Record<string, unknown>>(`/statystyki`);
    return (r && typeof r.data === 'object' && r.data !== null && !Array.isArray(r.data) ? r.data : r) as Record<string, unknown>;
  }, () => mock.mockStats() as Promise<Record<string, unknown>>);
}

export type ImportMeta = { kodZrodla: string; licencja: string; dysponentNazwa: string; dysponentTyp: string };

export function uploadAndValidate(file: File, m: ImportMeta): Promise<RaportWalidacji> {
  return withFallback(
    async () => {
      const fd = new FormData();
      fd.append('plik', file);
      fd.append('kod_zrodla', m.kodZrodla);
      fd.append('licencja', m.licencja);
      // CR from A: provider name/type fill required fields missing in the file (dysponent_nazwa, dysponent_typ)
      fd.append('dysponent_nazwa', m.dysponentNazwa);
      fd.append('dysponent_typ', m.dysponentTyp);
      fd.append('nazwa_zrodla', m.dysponentNazwa);
      const imp = await http<{ import_id: string; mapowanie_proponowane: RaportWalidacji['mapowanie'] }>(`/import`, { method: 'POST', body: fd });
      const rep = await http<RaportWalidacji>(`/import/${imp.import_id}/mapowanie`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapowanie: imp.mapowanie_proponowane }),
      });
      return { ...rep, import_id: imp.import_id } as RaportWalidacji;
    },
    () => mock.mockValidation(file.name),
  );
}

// ---------- E5 for institutions: file upload with progress, column matching, single AED form ----------
export interface ImportInfo {
  import_id: string; liczba_wierszy: number; kolumny: string[];
  mapowanie_proponowane: Record<string, string | string[]>; podglad: Record<string, unknown>[];
}

/** Server does not support this yet (CR to Model A) – the UI explains what to do instead. */
export class NotSupported extends Error {}

/** Upload with a real progress bar (XMLHttpRequest – fetch has no upload progress). */
export function uploadFile(file: File, m: ImportMeta, onProgress: (pct: number) => void): Promise<ImportInfo> {
  const real = () => new Promise<ImportInfo>((resolve, reject) => {
    const fd = new FormData();
    fd.append('plik', file);
    fd.append('kod_zrodla', m.kodZrodla);
    fd.append('licencja', m.licencja);
    fd.append('dysponent_nazwa', m.dysponentNazwa);
    fd.append('dysponent_typ', m.dysponentTyp);
    fd.append('nazwa_zrodla', m.dysponentNazwa);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/import`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (session) xhr.setRequestHeader('Authorization', `Bearer ${session.token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Unreachable());
    xhr.onload = () => {
      const isJson = (xhr.getResponseHeader('content-type') ?? '').includes('json');
      if (!isJson) { reject(new Unreachable()); return; }
      const body = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(body as ImportInfo); }
      else {
        if (xhr.status === 401 && session) setSession(null);
        reject(new HttpError(xhr.status, body?.error ?? null));
      }
    };
    xhr.send(fd);
  });
  return withFallback(real, async () => { onProgress(100); return mock.mockImportInfo(file.name); });
}

export function confirmMapping(importId: string, mapowanie: Record<string, string | string[]>, fileName: string): Promise<RaportWalidacji> {
  return withFallback(
    async () => ({ ...(await http<RaportWalidacji>(`/import/${importId}/mapowanie`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mapowanie }) })), import_id: importId }),
    () => mock.mockValidation(fileName),
  );
}

async function optional<T>(call: () => Promise<T>): Promise<T> {
  try { return await call(); }
  catch (e) { if (e instanceof HttpError && (e.status === 404 || e.status === 405)) throw new NotSupported(); throw e; }
}

/** CR to A: PATCH /import/{id}/wiersze – fix values in the uploaded rows without uploading the file again. */
export function fixImportRows(importId: string, poprawki: { wiersz: number; pole: string; wartosc: string }[]): Promise<RaportWalidacji> {
  return withFallback(
    () => optional(() => http<RaportWalidacji>(`/import/${importId}/wiersze`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poprawki }) })),
    () => Promise.reject(new NotSupported()),
  );
}

/** CR to A: POST /import/{id}/duplikaty – the institution decides "to samo AED" / "inne AED". */
export function decideDuplicates(importId: string, decyzje: { wiersz: number; decyzja: 'to_samo' | 'inne' }[]): Promise<unknown> {
  return withFallback(
    () => optional(() => http<unknown>(`/import/${importId}/duplikaty`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decyzje }) })),
    () => Promise.reject(new NotSupported()),
  );
}

/** Single AED typed in by an institution (POST /aed, login required). */
export function createAed(record: Record<string, unknown>): Promise<{ id_aed: string }> {
  return withFallback(
    async () => {
      const r = await http<{ data: { id: string } }>(`/aed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
      return { id_aed: r.data.id };
    },
    () => mock.mockCreateAed(),
  );
}

export const exportUrl = (file: string) => `${API_BASE}/eksport/${file}`;

/** Called once at start-up so the UI knows early whether it shows sample data. */
export function probeApi(): Promise<void> {
  return withFallback(() => http<unknown>(`/aed?per_page=1`), () => Promise.resolve(null)).then(() => undefined, () => undefined);
}

export function approveImport(rep: RaportWalidacji): Promise<WynikImportu> {
  return withFallback(
    () => http<WynikImportu>(`/import/${rep.import_id}/zatwierdz`, { method: 'POST' }),
    () => mock.mockApprove(rep),
  );
}

export function listReports() {
  return withFallback(async () => {
    const r = await http<{ data: JsonApiItem<{ lat: number; lon: number; opis: string; czas: string; status: string; zdjecie_url?: string | null;
      godziny_dostepnosci?: string | null; szafka_zamknieta?: boolean | null; instrukcja_dostepu?: string | null }>[] }>(`/zgloszenia`);
    return r.data.map((i) => ({ ...i.attributes, id: i.id }));
  }, () => mock.mockReports());
}

/** Moderator decision. "zatwierdz" needs `rekord` with the address etc. – otherwise the API answers 422 with `fields`. */
/** Decision on a report – never changes AED data (K7). Provider: przyjete | odrzucone; administrator: zaproszenie | odrzucone. */
export function decideReport(id: string, decyzja: 'przyjete' | 'odrzucone' | 'zaproszenie', uzasadnienie?: string) {
  return withFallback(
    () => http<{ meta: { komunikat: string } }>(`/zgloszenia/${encodeURIComponent(id)}/decyzja`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uzasadnienie ? { decyzja, uzasadnienie } : { decyzja }),
    }),
    () => mock.mockDecide(id, decyzja).then(() => ({ meta: { komunikat: 'Zapisano (tryb przykładowy).' } })),
  );
}

/** Login: demo accounts (dysponent / moderator) or an institution account created by a moderator. */
export function login(loginName: string, haslo: string): Promise<Session> {
  return withFallback(
    () => http<{ token: string; rola: Role; login: string; dysponent_nazwa: string | null }>(`/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: loginName, haslo }) }),
    () => mock.mockLogin(loginName, haslo),
  ).then((s) => { setSession(s); return s; });
}

// ---------- moderator panel (HANDOFF A #8) – API only, no sample-mode fallback ----------
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export interface StanOdswiezania {
  w_toku: boolean; ostatnie: string | null; nastepne: string | null; harmonogram: string | null; blad: string | null; powod?: string;
  wynik: null | { osm?: Record<string, unknown>; dane_gov_pl?: { kod_zrodla: string; status: string; dodane?: number; scalone?: number; zaktualizowane?: number; odrzucone?: number; powod?: string }[]; rekordy_przed?: number; rekordy_po?: number };
}
export const refreshStatus = () => http<{ data: StanOdswiezania }>(`/zrodla/odswiezanie`).then((r) => r.data);
export const refreshNow = () => http<{ data: StanOdswiezania & { uruchomiono: boolean }; meta: { komunikat: string } }>(`/zrodla/odswiez`, json('POST'));

export interface ZbiorDgp { id: string; tytul: string; instytucja: string | null; licencja: string | null; licencja_portalu: string | null; strona: string; zmodyfikowano: string | null }
export interface ImportDgp { kod_zrodla: string; status: string; dodane?: number; scalone?: number; zaktualizowane?: number; odrzucone?: number; wiersze?: number; powod?: string }
export const searchDgp = (q: string, importuj: boolean) =>
  http<{ data: ZbiorDgp[]; meta: { count: number; importy: ImportDgp[]; pominiete_niezwiazane?: number; bledy: string[] } }>(`/zrodla/dane-gov-pl/szukaj`, json('POST', { q, importuj }));

export interface Konto { login: string; rola: Role; dysponent_nazwa: string | null; dostawca_podstawa?: PodstawaPublikacji | null; email: string | null; telefon?: string | null; regon?: string | null; aktywne: boolean; oczekuje?: boolean; utworzono: string | null; utworzyl: string | null; liczba_aed: number }
export const listAccounts = () => http<{ data: Konto[] }>(`/konta`).then((r) => r.data);
export const createAccount = (b: { login: string; dysponent_nazwa: string; dostawca_podstawa: PodstawaPublikacji; email?: string }) =>
  http<{ data: Konto; haslo_jednorazowe: string }>(`/konta`, json('POST', b));
export const resetPassword = (login: string) => http<{ data: Konto; haslo_jednorazowe: string }>(`/konta/${encodeURIComponent(login)}/reset-hasla`, json('POST'));
export const setAccountActive = (login: string, aktywne: boolean) => http<{ data: Konto }>(`/konta/${encodeURIComponent(login)}`, json('PATCH', { aktywne }));
export const changeMyPassword = (stare: string, nowe: string) => http<{ ok: boolean }>(`/konta/ja/haslo`, json('POST', { stare, nowe }));

type PointsFC = { features: { id: string; geometry: { coordinates: [number, number] }; properties: Omit<AedPoint, 'id_aed' | 'lat' | 'lon'> }[] };

/** Whole-Poland map layer (gzip + ETag on the server; the browser cache sends If-None-Match by itself). */
export function listPoints(): Promise<AedPoint[]> {
  return withFallback(async () => {
    const r = await http<PointsFC>(`/aed/punkty`);
    return r.features.map((f) => ({ id_aed: f.id, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], ...f.properties }));
  }, () => mock.mockPoints());
}

/** Place search for the map and "Znajdź AED": voivodeships, gminy, localities, streets, addresses (GET /miejsca). */
export function searchPlaces(q: string, blisko?: { lat: number; lon: number } | null): Promise<Miejsce[]> {
  return withFallback(async () => {
    const r = await http<{ data: Miejsce[] }>(`/miejsca${qs({ q, blisko: blisko ? `${blisko.lat.toFixed(5)},${blisko.lon.toFixed(5)}` : undefined })}`);
    return r.data;
  }, () => mock.mockPlaces(q));
}

/** Full records for the given ids, in the same order (list next to the map: what is visible on the map). */
export function listAedByIds(ids: string[]): Promise<AedView[]> {
  if (!ids.length) return Promise.resolve([]);
  return withFallback(async () => {
    const r = await http<{ data: JsonApiItem<AedView>[] }>(`/aed${qs({ ids: ids.join(','), per_page: ids.length, warstwa: 'wszystkie' })}`);
    return r.data.map(flat);
  }, () => mock.mockByIds(ids));
}

/** ids matching a text search (name, street, town, provider) or a gmina – intersected with the map points. */
export function searchAedIds(q: string, gmina: string): Promise<Set<string>> {
  return withFallback(async () => {
    const r = await http<{ data: { id: string }[] }>(`/aed${qs({ q, gmina, per_page: 1000 })}`);
    return new Set(r.data.map((d) => d.id));
  }, async () => new Set((await mock.mockListAed({ q, gmina, per_page: 1000 })).items.map((a) => a.id_aed)));
}

/** Municipality coverage layer (data-freshness map mode). null = no boundaries for this voivodeship / sample mode. */
export function getCoverage(wojewodztwo = 'kujawsko-pomorskie'): Promise<Pokrycie | null> {
  return withFallback(async () => {
    try { return await http<Pokrycie>(`/pokrycie${qs({ wojewodztwo })}`); }
    catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
  }, () => Promise.resolve(null));
}

export const templateUrl = (fmt: 'csv' | 'xlsx') => `${API_BASE}/szablon.${fmt}`;


// ---------- docs/MODEL_ROL.md: provider's wizard ("Moje AED") and administrator panel – API only ----------
export interface RaportZbioru {
  zbior_id: string; tytul: string; dostawca: string | null; zbior_url?: string; status: 'wlaczony' | 'przejsciowy' | 'odrzucony' | 'poza_lista' | 'blad';
  rekordy: number | null; wlaczone: number; odrzucone: number; nieaktualny: boolean | null; czestotliwosc?: string; zmodyfikowany?: string;
  problemy: string[]; problemy_rekordow: { wiersz: number; id_aed: string | null; problemy: string[] }[]; fikcyjny?: boolean;
}
export interface AedRoboczy { id: string; attributes: Aed; meta: { zgodny_ze_wzorcem: boolean; problemy: string[]; na_liscie: boolean } }
export const myAed = () => http<{ data: AedRoboczy[]; meta: { dostawca: string; w_kopii_roboczej: number; na_wspolnej_liscie: number; raport_agregacji: RaportZbioru[]; agregacja_z: string | null } }>(`/moje-aed`);
export const loadPublished = () => http<{ data: { wczytano: number } }>(`/moje-aed/z-opublikowanego`, json('POST'));
export const deleteMyAed = (id: string) => http<{ ok: boolean }>(`/moje-aed/${encodeURIComponent(id)}`, json('DELETE'));
export const patchMyAed = (id: string, changes: Record<string, unknown>) => http<{ data: AedRoboczy }>(`/aed/${encodeURIComponent(id)}`, json('PATCH', changes));
export interface Powiadomienie { id: number; typ: 'zgloszenie' | 'potwierdzenie' | 'duplikat' | 'walidacja' | 'przypomnienie' | 'wzorzec' | 'konto' | 'zgloszenie_aed'; tresc: string; czas: string; przeczytane: boolean }
export const myNotifications = () => http<{ data: Powiadomienie[] }>(`/moje-aed/powiadomienia`).then((r) => r.data);

/** "Pobierz pliki do publikacji" – a ZIP the provider publishes ITSELF on its dane.gov.pl account (K11). */
export async function downloadPackage(o: { czestotliwosc: string; licencja: string; csv_url?: string; email?: string }): Promise<{ blob: Blob; name: string }> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (session) headers.set('Authorization', `Bearer ${session.token}`);
  const res = await fetch(`${API_BASE}/moje-aed/pakiet`, { method: 'POST', headers, body: JSON.stringify(o) });
  if (!res.ok) {
    const body = (res.headers.get('content-type') ?? '').includes('json') ? ((await res.json()) as { error?: ApiError }) : null;
    throw new HttpError(res.status, body?.error ?? null);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  return { blob: await res.blob(), name: /filename="([^"]+)"/.exec(cd)?.[1] ?? 'pliki-do-publikacji.zip' };
}

export const runAggregation = () => http<{ data: { czas: string; rekordy: number; zbiory: RaportZbioru[] } }>(`/admin/agregacja`, json('POST')).then((r) => r.data);
export const aggregationReport = () => http<{ data: { czas: string | null; zbiory: RaportZbioru[] } }>(`/admin/agregacja`).then((r) => r.data);
export interface Luka { teryt: string; gmina: string; wojewodztwo: string; rodzaj?: string; do_sprawdzenia: number }
export const listGaps = (wojewodztwo?: string) => http<{ data: Luka[]; meta: { luki: number; gminy: number | null; zaproszenia: number } }>(`/admin/luki${qs({ wojewodztwo, limit: 200 })}`);
export const lateDatasets = () => http<{ data: RaportZbioru[] }>(`/admin/przypomnienia`).then((r) => r.data);
export const sendReminders = () => http<{ data: { wyslano: string[] } }>(`/admin/przypomnienia`, json('POST')).then((r) => r.data);
export interface Zdarzenie { id: number; czas: string; kto: string; rola: string | null; operacja: string; obiekt: string | null; przed: unknown; po: unknown }
export const eventLog = () => http<{ data: Zdarzenie[] }>(`/dziennik?limit=100`).then((r) => r.data);

// ---------- CR-TL-8: trusted institution accounts and "Zgłoś AED" (HANDOFF A #11) ----------
export interface WniosekIn { nazwa_instytucji: string; regon: string; podstawa: PodstawaPublikacji; email_sluzbowy: string; telefon: string; login: string; haslo: string }
export interface Wniosek extends Omit<WniosekIn, 'haslo'> { id: string; status: 'oczekuje' | 'zatwierdzony' | 'odrzucony'; utworzono: string; uzasadnienie: string | null; kto: string | null; kiedy: string | null }
export const requestAccount = (b: WniosekIn) => http<{ id: string; status: string; meta: { komunikat: string } }>(`/konta/wnioski`, json('POST', b));
export const listAccountRequests = (status?: string) => http<{ data: Wniosek[] }>(`/konta/wnioski${qs({ status })}`).then((r) => r.data);
export const decideAccountRequest = (id: string, decyzja: 'zatwierdz' | 'odrzuc', uzasadnienie?: string) =>
  http<{ data: Wniosek }>(`/konta/wnioski/${encodeURIComponent(id)}/decyzja`, json('POST', { decyzja, ...(uzasadnienie ? { uzasadnienie } : {}) }));
export const addEmployee = (login: string, email?: string) =>
  http<{ data: Konto; haslo_jednorazowe: string }>(`/konta/ja/uzytkownicy`, json('POST', { login, ...(email ? { email } : {}) }));

export interface ZgloszenieAedIn {
  typ?: 'nowe' | 'zmiana'; id_aed?: string | null; organizacja?: string | null;
  nazwa_obiektu: string; ulica: string | null; numer_budynku: string; kod_pocztowy: string; miejscowosc: string; szerokosc: number; dlugosc: number;
  opis_lokalizacji: string; wewnatrz_budynku: boolean; dostep: 'publiczny' | 'ograniczony' | 'prywatny'; dostepny_24h: boolean; godziny: string | null;
  szafka_zamknieta: boolean; instrukcja_dostepu: string | null; zdjecie: string | null;
}
export interface ZgloszenieAed extends Omit<ZgloszenieAedIn, 'zdjecie'> {
  id: string; status: 'oczekuje' | 'zatwierdzone' | 'do_poprawy' | 'odrzucone'; nadawca_login: string; nadawca_rola?: Role; organizacja: string; utworzono: string; teryt_terc: string;
  typ: 'nowe' | 'zmiana'; obecne?: Partial<Aed> | null;
  decyzja: 'zatwierdz' | 'do_poprawy' | 'odrzuc' | null; komentarz: string | null; kto: string | null; kiedy: string | null; id_aed: string | null;
  zdjecie_url: string | null; historia: { decyzja: string; komentarz: string | null; kto: string | null; kiedy: string | null }[];
}
export const submitAed = (b: ZgloszenieAedIn) => http<{ id: string; data: ZgloszenieAed; meta: { komunikat: string } }>(`/zgloszenia-aed`, json('POST', b));
export const resubmitAed = (id: string, b: ZgloszenieAedIn) => http<{ data: ZgloszenieAed }>(`/zgloszenia-aed/${encodeURIComponent(id)}`, json('PUT', b));
export const mySubmissions = () => http<{ data: ZgloszenieAed[] }>(`/moje-zgloszenia`).then((r) => r.data);
export const adminSubmissions = (status = 'oczekuje') => http<{ data: ZgloszenieAed[] }>(`/admin/zgloszenia-aed${qs({ status })}`).then((r) => r.data);
export const decideSubmission = (id: string, decyzja: 'zatwierdz' | 'do_poprawy' | 'odrzuc', komentarz?: string) =>
  http<{ data: ZgloszenieAed }>(`/admin/zgloszenia-aed/${encodeURIComponent(id)}/decyzja`, json('POST', { decyzja, ...(komentarz ? { komentarz } : {}) }));
/** photo links from the API are relative to the server root ("/api/v1/…") */
export const apiUrl = (path: string) => (path.startsWith('/api/v1') ? API_BASE + path.slice('/api/v1'.length) : path);

export interface Adres { ulica: string | null; numer_budynku: string | null; kod_pocztowy: string | null; miejscowosc: string | null; gmina: string | null;
  wojewodztwo: string | null; teryt_terc: string | null; lat: number | null; lon: number | null; odleglosc_m: number | null }
export const reverseGeocode = (lat: number, lon: number) => http<{ data: Adres }>(`/miejsca/odwrotnie${qs({ lat, lon })}`).then((r) => r.data);
/** address → candidates with coordinates (GET /miejsca; address results carry ulica / numer / kod / miejscowość) */
export const geocodeAddress = (q: string) =>
  http<{ data: (Miejsce & Partial<Adres> & { teryt_terc?: string | null })[] }>(`/miejsca${qs({ q, limit: 5 })}`).then((r) => r.data);

// ---------- owner's decision 22.11 (HANDOFF A #12): institution's AED, administrator's AED list and accounts ----------
export interface MojeUrzadzenie { id: string; attributes: Aed; meta?: AedMeta; zgloszenie: { id: string; status: ZgloszenieAed['status']; komentarz: string | null } | null }
export const myDevices = () => http<{ data: MojeUrzadzenie[] }>(`/moje-urzadzenia`).then((r) => r.data.map((d) => ({ ...d, aed: flat(d as unknown as JsonApiItem<AedView>) })));
export interface AedAdmin { id_aed: string; nazwa_obiektu: string | null; adres: string; miejscowosc: string | null; gmina: string | null;
  warstwa: 'lista' | 'pomocnicza' | 'aplikacja'; organizacja: string | null; edytowane: boolean; data_weryfikacji: string | null; szerokosc: number; dlugosc: number }
export const adminAedList = (p: { q?: string; organizacja?: string; warstwa?: string; page?: number; per_page?: number }) =>
  http<{ data: AedAdmin[]; meta: { count: number; page: number; per_page: number } }>(`/admin/aed${qs(p)}`);
export const adminAedEdit = (id: string, pola: Record<string, unknown>) => http<{ data: unknown }>(`/admin/aed/${encodeURIComponent(id)}`, json('PATCH', { pola }));
export const adminAedDelete = (id: string) => http<{ ok: boolean }>(`/admin/aed/${encodeURIComponent(id)}`, json('DELETE'));
export const adminAedAssign = (id: string, organizacja: string | null) =>
  http<{ data: { organizacja: string | null } }>(`/admin/aed/${encodeURIComponent(id)}/przypisanie`, json('PUT', { organizacja }));
export const updateAccount = (login: string, ch: Partial<{ aktywne: boolean; dysponent_nazwa: string; email: string; telefon: string; regon: string;
  dostawca_podstawa: PodstawaPublikacji; nowy_login: string; haslo: string }>) => http<{ data: Konto }>(`/konta/${encodeURIComponent(login)}`, json('PATCH', ch));
export const deleteAccount = (login: string) => http<{ ok: boolean }>(`/konta/${encodeURIComponent(login)}`, json('DELETE'));

