// Demo login (dysponent / moderator). After POST /auth/login every request carries Authorization: Bearer <token>.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getSession, login, logout, onSessionChange, type Role, type Session } from '../api/client';

export function useSession(): Session {
  const [s, setS] = useState<Session>(getSession);
  useEffect(() => onSessionChange(setS), []);
  return s;
}

const ROLE_LABEL: Record<Role, string> = { dysponent: 'dysponent AED', moderator: 'moderator' };

/** Renders children only for a logged-in user with one of `roles`; otherwise a login form for `role`. */
export function RequireLogin({ role, roles = [role], children }: { role: Role; roles?: Role[]; children: ReactNode }) {
  const s = useSession();
  if (s && roles.includes(s.rola)) {
    return (
      <>
        <p className="session-line">
          Zalogowano jako <strong>{ROLE_LABEL[s.rola]}</strong> (konto demo).{' '}
          <button type="button" className="btn btn--secondary btn--sm" onClick={logout}>Wyloguj</button>
        </p>
        {children}
      </>
    );
  }
  return <LoginForm role={role} wrongRole={s ? s.rola : null} />;
}

function LoginForm({ role, wrongRole }: { role: Role; wrongRole: Role | null }) {
  const [haslo, setHaslo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!haslo) { setError('Wpisz hasło.'); document.getElementById('login-pass')?.focus(); return; }
    setBusy(true); setError('');
    try { await login(role, haslo); }
    catch (ex) { setError((ex as Error).message || 'Nie udało się zalogować.'); document.getElementById('login-pass')?.focus(); }
    finally { setBusy(false); }
  }

  return (
    <form className="panel login-box" onSubmit={submit} noValidate aria-labelledby="login-title">
      <h2 id="login-title">Zaloguj się jako {ROLE_LABEL[role]}</h2>
      {wrongRole && <p>Jesteś zalogowany jako {ROLE_LABEL[wrongRole]}. Ta część wymaga konta: {ROLE_LABEL[role]}.</p>}
      <p className="hint">
        Prototyp ma dwa konta demonstracyjne. Hasła ustawia plik <code>.env</code> (domyślnie z <code>.env.example</code>:{' '}
        <code>{role}-demo</code>).
      </p>
      <div className="field">
        <label htmlFor="login-name">Login</label>
        <input id="login-name" type="text" value={role} readOnly autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="login-pass">Hasło</label>
        <input id="login-pass" type="password" autoComplete="current-password" value={haslo} onChange={(e) => setHaslo(e.target.value)}
          aria-invalid={!!error} aria-describedby={error ? 'login-err' : undefined} />
        {error && <p id="login-err" className="field-error">{error}</p>}
      </div>
      <p className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Loguję…' : 'Zaloguj się'}</button>
      </p>
    </form>
  );
}
