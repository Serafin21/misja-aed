import type { Aed, AedView } from '../api/types';
import slowniki from '../mocks/slowniki.json';
import { isOpenNow } from './hours';

type Dict = Record<string, { wartosc: string; znaczenie: string }[]>;
const DICT = slowniki as Dict;

export function dictValues(name: string): { wartosc: string; znaczenie: string }[] {
  return DICT[name] ?? [];
}

export function dictMeaning(name: string, value: string | null | undefined): string {
  if (!value) return '';
  return DICT[name]?.find((d) => d.wartosc === value)?.znaczenie ?? '';
}

const LABELS: Record<string, Record<string, string>> = {
  dostep: { publiczny: 'publiczny', ograniczony: 'ograniczony', prywatny: 'prywatny' },
  status_urzadzenia: { sprawny: 'sprawny', w_serwisie: 'w serwisie', niesprawny: 'niesprawny', nieznany: 'nieznany' },
  dysponent_typ: {
    administracja_publiczna: 'administracja publiczna', szkola_placowka_oswiatowa: 'szkoła lub placówka oświatowa',
    uczelnia: 'uczelnia', podmiot_leczniczy: 'podmiot leczniczy', sluzby_ratownicze: 'służby ratownicze',
    transport: 'transport', handel_uslugi: 'handel i usługi', sport_rekreacja: 'sport i rekreacja', kultura: 'kultura',
    zaklad_pracy: 'zakład pracy', organizacja_pozarzadowa: 'organizacja pozarządowa', inny: 'inny',
  },
  zrodlo_danych: {
    dysponent: 'dysponent AED', dane_gov_pl: 'dane.gov.pl', osm: 'OpenStreetMap',
    zgloszenie_obywatela: 'zgłoszenie obywatela', inne: 'inne źródło',
  },
  metoda_weryfikacji: {
    deklaracja_dysponenta: 'deklaracja dysponenta', wizja_lokalna: 'wizja lokalna', zdjecie: 'zdjęcie',
    zgloszenie_obywatela: 'zgłoszenie obywatela', import_automatyczny: 'import automatyczny',
  },
};

export function label(dict: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'brak danych';
  return LABELS[dict]?.[value] ?? value.replace(/_/g, ' ');
}

export function address(a: Pick<Aed, 'ulica_cecha' | 'ulica' | 'numer_budynku' | 'numer_lokalu' | 'kod_pocztowy' | 'miejscowosc'>): string {
  // Records from OpenStreetMap often have no address – skip empty parts instead of printing "null".
  const j = (...parts: (string | null | undefined)[]) => parts.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').join(' ');
  const cecha = a.ulica_cecha && a.ulica_cecha !== 'inne' ? a.ulica_cecha : null;
  const nr = a.numer_budynku ? `${a.numer_budynku}${a.numer_lokalu ? `/${a.numer_lokalu}` : ''}` : null;
  const street = a.ulica ? j(cecha, a.ulica, nr) : j(a.miejscowosc, nr);
  const town = j(a.kod_pocztowy, a.miejscowosc);
  const out = [street, town].filter(Boolean).join(', ');
  return out || 'Brak adresu w danych – sprawdź położenie na mapie';
}

export function distance(m: number | undefined): string {
  if (m === undefined || Number.isNaN(m)) return '';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km`;
}

export function date(d: string | null | undefined): string {
  if (!d) return 'brak danych';
  const [y, mo, day] = d.slice(0, 10).split('-');
  const time = d.length > 10 ? `, ${d.slice(11, 16)}` : '';
  return `${day}.${mo}.${y}${time}`;
}

export function floor(p: number | null): string {
  if (p === null || p === undefined) return '';
  if (p === 0) return 'parter';
  if (p < 0) return `poziom ${p}`;
  return `${p}. piętro`;
}

/** Availability: server value (CR-B1) if present, otherwise computed like CONTRACT §7. */
export function availableNow(a: AedView): boolean | null {
  if (a.dostepny_teraz !== undefined) return a.dostepny_teraz;
  if (a.status_urzadzenia === 'niesprawny' || a.status_urzadzenia === 'w_serwisie') return false;
  if (a.dostep === 'prywatny') return false;
  if (a.dostepny_24h) return true;
  return isOpenNow(a.godziny_dostepnosci);
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function osmDirections(from: { lat: number; lon: number } | null, to: { lat: number; lon: number }): string {
  const dest = `${to.lat.toFixed(6)},${to.lon.toFixed(6)}`;
  if (!from) return `https://www.openstreetmap.org/?mlat=${to.lat}&mlon=${to.lon}#map=19/${to.lat}/${to.lon}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${from.lat.toFixed(6)},${from.lon.toFixed(6)};${dest}`;
}

/** Owner's decision 22.11: an AED without a real name shows this text (never the description or the owner as a name). */
export const NO_NAME = 'Brak nazwy urządzenia';
export function aedName(n: string | null | undefined): string {
  return n && n.trim() ? n : NO_NAME;
}
