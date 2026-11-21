// "Znajdź AED" (E1 + E2 in one screen). Whole Poland from GET /aed/punkty; filters work instantly in the browser (with counts).
// Search a place or use the device location → the map zooms there, the nearest AED gets a big "Najbliższe AED" pin and the
// list shows the 5 nearest (with distance), expandable by 5. Without a reference point the list shows the AED visible on the
// map, nearest to its centre first (accessible equivalent of the map).
import { useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import { listAedByIds, listPoints, searchAedIds } from '../api/client';
import type { AedPoint, AedView } from '../api/types';
import { AedListItem } from '../components/AedListItem';
import { MapView, type GoTo } from '../components/MapView';
import { PlaceSearch, type Wybor } from '../components/PlaceSearch';
import { CoverageList, MapLegend, MapModeSwitch, useCoverage, useMapMode, withMode } from '../components/MapMode';
import { ErrorBox, Icon, Loading } from '../components/ui';
import { dictValues, distance, haversine } from '../lib/format';
import {
  AKTUALNOSC, applyFilters, counts, DOSTEPNOSC, EMPTY, readFilters, writeFilters, ZRODLO,
  type Aktualnosc, type Dostepnosc, type PointFilters, type Zrodlo,
} from '../lib/pointFilters';
import { useAsync } from '../lib/useAsync';
import { currentSearch, toHref, usePageTitle } from '../router';

const PAGE = 30;
const NEAR = 5;
type Ref = { lat: number; lon: number; label: string; gps: boolean };
const GEO_ERR: Record<number, string> = {
  1: 'Nie mamy zgody na lokalizację. Wpisz adres albo miejscowość w polu „Gdzie jesteś?”.',
  2: 'Nie udało się ustalić lokalizacji. Wpisz adres albo miejscowość.',
  3: 'Ustalanie lokalizacji trwa zbyt długo. Wpisz adres albo miejscowość.',
};
const NO_ITEMS: AedView[] = [];
type View = { bounds: L.LatLngBounds; center: L.LatLng; zoom: number };
type Full = PointFilters & { q: string };

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const fmt = (n: number) => n.toLocaleString('pl-PL');

export function MapList() {
  usePageTitle('Znajdź AED');
  const [f, setF] = useState<Full>(() => readFilters(currentSearch()));
  const [goTo, setGoTo] = useState<GoTo | null>(null);
  const [searchKey, setSearchKey] = useState(0); // new key = empty search box
  const [view, setView] = useState<'oba' | 'lista' | 'mapa'>('oba');
  const [mode, setMode] = useMapMode();
  const [mapView, setMapView] = useState<View | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [ref, setRef] = useState<Ref | null>(null);
  const [nearN, setNearN] = useState(NEAR);
  const [geoMsg, setGeoMsg] = useState('');

  const apply = (next: Full) => {
    setF(next);
    const s = writeFilters(next, withMode(new URLSearchParams())).toString();
    history.replaceState({}, '', toHref(`/znajdz${s ? `?${s}` : ''}`));
  };
  const setGroup = <K extends 'dostepnosc' | 'aktualnosc' | 'zrodlo'>(k: K, v: Full[K][number]) =>
    apply({ ...f, [k]: toggle(f[k] as string[], v as string) } as Full);

  const pts = useAsync(() => listPoints(), []);
  // text search in AED names: ids from the API (names are not in the light point layer)
  const search = useAsync(() => (f.q ? searchAedIds(f.q, '') : Promise.resolve(null)), [f.q]);
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

  // nearest to the searched place / the user (with the filters), independent of what the map shows
  const nearest = useMemo(() => {
    if (!ref || !filtered) return null;
    return filtered
      .map((p) => ({ p, d: haversine(ref.lat, ref.lon, p.lat, p.lon) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 200);
  }, [ref, filtered]);
  const dist = useMemo(() => new Map((nearest ?? []).map((x) => [x.p.id_aed, x.d])), [nearest]);
  const first = nearest?.[0];

  // new reference point: show it together with the 3 nearest AED
  const refKey = ref ? `${ref.lat},${ref.lon}` : '';
  useEffect(() => {
    if (!ref || !nearest) return;
    const near = nearest.slice(0, 3).filter((x) => x.d < 30000).map((x) => x.p);
    const lats = [ref.lat, ...near.map((p) => p.lat)], lons = [ref.lon, ...near.map((p) => p.lon)];
    setGoTo({ key: `ref:${refKey}:${near[0]?.id_aed ?? ''}`, lat: ref.lat, lon: ref.lon, zoom: 17, label: ref.gps ? undefined : ref.label,
      bbox: near.length ? [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey, first?.p.id_aed]);

  // full records for the list (debounced, so dragging the map does not fire dozens of requests)
  const ids = useMemo(() => (nearest ? nearest.slice(0, nearN).map((x) => x.p.id_aed) : (visible ?? []).slice(0, limit).map((p) => p.id_aed)),
    [nearest, nearN, visible, limit]);
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
  const clear = () => { setGoTo(null); setRef(null); setSearchKey((k) => k + 1); apply({ ...EMPTY, q: '' }); };
  const setPoint = (r: Ref | null) => { setRef(r); setNearN(NEAR); };

  function locate() {
    setGeoMsg('');
    if (!('geolocation' in navigator)) { setGeoMsg('Ta przeglądarka nie podaje lokalizacji. Wpisz adres albo miejscowość.'); return; }
    setGeoMsg('Ustalam Twoją lokalizację…');
    navigator.geolocation.getCurrentPosition(
      (g) => { setGeoMsg(''); setSearchKey((k) => k + 1); setPoint({ lat: +g.coords.latitude.toFixed(6), lon: +g.coords.longitude.toFixed(6), label: 'Twoja lokalizacja', gps: true }); },
      (e) => setGeoMsg(GEO_ERR[e.code] ?? GEO_ERR[2]),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // search: voivodeship / gmina → filter to its boundaries and zoom; locality, street, address → zoom and mark
  const onPlace = (w: Wybor) => {
    if (w.typ === 'tekst') { setGoTo(null); setPoint(null); apply({ ...f, q: w.nazwa, gmina: '', gminaNazwa: '' }); return; }
    const key = `${w.typ}:${w.nazwa}:${Date.now()}`;
    if (w.typ === 'wojewodztwo') {
      setPoint(null);
      apply({ ...f, q: '', wojewodztwo: w.nazwa, gmina: '', gminaNazwa: '' });
      setGoTo({ key, lat: w.lat, lon: w.lon, bbox: w.bbox });
    } else if (w.typ === 'gmina') {
      setPoint(null);
      apply({ ...f, q: '', wojewodztwo: '', gmina: w.teryt ?? '', gminaNazwa: w.nazwa });
      setGoTo({ key, lat: w.lat, lon: w.lon, bbox: w.bbox });
    } else {
      // keep area filters only if the place is inside them – otherwise the map would show nothing
      apply({ ...f, q: '', gmina: '', gminaNazwa: '', wojewodztwo: w.wojewodztwo && w.wojewodztwo === f.wojewodztwo ? f.wojewodztwo : '' });
      setPoint({ lat: w.lat, lon: w.lon, label: w.nazwa, gps: false }); // map: the place and its nearest AED (effect above)
    }
  };

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

  const withDist = (a: AedView): AedView => (dist.has(a.id_aed) ? { ...a, odleglosc_m: dist.get(a.id_aed) } : a);
  const listItems = items ? items.map(withDist) : null;
  const highlight = first && first.d < 50000 ? { id: first.p.id_aed, lat: first.p.lat, lon: first.p.lon, label: `Najbliższe AED · ${distance(first.d)}` } : null;
  const waitingForList = (ids.length > 0 && (!items || items.length === 0)) || (items !== null && ids.length > 0 && items[0]?.id_aed !== ids[0] && !itemsErr);

  return (
    <div className="e2-page">
      <h1 id="page-title">Znajdź AED</h1>

      <div className="e2__search" role="search" aria-label="Gdzie jesteś?">
        <div className="e2__search-box">
          <PlaceSearch key={searchKey} label="Gdzie jesteś?" placeholder="miasto, ulica i numer, gmina" textOption
            hint="Np. Kraków, Floriańska 3 · Wieliczka · mazowieckie"
            near={mapView && mapView.zoom >= 11 ? { lat: mapView.center.lat, lon: mapView.center.lng } : null}
            initial={f.q || f.gminaNazwa} onSelect={onPlace} />
        </div>
        <div className="e2__locate">
          <button type="button" className="btn btn--primary btn--locate" onClick={locate}><Icon name="locate" />Najbliższe AED ode mnie</button>
          <p role="status" className="hint">{geoMsg}</p>
        </div>
      </div>
      {(f.gmina || f.q || ref) && (
        <p className="area-chip">
          <span>{ref ? <>Najbliższe od: <strong>{ref.label}</strong></> : f.gmina ? <>Gmina: <strong>{f.gminaNazwa}</strong></> : <>Nazwa AED zawiera: <strong>„{f.q}”</strong></>}</span>
          <button type="button" className="btn btn--tertiary btn--small" onClick={() => { setSearchKey((k) => k + 1); setPoint(null); apply({ ...f, gmina: '', gminaNazwa: '', q: '' }); }}>Usuń</button>
        </p>
      )}

      <div className="e2">
        <aside className="e2__filters" aria-labelledby="filters-title">
          <MapModeSwitch mode={mode} onChange={setMode} idPrefix="e2-mode" />
          <h2 id="filters-title" className="e2__filters-title">Filtry</h2>
          <div className="field">
            <label htmlFor="f-woj">Województwo</label>
            <select id="f-woj" value={f.wojewodztwo} onChange={(e) => apply({ ...f, wojewodztwo: e.target.value, gmina: '', gminaNazwa: '' })}>
              <option value="">cała Polska</option>
              {dictValues('wojewodztwo').map((w) => <option key={w.wartosc} value={w.wartosc}>{w.wartosc}</option>)}
            </select>
          </div>
          {group<Dostepnosc>('Dostępność', 'dostepnosc', DOSTEPNOSC, facet?.dostepnosc)}
          <details className="facet-more" open={f.aktualnosc.length > 0 || f.zrodlo.length > 0}>
            <summary>Więcej filtrów{f.aktualnosc.length + f.zrodlo.length ? ` (${f.aktualnosc.length + f.zrodlo.length})` : ''}</summary>
            {group<Aktualnosc>('Aktualność danych', 'aktualnosc', AKTUALNOSC, facet?.aktualnosc)}
            {group<Zrodlo>('Skąd są dane', 'zrodlo', ZRODLO, facet?.zrodlo)}
          </details>
          <div className="switch">
            <input id="f-mob" type="checkbox" checked={f.mobilne} onChange={(e) => apply({ ...f, mobilne: e.target.checked })} />
            <label htmlFor="f-mob">Pokaż urządzenia w pojazdach (np. OSP)</label>
          </div>
          {active > 0 && <p><button type="button" className="btn btn--secondary btn--small" onClick={clear}>Wyczyść filtry ({active})</button></p>}
          <p className="hint">Liczby obok mówią, ile AED zobaczysz po zaznaczeniu.</p>
        </aside>

        <div className="e2__main">
          <div className="e2__bar">
            <p role="status" aria-live="polite" className="status-line">
              {pts.loading ? 'Wczytuję wszystkie AED…' : filtered && visible
                ? `${fmt(filtered.length)} AED spełnia filtry${view !== 'lista' && mapView ? `, na mapie widać ${fmt(visible.length)}` : ''}.`
                : ''}
            </p>
            <div className="segmented" role="group" aria-label="Widok">
              {(['oba', 'lista', 'mapa'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'oba' ? 'Lista i mapa' : v === 'lista' ? 'Tylko lista' : 'Tylko mapa'}</button>
              ))}
            </div>
          </div>

          {pts.error && <ErrorBox error={pts.error} onRetry={pts.reload} />}
          {search.error && <ErrorBox error={search.error} onRetry={search.reload} />}
          {pts.loading && !pts.data && <Loading />}

          {filtered && (
            <div className={`split split--${view} e2__split`}>
              {view !== 'mapa' && (
                <section aria-labelledby="list-title" className="split__list e2__list">
                  <h2 id="list-title">{ref ? 'Najbliższe AED' : view === 'lista' ? 'Lista AED' : 'AED widoczne na mapie'}</h2>
                  {ref
                    ? <p className="hint">Od: {ref.label}. Liczymy w linii prostej{f.dostepnosc.length || f.aktualnosc.length || f.zrodlo.length ? ', z wybranymi filtrami' : ''}.</p>
                    : <p className="hint">Najbliższe środka mapy na górze. Wpisz adres albo użyj lokalizacji, aby zobaczyć AED najbliższe Tobie.</p>}
                  {itemsErr && <ErrorBox error={itemsErr} />}
                  {(nearest ?? visible)?.length === 0 && <p>Brak AED {view === 'lista' || ref ? 'dla wybranych filtrów' : 'w tym miejscu mapy – oddal mapę albo zmień filtry'}.</p>}
                  {listItems && listItems.length > 0 && !waitingForList && (
                    <ol className="aed-list">
                      {listItems.map((a, i) => (
                        <AedListItem key={a.id_aed} aed={a} mode={mode} from={ref} rank={ref ? i + 1 : undefined} nearest={!!ref && i === 0} />
                      ))}
                    </ol>
                  )}
                  {waitingForList && !itemsErr && <Loading text="Wczytuję listę…" />}
                  {ref && nearest && items && !waitingForList && nearest.length > nearN && (
                    <p><button type="button" className="btn btn--secondary" onClick={() => setNearN((n) => n + NEAR)}>Pokaż {NEAR} kolejnych najbliższych</button></p>
                  )}
                  {!ref && visible && items && !waitingForList && visible.length > items.length && (
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
                    fitKey={f.q ? `q:${f.q}` : f.wojewodztwo || 'PL'} onView={setMapView} height={640} goTo={goTo}
                    user={ref?.gps ? { lat: ref.lat, lon: ref.lon } : null} highlight={highlight}
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
    </div>
  );
}
