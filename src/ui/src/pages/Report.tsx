// E4 – Zgłoś AED (resident): one question per screen, 4 steps. No personal data; goes to moderation.
// Hours, cabinet and an optional photo go as separate fields (HANDOFF A #8); the description also says them in words.
import { useState } from 'react';
import { reportAed } from '../api/client';
import { AedWizard, citizenDescription, emptyDraft, type AedDraft } from '../components/AedWizard';
import { PhotoField } from '../components/PhotoField';
import { hoursToOpeningHours } from '../lib/hoursBuilder';
import { ErrorBox, Icon } from '../components/ui';
import { Link, useQueryParam, usePageTitle } from '../router';

export function Report() {
  usePageTitle('Zgłoś AED');
  const aedId = useQueryParam('aed');
  const [draft, setDraft] = useState<AedDraft>(() => ({ ...emptyDraft(), opis: aedId ? `Problem z AED ${aedId}: ` : '' }));
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  async function send() {
    setBusy(true); setFail(null);
    try {
      const oh = hoursToOpeningHours(draft.hours);
      await reportAed(draft.lat!, draft.lon!, citizenDescription(draft), {
        ...(oh ? { godziny_dostepnosci: oh } : {}),
        ...(draft.cabinet === 'tak' ? { szafka_zamknieta: true, ...(draft.access.trim() ? { instrukcja_dostepu: draft.access.trim() } : {}) } : {}),
        ...(draft.cabinet === 'nie' ? { szafka_zamknieta: false } : {}),
        ...(photo ? { zdjecie: photo } : {}),
      });
      setDone(true);
    } catch (ex) { setFail(ex as Error); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <>
        <h1 id="page-title">Dziękujemy!</h1>
        <div className="callout callout--ok" role="status">
          <p className="callout__title"><Icon name="check" />Dziękujemy! Sprawdzimy zgłoszenie i dodamy AED do mapy.</p>
        </div>
        <p className="form-actions">
          <button type="button" className="btn btn--primary" onClick={() => { setDraft(emptyDraft()); setPhoto(null); setStep(1); setDone(false); }}>Zgłoś kolejne AED</button>
          <Link to="/">Wróć na stronę główną</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 id="page-title">Zgłoś AED, które widzisz</h1>
      <p className="lead">Widzisz defibrylator, którego nie ma na mapie? Odpowiedz na 4 krótkie pytania. Nie podawaj imienia, nazwiska ani telefonu.</p>
      <AedWizard variant="citizen" draft={draft} setDraft={setDraft} step={step} setStep={setStep} onSubmit={send}
        submitLabel="Wyślij zgłoszenie" busy={busy} failure={fail && <ErrorBox error={fail} />}
        beforeSubmit={<PhotoField value={photo} onChange={setPhoto} />} />
    </>
  );
}
