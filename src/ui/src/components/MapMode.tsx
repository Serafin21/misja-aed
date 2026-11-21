// CR-TL-1: two map modes – "dostępność" (can I use it now?) and "aktualność danych" (how well do we know this AED?).
// The mode lives in the URL (?tryb=dostepnosc|dane) so a link or a refresh keeps it.
import { useEffect, useState } from 'react';
import { getCoverage } from '../api/client';
import type { Pokrycie } from '../api/types';
import { useAsync } from '../lib/useAsync';
import { useMockMode } from '../lib/useMockMode';
import { currentPath, currentSearch, toHref, useLocation } from '../router';
import { DataPin, Pin } from './Brand';

export type MapMode = 'dostepnosc' | 'dane';

const read = (): MapMode => (new URLSearchParams(currentSearch()).get('tryb') === 'dane' ? 'dane' : 'dostepnosc');

export function useMapMode(): [MapMode, (m: MapMode) => void] {
  const { search } = useLocation();
  const [mode, setMode] = useState<MapMode>(read);
  useEffect(() => setMode(read()), [search]);
  const set = (m: MapMode) => {
    const p = new URLSearchParams(currentSearch());
    if (m === 'dane') p.set('tryb', 'dane'); else p.delete('tryb');
    const s = p.toString();
    history.replaceState({}, '', toHref(`${currentPath()}${s ? `?${s}` : ''}`));
    setMode(m);
  };
  return [mode, set];
}

/** Keep ?tryb when a page rewrites its own query string (E2 filters). */
export function withMode(params: URLSearchParams): URLSearchParams {
  if (read() === 'dane') params.set('tryb', 'dane');
  return params;
}

/** Native radio group: arrow keys move between options, Tab leaves the group (WCAG 2.1.1, 4.1.2). */
export function MapModeSwitch({ mode, onChange, idPrefix = 'mode' }: { mode: MapMode; onChange: (m: MapMode) => void; idPrefix?: string }) {
  const opts: { v: MapMode; label: string; hint: string }[] = [
    { v: 'dostepnosc', label: 'Dostępność', hint: 'czy mogę teraz skorzystać' },
    { v: 'dane', label: 'Aktualność danych', hint: 'jak dawno sprawdzono dane' },
  ];
  return (
    <fieldset className="mode-switch">
      <legend>Co pokazać na mapie</legend>
      <div className="mode-switch__opts">
        {opts.map((o) => (
          <label key={o.v} className="mode-switch__opt" htmlFor={`${idPrefix}-${o.v}`}>
            <input id={`${idPrefix}-${o.v}`} type="radio" name={`${idPrefix}-tryb`} value={o.v} checked={mode === o.v} onChange={() => onChange(o.v)} />
            <span><strong>{o.label}</strong><span className="mode-switch__hint">{o.hint}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MapLegend({ mode, coverage }: { mode: MapMode; coverage?: boolean }) {
  if (mode === 'dostepnosc') {
    return (
      <ul className="legend-list" aria-label="Oznaczenia na mapie – tryb dostępność">
        <li><Pin kind="ok" />Dostępne teraz</li>
        <li><Pin kind="closed" />Teraz zamknięte lub niesprawne (znaczek zegara)</li>
        <li><Pin kind="private" />Tylko dla uprawnionych (znaczek kłódki)</li>
        <li><Pin kind="unknown" />Brak godzin – sprawdź na miejscu</li>
        <li>Szara pinezka z przerywaną obwódką: <strong>do sprawdzenia</strong> – punkt z OpenStreetMap, niepotwierdzony przez właściciela, poza wspólną listą</li>
      </ul>
    );
  }
  return (
    <ul className="legend-list" aria-label="Oznaczenia na mapie – tryb aktualność danych">
      <li><DataPin kind="aktualne" />Dane aktualne – sprawdzone w ostatnich 12 miesiącach</li>
      <li><DataPin kind="nieaktualne" />Dane nieaktualne – sprawdzone ponad rok temu albo bez daty (znaczek zegara)</li>
      {coverage && <>
        <li><span className="swatch swatch--brak" aria-hidden="true" />Gmina bez żadnego AED w zbiorze (kreskowanie, przerywana granica)</li>
        <li><span className="swatch swatch--stare" aria-hidden="true" />Gmina z co najmniej jednym nieaktualnym AED</li>
        <li><span className="swatch swatch--swieze" aria-hidden="true" />Gmina, w której wszystkie AED mają aktualne dane</li>
      </>}
      <li>Szara pinezka z przerywaną obwódką: <strong>do sprawdzenia</strong> (OpenStreetMap, poza wspólną listą)</li>
      <li>Filtr „Zbiór dostawcy po terminie”: dostawca nie zaktualizował zbioru na czas (inny sygnał niż „do weryfikacji”)</li>
    </ul>
  );
}

/** Loads GET /pokrycie only in the data mode (boundaries exist for all 16 voivodeships; default kujawsko-pomorskie). */
export function useCoverage(mode: MapMode, wojewodztwo?: string) {
  return useAsync<Pokrycie | null>(() => (mode === 'dane' ? getCoverage(wojewodztwo || undefined) : Promise.resolve(null)), [mode, wojewodztwo]);
}

/** Text alternative for the hatched municipalities (WCAG 1.1.1): the list of gminy without data. */
export function CoverageList({ coverage, collapsed = false }: { coverage: Pokrycie | null | undefined; collapsed?: boolean }) {
  const mock = useMockMode();
  if (!coverage) {
    return (
      <p className="hint">
        {mock
          ? 'Warstwa gmin działa z serwerem danych (granice z Państwowego Rejestru Granic). W trybie demonstracyjnym jej nie ma.'
          : 'Nie udało się wczytać warstwy gmin dla tego województwa.'}
      </p>
    );
  }
  const none = coverage.features.map((f) => f.properties).filter((p) => p.stan === 'brak_danych').sort((a, b) => a.gmina.localeCompare(b.gmina, 'pl'));
  const woj = coverage.meta?.wojewodztwo ?? none[0]?.wojewodztwo ?? '';
  const total = coverage.meta?.liczba_gmin ?? coverage.features.length;
  const body = (
    <>
      {none.length === 0 ? <p>Każda gmina ma co najmniej jedno AED w zbiorze.</p> : (
        <ul className="cols">{none.map((g) => <li key={g.teryt}>{g.gmina}{g.rodzaj ? <span className="hint"> ({g.rodzaj})</span> : null}</li>)}</ul>
      )}
      <p className="hint">Warstwa gmin pokazuje jedno województwo naraz – inne wybierz w filtrze „Województwo”. Granice gmin: {coverage.meta?.atrybucja ?? 'Państwowy Rejestr Granic – GUGiK'}.</p>
    </>
  );
  const title = `Gminy bez danych o AED: ${none.length} z ${total} (województwo ${woj})`;
  if (collapsed) return <details className="details"><summary>{title}</summary>{body}</details>;
  return (
    <section aria-labelledby="cov-title" className="coverage-list">
      <h3 id="cov-title">{title}</h3>
      <p>W tych gminach warto zachęcić instytucje, żeby dodały swoje AED.</p>
      {body}
    </section>
  );
}
