// Citizen reports (docs/MODEL_ROL.md P6, P7). Provider: reports about ITS AED – "przyjęte" / "odrzucone".
// Administrator: reports of devices without a provider – "zaproszenie" (invite the owner) / "odrzucone".
// A decision never changes AED data (K7); the provider changes its own dataset and republishes it.
import { useState } from 'react';
import { decideReport, listReports } from '../api/client';
import { date } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link } from '../router';
import { ErrorBox, ExternalLink, Loading } from './ui';

type R = { id: string; lat: number; lon: number; opis: string; czas: string; status: string; typ?: string; id_aed?: string | null;
  zdjecie_url?: string | null; godziny_dostepnosci?: string | null; szafka_zamknieta?: boolean | null; instrukcja_dostepu?: string | null; podano_email?: boolean };

const TYP: Record<string, string> = {
  brak: 'AED nie ma na miejscu', awaria: 'AED nie działa', brak_dostepu: 'Nie da się dostać do AED', bledne_polozenie: 'Złe położenie na mapie',
  inne: 'Inny problem', nowe: 'Nowe AED spoza listy',
};

export function ReportsQueue({ mode }: { mode: 'dostawca' | 'administrator' }) {
  const st = useAsync(() => listReports() as Promise<R[]>, []);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const actions = mode === 'dostawca'
    ? [{ d: 'przyjete' as const, l: 'Przyjmuję – poprawię dane' }, { d: 'odrzucone' as const, l: 'Odrzuć' }]
    : [{ d: 'zaproszenie' as const, l: 'Zaproś właściciela do publikacji' }, { d: 'odrzucone' as const, l: 'Odrzuć' }];

  async function decide(id: string, d: 'przyjete' | 'odrzucone' | 'zaproszenie') {
    setBusy(id); setMsg('');
    try { const r = await decideReport(id, d); setMsg(r.meta.komunikat); st.reload(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <p role="status" className="status-line">{msg}</p>
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (st.data.length === 0 ? <p>Brak zgłoszeń do rozpatrzenia.</p> : (
        <ul className="aed-list">
          {st.data.map((r) => (
            <li key={r.id} className="aed-item">
              <h3 className="aed-item__title">{TYP[r.typ ?? 'nowe'] ?? 'Zgłoszenie'}{r.id_aed && <> – <Link to={`/aed/${r.id_aed}`}>AED {r.id_aed}</Link></>}</h3>
              <p>{r.opis}</p>
              {(r.godziny_dostepnosci || r.szafka_zamknieta != null) && (
                <p className="hint">
                  {r.godziny_dostepnosci && <>Godziny podane w zgłoszeniu: <code>{r.godziny_dostepnosci}</code>. </>}
                  {r.szafka_zamknieta === true && <>Szafka zamknięta{r.instrukcja_dostepu ? ` – ${r.instrukcja_dostepu}` : ''}. </>}
                  {r.szafka_zamknieta === false && <>Szafka otwarta. </>}
                </p>
              )}
              {r.zdjecie_url && (
                <p><a href={r.zdjecie_url} target="_blank" rel="noopener noreferrer">
                  <img className="report-photo" src={r.zdjecie_url} alt={`Zdjęcie ze zgłoszenia ${r.id} (otwiera się w nowym oknie)`} loading="lazy" />
                </a></p>
              )}
              <p className="hint">Zgłoszono {date(r.czas)} · punkt {r.lat.toFixed(5)}, {r.lon.toFixed(5)} · <ExternalLink href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=19/${r.lat}/${r.lon}`}>pokaż na mapie</ExternalLink>
                {r.podano_email ? ' · zgłaszający zostawił e-mail do odpowiedzi (usuniemy go po zamknięciu)' : ''}</p>
              <p className="aed-item__actions">
                {actions.map((a) => (
                  <button key={a.d} type="button" className={`btn ${a.d === 'odrzucone' ? 'btn--danger' : 'btn--secondary'}`} disabled={busy === r.id} onClick={() => decide(r.id, a.d)}>
                    {a.l}<span className="visually-hidden"> – zgłoszenie {r.id}</span>
                  </button>
                ))}
              </p>
            </li>
          ))}
        </ul>
      ))}
      <p className="hint">{mode === 'dostawca'
        ? 'Rozpatrzenie zgłoszenia nie zmienia danych. Jeśli zgłoszenie jest słuszne, popraw AED w kopii roboczej i opublikuj nowe pliki (zalecany termin: 14 dni).'
        : 'Urządzenia spoza listy nie dodajemy za właściciela. Zaproszenie oznacza miejsce jako lukę i trafia do akcji promocyjnej.'}</p>
    </>
  );
}
