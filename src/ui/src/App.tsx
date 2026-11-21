import { useEffect, useState, type ReactElement } from 'react';
import { probeApi } from './api/client';
import { useMockMode } from './lib/useMockMode';
import { APP_NAME, APP_TAGLINE, BRAND_NAME, LogoMark } from './components/Brand';
import { ExternalLink, Icon } from './components/ui';
import { About, AccessibilityStatement, Contact, Cookies, Licenses, Privacy } from './pages/Info';
import { AedCard } from './pages/AedCard';
import { MapList } from './pages/MapList';
import { Campaign } from './pages/Campaign';
import { Dataset } from './pages/Dataset';
import { Admin } from './pages/Admin';
import { MyAed } from './pages/MyAed';
import { LoginPage, ROLE_HOME, useSession } from './components/Auth';
import { logout } from './api/client';
import { Home } from './pages/Home';
import { FirstAid } from './pages/FirstAid';
import { Providers } from './pages/Providers';
import { Report } from './pages/Report';
import { Sources } from './pages/Sources';
import { ZglosAed } from './pages/ZglosAed';
import { WniosekKonto } from './pages/WniosekKonto';
import { Approvals } from './pages/Admin';
import { Link, matchPath, navigate, useLocation, usePageTitle } from './router';

// Top menu: three items for everyone. "Dla instytucji", data, sources and login are in the footer. After logging in the
// role's own items appear (MODEL_ROL v1.3): institution – "Zgłoś AED" and "Moje AED"; administrator – approvals and panel.
const NAV = [
  { to: '/znajdz', label: 'Znajdź AED' },
  { to: '/pierwsza-pomoc', label: 'Pierwsza pomoc' },
  { to: '/o-projekcie', label: 'O projekcie' },
];
const ROLE_NAV: Record<string, { to: string; label: string }[]> = {
  dysponent: [{ to: '/zglos-aed', label: 'Zgłoś AED' }],
  administrator: [{ to: '/zatwierdzanie', label: 'Zgłoszenia AED' }],
};

// Breadcrumb labels for pages outside the menu
const PAGE_LABELS: Record<string, string> = {
  '/mapa': 'Mapa i lista AED', '/dane': 'Eksport listy', '/zrodla': 'Dostawcy', '/akcja': 'Akcja „AED w danych”',
  '/panel': 'Panel administratora', '/moje-aed': 'Moje AED', '/logowanie': 'Logowanie', '/zglos': 'Zgłoś problem z AED',
  '/dysponenci': 'Dla instytucji', '/zglos-aed': 'Zgłoś AED', '/zatwierdzanie': 'Zgłoszenia AED do zatwierdzenia', '/wniosek-o-konto': 'Wniosek o konto',
};

// Footer subpages (not E1–E9; routes for E1–E9 unchanged)
const INFO_PAGES: Record<string, { title: string; el: () => ReactElement }> = {
  '/o-projekcie': { title: 'O projekcie', el: About },
  '/pierwsza-pomoc': { title: 'Pierwsza pomoc', el: FirstAid },
  '/deklaracja-dostepnosci': { title: 'Deklaracja dostępności', el: AccessibilityStatement },
  '/dane-osobowe': { title: 'Dane osobowe', el: Privacy },
  '/cookies': { title: 'Pliki cookies i pamięć przeglądarki', el: Cookies },
  '/licencje': { title: 'Licencje i atrybucje', el: Licenses },
  '/kontakt': { title: 'Kontakt', el: Contact },
};

const REPO = 'https://github.com/Serafin21/misja-aed';

/** Breadcrumbs (gov.pl pattern): home icon first, hidden below 700 px; not on the home page. */
function Breadcrumbs({ path }: { path: string }) {
  if (path === '/' || path === '/znajdz' || path === '/mapa') return null; // Znajdź AED: no breadcrumbs (owner's request)
  const nav = NAV.find((n) => n.to === path);
  const trail: { label: string; to?: string }[] = [];
  if (matchPath('/aed/:id', path)) trail.push({ label: 'Znajdź AED', to: '/znajdz' }, { label: 'AED' });
  else if (path === '/mapa') trail.push({ label: 'Znajdź AED' });
  else if (nav) trail.push({ label: nav.label });
  else if (INFO_PAGES[path]) trail.push({ label: INFO_PAGES[path].title });
  else if (PAGE_LABELS[path]) trail.push({ label: PAGE_LABELS[path] });
  else return null;
  return (
    <nav aria-label="Ścieżka okruszków" className="breadcrumbs">
      <ol>
        <li><Link to="/"><Icon name="home" /><span className="visually-hidden">Strona główna</span></Link></li>
        {trail.map((t, i) => (
          <li key={t.label}>{t.to ? <Link to={t.to}>{t.label}</Link> : <span aria-current={i === trail.length - 1 ? 'page' : undefined}>{t.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

function NotFound() {
  usePageTitle('Nie ma takiej strony');
  return (<><h1>Nie ma takiej strony</h1><p><Link to="/">Wróć do wyszukiwania najbliższego AED</Link></p></>);
}

function Routes() {
  const { path } = useLocation();
  if (path === '/') return <Home />;
  if (path === '/znajdz' || path === '/mapa') return <MapList />;
  const card = matchPath('/aed/:id', path);
  if (card) return <AedCard id={card.id} />;
  if (path === '/zglos') return <Report />;
  if (path === '/dysponenci') return <Providers />;
  if (path === '/dane') return <Dataset />;
  if (path === '/zrodla') return <Sources />;
  if (path === '/akcja') return <Campaign />;
  if (path === '/panel' || path === '/moderacja') return <Admin />;
  if (path === '/moje-aed' || path === '/konto') return <MyAed />;
  if (path === '/logowanie') return <LoginPage />;
  if (path === '/zglos-aed') return <ZglosAed />;
  if (path === '/zatwierdzanie') return <Approvals />;
  if (path === '/wniosek-o-konto') return <WniosekKonto />;
  const info = INFO_PAGES[path];
  if (info) { const Page = info.el; return <Page />; }
  return <NotFound />;
}

export function App() {
  const { path } = useLocation();
  const [menu, setMenu] = useState(false);
  const mock = useMockMode();
  const session = useSession();
  const roleHome = session ? ROLE_HOME[session.rola] : null;
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
      <a className="skip-link" href="#main">Przejdź do treści głównej</a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand" aria-label={`${APP_NAME} – strona główna`}>
            <span className="brand__mark"><LogoMark size={34} /></span>
            <span>{APP_NAME}<span className="brand__slogan" aria-hidden="true">{APP_TAGLINE}</span></span>
          </Link>
          <button id="menu-btn" type="button" className="menu-btn" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu((m) => !m)}>
            {menu ? 'Zamknij' : 'Menu'}
          </button>
          <nav id="main-nav" aria-label="Główna" className={`main-nav${menu ? ' is-open' : ''}`}>
            <ul>
              {NAV.map((n) => <li key={n.to}><Link to={n.to}>{n.label}</Link></li>)}
              {!session && <li className="main-nav__login"><Link to="/logowanie">Zaloguj się, aby dodać AED</Link></li>}
              {session && (ROLE_NAV[session.rola] ?? []).map((n) => <li key={n.to} className="main-nav__role"><Link to={n.to}>{n.label}</Link></li>)}
              {/* only after logging in (docs/MODEL_ROL.md §4) – the server checks permissions on every operation anyway */}
              {roleHome && <li className="main-nav__role"><Link to={roleHome.to}>{roleHome.label}</Link></li>}
              {session && <li><button type="button" className="main-nav__logout" onClick={() => { logout(); navigate('/'); }}>Wyloguj</button></li>}
            </ul>
          </nav>
        </div>
      </header>
      <div className="prototype-bar" role="note">
        <div className="container"><p>Prototyp zespołu HackNation 2026 – nie jest serwisem administracji publicznej</p></div>
      </div>
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
          <div className="footer-grid">
            <section aria-labelledby="f-about">
              <h2 id="f-about">{APP_NAME}</h2>
              <p>Mapa wspólnej listy AED: dane publikują właściciele urządzeń na swoich kontach w dane.gov.pl i każdy z nich odpowiada za swoje dane.</p>
              <p><Link to="/akcja">Akcja „{BRAND_NAME}” dla właścicieli AED</Link></p>
              <p>Prototyp zespołu HackNation 2026 – nie jest serwisem administracji publicznej.</p>
            </section>
            <nav aria-labelledby="f-info">
              <h2 id="f-info">Informacje</h2>
              <ul className="footer-links">
                <li><Link to="/o-projekcie">O projekcie</Link></li>
                <li><Link to="/akcja">Akcja „AED w danych”</Link></li>
                <li><Link to="/deklaracja-dostepnosci">Deklaracja dostępności</Link></li>
                <li><Link to="/dane-osobowe">Dane osobowe</Link></li>
                <li><Link to="/cookies">Pliki cookies i pamięć przeglądarki</Link></li>
                <li><Link to="/kontakt">Kontakt</Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="f-pro">
              <h2 id="f-pro">Dla specjalistów</h2>
              <ul className="footer-links">
                <li><Link to="/dysponenci">Dla instytucji</Link></li>
                <li><Link to="/dane">Eksport listy</Link></li>
                <li><Link to="/zrodla">Dostawcy</Link></li>
                <li><Link to="/logowanie">Logowanie dla dostawców i administratorów</Link></li>
                <li><Link to="/licencje">Licencje i atrybucje</Link></li>
                <li><ExternalLink href={REPO}>Kod źródłowy</ExternalLink></li>
              </ul>
            </nav>
            <section aria-labelledby="f-contact">
              <h2 id="f-contact">Kontakt</h2>
              <address className="footer-contact">[ADRES / KONTAKT ZESPOŁU]</address>
            </section>
          </div>
          <p className="footer-legal">© 2026 Autorzy projektu „{APP_NAME}”, HackNation 2026. Mapa i dane OpenStreetMap: © autorzy OpenStreetMap (ODbL). Granice gmin: Państwowy Rejestr Granic – GUGiK.</p>
        </div>
      </footer>
    </>
  );
}
