// E4 – Zgłoś AED (resident): one question per screen, 4 steps. No personal data; goes to moderation.
// Hours, cabinet and an optional photo go as separate fields (HANDOFF A #8); the description also says them in words.
import { useState, type FormEvent } from 'react';
import { getAed, reportAed, type TypZgloszenia } from '../api/client';
import { useAsync } from '../lib/useAsync';
import { AedWizard, citizenDescription, emptyDraft, type AedDraft } from '../components/AedWizard';
import { PhotoField } from '../components/PhotoField';
import { hoursToOpeningHours } from '../lib/hoursBuilder';
import { ErrorBox, Icon } from '../components/ui';
import { Link, useQueryParam, usePageTitle } from '../router';

export function Report() {
  const aedId = useQueryParam('aed');
  return aedId ? <ProblemReport id={aedId} /> : <NewAedReport />;
}

const TYPY: { v: Exclude<TypZgloszenia, 'nowe'>; l: string }[] = [
  { v: 'brak', l: 'AED nie ma na miejscu' }, { v: 'awaria', l: 'AED nie działa albo jest uszkodzone' },
  { v: 'brak_dostepu', l: 'Nie da się dostać do AED (zamknięte, brak klucza)' }, { v: 'bledne_polozenie', l: 'Złe miejsce na mapie albo zły opis' },
  { v: 'inne', l: 'Inny problem' },
];

/** Optional e-mail – only to answer the reporter; deleted when the report is closed (RODO). */
function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor="rep-mail">Twój e-mail (nieobowiązkowy)</label>
      <p id="rep-mail-hint" className="hint">Tylko po to, by odpowiedzieć na zgłoszenie. Usuniemy go po zamknięciu zgłoszenia.</p>
      <input id="rep-mail" type="email" autoComplete="email" aria-describedby="rep-mail-hint" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Problem with a specific AED (from its card): goes to the provider of that record (P6) – or to the administrator for helper-layer points. */
function ProblemReport({ id }: { id: string }) {
  usePageTitle('Zgłoś problem z AED');
  const st = useAsync(() => getAed(id), [id]);
  const [typ, setTyp] = useState<Exclude<TypZgloszenia, 'nowe'> | ''>('');
  const [opis, setOpis] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const a = st.data?.aed;
  async function send(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (!typ) { setErr('Wybierz, co jest nie tak.'); return; }
    if (opis.trim().length < 3) { setErr('Opisz krótko problem.'); return; }
    if (!a) return;
    setBusy(true);
    try {
      const r = await reportAed(a.szerokosc_geograficzna, a.dlugosc_geograficzna, opis.trim(), { id_aed: id, typ, ...(email.trim() ? { email: email.trim() } : {}), ...(photo ? { zdjecie: photo } : {}) });
      setDone((r as { meta?: { komunikat?: string } }).meta?.komunikat ?? 'Dziękujemy! Przekazaliśmy zgłoszenie.');
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  }
  if (done) {
    return (<><h1 id="page-title">Zgłoszenie wysłane</h1><div className="callout callout--ok" role="status"><p className="callout__title"><Icon name="check" />{done}</p></div>
      <p><Link to={`/aed/${id}`}>Wróć do karty AED</Link></p></>);
  }
  return (
    <>
      <h1 id="page-title">Zgłoś problem z AED</h1>
      {a && <p className="lead">{a.nazwa_obiektu}{a.meta?.dostawca ? <> – zgłoszenie trafi do właściciela danych: <strong>{a.meta.dostawca}</strong>. To on decyduje o zmianie danych.</> : <> – to punkt „do sprawdzenia”, zgłoszenie trafi do administratora.</>}</p>}
      <form onSubmit={send} noValidate>
        <fieldset>
          <legend>Co jest nie tak?</legend>
          <div className="big-choices">
            {TYPY.map((t) => <label key={t.v} htmlFor={`typ-${t.v}`}><input id={`typ-${t.v}`} type="radio" name="typ" checked={typ === t.v} onChange={() => setTyp(t.v)} /> {t.l}</label>)}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="rep-opis">Opisz krótko</label>
          <p id="rep-opis-hint" className="hint">Nie podawaj imienia, nazwiska ani telefonu.</p>
          <textarea id="rep-opis" rows={4} maxLength={500} aria-describedby="rep-opis-hint" value={opis} onChange={(e) => setOpis(e.target.value)} />
        </div>
        <PhotoField value={photo} onChange={setPhoto} />
        <EmailField value={email} onChange={setEmail} />
        {err && <p className="field-error" role="alert">{err}</p>}
        <p className="form-actions"><button type="submit" className="btn btn--primary" disabled={busy || !a}>{busy ? 'Wysyłam…' : 'Wyślij zgłoszenie'}</button>
          <Link to={`/aed/${id}`}>Anuluj</Link></p>
      </form>
    </>
  );
}

/** New AED not on the list (P7): goes to the administrator, who invites the owner – it is never added for them. */
function NewAedReport() {
  usePageTitle('Zgłoś AED');
  const aedId = null as string | null;
  const [draft, setDraft] = useState<AedDraft>(() => ({ ...emptyDraft(), opis: aedId ? `Problem z AED ${aedId}: ` : '' }));
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  async function send() {
    setBusy(true); setFail(null);
    try {
      const oh = hoursToOpeningHours(draft.hours);
      await reportAed(draft.lat!, draft.lon!, citizenDescription(draft), {
        ...(oh ? { godziny_dostepnosci: oh } : {}),
        ...(draft.cabinet === 'tak' ? { szafka_zamknieta: true, ...(draft.access.trim() ? { instrukcja_dostepu: draft.access.trim() } : {}) } : {}),
        ...(draft.cabinet === 'nie' ? { szafka_zamknieta: false } : {}),
        ...(photo ? { zdjecie: photo } : {}),
        typ: 'nowe', ...(email.trim() ? { email: email.trim() } : {}),
      });
      setDone(true);
    } catch (ex) { setFail(ex as Error); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <>
        <h1 id="page-title">Dziękujemy!</h1>
        <div className="callout callout--ok" role="status">
          <p className="callout__title"><Icon name="check" />Dziękujemy! Tego AED nie ma na wspólnej liście – zaprosimy jego właściciela do opublikowania danych.</p>
        </div>
        <p className="form-actions">
          <button type="button" className="btn btn--primary" onClick={() => { setDraft(emptyDraft()); setPhoto(null); setStep(1); setDone(false); }}>Zgłoś kolejne AED</button>
          <Link to="/">Wróć na stronę główną</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 id="page-title">Zgłoś AED, które widzisz</h1>
      <p className="lead">Widzisz defibrylator, którego nie ma na mapie? Odpowiedz na 4 krótkie pytania. Nie podawaj imienia, nazwiska ani telefonu.</p>
      <AedWizard variant="citizen" draft={draft} setDraft={setDraft} step={step} setStep={setStep} onSubmit={send}
        submitLabel="Wyślij zgłoszenie" busy={busy} failure={fail && <ErrorBox error={fail} />}
        beforeSubmit={<><PhotoField value={photo} onChange={setPhoto} /><EmailField value={email} onChange={setEmail} /></>} />
    </>
  );
}
