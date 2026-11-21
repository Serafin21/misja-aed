// E10 – Pierwsza pomoc. Text given by the team VERBATIM (do not add medical advice here).
// Illustrations: own simple SVG pictograms (not ERC/PRR graphics). Content to be checked by a rescuer or mentor.
import { Icon } from '../components/ui';
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

/** Simple own pictograms; colours come from CSS (currentColor). Decorative – the text says everything. */
function Pictogram({ kind }: { kind: 'phone' | 'hands' | 'aed' | 'stop' }) {
  const common = { viewBox: '0 0 120 120', 'aria-hidden': true as const, focusable: 'false' as const, className: 'aid-svg' };
  if (kind === 'phone') {
    return (
      <svg {...common}>
        <rect x="35" y="10" width="50" height="100" rx="8" fill="none" stroke="currentColor" strokeWidth="5" />
        <line x1="50" y1="98" x2="70" y2="98" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <text x="60" y="66" textAnchor="middle" fontSize="26" fontWeight="700" fill="currentColor">112</text>
      </svg>
    );
  }
  if (kind === 'hands') {
    return (
      <svg {...common}>
        <path d="M20 105c5-30 20-45 40-45s35 15 40 45" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <rect x="42" y="38" width="36" height="18" rx="9" fill="currentColor" />
        <rect x="42" y="24" width="36" height="18" rx="9" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M60 4v14M52 12l8 8 8-8" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'aed') {
    return (
      <svg {...common}>
        <rect x="15" y="25" width="90" height="70" rx="10" fill="none" stroke="currentColor" strokeWidth="5" />
        <path d="M60 80s-22-13-22-28a11 11 0 0 1 22-4 11 11 0 0 1 22 4c0 15-22 28-22 28z" fill="currentColor" />
        <path d="M63 44l-9 14h7l-3 12 10-16h-7z" fill="var(--color-bg)" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M45 85V50a5 5 0 0 1 10 0v18V38a5 5 0 0 1 10 0v30V42a5 5 0 0 1 10 0v26l3-10a5 5 0 0 1 9 3l-6 20c-3 9-9 14-18 14H58c-7 0-13-4-13-10z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

export function FirstAid() {
  usePageTitle('Pierwsza pomoc');
  return (
    <article className="firstaid">
      <h1 id="page-title">Pierwsza pomoc: jak użyć AED</h1>
      <p className="firstaid__call"><a href="tel:112" className="btn-call btn-call--big"><Icon name="phone" />Dzwoń 112</a></p>
      <p className="lead">Każdy może pomóc. Każdy może użyć AED, także bez szkolenia. Urządzenie mówi, co robić, i samo sprawdza, czy potrzebne jest wyładowanie. Uciskając klatkę piersiową, nie wyrządzisz poważnej krzywdy.</p>

      <div className="aid-figure">
        <figure><Pictogram kind="phone" /><figcaption>Zadzwoń pod 112</figcaption></figure>
        <figure><Pictogram kind="hands" /><figcaption>Uciskaj klatkę piersiową</figcaption></figure>
        <figure><Pictogram kind="aed" /><figcaption>Włącz AED</figcaption></figure>
        <figure><Pictogram kind="stop" /><figcaption>Nie dotykaj podczas analizy</figcaption></figure>
      </div>

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
