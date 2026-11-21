// E1 – Najbliższe AED (start). Goal: a stressed person on a phone finds the nearest available AED in 2 taps.
import { useState } from 'react';
import { nearestAed } from '../api/client';
import { PlaceSearch, type Wybor } from '../components/PlaceSearch';
import { useMockMode } from '../lib/useMockMode';
import type { AedView } from '../api/types';
import { AedListItem } from '../components/AedListItem';
import { MapView } from '../components/MapView';
import { CoverageList, MapLegend, MapModeSwitch, useCoverage, useMapMode } from '../components/MapMode';
import { Emergency, ErrorBox, Loading } from '../components/ui';
import { Link, navigate, usePageTitle } from '../router';

type Pos = { lat: number; lon: number; label: string };

// Demo point = centre of the sample data (Warsaw, Śródmieście). Shown only in demo/mock mode.
const DEMO: Pos = { lat: 52.2397, lon: 21.0122, label: 'punkt demonstracyjny: Warszawa, Śródmieście' };

const GEO_ERR: Record<number, string> = {
  1: 'Nie mamy zgody na lokalizację. Wpisz adres lub miejscowość poniżej.',
  2: 'Nie udało się ustalić lokalizacji. Wpisz adres lub miejscowość poniżej.',
  3: 'Ustalanie lokalizacji trwa zbyt długo. Wpisz adres lub miejscowość poniżej.',
};

export function Nearest() {
  usePageTitle('Najbliższe AED');
  const [pos, setPos] = useState<Pos | null>(null);
  const [onlyNow, setOnlyNow] = useState(true);
  const [items, setItems] = useState<AedView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<Error | null>(null);
  const mock = useMockMode();
  const [mode, setMode] = useMapMode();
  const cov = useCoverage(mode);

  async function load(p: Pos, now = onlyNow) {
    setPos(p);
    setBusy('Szukam najbliższych AED…');
    setErr(null);
    try {
      const r = await nearestAed(p.lat, p.lon, 5, now);
      setItems(r);
      setMsg(r.length ? `Znaleziono ${r.length} najbliższych AED (${p.label}).` : 'Nie znaleziono AED spełniających warunki.');
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(null);
    }
  }

  function locate() {
    setMsg(null);
    if (!('geolocation' in navigator)) { setMsg('Ta przeglądarka nie udostępnia lokalizacji. Wpisz adres lub miejscowość.'); return; }
    setBusy('Ustalam Twoją lokalizację…');
    navigator.geolocation.getCurrentPosition(
      (g) => load({ lat: g.coords.latitude, lon: g.coords.longitude, label: 'Twoja lokalizacja' }),
      (e) => { setBusy(null); setMsg(GEO_ERR[e.code] ?? GEO_ERR[2]); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // address, street or locality → nearest AED from that point; gmina or voivodeship → the map of that area
  function onPlace(w: Wybor) {
    if (w.typ === 'tekst') return;
    if (w.typ === 'gmina' && w.teryt) { navigate(`/mapa?gm=${w.teryt}&gmn=${encodeURIComponent(w.nazwa)}`); return; }
    if (w.typ === 'wojewodztwo') { navigate(`/mapa?wojewodztwo=${encodeURIComponent(w.nazwa)}`); return; }
    load({ lat: w.lat, lon: w.lon, label: w.nazwa });
  }

  function toggleNow(v: boolean) {
    setOnlyNow(v);
    if (pos) load(pos, v);
  }

  return (
    <>
      <section className="hero" aria-labelledby="page-title">
        <h1 id="page-title">Znajdź najbliższe AED</h1>
        <p className="lead">Defibrylatora AED może użyć każdy. Urządzenie prowadzi głosem krok po kroku.</p>
        <Emergency />
        <button type="button" className="btn btn--primary btn--xl" onClick={locate} disabled={!!busy}>
          Pokaż najbliższe AED
        </button>
        <p className="hint">Użyjemy Twojej lokalizacji tylko do wyszukania. Nie zapisujemy jej.</p>

        <div className="place-form" role="search">
          <PlaceSearch label="Albo wpisz adres lub miejscowość" placeholder="np. Kraków, Floriańska 3"
            hint="Wybierz podpowiedź z listy – pokażemy najbliższe AED od tego miejsca." onSelect={onPlace} />
        </div>
        {mock && (
          <p className="hint">
            Tryb demonstracyjny: dane przykładowe obejmują Warszawę, Kraków i Gdańsk.{' '}
            <button type="button" className="linklike" onClick={() => load(DEMO)}>Użyj punktu w centrum Warszawy</button>
          </p>
        )}
        <p><Link to="/mapa">Zobacz wszystkie AED na mapie</Link></p>
      </section>

      <div role="status" aria-live="polite" className="status-line">{busy ?? msg ?? ''}</div>
      {busy && <Loading text={busy} />}
      {err && <ErrorBox error={err} onRetry={() => pos && load(pos)} />}

      {items && pos && (
        <section aria-labelledby="results-title" className="results">
          <div className="results__head">
            <h2 id="results-title">Najbliższe AED</h2>
            <div className="switch">
              <input id="only-now" type="checkbox" checked={onlyNow} onChange={(e) => toggleNow(e.target.checked)} />
              <label htmlFor="only-now">Tylko dostępne teraz</label>
            </div>
          </div>
          <p className="hint">Od: {pos.label}. Odległość w linii prostej.</p>
          <p className="firstaid-bar"><span>Nie wiesz, jak użyć AED?</span><Link to="/pierwsza-pomoc">Pierwsza pomoc: jak użyć AED</Link></p>
          <div className="split">
            <ol className="aed-list" aria-label="Lista najbliższych AED">
              {items.map((a, i) => <AedListItem key={a.id_aed} aed={a} from={pos} rank={i + 1} mode={mode} />)}
            </ol>
            <div className="split__map">
              <MapModeSwitch mode={mode} onChange={setMode} idPrefix="e1-mode" />
              <MapView items={items} user={pos} label={`Mapa najbliższych AED, tryb: ${mode === 'dane' ? 'aktualność danych' : 'dostępność'}. Te same informacje są na liście.`} height={460} cluster={false}
                mode={mode} coverage={cov.data} />
              <MapLegend mode={mode} coverage={!!cov.data} />
              {mode === 'dane' && !cov.loading && <CoverageList coverage={cov.data} collapsed />}
            </div>
          </div>
          {onlyNow && items.length < 5 && (
            <p><button type="button" className="linklike" onClick={() => toggleNow(false)}>Pokaż też AED zamknięte o tej porze i dla uprawnionych</button></p>
          )}
        </section>
      )}
    </>
  );
}
