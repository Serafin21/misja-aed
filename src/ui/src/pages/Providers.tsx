// E5 – Dla dysponentów: 1) szablon, 2) wgraj plik, 3) mapowanie, 4) raport błędów, 5) zatwierdź → odznaka.
import { useRef, useState, type FormEvent } from 'react';
import { approveImport, isMockMode, templateUrl, uploadAndValidate } from '../api/client';
import type { RaportWalidacji, WynikImportu } from '../api/types';
import { BRAND_NAME, BRAND_SLOGAN, heartRects } from '../components/Brand';
import { RequireLogin } from '../components/Auth';
import { ErrorBox, Icon } from '../components/ui';
import { dictValues, label } from '../lib/format';
import { FIELDS, fieldLabel, templateCsv } from '../lib/fields';
import { usePageTitle } from '../router';

const FIELD_IDS: Record<string, string> = { owner: 'up-owner', ownerType: 'up-owner-type', file: 'up-file' };

const STEPS = ['Pobierz szablon', 'Wgraj plik', 'Sprawdź kolumny', 'Popraw błędy', 'Zatwierdź'];

export function Providers() {
  usePageTitle('Dla dysponentów AED');
  const [step, setStep] = useState(0);
  const [rep, setRep] = useState<RaportWalidacji | null>(null);
  const [result, setResult] = useState<WynikImportu | null>(null);
  const [owner, setOwner] = useState('');
  const headRef = useRef<HTMLHeadingElement>(null);

  const go = (n: number) => { setStep(n); setTimeout(() => headRef.current?.focus(), 0); };

  return (
    <>
      <h1 id="page-title">Dla dysponentów AED</h1>
      <p className="lead">Masz defibrylator w urzędzie, szkole, firmie albo w wozie OSP? Udostępnij dane w 5 krokach. Szablon pobierzesz bez logowania. Do wgrania pliku w prototypie służy konto demonstracyjne dysponenta.</p>

      <nav aria-label="Kroki importu" className="stepper">
        <ol>
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="stepper__n" aria-hidden="true">{i < step ? '✓' : i + 1}</span>
              <span>{s}{i < step && <span className="visually-hidden"> (zrobione)</span>}</span>
            </li>
          ))}
        </ol>
      </nav>

      <section className="panel" aria-labelledby="step-title">
        <h2 id="step-title" ref={headRef} tabIndex={-1}>Krok {step + 1} z 5: {STEPS[step]}</h2>
        {step === 0 && <StepTemplate onNext={() => go(1)} />}
        {step > 0 && (
          <RequireLogin role="dysponent" roles={['dysponent', 'moderator']}>
            {step === 1 && <StepUpload owner={owner} setOwner={setOwner} onDone={(r) => { setRep(r); go(2); }} onBack={() => go(0)} />}
            {step === 2 && rep && <StepMapping rep={rep} onNext={() => go(3)} onBack={() => go(1)} />}
            {step === 3 && rep && <StepReport rep={rep} onNext={() => go(4)} onBack={() => go(1)} />}
            {step === 4 && rep && <StepApprove rep={rep} owner={owner} result={result} setResult={setResult} onBack={() => go(3)} />}
          </RequireLogin>
        )}
      </section>
    </>
  );
}

function StepTemplate({ onNext }: { onNext: () => void }) {
  const csvHref = isMockMode() ? `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv())}` : templateUrl('csv');
  const required = FIELDS.filter((f) => f.obowiazkowosc === 'wymagane');
  return (
    <>
      <p>Szablon to tabela z {FIELDS.length} kolumnami wzorcowego zakresu danych. {required.length} z nich jest wymaganych. Możesz też wgrać własny plik – w kroku 3 dopasujemy kolumny.</p>
      <p className="form-actions">
        <a className="btn btn--primary" href={csvHref} download="szablon_aed.csv"><Icon name="download" />Szablon CSV</a>
        <a className="btn btn--secondary" href={templateUrl('xlsx')} download><Icon name="download" />Szablon XLSX</a>
      </p>
      <details className="details">
        <summary>Pola wymagane ({required.length})</summary>
        <ul className="cols">{required.map((f) => <li key={f.nazwa_pola}><strong>{f.etykieta}</strong> <code>{f.nazwa_pola}</code></li>)}</ul>
      </details>
      <details className="details">
        <summary>Zasady formatu</summary>
        <ul>
          <li>Wartości logiczne: <code>true</code> albo <code>false</code> (rozpoznamy też TAK/NIE).</li>
          <li>Liczby z kropką dziesiętną, bez spacji: <code>52.243700</code>.</li>
          <li>Daty: <code>rrrr-mm-dd</code>, np. <code>2026-11-21</code>.</li>
          <li>Godziny dostępności: np. <code>Mo-Fr 08:00-16:00</code> albo <code>24/7</code> (rozpoznamy też „pn-pt 8-16”, „całodobowo”).</li>
          <li>Jedna wartość w jednym polu, adres w osobnych kolumnach.</li>
        </ul>
      </details>
      <p className="form-actions"><button type="button" className="btn btn--primary" onClick={onNext}>Dalej: wgraj plik <Icon name="arrow" /></button></p>
    </>
  );
}

function StepUpload({ owner, setOwner, onDone, onBack }: { owner: string; setOwner: (s: string) => void; onDone: (r: RaportWalidacji) => void; onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [lic, setLic] = useState('CC0-1.0');
  const [ownerType, setOwnerType] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!owner.trim()) er.owner = 'Wpisz nazwę instytucji lub firmy.';
    if (!ownerType) er.ownerType = 'Wybierz rodzaj dysponenta.';
    if (!file) er.file = 'Wybierz plik CSV, XLSX, JSON albo GeoJSON.';
    else if (!/\.(csv|xlsx|json|geojson)$/i.test(file.name)) er.file = 'Ten format nie jest obsługiwany. Wybierz CSV, XLSX, JSON albo GeoJSON.';
    else if (file.size > 20 * 1024 * 1024) er.file = 'Plik jest większy niż 20 MB.';
    setErrors(er);
    if (Object.keys(er).length) { document.getElementById(er.owner ? 'up-owner' : er.ownerType ? 'up-owner-type' : 'up-file')?.focus(); return; }
    setBusy(true); setFail(null);
    try {
      const code = `dysponent:${owner.trim().toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      onDone(await uploadAndValidate(file!, { kodZrodla: code, licencja: lic, dysponentNazwa: owner.trim(), dysponentTyp: ownerType }));
    } catch (ex) { setFail(ex as Error); } finally { setBusy(false); }
  }

  const errCount = Object.keys(errors).length;
  return (
    <form onSubmit={submit} noValidate>
      {errCount > 0 && (
        <div className="callout callout--error" role="alert">
          <p className="callout__title">Popraw {errCount === 1 ? '1 pole' : `${errCount} pola`}</p>
          <ul>{Object.entries(errors).map(([k, v]) => <li key={k}><a href={`#${FIELD_IDS[k] ?? 'up-file'}`}>{v}</a></li>)}</ul>
        </div>
      )}
      <div className="field">
        <label htmlFor="up-owner">Nazwa dysponenta <span className="req">(wymagane)</span></label>
        <input id="up-owner" type="text" autoComplete="organization" value={owner} onChange={(e) => setOwner(e.target.value)} aria-invalid={!!errors.owner} aria-describedby={errors.owner ? 'err-owner' : undefined} />
        {errors.owner && <p id="err-owner" className="field-error">{errors.owner}</p>}
      </div>
      <div className="field">
        <label htmlFor="up-owner-type">Rodzaj dysponenta <span className="req">(wymagane)</span></label>
        <p id="up-owner-type-hint" className="hint">Trafi do każdego wiersza, w którym plik nie ma tej kolumny.</p>
        <select id="up-owner-type" value={ownerType} onChange={(e) => setOwnerType(e.target.value)} aria-invalid={!!errors.ownerType}
          aria-describedby={`up-owner-type-hint${errors.ownerType ? ' err-owner-type' : ''}`}>
          <option value="">– wybierz –</option>
          {dictValues('dysponent_typ').map((d) => <option key={d.wartosc} value={d.wartosc}>{label('dysponent_typ', d.wartosc)}</option>)}
        </select>
        {errors.ownerType && <p id="err-owner-type" className="field-error">{errors.ownerType}</p>}
      </div>
      <div className="field">
        <label htmlFor="up-file">Plik z danymi <span className="req">(wymagane)</span></label>
        <p id="up-file-hint" className="hint">CSV, XLSX, JSON lub GeoJSON, do 20 MB. Rozpoznamy separator, kodowanie i przecinek dziesiętny. Do testu: <code>data/sample/zrodlo_gmina_przyklad.csv</code>.</p>
        <input id="up-file" type="file" accept=".csv,.xlsx,.json,.geojson" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-invalid={!!errors.file} aria-describedby={`up-file-hint${errors.file ? ' err-file' : ''}`} />
        {errors.file && <p id="err-file" className="field-error">{errors.file}</p>}
      </div>
      <fieldset>
        <legend>Licencja, na której udostępniasz dane</legend>
        <div className="choices">
          {dictValues('licencja').filter((l) => l.wartosc !== 'ODbL-1.0').map((l) => (
            <label key={l.wartosc}><input type="radio" name="lic" checked={lic === l.wartosc} onChange={() => setLic(l.wartosc)} /> {l.wartosc} – {l.znaczenie}</label>
          ))}
        </div>
      </fieldset>
      {fail && <ErrorBox error={fail} />}
      <p className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onBack}>Wstecz</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Sprawdzam plik…' : 'Wgraj i sprawdź'}</button>
      </p>
      {busy && <p role="status">Sprawdzam plik…</p>}
    </form>
  );
}

function StepMapping({ rep, onNext, onBack }: { rep: RaportWalidacji; onNext: () => void; onBack: () => void }) {
  const [map, setMap] = useState(rep.mapowanie);
  const fmt = rep.wykryty_format;
  return (
    <>
      <p>
        Plik <strong>{rep.plik}</strong>: {rep.wiersze} wierszy. Wykryto: separator <code>{fmt.separator ?? '?'}</code>, kodowanie {fmt.kodowanie ?? '?'}
        {fmt.przecinek_dziesietny ? ', przecinek dziesiętny (zamienimy na kropkę)' : ''}.
      </p>
      <p>Sprawdź, czy kolumny z Twojego pliku trafiają do właściwych pól. Jedna kolumna może wypełnić kilka pól, np. adres.</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-map">
        <table>
          <caption id="cap-map">Dopasowanie kolumn</caption>
          <thead><tr><th scope="col">Kolumna w pliku</th><th scope="col">Pole we wzorcowym zakresie</th></tr></thead>
          <tbody>
            {Object.entries(map).map(([col, target], i) => (
              <tr key={col}>
                <th scope="row">{col}</th>
                <td>
                  {Array.isArray(target) ? (
                    <span>dzielimy na: {target.map(fieldLabel).join(', ')}</span>
                  ) : (
                    <>
                      <label htmlFor={`map-${i}`} className="visually-hidden">Pole dla kolumny {col}</label>
                      <select id={`map-${i}`} value={target} onChange={(e) => setMap({ ...map, [col]: e.target.value })}>
                        <option value="">– pomiń kolumnę –</option>
                        {FIELDS.map((f) => <option key={f.nazwa_pola} value={f.nazwa_pola}>{f.etykieta} ({f.nazwa_pola})</option>)}
                      </select>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onBack}>Wstecz</button>
        <button type="button" className="btn btn--primary" onClick={onNext}>Dalej: raport <Icon name="arrow" /></button>
      </p>
    </>
  );
}

function StepReport({ rep, onNext, onBack }: { rep: RaportWalidacji; onNext: () => void; onBack: () => void }) {
  return (
    <>
      <ul className="stats" aria-label="Podsumowanie walidacji">
        <li className="stat stat--ok"><span className="stat__n">{rep.poprawne}</span> poprawnych wierszy</li>
        <li className="stat stat--warn"><span className="stat__n">{rep.z_ostrzezeniami}</span> z ostrzeżeniami</li>
        <li className="stat stat--err"><span className="stat__n">{rep.bledy}</span> z błędami</li>
        <li className="stat"><span className="stat__n">{rep.duplikaty.length}</span> duplikatów</li>
      </ul>
      {rep.problemy.length > 0 && (
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-prob">
          <table>
            <caption id="cap-prob">Co poprawiliśmy lub co musisz poprawić</caption>
            <thead><tr><th scope="col">Wiersz</th><th scope="col">Pole</th><th scope="col">Rodzaj</th><th scope="col">Było</th><th scope="col">Propozycja</th><th scope="col">Wyjaśnienie</th></tr></thead>
            <tbody>
              {rep.problemy.map((p, i) => (
                <tr key={i}>
                  <td>{p.wiersz}</td><td>{fieldLabel(p.pole)}</td>
                  <td>{p.poziom === 'blad' ? '× błąd' : '! ostrzeżenie'}</td>
                  <td><code>{p.wartosc_zrodlowa ?? '–'}</code></td><td><code>{p.propozycja ?? '–'}</code></td><td>{p.komunikat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rep.brakujace_pola_wymagane.length > 0 && (
        <div className="callout callout--warn" role="note">
          <p className="callout__title">Brakuje kolumn z polami wymaganymi</p>
          <p>{rep.brakujace_pola_wymagane.map(fieldLabel).join(', ')}. Uzupełnimy je wartościami domyślnymi do weryfikacji – możesz je dodać w pliku i wgrać ponownie.</p>
        </div>
      )}
      {rep.duplikaty.length > 0 && (
        <>
          <h3>Te AED już są w zbiorze</h3>
          <ul>
            {rep.duplikaty.map((d) => (
              <li key={d.wiersz + d.id_aed}>Wiersz {d.wiersz} = <code>{d.id_aed}</code> ze źródła {d.zrodlo} ({d.odleglosc_m.toLocaleString('pl-PL')} m): {d.decyzja}.</li>
            ))}
          </ul>
        </>
      )}
      <p className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onBack}>Wgraj poprawiony plik</button>
        <button type="button" className="btn btn--primary" onClick={onNext}>Dalej: zatwierdź <Icon name="arrow" /></button>
      </p>
    </>
  );
}

function StepApprove({ rep, owner, result, setResult, onBack }: { rep: RaportWalidacji; owner: string; result: WynikImportu | null; setResult: (r: WynikImportu) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  async function approve() {
    setBusy(true); setFail(null);
    try { setResult(await approveImport(rep)); } catch (e) { setFail(e as Error); } finally { setBusy(false); }
  }
  if (result) {
    return (
      <div role="status">
        <div className="callout callout--ok">
          <p className="callout__title"><Icon name="check" />Dziękujemy! Dane zostały włączone do zbioru.</p>
          <p>Dodane: {result.dodane} · zaktualizowane: {result.zaktualizowane} · scalone z istniejącymi: {result.scalone} · odrzucone: {result.odrzucone}.</p>
        </div>
        <Badge owner={owner} />
      </div>
    );
  }
  return (
    <>
      <p>Po zatwierdzeniu {rep.poprawne} wierszy trafi do otwartego zbioru AED publikowanego w dane.gov.pl. Wiersze z błędami ({rep.bledy}) pominiemy.</p>
      {fail && <ErrorBox error={fail} />}
      <p className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onBack}>Wstecz</button>
        <button type="button" className="btn btn--primary" onClick={approve} disabled={busy}>{busy ? 'Zapisuję…' : 'Zatwierdź i opublikuj'}</button>
      </p>
    </>
  );
}

/** Badge for the provider. Campaign brand system from TL. */
function Badge({ owner }: { owner: string }) {
  const name = owner.trim() || 'Nasza instytucja';
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="220" viewBox="0 0 600 220" role="img" aria-label="${esc(name)} udostępnia dane o AED – ${BRAND_NAME}"><rect width="600" height="220" rx="24" fill="#1A7A50"/>${heartRects(40, 50, 24)}<text x="200" y="78" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">${BRAND_NAME}</text><text x="200" y="116" font-family="Arial, sans-serif" font-size="22" fill="#fff">Udostępniamy dane o naszych AED</text><text x="200" y="150" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#fff">${esc(name.slice(0, 36))}</text><text x="200" y="184" font-family="Arial, sans-serif" font-weight="600" font-size="17" fill="#EDF2EC">${BRAND_SLOGAN}</text></svg>`;
  const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    <section aria-labelledby="badge-title" className="badge-box">
      <h3 id="badge-title">Twoja odznaka</h3>
      <p>Pokaż na stronie lub przy wejściu, że Twoje AED jest na mapie.</p>
      <img src={href} alt={`Odznaka akcji ${BRAND_NAME}: ${name} udostępnia dane o swoich AED`} width={600} height={220} />
      <p><a className="btn btn--primary" href={href} download="odznaka_aed.svg"><Icon name="download" />Pobierz odznakę (SVG)</a></p>
    </section>
  );
}
