// E10 – Pierwsza pomoc. Text given by the team VERBATIM (do not add medical advice here).
// Steps in words only; one side photo of a real AED (CC0, Wikimedia Commons, source in the caption). Content to be checked by a rescuer or mentor.
import { ExternalLink, Icon } from '../components/ui';
import { usePageTitle } from '../router';

const ADULT_STEPS = [
  'Upewnij się, że jest bezpiecznie dla ciebie i poszkodowanego.',
  'Sprawdź, czy reaguje: głośno zawołaj i delikatnie potrząśnij za ramiona.',
  'Nie reaguje? Zadzwoń pod 112 i włącz głośnik telefonu. Dyspozytor poprowadzi cię krok po kroku.',
  'Sprawdź oddech. Brak oddechu albo oddech rzadki, chrapliwy, jak łapanie powietrza, oznacza zatrzymanie krążenia. Jeśli nie masz pewności, działaj tak, jakby nie oddychał.',
  'Jeśli ktoś jest obok, wyślij go po najbliższe AED. Jeśli jesteś sam, zacznij uciskać i słuchaj dyspozytora.',
  'Uciskaj środek klatki piersiowej (dolną połowę mostka): dłonie jedna na drugiej, proste łokcie, głębokość 5–6 cm, tempo 100–120 razy na minutę. Po każdym ucisku pozwól klatce wrócić. Bez szkolenia uciskaj bez przerwy. Jeśli umiesz, rób 30 uciśnięć i 2 oddechy.',
  'Gdy AED jest na miejscu, włącz je i wykonuj polecenia głosowe. Przyklej elektrody na gołą skórę tak, jak pokazuje rysunek. Biustonosz możesz zostawić, jeśli nie przeszkadza.',
  'Podczas analizy i wyładowania nikt nie dotyka poszkodowanego. Zaraz potem wróć do uciskania.',
  'Nie przerywaj, dopóki nie przejmą ratownicy albo poszkodowany nie zacznie się ruszać i normalnie oddychać.',
];

const PHOTO_PAGE = 'https://commons.wikimedia.org/wiki/File:Automated_external_defibrillator_(AED)_Automatyczny_defibrylator_zewn%C4%99trzny,_Tomasz%C3%B3w_Mazowiecki,_Poland.jpg';

/** Side photo (CC0, Wikimedia Commons). Hidden when the file is missing. */
function AedPhoto() {
  return (
    <figure className="aid-photo">
      <img
        src="/img/aed-tomaszow-mazowiecki.jpg"
        width={800}
        height={450}
        alt="Zielona okrągła szafka z AED zawieszona na drewnianej ścianie przy chodniku. Na szafce biały znak: serce z błyskawicą."
        onError={(e) => { (e.currentTarget.closest('figure') as HTMLElement | null)?.setAttribute('hidden', ''); }}
      />
      <figcaption>
        Tak może wyglądać AED w miejscu publicznym (Tomaszów Mazowiecki).
        Zdjęcie: WrS.tm.pl, <ExternalLink href={PHOTO_PAGE}>Wikimedia Commons</ExternalLink>, CC0 (domena publiczna).
      </figcaption>
    </figure>
  );
}

export function FirstAid() {
  usePageTitle('Pierwsza pomoc');
  return (
    <article className="firstaid">
      <h1 id="page-title">Pierwsza pomoc: jak użyć AED</h1>
      <p className="firstaid__call"><a href="tel:112" className="btn-call btn-call--big"><Icon name="phone" />Dzwoń 112</a></p>
      <p className="lead">Każdy może pomóc. Każdy może użyć AED, także bez szkolenia. Urządzenie mówi, co robić, i samo sprawdza, czy potrzebne jest wyładowanie. Uciskając klatkę piersiową, nie wyrządzisz poważnej krzywdy.</p>

      <AedPhoto />

      <h2>Dorosły – krok po kroku</h2>
      <ol className="steps-aid">
        {ADULT_STEPS.map((s) => <li key={s}><span>{s}</span></li>)}
      </ol>

      <h2>Drgawki</h2>
      <p>Na początku zatrzymania krążenia mogą wystąpić krótkie drgawki. Gdy ustaną, sprawdź oddech.</p>

      <h2>Dziecko</h2>
      <p>Sprawdź, zadzwoń pod 112, uciskaj i słuchaj dyspozytora. Po szkoleniu z pierwszej pomocy dzieciom: najpierw 5 oddechów, potem 15 uciśnięć i 2 oddechy. AED można użyć u dziecka. Jeśli są elektrody lub tryb dla dzieci, użyj ich, a jeśli nie, użyj zwykłych.</p>

      <h2>Oddycha normalnie?</h2>
      <p>Zostań przy poszkodowanym i obserwuj oddech. Jeśli przestanie normalnie oddychać, zacznij uciskać.</p>

      <h2>Po wszystkim</h2>
      <p>Ratowanie życia to duży stres. Porozmawiaj z kimś bliskim albo ze specjalistą.</p>

      <p className="aid-source">Na podstawie Wytycznych Europejskiej Rady Resuscytacji 2025 (polskie tłumaczenie: Polska Rada Resuscytacji, prc.krakow.pl). Ta strona nie zastępuje kursu pierwszej pomocy.</p>
    </article>
  );
}
