// Wniosek o konto instytucji (MODEL_ROL v1.3 P1a, CR-TL-8): the institution applies itself; the account works only after
// an administrator approves it.
import { useState, type FormEvent } from 'react';
import { HttpError, requestAccount, type WniosekIn } from '../api/client';
import { PODSTAWA_LABEL, type PodstawaPublikacji } from '../api/types';
import { ErrorSummary, Req, RequiredNote } from '../components/form';
import { ErrorBox, Icon } from '../components/ui';
import { Link, usePageTitle } from '../router';

const EMPTY = { nazwa_instytucji: '', regon: '', podstawa: '' as PodstawaPublikacji | '', email_sluzbowy: '', telefon: '', login: '', haslo: '', haslo2: '' };
const IDS: Record<string, string> = {
  nazwa_instytucji: 'wn-nazwa', regon: 'wn-regon', podstawa: 'wn-podstawa-wlasciciel', email_sluzbowy: 'wn-email', telefon: 'wn-tel',
  login: 'wn-login', haslo: 'wn-haslo', haslo2: 'wn-haslo2',
};
const PODSTAWY: [PodstawaPublikacji, string][] = [
  ['wlasciciel', 'instytucja jest właścicielem AED'], ['zarzadca', 'zarządza AED na podstawie umowy z właścicielem'],
  ['weryfikujacy', 'sprawdza AED na miejscu (np. fundacja) i odpowiada za te dane'],
];

function validate(f: typeof EMPTY): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.nazwa_instytucji.trim().length < 3) e.nazwa_instytucji = 'Wpisz pełną nazwę instytucji.';
  if (!/^\d{9}(\d{5})?$/.test(f.regon.trim())) e.regon = 'REGON ma 9 albo 14 cyfr.';
  if (!f.podstawa) e.podstawa = 'Wybierz podstawę publikacji.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email_sluzbowy.trim())) e.email_sluzbowy = 'Wpisz służbowy adres e-mail.';
  if (!/^\+?[\d\s-]{9,16}$/.test(f.telefon.trim())) e.telefon = 'Wpisz numer telefonu, np. +48 12 345 67 89.';
  if (!/^[\p{L}\p{N}._@+\- ]{3,60}$/u.test(f.login.trim())) e.login = 'Login: od 3 do 60 znaków – litery, cyfry, kropka, myślnik albo adres e-mail.';
  if (f.haslo.length < 10) e.haslo = 'Hasło musi mieć co najmniej 10 znaków.';
  else if (f.haslo !== f.haslo2) e.haslo2 = 'Hasła się różnią.';
  return e;
}

export function WniosekKonto() {
  usePageTitle('Wniosek o konto instytucji');
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  const [done, setDone] = useState(false);

  async function send(ev: FormEvent) {
    ev.preventDefault(); setFail(null);
    const e = validate(f);
    setErrors(e); setFocus((x) => x + 1);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const { haslo2: _skip, ...rest } = f;
      void _skip;
      await requestAccount({ ...rest, login: rest.login.trim(), podstawa: rest.podstawa as PodstawaPublikacji } as WniosekIn);
      setDone(true);
    } catch (ex) {
      if (ex instanceof HttpError && Object.keys(ex.fields).length) { setErrors(ex.fields); setFocus((x) => x + 1); }
      setFail(ex as Error);
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <>
        <h1 id="page-title">Wniosek wysłany</h1>
        <div className="callout callout--ok" role="status">
          <p className="callout__title"><Icon name="check" />Dziękujemy! Administrator sprawdzi instytucję i podstawę publikacji.</p>
          <p>Do tego czasu konto jest nieaktywne. Po zatwierdzeniu zalogujesz się loginem <code>{f.login.trim()}</code> i hasłem z wniosku.</p>
        </div>
        <p><Link to="/logowanie">Przejdź do logowania</Link></p>
      </>
    );
  }

  const input = (k: keyof typeof EMPTY, label: string, o: { type?: string; hint?: string; auto?: string; mode?: 'numeric' | 'tel' | 'email' } = {}) => {
    const id = IDS[k];
    const er = errors[k];
    return (
      <div className="field">
        <label htmlFor={id}>{label}<Req /></label>
        {o.hint && <p id={`${id}-hint`} className="hint">{o.hint}</p>}
        <input id={id} type={o.type ?? 'text'} required autoComplete={o.auto ?? 'off'} inputMode={o.mode} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
          aria-invalid={!!er} aria-describedby={[o.hint ? `${id}-hint` : '', er ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined} />
        {er && <p id={`${id}-err`} className="field-error">{er}</p>}
      </div>
    );
  };

  return (
    <>
      <h1 id="page-title">Wniosek o konto instytucji</h1>
      <p className="lead">Konto jest dla instytucji, która odpowiada za dane o AED: właściciela, zarządcy z umową albo podmiotu, który sprawdza AED na miejscu. Po zalogowaniu zgłosisz AED i przygotujesz pliki do publikacji w dane.gov.pl. Konto zacznie działać po sprawdzeniu przez administratora.</p>
      <form className="panel" onSubmit={send} noValidate aria-labelledby="wn-title">
        <h2 id="wn-title">Dane instytucji</h2>
        <RequiredNote />
        <ErrorSummary errors={errors} fieldIds={IDS} focusToken={focus} />
        {input('nazwa_instytucji', 'Pełna nazwa instytucji', { hint: 'Tak, jak w rejestrze REGON – np. Urząd Gminy Przykładowo.', auto: 'organization' })}
        {input('regon', 'REGON', { hint: '9 albo 14 cyfr.', mode: 'numeric' })}
        <fieldset className="field">
          <legend>Na jakiej podstawie publikujecie dane o AED?<Req /></legend>
          <div className="big-choices">
            {PODSTAWY.map(([v, h]) => (
              <label key={v} htmlFor={`wn-podstawa-${v}`}>
                <input id={`wn-podstawa-${v}`} type="radio" name="wn-podstawa" required checked={f.podstawa === v} onChange={() => setF({ ...f, podstawa: v })} aria-invalid={!!errors.podstawa} />
                <span>{PODSTAWA_LABEL[v][0].toUpperCase() + PODSTAWA_LABEL[v].slice(1)}<span className="hint"> – {h}</span></span>
              </label>
            ))}
          </div>
          {errors.podstawa && <p className="field-error">{errors.podstawa}</p>}
        </fieldset>
        {input('email_sluzbowy', 'Służbowy e-mail', { type: 'email', hint: 'Najlepiej w domenie instytucji.', auto: 'email', mode: 'email' })}
        {input('telefon', 'Telefon kontaktowy', { type: 'tel', auto: 'tel', mode: 'tel' })}
        <h2>Dane logowania</h2>
        {input('login', 'Login', { hint: 'Dowolny, np. „UG Przykładowo” albo służbowy e-mail. Wielkość liter nie ma znaczenia.', auto: 'username' })}
        {input('haslo', 'Hasło', { type: 'password', hint: 'Co najmniej 10 znaków.', auto: 'new-password' })}
        {input('haslo2', 'Powtórz hasło', { type: 'password', auto: 'new-password' })}
        {fail && <ErrorBox error={fail} />}
        <p className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Wysyłam…' : 'Wyślij wniosek'}</button>
          <Link to="/logowanie">Mam już konto – zaloguj się</Link>
        </p>
      </form>
    </>
  );
}
