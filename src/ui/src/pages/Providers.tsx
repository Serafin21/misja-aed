// E5 – Dla instytucji. Start: two big choices – "Mam listę AED w pliku" / "Wpiszę AED ręcznie".
// File: template → drop zone with progress → only unrecognised columns → results in 3 groups → publish ready ones.
// Manual: the same 4-step wizard as E4 + institution data, a list, one publication at the end. Draft saved on the device.
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import {
  approveImport, getSession, confirmMapping, createAed, decideDuplicates, fixImportRows, HttpError, isMockMode, NotSupported, templateUrl, uploadFile,
  type ImportInfo,
} from '../api/client';
import type { RaportWalidacji, WynikImportu } from '../api/types';
import { RequireLogin, useSession } from '../components/Auth';
import { AedWizard, draftToRecord, emptyDraft, type AedDraft } from '../components/AedWizard';
import { BRAND_CTA, BRAND_NAME, BRAND_SLOGAN, heartRects, LogoMark } from '../components/Brand';
import { ErrorSummary, Req, RequiredNote, useValidation } from '../components/form';
import { ErrorBox, Icon } from '../components/ui';
import { dictValues, label } from '../lib/format';
import { FIELDS, fieldLabel, templateCsv } from '../lib/fields';
import { hoursInWords } from '../lib/hoursBuilder';
import { Link, usePageTitle } from '../router';

// ---------- institution data + local draft ----------
interface Inst { owner: string; ownerType: string; lic: string }
interface Draft { inst: Inst; list: AedDraft[]; current: AedDraft; step: number }
const DRAFT_KEY = 'aed.szkic.instytucja';
const emptyInst = (): Inst => ({ owner: '', ownerType: '', lic: 'CC0-1.0' });
function loadDraft(): Draft | null {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? (JSON.parse(raw) as Draft) : null; } catch { return null; }
}
function saveDraft(d: Draft | null) {
  try { if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else localStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked – keep in memory */ }
}
const sourceCode = (owner: string) => `dysponent:${owner.trim().toLocaleLowerCase('pl').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

// Rules for sharing – plain words instead of licence names
const RULES: Record<string, string> = {
  'CC0-1.0': 'Każdy może korzystać z danych bez ograniczeń (zalecane)',
  'CC-BY-4.0': 'Każdy może korzystać, jeśli poda nazwę mojej instytucji jako źródło',
};

export function Providers() {
  usePageTitle('Dodaj AED swojej instytucji');
  const saved = useRef(loadDraft());
  const [mode, setMode] = useState<'start' | 'file' | 'manual'>(saved.current ? 'manual' : 'start');
  const [inst, setInst] = useState<Inst>(saved.current?.inst ?? emptyInst());
  // a provider adds only its own devices: the institution is the one of the logged-in account (the server enforces it too)
  const session = useSession();
  const own = session?.rola === 'dysponent' ? session.dysponent_nazwa ?? '' : '';
  useEffect(() => { if (own && inst.owner !== own) setInst((i) => ({ ...i, owner: own })); }, [own]);
  return (
    <>
      <h1 id="page-title">Dodaj AED swojej instytucji</h1>
      {mode === 'start' && (
        <>
          <section className="campaign-hero campaign-hero--compact" aria-label={`Akcja ${BRAND_NAME}`}>
            <LogoMark size={72} title={`Logo akcji ${BRAND_NAME}`} />
            <div>
              <p className="campaign-hero__cta">{BRAND_CTA}</p>
              <p>Urząd, szkoła, szpital, firma: dane o Waszych defibrylatorach publikujecie <strong>sami, na koncie swojej instytucji w dane.gov.pl</strong> – dzięki temu wiadomo, kto za nie odpowiada. My pomagamy przygotować pliki według wspólnego wzoru.</p>
            </div>
          </section>
          <ol className="steps">
            <li><strong>Konto dostawcy</strong> w dane.gov.pl (jeśli Wasza instytucja go nie ma) i konto w tym kreatorze – zakłada je administrator po sprawdzeniu instytucji.</li>
            <li><strong>Dodaj AED</strong> – z pliku albo ręcznie. Sprawdzimy dane ze wzorem.</li>
            <li><strong>Zgłoś AED</strong> po zalogowaniu (menu „Zgłoszenia AED”). Po zatwierdzeniu przez administratora Wasze AED są od razu na mapie.</li>
          </ol>
          <p className="lead">Wybierz, jak chcesz dodać AED:</p>
          <div className="choice-cards">
            <button type="button" className="choice-card" onClick={() => setMode('file')}>
              <strong>Mam listę AED w pliku</strong>
              <span>Excel albo CSV. Najlepsze, gdy masz kilka lub więcej AED.</span>
            </button>
            <button type="button" className="choice-card" onClick={() => setMode('manual')}>
              <strong>Wpiszę AED ręcznie</strong>
              <span>Krok po kroku, jedno AED po drugim.</span>
            </button>
          </div>
        </>
      )}
      {mode === 'file' && <FileFlow inst={inst} setInst={setInst} back={() => setMode('start')} />}
      {mode === 'manual' && <ManualFlow inst={inst} setInst={setInst} saved={saved.current} back={() => setMode('start')} />}
    </>
  );
}

/** Institution name, type and sharing rules – asked once. */
function InstFields({ inst, setInst, v }: { inst: Inst; setInst: (i: Inst) => void; v: ReturnType<typeof useValidation> }) {
  const e = v.errors;
  return (
    <>
      <div className="field">
        <label htmlFor="i-owner">Nazwa instytucji<Req /></label>
        <input id="i-owner" type="text" autoComplete="organization" required value={inst.owner} readOnly={!!getSession()?.dysponent_nazwa} onChange={(ev) => setInst({ ...inst, owner: ev.target.value })} onBlur={() => v.check('owner')}
          aria-invalid={!!e.owner} aria-describedby={e.owner ? 'i-owner-err' : undefined} />
        {e.owner && <p id="i-owner-err" className="field-error">{e.owner}</p>}
      </div>
      <div className="field">
        <label htmlFor="i-type">Rodzaj instytucji<Req /></label>
        <select id="i-type" required value={inst.ownerType} onChange={(ev) => setInst({ ...inst, ownerType: ev.target.value })} onBlur={() => v.check('ownerType')}
          aria-invalid={!!e.ownerType} aria-describedby={e.ownerType ? 'i-type-err' : undefined}>
          <option value="">– wybierz –</option>
          {dictValues('dysponent_typ').map((d) => <option key={d.wartosc} value={d.wartosc}>{label('dysponent_typ', d.wartosc)}</option>)}
        </select>
        {e.ownerType && <p id="i-type-err" className="field-error">{e.ownerType}</p>}
      </div>
      <fieldset>
        <legend>Na jakich zasadach udostępniasz dane?<Req /></legend>
        <div className="big-choices">
          {Object.entries(RULES).map(([k, t]) => (
            <label key={k} htmlFor={`i-lic-${k}`}><input id={`i-lic-${k}`} type="radio" name="i-lic" checked={inst.lic === k} onChange={() => setInst({ ...inst, lic: k })} /> {t}</label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
const instValidators = (inst: Inst) => ({
  owner: () => (inst.owner.trim() ? '' : 'Wpisz nazwę instytucji, np. „Urząd Gminy Lisewo”.'),
  ownerType: () => (inst.ownerType ? '' : 'Wybierz rodzaj instytucji.'),
});

// ======================= FILE =======================
type FileStage = 'upload' | 'columns' | 'result' | 'done';

function FileFlow({ inst, setInst, back }: { inst: Inst; setInst: (i: Inst) => void; back: () => void }) {
  const [stage, setStage] = useState<FileStage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<ImportInfo | null>(null);
  const [rep, setRep] = useState<RaportWalidacji | null>(null);
  const [result, setResult] = useState<WynikImportu | null>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const go = (s: FileStage) => { setStage(s); setTimeout(() => head.current?.focus(), 0); };
  const csvHref = isMockMode() ? `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv())}` : templateUrl('csv');
  const titles: Record<FileStage, string> = { upload: 'Wgraj plik z listą AED', columns: 'Dopasuj kolumny, których nie rozpoznaliśmy', result: 'Wynik sprawdzania', done: 'Gotowe – AED są w Twojej kopii roboczej' };

  return (
    <section aria-labelledby="f-title">
      <h2 id="f-title" ref={head} tabIndex={-1}>{titles[stage]}</h2>
      {stage === 'upload' && (
        <>
          <p><a className="btn btn--primary" href={templateUrl('xlsx')} download>Pobierz wzór w Excelu</a></p>
          <p>Możesz też wgrać własny plik – dopasujemy kolumny.</p>
          <details className="details"><summary>Dla specjalistów: wzór CSV</summary><p><a href={csvHref} download="szablon_aed.csv">Pobierz wzór CSV</a></p></details>
          <RequireLogin role="dysponent">
            <UploadForm inst={inst} setInst={setInst} file={file} setFile={setFile} back={back}
              onUploaded={async (i) => {
                setInfo(i);
                const unknown = Object.values(i.mapowanie_proponowane).filter((t) => t === '').length;
                if (unknown) go('columns');
                else { setRep(await confirmMapping(i.import_id, i.mapowanie_proponowane, file?.name ?? '')); go('result'); }
              }} />
          </RequireLogin>
        </>
      )}
      {stage === 'columns' && info && (
        <Columns info={info} back={() => go('upload')} onDone={async (m) => { setRep(await confirmMapping(info.import_id, m, file?.name ?? '')); go('result'); }} />
      )}
      {stage === 'result' && rep && (
        <Results rep={rep} setRep={setRep} reupload={() => go('upload')} onPublished={(r) => { setResult(r); go('done'); }} />
      )}
      {stage === 'done' && result && (
        <div role="status">
          <div className="callout callout--ok">
            <p className="callout__title"><Icon name="check" />Dodaliśmy {result.dodane + result.zaktualizowane + result.scalone} AED do Twojej kopii roboczej.</p>
            {result.odrzucone > 0 && <p>{result.odrzucone} AED czeka na poprawki. Popraw je w pliku i wgraj go ponownie.</p>}
          </div>
          <NextStep />
        </div>
      )}
    </section>
  );
}

function UploadForm({ inst, setInst, file, setFile, back, onUploaded }: {
  inst: Inst; setInst: (i: Inst) => void; file: File | null; setFile: (f: File | null) => void; back: () => void; onUploaded: (i: ImportInfo) => Promise<void>;
}) {
  const [over, setOver] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [fail, setFail] = useState<Error | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const v = useValidation({
    ...instValidators(inst),
    file: () => (!file ? 'Wybierz plik z listą AED.'
      : !/\.(xlsx|csv|json|geojson)$/i.test(file.name) ? `Plik „${file.name}” ma nieobsługiwany format. Zapisz go w Excelu jako .xlsx albo jako CSV i wybierz jeszcze raz.`
      : file.size > 20 * 1024 * 1024 ? 'Plik jest większy niż 20 MB. Podziel listę na mniejsze pliki.' : ''),
  });
  useEffect(() => { if (file) v.check('file'); }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(f: File | undefined | null) { if (f) setFile(f); }
  function onDrop(e: DragEvent) { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.validateAll()) return;
    setFail(null); setPct(0);
    try {
      const i = await uploadFile(file!, { kodZrodla: sourceCode(inst.owner), licencja: inst.lic, dysponentNazwa: inst.owner.trim(), dysponentTyp: inst.ownerType }, setPct);
      await onUploaded(i);
    } catch (ex) {
      setPct(null);
      const he = ex instanceof HttpError ? ex : null;
      setFail(new Error(he?.status === 422 ? `Nie udało się odczytać pliku. ${he.message} Sprawdź, czy to lista AED zapisana w Excelu lub CSV.` : (ex as Error).message));
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="f-title">
      <RequiredNote />
      <ErrorSummary errors={v.summary} fieldIds={{ owner: 'i-owner', ownerType: 'i-type', file: 'up-btn' }} focusToken={v.focusToken} />
      <InstFields inst={inst} setInst={setInst} v={v} />
      <div className="field">
        <span id="up-label" className="label-like"><strong>Plik z listą AED</strong><Req /></span>
        <div className={`dropzone${over ? ' is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
          onClick={() => input.current?.click()}>
          <p>Przeciągnij plik tutaj albo kliknij „Wybierz plik z komputera”.</p>
          <input ref={input} id="up-file" type="file" tabIndex={-1} required accept=".xlsx,.csv,.json,.geojson" aria-labelledby="up-label up-btn" aria-describedby="up-hint"
            aria-invalid={!!v.errors.file} onChange={(e) => pick(e.target.files?.[0])} />
          <button id="up-btn" type="button" className="btn btn--secondary" onClick={(e) => { e.stopPropagation(); input.current?.click(); }}>Wybierz plik z komputera</button>
          <p id="up-hint" className="hint">Plik z Excela (.xlsx) albo CSV, największy 20 MB.</p>
          {file && <p><strong>Wybrany plik:</strong> {file.name}</p>}
        </div>
        {v.errors.file && <p className="field-error">{v.errors.file}</p>}
      </div>
      {pct !== null && (
        <div className="field">
          <label htmlFor="up-progress">Wysyłanie pliku: {pct}%</label>
          <progress id="up-progress" className="progress" max={100} value={pct} />
          {pct === 100 && <p role="status">Sprawdzamy plik…</p>}
        </div>
      )}
      {fail && <ErrorBox error={fail} />}
      <p className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={pct !== null && !fail}>Sprawdź plik</button>
        <button type="button" className="btn btn--secondary" onClick={back}>Wstecz</button>
      </p>
    </form>
  );
}

/** Only columns we did not recognise, with an example value from the file. */
function Columns({ info, back, onDone }: { info: ImportInfo; back: () => void; onDone: (m: Record<string, string | string[]>) => Promise<void> }) {
  const [map, setMap] = useState(info.mapowanie_proponowane);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  const unknown = Object.keys(info.mapowanie_proponowane).filter((c) => info.mapowanie_proponowane[c] === '');
  const example = (c: string) => { const row = info.podglad.find((r) => r[c] !== undefined && r[c] !== null && String(r[c]).trim() !== ''); return row ? String(row[c]) : '—'; };
  async function next(e: FormEvent) {
    e.preventDefault(); setBusy(true); setFail(null);
    try { await onDone(map); } catch (ex) { setFail(ex as Error); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={next} noValidate aria-labelledby="f-title">
      <p>Plik ma {info.liczba_wierszy} wierszy. Rozpoznaliśmy {Object.keys(map).length - unknown.length} z {Object.keys(map).length} kolumn. Wskaż, co jest w pozostałych – albo zostaw „Pomiń tę kolumnę”.</p>
      {unknown.map((c, i) => (
        <div className="field" key={c}>
          <label htmlFor={`col-${i}`}>Kolumna „{c}”</label>
          <p id={`col-${i}-hint`} className="hint">Przykład z pliku: „{example(c)}”</p>
          <select id={`col-${i}`} aria-describedby={`col-${i}-hint`} value={String(map[c] ?? '')} onChange={(e) => setMap({ ...map, [c]: e.target.value })}>
            <option value="">Pomiń tę kolumnę</option>
            {FIELDS.map((f) => <option key={f.nazwa_pola} value={f.nazwa_pola}>{f.etykieta}</option>)}
          </select>
        </div>
      ))}
      {fail && <ErrorBox error={fail} />}
      <p className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Sprawdzam…' : 'Dalej'}</button>
        <button type="button" className="btn btn--secondary" onClick={back}>Wstecz</button>
      </p>
    </form>
  );
}

const FIELD_HINTS: Record<string, string> = {
  kod_pocztowy: 'Wpisz go w formie 00-000, np. 85-005.',
  numer_budynku: 'Wpisz numer budynku, np. 12A.',
  godziny_dostepnosci: 'Np. pn-pt 8-16 albo całą dobę.',
  szerokosc_geograficzna: 'Sprawdź położenie AED – liczba z kropką, np. 52.2297.',
  dlugosc_geograficzna: 'Sprawdź położenie AED – liczba z kropką, np. 21.0122.',
  miejscowosc: 'Wpisz nazwę miejscowości.',
  nazwa_obiektu: 'Wpisz nazwę budynku lub miejsca.',
};
const human = (wiersz: number, pole: string | null, komunikat: string) =>
  `W wierszu ${wiersz}${pole ? ` (${fieldLabel(pole).toLocaleLowerCase('pl')})` : ''}: ${komunikat.replace(/\.$/, '')}.${pole && FIELD_HINTS[pole] ? ` ${FIELD_HINTS[pole]}` : ''}`;

function Results({ rep, setRep, reupload, onPublished }: { rep: RaportWalidacji; setRep: (r: RaportWalidacji) => void; reupload: () => void; onPublished: (r: WynikImportu) => void }) {
  const errors = rep.problemy.filter((p) => p.poziom === 'blad');
  const errRows = [...new Set(errors.map((p) => p.wiersz))];
  const ready = Math.max(0, rep.poprawne - rep.duplikaty.length);
  const [fix, setFix] = useState<Record<string, string>>({});
  const [dupDec, setDupDec] = useState<Record<number, 'to_samo' | 'inne'>>(() => Object.fromEntries(rep.duplikaty.map((d) => [d.wiersz, 'to_samo'])));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<Error | null>(null);
  const key = (w: number, p: string | null) => `${w}|${p ?? ''}`;

  async function saveFixes() {
    setMsg(''); setFail(null);
    const poprawki = errors.filter((p) => p.pole && fix[key(p.wiersz, p.pole)]?.trim()).map((p) => ({ wiersz: p.wiersz, pole: p.pole!, wartosc: fix[key(p.wiersz, p.pole)].trim() }));
    if (!poprawki.length) { setMsg('Wpisz poprawną wartość przynajmniej w jednym polu.'); return; }
    try { setRep({ ...(await fixImportRows(rep.import_id!, poprawki)), import_id: rep.import_id }); setFix({}); setMsg('Zapisaliśmy poprawki i sprawdziliśmy plik jeszcze raz.'); }
    catch (ex) {
      if (ex instanceof NotSupported) setMsg('Poprawianie w tabeli jeszcze nie działa na serwerze. Popraw te wiersze w pliku i wgraj go ponownie – albo dodaj teraz gotowe AED do kopii roboczej.');
      else setFail(ex as Error);
    }
  }
  async function saveDups() {
    setMsg(''); setFail(null);
    try { await decideDuplicates(rep.import_id!, Object.entries(dupDec).map(([w, d]) => ({ wiersz: Number(w), decyzja: d }))); setMsg('Zapisaliśmy Twój wybór.'); }
    catch (ex) {
      if (ex instanceof NotSupported) setMsg('Na razie serwer łączy takie AED automatycznie (jak „To samo AED”). Wybór „To inne AED” zadziała po aktualizacji serwera.');
      else setFail(ex as Error);
    }
  }
  async function publish() {
    setBusy(true); setFail(null);
    try { onPublished(await approveImport(rep)); } catch (ex) { setFail(ex as Error); } finally { setBusy(false); }
  }

  return (
    <>
      <p>Sprawdziliśmy {rep.wiersze} wierszy z pliku „{rep.plik}”.</p>
      <p role="status" className="status-line">{msg}</p>

      <h3 className="group-title"><Icon name="check" />Gotowe ({ready})</h3>
      <p>{ready ? 'Te AED możemy od razu dodać do Twojej kopii roboczej.' : 'Żadne AED nie jest jeszcze gotowe.'}</p>
      {(rep as RaportWalidacji & { uzupelnienia?: { wiersz: number; pole: string | null; komunikat: string }[] }).uzupelnienia?.length ? (
        <details className="details"><summary>Co poprawiliśmy sami</summary>
          <ul>{(rep as RaportWalidacji & { uzupelnienia: { wiersz: number; pole: string | null; komunikat: string }[] }).uzupelnienia.slice(0, 50).map((p, i) => <li key={i}>{human(p.wiersz, p.pole, p.komunikat)}</li>)}</ul>
        </details>
      ) : null}

      <h3 className="group-title"><Icon name="x" />Do poprawy ({errRows.length})</h3>
      {errors.length === 0 ? <p>Nic nie trzeba poprawiać.</p> : (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-fix">
            <table className="fix-table">
              <caption id="cap-fix">Popraw wartości w tabeli</caption>
              <thead><tr><th scope="col">Co jest nie tak</th><th scope="col">Poprawna wartość</th></tr></thead>
              <tbody>
                {errors.map((p, i) => (
                  <tr key={i}>
                    <td>{human(p.wiersz, p.pole, p.komunikat)}{p.wartosc_zrodlowa ? <> Było: „{String(p.wartosc_zrodlowa)}”.</> : null}</td>
                    <td>{p.pole ? (
                      <>
                        <label className="visually-hidden" htmlFor={`fix-${i}`}>Wiersz {p.wiersz}, {fieldLabel(p.pole)}</label>
                        <input id={`fix-${i}`} type="text" autoComplete="off" value={fix[key(p.wiersz, p.pole)] ?? String(p.propozycja ?? '')} onChange={(e) => setFix({ ...fix, [key(p.wiersz, p.pole)]: e.target.value })} />
                      </>
                    ) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="form-actions"><button type="button" className="btn btn--secondary" onClick={saveFixes}>Zapisz poprawki</button></p>
        </>
      )}

      <h3 className="group-title"><Icon name="question" />Może już jest w Twoich danych ({rep.duplikaty.length})</h3>
      {rep.duplikaty.length === 0 ? <p>Nie znaleźliśmy takich AED.</p> : (
        <>
          {rep.duplikaty.map((d) => (
            <fieldset key={d.wiersz}>
              <legend>Wiersz {d.wiersz}: w tym samym miejscu (około {Math.round(d.odleglosc_m)} m) jest już AED.</legend>
              <div className="big-choices">
                <label htmlFor={`dup-${d.wiersz}-s`}><input id={`dup-${d.wiersz}-s`} type="radio" name={`dup-${d.wiersz}`} checked={dupDec[d.wiersz] === 'to_samo'} onChange={() => setDupDec({ ...dupDec, [d.wiersz]: 'to_samo' })} /> To samo AED</label>
                <label htmlFor={`dup-${d.wiersz}-i`}><input id={`dup-${d.wiersz}-i`} type="radio" name={`dup-${d.wiersz}`} checked={dupDec[d.wiersz] === 'inne'} onChange={() => setDupDec({ ...dupDec, [d.wiersz]: 'inne' })} /> To inne AED</label>
              </div>
            </fieldset>
          ))}
          <p className="form-actions"><button type="button" className="btn btn--secondary" onClick={saveDups}>Zapisz wybór</button></p>
        </>
      )}

      {fail && <ErrorBox error={fail} />}
      <p className="form-actions">
        <button type="button" className="btn btn--primary" onClick={publish} disabled={busy || rep.poprawne === 0}>{busy ? 'Dodaję…' : 'Dodaj gotowe do moich AED, resztę poprawię później'}</button>
        <button type="button" className="btn btn--secondary" onClick={reupload}>Wgraj poprawiony plik</button>
      </p>
    </>
  );
}

// ======================= MANUAL =======================
function ManualFlow({ inst, setInst, saved, back }: { inst: Inst; setInst: (i: Inst) => void; saved: Draft | null; back: () => void }) {
  const [list, setList] = useState<AedDraft[]>(saved?.list ?? []);
  const [current, setCurrent] = useState<AedDraft>(saved?.current ?? emptyDraft());
  const [step, setStep] = useState(saved?.step ?? 0); // 0 = institution data, 1–4 wizard, 5 = list
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ ok: number; errors: string[] } | null>(null);
  const v = useValidation(instValidators(inst));
  const head = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (!results) saveDraft({ inst, list, current, step }); }, [inst, list, current, step, results]);
  useEffect(() => { if (step === 0 || step === 5) head.current?.focus(); }, [step]);

  function addToList() {
    if (editing !== null) { setList(list.map((x, i) => (i === editing ? current : x))); setEditing(null); }
    else setList([...list, current]);
    setCurrent(emptyDraft()); setStep(5);
  }
  async function publishAll() {
    setBusy(true);
    const errors: string[] = []; let ok = 0; const left: AedDraft[] = [];
    for (const [i, d] of list.entries()) {
      try {
        await createAed({ ...draftToRecord(d), dysponent_nazwa: inst.owner.trim(), dysponent_typ: inst.ownerType, licencja: inst.lic, kod_zrodla: sourceCode(inst.owner) });
        ok++;
      } catch (ex) {
        left.push(d);
        const f = ex instanceof HttpError ? ex.fields : {};
        errors.push(`AED nr ${i + 1} („${d.nazwa}”): ${Object.keys(f).length ? Object.entries(f).map(([k, m]) => `${fieldLabel(k)} – ${m}`).join('; ') : (ex as Error).message}`);
      }
    }
    setList(left); setBusy(false); setResults({ ok, errors });
    if (!left.length) saveDraft(null);
  }

  if (results && list.length === 0) {
    return (
      <div role="status">
        <div className="callout callout--ok"><p className="callout__title"><Icon name="check" />Dodaliśmy {results.ok} AED do Twojej kopii roboczej.</p></div>
        <NextStep />
      </div>
    );
  }

  return (
    <RequireLogin role="dysponent">
      <p className="draft-note">Możesz wrócić później – to, co wpiszesz, zapisuje się na tym urządzeniu.</p>
      {step === 0 && (
        <form noValidate onSubmit={(e) => { e.preventDefault(); if (v.validateAll()) setStep(list.length ? 5 : 1); }} aria-labelledby="m-title">
          <h2 id="m-title" ref={head} tabIndex={-1}>Twoja instytucja</h2>
          <RequiredNote />
          <ErrorSummary errors={v.summary} fieldIds={{ owner: 'i-owner', ownerType: 'i-type' }} focusToken={v.focusToken} />
          <InstFields inst={inst} setInst={setInst} v={v} />
          <p className="form-actions">
            <button type="submit" className="btn btn--primary">Dalej</button>
            <button type="button" className="btn btn--secondary" onClick={back}>Wstecz</button>
          </p>
        </form>
      )}
      {step >= 1 && step <= 4 && (
        <>
          <p><strong>{editing !== null ? `Zmieniasz AED nr ${editing + 1}` : `AED nr ${list.length + 1}`}</strong> – {inst.owner}</p>
          <AedWizard variant="institution" backFromFirst={() => setStep(list.length ? 5 : 0)} draft={current} setDraft={setCurrent} step={step} setStep={setStep} onSubmit={addToList} submitLabel={editing !== null ? 'Zapisz zmiany' : 'Dodaj do listy'} />
        </>
      )}
      {step === 5 && (
        <section aria-labelledby="m-list">
          <h2 id="m-list" ref={head} tabIndex={-1}>Twoje AED do dodania ({list.length})</h2>
          {results && results.errors.length > 0 && (
            <div className="callout callout--error" role="alert">
              <p className="callout__title">Dodaliśmy {results.ok} AED. Tych nie udało się dodać – popraw je:</p>
              <ul>{results.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {list.length === 0 ? <p>Lista jest pusta.</p> : (
            <ul className="aed-list">
              {list.map((d, i) => (
                <li key={i} className="aed-item">
                  <h3 className="aed-item__title">{i + 1}. {d.nazwa}</h3>
                  <p>{[d.ulica, d.numer].filter(Boolean).join(' ')}, {d.kod} {d.miejscowosc} · {hoursInWords(d.hours)}</p>
                  <p className="aed-item__actions">
                    <button type="button" className="btn btn--tertiary" onClick={() => { setCurrent(d); setEditing(i); setStep(4); }}>Zmień<span className="visually-hidden"> AED nr {i + 1}</span></button>
                    <button type="button" className="btn btn--tertiary" onClick={() => setList(list.filter((_, j) => j !== i))}>Usuń z listy<span className="visually-hidden"> AED nr {i + 1}</span></button>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p className="form-actions">
            <button type="button" className="btn btn--primary" onClick={publishAll} disabled={busy || !list.length}>{busy ? 'Dodaję…' : `Dodaj do moich AED (${list.length})`}</button>
            <button type="button" className="btn btn--secondary" onClick={() => { setCurrent(emptyDraft()); setEditing(null); setStep(1); }}>Dodaj kolejne AED</button>
            <button type="button" className="btn btn--tertiary" onClick={() => setStep(0)}>Zmień dane instytucji</button>
          </p>
        </section>
      )}
    </RequireLogin>
  );
}

/** After adding: the data is NOT published yet – the provider downloads the files and publishes them on its own account (K11). */
function NextStep() {
  return (
    <div className="callout callout--info">
      <p className="callout__title">Co dalej?</p>
      <p>Dane nie są jeszcze opublikowane. W „Moje AED” pobierz <strong>pliki do publikacji</strong> i opublikuj je na koncie swojej instytucji w dane.gov.pl – wtedy Twoje AED trafią na wspólną listę, a Twoja instytucja odpowiada za ich aktualność.</p>
      <p><Link className="btn btn--primary" to="/moje-aed">Przejdź do „Moje AED”</Link></p>
    </div>
  );
}

/** Badge for the provider (campaign materials, shown in "Moje AED" once its AED are on the common list). */
export function Badge({ owner }: { owner: string }) {
  const name = owner.trim() || 'Nasza instytucja';
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="220" viewBox="0 0 600 220" role="img" aria-label="${esc(name)} udostępnia dane o AED – ${BRAND_NAME}"><rect width="600" height="220" rx="24" fill="#1A7A50"/>${heartRects(40, 50, 24)}<text x="200" y="78" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">${BRAND_NAME}</text><text x="200" y="116" font-family="Arial, sans-serif" font-size="22" fill="#fff">Udostępniamy dane o naszych AED</text><text x="200" y="150" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#fff">${esc(name.slice(0, 36))}</text><text x="200" y="184" font-family="Arial, sans-serif" font-weight="600" font-size="17" fill="#EDF2EC">${BRAND_SLOGAN}</text></svg>`;
  const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    <section aria-labelledby="badge-title" className="badge-box">
      <h3 id="badge-title">Twoja odznaka</h3>
      <p>Pokaż na stronie lub przy wejściu, że dane o Waszych AED są w dane.gov.pl.</p>
      <img src={href} alt={`Odznaka akcji ${BRAND_NAME}: ${name} udostępnia dane o swoich AED`} width={600} height={220} />
      <p><a className="btn btn--secondary" href={href} download="odznaka_aed.svg">Pobierz odznakę (SVG)</a></p>
    </section>
  );
}
