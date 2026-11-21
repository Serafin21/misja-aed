// E7 – Źródła: zakres referencyjny źródeł + statystyki (only numbers from the API / sample data).
import { getStats, listSources } from '../api/client';
import { ErrorBox, Loading } from '../components/ui';
import { label } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { usePageTitle } from '../router';

function Bar({ value, max, text }: { value: number; max: number; text: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar">
      <span className="bar__label">{text}</span>
      <span className="bar__track" aria-hidden="true"><span className="bar__fill" style={{ width: `${pct}%` }} /></span>
      <span className="bar__value">{value}</span>
    </div>
  );
}

export function Sources() {
  usePageTitle('Źródła danych');
  const src = useAsync(() => listSources(), []);
  const st = useAsync(() => getStats(), []);
  const woj = (st.data?.wg_wojewodztw ?? {}) as Record<string, number>;
  const zr = (st.data?.wg_zrodel ?? {}) as Record<string, number>;
  const maxW = Math.max(0, ...Object.values(woj));
  const maxZ = Math.max(0, ...Object.values(zr));
  return (
    <>
      <h1 id="page-title">Źródła danych i ich zakres</h1>
      <p className="lead">Skąd pochodzą dane o AED, na jakiej licencji i jak dużo wnosi każde źródło. Gdy kilka źródeł opisuje to samo urządzenie, scalamy je w jeden rekord. Pierwszeństwo mają dane od dysponenta.</p>

      {st.data && (
        <ul className="stats" aria-label="Zbiór w liczbach">
          <li className="stat stat--ok"><span className="stat__n">{String(st.data.liczba_aed ?? '–')}</span> AED w zbiorze</li>
          <li className="stat"><span className="stat__n">{String(st.data.liczba_dysponentow ?? '–')}</span> dysponentów</li>
          {st.data.zweryfikowane_12m_proc !== undefined && <li className="stat"><span className="stat__n">{String(st.data.zweryfikowane_12m_proc)}%</span> zweryfikowanych w 12 mies.</li>}
        </ul>
      )}

      <section aria-labelledby="h-ref">
        <h2 id="h-ref">Zakres referencyjny źródeł</h2>
        {src.loading && <Loading />}
        {src.error && <ErrorBox error={src.error} onRetry={src.reload} />}
        {src.data && (
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-src">
            <table>
              <caption id="cap-src">Źródła (to samo co plik zrodla.csv)</caption>
              <thead>
                <tr>
                  <th scope="col">Źródło</th><th scope="col">Typ</th><th scope="col">Format</th><th scope="col">Licencja</th>
                  <th scope="col">Rekordy (włączone)</th><th scope="col">Pola wymagane</th><th scope="col">Pola zalecane</th>
                  <th scope="col">Aktualizacja</th><th scope="col">Obszar</th>
                </tr>
              </thead>
              <tbody>
                {src.data.map((s) => (
                  <tr key={s.kod_zrodla}>
                    <th scope="row">{s.nazwa}<br /><code>{s.kod_zrodla}</code></th>
                    <td>{s.typ_zrodla}</td><td>{s.format}</td><td>{s.licencja}</td>
                    <td>{s.liczba_rekordow} ({s.rekordy_wlaczone})</td>
                    <td>{s.pokrycie_pol_wymaganych_proc}%</td><td>{s.pokrycie_pol_zalecanych_proc}%</td>
                    <td>{s.czestotliwosc_aktualizacji}</td><td>{s.obszar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">„Pola wymagane” i „Pola zalecane” – jaki odsetek pól ze wzorcowego zakresu danych źródło wypełnia.</p>
      </section>

      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.data && (
        <div className="card-grid">
          <section aria-labelledby="h-woj" className="panel">
            <h2 id="h-woj">AED według województw</h2>
            {Object.entries(woj).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Bar key={k} text={k} value={v} max={maxW} />)}
          </section>
          <section aria-labelledby="h-zr" className="panel">
            <h2 id="h-zr">Rekordy według głównego źródła</h2>
            {Object.entries(zr).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Bar key={k} text={label('zrodlo_danych', k)} value={v} max={maxZ} />)}
          </section>
        </div>
      )}
    </>
  );
}
