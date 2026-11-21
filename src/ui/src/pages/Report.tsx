// E4 – Zgłoś AED: point on the map or from geolocation + description; no personal data; goes to moderation.
import { useState, type FormEvent } from 'react';
import { reportAed } from '../api/client';
import { MapView } from '../components/MapView';
import { ErrorBox, Icon } from '../components/ui';
import { ErrorSummary, Req, RequiredNote, useValidation } from '../components/form';
import { Link, useQueryParam, usePageTitle } from '../router';

export function Report() {
  usePageTitle('Zgłoś AED');
  const aedId = useQueryParam('aed');
  const [pt, setPt] = useState<{ lat: number; lon: number } | null>(null);
  const [opis, setOpis] = useState(aedId ? `Problem z AED ${aedId}: ` : '');
  const [busy, setBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [fail, setFail] = useState<Error | null>(null);

  function locate() {
    if (!('geolocation' in navigator)) { setGeoMsg('Przeglądarka nie udostępnia lokalizacji. Kliknij punkt na mapie.'); return; }
    setGeoMsg('Ustalam lokalizację…');
    navigator.geolocation.getCurrentPosition(
      (g) => { setPt({ lat: +g.coords.latitude.toFixed(6), lon: +g.coords.longitude.toFixed(6) }); setGeoMsg('Ustawiono punkt w Twojej lokalizacji.'); },
      () => setGeoMsg('Nie udało się ustalić lokalizacji. Kliknij punkt na mapie albo wpisz współrzędne.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const v = useValidation({
    pt: () => (!pt ? 'Wskaż miejsce: użyj lokalizacji, kliknij na mapie albo wpisz współrzędne.'
      : (pt.lat < 49 || pt.lat > 54.9 || pt.lon < 14.1 || pt.lon > 24.2) ? 'Punkt musi leżeć w Polsce (szerokość 49–54,9, długość 14,1–24,2).' : ''),
    opis: () => (opis.trim().length < 10 ? 'Opisz miejsce w kilku słowach (min. 10 znaków), np. „apteka przy rynku, za ladą”.' : ''),
  });
  const errors = v.errors;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.validateAll()) return;
    setBusy(true); setFail(null);
    try {
      const r = await reportAed(pt!.lat, pt!.lon, opis.trim());
      setDone(r.id);
    } catch (ex) { setFail(ex as Error); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <>
        <h1 id="page-title">Dziękujemy za zgłoszenie</h1>
        <div className="callout callout--ok" role="status">
          <p className="callout__title"><Icon name="check" />Zgłoszenie {done} trafi do weryfikacji</p>
          <p>Moderator albo dysponent sprawdzi je, zanim AED pojawi się w zbiorze.</p>
        </div>
        <p className="form-actions"><button type="button" className="btn btn--secondary" onClick={() => { setDone(null); setPt(null); setOpis(''); v.reset(); }}>Zgłoś kolejne</button><Link to="/">Wróć do wyszukiwania AED</Link></p>
      </>
    );
  }

  return (
    <>
      <h1 id="page-title">Zgłoś AED</h1>
      <p className="lead">Widzisz defibrylator, którego nie ma na mapie, albo coś się nie zgadza? Daj znać. Nie podawaj imienia, nazwiska ani telefonu.</p>
      <form onSubmit={submit} noValidate aria-labelledby="page-title">
        <RequiredNote />
        <ErrorSummary errors={v.summary} fieldIds={{ pt: 'rep-lat', opis: 'rep-opis' }} focusToken={v.focusToken} />
        <fieldset>
          <legend>Gdzie jest AED?<Req /></legend>
          <p className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn--secondary" onClick={locate}>Użyj mojej lokalizacji</button>
          </p>
          <p role="status" className="hint">{geoMsg}</p>
          <MapView items={[]} picked={pt} onPick={(p) => { setPt(p); setGeoMsg('Ustawiono punkt kliknięty na mapie.'); }} label="Mapa: kliknij miejsce, w którym jest AED. Możesz też wpisać współrzędne poniżej." height={320} cluster={false} />
          <div className="filters__grid">
            <div className="field">
              <label htmlFor="rep-lat">Szerokość geograficzna</label>
              <input id="rep-lat" type="text" inputMode="decimal" autoComplete="off" required onBlur={() => v.check('pt')} value={pt?.lat ?? ''} onChange={(e) => setPt({ lat: Number(e.target.value.replace(',', '.')), lon: pt?.lon ?? 0 })} aria-invalid={!!errors.pt} aria-describedby={errors.pt ? 'err-pt' : undefined} />
            </div>
            <div className="field">
              <label htmlFor="rep-lon">Długość geograficzna</label>
              <input id="rep-lon" type="text" inputMode="decimal" autoComplete="off" required onBlur={() => v.check('pt')} value={pt?.lon ?? ''} onChange={(e) => setPt({ lat: pt?.lat ?? 0, lon: Number(e.target.value.replace(',', '.')) })} aria-invalid={!!errors.pt} />
            </div>
          </div>
          {errors.pt && <p id="err-pt" className="field-error">{errors.pt}</p>}
        </fieldset>
        <div className="field">
          <label htmlFor="rep-opis">Opis miejsca<Req /></label>
          <p id="rep-opis-hint" className="hint">Np. „AED w aptece przy rynku, za ladą, czynne pn–sb”. Maks. 500 znaków.</p>
          <textarea id="rep-opis" required autoComplete="off" onBlur={() => v.check('opis')} maxLength={500} rows={4} value={opis} onChange={(e) => setOpis(e.target.value)} aria-invalid={!!errors.opis} aria-describedby={`rep-opis-hint${errors.opis ? ' err-opis' : ''}`} />
          {errors.opis && <p id="err-opis" className="field-error">{errors.opis}</p>}
        </div>
        {fail && <ErrorBox error={fail} />}
        <p className="form-actions"><button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Wysyłam…' : 'Wyślij zgłoszenie'}</button></p>
      </form>
    </>
  );
}
