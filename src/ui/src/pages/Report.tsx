// E4 – Zgłoś problem z AED (resident, from the AED card): goes to the provider of the record, or to the administrator for
// helper-layer points. New AED are reported only by logged-in institutions (pages/ZglosAed.tsx, MODEL_ROL v1.3).
import { useState, type FormEvent } from 'react';
import { getAed, reportAed, type TypZgloszenia } from '../api/client';
import { useAsync } from '../lib/useAsync';
import { PhotoField } from '../components/PhotoField';
import { Icon } from '../components/ui';
import { Link, navigate, useQueryParam, usePageTitle } from '../router';
import { useSession } from '../components/Auth';

export function Report() {
  const aedId = useQueryParam('aed');
  return aedId ? <ProblemReport id={aedId} /> : <NewAedInfo />;
}

/** MODEL_ROL v1.3: new AED are reported only by logged-in institutions; residents report problems from an AED card. */
function NewAedInfo() {
  usePageTitle('Zgłoś AED');
  const s = useSession();
  if (s?.rola === 'dysponent') { navigate('/zglos-aed', true); return null; }
  return (
    <>
      <h1 id="page-title">Zgłoś AED</h1>
      <p className="lead">Nowe defibrylatory zgłaszają instytucje, które za nie odpowiadają (właściciel, zarządca, podmiot sprawdzający AED na miejscu) – po zalogowaniu. Dzięki temu każde AED na mapie ma kogoś, kto dba o aktualność danych.</p>
      <ul>
        <li><strong>Widzisz problem z AED na mapie?</strong> Otwórz jego kartę w <Link to="/znajdz">Znajdź AED</Link> i wybierz „Zgłoś problem” – bez logowania.</li>
        <li><strong>Reprezentujesz instytucję?</strong> <Link to="/logowanie">Zaloguj się</Link> albo <Link to="/wniosek-o-konto">złóż wniosek o konto</Link>.</li>
      </ul>
    </>
  );
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
