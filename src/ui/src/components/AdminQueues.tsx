// Administrator queues (MODEL_ROL v1.3, CR-TL-8): account requests of institutions and "Zgłoś AED" submissions.
// Formal check only – the administrator approves or rejects / sends back with a comment; there are no edit fields.
import { useState } from 'react';
import {
  adminSubmissions, apiUrl, decideAccountRequest, decideSubmission, listAccountRequests, type Wniosek, type ZgloszenieAed,
} from '../api/client';
import { PODSTAWA_LABEL } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { MapView } from './MapView';
import { ErrorBox, ExternalLink, Loading } from './ui';

const when = (t: string | null | undefined) => (t ? t.replace('T', ', ') : '—');
const DOSTEP: Record<string, string> = { publiczny: 'dla wszystkich', ograniczony: 'ograniczony', prywatny: 'tylko dla uprawnionych' };

export function AccountRequests() {
  const st = useAsync(() => listAccountRequests('oczekuje'), []);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Error | null>(null);
  const [info, setInfo] = useState('');
  async function decide(w: Wniosek, d: 'zatwierdz' | 'odrzuc') {
    setErr(null); setInfo('');
    if (d === 'odrzuc' && !(why[w.id] ?? '').trim()) { setErr(new Error('Przy odrzuceniu wpisz uzasadnienie.')); return; }
    try {
      await decideAccountRequest(w.id, d, (why[w.id] ?? '').trim() || undefined);
      setInfo(d === 'zatwierdz' ? `Konto „${w.login}” zatwierdzone – instytucja może się zalogować.` : `Wniosek „${w.login}” odrzucony.`);
      st.reload();
    } catch (ex) { setErr(ex as Error); }
  }
  return (
    <section className="admin-section" aria-labelledby="h-req">
      <h2 id="h-req">Wnioski o konto instytucji</h2>
      <p>Instytucje zakładają konto same; działa ono dopiero po Twoim zatwierdzeniu. Sprawdź, czy instytucja istnieje (REGON), czy e-mail jest służbowy i czy podstawa publikacji jest prawdziwa (właściciel, zarządca z umową, podmiot sprawdzający AED na miejscu).</p>
      {info && <p className="callout callout--ok" role="status">{info}</p>}
      {err && <ErrorBox error={err} />}
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (st.data.length === 0 ? <p>Brak wniosków czekających na decyzję.</p> : (
        <table className="admin-table">
          <thead><tr><th scope="col">Instytucja</th><th scope="col">Podstawa</th><th scope="col">Kontakt</th><th scope="col">Złożony</th><th scope="col">Decyzja</th></tr></thead>
          <tbody>
            {st.data.map((w) => (
              <tr key={w.id}>
                <td>{w.nazwa_instytucji}<div className="hint">REGON {w.regon} · login <code>{w.login}</code></div></td>
                <td>{PODSTAWA_LABEL[w.podstawa]}</td>
                <td>{w.email_sluzbowy}<div className="hint">{w.telefon}</div></td>
                <td>{when(w.utworzono)}</td>
                <td>
                  <button type="button" className="btn btn--primary btn--small" onClick={() => decide(w, 'zatwierdz')}>Zatwierdź<span className="visually-hidden"> {w.nazwa_instytucji}</span></button>
                  <label className="visually-hidden" htmlFor={`why-${w.id}`}>Uzasadnienie odrzucenia – {w.nazwa_instytucji}</label>
                  <input id={`why-${w.id}`} type="text" placeholder="uzasadnienie (przy odrzuceniu)" value={why[w.id] ?? ''} onChange={(e) => setWhy({ ...why, [w.id]: e.target.value })} />
                  <button type="button" className="btn btn--danger btn--small" onClick={() => decide(w, 'odrzuc')}>Odrzuć<span className="visually-hidden"> {w.nazwa_instytucji}</span></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}

export function AedSubmissionsQueue() {
  const [status, setStatus] = useState('oczekuje');
  const st = useAsync(() => adminSubmissions(status), [status]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Error | null>(null);
  const [info, setInfo] = useState('');
  async function decide(z: ZgloszenieAed, d: 'zatwierdz' | 'do_poprawy') {
    setErr(null); setInfo('');
    const c = (comment[z.id] ?? '').trim();
    if (d === 'do_poprawy' && !c) { setErr(new Error('Napisz, co instytucja ma poprawić.')); return; }
    try {
      await decideSubmission(z.id, d, c || undefined);
      setInfo(d === 'zatwierdz' ? `„${z.nazwa_obiektu}” zatwierdzone – trafiło do „Moje AED” instytucji ${z.organizacja}, która je opublikuje.`
        : `„${z.nazwa_obiektu}” odesłane do poprawy.`);
      st.reload();
    } catch (ex) { setErr(ex as Error); }
  }
  return (
    <section className="admin-section" aria-labelledby="h-zgl-aed">
      <h2 id="h-zgl-aed">Zgłoszenia AED do zatwierdzenia</h2>
      <p>Sprawdzasz zgłoszenie <strong>formalnie</strong>: czy jest kompletne, czy zdjęcie pokazuje AED i czy pinezka zgadza się z adresem. Nie zmieniasz danych – zatwierdzasz albo odsyłasz do poprawy z komentarzem. Za dane i ich publikację odpowiada instytucja.</p>
      <div className="field">
        <label htmlFor="zgl-status">Pokaż</label>
        <select id="zgl-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="oczekuje">czekające na decyzję</option><option value="do_poprawy">odesłane do poprawy</option>
          <option value="zatwierdzone">zatwierdzone</option><option value="wszystkie">wszystkie</option>
        </select>
      </div>
      {info && <p className="callout callout--ok" role="status">{info}</p>}
      {err && <ErrorBox error={err} />}
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (st.data.length === 0 ? <p>Brak zgłoszeń w tym widoku.</p> : (
        <ul className="submission-list">
          {st.data.map((z) => (
            <li key={z.id} className="panel submission">
              {z.zdjecie_url && <a href={apiUrl(z.zdjecie_url)} target="_blank" rel="noopener noreferrer" className="submission__photo">
                <img src={apiUrl(z.zdjecie_url)} alt={`Zdjęcie AED: ${z.nazwa_obiektu}`} /><span className="visually-hidden"> (otwiera się w nowym oknie)</span></a>}
              <div>
                <h3>{z.nazwa_obiektu}</h3>
                <p className="hint">Zgłosiła: <strong>{z.organizacja}</strong> (login <code>{z.nadawca_login}</code>), {when(z.utworzono)}</p>
                <dl className="submission__facts">
                  <dt>Adres</dt><dd>{[z.ulica, z.numer_budynku].filter(Boolean).join(' ')}, {z.kod_pocztowy} {z.miejscowosc} (TERYT {z.teryt_terc})</dd>
                  <dt>Położenie</dt><dd><ExternalLink href={`https://www.openstreetmap.org/?mlat=${z.szerokosc}&mlon=${z.dlugosc}#map=19/${z.szerokosc}/${z.dlugosc}`}>{z.szerokosc.toFixed(5)}, {z.dlugosc.toFixed(5)}</ExternalLink></dd>
                  <dt>Gdzie</dt><dd>{z.opis_lokalizacji} ({z.wewnatrz_budynku ? 'w budynku' : 'na zewnątrz'})</dd>
                  <dt>Dostęp</dt><dd>{DOSTEP[z.dostep]}, {z.dostepny_24h ? 'całą dobę' : z.godziny}</dd>
                  <dt>Szafka</dt><dd>{z.szafka_zamknieta ? `zamknięta – ${z.instrukcja_dostepu}` : 'otwarta'}</dd>
                  {z.kto && <><dt>Decyzja</dt><dd>{z.decyzja === 'zatwierdz' ? 'zatwierdzone' : 'do poprawy'}{z.komentarz ? ` – ${z.komentarz}` : ''} ({z.kto}, {when(z.kiedy)})</dd></>}
                  {z.historia.length > 0 && <><dt>Wcześniej</dt><dd>{z.historia.map((h, i) => <div key={i}>do poprawy: {h.komentarz} ({h.kto}, {when(h.kiedy)})</div>)}</dd></>}
                </dl>
                <MapView items={[]} picked={{ lat: z.szerokosc, lon: z.dlugosc }} height={200} cluster={false} wheelZoom={false}
                  label={`Mini-mapa: położenie zgłoszonego AED „${z.nazwa_obiektu}”`} />
                {z.status === 'oczekuje' && (
                  <div className="submission__decide">
                    <label htmlFor={`kom-${z.id}`}>Komentarz dla instytucji (wymagany przy odesłaniu do poprawy)</label>
                    <textarea id={`kom-${z.id}`} rows={2} maxLength={500} value={comment[z.id] ?? ''} onChange={(e) => setComment({ ...comment, [z.id]: e.target.value })} />
                    <p className="form-actions">
                      <button type="button" className="btn btn--primary" onClick={() => decide(z, 'zatwierdz')}>Zatwierdź<span className="visually-hidden"> {z.nazwa_obiektu}</span></button>
                      <button type="button" className="btn btn--secondary" onClick={() => decide(z, 'do_poprawy')}>Odeślij do poprawy<span className="visually-hidden"> {z.nazwa_obiektu}</span></button>
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
