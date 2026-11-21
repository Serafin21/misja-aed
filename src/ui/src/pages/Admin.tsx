// Panel administratora (/panel) – docs/MODEL_ROL.md §4: the administrator manages the SYSTEM, not the data:
// aggregation of providers' datasets, gaps (where to send the campaign), reports without a provider, reminders,
// provider accounts and the event log. There is no way to add, edit or delete AED here (K2).
import { useEffect, useState, type FormEvent } from 'react';
import {
  aggregationReport, changeMyPassword, createAccount, eventLog, lateDatasets, listAccounts, listGaps, refreshNow, refreshStatus,
  resetPassword, runAggregation, sendReminders, setAccountActive, type Konto, type RaportZbioru, type StanOdswiezania,
} from '../api/client';
import { RequireLogin } from '../components/Auth';
import { ReportsQueue } from '../components/ReportsQueue';
import { AccountRequests, AedSubmissionsQueue } from '../components/AdminQueues';
import { ErrorBox, ExternalLink, Loading } from '../components/ui';
import { dictValues } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';
import type { PodstawaPublikacji } from '../api/types';

const n = (x: number | undefined) => (x ?? 0).toLocaleString('pl-PL');
const when = (t: string | null | undefined) => (t ? t.replace('T', ', ') : '—');

export function Admin() {
  usePageTitle('Panel administratora');
  return (
    <>
      <h1 id="page-title">Panel administratora</h1>
      <p className="lead">Administrator prowadzi konta dostawców, wzór danych, łączenie zbiorów i akcję promocyjną. <strong>Nie dodaje, nie poprawia i nie usuwa danych o AED</strong> – za nie odpowiadają ich właściciele.</p>
      <RequireLogin role="administrator">
        <nav aria-label="Sekcje panelu" className="toc">
          <ul>
            <li><a href="#h-zgl-aed">Zgłoszenia AED</a></li><li><a href="#h-req">Wnioski o konto</a></li>
            <li><a href="#h-agg">Wspólna lista</a></li><li><a href="#h-gaps">Luki</a></li><li><a href="#h-rep">Zgłoszenia bez dostawcy</a></li>
            <li><a href="#h-late">Przypomnienia</a></li><li><a href="#h-acc">Konta dostawców</a></li><li><a href="#h-log">Dziennik zdarzeń</a></li>
            <li><a href="#h-refresh">Odświeżanie</a></li>
          </ul>
        </nav>
        <AedSubmissionsQueue />
        <AccountRequests />
        <Aggregation />
        <Gaps />
        <section className="admin-section" aria-labelledby="h-rep">
          <h2 id="h-rep">Zgłoszenia urządzeń bez dostawcy</h2>
          <p>Mieszkańcy zgłaszają AED spoza wspólnej listy (także punkty „do sprawdzenia” z OpenStreetMap). Administrator nie publikuje ich – zaprasza właściciela do publikacji danych.</p>
          <ReportsQueue mode="administrator" />
        </section>
        <Late />
        <Accounts />
        <Log />
        <Refresh />
      </RequireLogin>
    </>
  );
}

/** Top menu "Zgłoszenia AED" (administrator): approvals only – AED reported by institutions and account requests. */
export function Approvals() {
  usePageTitle('Zgłoszenia AED do zatwierdzenia');
  return (
    <>
      <h1 id="page-title">Zgłoszenia AED do zatwierdzenia</h1>
      <p className="lead">Tu zatwierdzasz AED zgłoszone przez instytucje i wnioski instytucji o konto. Pozostałe narzędzia są w <Link to="/panel">panelu administratora</Link>.</p>
      <RequireLogin role="administrator">
        <AedSubmissionsQueue />
        <AccountRequests />
      </RequireLogin>
    </>
  );
}

const STATUS: Record<RaportZbioru['status'], string> = {
  wlaczony: 'na liście', przejsciowy: 'na liście – zbiór przejściowy (sprzed wzoru)', odrzucony: 'odrzucony – niezgodny ze wzorem', poza_lista: 'poza listą (nie według wzoru)', blad: 'błąd pobrania',
};

// ---------- aggregation (P5) ----------
function Aggregation() {
  const st = useAsync(() => aggregationReport(), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  async function run() {
    setBusy(true); setErr(null);
    try { await runAggregation(); st.reload(); } catch (e) { setErr(e as Error); } finally { setBusy(false); }
  }
  const z = st.data?.zbiory ?? [];
  return (
    <section className="admin-section" aria-labelledby="h-agg">
      <h2 id="h-agg">Wspólna lista – łączenie zbiorów dostawców</h2>
      <p>Lista powstaje wyłącznie ze zbiorów, które dostawcy opublikowali w dane.gov.pl ze słowem kluczowym <code>wspolna-lista-aed</code>. Rekord niezgodny ze wzorem nie trafia na mapę, a dostawca dostaje raport. Rekordów różnych dostawców nie łączymy.</p>
      <p className="form-actions"><button type="button" className="btn btn--primary" onClick={run} disabled={busy}>{busy ? 'Łączę…' : 'Połącz zbiory teraz'}</button>
        <span className="hint"> Ostatnio: {when(st.data?.czas)}. Automatycznie co noc.</span></p>
      {err && <ErrorBox error={err} />}
      {st.loading && !st.data && <Loading />}
      {z.length > 0 && (
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="h-agg">
          <table className="admin-table">
            <thead><tr><th scope="col">Zbiór</th><th scope="col">Dostawca</th><th scope="col">Stan</th><th scope="col">Na liście / odrzucone</th><th scope="col">Uwagi</th></tr></thead>
            <tbody>
              {z.map((x) => (
                <tr key={x.zbior_id}>
                  <td>{x.zbior_url ? <ExternalLink href={x.zbior_url}>{x.tytul}</ExternalLink> : x.tytul}{x.fikcyjny && <div className="hint">dostawca fikcyjny (prototyp)</div>}</td>
                  <td>{x.dostawca ?? '—'}</td>
                  <td>{STATUS[x.status]}{x.nieaktualny && <div><strong>zbiór nieaktualny</strong></div>}</td>
                  <td>{x.rekordy == null ? '—' : `${x.wlaczone} / ${x.odrzucone}`}</td>
                  <td>
                    {x.problemy.map((p) => <div key={p}>{p}</div>)}
                    {x.problemy_rekordow.length > 0 && (
                      <details><summary>{x.problemy_rekordow.length} rekordów odrzuconych</summary>
                        <ul>{x.problemy_rekordow.map((r) => <li key={r.wiersz}>wiersz {r.wiersz}: {r.problemy.join('; ')}</li>)}</ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- gaps: where to send the campaign (§8, §10) ----------
function Gaps() {
  const [woj, setWoj] = useState('');
  const st = useAsync(() => listGaps(woj || undefined), [woj]);
  return (
    <section className="admin-section" aria-labelledby="h-gaps">
      <h2 id="h-gaps">Luki – gminy bez żadnego dostawcy</h2>
      <p>Na górze gminy, w których OpenStreetMap pokazuje najwięcej punktów „do sprawdzenia” – tam akcja „AED w danych” trafia najpierw.</p>
      <div className="field">
        <label htmlFor="gap-woj">Województwo</label>
        <select id="gap-woj" value={woj} onChange={(e) => setWoj(e.target.value)}>
          <option value="">cała Polska</option>
          {dictValues('wojewodztwo').map((w) => <option key={w.wartosc} value={w.wartosc}>{w.wartosc}</option>)}
        </select>
      </div>
      {st.data && <p role="status">Luk: <strong>{n(st.data.meta.luki)}</strong>{st.data.meta.gminy ? ` z ${n(st.data.meta.gminy)} gmin` : ''} · wysłanych zaproszeń: {st.data.meta.zaproszenia}.</p>}
      {st.data && (
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="h-gaps">
          <table className="admin-table">
            <thead><tr><th scope="col">Gmina</th><th scope="col">Województwo</th><th scope="col">Punkty do sprawdzenia (OSM)</th></tr></thead>
            <tbody>{st.data.data.slice(0, 30).map((g) => <tr key={g.teryt}><td>{g.gmina} <span className="hint">({g.rodzaj})</span></td><td>{g.wojewodztwo}</td><td>{n(g.do_sprawdzenia)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
    </section>
  );
}

// ---------- reminders (P9) ----------
function Late() {
  const st = useAsync(() => lateDatasets(), []);
  const [msg, setMsg] = useState('');
  return (
    <section className="admin-section" aria-labelledby="h-late">
      <h2 id="h-late">Przypomnienia o aktualizacji</h2>
      {st.data && (st.data.length === 0 ? <p>Wszystkie zbiory są aktualne.</p> : (
        <>
          <ul>{st.data.map((z) => <li key={z.zbior_id}><strong>{z.dostawca}</strong>: „{z.tytul}” – ostatnia zmiana {z.zmodyfikowany}, częstotliwość {z.czestotliwosc}</li>)}</ul>
          <p className="form-actions"><button type="button" className="btn btn--secondary" onClick={async () => { const r = await sendReminders(); setMsg(r.wyslano.length ? `Wysłano przypomnienia: ${r.wyslano.join(', ')}.` : 'Przypomnienia już wysłane dzisiaj.'); }}>Wyślij przypomnienia dostawcom</button></p>
        </>
      ))}
      <p role="status" className="status-line">{msg}</p>
    </section>
  );
}

// ---------- event log (K10) ----------
function Log() {
  const st = useAsync(() => eventLog(), []);
  return (
    <section className="admin-section" aria-labelledby="h-log">
      <h2 id="h-log">Dziennik zdarzeń</h2>
      <p>Kto, kiedy i co zmienił. Wpisów nie da się zmienić ani usunąć.</p>
      <p><button type="button" className="btn btn--tertiary" onClick={st.reload}>Odśwież dziennik</button></p>
      {st.data && (
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="h-log">
          <table className="admin-table">
            <thead><tr><th scope="col">Kiedy</th><th scope="col">Kto</th><th scope="col">Operacja</th><th scope="col">Obiekt</th></tr></thead>
            <tbody>{st.data.slice(0, 50).map((e) => <tr key={e.id}><td>{when(e.czas)}</td><td>{e.kto}{e.rola && e.rola !== e.kto ? <span className="hint"> ({e.rola})</span> : null}</td><td><code>{e.operacja}</code></td><td>{e.obiekt ?? '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- refresh: aggregation + OSM helper layer ----------
function Refresh() {
  const [st, setSt] = useState<StanOdswiezania | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => refreshStatus().then((s) => { setSt(s); setErr(null); return s; }, (e: Error) => { setErr(e); return null; });
  useEffect(() => { load(); }, []);
  // while running: check every 3 s
  useEffect(() => {
    if (!st?.w_toku) return;
    const t = setInterval(() => { load(); }, 3000);
    return () => clearInterval(t);
  }, [st?.w_toku]);

  async function run() {
    setMsg('');
    try { const r = await refreshNow(); setMsg(r.meta.komunikat); setSt(r.data); } catch (e) { setErr(e as Error); }
  }

  const w = st?.wynik;
  return (
    <section className="admin-section" aria-labelledby="h-refresh">
      <h2 id="h-refresh">Odświeżanie automatyczne</h2>
      <p>Łączenie zbiorów dostawców i warstwa pomocnicza z OpenStreetMap („do sprawdzenia”, tylko do mapy luk) odświeżają się same <strong>{st?.harmonogram ?? '…'}</strong>.</p>
      {err && <ErrorBox error={err} onRetry={load} />}
      {st && (
        <dl className="facts">
          <dt>Ostatnio</dt><dd>{when(st.ostatnie)}{st.powod ? ` (${st.powod})` : ''}</dd>
          <dt>Następne</dt><dd>{when(st.nastepne)}</dd>
          {w?.osm && 'dodane' in w.osm && <><dt>Warstwa pomocnicza OSM</dt><dd>{n(w.osm.liczba_obiektow as number)} obiektów: nowe {n(w.osm.dodane as number)}, zaktualizowane {n(w.osm.zaktualizowane as number)}, odrzucone {n(w.osm.odrzucone as number)} ({String(w.osm.zrodlo)})</dd></>}

          {w?.rekordy_po !== undefined && <><dt>AED w zbiorze</dt><dd>{n(w.rekordy_przed)} → {n(w.rekordy_po)}</dd></>}
          {st.blad && <><dt>Błąd</dt><dd>{st.blad}</dd></>}
        </dl>
      )}
      <p className="form-actions">
        <button type="button" className="btn btn--primary" onClick={run} disabled={!!st?.w_toku}>{st?.w_toku ? 'Odświeżam… (ok. 30 s)' : 'Odśwież teraz'}</button>
      </p>
      <p role="status" className="status-line">{st?.w_toku ? 'Odświeżanie trwa – możesz zostać na stronie albo wrócić później.' : msg}</p>
    </section>
  );
}

// ---------- provider accounts ----------
// CR-TL-6: the basis on which the provider may publish (shown on the AED card as meta.dostawca_podstawa)
const PODSTAWY: [PodstawaPublikacji, string, string][] = [
  ['wlasciciel', 'Właściciel AED', 'urządzenie należy do tej instytucji'],
  ['zarzadca', 'Zarządca z umową', 'zarządza urządzeniem na podstawie umowy z właścicielem'],
  ['weryfikujacy', 'Podmiot weryfikujący', 'np. fundacja, która sprawdziła AED na miejscu'],
];

function Accounts() {
  const st = useAsync(() => listAccounts(), []);
  const empty = { login: '', dysponent_nazwa: '', dostawca_podstawa: '' as PodstawaPublikacji | '', email: '' };
  const [form, setForm] = useState(empty);
  const [secret, setSecret] = useState<{ login: string; haslo: string; nowe: boolean } | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      if (!form.dostawca_podstawa) throw new Error('Wybierz podstawę publikacji.');
      const r = await createAccount({ login: form.login.trim().toLowerCase(), dysponent_nazwa: form.dysponent_nazwa.trim(), dostawca_podstawa: form.dostawca_podstawa, ...(form.email.trim() ? { email: form.email.trim() } : {}) });
      setSecret({ login: r.data.login, haslo: r.haslo_jednorazowe, nowe: true });
      setForm(empty);
      st.reload();
    } catch (ex) { setErr(ex as Error); } finally { setBusy(false); }
  }
  async function reset(k: Konto) {
    if (!window.confirm(`Wygenerować nowe hasło dla ${k.login}? Stare przestanie działać.`)) return;
    try { const r = await resetPassword(k.login); setSecret({ login: k.login, haslo: r.haslo_jednorazowe, nowe: false }); } catch (ex) { setErr(ex as Error); }
  }
  async function toggle(k: Konto) {
    try { await setAccountActive(k.login, !k.aktywne); st.reload(); } catch (ex) { setErr(ex as Error); }
  }

  return (
    <section className="admin-section" aria-labelledby="h-acc">
      <h2 id="h-acc">Konta dostawców</h2>
      <p>Konto zakładasz po sprawdzeniu, że osoba reprezentuje podmiot, który odpowiada za dane: właściciela AED, zarządcę z umową albo podmiot, który sprawdził AED na miejscu (np. pismo, umowa, e-mail z domeny instytucji). Dostawca przygotowuje i publikuje tylko dane, za które odpowiada, i rozpatruje zgłoszenia o swoich AED. Docelowo: konta portalu dane.gov.pl i logowanie przez login.gov.pl.</p>
      {secret && (
        <div className="callout callout--ok" role="alert">
          <p className="callout__title">{secret.nowe ? 'Konto założone.' : 'Nowe hasło gotowe.'} Przekaż instytucji login i hasło bezpiecznym kanałem.</p>
          <p>Login: <span className="secret">{secret.login}</span> · Hasło: <span className="secret">{secret.haslo}</span></p>
          <p className="hint">Hasło widać tylko teraz – później można je jedynie zresetować. Instytucja może je zmienić na stronie „Moje konto”.</p>
          <p><button type="button" className="btn btn--tertiary" onClick={() => setSecret(null)}>Ukryj hasło</button></p>
        </div>
      )}
      {err && <ErrorBox error={err} />}
      <form className="inline-form" onSubmit={create} aria-label="Nowe konto instytucji">
        <div className="field">
          <label htmlFor="acc-login">Login</label>
          <input id="acc-login" required pattern="[a-z0-9][a-z0-9._\-]{2,40}" title="3–41 znaków: małe litery, cyfry, kropka, _ i -" autoCapitalize="none" spellCheck={false}
            value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="np. um.krosno" />
        </div>
        <div className="field">
          <label htmlFor="acc-name">Nazwa instytucji (jak w danych AED)</label>
          <input id="acc-name" required minLength={3} value={form.dysponent_nazwa} onChange={(e) => setForm({ ...form, dysponent_nazwa: e.target.value })} placeholder="np. Urząd Miasta Krosna" />
        </div>
        <fieldset className="field field--full">
          <legend>Podstawa publikacji</legend>
          <div className="big-choices">
            {PODSTAWY.map(([v, l, h]) => (
              <label key={v}>
                <input type="radio" name="acc-podstawa" value={v} required checked={form.dostawca_podstawa === v}
                  onChange={() => setForm({ ...form, dostawca_podstawa: v })} />
                <span>{l}<span className="hint"> – {h}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="acc-mail">E-mail kontaktowy (nieobowiązkowy)</label>
          <input id="acc-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Zakładam…' : 'Załóż konto'}</button>
      </form>
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (st.data.length === 0 ? <p>Nie ma jeszcze kont dostawców (działają konta pokazowe <code>dysponent</code> i <code>administrator</code>).</p> : (
        <table className="admin-table">
          <thead><tr><th scope="col">Login</th><th scope="col">Instytucja</th><th scope="col">AED w zbiorze</th><th scope="col">Założone</th><th scope="col">Stan</th><th scope="col">Działania</th></tr></thead>
          <tbody>
            {st.data.map((k) => (
              <tr key={k.login}>
                <td><code>{k.login}</code></td>
                <td>{k.dysponent_nazwa}{k.email && <div className="hint">{k.email}</div>}</td>
                <td>{n(k.liczba_aed)}</td>
                <td>{when(k.utworzono)}{k.utworzyl && <div className="hint">przez {k.utworzyl}</div>}</td>
                <td>{k.aktywne ? 'aktywne' : 'zablokowane'}</td>
                <td>
                  <button type="button" className="btn btn--secondary btn--small" onClick={() => reset(k)}>Nowe hasło<span className="visually-hidden"> dla {k.login}</span></button>
                  <button type="button" className={`btn btn--small ${k.aktywne ? 'btn--danger' : 'btn--secondary'}`} onClick={() => toggle(k)}>{k.aktywne ? 'Zablokuj' : 'Odblokuj'}<span className="visually-hidden"> {k.login}</span></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}

// ---------- own password (used in "Moje AED") ----------
export function PasswordForm() {
  const [f, setF] = useState({ stare: '', nowe: '', nowe2: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(''); setErr('');
    if (f.nowe.length < 10) { setErr('Nowe hasło musi mieć co najmniej 10 znaków.'); return; }
    if (f.nowe !== f.nowe2) { setErr('Nowe hasła się różnią.'); return; }
    try { await changeMyPassword(f.stare, f.nowe); setMsg('Hasło zmienione.'); setF({ stare: '', nowe: '', nowe2: '' }); }
    catch (ex) { setErr((ex as Error).message); }
  }
  return (
    <form className="panel" onSubmit={save} aria-labelledby="h-pass" noValidate>
      <h2 id="h-pass">Zmień hasło</h2>
      <p className="hint">Konta pokazowe (<code>dysponent</code>, <code>administrator</code>) mają hasło w ustawieniach serwera i nie zmienia się go tutaj.</p>
      {[['stare', 'Obecne hasło', 'current-password'], ['nowe', 'Nowe hasło (min. 10 znaków)', 'new-password'], ['nowe2', 'Powtórz nowe hasło', 'new-password']].map(([k, l, ac]) => (
        <div className="field" key={k}>
          <label htmlFor={`pw-${k}`}>{l}</label>
          <input id={`pw-${k}`} type="password" autoComplete={ac} value={f[k as keyof typeof f]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      {err && <p className="field-error" role="alert">{err}</p>}
      <p role="status" className="status-line">{msg}</p>
      <p className="form-actions"><button type="submit" className="btn btn--primary">Zapisz hasło</button></p>
    </form>
  );
}
