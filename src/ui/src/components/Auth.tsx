// Login: demo accounts (dysponent / moderator) or an institution account created by a moderator (/panel).
// After POST /auth/login every request carries Authorization: Bearer <token>.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { changeMyPassword, forgotPassword, getSession, login, logout, onSessionChange, type Role, type Session } from '../api/client';
import { Link, navigate } from '../router';
import { ErrorSummary, Req, RequiredNote, useValidation } from './form';

export function useSession(): Session {
  const [s, setS] = useState<Session>(getSession);
  useEffect(() => onSessionChange(setS), []);
  return s;
}

export const ROLE_LABEL: Record<Role, string> = { dysponent: 'dostawca danych (właściciel AED)', administrator: 'administrator (MC)' };
/** Where each role works after logging in (docs/MODEL_ROL.md §4). */
export const ROLE_HOME: Record<Role, { to: string; label: string }> = {
  dysponent: { to: '/zgloszenia-aed', label: 'Zgłoszenia AED' },
  administrator: { to: '/zgloszenia-aed', label: 'Zgłoszenia AED' },
};

/** Top of every page of a logged-in user: who is logged in, "Wyloguj" (highlighted) and "Zmień hasło". */
export function SessionBar() {
  const s = useSession();
  const [pw, setPw] = useState(false);
  if (!s) return null;
  const who = s.rola === 'dysponent' && s.dysponent_nazwa ? s.dysponent_nazwa : 'Administrator';
  const builtIn = s.login === 'admin' || s.login === s.rola; // built-in account: password set on the server (.env)
  return (
    <>
      <div className="session-bar">
        <p className="session-bar__who">Zalogowano jako <strong>{who}</strong>{s.login ? <> · login <code>{s.login}</code></> : null}</p>
        <div className="session-bar__actions">
          {!builtIn && <button type="button" className="btn btn--secondary btn--small" aria-expanded={pw} onClick={() => setPw((x) => !x)}>Zmień hasło</button>}
          <button type="button" className="btn btn--primary btn--small" onClick={() => { logout(); navigate('/'); }}>Wyloguj</button>
        </div>
      </div>
      {builtIn && s.rola === 'administrator' && <p className="hint">Hasło wbudowanego konta <code>admin</code> ustawia się na serwerze (plik <code>.env</code>, <code>ADMIN_PASSWORD</code>).</p>}
      {pw && <PasswordForm />}
    </>
  );
}

/** CR-TL-11: after logging in with a one-time password the institution must set its own before anything else. */
export function ForcedPasswordChange() {
  const s = useSession();
  useEffect(() => { document.title = 'Ustaw własne hasło – Mapa AED'; }, []);
  return (
    <>
      <h1 id="page-title">Ustaw własne hasło</h1>
      <div className="callout" role="note">
        <p className="callout__title">Zalogowano hasłem jednorazowym{s?.login ? <> (login <code>{s.login}</code>)</> : null}</p>
        <p>Hasło jednorazowe dostałeś od administratora. Ustaw teraz własne – tylko Ty będziesz je znać. Nikt, także administrator, nie może go odczytać.</p>
      </div>
      <PasswordForm forced />
      <p><button type="button" className="btn btn--tertiary" onClick={() => { logout(); navigate('/'); }}>Wyloguj</button></p>
    </>
  );
}

/** "Nie pamiętam hasła": the request goes to the administrator, who issues a one-time password (shown to him once). */
function ForgotPassword() {
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    if (q.trim().length < 3) { setErr('Wpisz login albo służbowy e-mail konta.'); return; }
    setBusy(true);
    try { setMsg((await forgotPassword(q.trim())).meta.komunikat); setQ(''); }
    catch (ex) { setErr((ex as Error).message || 'Nie udało się wysłać prośby.'); } finally { setBusy(false); }
  }
  return (
    <details className="details">
      <summary>Nie pamiętam hasła</summary>
      <form onSubmit={send} noValidate>
        <p>Hasła nie da się odczytać – nawet administrator go nie zna. Wyślij prośbę: administrator sprawdzi instytucję (telefon lub służbowy e-mail z konta) i przekaże Ci <strong>hasło jednorazowe</strong> ważne 72 godziny. Po zalogowaniu ustawisz własne.</p>
        <div className="field">
          <label htmlFor="fp-q">Login albo służbowy e-mail</label>
          <input id="fp-q" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)}
            aria-invalid={!!err} aria-describedby={err ? 'fp-err' : undefined} />
          {err && <p id="fp-err" className="field-error" role="alert">{err}</p>}
        </div>
        <p className="form-actions"><button type="submit" className="btn btn--secondary" disabled={busy}>{busy ? 'Wysyłam…' : 'Wyślij prośbę o nowe hasło'}</button></p>
        <p role="status" className="status-line">{msg}</p>
      </form>
    </details>
  );
}

function PasswordForm({ forced = false }: { forced?: boolean }) {
  const [f, setF] = useState({ stare: '', nowe: '', nowe2: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(''); setErr('');
    if (f.nowe.length < 10) { setErr('Nowe hasło musi mieć co najmniej 10 znaków.'); return; }
    if (f.nowe !== f.nowe2) { setErr('Nowe hasła się różnią.'); return; }
    if (f.nowe === f.stare) { setErr('Nowe hasło musi być inne niż obecne.'); return; }
    try {
      await changeMyPassword(f.stare, f.nowe); setMsg('Hasło zmienione. Inne sesje na tym koncie zostały wylogowane.'); setF({ stare: '', nowe: '', nowe2: '' });
      if (forced) { const ses = getSession(); if (ses) navigate(ROLE_HOME[ses.rola].to); }
    }
    catch (ex) { setErr((ex as Error).message); }
  }
  return (
    <form className="panel password-form" onSubmit={save} aria-labelledby="h-pass" noValidate>
      <h2 id="h-pass">{forced ? 'Nowe hasło' : 'Zmień hasło'}</h2>
      {[['stare', forced ? 'Hasło jednorazowe (od administratora)' : 'Obecne hasło', 'current-password'], ['nowe', 'Nowe hasło (min. 10 znaków)', 'new-password'], ['nowe2', 'Powtórz nowe hasło', 'new-password']].map(([k, l, ac]) => (
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


/** Renders children only for a logged-in user with one of `roles`; otherwise a login form for `role`. */
export function RequireLogin({ role, roles = [role], children, sessionLine = true }: { role: Role; roles?: Role[]; children: ReactNode; sessionLine?: boolean }) {
  const s = useSession();
  if (s && roles.includes(s.rola) && !sessionLine) return <>{children}</>; // the page shows its own SessionBar
  if (s && roles.includes(s.rola)) {
    return (
      <>
        <p className="session-line">
          Zalogowano jako <strong>{s.dysponent_nazwa && s.rola === 'dysponent' ? s.dysponent_nazwa : ROLE_LABEL[s.rola]}</strong>
          {' '}({s.login && s.login !== s.rola ? <>login <code>{s.login}</code></> : 'konto demo'}).{' '}
          <button type="button" className="btn btn--tertiary" onClick={logout}>Wyloguj</button>
        </p>
        {children}
      </>
    );
  }
  return <LoginForm role={role} wrongRole={s ? s.rola : null} />;
}

function LoginForm({ role, wrongRole }: { role: Role; wrongRole: Role | null }) {
  const [haslo, setHaslo] = useState('');
  const [name, setName] = useState<string>(role === 'administrator' ? 'admin' : '');
  const [busy, setBusy] = useState(false);
  const v = useValidation({ haslo: () => (haslo ? '' : 'Wpisz hasło.') });
  const error = v.errors.haslo ?? '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.validateAll()) return;
    setBusy(true);
    try { await login(name.trim().toLowerCase() || role, haslo); }
    catch (ex) { v.showServerErrors({ haslo: (ex as Error).message || 'Nie udało się zalogować.' }); }
    finally { setBusy(false); }
  }

  return (
    <form className="panel login-box" onSubmit={submit} noValidate aria-labelledby="login-title">
      <h2 id="login-title">Zaloguj się jako {ROLE_LABEL[role]}</h2>
      <RequiredNote />
      <ErrorSummary errors={v.summary} fieldIds={{ haslo: 'login-pass' }} focusToken={v.focusToken} />
      {wrongRole && <p>Jesteś zalogowany jako {ROLE_LABEL[wrongRole]}. Ta część wymaga konta: {ROLE_LABEL[role]}.</p>}
      <p className="hint">
        {role === 'dysponent'
          ? <>Instytucja loguje się loginem i hasłem z zatwierdzonego wniosku (albo od administratora).</>
          : <>Do pokazu: login <code>admin</code>, hasło <code>admin123</code>.</>}
      </p>
      <div className="field">
        <label htmlFor="login-name">Login</label>
        <input id="login-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
      </div>
      <div className="field">
        <label htmlFor="login-pass">Hasło<Req /></label>
        <input id="login-pass" type="password" autoComplete="current-password" required onBlur={() => v.check('haslo')} value={haslo} onChange={(e) => setHaslo(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? 'login-err' : undefined} />
        {error && <p id="login-err" className="field-error">{error}</p>}
      </div>
      <p className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Loguję…' : 'Zaloguj się'}</button>
      </p>
    </form>
  );
}

/** /logowanie – one entry for providers and administrators (link in the footer). After login: the role's own page. */
export function LoginPage() {
  const s = useSession();
  const [name, setName] = useState('');
  const [haslo, setHaslo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { document.title = 'Logowanie – Mapa AED'; }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (!name.trim() || !haslo) { setErr('Wpisz login i hasło.'); return; }
    setBusy(true);
    try {
      const ses = await login(name.trim().toLowerCase(), haslo);
      if (ses) navigate(ROLE_HOME[ses.rola].to);
    } catch (ex) { setErr((ex as Error).message || 'Nie udało się zalogować.'); } finally { setBusy(false); }
  }
  if (s) {
    return (
      <>
        <h1 id="page-title">Jesteś zalogowany</h1>
        <p>Konto: <strong>{s.dysponent_nazwa && s.rola === 'dysponent' ? s.dysponent_nazwa : ROLE_LABEL[s.rola]}</strong>{s.login ? <> (login <code>{s.login}</code>)</> : null}.</p>
        <p className="form-actions">
          <Link className="btn btn--primary" to={ROLE_HOME[s.rola].to}>{ROLE_HOME[s.rola].label}</Link>
          <button type="button" className="btn btn--secondary" onClick={logout}>Wyloguj</button>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 id="page-title">Logowanie dla instytucji i administratorów</h1>
      <p className="lead">Zaloguj się, aby zgłaszać AED, za które odpowiada Twoja instytucja (urząd, szkoła, szpital, firma, fundacja). Mieszkańcy nie muszą się logować – mogą szukać AED i zgłaszać problemy bez konta.</p>
      <form className="panel login-box" onSubmit={submit} noValidate aria-labelledby="lp-title">
        <h2 id="lp-title">Zaloguj się</h2>
        <div className="field">
          <label htmlFor="lp-login">Login</label>
          <input id="lp-login" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lp-pass">Hasło</label>
          <input id="lp-pass" type="password" autoComplete="current-password" value={haslo} onChange={(e) => setHaslo(e.target.value)}
            aria-invalid={!!err} aria-describedby={err ? 'lp-err' : undefined} />
          {err && <p id="lp-err" className="field-error" role="alert">{err}</p>}
        </div>
        <p className="form-actions"><button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Loguję…' : 'Zaloguj się'}</button></p>
      </form>
      <ForgotPassword />
      <details className="details">
        <summary>Konto do pokazu (prototyp)</summary>
        <p>Administrator: login <code>admin</code>, hasło <code>admin123</code>. Konta instytucji zakłada administrator albo powstają z zatwierdzonego wniosku.</p>
        <p className="hint">W wersji docelowej logowanie odbywa się przez login.gov.pl z drugim składnikiem (np. kod w telefonie).</p>
      </details>
      <p>Twoja instytucja nie ma jeszcze konta? <Link to="/wniosek-o-konto">Złóż wniosek o konto</Link> – zacznie działać po sprawdzeniu przez administratora.</p>
    </>
  );
}
