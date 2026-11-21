// Home: three big choices + first aid bar (TL: simple site for people who rarely use the internet).
import { LogoMark } from '../components/Brand';
import { Link, usePageTitle } from '../router';

const TILES = [
  { to: '/znajdz', title: 'Znajdź najbliższe AED', text: 'Pokażemy defibrylatory w pobliżu i powiemy, czy są teraz dostępne.' },
  { to: '/pierwsza-pomoc', title: 'Pierwsza pomoc', text: 'Co zrobić, gdy ktoś stracił przytomność: kroki i jak użyć AED.' },
  { to: '/dysponenci', title: 'Dodaj AED swojej instytucji', text: 'Urząd, szkoła, firma: załóż konto, zgłoś AED i opublikuj dane w dane.gov.pl.' },
];

export function Home() {
  usePageTitle('Strona główna');
  return (
    <>
      <h1 id="page-title">Co chcesz zrobić?</h1>
      <p className="lead">Defibrylatora AED może użyć każdy. Urządzenie mówi, co robić.</p>
      <ul className="tiles">
        {TILES.map((t) => (
          <li key={t.to}>
            <Link to={t.to} className="tile">
              <span className="tile__title">{t.title}</span>
              <span className="tile__text">{t.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="firstaid-bar">
        <span>Ktoś stracił przytomność i nie oddycha? Dzwoń 112.</span>
        <Link to="/pierwsza-pomoc">Pierwsza pomoc: jak użyć AED</Link>
      </div>
      <section className="brandbook" aria-labelledby="h-brandbook">
        <LogoMark size={56} />
        <div>
          <h2 id="h-brandbook">Akcja „AED w danych” – księga znaku</h2>
          <p>Logo, kolory i zasady używania znaku akcji. Na ostatniej stronie księgi kliknij format (SVG, PNG, JPG, PDF), aby pobrać wybraną wersję logo.</p>
          <p className="brandbook__links">
            <a className="btn btn--secondary" href="/akcja/ksiega_znaku.pdf" target="_blank" rel="noopener">Otwórz księgę znaku (PDF, 3,9 MB)<span className="visually-hidden"> – otwiera się w nowym oknie</span></a>
            <a className="btn btn--tertiary" href="/akcja/AED_w_danych_logo.zip" download>Pobierz wszystkie pliki logo (ZIP)</a>
          </p>
        </div>
      </section>
    </>
  );
}
