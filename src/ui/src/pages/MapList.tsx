// E2 – Mapa i lista. The list is the accessible equivalent of the map (same data, same filters).
import { useState } from 'react';
import { listAed } from '../api/client';
import type { AedFilters } from '../api/types';
import { AedListItem } from '../components/AedListItem';
import { MapView } from '../components/MapView';
import { CoverageList, MapLegend, MapModeSwitch, useCoverage, useMapMode, withMode } from '../components/MapMode';
import { ErrorBox, Loading } from '../components/ui';
import { dictValues } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { currentSearch, toHref, usePageTitle } from '../router';

function readFilters(): AedFilters {
  const p = new URLSearchParams(currentSearch());
  return {
    q: p.get('q') ?? '',
    wojewodztwo: p.get('wojewodztwo') ?? '',
    gmina: p.get('gmina') ?? '',
    dostep: p.get('dostep') ?? '',
    dostepne_teraz: p.get('dostepne_teraz') === 'true',
    pokaz_mobilne: p.get('mobilne') !== 'false',
  };
}

function writeFilters(f: AedFilters) {
  const p = withMode(new URLSearchParams());
  if (f.q) p.set('q', f.q);
  if (f.wojewodztwo) p.set('wojewodztwo', f.wojewodztwo);
  if (f.gmina) p.set('gmina', f.gmina);
  if (f.dostep) p.set('dostep', f.dostep);
  if (f.dostepne_teraz) p.set('dostepne_teraz', 'true');
  if (f.pokaz_mobilne === false) p.set('mobilne', 'false');
  const s = p.toString();
  history.replaceState({}, '', toHref(`/mapa${s ? `?${s}` : ''}`));
}

export function MapList() {
  usePageTitle('Mapa i lista AED');
  const [f, setF] = useState<AedFilters>(readFilters);
  const [draft, setDraft] = useState<AedFilters>(f);
  const [view, setView] = useState<'oba' | 'lista' | 'mapa'>('oba');
  const st = useAsync(() => listAed({ ...f, per_page: 500 }), [JSON.stringify(f)]);
  const [mode, setMode] = useMapMode();
  const cov = useCoverage(mode);

  const set = <K extends keyof AedFilters>(k: K, v: AedFilters[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const apply = (next: AedFilters) => { setF(next); writeFilters(next); };

  return (
    <>
      <h1 id="page-title">Mapa i lista AED</h1>
      <p className="lead">Wszystkie defibrylatory ze zbioru. Lista pod filtrami zawiera te same informacje co mapa.</p>

      <form className="filters" aria-label="Filtry" onSubmit={(e) => { e.preventDefault(); apply(draft); }}>
        <div className="filters__grid">
          <div className="field">
            <label htmlFor="f-q">Szukaj</label>
            <input id="f-q" type="search" value={draft.q} onChange={(e) => set('q', e.target.value)} placeholder="nazwa, ulica, miejscowość" />
          </div>
          <div className="field">
            <label htmlFor="f-woj">Województwo</label>
            <select id="f-woj" value={draft.wojewodztwo} onChange={(e) => set('wojewodztwo', e.target.value)}>
              <option value="">wszystkie</option>
              {dictValues('wojewodztwo').map((w) => <option key={w.wartosc} value={w.wartosc}>{w.wartosc}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-gm">Gmina</label>
            <input id="f-gm" type="text" value={draft.gmina} onChange={(e) => set('gmina', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-dost">Dostęp</label>
            <select id="f-dost" value={draft.dostep} onChange={(e) => set('dostep', e.target.value)} aria-describedby="f-dost-hint">
              <option value="">każdy</option>
              {dictValues('dostep').map((d) => <option key={d.wartosc} value={d.wartosc}>{d.wartosc}</option>)}
            </select>
            <p id="f-dost-hint" className="hint">Publiczny – dla każdego; ograniczony – w godzinach obiektu; prywatny – dla uprawnionych.</p>
          </div>
        </div>
        <div className="filters__checks">
          <div className="switch">
            <input id="f-now" type="checkbox" checked={!!draft.dostepne_teraz} onChange={(e) => set('dostepne_teraz', e.target.checked)} />
            <label htmlFor="f-now">Tylko dostępne teraz</label>
          </div>
          <div className="switch">
            <input id="f-mob" type="checkbox" checked={draft.pokaz_mobilne !== false} onChange={(e) => set('pokaz_mobilne', e.target.checked)} />
            <label htmlFor="f-mob">Pokaż urządzenia w pojazdach (np. OSP)</label>
          </div>
        </div>
        <p className="form-actions">
          <button type="submit" className="btn btn--primary">Pokaż wyniki</button>
          <button type="button" className="btn btn--secondary" onClick={() => { const e: AedFilters = { q: '', wojewodztwo: '', gmina: '', dostep: '', dostepne_teraz: false, pokaz_mobilne: true }; setDraft(e); apply(e); }}>Wyczyść filtry</button>
        </p>
      </form>

      <MapModeSwitch mode={mode} onChange={setMode} idPrefix="e2-mode" />

      <div className="segmented" role="group" aria-label="Widok">
        {(['oba', 'lista', 'mapa'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'oba' ? 'Lista i mapa' : v === 'lista' ? 'Tylko lista' : 'Tylko mapa'}</button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="status-line">
        {st.loading ? 'Wczytuję…' : st.data ? `Znaleziono: ${st.data.meta.count} AED.` : ''}
      </p>
      {st.error && <ErrorBox error={st.error} onRetry={st.reload} />}
      {st.loading && !st.data && <Loading />}

      {st.data && (
        <div className={`split split--${view}`}>
          {view !== 'mapa' && (
            <section aria-labelledby="list-title" className="split__list">
              <h2 id="list-title">Lista</h2>
              {st.data.items.length === 0 ? <p>Brak AED dla wybranych filtrów.</p> : (
                <ul className="aed-list">{st.data.items.map((a) => <AedListItem key={a.id_aed} aed={a} mode={mode} />)}</ul>
              )}
            </section>
          )}
          {view !== 'lista' && (
            <section aria-labelledby="map-title" className="split__map">
              <h2 id="map-title">Mapa</h2>
              <MapView items={st.data.items} label={`Mapa AED, tryb: ${mode === 'dane' ? 'aktualność danych' : 'dostępność'}. Te same informacje są na liście.`} height={560}
                mode={mode} coverage={cov.data} fitCoverage />
              <MapLegend mode={mode} coverage={!!cov.data} />
              {mode === 'dane' && !cov.loading && <CoverageList coverage={cov.data} />}
            </section>
          )}
        </div>
      )}
    </>
  );
}
