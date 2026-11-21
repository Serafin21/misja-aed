import { useEffect, useState } from 'react';
import { probeApi } from './api/client';
import { useMockMode } from './lib/useMockMode';
import { BRAND_NAME, BRAND_SLOGAN, LogoMark } from './components/Brand';
import { Icon } from './components/ui';
import { AedCard } from './pages/AedCard';
import { MapList } from './pages/MapList';
import { Campaign } from './pages/Campaign';
import { Dataset } from './pages/Dataset';
import { Moderation } from './pages/Moderation';
import { Nearest } from './pages/Nearest';
import { Providers } from './pages/Providers';
import { Report } from './pages/Report';
import { Sources } from './pages/Sources';
import { Link, matchPath, useLocation, usePageTitle } from './router';

const NAV = [
  { to: '/', label: 'Najbliższe AED' },
  { to: '/mapa', label: 'Mapa i lista' },
  { to: '/zglos', label: 'Zgłoś AED' },
  { to: '/dysponenci', label: 'Dla dysponentów' },
  { to: '/dane', label: 'Zbiór danych' },
  { to: '/zrodla', label: 'Źródła' },
  { to: '/akcja', label: 'Akcja' },
];

function NotFound() {
  usePageTitle('Nie ma takiej strony');
  return (<><h1>Nie ma takiej strony</h1><p><Link to="/">Wróć do wyszukiwania najbliższego AED</Link></p></>);
}

function Routes() {
  const { path } = useLocation();
  if (path === '/') return <Nearest />;
  if (path === '/mapa') return <MapList />;
  const card = matchPath('/aed/:id', path);
  if (card) return <AedCard id={card.id} />;
  if (path === '/zglos') return <Report />;
  if (path === '/dysponenci') return <Providers />;
  if (path === '/dane') return <Dataset />;
  if (path === '/zrodla') return <Sources />;
  if (path === '/akcja') return <Campaign />;
  if (path === '/moderacja') return <Moderation />;
  return <NotFound />;
}

export function App() {
  const { path } = useLocation();
  const [menu, setMenu] = useState(false);
  const mock = useMockMode();
  useEffect(() => { probeApi(); }, []);
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); document.getElementById('menu-btn')?.focus(); } };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [menu]);

  return (
    <>
      <a className="skip-link" href="#main">Przejdź do treści</a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand" aria-label={`${BRAND_NAME} – strona główna`}>
            <span className="brand__mark"><LogoMark size={34} /></span>
            <span>{BRAND_NAME}<span className="brand__slogan" aria-hidden="true">{BRAND_SLOGAN}</span></span>
          </Link>
          <a href="tel:112" className="header-112"><Icon name="phone" /><span className="visually-hidden">Zadzwoń pod numer alarmowy </span>112</a>
          <button id="menu-btn" type="button" className="menu-btn" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu((m) => !m)}>
            {menu ? 'Zamknij' : 'Menu'}
          </button>
          <nav id="main-nav" aria-label="Główna" className={`main-nav${menu ? ' is-open' : ''}`}>
            <ul>{NAV.map((n) => <li key={n.to}><Link to={n.to}>{n.label}</Link></li>)}</ul>
          </nav>
        </div>
      </header>
      {mock && (
        <div className="demo-banner" role="note">
          <div className="container">Tryb demonstracyjny: dane przykładowe (fikcyjne) z pliku <code>data/sample</code>. Nie używaj ich w prawdziwej sytuacji.</div>
        </div>
      )}
      <main id="main" className="container" tabIndex={-1}>
        <Routes />
      </main>
      <footer className="site-footer">
        <div className="container">
          <p><strong>{BRAND_NAME}</strong> – {BRAND_SLOGAN}. Otwarty zbiór danych o defibrylatorach AED dla portalu dane.gov.pl. Prototyp na HackNation 2026 (zadanie Ministerstwa Cyfryzacji „Misja AED”).</p>
          <ul className="footer-links">
            <li><Link to="/dane">Pobierz dane (CSV, GeoJSON, API)</Link></li>
            <li><Link to="/zrodla">Źródła i licencje</Link></li>
            <li><Link to="/moderacja">Panel moderatora</Link></li>
            <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Mapa: © autorzy OpenStreetMap<span className="visually-hidden"> (otwiera się w nowej karcie)</span></a></li>
          </ul>
        </div>
      </footer>
    </>
  );
}
