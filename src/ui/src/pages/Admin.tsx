// Panel administratora (/panel) – owner's decision 22.11 (MODEL_ROL v1.4): the administrator manages institutions and
// their accounts (data, login, password), every AED (edit, delete, assign to an institution), the aggregation of providers'
// datasets, gaps, residents' reports without an institution, reminders, the event log and data refresh.
// Approvals (new AED, changes, account requests) are on the page "Zgłoszenia AED".
import { useEffect, useState, type FormEvent } from 'react';
import {
  adminAedAssign, adminAedDelete, adminAedEdit, adminAedList, aggregationReport, createAccount, deleteAccount, eventLog, getAed,
  lateDatasets, listAccounts, listGaps, refreshNow, refreshStatus, runAggregation, sendReminders, updateAccount,
  type AedAdmin, type Konto, type RaportZbioru, type StanOdswiezania,
} from '../api/client';
import { RequireLogin, SessionBar } from '../components/Auth';
import { ReportsQueue } from '../components/ReportsQueue';
import { ErrorBox, ExternalLink, Loading } from '../components/ui';
import { dictValues } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';
import { PODSTAWA_LABEL, type Aed, type PodstawaPublikacji } from '../api/types';

const n = (x: number | undefined) => (x ?? 0).toLocaleString('pl-PL');
const when = (t: string | null | undefined) => (t ? t.replace('T', ', ') : '—');

export function Admin() {
  usePageTitle('Panel administratora');
  return (
    <>
      <h1 id="page-title">Panel administratora</h1>
      <RequireLogin role="administrator">
        <SessionBar />
        <p className="lead">Instytucje i ich konta, wszystkie AED (edycja, usuwanie, przypisanie do instytucji) i narzędzia list. Nowe AED, zmiany i wnioski o konto zatwierdzasz w <Link to="/zgloszenia-aed">Zgłoszenia AED</Link>.</p>
        <nav aria-label="Sekcje panelu" className="toc">
          <ul>
            <li><a href="#h-acc">Instytucje i konta</a></li><li><a href="#h-all">Wszystkie AED</a></li>
            <li><a href="#h-rep">Zgłoszenia mieszkańców</a></li><li><a href="#h-agg">Zbiory w dane.gov.pl</a></li><li><a href="#h-gaps">Luki</a></li>
            <li><a href="#h-late">Przypomnienia</a></li><li><a href="#h-log">Dziennik zdarzeń</a></li><li><a href="#h-refresh">Odświeżanie</a></li>
          </ul>
        </nav>
        <Accounts />
        <AllAed />
        <section className="admin-section" aria-labelledby="h-rep">
          <h2 id="h-rep">Zgłoszenia mieszkańców o AED bez instytucji</h2>
          <p>Problemy zgłoszone przez mieszkańców przy AED, które nie są przypisane do żadnej instytucji (np. punkty „do sprawdzenia” z OpenStreetMap).</p>
          <ReportsQueue mode="administrator" />
        </section>
        <Aggregation />
        <Gaps />
        <Late />
        <Log />
        <Refresh />
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
  ['wlasciciel', 'Właściciel AED', 'instytucja jest właścicielem urządzenia'],
  ['zarzadca', 'Zarządca z umową', 'zarządza AED na podstawie umowy z właścicielem'],
  ['weryfikujacy', 'Podmiot weryfikujący', 'np. fundacja, która sprawdza AED na miejscu'],
];

// ---------- institutions and their accounts: create, find, edit everything (also login and password), block, delete ----------
function Accounts() {
  const st = useAsync(() => listAccounts(), []);
  const empty = { rola: 'dysponent' as 'dysponent' | 'administrator', login: '', dysponent_nazwa: '', dostawca_podstawa: '' as PodstawaPublikacji | '', email: '', telefon: '', regon: '' };
  const [form, setForm] = useState(empty);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ login: string; haslo: string } | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [stan, setStan] = useState('');
  const [edit, setEdit] = useState<(Konto & { nowy_login: string; haslo: string }) | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true); setInfo('');
    try {
      const inst = form.rola === 'dysponent';
      if (inst && !form.dostawca_podstawa) throw new Error('Wybierz podstawę publikacji.');
      const r = await createAccount({ login: form.login.trim().toLowerCase(), rola: form.rola,
        dysponent_nazwa: inst ? form.dysponent_nazwa.trim() : (form.dysponent_nazwa.trim() || 'Ministerstwo Cyfryzacji'),
        ...(inst ? { dostawca_podstawa: form.dostawca_podstawa as PodstawaPublikacji } : {}), ...(form.email.trim() ? { email: form.email.trim() } : {}) });
      const extra = { ...(form.telefon.trim() ? { telefon: form.telefon.trim() } : {}), ...(form.regon.trim() ? { regon: form.regon.trim() } : {}) };
      if (Object.keys(extra).length) await updateAccount(r.data.login, extra);
      setSecret({ login: r.data.login, haslo: r.haslo_jednorazowe });
      setForm(empty); setCreating(false); st.reload();
    } catch (ex) { setErr(ex as Error); } finally { setBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setErr(null); setInfo('');
    const orig = st.data?.find((k) => k.login === edit.login);
    const ch: Parameters<typeof updateAccount>[1] = {};
    if (edit.dysponent_nazwa && edit.dysponent_nazwa !== orig?.dysponent_nazwa) ch.dysponent_nazwa = edit.dysponent_nazwa.trim();
    if ((edit.email ?? '') !== (orig?.email ?? '')) ch.email = edit.email ?? '';
    if ((edit.telefon ?? '') !== (orig?.telefon ?? '')) ch.telefon = edit.telefon ?? '';
    if ((edit.regon ?? '') !== (orig?.regon ?? '') && edit.regon) ch.regon = edit.regon;
    if (edit.dostawca_podstawa && edit.dostawca_podstawa !== orig?.dostawca_podstawa) ch.dostawca_podstawa = edit.dostawca_podstawa;
    if (edit.nowy_login.trim() && edit.nowy_login.trim().toLowerCase() !== edit.login) ch.nowy_login = edit.nowy_login.trim().toLowerCase();
    if (edit.haslo) ch.haslo = edit.haslo;
    try {
      await updateAccount(edit.login, ch);
      setInfo(`Zapisano konto ${ch.nowy_login ?? edit.login}${ch.haslo ? ' (nowe hasło ustawione – przekaż je instytucji bezpiecznym kanałem)' : ''}.`);
      setEdit(null); st.reload();
    } catch (ex) { setErr(ex as Error); }
  }
  async function toggle(k: Konto) {
    try { await updateAccount(k.login, { aktywne: !k.aktywne }); st.reload(); } catch (ex) { setErr(ex as Error); }
  }
  async function remove(k: Konto) {
    if (!window.confirm(`Usunąć konto ${k.login} (${k.dysponent_nazwa})? AED instytucji zostaną na mapie.`)) return;
    try { await deleteAccount(k.login); setInfo(`Usunięto konto ${k.login}.`); st.reload(); } catch (ex) { setErr(ex as Error); }
  }
  // the built-in account "admin" is not in the database – shown first, read-only
  const all: (Konto & { wbudowane?: boolean })[] = [
    { login: 'admin', rola: 'administrator', dysponent_nazwa: 'Administrator (konto wbudowane)', email: null, aktywne: true, utworzono: null, utworzyl: null, liczba_aed: 0, wbudowane: true },
    ...(st.data ?? []),
  ];
  const TABS: [string, string, (k: Konto) => boolean][] = [
    ['', 'Wszystkie', () => true], ['aktywne', 'Aktywne', (k) => k.aktywne], ['oczekuje', 'Czekają na zatwierdzenie', (k) => !!k.oczekuje],
    ['zablokowane', 'Zablokowane', (k) => !k.aktywne && !k.oczekuje], ['administrator', 'Administratorzy', (k) => k.rola === 'administrator'],
  ];
  const tabFn = TABS.find((t) => t[0] === stan)![2];
  const rows = all.filter((k) => {
    const t = `${k.login} ${k.dysponent_nazwa ?? ''} ${k.email ?? ''} ${k.regon ?? ''} ${k.telefon ?? ''}`.toLowerCase();
    return (!q || t.includes(q.toLowerCase())) && tabFn(k);
  });

  return (
    <section className="admin-section" aria-labelledby="h-acc">
      <h2 id="h-acc">Instytucje i konta</h2>
      <p>Wszystkie konta: instytucji odpowiedzialnych za AED i administratorów. Możesz zmienić każdą daną konta – także login i hasło (np. po utracie lub kradzieży hasła), zablokować albo usunąć konto. Wnioski instytucji o konto zatwierdzasz w <Link to="/zgloszenia-aed">Zgłoszenia AED</Link>.</p>
      {secret && (
        <div className="callout callout--ok" role="alert">
          <p className="callout__title">Konto założone. Przekaż instytucji login i hasło bezpiecznym kanałem.</p>
          <p>Login: <span className="secret">{secret.login}</span> · Hasło: <span className="secret">{secret.haslo}</span></p>
          <p className="hint">Hasło widać tylko teraz. Instytucja może je zmienić po zalogowaniu („Zmień hasło”).</p>
          <p><button type="button" className="btn btn--tertiary" onClick={() => setSecret(null)}>Ukryj hasło</button></p>
        </div>
      )}
      {info && <p className="callout callout--ok" role="status">{info}</p>}
      {err && <ErrorBox error={err} />}
      {!creating ? <p><button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>Załóż konto</button></p> : (
        <form className="panel" onSubmit={create} aria-labelledby="h-acc-new">
          <h3 id="h-acc-new">Nowe konto</h3>
          <fieldset className="field">
            <legend>Rodzaj konta</legend>
            <div className="big-choices big-choices--row">
              <label><input type="radio" name="acc-rola" checked={form.rola === 'dysponent'} onChange={() => setForm({ ...form, rola: 'dysponent' })} /> Instytucja</label>
              <label><input type="radio" name="acc-rola" checked={form.rola === 'administrator'} onChange={() => setForm({ ...form, rola: 'administrator' })} /> Administrator</label>
            </div>
          </fieldset>
          <div className="filters__grid">
            <div className="field"><label htmlFor="acc-name">{form.rola === 'dysponent' ? 'Nazwa instytucji' : 'Imię i nazwisko lub nazwa (nieobowiązkowe)'}</label>
              <input id="acc-name" required={form.rola === 'dysponent'} minLength={3} value={form.dysponent_nazwa} onChange={(e) => setForm({ ...form, dysponent_nazwa: e.target.value })} placeholder="np. Urząd Miasta Krosna" /></div>
            <div className="field"><label htmlFor="acc-login">Login</label>
              <input id="acc-login" required pattern="[a-z0-9][a-z0-9._\-]{2,40}" title="3–41 znaków: małe litery, cyfry, kropka, _ i -" autoCapitalize="none" spellCheck={false}
                value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} placeholder="np. um.krosno" /></div>
            <div className="field"><label htmlFor="acc-regon">REGON (nieobowiązkowy)</label>
              <input id="acc-regon" inputMode="numeric" value={form.regon} onChange={(e) => setForm({ ...form, regon: e.target.value })} /></div>
            <div className="field"><label htmlFor="acc-mail">E-mail (nieobowiązkowy)</label>
              <input id="acc-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="acc-tel">Telefon (nieobowiązkowy)</label>
              <input id="acc-tel" type="tel" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></div>
          </div>
          {form.rola === 'dysponent' && <fieldset className="field">
            <legend>Podstawa publikacji</legend>
            <div className="big-choices">
              {PODSTAWY.map(([v, l, h]) => (
                <label key={v}><input type="radio" name="acc-podstawa" value={v} required checked={form.dostawca_podstawa === v}
                  onChange={() => setForm({ ...form, dostawca_podstawa: v })} /><span>{l}<span className="hint"> – {h}</span></span></label>
              ))}
            </div>
          </fieldset>}
          <p className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Zakładam…' : 'Załóż konto'}</button>
            <button type="button" className="btn btn--tertiary" onClick={() => setCreating(false)}>Anuluj</button>
          </p>
        </form>
      )}
      <div className="table-tools">
        <div className="field"><label htmlFor="acc-q">Szukaj (nazwa, login, REGON, e-mail, telefon)</label>
          <input id="acc-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="segmented acc-tabs" role="group" aria-label="Pokaż konta">
        {TABS.map(([v, l, f]) => <button key={v} type="button" aria-pressed={stan === v} onClick={() => setStan(v)}>{l} ({all.filter(f).length})</button>)}
      </div>
      {st.loading && !st.data && <Loading />}
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (rows.length === 0 ? <p>Brak kont dla tych warunków.</p> : (
        <table className="admin-table">
          <thead><tr><th scope="col">Instytucja / osoba</th><th scope="col">Login</th><th scope="col">Kontakt</th><th scope="col">AED</th><th scope="col">Stan</th><th scope="col">Działania</th></tr></thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.login}>
                <td>{k.dysponent_nazwa}<div className="hint">{k.rola === 'administrator' ? 'administrator' : 'instytucja'}{k.regon ? ` · REGON ${k.regon}` : ''}{k.dostawca_podstawa ? ` · ${PODSTAWA_LABEL[k.dostawca_podstawa]}` : ''}</div></td>
                <td><code>{k.login}</code>{k.utworzono && <div className="hint">od {when(k.utworzono)}</div>}</td>
                <td>{k.email ?? '—'}<div className="hint">{k.telefon ?? ''}</div></td>
                <td>{k.rola === 'administrator' ? '—' : n(k.liczba_aed)}</td>
                <td>{k.oczekuje ? 'czeka na zatwierdzenie' : k.aktywne ? 'aktywne' : 'zablokowane'}</td>
                <td className="table-actions">
                  {k.wbudowane ? <span className="hint">hasło w pliku .env (ADMIN_PASSWORD)</span> : <>
                  <button type="button" className="btn btn--secondary btn--small" onClick={() => setEdit({ ...k, nowy_login: k.login, haslo: '' })}>Edytuj<span className="visually-hidden"> {k.login}</span></button>
                  {!k.oczekuje && <button type="button" className="btn btn--secondary btn--small" onClick={() => toggle(k)}>{k.aktywne ? 'Zablokuj' : 'Odblokuj'}<span className="visually-hidden"> {k.login}</span></button>}
                  <button type="button" className="btn btn--danger btn--small" onClick={() => remove(k)}>Usuń<span className="visually-hidden"> {k.login}</span></button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      {edit && (
        <form className="panel" onSubmit={save} aria-labelledby="h-acc-edit">
          <h3 id="h-acc-edit">Edytuj konto {edit.login}</h3>
          <div className="filters__grid">
            <div className="field"><label htmlFor="ed-name">Nazwa instytucji</label><input id="ed-name" value={edit.dysponent_nazwa ?? ''} onChange={(e) => setEdit({ ...edit, dysponent_nazwa: e.target.value })} /></div>
            <div className="field"><label htmlFor="ed-login">Login</label><input id="ed-login" autoCapitalize="none" value={edit.nowy_login} onChange={(e) => setEdit({ ...edit, nowy_login: e.target.value })} /></div>
            <div className="field"><label htmlFor="ed-pass">Nowe hasło (zostaw puste, by nie zmieniać)</label><input id="ed-pass" type="text" autoComplete="off" value={edit.haslo} onChange={(e) => setEdit({ ...edit, haslo: e.target.value })} /></div>
            <div className="field"><label htmlFor="ed-regon">REGON</label><input id="ed-regon" inputMode="numeric" value={edit.regon ?? ''} onChange={(e) => setEdit({ ...edit, regon: e.target.value })} /></div>
            <div className="field"><label htmlFor="ed-mail">E-mail</label><input id="ed-mail" type="email" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="ed-tel">Telefon</label><input id="ed-tel" type="tel" value={edit.telefon ?? ''} onChange={(e) => setEdit({ ...edit, telefon: e.target.value })} /></div>
            <div className="field"><label htmlFor="ed-pod">Podstawa publikacji</label>
              <select id="ed-pod" value={edit.dostawca_podstawa ?? ''} onChange={(e) => setEdit({ ...edit, dostawca_podstawa: e.target.value as PodstawaPublikacji })}>
                <option value="">—</option>{PODSTAWY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select></div>
          </div>
          <p className="hint">Zmiana nazwy instytucji przenosi też jej AED i zgłoszenia na nową nazwę.</p>
          <p className="form-actions"><button type="submit" className="btn btn--primary">Zapisz zmiany</button>
            <button type="button" className="btn btn--tertiary" onClick={() => setEdit(null)}>Anuluj</button></p>
        </form>
      )}
    </section>
  );
}

// ---------- every AED: find, edit any field, delete, assign to an institution ----------
const EDIT_FIELDS: [keyof Aed, string, 'text' | 'area' | 'bool' | 'num' | 'select', string?][] = [
  ['nazwa_obiektu', 'Nazwa obiektu', 'text'], ['opis_lokalizacji', 'Jak dojść (opis miejsca)', 'area'], ['ulica', 'Ulica', 'text'],
  ['numer_budynku', 'Numer budynku', 'text'], ['kod_pocztowy', 'Kod pocztowy', 'text'], ['miejscowosc', 'Miejscowość', 'text'],
  ['godziny_dostepnosci', 'Godziny (np. pn-pt 8-16 albo 24/7)', 'text'], ['dostep', 'Dostęp', 'select', 'dostep'],
  ['szafka_zamknieta', 'Szafka zamknięta', 'bool'], ['instrukcja_dostepu', 'Jak otworzyć szafkę', 'area'], ['wewnatrz_budynku', 'W budynku', 'bool'],
  ['status_urzadzenia', 'Stan urządzenia', 'select', 'status_urzadzenia'], ['data_weryfikacji', 'Data sprawdzenia (RRRR-MM-DD)', 'text'],
  ['szerokosc_geograficzna', 'Szerokość geograficzna', 'num'], ['dlugosc_geograficzna', 'Długość geograficzna', 'num'],
  ['dysponent_nazwa', 'Dysponent (nazwa w danych)', 'text'], ['kontakt_telefon', 'Telefon kontaktowy', 'text'], ['uwagi', 'Uwagi', 'area'],
];
const WARSTWA: Record<AedAdmin['warstwa'], string> = { lista: 'zbiór instytucji', pomocnicza: 'do sprawdzenia (OSM)', aplikacja: 'dodane w aplikacji' };

function AllAed() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [warstwa, setWarstwa] = useState('wszystkie');
  const [org, setOrg] = useState('');
  const [page, setPage] = useState(1);
  const list = useAsync(() => adminAedList({ q: query || undefined, warstwa, organizacja: org || undefined, page, per_page: 25 }), [query, warstwa, org, page]);
  const orgs = useAsync(() => listAccounts().then((a) => [...new Set(a.filter((k) => k.dysponent_nazwa).map((k) => k.dysponent_nazwa!))].sort()), []);
  const [edit, setEdit] = useState<{ id: string; rec: Aed; org: string; vals: Record<string, string> } | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const [info, setInfo] = useState('');

  async function openEdit(r: AedAdmin) {
    setErr(null); setInfo('');
    orgs.reload(); // accounts may have been created since the panel opened
    const d = await getAed(r.id_aed);
    if (!d) return;
    const vals: Record<string, string> = {};
    for (const [k] of EDIT_FIELDS) { const v = d.aed[k]; vals[k] = v === null || v === undefined ? '' : String(v); }
    setEdit({ id: r.id_aed, rec: d.aed, org: r.organizacja ?? '', vals });
    setTimeout(() => document.getElementById('h-aed-edit')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setErr(null);
    const pola: Record<string, unknown> = {};
    for (const [k, , t] of EDIT_FIELDS) {
      const v = edit.vals[k];
      const old = edit.rec[k] === null || edit.rec[k] === undefined ? '' : String(edit.rec[k]);
      if (v === old) continue;
      pola[k] = v === '' ? null : t === 'bool' ? v === 'true' : t === 'num' ? Number(v.replace(',', '.')) : v;
    }
    try {
      if (Object.keys(pola).length) await adminAedEdit(edit.id, pola);
      const before = list.data?.data.find((x) => x.id_aed === edit.id)?.organizacja ?? '';
      if (edit.org !== before) await adminAedAssign(edit.id, edit.org || null);
      setInfo(`Zapisano zmiany AED „${edit.vals.nazwa_obiektu}”.`); setEdit(null); list.reload();
    } catch (ex) { setErr(ex as Error); }
  }
  async function remove(r: AedAdmin) {
    if (!window.confirm(`Usunąć AED „${r.nazwa_obiektu}”? Zniknie z mapy (także po odświeżeniu danych).`)) return;
    try { await adminAedDelete(r.id_aed); setInfo(`Usunięto „${r.nazwa_obiektu}”.`); list.reload(); } catch (ex) { setErr(ex as Error); }
  }
  const total = list.data?.meta.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <section className="admin-section" aria-labelledby="h-all">
      <h2 id="h-all">Wszystkie AED</h2>
      <p>Każde AED na mapie – możesz zmienić jego dane, usunąć je albo przypisać do instytucji (zobaczy je u siebie i dostanie zgłoszenia mieszkańców). Każda zmiana trafia do dziennika zdarzeń. Nowe AED dodajesz w <Link to="/zgloszenia-aed">Zgłoszenia AED</Link>.</p>
      {info && <p className="callout callout--ok" role="status">{info}</p>}
      {err && <ErrorBox error={err} />}
      <form className="table-tools" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }} role="search">
        <div className="field"><label htmlFor="all-q">Szukaj (nazwa, miejscowość, ulica, gmina, id)</label>
          <input id="all-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="all-w">Źródło</label>
          <select id="all-w" value={warstwa} onChange={(e) => { setPage(1); setWarstwa(e.target.value); }}>
            <option value="wszystkie">wszystkie</option><option value="lista">zbiory instytucji</option><option value="aplikacja">dodane w aplikacji</option><option value="pomocnicza">do sprawdzenia (OSM)</option>
          </select></div>
        <div className="field"><label htmlFor="all-o">Instytucja</label>
          <select id="all-o" value={org} onChange={(e) => { setPage(1); setOrg(e.target.value); }}>
            <option value="">wszystkie</option>{(orgs.data ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select></div>
        <button type="submit" className="btn btn--secondary">Szukaj</button>
      </form>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data && (
        <>
          <p className="hint">{n(total)} AED · strona {page} z {n(pages)}</p>
          <table className="admin-table">
            <thead><tr><th scope="col">AED</th><th scope="col">Adres</th><th scope="col">Źródło</th><th scope="col">Instytucja</th><th scope="col">Sprawdzone</th><th scope="col">Działania</th></tr></thead>
            <tbody>
              {list.data.data.map((r) => (
                <tr key={r.id_aed}>
                  <td><Link to={`/aed/${r.id_aed}`}>{r.nazwa_obiektu || 'bez nazwy'}</Link>{r.edytowane && <div className="hint">zmienione przez administratora</div>}</td>
                  <td>{[r.adres, r.miejscowosc].filter(Boolean).join(', ') || '—'}</td>
                  <td>{WARSTWA[r.warstwa]}</td>
                  <td>{r.organizacja ?? '—'}</td>
                  <td>{r.data_weryfikacji ?? '—'}</td>
                  <td className="table-actions">
                    <button type="button" className="btn btn--secondary btn--small" onClick={() => openEdit(r)}>Edytuj<span className="visually-hidden"> {r.nazwa_obiektu}</span></button>
                    <button type="button" className="btn btn--danger btn--small" onClick={() => remove(r)}>Usuń<span className="visually-hidden"> {r.nazwa_obiektu}</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="form-actions">
            <button type="button" className="btn btn--secondary btn--small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Poprzednia</button>
            <button type="button" className="btn btn--secondary btn--small" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Następna</button>
          </p>
        </>
      )}
      {edit && (
        <form className="panel" onSubmit={save} aria-labelledby="h-aed-edit">
          <h3 id="h-aed-edit">Edytuj AED: {edit.vals.nazwa_obiektu}</h3>
          <div className="field"><label htmlFor="ae-org">Instytucja odpowiedzialna</label>
            <select id="ae-org" value={edit.org} onChange={(e) => setEdit({ ...edit, org: e.target.value })}>
              <option value="">— brak —</option>{[...new Set([...(orgs.data ?? []), ...(edit.org ? [edit.org] : [])])].map((o) => <option key={o} value={o}>{o}</option>)}
            </select></div>
          <div className="filters__grid">
            {EDIT_FIELDS.map(([k, l, t, dict]) => {
              const id = `ae-${k}`;
              const v = edit.vals[k];
              const set = (x: string) => setEdit({ ...edit, vals: { ...edit.vals, [k]: x } });
              return (
                <div className={`field${t === 'area' ? ' field--full' : ''}`} key={k}>
                  <label htmlFor={id}>{l}</label>
                  {t === 'area' ? <textarea id={id} rows={2} value={v} onChange={(e) => set(e.target.value)} />
                    : t === 'bool' ? <select id={id} value={v} onChange={(e) => set(e.target.value)}><option value="">brak danych</option><option value="true">tak</option><option value="false">nie</option></select>
                      : t === 'select' ? <select id={id} value={v} onChange={(e) => set(e.target.value)}><option value="">—</option>{dictValues(dict!).map((o) => <option key={o.wartosc} value={o.wartosc}>{o.wartosc}</option>)}</select>
                        : <input id={id} type="text" inputMode={t === 'num' ? 'decimal' : undefined} value={v} onChange={(e) => set(e.target.value)} />}
                </div>
              );
            })}
          </div>
          <p className="form-actions"><button type="submit" className="btn btn--primary">Zapisz zmiany</button>
            <button type="button" className="btn btn--tertiary" onClick={() => setEdit(null)}>Anuluj</button></p>
        </form>
      )}
    </section>
  );
}


