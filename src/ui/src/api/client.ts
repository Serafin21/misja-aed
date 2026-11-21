// REST client for CONTRACT §5. Falls back to in-browser mocks (data/sample/) when the API is unreachable.
import * as mock from '../mocks/mockApi';
import type { Aed, AedDetail, AedFilters, AedView, ApiError, ListMeta, Potwierdzenie, RaportWalidacji, Zrodlo } from './types';

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
}

class Unreachable extends Error {}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { headers: { Accept: 'application/json', ...(init?.headers ?? {}) }, ...init });
  } catch {
    throw new Unreachable();
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!isJson && (res.status === 404 || res.status >= 500 || res.ok)) throw new Unreachable(); // dev server / proxy without backend
  if (!res.ok) {
    const body = isJson ? ((await res.json()) as { error?: ApiError }) : null;
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

type JsonApiItem<T> = { type: string; id: string; attributes: T };
const flat = <T extends object>(i: JsonApiItem<T>) => ({ ...(i.attributes as T), id_aed: i.id } as T & { id_aed: string });

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
  return withFallback(() => http<Record<string, unknown>>(`/statystyki`), () => mock.mockStats() as Promise<Record<string, unknown>>);
}

export function uploadAndValidate(file: File, kodZrodla: string, licencja: string): Promise<RaportWalidacji> {
  return withFallback(
    async () => {
      const fd = new FormData();
      fd.append('plik', file);
      fd.append('kod_zrodla', kodZrodla);
      fd.append('licencja', licencja);
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
