// Footer pages: O projekcie, Deklaracja dostępności, Dane osobowe, Pliki cookies, Licencje i atrybucje, Kontakt.
// Only facts about this prototype – nothing about services we do not run.
import { APP_NAME, BRAND_NAME, BRAND_SLOGAN, BRAND_CTA } from '../components/Brand';
import { ExternalLink } from '../components/ui';
import { Link, usePageTitle } from '../router';

const REPO = 'https://github.com/Serafin21/misja-aed';
const UPDATED = '21.11.2026';

export function About() {
  usePageTitle('O projekcie');
  return (
    <article className="prose">
      <h1 id="page-title">O projekcie</h1>
      <p className="lead">{APP_NAME} – mapa wspólnej listy AED. Dane o każdym defibrylatorze publikuje jego właściciel na swoim koncie w dane.gov.pl i to on odpowiada za ich jakość i aktualność.</p>
      <p>To prototyp przygotowany przez zespół uczestników hackathonu HackNation 2026 w ramach zadania Ministerstwa Cyfryzacji „Misja AED – dane na ratunek”. <strong>Nie jest serwisem administracji publicznej</strong> i nie zastępuje numeru alarmowego 112.</p>
      <h2>Co robi</h2>
      <ul>
        <li>Pokazuje na jednej mapie defibrylatory ze zbiorów, które ich właściciele (urzędy, szkoły, szpitale, firmy) opublikowali w dane.gov.pl według wspólnego wzoru. Przy każdym AED widać, kto odpowiada za dane i kiedy je sprawdzono.</li>
        <li>Pomaga właścicielom przygotować pliki do publikacji (kreator „Moje AED”) – publikują je sami, na koncie swojej instytucji.</li>
        <li>Punkty z mapy OpenStreetMap pokazuje osobno, jako „do sprawdzenia” – nie należą do wspólnej listy.</li>
        <li>Przekazuje zgłoszenia mieszkańców właścicielowi urządzenia. Ministerstwo nie wprowadza ani nie poprawia danych – prowadzi konta, wzór danych i akcję „{BRAND_NAME}”.</li>
        <li>Pokazuje najbliższe AED, które są dostępne teraz, i to, jak aktualne są dane o każdym z nich.</li>
        <li>Pomaga instytucjom dodać swoje AED: z pliku albo ręcznie, krok po kroku.</li>
      </ul>
      <h2>Więcej</h2>
      <ul>
        <li><Link to="/pierwsza-pomoc">Pierwsza pomoc: jak użyć AED</Link></li>
        <li><Link to="/akcja">Akcja „AED w danych”</Link> – zachęcamy instytucje, żeby dodały swoje AED.</li>
        <li>Dla specjalistów: <Link to="/dane">zbiór danych</Link> i <Link to="/zrodla">źródła danych</Link>.</li>
        <li><ExternalLink href={REPO}>Kod źródłowy i dokumentacja w serwisie GitHub</ExternalLink></li>
        <li><ExternalLink href={`${REPO}/blob/main/docs/AI_USAGE.md`}>Zakres wykorzystania sztucznej inteligencji</ExternalLink></li>
      </ul>
    </article>
  );
}

export function AccessibilityStatement() {
  usePageTitle('Deklaracja dostępności');
  return (
    <article className="prose">
      <h1 id="page-title">Deklaracja dostępności</h1>
      <p>Zespół projektu „{APP_NAME}” chce, aby ten serwis był dostępny dla wszystkich, zgodnie ze standardem WCAG 2.2 na poziomie AA. Prototyp nie jest serwisem podmiotu publicznego, ale opisujemy jego dostępność tak, jak wymaga tego ustawa o dostępności cyfrowej.</p>
      <ul>
        <li>Data publikacji serwisu: {UPDATED}.</li>
        <li>Data ostatniej aktualizacji: {UPDATED}.</li>
      </ul>
      <h2>Stan dostępności cyfrowej</h2>
      <p>Serwis jest <strong>częściowo zgodny</strong> z WCAG 2.2 AA, ponieważ nie wszystkie testy zostały jeszcze przeprowadzone. Niezgodności i braki opisujemy niżej.</p>
      <h2>Co sprawdziliśmy</h2>
      <ul>
        <li>Kontrast tekstu i elementów interfejsu, dostępne nazwy przycisków, linków i pól, rozmiar celów dotykowych, strukturę nagłówków – automatycznym skryptem na wszystkich ekranach, przy szerokości 1280 i 320 pikseli.</li>
        <li>Obsługę klawiaturą przełącznika trybów mapy i formularzy, widoczny fokus, brak przewijania w poziomie przy 320 pikselach – ręcznie w przeglądarce.</li>
        <li>Kontrast palety kolorów – wartości w raporcie dostępności w repozytorium projektu.</li>
      </ul>
      <h2>Znane ograniczenia</h2>
      <ul>
        <li>Mapa jest obrazem z kafelków. Te same informacje są na liście obok mapy, a każda pinezka ma tekstową nazwę.</li>
        <li>Nie przeprowadziliśmy jeszcze testów z czytnikiem ekranu (NVDA) ani audytu narzędziami axe i Lighthouse.</li>
        <li>Na telefonie podstawowy tekst ma 14 pikseli; można go powiększyć narzędziami przeglądarki bez utraty treści.</li>
        <li>Pliki PDF (prezentacja, księga znaku) nie są dokumentami dostępnymi – ich treść jest też w plikach tekstowych w repozytorium.</li>
      </ul>
      <h2>Przygotowanie deklaracji</h2>
      <p>Deklarację sporządziliśmy {UPDATED} na podstawie samooceny zespołu. Szczegóły: <ExternalLink href={`${REPO}/blob/main/docs/a11y/raport.md`}>raport dostępności</ExternalLink>.</p>
      <h2>Informacje zwrotne i kontakt</h2>
      <p>Jeśli coś nie działa albo jest niedostępne, napisz do nas – dane kontaktowe są na stronie <Link to="/kontakt">Kontakt</Link>. Możesz też zgłosić problem w serwisie GitHub: <ExternalLink href={`${REPO}/issues`}>zgłoszenia w repozytorium</ExternalLink>.</p>
      <p>Prototyp nie jest prowadzony przez podmiot publiczny, dlatego nie ma do niego zastosowania procedura wnioskowo-skargowa z ustawy o dostępności cyfrowej.</p>
      <h2>Aplikacje mobilne</h2>
      <p>Serwis nie ma aplikacji mobilnej. Strona działa w przeglądarce na telefonie.</p>
    </article>
  );
}

export function Privacy() {
  usePageTitle('Dane osobowe');
  return (
    <article className="prose">
      <h1 id="page-title">Dane osobowe</h1>
      <p className="lead">Serwis nie zbiera danych osobowych. Nie zakładasz konta, nie podajesz imienia, nazwiska, adresu e-mail ani telefonu.</p>
      <h2>Twoja lokalizacja</h2>
      <p>Przeglądarka pyta o zgodę na lokalizację dopiero, gdy wybierzesz „Pokaż najbliższe AED” albo „Użyj mojej lokalizacji”. Współrzędne są wysyłane do serwera tylko po to, by znaleźć najbliższe AED albo wskazać miejsce zgłoszenia. Nie zapisujemy ich w bazie danych przy wyszukiwaniu.</p>
      <h2>Zgłoszenia i potwierdzenia</h2>
      <p>Zgłoszenie AED i potwierdzenie z „Paszportu AED” zawierają tylko miejsce, odpowiedzi i opis. Prosimy, by w opisie nie wpisywać imion, nazwisk ani numerów telefonu. Zgłoszenie z miejscem trafia do moderacji, a po zatwierdzeniu – do otwartego zbioru danych.</p>
      <h2>Informacje techniczne</h2>
      <ul>
        <li>Oprogramowanie serwera zapisuje standardowe dzienniki techniczne: adres IP, czas i adres zapytania (przy wyszukiwaniu najbliższych AED – także współrzędne). W prototypie nie analizujemy ich.</li>
        <li>Aby ograniczyć nadużycia, serwer pamięta adres IP przez minutę przy wysyłaniu zgłoszeń i potwierdzeń (tylko w pamięci, bez zapisu w bazie).</li>
        <li>Fragmenty mapy pobierane są z serwera OpenStreetMap, który otrzymuje Twój adres IP. Zasady: <ExternalLink href="https://osmfoundation.org/wiki/Privacy_Policy">polityka prywatności OpenStreetMap Foundation</ExternalLink>.</li>
        <li>Konta instytucji i moderatora w prototypie to wspólne konta demonstracyjne – nie są przypisane do osób.</li>
      </ul>
      <p>Więcej o tym, co przeglądarka przechowuje: <Link to="/cookies">Pliki cookies i pamięć przeglądarki</Link>.</p>
    </article>
  );
}

export function Cookies() {
  usePageTitle('Pliki cookies i pamięć przeglądarki');
  return (
    <article className="prose">
      <h1 id="page-title">Pliki cookies i pamięć przeglądarki</h1>
      <p className="lead">Serwis nie używa plików cookies ani narzędzi analitycznych. Przeglądarka przechowuje tylko to, co jest w tabeli.</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="cap-store">
        <table>
          <caption id="cap-store">Co przeglądarka przechowuje</caption>
          <thead><tr><th scope="col">Nazwa</th><th scope="col">Rodzaj</th><th scope="col">Po co</th><th scope="col">Jak długo</th></tr></thead>
          <tbody>
            <tr><td><code>aed.session</code></td><td>pamięć sesji przeglądarki (sessionStorage)</td><td>przechowuje token logowania na konto demonstracyjne instytucji albo moderatora – tylko po zalogowaniu</td><td>do wylogowania albo zamknięcia karty</td></tr>
            <tr><td><code>aed.szkic.instytucja</code></td><td>pamięć przeglądarki na tym urządzeniu (localStorage)</td><td>szkic AED wpisywanych ręcznie przez instytucję („Możesz wrócić później”)</td><td>do opublikowania AED albo wyczyszczenia danych przeglądarki</td></tr>
          </tbody>
        </table>
      </div>
      <p>Czcionka Open Sans jest dostarczana z naszego serwera – nie łączymy się z zewnętrznymi serwisami czcionek. Fragmenty mapy pochodzą z serwera OpenStreetMap (zob. <Link to="/dane-osobowe">Dane osobowe</Link>).</p>
      <p>Pamięć sesji możesz wyczyścić w ustawieniach przeglądarki albo przyciskiem „Wyloguj”.</p>
    </article>
  );
}

export function Licenses() {
  usePageTitle('Licencje i atrybucje');
  return (
    <article className="prose">
      <h1 id="page-title">Licencje i atrybucje</h1>
      <h2>Dane</h2>
      <ul>
        <li><strong>Zbiór AED</strong> (<code>aed.csv</code>, <code>aed.geojson</code>, <code>aed.jsonld</code>) – licencja podana w każdym rekordzie: CC0 1.0 albo CC BY 4.0, zgodnie z wyborem dysponenta.</li>
        <li><strong>OpenStreetMap</strong> – dane AED i mapa: © autorzy OpenStreetMap, licencja Open Database License (ODbL 1.0). Dane z OpenStreetMap publikujemy wyłącznie w osobnych zasobach <code>aed_osm_odbl.*</code>. <ExternalLink href="https://www.openstreetmap.org/copyright">Prawa autorskie OpenStreetMap</ExternalLink></li>
        <li><strong>Zdjęcie AED na stronie „Pierwsza pomoc”</strong> – autor: WrS.tm.pl, Wikimedia Commons, CC0 1.0 (domena publiczna). <ExternalLink href="https://commons.wikimedia.org/wiki/File:Automated_external_defibrillator_(AED)_Automatyczny_defibrylator_zewn%C4%99trzny,_Tomasz%C3%B3w_Mazowiecki,_Poland.jpg">Strona zdjęcia</ExternalLink></li>
        <li><strong>Granice gmin</strong> – Źródło: Państwowy Rejestr Granic – Główny Urząd Geodezji i Kartografii; dane udostępniane bez opłat.</li>
      </ul>
      <h2>Oprogramowanie w przeglądarce</h2>
      <ul>
        <li>React, React DOM – MIT</li>
        <li>Leaflet – BSD-2-Clause</li>
        <li>Leaflet.markercluster – MIT</li>
        <li>qrcode-generator – MIT</li>
        <li>Open Sans (czcionka interfejsu) – SIL Open Font License 1.1</li>
        <li>Inter (czcionka w logotypie, zamieniona na krzywe) – SIL Open Font License 1.1</li>
      </ul>
      <h2>Oprogramowanie serwera</h2>
      <ul>
        <li>FastAPI – MIT; Uvicorn – BSD-3-Clause; python-multipart – Apache-2.0; jsonschema – MIT; openpyxl – MIT; RapidFuzz – MIT</li>
      </ul>
      <p>Pełna lista i sprawdzenie licencji: <ExternalLink href={REPO}>repozytorium projektu</ExternalLink>.</p>
    </article>
  );
}

export function Contact() {
  usePageTitle('Kontakt');
  return (
    <article className="prose">
      <h1 id="page-title">Kontakt</h1>
      <div className="callout callout--error" role="note">
        <p className="callout__title">W nagłym wypadku dzwoń pod numer 112</p>
        <p>Ten serwis nie przyjmuje zgłoszeń alarmowych.</p>
      </div>
      <h2>Zespół projektu</h2>
      <address className="footer-contact">[ADRES / KONTAKT ZESPOŁU]</address>
      <h2>Zgłoszenia i uwagi</h2>
      <ul>
        <li>Błędne dane o AED: otwórz kartę urządzenia i wybierz „Zgłoś problem z tym AED”. Brakujące AED zgłasza instytucja, która za nie odpowiada – <Link to="/zglos">jak to działa</Link>.</li>
        <li>Błędy serwisu i problemy z dostępnością: <ExternalLink href={`${REPO}/issues`}>zgłoszenia w serwisie GitHub</ExternalLink>.</li>
      </ul>
    </article>
  );
}
