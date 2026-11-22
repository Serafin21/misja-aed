// Formularz zgłoszenia AED – nowe urządzenie albo zmiana istniejącego (poprawki, nowe zdjęcie). Każde zgłoszenie trafia do
// zatwierdzenia przez administratora (HANDOFF A #12). Adres → pinezka („Znajdź adres na mapie”), „Moja lokalizacja” →
// najbliższy adres; pinezkę można przesunąć. Wszystkie odpowiedzi konkretne (bez „nie wiem”), zdjęcie wymagane dla nowego AED.
import { useState, type FormEvent } from 'react';
import { HttpError, geocodeAddress, resubmitAed, reverseGeocode, submitAed, type ZgloszenieAed, type ZgloszenieAedIn } from '../api/client';
import type { Aed } from '../api/types';
import { ErrorSummary, Req, RequiredNote } from './form';
import { MapView } from './MapView';
import { PhotoField } from './PhotoField';
import { ErrorBox, Icon } from './ui';

type YesNo = '' | 'tak' | 'nie';
export interface Draft {
  nazwa_obiektu: string; miejscowosc: string; ulica: string; numer_budynku: string; kod_pocztowy: string;
  lat: number | null; lon: number | null; opis_lokalizacji: string; wewnatrz: YesNo; dostep: '' | ZgloszenieAedIn['dostep'];
  calodobowo: YesNo; godziny: string; szafka: YesNo; instrukcja_dostepu: string; zdjecie: string | null;
}
export const EMPTY_DRAFT: Draft = {
  nazwa_obiektu: '', miejscowosc: '', ulica: '', numer_budynku: '', kod_pocztowy: '', lat: null, lon: null, opis_lokalizacji: '',
  wewnatrz: '', dostep: '', calodobowo: '', godziny: '', szafka: '', instrukcja_dostepu: '', zdjecie: null,
};
const yn = (v: boolean | null | undefined): YesNo => (v === true ? 'tak' : v === false ? 'nie' : '');

/** existing AED → form (empty where the data has nothing – the institution fills it in) */
export function draftFromAed(a: Aed): Draft {
  return {
    nazwa_obiektu: a.nazwa_obiektu ?? '', miejscowosc: a.miejscowosc ?? '', ulica: [a.ulica_cecha && a.ulica_cecha !== 'inne' ? a.ulica_cecha : '', a.ulica ?? ''].filter(Boolean).join(' '),
    numer_budynku: a.numer_budynku ?? '', kod_pocztowy: a.kod_pocztowy ?? '', lat: a.szerokosc_geograficzna, lon: a.dlugosc_geograficzna,
    opis_lokalizacji: /^Brak opisu w (zbiorze|OpenStreetMap)/.test(a.opis_lokalizacji ?? '') ? '' : a.opis_lokalizacji ?? '', wewnatrz: yn(a.wewnatrz_budynku), dostep: (a.dostep as Draft['dostep']) ?? '',
    calodobowo: a.dostepny_24h === true || a.godziny_dostepnosci === '24/7' ? 'tak' : a.godziny_dostepnosci ? 'nie' : '',
    godziny: a.godziny_dostepnosci && a.godziny_dostepnosci !== '24/7' ? a.godziny_dostepnosci : '',
    szafka: yn(a.szafka_zamknieta), instrukcja_dostepu: a.instrukcja_dostepu ?? '', zdjecie: null,
  };
}

export function draftFromSubmission(z: ZgloszenieAed): Draft {
  return {
    nazwa_obiektu: z.nazwa_obiektu, miejscowosc: z.miejscowosc, ulica: z.ulica ?? '', numer_budynku: z.numer_budynku, kod_pocztowy: z.kod_pocztowy,
    lat: z.szerokosc, lon: z.dlugosc, opis_lokalizacji: z.opis_lokalizacji, wewnatrz: yn(z.wewnatrz_budynku), dostep: z.dostep,
    calodobowo: z.dostepny_24h ? 'tak' : 'nie', godziny: z.dostepny_24h ? '' : (z.godziny ?? ''), szafka: yn(z.szafka_zamknieta),
    instrukcja_dostepu: z.instrukcja_dostepu ?? '', zdjecie: null,
  };
}

const IDS: Record<string, string> = {
  nazwa_obiektu: 'za-nazwa', miejscowosc: 'za-miejscowosc', ulica: 'za-ulica', numer_budynku: 'za-numer', kod_pocztowy: 'za-kod',
  szerokosc: 'za-szukaj', dlugosc: 'za-szukaj', opis_lokalizacji: 'za-opis', wewnatrz_budynku: 'za-wew-tak', dostep: 'za-dostep-publiczny',
  dostepny_24h: 'za-24-tak', godziny: 'za-godziny', szafka_zamknieta: 'za-szafka-tak', instrukcja_dostepu: 'za-instr', zdjecie: 'za-foto-f',
};
const DOSTEP: { v: ZgloszenieAedIn['dostep']; l: string; h: string }[] = [
  { v: 'publiczny', l: 'Dla wszystkich', h: 'każdy może skorzystać, gdy obiekt jest otwarty' },
  { v: 'ograniczony', l: 'Ograniczony', h: 'np. tylko w godzinach pracy, przez ochronę lub recepcję' },
  { v: 'prywatny', l: 'Tylko dla uprawnionych', h: 'np. pracownicy zakładu, strażacy OSP' },
];

function validate(d: Draft, photoRequired: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.nazwa_obiektu.trim().length < 3) e.nazwa_obiektu = 'Wpisz nazwę budynku lub miejsca, np. „Szkoła Podstawowa nr 5”.';
  if (d.miejscowosc.trim().length < 2) e.miejscowosc = 'Wpisz miejscowość.';
  if (!d.numer_budynku.trim()) e.numer_budynku = 'Wpisz numer budynku.';
  if (!/^\d{2}-\d{3}$/.test(d.kod_pocztowy.trim())) e.kod_pocztowy = 'Wpisz kod pocztowy w formie 00-000.';
  if (d.lat === null || d.lon === null) e.szerokosc = 'Ustal położenie: „Znajdź adres na mapie”, „Moja lokalizacja” albo kliknij mapę.';
  if (d.opis_lokalizacji.trim().length < 5) e.opis_lokalizacji = 'Opisz, jak dojść do AED, np. „parter, recepcja, za ladą”.';
  if (!d.wewnatrz) e.wewnatrz_budynku = 'Zaznacz, czy AED jest w budynku.';
  if (!d.dostep) e.dostep = 'Zaznacz, kto może skorzystać z AED.';
  if (!d.calodobowo) e.dostepny_24h = 'Zaznacz, czy AED jest dostępne całą dobę.';
  if (d.calodobowo === 'nie' && !d.godziny.trim()) e.godziny = 'Wpisz godziny, np. „pn-pt 8-16; sob 9-13”.';
  if (!d.szafka) e.szafka_zamknieta = 'Zaznacz, czy szafka jest zamknięta.';
  if (d.szafka === 'tak' && !d.instrukcja_dostepu.trim()) e.instrukcja_dostepu = 'Napisz, jak otworzyć szafkę, np. „klucz w recepcji”.';
  if (photoRequired && !d.zdjecie) e.zdjecie = 'Dołącz zdjęcie urządzenia.';
  return e;
}

function YesNoField({ name, legend, value, onChange, error, hint }: { name: string; legend: string; value: YesNo; onChange: (v: YesNo) => void; error?: string; hint?: string }) {
  return (
    <fieldset className="field">
      <legend>{legend}<Req /></legend>
      {hint && <p className="hint">{hint}</p>}
      <div className="big-choices big-choices--row">
        {(['tak', 'nie'] as const).map((v) => (
          <label key={v} htmlFor={`${name}-${v}`}>
            <input id={`${name}-${v}`} type="radio" name={name} required checked={value === v} onChange={() => onChange(v)} aria-invalid={!!error} /> {v === 'tak' ? 'Tak' : 'Nie'}
          </label>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  );
}

export interface AedFormProps {
  /** nowe AED, zmiana istniejącego (idAed) albo poprawka odesłanego zgłoszenia (submissionId) */
  mode: 'nowe' | 'zmiana' | 'poprawka';
  initial?: Draft;
  idAed?: string | null;
  submissionId?: string;
  /** the AED already has a photo → a new one is optional */
  hasPhoto?: boolean;
  title: string;
  comment?: string | null;
  /** administrator only: institutions to assign a new AED to */
  organizations?: string[];
  onDone: (msg: string) => void;
  onCancel?: () => void;
}

export function AedForm({ mode, initial, idAed, submissionId, hasPhoto = false, title, comment, organizations, onDone, onCancel }: AedFormProps) {
  const [d, setD] = useState<Draft>(initial ?? EMPTY_DRAFT);
  const [org, setOrg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const photoRequired = mode === 'nowe' || (mode === 'zmiana' && !hasPhoto);

  // address → pin. Runs by itself when the address is complete (leaving the field) and before sending; the button does
  // the same. Accepts "ul. Floriańska 3", "al. Jerozolimskie 100" (the server tries the official street names).
  const [geoKey, setGeoKey] = useState(initial && initial.lat !== null ? `${initial.miejscowosc}|${initial.ulica}|${initial.numer_budynku}` : '');
  async function findAddress(auto = false): Promise<{ lat: number; lon: number; kod?: string } | null> {
    const key = `${d.miejscowosc.trim()}|${d.ulica.trim()}|${d.numer_budynku.trim()}`;
    if (!d.miejscowosc.trim() || !d.numer_budynku.trim()) { if (!auto) setMsg('Wpisz najpierw miejscowość i numer budynku.'); return null; }
    if (auto && key === geoKey && d.lat !== null) return { lat: d.lat, lon: d.lon! };
    setMsg('Szukam adresu na mapie…');
    try {
      const q = `${d.miejscowosc.trim()}, ${d.ulica.trim() ? `${d.ulica.trim()} ` : ''}${d.numer_budynku.trim()}`;
      let hits = await geocodeAddress(q);
      if (!hits.length && d.ulica.trim()) hits = await geocodeAddress(`${d.miejscowosc.trim()}, ${d.ulica.trim()}`);
      if (!hits.length) hits = await geocodeAddress(d.miejscowosc.trim());
      const hit = hits.find((h) => h.typ === 'adres') ?? hits.find((h) => h.typ === 'ulica') ?? hits.find((h) => h.typ === 'miejscowosc' || h.typ === 'gmina');
      if (!hit) { setMsg('Nie znaleźliśmy tego adresu. Sprawdź pisownię albo kliknij miejsce AED na mapie.'); return null; }
      const kod = hit.kod_pocztowy && !d.kod_pocztowy.trim() ? hit.kod_pocztowy : undefined;
      set({ lat: hit.lat, lon: hit.lon, ...(kod ? { kod_pocztowy: kod } : {}) });
      setGeoKey(key);
      setErrors((e) => { const x = { ...e }; delete x.szerokosc; if (kod) delete x.kod_pocztowy; return x; });
      setMsg(hit.typ === 'adres' ? `Znaleziono: ${hit.nazwa}. Pinezka stoi na tym adresie – możesz ją przesunąć.`
        : `Znaleźliśmy ${hit.typ === 'ulica' ? `ulicę (${hit.nazwa})` : `miejscowość (${hit.nazwa})`}, ale nie ten numer – przesuń pinezkę dokładnie na budynek.`);
      return { lat: hit.lat, lon: hit.lon, kod };
    } catch (ex) { setMsg((ex as Error).message); return null; }
  }
  const autoFind = () => { if (d.miejscowosc.trim() && d.numer_budynku.trim()) void findAddress(true); };

  function locate() {
    if (!('geolocation' in navigator)) { setMsg('Ta przeglądarka nie podaje lokalizacji. Wpisz adres albo kliknij mapę.'); return; }
    setMsg('Ustalam lokalizację…');
    navigator.geolocation.getCurrentPosition(async (g) => {
      const lat = +g.coords.latitude.toFixed(6), lon = +g.coords.longitude.toFixed(6);
      set({ lat, lon });
      try {
        const a = await reverseGeocode(lat, lon);
        set({ ...(a.miejscowosc ? { miejscowosc: a.miejscowosc } : {}), ...(a.ulica ? { ulica: a.ulica } : {}),
          ...(a.numer_budynku ? { numer_budynku: a.numer_budynku } : {}), ...(a.kod_pocztowy ? { kod_pocztowy: a.kod_pocztowy } : {}) });
        setMsg(a.ulica || a.numer_budynku ? `Najbliższy adres: ${[a.ulica, a.numer_budynku].filter(Boolean).join(' ')}, ${a.kod_pocztowy ?? ''} ${a.miejscowosc ?? ''}. Sprawdź i popraw, jeśli trzeba.`
          : 'Pinezka ustawiona. Nie znaleziono adresu w pobliżu – wpisz go ręcznie.');
      } catch { setMsg('Pinezka ustawiona. Wpisz adres ręcznie.'); }
    }, () => setMsg('Nie udało się ustalić lokalizacji. Wpisz adres albo kliknij mapę.'), { enableHighAccuracy: true, timeout: 10000 });
  }

  async function send(ev: FormEvent) {
    ev.preventDefault(); setFail(null);
    let cur = d;
    if (d.lat === null || `${d.miejscowosc.trim()}|${d.ulica.trim()}|${d.numer_budynku.trim()}` !== geoKey) {
      const g = await findAddress(true); // the address was typed but the pin not placed yet
      if (g) cur = { ...d, lat: g.lat, lon: g.lon, ...(g.kod ? { kod_pocztowy: g.kod } : {}) };
    }
    const e = validate(cur, photoRequired);
    setErrors(e); setFocus((f) => f + 1);
    if (Object.keys(e).length) return;
    const body: ZgloszenieAedIn = {
      typ: mode === 'nowe' ? 'nowe' : 'zmiana', id_aed: mode === 'nowe' ? null : idAed ?? null, ...(org ? { organizacja: org } : {}),
      nazwa_obiektu: cur.nazwa_obiektu.trim(), ulica: cur.ulica.trim() || null, numer_budynku: cur.numer_budynku.trim(), kod_pocztowy: cur.kod_pocztowy.trim(),
      miejscowosc: cur.miejscowosc.trim(), szerokosc: cur.lat!, dlugosc: cur.lon!, opis_lokalizacji: cur.opis_lokalizacji.trim(), wewnatrz_budynku: cur.wewnatrz === 'tak',
      dostep: cur.dostep as ZgloszenieAedIn['dostep'], dostepny_24h: cur.calodobowo === 'tak', godziny: cur.calodobowo === 'nie' ? cur.godziny.trim() : null,
      szafka_zamknieta: cur.szafka === 'tak', instrukcja_dostepu: cur.szafka === 'tak' ? cur.instrukcja_dostepu.trim() : null, zdjecie: cur.zdjecie,
    };
    if (mode === 'poprawka' && !idAed) body.typ = 'nowe';
    setBusy(true);
    try {
      if (submissionId) await resubmitAed(submissionId, body); else await submitAed(body);
      onDone(submissionId ? 'Poprawione zgłoszenie wysłane ponownie do zatwierdzenia.' : 'Zgłoszenie wysłane do zatwierdzenia przez administratora.');
    } catch (ex) {
      if (ex instanceof HttpError && Object.keys(ex.fields).length) { setErrors(ex.fields); setFocus((f) => f + 1); }
      setFail(ex as Error);
    } finally { setBusy(false); }
  }

  const text = (k: keyof Draft, id: string, label: string, o: { hint?: string; req?: boolean; mode?: 'numeric'; area?: boolean; max?: number; geo?: boolean } = {}) => {
    const er = errors[k as string];
    const desc = [o.hint ? `${id}-hint` : '', er ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
    const common = { id, value: String(d[k] ?? ''), maxLength: o.max, 'aria-invalid': !!er, 'aria-describedby': desc, required: o.req !== false,
      onChange: (e: { target: { value: string } }) => set({ [k]: e.target.value } as Partial<Draft>), onBlur: o.geo ? autoFind : undefined };
    return (
      <div className="field">
        <label htmlFor={id}>{label}{o.req !== false && <Req />}</label>
        {o.hint && <p id={`${id}-hint`} className="hint">{o.hint}</p>}
        {o.area ? <textarea rows={3} {...common} /> : <input type="text" autoComplete="off" inputMode={o.mode} {...common} />}
        {er && <p id={`${id}-err`} className="field-error">{er}</p>}
      </div>
    );
  };

  return (
    <form id="za-form" className="panel aed-form" onSubmit={send} noValidate aria-labelledby="za-title">
      <h2 id="za-title">{title}</h2>
      {comment && <div className="callout callout--warn"><p className="callout__title">Uwagi administratora</p><p>{comment}</p></div>}
      <p className="hint">Zgłoszenie sprawdzi administrator. Po zatwierdzeniu dane będą od razu widoczne na mapie.</p>
      <RequiredNote />
      <ErrorSummary errors={errors} fieldIds={IDS} focusToken={focus} />
      {organizations && mode === 'nowe' && (
        <div className="field">
          <label htmlFor="za-org">Instytucja odpowiedzialna za AED</label>
          <p id="za-org-hint" className="hint">Nieobowiązkowe. Instytucja zobaczy to AED u siebie i dostanie zgłoszenia mieszkańców.</p>
          <select id="za-org" aria-describedby="za-org-hint" value={org} onChange={(e) => setOrg(e.target.value)}>
            <option value="">bez instytucji (administrator)</option>
            {organizations.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}

      <h3>1. Adres</h3>
      {text('nazwa_obiektu', 'za-nazwa', 'Nazwa budynku lub miejsca', { hint: 'Np. Szkoła Podstawowa nr 5, Urząd Gminy, Hala sportowa.', max: 200 })}
      <div className="filters__grid">
        {text('miejscowosc', 'za-miejscowosc', 'Miejscowość', { max: 100, geo: true })}
        {text('ulica', 'za-ulica', 'Ulica', { hint: 'Np. „Floriańska” albo „ul. Floriańska”. Puste, jeśli w miejscowości nie ma ulic.', req: false, max: 120, geo: true })}
        {text('numer_budynku', 'za-numer', 'Numer budynku', { max: 20, geo: true })}
        {text('kod_pocztowy', 'za-kod', 'Kod pocztowy', { hint: 'W formie 00-000.', mode: 'numeric', max: 6 })}
      </div>
      <p className="form-actions">
        <button id="za-szukaj" type="button" className="btn btn--secondary" onClick={() => void findAddress()}>Znajdź adres na mapie</button>
        <button type="button" className="btn btn--secondary" onClick={locate}><Icon name="locate" />Moja lokalizacja</button>
      </p>
      <p role="status" className="hint">{msg || 'Pinezka ustawi się sama po wpisaniu miejscowości, ulicy i numeru. Możesz ją przesunąć, klikając mapę.'}</p>
      <MapView items={[]} picked={d.lat !== null && d.lon !== null ? { lat: d.lat, lon: d.lon } : null}
        goTo={d.lat !== null && d.lon !== null ? { key: `${d.lat},${d.lon}`, lat: d.lat, lon: d.lon, zoom: 18 } : null}
        onPick={(p) => { set({ lat: p.lat, lon: p.lon }); setGeoKey(`${d.miejscowosc.trim()}|${d.ulica.trim()}|${d.numer_budynku.trim()}`); setMsg('Przesunięto pinezkę w wybrane miejsce.'); }}
        label="Mapa: pinezka pokazuje położenie AED. Kliknij albo przeciągnij, aby ją przesunąć." height={300} cluster={false} />
      {errors.szerokosc && <p className="field-error">{errors.szerokosc}</p>}

      <h3>2. Jak dojść</h3>
      {text('opis_lokalizacji', 'za-opis', 'Gdzie dokładnie jest AED?', { hint: 'Np. „parter, wypożyczalnia, koniec korytarza”.', area: true, max: 250 })}
      <YesNoField name="za-wew" legend="Czy AED jest w budynku?" value={d.wewnatrz} onChange={(v) => set({ wewnatrz: v })} error={errors.wewnatrz_budynku} />

      <h3>3. Dostęp i godziny</h3>
      <fieldset className="field">
        <legend>Kto może skorzystać z AED?<Req /></legend>
        <div className="big-choices">
          {DOSTEP.map((o) => (
            <label key={o.v} htmlFor={`za-dostep-${o.v}`}>
              <input id={`za-dostep-${o.v}`} type="radio" name="za-dostep" required checked={d.dostep === o.v} onChange={() => set({ dostep: o.v })} aria-invalid={!!errors.dostep} />
              <span>{o.l}<span className="hint"> – {o.h}</span></span>
            </label>
          ))}
        </div>
        {errors.dostep && <p className="field-error">{errors.dostep}</p>}
      </fieldset>
      <YesNoField name="za-24" legend="Czy AED jest dostępne całą dobę?" value={d.calodobowo} onChange={(v) => set({ calodobowo: v })} error={errors.dostepny_24h} />
      {d.calodobowo === 'nie' && text('godziny', 'za-godziny', 'Godziny dostępności', { hint: 'Np. „pn-pt 8-16; sob 9-13”.', max: 200 })}
      <YesNoField name="za-szafka" legend="Czy szafka z AED jest zamknięta?" value={d.szafka} onChange={(v) => set({ szafka: v })} error={errors.szafka_zamknieta}
        hint="Zamknięta = trzeba ją otworzyć kluczem lub kodem." />
      {d.szafka === 'tak' && text('instrukcja_dostepu', 'za-instr', 'Jak otworzyć szafkę?', { hint: 'Np. „klucz w recepcji” albo „kod podaje dyspozytor 112”.', area: true, max: 250 })}

      <h3>4. Zdjęcie</h3>
      <PhotoField inputId="za-foto" required={photoRequired} value={d.zdjecie} onChange={(v) => set({ zdjecie: v })} error={errors.zdjecie}
        hint={photoRequired ? 'Zdjęcie urządzenia (lub szafki), bez ludzi. Usuwamy z niego dane o miejscu i telefonie.'
          : 'Nieobowiązkowe – dołącz, jeśli chcesz zaktualizować zdjęcie. Usuwamy z niego dane o miejscu i telefonie.'} />

      {fail && <ErrorBox error={fail} />}
      <p className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Wysyłam…' : submissionId ? 'Wyślij poprawione zgłoszenie' : 'Wyślij do zatwierdzenia'}</button>
        {onCancel && <button type="button" className="btn btn--tertiary" onClick={onCancel}>Anuluj</button>}
      </p>
    </form>
  );
}
