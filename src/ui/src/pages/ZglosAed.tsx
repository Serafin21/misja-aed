// "Zgłoś AED" (MODEL_ROL v1.3, CR-TL-8; API: HANDOFF A #11). Only a logged-in institution reports a new AED: address
// (geocoded, or "Użyj mojej lokalizacji" → nearest address), pin to correct, place, access, hours, cabinet (yes/no, never
// "I don't know") and a REQUIRED photo. The administrator checks it formally and approves it or sends it back with a
// comment – never edits it. Approved AED land in the institution's "Moje AED"; the institution publishes them itself.
import { useState, type FormEvent } from 'react';
import {
  HttpError, geocodeAddress, mySubmissions, resubmitAed, reverseGeocode, submitAed, type ZgloszenieAed, type ZgloszenieAedIn,
} from '../api/client';
import { RequireLogin } from '../components/Auth';
import { ErrorSummary, Req, RequiredNote } from '../components/form';
import { MapView } from '../components/MapView';
import { PhotoField } from '../components/PhotoField';
import { ErrorBox, Icon, Loading } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';

type YesNo = '' | 'tak' | 'nie';
interface Draft {
  nazwa_obiektu: string; miejscowosc: string; ulica: string; numer_budynku: string; kod_pocztowy: string;
  lat: number | null; lon: number | null; opis_lokalizacji: string; wewnatrz: YesNo; dostep: '' | ZgloszenieAedIn['dostep'];
  calodobowo: YesNo; godziny: string; szafka: YesNo; instrukcja_dostepu: string; zdjecie: string | null;
}
const EMPTY: Draft = {
  nazwa_obiektu: '', miejscowosc: '', ulica: '', numer_budynku: '', kod_pocztowy: '', lat: null, lon: null, opis_lokalizacji: '',
  wewnatrz: '', dostep: '', calodobowo: '', godziny: '', szafka: '', instrukcja_dostepu: '', zdjecie: null,
};
const IDS: Record<string, string> = {
  nazwa_obiektu: 'za-nazwa', miejscowosc: 'za-miejscowosc', ulica: 'za-ulica', numer_budynku: 'za-numer', kod_pocztowy: 'za-kod',
  szerokosc: 'za-szukaj', dlugosc: 'za-szukaj', opis_lokalizacji: 'za-opis', wewnatrz_budynku: 'za-wew-tak', dostep: 'za-dostep-publiczny',
  dostepny_24h: 'za-24-tak', godziny: 'za-godziny', szafka_zamknieta: 'za-szafka-tak', instrukcja_dostepu: 'za-instr', zdjecie: 'za-foto-f',
};
const DOSTEP: { v: ZgloszenieAedIn['dostep']; l: string; h: string }[] = [
  { v: 'publiczny', l: 'Dla wszystkich', h: 'każdy może z niego skorzystać, gdy obiekt jest otwarty' },
  { v: 'ograniczony', l: 'Ograniczony', h: 'np. tylko w godzinach pracy, po okazaniu dokumentu, przez ochronę' },
  { v: 'prywatny', l: 'Tylko dla uprawnionych', h: 'np. pracownicy zakładu, strażacy OSP' },
];
const STATUS: Record<ZgloszenieAed['status'], string> = { oczekuje: 'czeka na sprawdzenie', zatwierdzone: 'zatwierdzone', do_poprawy: 'do poprawy' };

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.nazwa_obiektu.trim().length < 3) e.nazwa_obiektu = 'Wpisz nazwę budynku lub miejsca, np. „Szkoła Podstawowa nr 5”.';
  if (d.miejscowosc.trim().length < 2) e.miejscowosc = 'Wpisz miejscowość.';
  if (!d.numer_budynku.trim()) e.numer_budynku = 'Wpisz numer budynku.';
  if (!/^\d{2}-\d{3}$/.test(d.kod_pocztowy.trim())) e.kod_pocztowy = 'Wpisz kod pocztowy w formie 00-000.';
  if (d.lat === null || d.lon === null) e.szerokosc = 'Ustal położenie: kliknij „Znajdź adres na mapie”, „Użyj mojej lokalizacji” albo kliknij mapę.';
  if (d.opis_lokalizacji.trim().length < 5) e.opis_lokalizacji = 'Opisz, gdzie dokładnie wisi AED, np. „hol na parterze, przy recepcji”.';
  if (!d.wewnatrz) e.wewnatrz_budynku = 'Zaznacz, czy AED jest w budynku.';
  if (!d.dostep) e.dostep = 'Zaznacz, kto może skorzystać z AED.';
  if (!d.calodobowo) e.dostepny_24h = 'Zaznacz, czy AED jest dostępne całą dobę.';
  if (d.calodobowo === 'nie' && !d.godziny.trim()) e.godziny = 'Wpisz godziny, np. „pn-pt 8-16; sob 9-13”.';
  if (!d.szafka) e.szafka_zamknieta = 'Zaznacz, czy szafka jest zamknięta.';
  if (d.szafka === 'tak' && !d.instrukcja_dostepu.trim()) e.instrukcja_dostepu = 'Napisz, jak otworzyć szafkę, np. „kod podaje dyspozytor 112”.';
  if (!d.zdjecie) e.zdjecie = 'Dołącz zdjęcie urządzenia.';
  return e;
}

function toBody(d: Draft): ZgloszenieAedIn {
  return {
    nazwa_obiektu: d.nazwa_obiektu.trim(), ulica: d.ulica.trim() || null, numer_budynku: d.numer_budynku.trim(), kod_pocztowy: d.kod_pocztowy.trim(),
    miejscowosc: d.miejscowosc.trim(), szerokosc: d.lat!, dlugosc: d.lon!, opis_lokalizacji: d.opis_lokalizacji.trim(), wewnatrz_budynku: d.wewnatrz === 'tak',
    dostep: d.dostep as ZgloszenieAedIn['dostep'], dostepny_24h: d.calodobowo === 'tak', godziny: d.calodobowo === 'nie' ? d.godziny.trim() : null,
    szafka_zamknieta: d.szafka === 'tak', instrukcja_dostepu: d.szafka === 'tak' ? d.instrukcja_dostepu.trim() : null, zdjecie: d.zdjecie!,
  };
}

function fromSubmission(z: ZgloszenieAed): Draft {
  return {
    nazwa_obiektu: z.nazwa_obiektu, miejscowosc: z.miejscowosc, ulica: z.ulica ?? '', numer_budynku: z.numer_budynku, kod_pocztowy: z.kod_pocztowy,
    lat: z.szerokosc, lon: z.dlugosc, opis_lokalizacji: z.opis_lokalizacji, wewnatrz: z.wewnatrz_budynku ? 'tak' : 'nie', dostep: z.dostep,
    calodobowo: z.dostepny_24h ? 'tak' : 'nie', godziny: z.dostepny_24h ? '' : (z.godziny ?? ''), szafka: z.szafka_zamknieta ? 'tak' : 'nie',
    instrukcja_dostepu: z.instrukcja_dostepu ?? '', zdjecie: null, // the photo has to be attached again (the server keeps only the checked copy)
  };
}

export function ZglosAed() {
  usePageTitle('Zgłoś AED');
  return (
    <>
      <h1 id="page-title">Zgłoś AED</h1>
      <p className="lead">Zgłoś defibrylator, za który odpowiada Twoja instytucja. Administrator sprawdzi, czy zgłoszenie jest kompletne (zdjęcie, adres, położenie). Po zatwierdzeniu AED pojawi się w „Moje AED” – stamtąd pobierzesz pliki i opublikujesz je na swoim koncie w dane.gov.pl.</p>
      <RequireLogin role="dysponent">
        <Form />
      </RequireLogin>
    </>
  );
}

function YesNoField({ name, legend, value, onChange, error, hint }: { name: string; legend: string; value: YesNo; onChange: (v: YesNo) => void; error?: string; hint?: string }) {
  return (
    <fieldset className="field" aria-describedby={error ? `${name}-err` : undefined}>
      <legend>{legend}<Req /></legend>
      {hint && <p className="hint">{hint}</p>}
      <div className="big-choices big-choices--row">
        {(['tak', 'nie'] as const).map((v) => (
          <label key={v} htmlFor={`${name}-${v}`}>
            <input id={`${name}-${v}`} type="radio" name={name} required checked={value === v} onChange={() => onChange(v)} aria-invalid={!!error} /> {v === 'tak' ? 'Tak' : 'Nie'}
          </label>
        ))}
      </div>
      {error && <p id={`${name}-err`} className="field-error">{error}</p>}
    </fieldset>
  );
}

function Form() {
  const mine = useAsync(() => mySubmissions(), []);
  const [d, setD] = useState<Draft>(EMPTY);
  const [fixing, setFixing] = useState<ZgloszenieAed | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  const [done, setDone] = useState('');
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  async function findAddress() {
    setMsg('');
    if (!d.miejscowosc.trim() || !d.numer_budynku.trim()) { setMsg('Wpisz najpierw miejscowość i numer budynku.'); return; }
    setMsg('Szukam adresu…');
    try {
      const q = `${d.miejscowosc.trim()}, ${d.ulica.trim() ? `${d.ulica.trim()} ` : ''}${d.numer_budynku.trim()}`;
      const hits = await geocodeAddress(q);
      const hit = hits.find((h) => h.typ === 'adres') ?? hits.find((h) => h.typ === 'ulica') ?? hits.find((h) => h.typ === 'miejscowosc');
      if (!hit) { setMsg('Nie znaleziono tego adresu. Sprawdź pisownię albo kliknij miejsce na mapie.'); return; }
      set({ lat: hit.lat, lon: hit.lon, ...(hit.kod_pocztowy && !d.kod_pocztowy ? { kod_pocztowy: hit.kod_pocztowy } : {}) });
      setMsg(hit.typ === 'adres' ? `Znaleziono: ${hit.nazwa}. Sprawdź pinezkę – możesz ją przesunąć, klikając mapę.`
        : `Znaleziono tylko ${hit.typ === 'ulica' ? 'ulicę' : 'miejscowość'} – kliknij na mapie dokładne miejsce budynku.`);
    } catch (ex) { setMsg((ex as Error).message); }
  }

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
        setMsg(a.ulica || a.numer_budynku ? `Najbliższy adres: ${[a.ulica, a.numer_budynku].filter(Boolean).join(' ')}, ${a.kod_pocztowy ?? ''} ${a.miejscowosc ?? ''} (ok. ${a.odleglosc_m ?? 0} m). Sprawdź i popraw, jeśli trzeba.`
          : `Pinezka ustawiona (gmina ${a.gmina ?? '—'}). Nie znaleziono adresu w pobliżu – wpisz go ręcznie.`);
      } catch { setMsg('Pinezka ustawiona. Nie udało się pobrać adresu – wpisz go ręcznie.'); }
    }, () => setMsg('Nie udało się ustalić lokalizacji. Wpisz adres albo kliknij mapę.'), { enableHighAccuracy: true, timeout: 10000 });
  }

  async function send(ev: FormEvent) {
    ev.preventDefault(); setFail(null);
    const e = validate(d);
    setErrors(e); setFocus((f) => f + 1);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (fixing) await resubmitAed(fixing.id, toBody(d)); else await submitAed(toBody(d));
      setDone(fixing ? 'Poprawione zgłoszenie wysłane ponownie do administratora.' : 'Zgłoszenie wysłane do administratora.');
      setD(EMPTY); setFixing(null); setErrors({}); setMsg('');
      mine.reload();
    } catch (ex) {
      if (ex instanceof HttpError && Object.keys(ex.fields).length) { setErrors(ex.fields); setFocus((f) => f + 1); }
      setFail(ex as Error);
    } finally { setBusy(false); }
  }

  function startFix(z: ZgloszenieAed) {
    setD(fromSubmission(z)); setFixing(z); setDone(''); setErrors({});
    setTimeout(() => document.getElementById('za-form')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  const text = (k: keyof Draft, id: string, label: string, opts: { hint?: string; req?: boolean; mode?: 'numeric'; area?: boolean; max?: number } = {}) => {
    const errKey = k === 'wewnatrz' ? 'wewnatrz_budynku' : k;
    const er = errors[errKey as string];
    const desc = [opts.hint ? `${id}-hint` : '', er ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
    const common = { id, value: String(d[k] ?? ''), maxLength: opts.max, 'aria-invalid': !!er, 'aria-describedby': desc, required: opts.req !== false,
      onChange: (e: { target: { value: string } }) => set({ [k]: e.target.value } as Partial<Draft>) };
    return (
      <div className="field">
        <label htmlFor={id}>{label}{opts.req !== false && <Req />}</label>
        {opts.hint && <p id={`${id}-hint`} className="hint">{opts.hint}</p>}
        {opts.area ? <textarea rows={3} {...common} /> : <input type="text" autoComplete="off" inputMode={opts.mode} {...common} />}
        {er && <p id={`${id}-err`} className="field-error">{er}</p>}
      </div>
    );
  };

  return (
    <>
      {done && (
        <div className="callout callout--ok" role="status">
          <p className="callout__title"><Icon name="check" />{done}</p>
          <p>Decyzję zobaczysz poniżej w „Moje zgłoszenia” i w powiadomieniach w <Link to="/moje-aed">Moje AED</Link>.</p>
        </div>
      )}
      <form id="za-form" className="panel" onSubmit={send} noValidate aria-labelledby="za-title">
        <h2 id="za-title">{fixing ? `Popraw zgłoszenie „${fixing.nazwa_obiektu}”` : 'Nowe AED'}</h2>
        {fixing?.komentarz && <div className="callout callout--warn"><p className="callout__title">Uwagi administratora</p><p>{fixing.komentarz}</p><p className="hint">Dołącz zdjęcie ponownie.</p></div>}
        <RequiredNote />
        <ErrorSummary errors={errors} fieldIds={IDS} focusToken={focus} />

        <h3>1. Adres</h3>
        {text('nazwa_obiektu', 'za-nazwa', 'Nazwa budynku lub miejsca', { hint: 'Np. Szkoła Podstawowa nr 5, Urząd Gminy, Hala sportowa.', max: 200 })}
        <div className="filters__grid">
          {text('miejscowosc', 'za-miejscowosc', 'Miejscowość', { max: 100 })}
          {text('ulica', 'za-ulica', 'Ulica', { hint: 'Zostaw puste, jeśli w miejscowości nie ma ulic.', req: false, max: 120 })}
          {text('numer_budynku', 'za-numer', 'Numer budynku', { max: 20 })}
          {text('kod_pocztowy', 'za-kod', 'Kod pocztowy', { hint: 'W formie 00-000.', mode: 'numeric', max: 6 })}
        </div>
        <p className="form-actions">
          <button id="za-szukaj" type="button" className="btn btn--secondary" onClick={findAddress}>Znajdź adres na mapie</button>
          <button type="button" className="btn btn--secondary" onClick={locate}>Użyj mojej lokalizacji</button>
        </p>
        <p role="status" className="hint">{msg}</p>
        <MapView items={[]} picked={d.lat !== null && d.lon !== null ? { lat: d.lat, lon: d.lon } : null}
          goTo={d.lat !== null && d.lon !== null ? { key: `${d.lat},${d.lon}`, lat: d.lat, lon: d.lon, zoom: 18 } : null}
          onPick={(p) => { set({ lat: p.lat, lon: p.lon }); setMsg('Przesunięto pinezkę w wybrane miejsce.'); }}
          label="Mapa: pinezka pokazuje położenie AED. Kliknij, aby ją przesunąć. Bez myszy użyj przycisku „Znajdź adres na mapie”." height={300} cluster={false} />
        {errors.szerokosc && <p className="field-error">{errors.szerokosc}</p>}
        {d.lat !== null && <p className="hint">Położenie: {d.lat.toFixed(6)}, {d.lon!.toFixed(6)}</p>}

        <h3>2. Miejsce</h3>
        {text('opis_lokalizacji', 'za-opis', 'Gdzie dokładnie wisi AED?', { hint: 'Np. hol na parterze, przy recepcji.', area: true, max: 250 })}
        <YesNoField name="za-wew" legend="Czy AED jest w budynku?" value={d.wewnatrz} onChange={(v) => set({ wewnatrz: v })} error={errors.wewnatrz_budynku} />

        <h3>3. Dostęp</h3>
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
        {d.szafka === 'tak' && text('instrukcja_dostepu', 'za-instr', 'Jak otworzyć szafkę?', { hint: 'Np. „kod podaje dyspozytor 112” albo „klucz w portierni”.', area: true, max: 250 })}

        <h3>4. Zdjęcie</h3>
        <PhotoField inputId="za-foto" required value={d.zdjecie} onChange={(v) => set({ zdjecie: v })} error={errors.zdjecie}
          hint="Zrób zdjęcie urządzenia (lub szafki) tak, żeby nie było widać ludzi. Przed zapisaniem usuwamy z niego dane o miejscu i telefonie." />

        {fail && <ErrorBox error={fail} />}
        <p className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Wysyłam…' : fixing ? 'Wyślij poprawione zgłoszenie' : 'Wyślij do zatwierdzenia'}</button>
          {fixing && <button type="button" className="btn btn--tertiary" onClick={() => { setFixing(null); setD(EMPTY); setErrors({}); }}>Anuluj poprawianie</button>}
        </p>
      </form>

      <section className="admin-section" aria-labelledby="za-mine">
        <h2 id="za-mine">Moje zgłoszenia</h2>
        {mine.loading && !mine.data && <Loading />}
        {mine.error && <ErrorBox error={mine.error} onRetry={mine.reload} />}
        {mine.data && (mine.data.length === 0 ? <p>Nie masz jeszcze zgłoszeń.</p> : (
          <table className="admin-table">
            <thead><tr><th scope="col">AED</th><th scope="col">Wysłane</th><th scope="col">Stan</th><th scope="col">Decyzja</th><th scope="col">Działania</th></tr></thead>
            <tbody>
              {mine.data.map((z) => (
                <tr key={z.id}>
                  <td>{z.nazwa_obiektu}<div className="hint">{[z.ulica, z.numer_budynku].filter(Boolean).join(' ')}, {z.miejscowosc} · zgłosił(a) <code>{z.nadawca_login}</code></div></td>
                  <td>{z.utworzono.replace('T', ', ')}</td>
                  <td><span className={`badge ${z.status === 'zatwierdzone' ? 'badge--ok' : z.status === 'do_poprawy' ? 'badge--stale' : ''}`}>{STATUS[z.status]}</span></td>
                  <td>{z.kto ? <>{z.komentarz ?? '—'}<div className="hint">{z.kto}, {z.kiedy?.replace('T', ', ')}</div></> : '—'}</td>
                  <td>
                    {z.status === 'do_poprawy' && <button type="button" className="btn btn--secondary btn--small" onClick={() => startFix(z)}>Popraw<span className="visually-hidden"> {z.nazwa_obiektu}</span></button>}
                    {z.status === 'zatwierdzone' && <Link to="/moje-aed">W „Moje AED”</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </section>
    </>
  );
}
