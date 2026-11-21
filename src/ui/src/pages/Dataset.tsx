// E6 – Eksport wspólnej listy (CR-TL-5, CONTRACT §5 v2.0): a compilation of provider datasets, not a new dataset.
import { useState } from 'react';
import { API_BASE, exportUrl } from '../api/client';
import { FIELDS } from '../lib/fields';
import { useMockMode } from '../lib/useMockMode';
import { Link, usePageTitle } from '../router';

// CONTRACT §5 (v2.0) GET /eksport/{plik}. The list has no XML or DCAT metadata of its own – it has no provider.
const COND = 'warunki zbioru źródłowego (kolumna licencja_zbioru)';
const FILES = [
  { plik: 'aed.csv', format: 'CSV (UTF-8, przecinek, RFC 4180)', licencja: COND, opis: 'Jeden wiersz = jeden AED: 44 pola wzorca oraz dostawca, zbiór, zasób, data danych, warunki zbioru i znacznik możliwego duplikatu.' },
  { plik: 'aed.geojson', format: 'GeoJSON (WGS 84)', licencja: COND, opis: 'Te same rekordy jako punkty na mapie.' },
  { plik: 'aed.jsonld', format: 'JSON-LD (schema.org)', licencja: COND, opis: 'Te same rekordy jako dane powiązane.' },
  { plik: 'aed_pochodzenie.csv', format: 'CSV', licencja: 'CC0-1.0', opis: 'Z którego zbioru i zasobu pochodzi każdy rekord, data danych i aktualność zbioru.' },
  { plik: 'zrodla.csv', format: 'CSV', licencja: 'CC0-1.0', opis: 'Zbiory dostawców, z których powstała lista.' },
  { plik: 'slownik_danych.csv', format: 'CSV', licencja: 'CC0-1.0', opis: 'Opis wszystkich pól wzorca: typ, format, przykład, obowiązkowość, słownik.' },
  { plik: 'aed.csvw.json', format: 'CSVW (JSON-LD)', licencja: 'CC0-1.0', opis: 'Metadane CSV on the Web – opis kolumn zrozumiały dla maszyn.' },
];

export function Dataset() {
  usePageTitle('Eksport wspólnej listy');
  const mock = useMockMode();
  const [only, setOnly] = useState<'' | 'wymagane' | 'zalecane' | 'opcjonalne'>('');
  const shown = FIELDS.filter((f) => !only || f.obowiazkowosc === only);
  return (
    <>
      <h1 id="page-title">Eksport wspólnej listy</h1>
      <p className="lead">To kompilacja zbiorów dostawców, nie nowy zbiór danych. Za każdy rekord odpowiada wskazany dostawca.</p>
      <p>Każdy rekord niesie nazwę dostawcy, identyfikator jego zbioru i warunki ponownego wykorzystywania tego zbioru – korzystając z danych, stosuj warunki zbioru, z którego pochodzi rekord. Dane z OpenStreetMap nie wchodzą do eksportu. <Link to="/zrodla">Zobacz dostawców i ich zbiory</Link>.</p>
      <p><Link to="/dysponenci">Masz AED? Opublikuj dane swojej instytucji na dane.gov.pl</Link></p>
      {mock && <p className="callout callout--warn" role="note">Tryb demonstracyjny: pliki pobierzesz, gdy działa serwer API (<code>docker compose up</code>).</p>}

      <section aria-labelledby="h-files">
        <h2 id="h-files">Pliki do pobrania</h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-files">
          <table>
            <caption id="cap-files">Pliki eksportu listy</caption>
            <thead><tr><th scope="col">Plik</th><th scope="col">Format</th><th scope="col">Warunki korzystania</th><th scope="col">Zawartość</th></tr></thead>
            <tbody>
              {FILES.map((f) => (
                <tr key={f.plik}>
                  <td><a href={exportUrl(f.plik)} download>{f.plik}</a></td>
                  <td>{f.format}</td><td>{f.licencja}</td><td>{f.opis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h-api" className="panel">
        <h2 id="h-api">API dla programistów</h2>
        <p>REST API w JSON ze stronicowaniem i filtrami. Dokumentacja interaktywna: <a href="/api/docs">Swagger</a>.</p>
        <ul className="plain-code">
          <li><code>GET {API_BASE}/aed?wojewodztwo=mazowieckie&amp;dostepne_teraz=true&amp;page=1&amp;per_page=50</code></li>
          <li><code>GET {API_BASE}/aed/najblizsze?lat=52.2297&amp;lon=21.0122&amp;limit=5</code></li>
          <li><code>GET {API_BASE}/aed/AED-PL-B939F7EBA4</code></li>
          <li><code>GET {API_BASE}/zbiory</code> · <code>GET {API_BASE}/statystyki</code></li>
        </ul>
      </section>

      <section aria-labelledby="h-fields">
        <h2 id="h-fields">Opis pól (wzorzec danych AED)</h2>
        <div className="segmented" role="group" aria-label="Pokaż pola">
          {(['', 'wymagane', 'zalecane', 'opcjonalne'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={only === v} onClick={() => setOnly(v)}>{v || 'wszystkie'}</button>
          ))}
        </div>
        <p role="status" className="hint">Pokazano {shown.length} z {FIELDS.length} pól.</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-fields">
          <table>
            <caption id="cap-fields">Słownik danych</caption>
            <thead><tr><th scope="col">Pole</th><th scope="col">Opis</th><th scope="col">Typ i format</th><th scope="col">Przykład</th><th scope="col">Obowiązkowość</th></tr></thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.nazwa_pola}>
                  <th scope="row"><code>{f.nazwa_pola}</code><br />{f.etykieta}</th>
                  <td>{f.opis}</td>
                  <td>{f.typ}{f.format ? <><br /><code>{f.format}</code></> : null}{f.slownik ? <><br />słownik: {f.slownik}</> : null}</td>
                  <td><code>{f.przyklad}</code></td>
                  <td>{f.obowiazkowosc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
