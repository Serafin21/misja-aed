// Home: three big choices + first aid bar (TL: simple site for people who rarely use the internet).
import { Link, usePageTitle } from '../router';

const TILES = [
  { to: '/znajdz', title: 'Znajdź najbliższe AED', text: 'Pokażemy defibrylatory w pobliżu i powiemy, czy są teraz dostępne.' },
  { to: '/zglos', title: 'Zgłoś AED, które widzisz', text: 'Widzisz defibrylator, którego nie ma na mapie? Daj nam znać w 4 krokach.' },
  { to: '/dysponenci', title: 'Dodaj AED swojej instytucji', text: 'Urząd, szkoła, firma: wgraj listę z pliku albo wpisz AED ręcznie.' },
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
    </>
  );
}
