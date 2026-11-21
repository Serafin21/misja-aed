// E8 – Akcja „AED w danych” (CR-TL-8, MODEL_ROL §10): campaign page for potential data providers. The campaign mark
// lives here (and in the header link); the app itself has a neutral name. Materials: logo and brand book from brand/
// (copied to public/akcja/), poster and badge generated in the browser from the same pixel heart.
import { BRAND_CTA, BRAND_NAME, BRAND_SLOGAN, heartRects, LogoMark } from '../components/Brand';
import { Link, usePageTitle } from '../router';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const svgHref = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const FONT = 'font-family="Arial, Helvetica, sans-serif"';

/** A4 poster (595 × 842 pt) for institutions: name, slogan, call to action and three steps. */
function posterSvg(): string {
  const steps = ['Załóż konto instytucji', 'Wpisz swoje AED i pobierz pliki', 'Opublikuj je na dane.gov.pl'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">`
    + `<rect width="595" height="842" fill="#EDF2EC"/><rect x="0" y="0" width="595" height="420" fill="#1A7A50"/>`
    + heartRects(197, 70, 40)
    + `<text x="297.5" y="330" ${FONT} font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${esc(BRAND_NAME)}</text>`
    + `<text x="297.5" y="374" ${FONT} font-size="26" font-weight="600" fill="#EDF2EC" text-anchor="middle">${esc(BRAND_SLOGAN)}</text>`
    + `<text x="297.5" y="490" ${FONT} font-size="30" font-weight="700" fill="#0F3B2B" text-anchor="middle">Masz AED w swojej instytucji?</text>`
    + `<text x="297.5" y="530" ${FONT} font-size="24" fill="#0F3B2B" text-anchor="middle">Udostępnij dane o nim na dane.gov.pl</text>`
    + steps.map((t, i) => `<circle cx="110" cy="${600 + i * 60}" r="20" fill="#1A7A50"/>`
      + `<text x="110" y="${608 + i * 60}" ${FONT} font-size="22" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>`
      + `<text x="145" y="${608 + i * 60}" ${FONT} font-size="22" fill="#0F3B2B">${esc(t)}</text>`).join('')
    + `<text x="297.5" y="800" ${FONT} font-size="18" fill="#0F3B2B" text-anchor="middle">Każde AED w danych to szansa, że ktoś je znajdzie na czas.</text>`
    + `</svg>`;
}

/** Badge for providers after publication (MODEL_ROL §10: „Nasze AED jest w danych”). */
function badgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="220" viewBox="0 0 600 220">`
    + `<rect width="600" height="220" rx="24" fill="#1A7A50"/>${heartRects(40, 50, 24)}`
    + `<text x="200" y="92" ${FONT} font-size="32" font-weight="700" fill="#fff">Nasze AED jest w danych</text>`
    + `<text x="200" y="132" ${FONT} font-size="22" fill="#fff">dane.gov.pl</text>`
    + `<text x="200" y="172" ${FONT} font-size="18" font-weight="600" fill="#EDF2EC">${esc(BRAND_NAME)} · ${esc(BRAND_SLOGAN)}</text>`
    + `</svg>`;
}

const FILES = [
  { href: '/akcja/logo.png', name: 'logo_aed_w_danych.png', label: 'Logo (PNG)' },
  { href: '/akcja/logo.svg', name: 'logo_aed_w_danych.svg', label: 'Logo (SVG)' },
  { href: '/akcja/logo.pdf', name: 'logo_aed_w_danych.pdf', label: 'Logo (PDF)' },
  { href: '/akcja/ksiega_znaku.pdf', name: 'ksiega_znaku_aed_w_danych.pdf', label: 'Księga znaku (PDF)' },
];

export function Campaign() {
  usePageTitle(`Akcja „${BRAND_NAME}”`);
  const poster = svgHref(posterSvg());
  const badge = svgHref(badgeSvg());
  return (
    <>
      <section className="campaign-hero" aria-labelledby="page-title">
        <LogoMark size={160} title={`Logo akcji ${BRAND_NAME}: serce z 16 kwadratów, jeden bursztynowy – Twoje AED`} />
        <div>
          <p className="campaign-hero__kicker">Akcja „{BRAND_NAME}”</p>
          <h1 id="page-title" className="campaign-hero__title">{BRAND_SLOGAN}</h1>
          <p className="campaign-hero__cta">{BRAND_CTA}</p>
          <p className="form-actions">
            <Link to="/zglos-aed" className="btn btn--primary btn--xl">Zgłoś AED swojej instytucji</Link>
            <Link to="/dysponenci" className="btn btn--secondary btn--xl">Dla instytucji: jak to działa</Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="h-who">
        <h2 id="h-who">Do kogo jest akcja</h2>
        <p>Do każdej instytucji, która ma AED, a nie ma jeszcze zbioru danych o nim na dane.gov.pl: gmin i urzędów, szkół i uczelni, szpitali i przychodni, dworców, galerii handlowych, obiektów sportowych, firm i wspólnot mieszkaniowych.</p>
      </section>

      <section aria-labelledby="h-why">
        <h2 id="h-why">Co zyskuje Twoja instytucja</h2>
        <ol className="reasons">
          <li><h3>Ktoś znajdzie Twoje AED na czas</h3><p>Dane z dane.gov.pl może pokazać każda mapa i aplikacja – razem z godzinami i informacją, jak otworzyć szafkę.</p></li>
          <li><h3>Jeden wzór zamiast wielu formularzy</h3><p>Wpisujesz AED raz, według jednego wzoru, i aktualizujesz w jednym miejscu.</p></li>
          <li><h3>Uwagi trafiają prosto do Ciebie</h3><p>Gdy ktoś zauważy problem z Twoim AED, zgłoszenie trafi do Twojej instytucji, a nie zginie w internecie.</p></li>
        </ol>
      </section>

      <section aria-labelledby="h-how" className="panel">
        <h2 id="h-how">Jak to zrobić w 3 krokach</h2>
        <ol className="steps-simple">
          <li><Link to="/wniosek-o-konto">Załóż konto instytucji</Link> – administrator sprawdzi wniosek.</li>
          <li><Link to="/zglos-aed">Zgłoś swoje AED</Link> i pobierz gotowe pliki do publikacji.</li>
          <li>Opublikuj pliki na koncie swojej instytucji w dane.gov.pl i aktualizuj je w zadeklarowanym rytmie.</li>
        </ol>
      </section>

      <section aria-labelledby="h-mat">
        <h2 id="h-mat">Materiały do pobrania</h2>
        <p>Możesz ich używać w komunikacji akcji zgodnie z <a href="/akcja/ksiega_znaku.pdf">księgą znaku</a>.</p>
        <ul className="downloads">
          {FILES.map((f) => <li key={f.href}><a href={f.href} download={f.name}>{f.label}</a></li>)}
        </ul>
        <div className="card-grid">
          <figure className="material">
            <img src={poster} width={297} height={421} alt={`Plakat A4 akcji ${BRAND_NAME}: serce z kwadratów, hasło „${BRAND_SLOGAN}”, pytanie „Masz AED w swojej instytucji?” i trzy kroki publikacji danych.`} />
            <figcaption><a className="btn btn--secondary" href={poster} download="plakat_aed_w_danych_A4.svg">Pobierz plakat A4 (SVG)</a></figcaption>
          </figure>
          <figure className="material">
            <img src={badge} width={300} height={110} alt={`Odznaka akcji ${BRAND_NAME}: „Nasze AED jest w danych”, dane.gov.pl.`} />
            <figcaption><a className="btn btn--secondary" href={badge} download="odznaka_nasze_aed_jest_w_danych.svg">Pobierz odznakę (SVG)</a></figcaption>
          </figure>
        </div>
      </section>
    </>
  );
}
