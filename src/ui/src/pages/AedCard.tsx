// E3 – Karta AED. Access info (locked cabinet + instructions) first; then how to get there, hours, verification, source.
import { useState, type FormEvent } from 'react';
import { confirmAed, getAed, HttpError } from '../api/client';
import { PODSTAWA_LABEL, type AedDetail } from '../api/types';
import { MapView } from '../components/MapView';
import { QrSticker } from '../components/QrSticker';
import { AvailabilityBadge, DataBadge, Emergency, ErrorBox, ExternalLink, Icon, Loading, LockedCabinet } from '../components/ui';
import { ErrorSummary, Req, RequiredNote, useValidation } from '../components/form';
import { address, date, dictMeaning, floor, label, osmDirections } from '../lib/format';
import { describeHours } from '../lib/hours';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';

export function AedCard({ id }: { id: string }) {
  const st = useAsync(() => getAed(id), [id]);
  usePageTitle(st.data?.aed.nazwa_obiektu ?? 'Karta AED');
  if (st.loading && !st.data) return <><h1>Karta AED</h1><Loading /></>;
  if (st.error) return <><h1>Karta AED</h1><ErrorBox error={st.error} onRetry={st.reload} /></>;
  if (!st.data) {
    return (
      <>
        <h1>Nie znaleziono AED</h1>
        <p>W zbiorze nie ma urządzenia o identyfikatorze <code>{id}</code>. Mogło zostać usunięte albo połączone z innym AED.</p>
        <p><Link to="/">Szukaj najbliższego AED</Link></p>
      </>
    );
  }
  return <Card d={st.data} onConfirmed={st.reload} />;
}

function Card({ d, onConfirmed }: { d: AedDetail; onConfirmed: () => void }) {
  const a = d.aed;
  const to = { lat: a.szerokosc_geograficzna, lon: a.dlugosc_geograficzna };
  const m = a.meta ?? {};
  const helper = m.warstwa === 'pomocnicza';
  const osm = helper || a.licencja === 'ODbL-1.0';
  return (
    <article className="card-page" aria-labelledby="page-title">
      <header className="card-page__head">
        <h1 id="page-title">{a.nazwa_obiektu}</h1>
        <div className="aed-item__badges">
          <AvailabilityBadge aed={a} />
          <DataBadge aed={a} />
          {a.mobilny && <span className="badge badge--info"><Icon name="car" />Urządzenie w pojeździe – miejsce może się zmieniać</span>}
          {a.tryb_pediatryczny && <span className="badge badge--info">Tryb dla dzieci</span>}
          {!helper && m.zgodnosc === 'przejsciowy' && <span className="badge badge--transitional">Zbiór przejściowy</span>}
        </div>
        {!helper && m.dostawca && (
          <p className="source-line">
            Dostawca: <strong>{m.dostawca}</strong>{m.dostawca_podstawa && PODSTAWA_LABEL[m.dostawca_podstawa] ? ` (${PODSTAWA_LABEL[m.dostawca_podstawa]})` : ''}
            {m.zbior_url && <> · <ExternalLink href={m.zbior_url}>zbiór w dane.gov.pl</ExternalLink></>}
            {m.data_danych && <> · dane z {date(m.data_danych)}</>}
          </p>
        )}
      </header>

      {helper && (
        <div className="callout callout--warn" role="note">
          <p className="callout__title">Do sprawdzenia – punkt z mapy OpenStreetMap</p>
          <p>Właściciel urządzenia nie potwierdził tych danych i nie należą one do wspólnej listy AED. Urządzenie może być w innym miejscu albo niedostępne. Jeśli wiesz, czyje to AED, <Link to={`/zglos?aed=${encodeURIComponent(a.id_aed)}`}>daj nam znać</Link> – zaprosimy właściciela do publikacji danych.</p>
          <p className="hint">© współtwórcy OpenStreetMap (licencja ODbL 1.0)</p>
        </div>
      )}
      {!helper && (m.zbior_nieaktualny || (m.mozliwe_duplikaty?.length ?? 0) > 0) && (
        <div className="callout callout--info" role="note">
          {m.zbior_nieaktualny && <p><strong>Zbiór dostawcy jest po terminie aktualizacji</strong> – dane mogą być nieaktualne.</p>}
          {(m.mozliwe_duplikaty?.length ?? 0) > 0 && <p><strong>Możliwy duplikat:</strong> w pobliżu jest AED innego dostawcy ({m.mozliwe_duplikaty!.map((x, i) => <span key={x}>{i ? ', ' : ''}<Link to={`/aed/${x}`}>{x}</Link></span>)}). Dostawcy sprawdzają, czy to to samo urządzenie.</p>}
        </div>
      )}

      <LockedCabinet aed={a} />
      <p className="firstaid-bar"><span>W nagłym wypadku dzwoń 112.</span><Link to="/pierwsza-pomoc">Jak użyć AED?</Link></p>
      {!a.szafka_zamknieta && a.instrukcja_dostepu && (
        <div className="callout callout--info" role="note"><p className="callout__title">Jak się dostać</p><p>{a.instrukcja_dostepu}</p></div>
      )}

      <div className="card-grid">
        <section aria-labelledby="h-where" className="panel">
          <h2 id="h-where">Gdzie jest</h2>
          <p className="big">{address(a)}</p>
          <dl className="facts">
            <dt>Dokładne miejsce</dt><dd>{a.opis_lokalizacji}</dd>
            {a.pietro !== null && <><dt>Piętro</dt><dd>{floor(a.pietro)}</dd></>}
            <dt>Umieszczenie</dt><dd>{a.wewnatrz_budynku ? 'wewnątrz budynku' : 'na zewnątrz budynku'}</dd>
            <dt>Dostęp</dt><dd>{label('dostep', a.dostep)} – {dictMeaning('dostep', a.dostep)}</dd>
          </dl>
          <p>
            <ExternalLink href={osmDirections(null, to)}>Pokaż na mapie OpenStreetMap</ExternalLink>
          </p>
        </section>

        <section aria-labelledby="h-hours" className="panel">
          <h2 id="h-hours">Kiedy jest dostępne</h2>
          <ul className="plain">{describeHours(a.godziny_dostepnosci).map((h) => <li key={h}>{h}</li>)}</ul>
          {a.godziny_dostepnosci && <p className="hint">Zapis w danych: <code>{a.godziny_dostepnosci}</code>. Czas: Europe/Warsaw.</p>}
          <h2 id="h-dev">Urządzenie</h2>
          <dl className="facts">
            <dt>Stan</dt><dd>{label('status_urzadzenia', a.status_urzadzenia)}</dd>
            {(a.producent || a.model) && <><dt>Model</dt><dd>{[a.producent, a.model].filter(Boolean).join(' ')}</dd></>}
            <dt>Ważność elektrod</dt><dd>{date(a.data_waznosci_elektrod)}</dd>
            <dt>Ostatni przegląd</dt><dd>{date(a.data_ostatniego_przegladu)}</dd>
          </dl>
        </section>
      </div>

      <MapView items={[a]} focusId={a.id_aed} label={`Mapa: położenie AED ${a.nazwa_obiektu}`} height={300} cluster={false} />

      <div className="card-grid">
        <section aria-labelledby="h-ver" className="panel">
          <h2 id="h-ver">Weryfikacja i aktualność</h2>
          <dl className="facts">
            <dt>Metoda weryfikacji</dt><dd>{label('metoda_weryfikacji', a.metoda_weryfikacji)}</dd>
            <dt>Ostatnia aktualizacja</dt><dd>{date(a.data_aktualizacji)}</dd>
            <dt>Sprawdzone przez właściciela</dt><dd>{a.data_weryfikacji ? date(a.data_weryfikacji) : 'brak daty'}</dd>
            <dt>Ostatnie potwierdzenie mieszkańca</dt><dd>{d.potwierdzenia.ostatnie ? date(d.potwierdzenia.ostatnie) : 'brak'}{d.potwierdzenia.liczba ? ` (razem ${d.potwierdzenia.liczba})` : ''}</dd>
            {a.kompletnosc !== null && <><dt>Kompletność danych</dt><dd>{a.kompletnosc}%</dd></>}
          </dl>
        </section>
        <section aria-labelledby="h-owner" className="panel">
          <h2 id="h-owner">Właściciel AED (instytucja)</h2>
          <dl className="facts">
            <dt>Nazwa</dt><dd>{a.dysponent_nazwa}</dd>
            <dt>Rodzaj</dt><dd>{label('dysponent_typ', a.dysponent_typ)}</dd>
            {a.kontakt_telefon && <><dt>Telefon</dt><dd><a href={`tel:${a.kontakt_telefon}`}>{a.kontakt_telefon}</a></dd></>}
            {a.kontakt_email && <><dt>E-mail</dt><dd><a href={`mailto:${a.kontakt_email}`}>{a.kontakt_email}</a></dd></>}
          </dl>
        </section>
      </div>

      <Passport id={a.id_aed} name={a.nazwa_obiektu} onDone={onConfirmed} />
      <QrSticker id={a.id_aed} name={a.nazwa_obiektu} />

      <section aria-labelledby="h-src" className="panel">
        <h2 id="h-src">Skąd są te dane i kto za nie odpowiada</h2>
        {helper ? <p>Punkt z mapy OpenStreetMap (© współtwórcy OpenStreetMap, ODbL). Nikt nie odpowiada za te dane – dlatego nie należą do wspólnej listy.</p> : (
          <dl className="facts">
            <dt>Dostawca danych</dt><dd><strong>{m.dostawca}</strong>{m.dostawca_podstawa && PODSTAWA_LABEL[m.dostawca_podstawa] ? ` (${PODSTAWA_LABEL[m.dostawca_podstawa]})` : ''}{m.fikcyjny_dostawca ? ' (dostawca fikcyjny – prototyp)' : ''} – odpowiada za jakość, aktualność i poprawność tych danych</dd>
            <dt>Zbiór w dane.gov.pl</dt><dd>{m.zbior_url ? <ExternalLink href={m.zbior_url}>{m.zbior_tytul ?? 'zbiór dostawcy'}</ExternalLink> : '—'}{m.zasob_url && <> · <ExternalLink href={m.zasob_url}>plik z danymi</ExternalLink></>}</dd>
            <dt>Dane na dzień</dt><dd>{m.data_danych ? date(m.data_danych) : '—'}</dd>
            <dt>Zasady korzystania</dt><dd>Źródło: {m.dostawca}, {m.licencja_zbioru ?? a.licencja}</dd>
            {m.zgodnosc === 'przejsciowy' && <><dt>Zbiór przejściowy</dt><dd>Zbiór opublikowany przed wzorcem danych AED. Pokazujemy dane dostawcy bez zmian – część pól może być pusta.</dd></>}
          </dl>
        )}
        <details className="details">
        <summary>Dla specjalistów</summary>
        <p>Licencja: <strong>{a.licencja}</strong>
          {osm && <> – dane © autorzy OpenStreetMap, udostępniane na licencji ODbL w osobnym zasobie</>}.
        </p>
        {d.pochodzenie.length > 0 && (
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-prov">
            <table>
              <caption id="cap-prov">Źródła, z których pochodzą dane o tym AED</caption>
              <thead><tr><th scope="col">Źródło</th><th scope="col">Identyfikator w źródle</th><th scope="col">Licencja</th><th scope="col">Pobrano</th><th scope="col">Rola</th></tr></thead>
              <tbody>
                {d.pochodzenie.map((p) => (
                  <tr key={p.kod_zrodla + p.id_w_zrodle}>
                    <td>{p.kod_zrodla}</td><td>{p.id_w_zrodle}</td><td>{p.licencja_zrodla}</td><td>{date(p.data_pobrania)}</td>
                    <td>{String(p.rekord_nadrzedny) === 'true' ? 'dane nadrzędne' : 'uzupełnienie / duplikat scalony'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">Identyfikator: <code>{a.id_aed}</code></p>
        </details>
      </section>
      <Emergency />
    </article>
  );
}

// "Paszport AED": the QR sticker on the cabinet leads here (/aed/{id}). No personal data collected.
function Passport({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const [here, setHere] = useState<'' | 'tak' | 'nie'>('');
  const [cab, setCab] = useState<'' | 'tak' | 'nie' | 'nie_wiem'>('');
  const [comment, setComment] = useState('');
  const v = useValidation({ here: () => (here ? '' : 'Zaznacz, czy AED jest na miejscu.') });
  const errors = v.errors;
  const [formErr, setFormErr] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormErr('');
    if (!v.validateAll()) return;
    setBusy(true);
    try {
      await confirmAed(id, { jest_na_miejscu: here === 'tak', szafka_dostepna: cab === '' || cab === 'nie_wiem' ? null : cab === 'tak', komentarz: comment.trim() });
      setSent(here === 'tak' ? 'Dziękujemy! Potwierdzenie zapisane – dzięki Tobie dane są aktualne.' : 'Dziękujemy! Przekażemy informację właścicielowi AED.');
      onDone();
    } catch (ex) {
      const body = ex instanceof HttpError ? ex.body : null;
      if (body?.fields && Object.keys(body.fields).length) v.showServerErrors(body.fields);
      setFormErr(body?.message ?? 'Nie udało się wysłać. Spróbuj ponownie.');
    } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="h-pass" className="panel panel--accent">
      <h2 id="h-pass">Paszport AED: jesteś przy urządzeniu?</h2>
      <p>Potwierdź w 10 sekund, że AED „{name}” jest na miejscu. To pomaga utrzymać zbiór aktualnym. Nie zbieramy danych osobowych.</p>
      {sent ? (
        <p role="status" className="callout callout--ok">{sent}</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <RequiredNote />
          <ErrorSummary errors={v.summary} fieldIds={{ here: 'here-tak' }} focusToken={v.focusToken} />
          {formErr && <p role="alert" className="field-error">{formErr}</p>}
          <fieldset aria-describedby={errors.here ? 'err-here' : undefined} aria-required="true"
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) v.check('here'); }}>
            <legend>Czy AED jest na miejscu?<Req /></legend>
            {errors.here && <p id="err-here" className="field-error">{errors.here}</p>}
            <div className="choices">
              <label><input id="here-tak" type="radio" name="here" required checked={here === 'tak'} onChange={() => setHere('tak')} /> Tak, jest</label>
              <label><input type="radio" name="here" required checked={here === 'nie'} onChange={() => setHere('nie')} /> Nie ma go</label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Czy szafka jest otwarta lub da się ją otworzyć?</legend>
            <div className="choices">
              <label><input type="radio" name="cab" checked={cab === 'tak'} onChange={() => setCab('tak')} /> Tak</label>
              <label><input type="radio" name="cab" checked={cab === 'nie'} onChange={() => setCab('nie')} /> Nie</label>
              <label><input type="radio" name="cab" checked={cab === 'nie_wiem'} onChange={() => setCab('nie_wiem')} /> Nie wiem</label>
            </div>
          </fieldset>
          <label htmlFor="pass-comment">Uwagi</label>
          <p id="pass-hint" className="hint">Np. „przeniesiony do holu”. Nie wpisuj imion, nazwisk ani numerów telefonu.</p>
          <textarea id="pass-comment" aria-describedby="pass-hint" autoComplete="off" maxLength={500} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          <p className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Wysyłam…' : 'Wyślij potwierdzenie'}</button>
            <Link to={`/zglos?aed=${encodeURIComponent(id)}`}>Zgłoś problem z tym AED</Link>
          </p>
        </form>
      )}
    </section>
  );
}
