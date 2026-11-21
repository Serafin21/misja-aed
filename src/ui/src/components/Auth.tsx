// Login: demo accounts (dysponent / moderator) or an institution account created by a moderator (/panel).
// After POST /auth/login every request carries Authorization: Bearer <token>.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getSession, login, logout, onSessionChange, type Role, type Session } from '../api/client';
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
  dysponent: { to: '/moje-aed', label: 'Moje AED' },
  administrator: { to: '/panel', label: 'Panel administratora' },
};

/** Renders children only for a logged-in user with one of `roles`; otherwise a login form for `role`. */
export function RequireLogin({ role, roles = [role], children }: { role: Role; roles?: Role[]; children: ReactNode }) {
  const s = useSession();
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
  const [name, setName] = useState<string>(role === 'administrator' ? 'administrator' : 'dysponent');
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
          ? <>Instytucja loguje się loginem i hasłem, które dostała od moderatora. Do pokazu: login <code>dysponent</code>, hasło <code>dysponent-demo</code>.</>
          : <>Do pokazu: login <code>administrator</code>, hasło <code>administrator-demo</code>.</>}
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
      <h1 id="page-title">Logowanie dla dostawców danych i administratorów</h1>
      <p className="lead">Strona dla instytucji, które publikują dane o swoich AED (urzędy, szkoły, szpitale, firmy), i dla administratorów w Ministerstwie Cyfryzacji. Mieszkańcy nie muszą się logować – mogą szukać AED i zgłaszać problemy bez konta.</p>
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
        <details className="details">
          <summary>Konta do pokazu (prototyp)</summary>
          <ul>
            <li>Dostawca „Urząd Gminy Przykładowo”: login <code>dysponent</code>, hasło <code>dysponent-demo</code></li>
            <li>Administrator: login <code>administrator</code>, hasło <code>administrator-demo</code></li>
          </ul>
          <p className="hint">Konto dostawcy zakłada administrator po sprawdzeniu instytucji. W wersji docelowej logowanie odbywa się przez login.gov.pl z drugim składnikiem (np. kod w telefonie).</p>
        </details>
      </form>
    </>
  );
}
