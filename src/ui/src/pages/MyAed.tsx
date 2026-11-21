// "Moje AED" – the provider's wizard (docs/MODEL_ROL.md P2–P4): working copy, files for publication, reports, notifications.
// The app never publishes: the provider downloads the files and publishes them on ITS OWN dane.gov.pl account (K11).
import { useState, type FormEvent } from 'react';
import {
  deleteMyAed, downloadPackage, HttpError, loadPublished, myAed, myNotifications, patchMyAed, type AedRoboczy,
} from '../api/client';
import { RequireLogin, useSession } from '../components/Auth';
import { ReportsQueue } from '../components/ReportsQueue';
import { ErrorBox, ExternalLink, Icon, Loading } from '../components/ui';
import { address, date } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';
import { PasswordForm } from './Admin';
import { Badge } from './Providers';

const FREQ: Record<string, string> = {
  daily: 'codziennie', weekly: 'co tydzień', monthly: 'co miesiąc (zalecane)', quarterly: 'co kwartał', everyHalfYear: 'co pół roku', yearly: 'raz w roku',
};
const POW: Record<string, string> = { zgloszenie: 'Zgłoszenie', potwierdzenie: 'Potwierdzenie mieszkańca', duplikat: 'Możliwy duplikat', walidacja: 'Raport walidacji', przypomnienie: 'Przypomnienie' };

export function MyAed() {
  usePageTitle('Moje AED');
  return (
    <>
      <h1 id="page-title">Moje AED</h1>
      <p className="lead">Tu przygotowujesz dane o defibrylatorach swojej instytucji. Publikujesz je sam, na koncie instytucji w dane.gov.pl – dzięki temu wiadomo, kto odpowiada za dane.</p>
      <RequireLogin role="dysponent">
        <Workspace />
      </RequireLogin>
    </>
  );
}

function Workspace() {
  const s = useSession();
  const st = useAsync(() => myAed(), []);
  const pw = useAsync(() => myNotifications(), []);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState<Error | null>(null);
  const items = st.data?.data ?? [];
  const m = st.data?.meta;
  const bad = items.filter((a) => !a.meta.zgodny_ze_wzorcem);

  async function act(f: () => Promise<unknown>, ok: string) {
    setErr(null); setMsg('');
    try { await f(); setMsg(ok); st.reload(); } catch (e) { setErr(e as Error); }
  }
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {m && (
        <ul className="stats" aria-label="Stan danych instytucji">
          <li className="stat stat--ok"><span className="stat__n">{m.na_wspolnej_liscie}</span> AED na wspólnej liście</li>
          <li className="stat"><span className="stat__n">{m.w_kopii_roboczej}</span> AED w kopii roboczej</li>
          {bad.length > 0 && <li className="stat stat--warn"><span className="stat__n">{bad.length}</span> do poprawy przed pobraniem plików</li>}
        </ul>
      )}
      {m?.raport_agregacji.map((z) => (
        <div key={z.zbior_id} className={`callout ${z.status === 'wlaczony' && !z.odrzucone && !z.nieaktualny ? 'callout--ok' : 'callout--warn'}`}>
          <p className="callout__title">Twój zbiór w dane.gov.pl: „{z.tytul}”</p>
          <p>Przy ostatniej agregacji ({date(m.agregacja_z ?? '')}) na listę trafiło {z.wlaczone} z {z.rekordy ?? 0} AED.
            {z.nieaktualny && <> <strong>Zbiór jest po terminie aktualizacji</strong> ({FREQ[z.czestotliwosc ?? ''] ?? z.czestotliwosc}, ostatnia zmiana {z.zmodyfikowany}) – na mapie widać go jako nieaktualny.</>}</p>
          {z.problemy.length > 0 && <ul>{z.problemy.map((p) => <li key={p}>{p}</li>)}</ul>}
          {z.problemy_rekordow.length > 0 && (
            <details className="details"><summary>{z.odrzucone} AED nie trafiło na mapę – dlaczego</summary>
              <ul>{z.problemy_rekordow.map((p) => <li key={p.wiersz}>Wiersz {p.wiersz} ({p.id_aed ?? 'bez id'}): {p.problemy.join('; ')}</li>)}</ul>
            </details>
          )}
          {z.zbior_url && <p><ExternalLink href={z.zbior_url}>Zbiór w dane.gov.pl</ExternalLink></p>}
        </div>
      ))}

      <section className="admin-section" aria-labelledby="h-work">
        <h2 id="h-work">1. Urządzenia (kopia robocza)</h2>
        <p>Zmiany tutaj nie zmieniają mapy od razu. Mapa pokazuje to, co opublikowałeś w dane.gov.pl.</p>
        <p className="form-actions">
          <Link className="btn btn--primary" to="/dysponenci">Dodaj AED albo wgraj plik</Link>
          {m && m.na_wspolnej_liscie > 0 && (
            <button type="button" className="btn btn--secondary" onClick={() => act(async () => { const r = await loadPublished(); return r; }, 'Wczytaliśmy Twoje opublikowane AED do kopii roboczej.')}>
              Wczytaj AED z opublikowanego zbioru
            </button>
          )}
        </p>
        <p role="status" className="status-line">{msg}</p>
        {err && <ErrorBox error={err} />}
        {st.data && (items.length === 0 ? <p>Kopia robocza jest pusta.</p> : (
          <ul className="aed-list">
            {items.map((a) => <WorkItem key={a.id} a={a} today={today}
              onDelete={() => act(() => deleteMyAed(a.id), `Usunięto ${a.attributes.nazwa_obiektu} z kopii roboczej.`)}
              onVerified={() => act(() => patchMyAed(a.id, { data_weryfikacji: today, metoda_weryfikacji: 'wizja_lokalna' }), `Zapisano weryfikację na miejscu: ${a.attributes.nazwa_obiektu}.`)} />)}
          </ul>
        ))}
      </section>

      <section className="admin-section" aria-labelledby="h-files">
        <h2 id="h-files">2. Pobierz pliki do publikacji</h2>
        <PackageForm disabled={!items.length || bad.length > 0} email={s?.login} />
      </section>

      <section className="admin-section" aria-labelledby="h-rep">
        <h2 id="h-rep">3. Zgłoszenia mieszkańców o moich AED</h2>
        <ReportsQueue mode="dostawca" />
      </section>

      <section className="admin-section" aria-labelledby="h-not">
        <h2 id="h-not">4. Powiadomienia</h2>
        {pw.data && (pw.data.length === 0 ? <p>Brak powiadomień.</p> : (
          <ul className="notif-list">
            {pw.data.slice(0, 30).map((n) => <li key={n.id}><strong>{POW[n.typ] ?? n.typ}</strong> · <span className="hint">{date(n.czas)}</span><br />{n.tresc}</li>)}
          </ul>
        ))}
      </section>

      {m && m.na_wspolnej_liscie > 0 && s?.dysponent_nazwa && <Badge owner={s.dysponent_nazwa} />}
      <section className="admin-section"><PasswordForm /></section>
    </>
  );
}

function WorkItem({ a, today, onDelete, onVerified }: { a: AedRoboczy; today: string; onDelete: () => void; onVerified: () => void }) {
  const x = a.attributes;
  return (
    <li className="aed-item">
      <h3 className="aed-item__title">{x.nazwa_obiektu}</h3>
      <div className="aed-item__badges">
        {a.meta.zgodny_ze_wzorcem
          ? <span className="badge badge--ok"><Icon name="check" />Zgodne ze wzorem</span>
          : <span className="badge badge--warn"><Icon name="x" />Do poprawy</span>}
        {a.meta.na_liscie && <span className="badge badge--info">Na wspólnej liście</span>}
      </div>
      <p className="aed-item__addr">{address(x)}</p>
      <p className="hint">Sprawdzone na miejscu: {x.data_weryfikacji ? date(x.data_weryfikacji) : 'brak daty'} · kod gminy (TERYT): {x.teryt_terc ?? '—'}</p>
      {!a.meta.zgodny_ze_wzorcem && <ul className="field-error">{a.meta.problemy.map((p) => <li key={p}>{p}</li>)}</ul>}
      <p className="aed-item__actions">
        {x.data_weryfikacji !== today && <button type="button" className="btn btn--secondary btn--small" onClick={onVerified}>Sprawdziłem dziś na miejscu<span className="visually-hidden">: {x.nazwa_obiektu}</span></button>}
        <button type="button" className="btn btn--tertiary" onClick={() => { if (window.confirm(`Usunąć „${x.nazwa_obiektu}” z kopii roboczej (np. urządzenie wycofane)?`)) onDelete(); }}>Usuń<span className="visually-hidden"> {x.nazwa_obiektu}</span></button>
      </p>
    </li>
  );
}

function PackageForm({ disabled, email }: { disabled: boolean; email?: string }) {
  const [f, setF] = useState({ czestotliwosc: 'monthly', licencja: 'CC0-1.0', csv_url: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [err, setErr] = useState('');
  async function go(e: FormEvent) {
    e.preventDefault(); setErr(''); setDone('');
    if (f.csv_url && !f.csv_url.startsWith('https://')) { setErr('Adres pliku musi zaczynać się od https://'); return; }
    setBusy(true);
    try {
      const { blob, name } = await downloadPackage({ czestotliwosc: f.czestotliwosc, licencja: f.licencja, ...(f.csv_url ? { csv_url: f.csv_url } : {}), ...(f.email ? { email: f.email } : {}) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDone(name);
    } catch (ex) { setErr(ex instanceof HttpError ? `${ex.message}${Object.values(ex.fields).length ? ` (${Object.values(ex.fields).join('; ')})` : ''}` : (ex as Error).message); }
    finally { setBusy(false); }
  }
  void email;
  return (
    <form onSubmit={go} noValidate aria-describedby="pkg-hint">
      <p id="pkg-hint">Dostaniesz plik ZIP: dane (CSV według wzoru), plik dla portalu (XML), słownik pól, opis zbioru i instrukcję. Publikujesz go na koncie swojej instytucji w dane.gov.pl.</p>
      <div className="field">
        <label htmlFor="pkg-freq">Jak często będziecie aktualizować dane?</label>
        <select id="pkg-freq" value={f.czestotliwosc} onChange={(e) => setF({ ...f, czestotliwosc: e.target.value })}>
          {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <fieldset>
        <legend>Na jakich zasadach udostępniacie dane?</legend>
        <div className="big-choices">
          <label htmlFor="pkg-cc0"><input id="pkg-cc0" type="radio" name="pkg-lic" checked={f.licencja === 'CC0-1.0'} onChange={() => setF({ ...f, licencja: 'CC0-1.0' })} /> Każdy może korzystać bez ograniczeń (zalecane)</label>
          <label htmlFor="pkg-by"><input id="pkg-by" type="radio" name="pkg-lic" checked={f.licencja === 'CC-BY-4.0'} onChange={() => setF({ ...f, licencja: 'CC-BY-4.0' })} /> Każdy może korzystać, jeśli poda naszą instytucję jako źródło</label>
        </div>
      </fieldset>
      <details className="details">
        <summary>Dla specjalistów: adres pliku i kontakt</summary>
        <div className="field">
          <label htmlFor="pkg-url">Adres https, pod którym opublikujecie plik CSV (jeśli portal ma pobierać go sam)</label>
          <input id="pkg-url" type="url" inputMode="url" placeholder="https://twoja-instytucja.pl/dane/aed.csv" value={f.csv_url} onChange={(e) => setF({ ...f, csv_url: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="pkg-mail">Służbowy e-mail do zgłaszania błędów (bez danych osobowych pracowników)</label>
          <input id="pkg-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
      </details>
      {err && <p className="field-error" role="alert">{err}</p>}
      {disabled && <p className="hint">Najpierw dodaj AED i popraw te oznaczone „Do poprawy”.</p>}
      <p className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy || disabled}><Icon name="download" />{busy ? 'Przygotowuję…' : 'Pobierz pliki do publikacji'}</button>
      </p>
      {done && (
        <div className="callout callout--ok" role="status">
          <p className="callout__title">Pobrano „{done}”. Co dalej:</p>
          <ol>
            <li>Zaloguj się na konto swojej instytucji w <ExternalLink href="https://dane.gov.pl">dane.gov.pl</ExternalLink> (jeśli go nie ma – załóż je według procedury portalu).</li>
            <li>Dodaj zbiór i wgraj plik CSV z paczki (słowo kluczowe <code>wspolna-lista-aed</code>, opis z pliku <code>metadane.json</code>) – albo podaj portalowi adres pliku XML.</li>
            <li>Po publikacji Twoje AED pojawią się na wspólnej liście przy najbliższej aktualizacji (raz na dobę). Za dane odpowiada Twoja instytucja.</li>
          </ol>
        </div>
      )}
    </form>
  );
}
