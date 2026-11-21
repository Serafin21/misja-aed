// E2 – Mapa i lista. Whole Poland from GET /aed/punkty; filters work instantly in the browser (with counts);
// the list next to the map shows the AED visible on the map, nearest to its centre first (accessible equivalent of the map).
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type L from 'leaflet';
import { listAedByIds, listPoints, searchAedIds } from '../api/client';
import type { AedPoint, AedView } from '../api/types';
import { AedListItem } from '../components/AedListItem';
import { MapView } from '../components/MapView';
import { CoverageList, MapLegend, MapModeSwitch, useCoverage, useMapMode, withMode } from '../components/MapMode';
import { ErrorBox, Loading } from '../components/ui';
import { dictValues, haversine } from '../lib/format';
import {
  AKTUALNOSC, applyFilters, counts, DOSTEPNOSC, EMPTY, readFilters, writeFilters, ZRODLO,
  type Aktualnosc, type Dostepnosc, type PointFilters, type Zrodlo,
} from '../lib/pointFilters';
import { useAsync } from '../lib/useAsync';
import { currentSearch, toHref, usePageTitle } from '../router';

const PAGE = 30;
const NO_ITEMS: AedView[] = [];
type View = { bounds: L.LatLngBounds; center: L.LatLng; zoom: number };
type Full = PointFilters & { q: string; gmina: string };

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const fmt = (n: number) => n.toLocaleString('pl-PL');

export function MapList() {
  usePageTitle('Mapa i lista AED');
  const [f, setF] = useState<Full>(() => readFilters(currentSearch()));
  const [text, setText] = useState({ q: f.q, gmina: f.gmina });
  const [view, setView] = useState<'oba' | 'lista' | 'mapa'>('oba');
  const [mode, setMode] = useMapMode();
  const [mapView, setMapView] = useState<View | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const apply = (next: Full) => {
    setF(next);
    const s = writeFilters(next, withMode(new URLSearchParams())).toString();
    history.replaceState({}, '', toHref(`/mapa${s ? `?${s}` : ''}`));
  };
  const setGroup = <K extends 'dostepnosc' | 'aktualnosc' | 'zrodlo'>(k: K, v: Full[K][number]) =>
    apply({ ...f, [k]: toggle(f[k] as string[], v as string) } as Full);

  const pts = useAsync(() => listPoints(), []);
  // text search / gmina: ids from the API (names and addresses are not in the light point layer)
  const search = useAsync(() => (f.q || f.gmina ? searchAedIds(f.q, f.gmina) : Promise.resolve(null)), [f.q, f.gmina]);
  const only = search.data ?? null;

  const filtered = useMemo(() => (pts.data ? applyFilters(pts.data, f, only) : null), [pts.data, f, only]);
  const facet = useMemo(() => (pts.data ? counts(pts.data, f, only) : null), [pts.data, f, only]);

  // what is visible on the map, nearest to the centre first
  const visible = useMemo(() => {
    if (!filtered) return null;
    if (!mapView || view === 'lista') return filtered;
    const b = mapView.bounds;
    const c = mapView.center;
    return filtered
      .filter((p) => b.contains([p.lat, p.lon]))
      .map((p) => ({ p, d: haversine(c.lat, c.lng, p.lat, p.lon) }))
      .sort((a, b2) => a.d - b2.d)
      .map((x) => x.p);
  }, [filtered, mapView, view]);

  useEffect(() => setLimit(PAGE), [visible]);

  // full records for the list (debounced, so dragging the map does not fire dozens of requests)
  const ids = useMemo(() => (visible ?? []).slice(0, limit).map((p) => p.id_aed), [visible, limit]);
  const [items, setItems] = useState<AedView[] | null>(null);
  const [itemsErr, setItemsErr] = useState<Error | null>(null);
  const reqId = useRef(0);
  useEffect(() => {
    const my = ++reqId.current;
    const t = setTimeout(() => {
      listAedByIds(ids).then(
        (r) => { if (my === reqId.current) { setItems(r); setItemsErr(null); } },
        (e: unknown) => { if (my === reqId.current) setItemsErr(e instanceof Error ? e : new Error(String(e))); },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [ids.join(',')]);

  // municipality layer: the chosen voivodeship, or the one most of the visible AED are in (from zoom 8)
  const covWoj = useMemo(() => {
    if (f.wojewodztwo) return f.wojewodztwo;
    if (!visible || !mapView || mapView.zoom < 8) return '';
    const n = new Map<string, number>();
    for (const p of visible.slice(0, 500)) if (p.wojewodztwo) n.set(p.wojewodztwo, (n.get(p.wojewodztwo) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }, [f.wojewodztwo, visible, mapView]);
  const cov = useCoverage(covWoj ? mode : 'dostepnosc', covWoj);

  const active = f.dostepnosc.length + f.aktualnosc.length + f.zrodlo.length + (f.wojewodztwo ? 1 : 0) + (f.q ? 1 : 0) + (f.gmina ? 1 : 0) + (f.mobilne ? 0 : 1);
  const submitText = (e: FormEvent) => { e.preventDefault(); apply({ ...f, ...text }); };
  const clear = () => { setText({ q: '', gmina: '' }); apply({ ...EMPTY, q: '', gmina: '' }); };

  const group = <T extends string>(title: string, key: 'dostepnosc' | 'aktualnosc' | 'zrodlo', opts: { v: T; label: string; hint: string }[], cnt?: Record<T, number>) => (
    <fieldset className="facet">
      <legend>{title}</legend>
      {opts.map((o) => {
        const id = `fx-${key}-${o.v}`;
        return (
          <div key={o.v} className="facet__opt">
            <input id={id} type="checkbox" checked={(f[key] as string[]).includes(o.v)} onChange={() => setGroup(key, o.v as never)} />
            <label htmlFor={id}>
              <span className="facet__label">{o.label}</span>
              <span className="facet__hint">{o.hint}</span>
            </label>
            <span className="facet__count" aria-label={`${cnt ? fmt(cnt[o.v]) : '–'} AED`}>{cnt ? fmt(cnt[o.v]) : '–'}</span>
          </div>
        );
      })}
    </fieldset>
  );

  return (
    <>
      <h1 id="page-title">Mapa i lista AED</h1>
      <p className="lead">Wszystkie defibrylatory w Polsce. Przybliżaj mapę kółkiem myszy albo przyciskami +/−. Lista obok pokazuje AED widoczne na mapie – najbliższe środka mapy na górze.</p>

      <div className="e2">
        <aside className="e2__filters" aria-label="Filtry">
          <form className="facet facet--text" onSubmit={submitText}>
            <div className="field">
              <label htmlFor="f-q">Szukaj</label>
              <input id="f-q" type="search" autoComplete="off" value={text.q} onChange={(e) => setText({ ...text, q: e.target.value })} placeholder="nazwa, ulica, miejscowość" />
            </div>
            <div className="field">
              <label htmlFor="f-gm">Gmina</label>
              <input id="f-gm" type="text" autoComplete="off" value={text.gmina} onChange={(e) => setText({ ...text, gmina: e.target.value })} />
            </div>
            <button type="submit" className="btn btn--secondary btn--small">Szukaj</button>
          </form>
          <div className="field">
            <label htmlFor="f-woj">Województwo</label>
            <select id="f-woj" value={f.wojewodztwo} onChange={(e) => apply({ ...f, wojewodztwo: e.target.value })}>
              <option value="">cała Polska</option>
              {dictValues('wojewodztwo').map((w) => <option key={w.wartosc} value={w.wartosc}>{w.wartosc}</option>)}
            </select>
          </div>
          {group<Dostepnosc>('Dostępność', 'dostepnosc', DOSTEPNOSC, facet?.dostepnosc)}
          {group<Aktualnosc>('Aktualność danych', 'aktualnosc', AKTUALNOSC, facet?.aktualnosc)}
          {group<Zrodlo>('Źródło danych', 'zrodlo', ZRODLO, facet?.zrodlo)}
          <div className="switch">
            <input id="f-mob" type="checkbox" checked={f.mobilne} onChange={(e) => apply({ ...f, mobilne: e.target.checked })} />
            <label htmlFor="f-mob">Pokaż urządzenia w pojazdach (np. OSP)</label>
          </div>
          {active > 0 && <p><button type="button" className="btn btn--secondary btn--small" onClick={clear}>Wyczyść filtry ({active})</button></p>}
          <p className="hint">Zaznaczenie kilku pól w jednej grupie pokazuje AED spełniające którekolwiek z nich. Liczby obok mówią, ile AED zobaczysz po zaznaczeniu.</p>
        </aside>

        <div className="e2__main">
          <div className="e2__bar">
            <MapModeSwitch mode={mode} onChange={setMode} idPrefix="e2-mode" />
            <div className="segmented" role="group" aria-label="Widok">
              {(['oba', 'lista', 'mapa'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'oba' ? 'Lista i mapa' : v === 'lista' ? 'Tylko lista' : 'Tylko mapa'}</button>
              ))}
            </div>
          </div>

          <p role="status" aria-live="polite" className="status-line">
            {pts.loading ? 'Wczytuję wszystkie AED…' : filtered && visible
              ? `${fmt(filtered.length)} AED spełnia filtry${view !== 'lista' && mapView ? `, na mapie widać ${fmt(visible.length)}` : ''}.`
              : ''}
          </p>
          {pts.error && <ErrorBox error={pts.error} onRetry={pts.reload} />}
          {search.error && <ErrorBox error={search.error} onRetry={search.reload} />}
          {pts.loading && !pts.data && <Loading />}

          {filtered && (
            <div className={`split split--${view} e2__split`}>
              {view !== 'mapa' && (
                <section aria-labelledby="list-title" className="split__list e2__list">
                  <h2 id="list-title">{view === 'lista' ? 'Lista' : 'Na mapie'}</h2>
                  {itemsErr && <ErrorBox error={itemsErr} />}
                  {visible && visible.length === 0 && <p>Brak AED {view === 'lista' ? 'dla wybranych filtrów' : 'w tym miejscu mapy – oddal mapę albo zmień filtry'}.</p>}
                  {items && items.length > 0 && (
                    <ul className="aed-list">{items.map((a) => <AedListItem key={a.id_aed} aed={a} mode={mode} />)}</ul>
                  )}
                  {!items && visible && visible.length > 0 && <Loading text="Wczytuję listę…" />}
                  {visible && items && visible.length > items.length && (
                    <p><button type="button" className="btn btn--secondary" onClick={() => setLimit((l) => l + PAGE)}>
                      Pokaż kolejne {Math.min(PAGE, visible.length - items.length)} (z {fmt(visible.length - items.length)} pozostałych)
                    </button></p>
                  )}
                </section>
              )}
              {view !== 'lista' && (
                <section aria-labelledby="map-title" className="split__map">
                  <h2 id="map-title" className="visually-hidden">Mapa</h2>
                  <MapView items={NO_ITEMS} points={filtered as AedPoint[]} mode={mode} coverage={cov.data} fitCoverage={!!f.wojewodztwo}
                    fitKey={f.wojewodztwo || 'PL'} onView={setMapView} height={640}
                    label={`Mapa AED, tryb: ${mode === 'dane' ? 'aktualność danych' : 'dostępność'}. Te same informacje są na liście.`} />
                  <MapLegend mode={mode} coverage={!!cov.data && mode === 'dane'} />
                  {mode === 'dane' && covWoj && !cov.loading && <CoverageList coverage={cov.data} collapsed />}
                  {mode === 'dane' && !covWoj && <p className="hint">Granice gmin pokażą się po wybraniu województwa albo przybliżeniu mapy.</p>}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
