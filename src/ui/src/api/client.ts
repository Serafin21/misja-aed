// REST client for CONTRACT §5. Falls back to in-browser mocks (data/sample/) when the API is unreachable.
import * as mock from '../mocks/mockApi';
import type { WynikImportu, Aed, AedDetail, AedFilters, AedPoint, AedView, ApiError, ListMeta, Pokrycie, Potwierdzenie, RaportWalidacji, Zrodlo } from './types';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const API_BASE = env.VITE_API_BASE || '/api/v1';
const MODE = env.VITE_USE_MOCKS ?? ''; // "1" mocks, "0" API only, "" auto

let usingMocks = MODE === '1';
const listeners = new Set<(m: boolean) => void>();
export const isMockMode = () => usingMocks;
export function onMockModeChange(fn: (m: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function setMock(v: boolean) { if (usingMocks !== v) { usingMocks = v; listeners.forEach((l) => l(v)); } }

export class HttpError extends Error {
  constructor(public status: number, public body: ApiError | null) { super(body?.message ?? `Błąd ${status}`); }
  /** Field-level messages from a 422 response ({ pole: komunikat }). */
  get fields(): Record<string, string> { return this.body?.fields ?? {}; }
}

class Unreachable extends Error {}

// ---------- auth (CONTRACT: POST /auth/login → Bearer token) ----------
export type Role = 'dysponent' | 'moderator';
export type Session = { token: string; rola: Role } | null;
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

type ItemMeta = { stan_danych?: AedView['stan_danych']; wiek_danych_dni?: number | null };
type JsonApiItem<T> = { type: string; id: string; attributes: T; meta?: ItemMeta };
// CR-TL-1: freshness lives in meta – copy it next to the attributes
const flat = <T extends object>(i: JsonApiItem<T>) => ({
  ...(i.attributes as T), id_aed: i.id,
  ...(i.meta?.stan_danych ? { stan_danych: i.meta.stan_danych, wiek_danych_dni: i.meta.wiek_danych_dni ?? null } : {}),
} as T & { id_aed: string } & ItemMeta);

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

export function nearestAed(lat: number, lon: number, limit = 5, onlyNow = false) {
  return withFallback(
    async () => {
      const r = await http<{ data: JsonApiItem<AedView>[] }>(`/aed/najblizsze${qs({ lat: lat.toFixed(6), lon: lon.toFixed(6), limit, tylko_dostepne_teraz: onlyNow })}`);
      return r.data.map(flat);
    },
    () => mock.mockNearest(lat, lon, limit, onlyNow),
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

export function reportAed(lat: number, lon: number, opis: string) {
  return withFallback(
    () => http<{ id: string; status: string }>(`/zgloszenia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lon, opis }) }),
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
    const r = await http<{ data: JsonApiItem<{ lat: number; lon: number; opis: string; czas: string; status: string }>[] }>(`/zgloszenia`);
    return r.data.map((i) => ({ ...i.attributes, id: i.id }));
  }, () => mock.mockReports());
}

/** Moderator decision. "zatwierdz" needs `rekord` with the address etc. – otherwise the API answers 422 with `fields`. */
export function decideReport(id: string, decyzja: 'zatwierdz' | 'odrzuc' | 'scal', rekord?: Record<string, unknown>) {
  return withFallback(
    () => http<unknown>(`/zgloszenia/${encodeURIComponent(id)}/decyzja`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rekord ? { decyzja, rekord } : { decyzja }),
    }),
    () => mock.mockDecide(id, decyzja, rekord),
  );
}

export function login(loginName: Role, haslo: string): Promise<Session> {
  return withFallback(
    () => http<{ token: string; rola: Role }>(`/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: loginName, haslo }) }),
    () => mock.mockLogin(loginName, haslo),
  ).then((s) => { setSession(s); return s; });
}

type PointsFC = { features: { id: string; geometry: { coordinates: [number, number] }; properties: { dostepny_teraz: boolean | null; stan_danych: AedPoint['stan_danych']; osm: boolean } }[] };

/** Whole-Poland map layer (gzip + ETag on the server; the browser cache sends If-None-Match by itself). */
export function listPoints(): Promise<AedPoint[]> {
  return withFallback(async () => {
    const r = await http<PointsFC>(`/aed/punkty`);
    return r.features.map((f) => ({ id_aed: f.id, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], ...f.properties }));
  }, () => mock.mockPoints());
}

/** Municipality coverage layer (data-freshness map mode). null = no boundaries for this voivodeship / sample mode. */
export function getCoverage(wojewodztwo = 'kujawsko-pomorskie'): Promise<Pokrycie | null> {
  return withFallback(async () => {
    try { return await http<Pokrycie>(`/pokrycie${qs({ wojewodztwo })}`); }
    catch (e) { if (e instanceof HttpError && e.status === 404) return null; throw e; }
  }, () => Promise.resolve(null));
}

export const templateUrl = (fmt: 'csv' | 'xlsx') => `${API_BASE}/szablon.${fmt}`;
