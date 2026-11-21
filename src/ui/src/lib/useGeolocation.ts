// Shared location hook (CR-TL-8 p. 7) for "Znajdź AED" and "Zgłoś AED". watchPosition with high accuracy and no cache;
// collects readings for up to 20 s or until accuracy ≤ 30 m and keeps the best one. Geolocation works only in a secure
// context (https or localhost) – on a phone over plain http the browser refuses it, so we say so and ask for an address.
import { useCallback, useEffect, useRef, useState } from 'react';

export interface GeoFix { lat: number; lon: number; accuracy: number }
export type GeoStatus = 'idle' | 'locating' | 'done' | 'error';
export interface GeoState { status: GeoStatus; fix: GeoFix | null; message: string; approximate: boolean }

const MAX_MS = 20000;
const GOOD_M = 30;
const APPROX_M = 1000;

const metres = (m: number) => `±${Math.round(m).toLocaleString('pl-PL')} m`;

function finalMessage(f: GeoFix): string {
  return f.accuracy > APPROX_M
    ? `Lokalizacja przybliżona – wpisz adres (dokładność ${metres(f.accuracy)}).`
    : `Lokalizacja ustalona, dokładność ${metres(f.accuracy)}.`;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle', fix: null, message: '', approximate: false });
  const watch = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const best = useRef<GeoFix | null>(null);
  const done = useRef<((f: GeoFix | null) => void) | null>(null);

  const clear = useCallback(() => {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    if (timer.current !== null) window.clearTimeout(timer.current);
    watch.current = null; timer.current = null;
  }, []);

  const finish = useCallback((errorMessage?: string) => {
    clear();
    const f = best.current;
    if (f) setState({ status: 'done', fix: f, message: finalMessage(f), approximate: f.accuracy > APPROX_M });
    else setState({ status: 'error', fix: null, message: errorMessage ?? 'Nie udało się ustalić lokalizacji. Wpisz adres.', approximate: false });
    done.current?.(f);
    done.current = null;
  }, [clear]);

  /** Start locating; `onDone` gets the best reading (or null) when locating ends. */
  const start = useCallback((onDone?: (f: GeoFix | null) => void) => {
    clear();
    best.current = null;
    done.current = onDone ?? null;
    if (!window.isSecureContext) {
      setState({ status: 'error', fix: null, approximate: false, message: 'Lokalizacja działa tylko na stronie z adresem https (albo localhost). Wpisz adres.' });
      onDone?.(null); done.current = null; return;
    }
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', fix: null, approximate: false, message: 'Ta przeglądarka nie podaje lokalizacji. Wpisz adres.' });
      onDone?.(null); done.current = null; return;
    }
    setState({ status: 'locating', fix: null, approximate: false, message: 'Ustalam lokalizację…' });
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const f: GeoFix = { lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), accuracy: p.coords.accuracy };
        if (!best.current || f.accuracy < best.current.accuracy) best.current = f;
        const b = best.current;
        if (b.accuracy <= GOOD_M) { finish(); return; }
        setState({ status: 'locating', fix: b, approximate: false, message: `Ustalam lokalizację… dokładność ${metres(b.accuracy)}` });
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          best.current = null;
          finish('Nie zgodzono się na udostępnienie lokalizacji. Wpisz adres albo zezwól na lokalizację w ustawieniach przeglądarki.');
        } else if (!best.current && e.code === e.POSITION_UNAVAILABLE) {
          finish('Telefon nie podał lokalizacji. Wpisz adres.');
        }
        // TIMEOUT or a later error: keep waiting for the 20 s limit, the best reading so far wins
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_MS },
    );
    timer.current = window.setTimeout(() => finish(), MAX_MS);
  }, [clear, finish]);

  useEffect(() => clear, [clear]);

  return { ...state, start, stop: () => finish() };
}
