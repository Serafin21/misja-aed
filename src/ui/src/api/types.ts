// Types follow docs/CONTRACT.md v1.0 (record = wzorcowy zakres danych v0.9, 44 pola).
// Replace with generated types from docs/tech/openapi.json when Model A publishes it.

export type Dostep = 'publiczny' | 'ograniczony' | 'prywatny';
export type StatusUrzadzenia = 'sprawny' | 'w_serwisie' | 'niesprawny' | 'nieznany';

export interface Aed {
  id_aed: string;
  id_dysponenta_aed: string | null;
  nazwa_obiektu: string;
  opis_lokalizacji: string;
  pietro: number | null;
  wewnatrz_budynku: boolean;
  wojewodztwo: string;
  powiat: string | null;
  gmina: string;
  miejscowosc: string;
  ulica_cecha: string | null;
  ulica: string | null;
  numer_budynku: string;
  numer_lokalu: string | null;
  kod_pocztowy: string;
  teryt_terc: string | null;
  teryt_simc: string | null;
  szerokosc_geograficzna: number;
  dlugosc_geograficzna: number;
  dostep: Dostep;
  godziny_dostepnosci: string;
  dostepny_24h: boolean;
  szafka_zamknieta: boolean;
  instrukcja_dostepu: string | null;
  mobilny: boolean;
  status_urzadzenia: StatusUrzadzenia;
  tryb_pediatryczny: boolean | null;
  producent: string | null;
  model: string | null;
  data_waznosci_elektrod: string | null;
  data_ostatniego_przegladu: string | null;
  dysponent_nazwa: string;
  dysponent_typ: string;
  dysponent_regon: string | null;
  kontakt_telefon: string | null;
  kontakt_email: string | null;
  zrodlo_danych: string;
  licencja: string;
  data_weryfikacji: string | null;
  metoda_weryfikacji: string;
  data_aktualizacji: string;
  kompletnosc: number | null;
  zdjecie_url: string | null;
  uwagi: string | null;
}

/** Record as shown in UI: server may add computed fields (CR-B1). */
/** docs/MODEL_ROL.md §7: provenance of a common-list record, or the helper-layer notice (meta of GET /aed…). */
export interface AedMeta {
  warstwa?: 'lista' | 'pomocnicza'; komunikat_warstwy?: string; atrybucja?: string;
  dostawca?: string; dostawca_regon?: string | null; zbior_id?: string; zbior_tytul?: string; zbior_url?: string; zasob_url?: string;
  data_danych?: string | null; zbior_zmodyfikowany?: string | null; czestotliwosc_aktualizacji?: string | null; zbior_nieaktualny?: boolean;
  licencja_zbioru?: string | null; mozliwe_duplikaty?: string[]; fikcyjny_dostawca?: boolean;
  /** CR-TL-5: 'przejsciowy' = dataset published before the template; provider data shown unchanged */
  zgodnosc?: 'wzorzec' | 'przejsciowy';
  /** CR-TL-6: on what basis the provider publishes this record */
  dostawca_podstawa?: PodstawaPublikacji;
}

/** CR-TL-6: owner, manager with a contract, or an organisation that verified the AED on site */
export type PodstawaPublikacji = 'wlasciciel' | 'zarzadca' | 'weryfikujacy';
export const PODSTAWA_LABEL: Record<PodstawaPublikacji, string> = {
  wlasciciel: 'właściciel', zarzadca: 'zarządca z umową', weryfikujacy: 'weryfikuje na miejscu',
};

/** GET /zbiory (CR-TL-5) – provider datasets and their status on the common list */
export type StatusZbioru = 'wzorzec' | 'przejsciowy' | 'poza_lista';
export interface ZbiorDostawcy {
  zbior_id: string; tytul: string; dostawca: string; zbior_url: string | null; status: StatusZbioru;
  nieaktualny: boolean; rekordy: number; data_danych: string | null; licencja: string | null; problemy: string[];
}
export interface Zbiory {
  data: ZbiorDostawcy[];
  meta: { agregacja?: string | null; warstwa_pomocnicza?: { zrodlo: string; licencja: string; obiekty: number } };
  /** set by the client when the API has no /zbiory yet and the contract placeholder is shown */
  atrapa?: boolean;
}

export interface AedView extends Aed {
  /** provenance (list) or "Do sprawdzenia" (helper layer) */
  meta?: AedMeta;
  /** true / false / null (hours not interpretable) – CONTRACT §7 */
  dostepny_teraz?: boolean | null;
  odleglosc_m?: number;
  /** CR-TL-1 (CONTRACT §8): from meta – verification ≤ 365 days = aktualne */
  stan_danych?: 'aktualne' | 'nieaktualne';
  wiek_danych_dni?: number | null;
}

/** GET /aed/punkty (CR-TL-2) – light map layer; details come from GET /aed/{id} on click */
export interface AedPoint {
  id_aed: string; lat: number; lon: number; dostepny_teraz: boolean | null; stan_danych: 'aktualne' | 'nieaktualne'; osm: boolean;
  /** HANDOFF A #6 – for filters next to the map (older API: undefined) */
  dostep?: Dostep | null; wiek_danych_dni?: number | null; mobilny?: boolean; wojewodztwo?: string | null;
  /** docs/MODEL_ROL.md: 'lista' or helper layer 'pomocnicza' (= osm); dataset past its update date; possible duplicate */
  warstwa?: 'lista' | 'pomocnicza'; zbior_nieaktualny?: boolean; duplikat?: boolean; zgodnosc?: 'wzorzec' | 'przejsciowy';
  /** name of the object (HANDOFF A #12) – alphabetical list */
  nazwa?: string | null;
  /** TERYT of the gmina the AED lies in (HANDOFF A #7) */
  gmina_teryt?: string | null;
}

/** GET /miejsca – place search (HANDOFF A #7) */
export type TypMiejsca = 'wojewodztwo' | 'gmina' | 'miejscowosc' | 'ulica' | 'adres';
export interface Miejsce {
  typ: TypMiejsca; nazwa: string; opis: string; lat: number; lon: number;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number] | null;
  teryt?: string; wojewodztwo?: string | null; liczba_aed?: number;
}

/** GET /pokrycie – municipalities (PRG) with AED coverage, CONTRACT §8 */
export type StanGminy = 'brak_danych' | 'nieaktualne' | 'aktualne';
export interface GminaProps { teryt: string; gmina: string; wojewodztwo: string; rodzaj?: string; liczba_aed: number; aktualne: number; nieaktualne: number; stan: StanGminy }
export interface Pokrycie {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: GminaProps; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }[];
  meta?: { wojewodztwo?: string; liczba_gmin?: number; gminy_wg_stanu?: Record<StanGminy, number>; prog_aktualnosci_dni?: number; atrybucja?: string };
}

export interface Pochodzenie {
  id_aed: string;
  kod_zrodla: string;
  id_w_zrodle: string;
  licencja_zrodla: string;
  data_pobrania: string;
  rekord_nadrzedny: string | boolean;
}

export interface AedDetail {
  aed: AedView;
  pochodzenie: Pochodzenie[];
  potwierdzenia: { liczba: number; ostatnie: string | null };
}

export interface ListMeta {
  count: number;
  page: number;
  per_page: number;
  dostepne_teraz_liczone_na?: string;
}

export interface AedFilters {
  q?: string;
  wojewodztwo?: string;
  gmina?: string;
  dostep?: string;
  dostepne_teraz?: boolean;
  pokaz_mobilne?: boolean;
  page?: number;
  per_page?: number;
}

export interface Zrodlo {
  kod_zrodla: string;
  nazwa: string;
  typ_zrodla: string;
  format: string;
  licencja: string;
  czestotliwosc_aktualizacji: string;
  liczba_rekordow: string | number;
  rekordy_wlaczone: string | number;
  pokrycie_pol_wymaganych_proc: string | number;
  pokrycie_pol_zalecanych_proc: string | number;
  obszar: string;
}

export interface Potwierdzenie {
  jest_na_miejscu: boolean;
  szafka_dostepna: boolean | null;
  komentarz: string;
}

export interface Zgloszenie {
  lat: number;
  lon: number;
  opis: string;
}

export interface ProblemWalidacji {
  wiersz: number;
  pole: string;
  poziom: 'blad' | 'ostrzezenie' | string;
  wartosc_zrodlowa: string | null;
  propozycja: string | null;
  komunikat: string;
}

export interface RaportWalidacji {
  import_id?: string;
  plik: string;
  wykryty_format: { separator?: string; kodowanie?: string; przecinek_dziesietny?: boolean };
  mapowanie: Record<string, string | string[]>;
  wiersze: number;
  poprawne: number;
  z_ostrzezeniami: number;
  bledy: number;
  problemy: ProblemWalidacji[];
  brakujace_pola_wymagane: string[];
  duplikaty: { wiersz: number; id_aed: string; zrodlo: string; odleglosc_m: number; decyzja: string }[];
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface WynikImportu { dodane: number; zaktualizowane: number; scalone: number; odrzucone: number }
