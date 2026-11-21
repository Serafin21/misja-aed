import type { ReactNode } from 'react';
import type { AedView } from '../api/types';
import { availableNow, label } from '../lib/format';
import { dataLabel } from '../lib/dataState';

/** Availability never relies on colour alone: icon + text (WCAG 1.4.1). */
export function AvailabilityBadge({ aed }: { aed: AedView }) {
  const v = availableNow(aed);
  if (aed.status_urzadzenia === 'niesprawny' || aed.status_urzadzenia === 'w_serwisie') {
    return <span className="badge badge--no"><Icon name="x" />Urządzenie {label('status_urzadzenia', aed.status_urzadzenia)}</span>;
  }
  if (aed.dostep === 'prywatny') {
    return <span className="badge badge--no"><Icon name="lock" />Tylko dla uprawnionych</span>;
  }
  if (v === true) return <span className="badge badge--ok"><Icon name="check" />Dostępne teraz</span>;
  if (v === false) return <span className="badge badge--no"><Icon name="clock" />Teraz zamknięte</span>;
  return <span className="badge badge--unknown"><Icon name="question" />Sprawdź godziny na miejscu</span>;
}

/** CR-TL-1: "Dane z MM.RRRR" / "Dane nieaktualne" – icon + text; the full date is in the title and for screen readers. */
export function DataBadge({ aed }: { aed: Pick<AedView, 'data_weryfikacji' | 'stan_danych'> }) {
  const d = dataLabel(aed);
  return (
    <span className={`badge ${d.state === 'aktualne' ? 'badge--fresh' : 'badge--stale'}`} title={d.long}>
      <Icon name={d.state === 'aktualne' ? 'check' : 'clock'} />
      <span aria-hidden="true">{d.short}</span><span className="visually-hidden">{d.long}</span>
    </span>
  );
}

export function LockedCabinet({ aed, compact = false }: { aed: AedView; compact?: boolean }) {
  if (!aed.szafka_zamknieta) return null;
  return (
    <div className={`callout callout--warn${compact ? ' callout--compact' : ''}`} role="note">
      <p className="callout__title"><Icon name="lock" />Szafka jest zamknięta</p>
      <p>{aed.instrukcja_dostepu ?? 'Nie wiemy, jak otworzyć szafkę. Zapytaj obsługę budynku albo dyspozytora 112.'}</p>
    </div>
  );
}


export function Loading({ text = 'Wczytuję dane…' }: { text?: string }) {
  return <p className="loading" role="status">{text}</p>;
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="callout callout--error" role="alert">
      <p className="callout__title">Nie udało się wczytać danych</p>
      <p>{error.message}</p>
      {onRetry && <button type="button" className="btn btn--secondary" onClick={onRetry}>Spróbuj ponownie</button>}
    </div>
  );
}

/** Link opened in a new window – always announces it (visible note). */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children} <span className="ext-note">(otwiera się w nowym oknie)</span>
    </a>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}

const PATHS: Record<string, string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  question: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  locate: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  car: 'M3 13l2-5h14l2 5v5h-3v-2H6v2H3zM7 13h.01M17 13h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
};

export function Icon({ name, className }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? ''} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
