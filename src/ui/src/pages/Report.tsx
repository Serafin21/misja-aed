// E4 – Zgłoś AED: point on the map or from geolocation + description; no personal data; goes to moderation.
import { useState, type FormEvent } from 'react';
import { reportAed } from '../api/client';
import { MapView } from '../components/MapView';
import { ErrorBox, Icon } from '../components/ui';
import { Link, useQueryParam, usePageTitle } from '../router';

export function Report() {
  usePageTitle('Zgłoś AED');
  const aedId = useQueryParam('aed');
  const [pt, setPt] = useState<{ lat: number; lon: number } | null>(null);
  const [opis, setOpis] = useState(aedId ? `Problem z AED ${aedId}: ` : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!pt) er.pt = 'Wskaż miejsce: użyj lokalizacji, kliknij na mapie albo wpisz współrzędne.';
    else if (pt.lat < 49 || pt.lat > 54.9 || pt.lon < 14.1 || pt.lon > 24.2) er.pt = 'Punkt musi leżeć w Polsce.';
    if (opis.trim().length < 10) er.opis = 'Opisz miejsce w kilku słowach (min. 10 znaków), np. „apteka przy rynku, za ladą”.';
    setErrors(er);
    if (Object.keys(er).length) { document.getElementById(er.pt ? 'rep-lat' : 'rep-opis')?.focus(); return; }
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
        <p className="form-actions"><Link to="/" className="btn btn--primary">Wróć do mapy</Link><button type="button" className="btn btn--secondary" onClick={() => { setDone(null); setPt(null); setOpis(''); }}>Zgłoś kolejne</button></p>
      </>
    );
  }

  const errCount = Object.keys(errors).length;
  return (
    <>
      <h1 id="page-title">Zgłoś AED</h1>
      <p className="lead">Widzisz defibrylator, którego nie ma na mapie, albo coś się nie zgadza? Daj znać. Nie podawaj imienia, nazwiska ani telefonu.</p>
      <form onSubmit={submit} noValidate>
        {errCount > 0 && (
          <div className="callout callout--error" role="alert">
            <p className="callout__title">Popraw {errCount === 1 ? '1 pole' : `${errCount} pola`}</p>
            <ul>{Object.entries(errors).map(([k, v]) => <li key={k}><a href={k === 'pt' ? '#rep-lat' : '#rep-opis'}>{v}</a></li>)}</ul>
          </div>
        )}
        <fieldset>
          <legend>Gdzie jest AED? <span className="req">(wymagane)</span></legend>
          <p className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn--secondary" onClick={locate}><Icon name="locate" />Użyj mojej lokalizacji</button>
          </p>
          <p role="status" className="hint">{geoMsg}</p>
          <MapView items={[]} picked={pt} onPick={(p) => { setPt(p); setGeoMsg('Ustawiono punkt kliknięty na mapie.'); }} label="Mapa: kliknij miejsce, w którym jest AED. Możesz też wpisać współrzędne poniżej." height={320} cluster={false} />
          <div className="filters__grid">
            <div className="field">
              <label htmlFor="rep-lat">Szerokość geograficzna</label>
              <input id="rep-lat" type="text" inputMode="decimal" value={pt?.lat ?? ''} onChange={(e) => setPt({ lat: Number(e.target.value.replace(',', '.')), lon: pt?.lon ?? 0 })} aria-invalid={!!errors.pt} aria-describedby={errors.pt ? 'err-pt' : undefined} />
            </div>
            <div className="field">
              <label htmlFor="rep-lon">Długość geograficzna</label>
              <input id="rep-lon" type="text" inputMode="decimal" value={pt?.lon ?? ''} onChange={(e) => setPt({ lat: pt?.lat ?? 0, lon: Number(e.target.value.replace(',', '.')) })} aria-invalid={!!errors.pt} />
            </div>
          </div>
          {errors.pt && <p id="err-pt" className="field-error">{errors.pt}</p>}
        </fieldset>
        <div className="field">
          <label htmlFor="rep-opis">Opis miejsca <span className="req">(wymagane)</span></label>
          <p id="rep-opis-hint" className="hint">Np. „AED w aptece przy rynku, za ladą, czynne pn–sb”. Maks. 500 znaków.</p>
          <textarea id="rep-opis" maxLength={500} rows={4} value={opis} onChange={(e) => setOpis(e.target.value)} aria-invalid={!!errors.opis} aria-describedby={`rep-opis-hint${errors.opis ? ' err-opis' : ''}`} />
          {errors.opis && <p id="err-opis" className="field-error">{errors.opis}</p>}
        </div>
        {fail && <ErrorBox error={fail} />}
        <p className="form-actions"><button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Wysyłam…' : 'Wyślij zgłoszenie'}</button></p>
      </form>
    </>
  );
}
