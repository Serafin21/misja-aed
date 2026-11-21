// Demo login (dysponent / moderator). After POST /auth/login every request carries Authorization: Bearer <token>.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getSession, login, logout, onSessionChange, type Role, type Session } from '../api/client';
import { ErrorSummary, Req, RequiredNote, useValidation } from './form';

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
  const [busy, setBusy] = useState(false);
  const v = useValidation({ haslo: () => (haslo ? '' : 'Wpisz hasło.') });
  const error = v.errors.haslo ?? '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.validateAll()) return;
    setBusy(true);
    try { await login(role, haslo); }
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
        Prototyp ma dwa konta demonstracyjne. Hasła ustawia plik <code>.env</code> (domyślnie z <code>.env.example</code>:{' '}
        <code>{role}-demo</code>).
      </p>
      <div className="field">
        <label htmlFor="login-name">Login</label>
        <input id="login-name" type="text" value={role} readOnly autoComplete="username" />
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
