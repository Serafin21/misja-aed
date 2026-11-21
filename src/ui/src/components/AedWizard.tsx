// Step-by-step AED form: one question per screen, "Krok 2 z 4". Used by E4 (citizen) and E5 (institution, manual).
// The parent keeps the draft and the step, so "Wstecz" and "Zmień" never erase anything.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DAY_NAMES, CLOSE_TIMES, TIMES, emptyHours, hoursError, hoursInWords, hoursToOpeningHours, type Hours, type HoursMode } from '../lib/hoursBuilder';
import { ErrorSummary, Req, RequiredNote, useValidation } from './form';
import { MapView } from './MapView';

export type Cabinet = '' | 'tak' | 'nie' | 'nie_wiem';
export interface AedDraft {
  lat: number | null; lon: number | null; opis: string; hours: Hours; cabinet: Cabinet; access: string;
  // institution only (required by the data standard for publication)
  nazwa: string; miejscowosc: string; ulica: string; numer: string; kod: string;
}
export type Variant = 'citizen' | 'institution';
export const STEPS = 4;

export const emptyDraft = (): AedDraft => ({
  lat: null, lon: null, opis: '', hours: emptyHours(), cabinet: '', access: '', nazwa: '', miejscowosc: '', ulica: '', numer: '', kod: '',
});

const CAB_WORDS: Record<Cabinet, string> = { '': 'Nie wiem', nie_wiem: 'Nie wiem', tak: 'Tak, jest zamknięta', nie: 'Nie, jest otwarta' };

/** Citizen report: the API takes only place + description, so hours and cabinet go into the description (CR to A). */
export function citizenDescription(d: AedDraft): string {
  const parts = [d.opis.trim()];
  if (d.hours.mode === '24h' || d.hours.mode === 'hours') parts.push(`Godziny: ${hoursInWords(d.hours)} (${hoursToOpeningHours(d.hours)}).`);
  if (d.cabinet === 'tak') parts.push(`Szafka zamknięta.${d.access.trim() ? ` Dostęp: ${d.access.trim()}` : ''}`);
  if (d.cabinet === 'nie') parts.push('Szafka otwarta.');
  return parts.join(' ').slice(0, 500);
}

/** Institution: one AED as a record for POST /aed. */
export function draftToRecord(d: AedDraft): Record<string, unknown> {
  const r: Record<string, unknown> = {
    nazwa_obiektu: d.nazwa.trim(), opis_lokalizacji: d.opis.trim(),
    szerokosc_geograficzna: d.lat, dlugosc_geograficzna: d.lon,
    miejscowosc: d.miejscowosc.trim(), numer_budynku: d.numer.trim(), kod_pocztowy: d.kod.trim(),
  };
  if (d.ulica.trim()) r.ulica = d.ulica.trim();
  const oh = hoursToOpeningHours(d.hours);
  if (oh) r.godziny_dostepnosci = oh;
  if (d.cabinet === 'tak') { r.szafka_zamknieta = true; if (d.access.trim()) r.instrukcja_dostepu = d.access.trim(); }
  if (d.cabinet === 'nie') r.szafka_zamknieta = false;
  return r;
}

const TITLES = ['Gdzie jest AED?', 'Kiedy można z niego skorzystać?', 'Czy szafka jest zamknięta?', 'Sprawdź i wyślij'];

export function AedWizard({ variant, draft, setDraft, step, setStep, onSubmit, submitLabel, busy, failure, backFromFirst }: {
  variant: Variant; draft: AedDraft; setDraft: (d: AedDraft) => void; step: number; setStep: (n: number) => void;
  onSubmit: () => void; submitLabel: string; busy?: boolean; failure?: ReactNode; backFromFirst?: () => void;
}) {
  const head = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } head.current?.focus(); }, [step]);
  const set = (p: Partial<AedDraft>) => setDraft({ ...draft, ...p });
  const title = step === 4 && variant === 'institution' ? 'Sprawdź i dodaj do listy' : TITLES[step - 1];

  return (
    <section className="wizard" aria-labelledby="wiz-title">
      <p className="wizard__step">Krok {step} z {STEPS}</p>
      <div className="wizard__progress" aria-hidden="true"><span style={{ width: `${(step / STEPS) * 100}%` }} /></div>
      <h2 id="wiz-title" ref={head} tabIndex={-1}>{title}</h2>
      {step === 1 && <StepWhere variant={variant} d={draft} set={set} next={() => setStep(2)} back={backFromFirst} />}
      {step === 2 && <StepHours variant={variant} d={draft} set={set} back={() => setStep(1)} next={() => setStep(3)} />}
      {step === 3 && <StepCabinet d={draft} set={set} back={() => setStep(2)} next={() => setStep(4)} />}
      {step === 4 && <StepSummary variant={variant} d={draft} goto={setStep} back={() => setStep(3)} submit={onSubmit} label={submitLabel} busy={busy} failure={failure} />}
    </section>
  );
}

function Nav({ back, nextLabel = 'Dalej', skip, busy }: { back?: () => void; nextLabel?: string; skip?: () => void; busy?: boolean }) {
  return (
    <p className="form-actions">
      <button type="submit" className="btn btn--primary" disabled={busy}>{nextLabel}</button>
      {skip && <button type="button" className="btn btn--tertiary" onClick={skip}>Pomiń</button>}
      {back && <button type="button" className="btn btn--secondary" onClick={back}>Wstecz</button>}
    </p>
  );
}

function StepWhere({ variant, d, set, next, back }: { variant: Variant; d: AedDraft; set: (p: Partial<AedDraft>) => void; next: () => void; back?: () => void }) {
  const [geoMsg, setGeoMsg] = useState('');
  const inst = variant === 'institution';
  const v = useValidation({
    pt: () => (d.lat === null || d.lon === null ? 'Wskaż miejsce: użyj swojej lokalizacji albo kliknij na mapie.'
      : (d.lat < 49 || d.lat > 54.9 || d.lon < 14.1 || d.lon > 24.2) ? 'To miejsce jest poza Polską. Wskaż je jeszcze raz.' : ''),
    opis: () => (d.opis.trim().length < 10 ? 'Opisz miejsce w kilku słowach, np. „przy wejściu głównym, obok portierni”.' : ''),
    ...(inst ? {
      nazwa: () => (d.nazwa.trim() ? '' : 'Wpisz nazwę budynku lub miejsca, np. „Szkoła Podstawowa nr 5”.'),
      miejscowosc: () => (d.miejscowosc.trim() ? '' : 'Wpisz miejscowość.'),
      numer: () => (d.numer.trim() ? '' : 'Wpisz numer budynku.'),
      kod: () => (/^\d{2}-\d{3}$/.test(d.kod.trim()) ? '' : 'Wpisz kod pocztowy w formie 00-000, np. 85-005.'),
    } : {}),
  });
  const e = v.errors;
  const ids: Record<string, string> = { pt: 'w-locate', opis: 'w-opis', nazwa: 'w-nazwa', miejscowosc: 'w-miejscowosc', numer: 'w-numer', kod: 'w-kod' };

  function locate() {
    if (!('geolocation' in navigator)) { setGeoMsg('Ta przeglądarka nie podaje lokalizacji. Kliknij miejsce na mapie.'); return; }
    setGeoMsg('Ustalam lokalizację…');
    navigator.geolocation.getCurrentPosition(
      (g) => { set({ lat: +g.coords.latitude.toFixed(6), lon: +g.coords.longitude.toFixed(6) }); setGeoMsg('Ustawiliśmy pinezkę w Twojej lokalizacji. Możesz ją przesunąć.'); },
      () => setGeoMsg('Nie udało się ustalić lokalizacji. Kliknij miejsce na mapie.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  const field = (k: keyof AedDraft, label: string, opts: { hint?: string; auto?: string; mode?: 'numeric' } = {}) => (
    <div className="field">
      <label htmlFor={ids[k as string]}>{label}<Req /></label>
      {opts.hint && <p id={`${ids[k as string]}-hint`} className="hint">{opts.hint}</p>}
      <input id={ids[k as string]} type="text" required autoComplete={opts.auto ?? 'off'} inputMode={opts.mode} value={String(d[k] ?? '')}
        onChange={(ev) => set({ [k]: ev.target.value } as Partial<AedDraft>)} onBlur={() => v.check(k as string)}
        aria-invalid={!!e[k as string]} aria-describedby={[opts.hint ? `${ids[k as string]}-hint` : '', e[k as string] ? `${ids[k as string]}-err` : ''].filter(Boolean).join(' ') || undefined} />
      {e[k as string] && <p id={`${ids[k as string]}-err`} className="field-error">{e[k as string]}</p>}
    </div>
  );

  return (
    <form noValidate onSubmit={(ev) => { ev.preventDefault(); if (v.validateAll()) next(); }}>
      <RequiredNote />
      <ErrorSummary errors={v.summary} fieldIds={ids} focusToken={v.focusToken} />
      <p>Użyj swojej lokalizacji albo kliknij miejsce na mapie. Pinezkę możesz przesunąć.</p>
      <p><button id="w-locate" type="button" className="btn btn--secondary" onClick={locate}>Użyj mojej lokalizacji</button></p>
      <p role="status" className="hint">{geoMsg}</p>
      <MapView items={[]} picked={d.lat !== null && d.lon !== null ? { lat: d.lat, lon: d.lon } : null}
        onPick={(p) => { set({ lat: p.lat, lon: p.lon }); setGeoMsg('Ustawiliśmy pinezkę w wybranym miejscu.'); v.check('pt'); }}
        label="Mapa: kliknij miejsce, w którym jest AED. Bez myszy użyj przycisku „Użyj mojej lokalizacji”." height={320} cluster={false} />
      {e.pt && <p className="field-error">{e.pt}</p>}
      <details className="details">
        <summary>Wpisz współrzędne ręcznie</summary>
        <div className="filters__grid">
          <div className="field">
            <label htmlFor="w-lat">Szerokość (np. 52.2297)</label>
            <input id="w-lat" type="text" inputMode="decimal" autoComplete="off" value={d.lat ?? ''} onChange={(ev) => set({ lat: ev.target.value ? Number(ev.target.value.replace(',', '.')) : null })} />
          </div>
          <div className="field">
            <label htmlFor="w-lon">Długość (np. 21.0122)</label>
            <input id="w-lon" type="text" inputMode="decimal" autoComplete="off" value={d.lon ?? ''} onChange={(ev) => set({ lon: ev.target.value ? Number(ev.target.value.replace(',', '.')) : null })} />
          </div>
        </div>
      </details>
      {inst && <>
        {field('nazwa', 'Nazwa budynku lub miejsca', { hint: 'Np. Szkoła Podstawowa nr 5, Urząd Gminy.' })}
        {field('miejscowosc', 'Miejscowość', { auto: 'off' })}
        <div className="field">
          <label htmlFor="w-ulica">Ulica</label>
          <p id="w-ulica-hint" className="hint">Bez „ul.”. Zostaw puste, jeśli w miejscowości nie ma ulic.</p>
          <input id="w-ulica" type="text" autoComplete="off" aria-describedby="w-ulica-hint" value={d.ulica} onChange={(ev) => set({ ulica: ev.target.value })} />
        </div>
        {field('numer', 'Numer budynku')}
        {field('kod', 'Kod pocztowy', { hint: 'W formie 00-000, np. 85-005.', mode: 'numeric' })}
      </>}
      <div className="field">
        <label htmlFor="w-opis">Gdzie dokładnie wisi AED?<Req /></label>
        <p id="w-opis-hint" className="hint">Np. przy wejściu głównym, obok portierni.</p>
        <textarea id="w-opis" required autoComplete="off" maxLength={250} rows={3} value={d.opis} onChange={(ev) => set({ opis: ev.target.value })} onBlur={() => v.check('opis')}
          aria-invalid={!!e.opis} aria-describedby={`w-opis-hint${e.opis ? ' w-opis-err' : ''}`} />
        {e.opis && <p id="w-opis-err" className="field-error">{e.opis}</p>}
      </div>
      <Nav back={back} />
    </form>
  );
}

function StepHours({ variant, d, set, back, next }: { variant: Variant; d: AedDraft; set: (p: Partial<AedDraft>) => void; back: () => void; next: () => void }) {
  const inst = variant === 'institution';
  const h = d.hours;
  const setH = (p: Partial<Hours>) => set({ hours: { ...h, ...p } });
  const v = useValidation({
    mode: () => (inst && (h.mode === '' || h.mode === 'unknown') ? 'Wybierz godziny – bez nich AED nie trafi na mapę.' : ''),
    days: () => hoursError(h),
  });
  const modes: { m: HoursMode; label: string }[] = [
    { m: '24h', label: 'Całą dobę' }, { m: 'hours', label: 'W określonych godzinach' }, ...(inst ? [] : [{ m: 'unknown' as HoursMode, label: 'Nie wiem' }]),
  ];
  const setDay = (i: number, p: { open?: string; close?: string }) => setH({ days: h.days.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const copyMonday = () => setH({ days: h.days.map((x, j) => (j > 0 && j < 5 ? { ...h.days[0] } : x)) });
  return (
    <form noValidate onSubmit={(ev) => { ev.preventDefault(); if (!inst && h.mode === '') setH({ mode: 'unknown' }); if (v.validateAll()) next(); }}>
      {inst && <RequiredNote />}
      <ErrorSummary errors={v.summary} fieldIds={{ mode: 'w-mode-0', days: 'w-day-0-open' }} focusToken={v.focusToken} />
      <fieldset>
        <legend>Kiedy AED jest dostępne?{inst && <Req />}</legend>
        <div className="big-choices">
          {modes.map((o, i) => (
            <label key={o.m} htmlFor={`w-mode-${i}`}><input id={`w-mode-${i}`} type="radio" name="w-mode" checked={h.mode === o.m} onChange={() => setH({ mode: o.m })} /> {o.label}</label>
          ))}
        </div>
        {v.errors.mode && <p className="field-error">{v.errors.mode}</p>}
      </fieldset>
      {h.mode === 'hours' && (
        <fieldset>
          <legend>Wybierz godziny przy każdym dniu. Dzień bez godzin = zamknięte.</legend>
          <div className="week">
            {DAY_NAMES.map((name, i) => (
              <div className="week__row" key={name}>
                <span className="week__day" id={`w-day-${i}`}>{name}</span>
                <select id={`w-day-${i}-open`} aria-label={`${name}: od godziny`} value={h.days[i].open} onChange={(ev) => setDay(i, { open: ev.target.value })} onBlur={() => v.check('days')}>
                  <option value="">od: zamknięte</option>
                  {TIMES.map((t) => <option key={t} value={t}>od {t}</option>)}
                </select>
                <select aria-label={`${name}: do godziny`} value={h.days[i].close} onChange={(ev) => setDay(i, { close: ev.target.value })} onBlur={() => v.check('days')}>
                  <option value="">do: zamknięte</option>
                  {CLOSE_TIMES.map((t) => <option key={t} value={t}>do {t}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p><button type="button" className="btn btn--secondary" onClick={copyMonday}>Ustaw godziny z poniedziałku na wtorek–piątek</button></p>
          {v.errors.days && <p className="field-error">{v.errors.days}</p>}
          <p className="preview" aria-live="polite"><strong>Godziny:</strong> {hoursInWords(h)}</p>
        </fieldset>
      )}
      <Nav back={back} skip={inst ? undefined : () => { setH({ mode: 'unknown' }); next(); }} />
    </form>
  );
}

function StepCabinet({ d, set, back, next }: { d: AedDraft; set: (p: Partial<AedDraft>) => void; back: () => void; next: () => void }) {
  const opts: { c: Cabinet; label: string }[] = [{ c: 'tak', label: 'Tak' }, { c: 'nie', label: 'Nie' }, { c: 'nie_wiem', label: 'Nie wiem' }];
  return (
    <form noValidate onSubmit={(ev) => { ev.preventDefault(); if (d.cabinet === '') set({ cabinet: 'nie_wiem' }); next(); }}>
      <fieldset>
        <legend>Czy szafka z AED jest zamknięta na klucz lub kod?</legend>
        <div className="big-choices">
          {opts.map((o) => (
            <label key={o.c} htmlFor={`w-cab-${o.c}`}><input id={`w-cab-${o.c}`} type="radio" name="w-cab" checked={d.cabinet === o.c} onChange={() => set({ cabinet: o.c })} /> {o.label}</label>
          ))}
        </div>
      </fieldset>
      {d.cabinet === 'tak' && (
        <div className="field">
          <label htmlFor="w-access">Jak się do niego dostać?</label>
          <p id="w-access-hint" className="hint">Np. klucz w portierni, kod podaje dyspozytor 112.</p>
          <textarea id="w-access" autoComplete="off" maxLength={250} rows={3} aria-describedby="w-access-hint" value={d.access} onChange={(ev) => set({ access: ev.target.value })} />
        </div>
      )}
      <Nav back={back} skip={() => { set({ cabinet: 'nie_wiem' }); next(); }} />
    </form>
  );
}

function StepSummary({ variant, d, goto, back, submit, label, busy, failure }: {
  variant: Variant; d: AedDraft; goto: (n: number) => void; back: () => void; submit: () => void; label: string; busy?: boolean; failure?: ReactNode;
}) {
  const inst = variant === 'institution';
  const rows: { k: string; v: string; step: number }[] = [
    ...(inst ? [{ k: 'Nazwa i adres', v: [d.nazwa, [d.ulica, d.numer].filter(Boolean).join(' '), `${d.kod} ${d.miejscowosc}`].filter((x) => x.trim()).join(', '), step: 1 }] : []),
    { k: 'Miejsce na mapie', v: d.lat !== null && d.lon !== null ? 'Zaznaczone' : 'Nie zaznaczono', step: 1 },
    { k: 'Gdzie dokładnie', v: d.opis || '—', step: 1 },
    { k: 'Kiedy dostępne', v: hoursInWords(d.hours), step: 2 },
    { k: 'Szafka', v: CAB_WORDS[d.cabinet] + (d.cabinet === 'tak' && d.access ? ` – ${d.access}` : ''), step: 3 },
  ];
  return (
    <form noValidate onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
      <dl className="summary-list">
        {rows.map((r) => (
          <div key={r.k}>
            <dt>{r.k}</dt><dd>{r.v}</dd>
            <dd><button type="button" className="btn btn--tertiary" onClick={() => goto(r.step)}>Zmień<span className="visually-hidden">: {r.k}</span></button></dd>
          </div>
        ))}
      </dl>
      {failure}
      <Nav back={back} nextLabel={busy ? 'Wysyłam…' : label} busy={busy} />
    </form>
  );
}
