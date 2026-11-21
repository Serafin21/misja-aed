// Form conventions (gov.pl style): required fields marked "*", note "* Pola obowiązkowe" under the form title,
// validation when a field loses focus, and after submit an error summary at the top (role="alert", focused, links to fields).
import { useEffect, useRef, useState } from 'react';

/** Required marker after a label. The control itself carries `required` / `aria-required`. */
export function Req() {
  return <span className="req" aria-hidden="true"> *</span>;
}

export function RequiredNote() {
  return <p className="req-note"><span className="req" aria-hidden="true">*</span> Pola obowiązkowe</p>;
}

type Validators = Record<string, () => string>;

/** Field errors: `check(name)` on blur, `validateAll()` on submit (returns true when valid). */
export function useValidation(validators: Validators) {
  const ref = useRef(validators);
  ref.current = validators;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [token, setToken] = useState(0);

  const check = (name: string) => setErrors((prev) => {
    const msg = ref.current[name]?.() ?? '';
    const next = { ...prev };
    if (msg) next[name] = msg; else delete next[name];
    return next;
  });

  const validateAll = (): boolean => {
    const next: Record<string, string> = {};
    for (const [k, fn] of Object.entries(ref.current)) { const m = fn(); if (m) next[k] = m; }
    setErrors(next);
    setSubmitted(true);
    if (Object.keys(next).length) { setToken((t) => t + 1); return false; }
    return true;
  };

  /** Errors returned by the server (422 `fields`) – shown like client errors. */
  const showServerErrors = (fields: Record<string, string>) => {
    setErrors(fields);
    setSubmitted(true);
    setToken((t) => t + 1);
  };

  const reset = () => { setErrors({}); setSubmitted(false); };

  return { errors, check, validateAll, showServerErrors, reset, summary: submitted ? errors : {}, focusToken: token };
}

function plural(n: number) {
  if (n === 1) return '1 błąd';
  const last = n % 10, last2 = n % 100;
  return `${n} ${last >= 2 && last <= 4 && (last2 < 12 || last2 > 14) ? 'błędy' : 'błędów'}`;
}

/** Error summary shown after submit; receives focus so screen readers and keyboard users start here. */
export function ErrorSummary({ errors, fieldIds, focusToken, title }: { errors: Record<string, string>; fieldIds: Record<string, string>; focusToken: number; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focusToken) ref.current?.focus(); }, [focusToken]);
  const list = Object.entries(errors).filter(([, v]) => v);
  if (!list.length) return null;
  return (
    <div ref={ref} className="callout callout--error error-summary" role="alert" tabIndex={-1}>
      <p className="callout__title">{title ?? `Formularz zawiera ${plural(list.length)}`}</p>
      <ul>
        {list.map(([k, v]) => (
          <li key={k}>
            {fieldIds[k]
              ? <a href={`#${fieldIds[k]}`} onClick={(e) => { e.preventDefault(); document.getElementById(fieldIds[k])?.focus(); }}>{v}</a>
              : v}
          </li>
        ))}
      </ul>
    </div>
  );
}
