// E7 – Dostawcy i zbiory (CR-TL-5, docs/MODEL_ROL.md §7–8): provider datasets from GET /zbiory and their status on
// the common list; OSM described separately as the helper layer. Route /zrodla unchanged.
import { listProviderDatasets } from '../api/client';
import type { ZbiorDostawcy } from '../api/types';
import { ErrorBox, ExternalLink, Loading } from '../components/ui';
import { date } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';

function statusText(z: ZbiorDostawcy): string {
  if (z.status === 'poza_lista') return 'poza listą';
  return z.status === 'przejsciowy' ? 'na liście – zbiór przejściowy' : 'na liście – zgodny ze wzorcem';
}

export function Sources() {
  usePageTitle('Dostawcy i zbiory');
  const zb = useAsync(() => listProviderDatasets(), []);
  const rows = zb.data?.data ?? [];
  const osm = zb.data?.meta.warstwa_pomocnicza;
  return (
    <>
      <h1 id="page-title">Dostawcy i zbiory</h1>
      <p className="lead">Wspólna lista AED powstaje tylko ze zbiorów, które właściciele AED opublikowali na swoich kontach w dane.gov.pl. Nie łączymy ani nie poprawiamy rekordów różnych dostawców – za każdy rekord odpowiada wskazany dostawca.</p>

      <section aria-labelledby="h-zb">
        <h2 id="h-zb">Zbiory dostawców</h2>
        {zb.loading && <Loading />}
        {zb.error && <ErrorBox error={zb.error} onRetry={zb.reload} />}
        {zb.data?.atrapa && (
          <p className="callout callout--warn" role="note">Przykład (fikcyjni dostawcy): serwer danych nie udostępnia jeszcze listy zbiorów, więc pokazujemy, jak będzie wyglądać.</p>
        )}
        {zb.data && (
          <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-zb">
            <table>
              <caption id="cap-zb">Zbiory AED dostawców i ich miejsce na wspólnej liście{zb.data.meta.agregacja ? ` (stan z ${date(zb.data.meta.agregacja)})` : ''}</caption>
              <thead>
                <tr>
                  <th scope="col">Dostawca</th><th scope="col">Zbiór</th><th scope="col">Status</th>
                  <th scope="col">AED</th><th scope="col">Dane na dzień</th><th scope="col">Zasady korzystania</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((z) => (
                  <tr key={z.zbior_id}>
                    <th scope="row">{z.dostawca}</th>
                    <td>{z.zbior_url ? <ExternalLink href={z.zbior_url}>{z.tytul}</ExternalLink> : z.tytul}</td>
                    <td>
                      {statusText(z)}
                      {z.nieaktualny && <><br /><span className="badge badge--warn">po terminie aktualizacji</span></>}
                      {z.problemy.length > 0 && <ul className="plain-list hint">{z.problemy.map((p) => <li key={p}>{p}</li>)}</ul>}
                    </td>
                    <td>{z.rekordy}</td>
                    <td>{z.data_danych ? date(z.data_danych) : '—'}</td>
                    <td>{z.licencja ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <dl className="facts">
          <dt>Na liście – zgodny ze wzorcem</dt><dd>zbiór ma 44 pola wzorca danych AED i metadane zgodne z harvesterem dane.gov.pl.</dd>
          <dt>Na liście – zbiór przejściowy</dt><dd>zbiór opublikowany przed wzorcem; pokazujemy dane dostawcy bez zmian, a dostawcę zapraszamy do przejścia na wzorzec.</dd>
          <dt>Poza listą</dt><dd>zbioru nie da się odczytać albo brakuje w nim danych potrzebnych na mapie; dostawca dostaje raport z powodem.</dd>
          <dt>Po terminie aktualizacji</dt><dd>dostawca nie zaktualizował zbioru w zadeklarowanym rytmie (plus 30 dni).</dd>
        </dl>
        <p><Link to="/dysponenci">Masz AED? Zobacz, jak opublikować dane swojej instytucji</Link></p>
      </section>

      <section aria-labelledby="h-osm" className="panel">
        <h2 id="h-osm">Warstwa pomocnicza: OpenStreetMap</h2>
        <p>Na mapie można włączyć warstwę „Do sprawdzenia” z punktami z OpenStreetMap{osm && osm.obiekty > 0 ? ` (${osm.obiekty.toLocaleString('pl-PL')} punktów)` : ''}. Te punkty <strong>nie należą do wspólnej listy</strong> ani do eksportu:</p>
        <ul>
          <li>wpisują je wolontariusze, a właściciel urządzenia ich nie potwierdził – nikt za nie nie odpowiada,</li>
          <li>licencja ODbL 1.0 wymaga tej samej licencji dla baz pochodnych, więc takie dane nie mogą trafić do zbiorów na dane.gov.pl.</li>
        </ul>
        <p>Służą tylko do wskazania luk: gmin i miejsc, gdzie warto zaprosić właścicieli AED do publikacji.</p>
        <p className="hint">© współtwórcy OpenStreetMap, licencja ODbL 1.0.</p>
      </section>
    </>
  );
}
