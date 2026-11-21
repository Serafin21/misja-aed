// CR-TL-1 / CONTRACT §8: data freshness. The API sends meta.stan_danych; in sample (mock) mode we compute it
// the same way as src/core/coverage.py: age = today (Europe/Warsaw) − data_weryfikacji; ≤ 365 days = "aktualne",
// otherwise and when the date is missing or unreadable = "nieaktualne".
import type { Aed } from '../api/types';

export type DataState = 'aktualne' | 'nieaktualne';
export const FRESH_DAYS = 365;

function todayWarsaw(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function toUtcDays(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null; // e.g. 2026-02-31
  return Math.round(t / 86_400_000);
}

export function ageDays(dataWeryfikacji: string | null | undefined): number | null {
  if (!dataWeryfikacji) return null;
  const d = toUtcDays(String(dataWeryfikacji));
  const today = toUtcDays(todayWarsaw());
  return d === null || today === null ? null : today - d;
}

export function computeState(dataWeryfikacji: string | null | undefined): DataState {
  const age = ageDays(dataWeryfikacji);
  return age !== null && age <= FRESH_DAYS ? 'aktualne' : 'nieaktualne';
}

type WithState = Pick<Aed, 'data_weryfikacji'> & { stan_danych?: DataState | null };

export function dataState(a: WithState): DataState {
  return a.stan_danych ?? computeState(a.data_weryfikacji);
}

/** "Dane z 11.2026" / "Dane nieaktualne" + a longer description (for screen readers and the card). */
export function dataLabel(a: WithState): { state: DataState; short: string; long: string } {
  const state = dataState(a);
  const m = a.data_weryfikacji ? /^(\d{4})-(\d{2})-(\d{2})/.exec(a.data_weryfikacji) : null;
  const when = m ? `${m[3]}.${m[2]}.${m[1]}` : null;
  if (state === 'aktualne' && m) {
    return { state, short: `Dane z ${m[2]}.${m[1]}`, long: `Dane aktualne – ostatnia weryfikacja ${when}` };
  }
  return {
    state: 'nieaktualne',
    short: 'Dane nieaktualne',
    long: when
      ? `Dane nieaktualne – ostatnia weryfikacja ${when}${(ageDays(a.data_weryfikacji) ?? 0) > FRESH_DAYS ? ', ponad rok temu' : ''}`
      : 'Dane nieaktualne – brak daty weryfikacji',
  };
}
