// E8 – Akcja „AED w danych”: name, slogan and logo from the team (brand/), reasons, counters from the API, call to action.
import { getStats } from '../api/client';
import { BRAND_CTA, BRAND_NAME, BRAND_SLOGAN, DataPin, LogoMark, Pin } from '../components/Brand';
import { useAsync } from '../lib/useAsync';
import { Link, usePageTitle } from '../router';

export function Campaign() {
  usePageTitle(`Akcja ${BRAND_NAME}`);
  const st = useAsync(() => getStats(), []);
  return (
    <>
      <section className="campaign-hero" aria-labelledby="page-title">
        <LogoMark size={120} title={`Logo akcji ${BRAND_NAME}: serce z kwadratów, jeden bursztynowy – Twoje AED`} />
        <div>
          <h1 id="page-title" className="campaign-hero__title">{BRAND_SLOGAN}</h1>
          <p className="campaign-hero__cta">{BRAND_CTA}</p>
          <p className="form-actions"><Link to="/dysponenci" className="btn btn--primary btn--xl">Dodaj swoje AED</Link></p>
          <p className="lead">Akcja „{BRAND_NAME}” jest dla dysponentów defibrylatorów: urzędów, szkół, uczelni, szpitali, straży, firm i organizacji. Każda komórka serca w logo to jeden wiersz w zbiorze – jedno AED, które ktoś znajdzie na mapie.</p>
        </div>
      </section>

      {st.data && (
        <ul className="stats" aria-label="Akcja w liczbach">
          <li className="stat stat--ok"><span className="stat__n">{String(st.data.liczba_aed ?? '–')}</span> AED w zbiorze</li>
          <li className="stat"><span className="stat__n">{String(st.data.liczba_dysponentow ?? '–')}</span> dysponentów udostępnia dane</li>
          {st.data.nieaktualne !== undefined && <li className="stat stat--warn"><span className="stat__n">{String(st.data.nieaktualne)}</span> AED czeka na potwierdzenie danych (ponad rok)</li>}
          {st.data.gminy_bez_danych !== undefined && <li className="stat"><span className="stat__n">{String(st.data.gminy_bez_danych)}</span> gmin w Polsce (z 2 479) bez żadnego AED na wspólnej liście</li>}
        </ul>
      )}

      <section aria-labelledby="h-why">
        <h2 id="h-why">Dlaczego warto udostępnić dane</h2>
        <ol className="reasons">
          <li><h3>Świadek znajdzie Twoje AED</h3><p>Otwarte dane z dane.gov.pl może wykorzystać każda mapa i aplikacja – razem z informacją, jak otworzyć szafkę.</p></li>
          <li><h3>Raz wpisane, wszędzie aktualne</h3><p>Jeden wzorcowy zakres danych i jeden plik zamiast wielu formularzy. Aktualizujesz w jednym miejscu.</p></li>
          <li><h3>Twoje AED ma paszport</h3><p>Karta AED ma przycisk „Potwierdź, że jest na miejscu” – każdy przechodzień może pomóc utrzymać dane aktualne.</p></li>
        </ol>
      </section>

      <section aria-labelledby="h-how" className="panel">
        <h2 id="h-how">Jak to działa na mapie</h2>
        <ul className="legend-list">
          <li><Pin kind="ok" size={36} />Zielona pinezka – AED dostępne teraz</li>
          <li><Pin kind="closed" size={36} />Bursztynowa ze znaczkiem zegara – teraz zamknięte lub z ograniczeniami</li>
          <li><Pin kind="unknown" size={36} />Biała z szarym obrysem – brak godzin, sprawdź na miejscu</li>
        </ul>
        <p>Drugi tryb mapy, „Aktualność danych”, pokazuje, jak dawno ktoś sprawdził dane:</p>
        <ul className="legend-list">
          <li><DataPin kind="aktualne" size={36} />Zielona z sercem z komórek – dane sprawdzone w ostatnich 12 miesiącach</li>
          <li><DataPin kind="nieaktualne" size={36} />Biała z bursztynowym sercem i zegarem – dane starsze niż rok albo bez daty</li>
        </ul>
        <p><Link to="/mapa?tryb=dane">Zobacz mapę aktualności danych</Link></p>
      </section>
    </>
  );
}
