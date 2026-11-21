// Panel moderatora (/panel): refresh of external sources, AED datasets on dane.gov.pl, accounts of institutions.
// Moje konto (/konto): an institution changes its password. API: HANDOFF A #8.
import { useEffect, useState, type FormEvent } from 'react';
import {
  changeMyPassword, createAccount, listAccounts, refreshNow, refreshStatus, resetPassword, searchDgp, setAccountActive,
  type ImportDgp, type Konto, type StanOdswiezania, type ZbiorDgp,
} from '../api/client';
import { RequireLogin } from '../components/Auth';
import { ErrorBox, ExternalLink, Loading } from '../components/ui';
import { date } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';

const n = (x: number | undefined) => (x ?? 0).toLocaleString('pl-PL');
const when = (t: string | null | undefined) => (t ? t.replace('T', ', ') : '—');

export function Admin() {
  usePageTitle('Panel moderatora');
  return (
    <>
      <h1 id="page-title">Panel moderatora</h1>
      <p className="lead">Aktualizacja danych z zewnętrznych źródeł, zbiory samorządów z dane.gov.pl i konta instytucji. Zgłoszenia mieszkańców: <Link to="/moderacja">Moderacja zgłoszeń</Link>.</p>
      <RequireLogin role="moderator">
        <Refresh />
        <Dgp />
        <Accounts />
      </RequireLogin>
    </>
  );
}

// ---------- 1. refresh ----------
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
      <h2 id="h-refresh">Aktualizacja danych</h2>
      <p>OpenStreetMap (eksport AED dla Polski) i zbiory AED samorządów z dane.gov.pl pobierają się same <strong>{st?.harmonogram ?? '…'}</strong>. Możesz też odświeżyć je teraz.</p>
      {err && <ErrorBox error={err} onRetry={load} />}
      {st && (
        <dl className="facts">
          <dt>Ostatnio</dt><dd>{when(st.ostatnie)}{st.powod ? ` (${st.powod})` : ''}</dd>
          <dt>Następne</dt><dd>{when(st.nastepne)}</dd>
          {w?.osm && 'dodane' in w.osm && <><dt>OpenStreetMap</dt><dd>{n(w.osm.liczba_obiektow as number)} obiektów: nowe {n(w.osm.dodane as number)}, zaktualizowane {n(w.osm.zaktualizowane as number)}, odrzucone {n(w.osm.odrzucone as number)} ({String(w.osm.zrodlo)})</dd></>}
          {Array.isArray(w?.dane_gov_pl) && <><dt>dane.gov.pl</dt><dd>{w!.dane_gov_pl!.filter((d) => d.status === 'zaimportowano').length} zbiorów zaimportowanych</dd></>}
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

// ---------- 2. dane.gov.pl ----------
function Dgp() {
  const [q, setQ] = useState('defibrylator defibrylatory AED');
  const [busy, setBusy] = useState<'' | 'szukaj' | 'import'>('');
  const [found, setFound] = useState<ZbiorDgp[] | null>(null);
  const [imp, setImp] = useState<ImportDgp[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [err, setErr] = useState<Error | null>(null);

  async function go(importuj: boolean, e?: FormEvent) {
    e?.preventDefault();
    setBusy(importuj ? 'import' : 'szukaj'); setErr(null);
    try {
      const r = await searchDgp(q, importuj);
      setFound(r.data); setSkipped(r.meta.pominiete_niezwiazane ?? 0); setImp(importuj ? r.meta.importy : null);
    } catch (ex) { setErr(ex as Error); } finally { setBusy(''); }
  }
  const byId = new Map((imp ?? []).map((i) => [i.kod_zrodla.split(':')[1], i]));

  return (
    <section className="admin-section" aria-labelledby="h-dgp">
      <h2 id="h-dgp">Zbiory AED na dane.gov.pl</h2>
      <p>Samorządy publikują listy defibrylatorów na portalu dane.gov.pl. Wyszukaj je i dołącz do zbioru – dane instytucji mają pierwszeństwo przed OpenStreetMap, a te same urządzenia łączą się w jeden rekord.</p>
      <form className="inline-form" onSubmit={(e) => go(false, e)} role="search">
        <div className="field">
          <label htmlFor="dgp-q">Szukaj w dane.gov.pl</label>
          <input id="dgp-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="submit" className="btn btn--secondary" disabled={!!busy}>{busy === 'szukaj' ? 'Szukam…' : 'Szukaj'}</button>
      </form>
      {err && <ErrorBox error={err} />}
      {found && (
        <>
          <p role="status">Znaleziono {found.length} zbiorów o AED{skipped ? ` (pominięto ${skipped} niezwiązanych z AED)` : ''}.</p>
          {found.length > 0 && (
            <table className="admin-table">
              <thead><tr><th scope="col">Zbiór</th><th scope="col">Instytucja</th><th scope="col">Licencja</th><th scope="col">Wynik importu</th></tr></thead>
              <tbody>
                {found.map((d) => {
                  const i = byId.get(d.id);
                  return (
                    <tr key={d.id}>
                      <td><ExternalLink href={d.strona}>{d.tytul}</ExternalLink>{d.zmodyfikowano && <div className="hint">zmieniony {date(d.zmodyfikowano)}</div>}</td>
                      <td>{d.instytucja ?? '—'}</td>
                      <td>{d.licencja ?? `${d.licencja_portalu ?? '—'} (nieobsługiwana)`}</td>
                      <td>{!i ? '—' : i.status === 'zaimportowano'
                        ? `${i.wiersze ?? '?'} wierszy: nowe ${i.dodane}, połączone ${(i.scalone ?? 0) + (i.zaktualizowane ?? 0)}, odrzucone ${i.odrzucone}`
                        : i.powod ?? i.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {found.length > 0 && (
            <p className="form-actions">
              <button type="button" className="btn btn--primary" disabled={!!busy} onClick={() => go(true)}>{busy === 'import' ? 'Importuję… (do minuty)' : 'Zaimportuj znalezione zbiory'}</button>
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ---------- 3. accounts ----------
function Accounts() {
  const st = useAsync(() => listAccounts(), []);
  const [form, setForm] = useState({ login: '', dysponent_nazwa: '', email: '' });
  const [secret, setSecret] = useState<{ login: string; haslo: string; nowe: boolean } | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await createAccount({ login: form.login.trim().toLowerCase(), dysponent_nazwa: form.dysponent_nazwa.trim(), ...(form.email.trim() ? { email: form.email.trim() } : {}) });
      setSecret({ login: r.data.login, haslo: r.haslo_jednorazowe, nowe: true });
      setForm({ login: '', dysponent_nazwa: '', email: '' });
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
      <h2 id="h-acc">Konta instytucji</h2>
      <p>Konto zakładasz po sprawdzeniu, że osoba reprezentuje instytucję (np. pismo, e-mail z domeny urzędu). Instytucja widzi i rozpatruje zgłoszenia tylko swoich AED, a jej pliki zawsze trafiają do zbioru pod jej nazwą.</p>
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
        <div className="field">
          <label htmlFor="acc-mail">E-mail kontaktowy (nieobowiązkowy)</label>
          <input id="acc-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Zakładam…' : 'Załóż konto'}</button>
      </form>
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (st.data.length === 0 ? <p>Nie ma jeszcze kont instytucji (działają konta pokazowe <code>dysponent</code> i <code>moderator</code>).</p> : (
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

// ---------- Moje konto (institution) ----------
export function MyAccount() {
  usePageTitle('Moje konto');
  return (
    <>
      <h1 id="page-title">Moje konto</h1>
      <RequireLogin role="dysponent" roles={['dysponent', 'moderator']}>
        <PasswordForm />
      </RequireLogin>
    </>
  );
}

function PasswordForm() {
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
      <p className="hint">Konta pokazowe (<code>dysponent</code>, <code>moderator</code>) mają hasło w ustawieniach serwera i nie zmienia się go tutaj.</p>
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
