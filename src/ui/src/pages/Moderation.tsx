// E9 – Moderacja: queue of citizen reports (status do_weryfikacji) – approve, reject, merge.
import { useState } from 'react';
import { decideReport, listReports } from '../api/client';
import { ErrorBox, Loading } from '../components/ui';
import { date } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { usePageTitle } from '../router';

const VERB = { zatwierdz: 'zatwierdzono', odrzuc: 'odrzucono', scal: 'scalono z istniejącym AED' } as const;

export function Moderation() {
  usePageTitle('Moderacja zgłoszeń');
  const st = useAsync(() => listReports(), []);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, d: keyof typeof VERB) {
    setBusy(id);
    try { await decideReport(id, d); setMsg(`Zgłoszenie ${id}: ${VERB[d]}.`); st.reload(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <h1 id="page-title">Moderacja zgłoszeń</h1>
      <p className="lead">Zgłoszenia obywateli czekają tutaj, zanim trafią do zbioru. W wersji produkcyjnej panel wymaga zalogowania moderatora.</p>
      <p role="status" className="status-line">{msg}</p>
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (st.data.length === 0 ? <p>Brak zgłoszeń do weryfikacji.</p> : (
        <ul className="aed-list">
          {st.data.map((r) => (
            <li key={r.id} className="aed-item">
              <h2 className="aed-item__title">{r.id}</h2>
              <p>{r.opis}</p>
              <p className="hint">Zgłoszono {date(r.czas)} · punkt {r.lat.toFixed(5)}, {r.lon.toFixed(5)} · <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=19/${r.lat}/${r.lon}`} target="_blank" rel="noopener noreferrer">pokaż na mapie<span className="visually-hidden"> (nowa karta)</span></a></p>
              <p className="aed-item__actions">
                <button type="button" className="btn btn--primary btn--sm" disabled={busy === r.id} onClick={() => decide(r.id, 'zatwierdz')}>Zatwierdź<span className="visually-hidden"> {r.id}</span></button>
                <button type="button" className="btn btn--secondary btn--sm" disabled={busy === r.id} onClick={() => decide(r.id, 'scal')}>Scal z istniejącym<span className="visually-hidden"> {r.id}</span></button>
                <button type="button" className="btn btn--secondary btn--sm" disabled={busy === r.id} onClick={() => decide(r.id, 'odrzuc')}>Odrzuć<span className="visually-hidden"> {r.id}</span></button>
              </p>
            </li>
          ))}
        </ul>
      ))}
    </>
  );
}
