// "Zgłoszenia AED" (/zgloszenia-aed) – the only extra page of an institution, and the approval page of the administrator.
// Institution: its AED (report a change / new photo), its submissions (fix the ones sent back), "Zgłoś nowe AED",
// residents' reports about its AED and reminders. Administrator: account requests, submissions to approve (also its own),
// its own submissions and "Zgłoś nowe AED" (with the institution to assign it to). Every submission is approved by the
// administrator and is on the map at once (HANDOFF A #12).
import { useState } from 'react';
import {
  listAccounts, myDevices, myNotifications, mySubmissions, type MojeUrzadzenie, type ZgloszenieAed,
} from '../api/client';
import type { AedView } from '../api/types';
import { AccountRequests, AedSubmissionsQueue } from '../components/AdminQueues';
import { AedForm, draftFromAed, draftFromSubmission } from '../components/AedForm';
import { LoginPage, SessionBar, useSession } from '../components/Auth';
import { ReportsQueue } from '../components/ReportsQueue';
import { ErrorBox, Icon, Loading } from '../components/ui';
import { address } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';

const STATUS: Record<ZgloszenieAed['status'], string> = { oczekuje: 'czeka na zatwierdzenie', zatwierdzone: 'zatwierdzone', do_poprawy: 'do poprawy', odrzucone: 'odrzucone' };
const BADGE: Record<ZgloszenieAed['status'], string> = { oczekuje: 'badge--info', zatwierdzone: 'badge--ok', do_poprawy: 'badge--stale', odrzucone: 'badge--no' };
const when = (t: string | null | undefined) => (t ? t.replace('T', ', ') : '—');

type Editing =
  | { kind: 'nowe' }
  | { kind: 'zmiana'; dev: MojeUrzadzenie & { aed: AedView } }
  | { kind: 'poprawka'; z: ZgloszenieAed };

export function Zgloszenia() {
  usePageTitle('Zgłoszenia AED');
  const s = useSession();
  if (!s) return <LoginPage />;
  return s.rola === 'administrator' ? <AdminZgloszenia /> : <InstitutionZgloszenia />;
}

function scrollToForm() {
  setTimeout(() => document.getElementById('za-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
}

function Done({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="callout callout--ok" role="status"><p className="callout__title"><Icon name="check" />{msg}</p></div>;
}

function SubmissionsTable({ rows, onFix, empty }: { rows: ZgloszenieAed[]; onFix: (z: ZgloszenieAed) => void; empty: string }) {
  if (!rows.length) return <p>{empty}</p>;
  return (
    <table className="admin-table">
      <thead><tr><th scope="col">AED</th><th scope="col">Rodzaj</th><th scope="col">Wysłane</th><th scope="col">Stan</th><th scope="col">Decyzja administratora</th><th scope="col">Działania</th></tr></thead>
      <tbody>
        {rows.map((z) => (
          <tr key={z.id}>
            <td>{z.nazwa_obiektu}<div className="hint">{[z.ulica, z.numer_budynku].filter(Boolean).join(' ')}, {z.miejscowosc}</div></td>
            <td>{z.typ === 'zmiana' ? 'zmiana danych' : 'nowe AED'}</td>
            <td>{when(z.utworzono)}<div className="hint">{z.nadawca_login}</div></td>
            <td><span className={`badge ${BADGE[z.status]}`}>{STATUS[z.status]}</span></td>
            <td>{z.kto ? <>{z.komentarz ?? '—'}<div className="hint">{z.kto}, {when(z.kiedy)}</div></> : '—'}</td>
            <td>
              {z.status === 'do_poprawy' && <button type="button" className="btn btn--secondary btn--small" onClick={() => onFix(z)}>Popraw<span className="visually-hidden"> {z.nazwa_obiektu}</span></button>}
              {z.status === 'zatwierdzone' && z.id_aed && <Link to={`/aed/${z.id_aed}`}>Zobacz na mapie</Link>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FormFor({ editing, organizations, onDone, onCancel }: { editing: Editing; organizations?: string[]; onDone: (m: string) => void; onCancel: () => void }) {
  if (editing.kind === 'nowe') return <AedForm key="nowe" mode="nowe" title="Zgłoś nowe AED" organizations={organizations} onDone={onDone} onCancel={onCancel} />;
  if (editing.kind === 'zmiana') {
    const a = editing.dev.aed;
    return <AedForm key={`z-${a.id_aed}`} mode="zmiana" idAed={a.id_aed} initial={draftFromAed(a)} hasPhoto={!!a.zdjecie_url}
      title={`Zgłoś zmianę: ${a.nazwa_obiektu}`} onDone={onDone} onCancel={onCancel} />;
  }
  const z = editing.z;
  return <AedForm key={`p-${z.id}`} mode="poprawka" submissionId={z.id} idAed={z.id_aed} initial={draftFromSubmission(z)} hasPhoto
    title={`Popraw zgłoszenie: ${z.nazwa_obiektu}`} comment={z.komentarz} onDone={onDone} onCancel={onCancel} />;
}

// ---------- institution ----------
function InstitutionZgloszenia() {
  const devices = useAsync(() => myDevices(), []);
  const subs = useAsync(() => mySubmissions(), []);
  const notes = useAsync(() => myNotifications(), []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [done, setDone] = useState('');
  const open = (e: Editing) => { setEditing(e); setDone(''); scrollToForm(); };
  const finished = (m: string) => { setEditing(null); setDone(m); subs.reload(); devices.reload(); };

  return (
    <>
      <h1 id="page-title">Zgłoszenia AED</h1>
      <SessionBar />
      <p className="lead">Tu zgłaszasz defibrylatory, za które odpowiada Twoja instytucja, i poprawiasz ich dane. Każde zgłoszenie sprawdza administrator (kompletność, zdjęcie, położenie). Po zatwierdzeniu dane są od razu na mapie.</p>
      <Done msg={done} />

      <section className="admin-section" aria-labelledby="h-dev">
        <h2 id="h-dev">Twoje AED</h2>
        {devices.loading && !devices.data && <Loading />}
        {devices.error && <ErrorBox error={devices.error} onRetry={devices.reload} />}
        {devices.data && (devices.data.length === 0
          ? <p className="empty-note">Nie masz jeszcze żadnych zgłoszonych AED. Użyj przycisku „Zgłoś nowe AED” poniżej.</p>
          : (
            <ul className="device-list">
              {devices.data.map((d) => (
                <li key={d.id} className="device">
                  <div>
                    <p className="device__name"><Link to={`/aed/${d.id}`}>{d.aed.nazwa_obiektu || 'AED bez nazwy'}</Link></p>
                    <p className="hint">{address(d.aed)}{d.aed.data_weryfikacji ? ` · sprawdzone ${d.aed.data_weryfikacji}` : ' · brak daty sprawdzenia'}</p>
                    {d.zgloszenie && <p><span className={`badge ${BADGE[d.zgloszenie.status]}`}>Zmiana {STATUS[d.zgloszenie.status]}</span>{d.zgloszenie.komentarz ? ` ${d.zgloszenie.komentarz}` : ''}</p>}
                  </div>
                  <div className="device__actions">
                    <button type="button" className="btn btn--secondary btn--small" disabled={d.zgloszenie?.status === 'oczekuje'}
                      onClick={() => open({ kind: 'zmiana', dev: d })}>Zgłoś zmianę lub nowe zdjęcie<span className="visually-hidden"> – {d.aed.nazwa_obiektu}</span></button>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <section className="admin-section" aria-labelledby="h-subs">
        <h2 id="h-subs">Twoje zgłoszenia</h2>
        {subs.loading && !subs.data && <Loading />}
        {subs.error && <ErrorBox error={subs.error} onRetry={subs.reload} />}
        {subs.data && <SubmissionsTable rows={subs.data} onFix={(z) => open({ kind: 'poprawka', z })} empty="Nie wysłano jeszcze żadnych zgłoszeń." />}
      </section>

      <section className="admin-section" aria-labelledby="h-new">
        <h2 id="h-new" className="visually-hidden">Nowe zgłoszenie</h2>
        {editing ? <FormFor editing={editing} onDone={finished} onCancel={() => setEditing(null)} />
          : <p><button type="button" className="btn btn--primary btn--big" onClick={() => open({ kind: 'nowe' })}><Icon name="pin" />Zgłoś nowe AED</button></p>}
      </section>

      <section className="admin-section" aria-labelledby="h-res">
        <h2 id="h-res">Zgłoszenia mieszkańców</h2>
        <p>Mieszkańcy zgłaszają problemy z Twoimi AED (np. „nie ma go na miejscu”, „szafka zamknięta”). Zgłoszenie nie zmienia danych – jeśli coś trzeba poprawić, zgłoś zmianę AED powyżej.</p>
        <ReportsQueue mode="dostawca" />
      </section>

      <section className="admin-section" aria-labelledby="h-notes">
        <h2 id="h-notes">Przypomnienia i powiadomienia</h2>
        {notes.loading && !notes.data && <Loading />}
        {notes.error && <ErrorBox error={notes.error} onRetry={notes.reload} />}
        {notes.data && (notes.data.length === 0 ? <p>Brak przypomnień – wszystkie Twoje AED mają aktualne dane.</p> : (
          <ul className="notes">
            {notes.data.slice(0, 30).map((n) => (
              <li key={n.id} className={`note note--${n.typ}`}>
                <span className="note__type">{n.typ === 'przypomnienie' ? 'Przypomnienie' : n.typ === 'zgloszenie_aed' ? 'Decyzja' : n.typ === 'zgloszenie' ? 'Zgłoszenie mieszkańca' : 'Informacja'}</span>
                <span>{n.tresc}</span>
                <span className="hint">{n.czas.replace('T', ', ')}</span>
              </li>
            ))}
          </ul>
        ))}
      </section>
    </>
  );
}

// ---------- administrator ----------
function AdminZgloszenia() {
  const subs = useAsync(() => mySubmissions(), []);
  const orgs = useAsync(() => listAccounts().then((a) => [...new Set(a.filter((k) => k.rola === 'dysponent' && k.aktywne && k.dysponent_nazwa).map((k) => k.dysponent_nazwa!))].sort()), []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [done, setDone] = useState('');
  const [queueKey, setQueueKey] = useState(0);
  const finished = (m: string) => { setEditing(null); setDone(m); subs.reload(); setQueueKey((k) => k + 1); };
  return (
    <>
      <h1 id="page-title">Zgłoszenia AED</h1>
      <SessionBar />
      <p className="lead">Tu zatwierdzasz nowe AED i zmiany danych zgłoszone przez instytucje (i przez Ciebie) oraz wnioski instytucji o konto. Zatwierdzone dane są od razu na mapie. Dane AED możesz też zmienić bezpośrednio w <Link to="/panel">panelu administratora</Link>.</p>
      <Done msg={done} />
      <AedSubmissionsQueue key={queueKey} />
      <AccountRequests />
      <section className="admin-section" aria-labelledby="h-mine">
        <h2 id="h-mine">Twoje zgłoszenia</h2>
        {subs.data && <SubmissionsTable rows={subs.data} onFix={(z) => { setEditing({ kind: 'poprawka', z }); scrollToForm(); }} empty="Nie wysłano jeszcze żadnych zgłoszeń." />}
        {subs.error && <ErrorBox error={subs.error} onRetry={subs.reload} />}
      </section>
      <section className="admin-section" aria-labelledby="h-new">
        <h2 id="h-new" className="visually-hidden">Nowe zgłoszenie</h2>
        {editing ? <FormFor editing={editing} organizations={orgs.data ?? []} onDone={finished} onCancel={() => setEditing(null)} />
          : <p><button type="button" className="btn btn--primary btn--big" onClick={() => { setEditing({ kind: 'nowe' }); setDone(''); scrollToForm(); }}><Icon name="pin" />Zgłoś nowe AED</button></p>}
      </section>
    </>
  );
}
