// E9 – Moderacja: queue of citizen reports (status do_weryfikacji) – approve (with record fields), reject, merge.
import { useState, type FormEvent } from 'react';
import { decideReport, HttpError, listReports } from '../api/client';
import { RequireLogin } from '../components/Auth';
import { ErrorBox, Loading } from '../components/ui';
import { date, dictValues, label } from '../lib/format';
import { fieldLabel } from '../lib/fields';
import { useAsync } from '../lib/useAsync';
import { usePageTitle } from '../router';

const VERB = { zatwierdz: 'zatwierdzono i dodano do zbioru', odrzuc: 'odrzucono', scal: 'scalono z istniejącym AED' } as const;

type Report = { id: string; lat: number; lon: number; opis: string; czas: string; status: string; nazwa_obiektu?: string | null };

export function Moderation() {
  usePageTitle('Moderacja zgłoszeń');
  return (
    <>
      <h1 id="page-title">Moderacja zgłoszeń</h1>
      <p className="lead">Zgłoszenia obywateli czekają tutaj, zanim trafią do zbioru. Przed zatwierdzeniem uzupełnij adres i godziny – bez nich rekord nie spełnia wzorcowego zakresu danych.</p>
      <RequireLogin role="moderator">
        <Queue />
      </RequireLogin>
    </>
  );
}

function Queue() {
  const st = useAsync(() => listReports() as Promise<Report[]>, []);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function decide(id: string, d: 'odrzuc' | 'scal') {
    setBusy(id); setMsg('');
    try { await decideReport(id, d); setMsg(`Zgłoszenie ${id}: ${VERB[d]}.`); st.reload(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <p role="status" className="status-line">{msg}</p>
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (st.data.length === 0 ? <p>Brak zgłoszeń do weryfikacji.</p> : (
        <ul className="aed-list">
          {st.data.map((r) => (
            <li key={r.id} className="aed-item">
              <h2 className="aed-item__title">Zgłoszenie {r.id}</h2>
              <p>{r.opis}</p>
              <p className="hint">Zgłoszono {date(r.czas)} · punkt {r.lat.toFixed(5)}, {r.lon.toFixed(5)} · <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=19/${r.lat}/${r.lon}`} target="_blank" rel="noopener noreferrer">pokaż na mapie<span className="visually-hidden"> (nowa karta)</span></a></p>
              {open === r.id ? (
                <ApproveForm report={r} onCancel={() => setOpen(null)}
                  onDone={() => { setOpen(null); setMsg(`Zgłoszenie ${r.id}: ${VERB.zatwierdz}.`); st.reload(); }} />
              ) : (
                <p className="aed-item__actions">
                  <button type="button" className="btn btn--primary btn--sm" disabled={busy === r.id} onClick={() => setOpen(r.id)}>Zatwierdź…<span className="visually-hidden"> zgłoszenie {r.id}</span></button>
                  <button type="button" className="btn btn--secondary btn--sm" disabled={busy === r.id} onClick={() => decide(r.id, 'scal')}>Scal z istniejącym<span className="visually-hidden"> – zgłoszenie {r.id}</span></button>
                  <button type="button" className="btn btn--secondary btn--sm" disabled={busy === r.id} onClick={() => decide(r.id, 'odrzuc')}>Odrzuć<span className="visually-hidden"> zgłoszenie {r.id}</span></button>
                </p>
              )}
            </li>
          ))}
        </ul>
      ))}
    </>
  );
}

// Fields the moderator completes. Others (województwo from postcode, gmina, 24h, wewnątrz budynku…) the API infers.
type F = { name: string; required?: boolean; hint?: string; kind?: 'text' | 'select' | 'check'; dict?: string };
const FORM: F[] = [
  { name: 'nazwa_obiektu', required: true, hint: 'np. Apteka „Pod Lipami”' },
  { name: 'opis_lokalizacji', required: true, hint: 'Gdzie dokładnie wisi AED.' },
  { name: 'miejscowosc', required: true },
  { name: 'ulica', hint: 'Bez „ul.” – dodamy cechę ulicy sami.' },
  { name: 'numer_budynku', required: true },
  { name: 'kod_pocztowy', required: true, hint: 'NN-NNN, np. 00-060. Na jego podstawie ustalimy województwo.' },
  { name: 'godziny_dostepnosci', required: true, hint: 'np. 24/7 albo Mo-Fr 08:00-20:00; Sa 09:00-14:00' },
  { name: 'dostep', kind: 'select', dict: 'dostep', hint: 'Puste = ustalimy z godzin.' },
  { name: 'szafka_zamknieta', kind: 'check' },
  { name: 'instrukcja_dostepu', hint: 'Wymagana w praktyce, gdy szafka jest zamknięta.' },
  { name: 'dysponent_nazwa', hint: 'Puste = nazwa obiektu.' },
  { name: 'dysponent_typ', kind: 'select', dict: 'dysponent_typ', hint: 'Puste = „inny”.' },
];

function ApproveForm({ report, onDone, onCancel }: { report: Report; onDone: () => void; onCancel: () => void }) {
  const [v, setV] = useState<Record<string, string | boolean>>({ nazwa_obiektu: report.nazwa_obiektu ?? '', opis_lokalizacji: report.opis.slice(0, 250) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const id = (f: string) => `ap-${report.id}-${f}`;

  function focusFirst(er: Record<string, string>) {
    const first = FORM.find((f) => er[f.name]);
    setTimeout(() => document.getElementById(first ? id(first.name) : `ap-${report.id}-summary`)?.focus(), 0);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    for (const f of FORM) if (f.required && !String(v[f.name] ?? '').trim()) er[f.name] = `Uzupełnij pole „${fieldLabel(f.name)}”.`;
    setErrors(er); setFail('');
    if (Object.keys(er).length) { focusFirst(er); return; }
    const rekord: Record<string, unknown> = {};
    for (const f of FORM) {
      const val = v[f.name];
      if (f.kind === 'check') rekord[f.name] = !!val;
      else if (typeof val === 'string' && val.trim()) rekord[f.name] = val.trim();
    }
    setBusy(true);
    try { await decideReport(report.id, 'zatwierdz', rekord); onDone(); }
    catch (ex) {
      if (ex instanceof HttpError && ex.status === 422 && Object.keys(ex.fields).length) { setErrors(ex.fields); focusFirst(ex.fields); }
      setFail((ex as Error).message);
    } finally { setBusy(false); }
  }

  const known = new Set(FORM.map((f) => f.name));
  const errList = Object.entries(errors);
  return (
    <form onSubmit={submit} noValidate className="approve-form" aria-label={`Zatwierdzenie zgłoszenia ${report.id}`}>
      {(errList.length > 0 || fail) && (
        <div className="callout callout--error" role="alert" id={`ap-${report.id}-summary`} tabIndex={-1}>
          <p className="callout__title">{fail || 'Popraw zaznaczone pola'}</p>
          {errList.length > 0 && (
            <ul>{errList.map(([k, m]) => <li key={k}>{known.has(k) ? <a href={`#${id(k)}`}>{m}</a> : <>{fieldLabel(k)}: {m}</>}</li>)}</ul>
          )}
        </div>
      )}
      <div className="form-grid">
        {FORM.map((f) => {
          const err = errors[f.name];
          const desc = [f.hint ? `${id(f.name)}-hint` : '', err ? `${id(f.name)}-err` : ''].filter(Boolean).join(' ') || undefined;
          if (f.kind === 'check') {
            return (
              <div className="field" key={f.name}>
                <label className="switch"><input id={id(f.name)} type="checkbox" checked={!!v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} /> {fieldLabel(f.name)}</label>
                {err && <p id={`${id(f.name)}-err`} className="field-error">{err}</p>}
              </div>
            );
          }
          return (
            <div className="field" key={f.name}>
              <label htmlFor={id(f.name)}>{fieldLabel(f.name)} {f.required && <span className="req">(wymagane)</span>}</label>
              {f.hint && <p id={`${id(f.name)}-hint`} className="hint">{f.hint}</p>}
              {f.kind === 'select' ? (
                <select id={id(f.name)} value={String(v[f.name] ?? '')} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} aria-invalid={!!err} aria-describedby={desc}>
                  <option value="">– nie wybrano –</option>
                  {dictValues(f.dict!).map((d) => <option key={d.wartosc} value={d.wartosc}>{label(f.dict!, d.wartosc)}</option>)}
                </select>
              ) : (
                <input id={id(f.name)} type="text" value={String(v[f.name] ?? '')} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} aria-invalid={!!err} aria-describedby={desc} />
              )}
              {err && <p id={`${id(f.name)}-err`} className="field-error">{err}</p>}
            </div>
          );
        })}
      </div>
      <p className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel}>Anuluj</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Zapisuję…' : 'Zatwierdź i dodaj do zbioru'}</button>
      </p>
    </form>
  );
}
