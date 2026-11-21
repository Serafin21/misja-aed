// "Znajdź AED": list on the left, map on the right – always. Whole Poland from GET /aed/punkty; filters work instantly in the
// browser. One search box: a place or "Moja lokalizacja" (the location is put into the box like any other place). With a
// place: the map zooms there, the nearest AED gets a "Najbliższe AED" pin and the list is sorted by distance. Without one:
// the list shows the AED visible on the map, alphabetically (or by the chosen order). Filters in a drop-down "Filtry" panel.
import { useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import { listAedByIds, listPoints, searchAedIds } from '../api/client';
import type { AedPoint, AedView } from '../api/types';
import { AedListItem } from '../components/AedListItem';
import { pinSvg } from '../components/Brand';
import { MapView, type GoTo } from '../components/MapView';
import { PlaceSearch, type Wybor } from '../components/PlaceSearch';
import { ErrorBox, Icon, Loading } from '../components/ui';
import { dictValues, distance, haversine } from '../lib/format';
import {
  AKTUALNOSC, applyFilters, counts, DOSTEPNOSC, EMPTY, readFilters, writeFilters, ZRODLO,
  type Aktualnosc, type Dostepnosc, type PointFilters, type Zrodlo,
} from '../lib/pointFilters';
import { useAsync } from '../lib/useAsync';
import { currentSearch, toHref, usePageTitle } from '../router';

const PAGE = 20;
const NO_ITEMS: AedView[] = [];
type View = { bounds: L.LatLngBounds; center: L.LatLng; zoom: number };
type Full = PointFilters & { q: string };
type Ref = { lat: number; lon: number; label: string; gps: boolean };
type Sort = 'odleglosc' | 'nazwa' | 'aktualizacja';

const fmt = (n: number) => n.toLocaleString('pl-PL');
const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const COLL = new Intl.Collator('pl', { sensitivity: 'base', ignorePunctuation: true, numeric: true });
// A–Z by the first letter; names without letters at the start (numbers, phone numbers) and unnamed AED go last
const sortKey = (p: AedPoint) => (p.nazwa ?? '').replace(/^[^\p{L}\p{N}]+/u, '');
const rank = (k: string) => (!k ? 2 : /^\p{L}/u.test(k) ? 0 : 1);
const byName = (a: AedPoint, b: AedPoint) => { const x = sortKey(a), y = sortKey(b); return rank(x) - rank(y) || COLL.compare(x, y); };
const byFresh = (a: AedPoint, b: AedPoint) => (a.wiek_danych_dni ?? 1e9) - (b.wiek_danych_dni ?? 1e9) || byName(a, b);

export function MapList() {
  usePageTitle('Znajdź AED');
  const [f, setF] = useState<Full>(() => readFilters(currentSearch()));
  const [goTo, setGoTo] = useState<GoTo | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const [mapView, setMapView] = useState<View | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [ref, setRef] = useState<Ref | null>(null);
  const [sort, setSort] = useState<Sort>('nazwa');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const apply = (next: Full) => {
    setF(next);
    const s = writeFilters(next, new URLSearchParams()).toString();
    history.replaceState({}, '', toHref(`/znajdz${s ? `?${s}` : ''}`));
  };
  const setGroup = <K extends 'dostepnosc' | 'aktualnosc' | 'zrodlo'>(k: K, v: Full[K][number]) =>
    apply({ ...f, [k]: toggle(f[k] as string[], v as string) } as Full);

  // the drop-down closes on Escape and on a click outside it
  useEffect(() => {
    if (!filtersOpen) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setFiltersOpen(false); document.getElementById('filters-btn')?.focus(); } };
    const click = (e: MouseEvent) => { if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false); };
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', click);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', click); };
  }, [filtersOpen]);

  const pts = useAsync(() => listPoints(), []);
  const search = useAsync(() => (f.q ? searchAedIds(f.q, '') : Promise.resolve(null)), [f.q]);
  const only = search.data ?? null;
  const filtered = useMemo(() => (pts.data ? applyFilters(pts.data, f, only) : null), [pts.data, f, only]);
  const facet = useMemo(() => (pts.data ? counts(pts.data, f, only) : null), [pts.data, f, only]);

  // with a place: all AED by distance from it; without: what the map shows, in the chosen order
  const dist = useMemo(() => {
    if (!ref || !filtered) return null;
    return new Map(filtered.map((p) => [p.id_aed, haversine(ref.lat, ref.lon, p.lat, p.lon)]));
  }, [ref, filtered]);
  const ordered = useMemo(() => {
    if (!filtered) return null;
    if (ref && dist && sort === 'odleglosc') return [...filtered].sort((a, b) => dist.get(a.id_aed)! - dist.get(b.id_aed)!);
    const inView = mapView ? filtered.filter((p) => mapView.bounds.contains([p.lat, p.lon])) : filtered;
    return [...inView].sort(sort === 'aktualizacja' ? byFresh : byName);
  }, [filtered, ref, dist, sort, mapView]);
  const visibleCount = useMemo(() => (filtered && mapView ? filtered.filter((p) => mapView.bounds.contains([p.lat, p.lon])).length : null), [filtered, mapView]);
  useEffect(() => setLimit(PAGE), [ordered]);

  const nearestPt = useMemo(() => {
    if (!ref || !dist || !filtered?.length) return null;
    let best: AedPoint | null = null;
    for (const p of filtered) if (!best || dist.get(p.id_aed)! < dist.get(best.id_aed)!) best = p;
    return best;
  }, [ref, dist, filtered]);

  // a new place: show it with its 3 nearest AED
  const refKey = ref ? `${ref.lat},${ref.lon}` : '';
  useEffect(() => {
    if (!ref || !filtered || !dist) return;
    const near = [...filtered].sort((a, b) => dist.get(a.id_aed)! - dist.get(b.id_aed)!).slice(0, 3).filter((p) => dist.get(p.id_aed)! < 30000);
    const lats = [ref.lat, ...near.map((p) => p.lat)], lons = [ref.lon, ...near.map((p) => p.lon)];
    setGoTo({ key: `ref:${refKey}:${near[0]?.id_aed ?? ''}`, lat: ref.lat, lon: ref.lon, zoom: 17, label: ref.gps ? undefined : ref.label,
      bbox: near.length ? [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey, nearestPt?.id_aed]);

  // full records for the list (debounced, so dragging the map does not fire dozens of requests)
  const ids = useMemo(() => (ordered ?? []).slice(0, limit).map((p) => p.id_aed), [ordered, limit]);
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
    }, 200);
    return () => clearTimeout(t);
  }, [ids.join(',')]);
  const waiting = ids.length > 0 && (!items || items[0]?.id_aed !== ids[0]) && !itemsErr;
  const listItems = items && !waiting ? items.map((a) => (dist?.has(a.id_aed) ? { ...a, odleglosc_m: dist.get(a.id_aed) } : a)) : null;

  const active = f.dostepnosc.length + f.aktualnosc.length + f.zrodlo.length + (f.wojewodztwo ? 1 : 0) + (f.mobilne ? 0 : 1);
  const clearFilters = () => apply({ ...EMPTY, q: f.q, gmina: f.gmina, gminaNazwa: f.gminaNazwa });
  const clearPlace = () => { setRef(null); setSort('nazwa'); apply({ ...f, q: '', gmina: '', gminaNazwa: '' }); };

  const onPlace = (w: Wybor) => {
    if (w.typ === 'tekst') { setRef(null); setSort('nazwa'); apply({ ...f, q: w.nazwa, gmina: '', gminaNazwa: '' }); return; }
    const key = `${w.typ}:${w.nazwa}:${Date.now()}`;
    if (w.typ === 'wojewodztwo' || w.typ === 'gmina') {
      setRef(null); setSort('nazwa');
      apply(w.typ === 'wojewodztwo' ? { ...f, q: '', wojewodztwo: w.nazwa, gmina: '', gminaNazwa: '' } : { ...f, q: '', wojewodztwo: '', gmina: w.teryt ?? '', gminaNazwa: w.nazwa });
      setGoTo({ key, lat: w.lat, lon: w.lon, bbox: w.bbox });
      return;
    }
    // locality, street, address or "Moja lokalizacja": nearest AED from that point
    apply({ ...f, q: '', gmina: '', gminaNazwa: '', wojewodztwo: '' });
    setRef({ lat: w.lat, lon: w.lon, label: w.gps ? 'Twoja lokalizacja' : w.nazwa, gps: !!w.gps });
    setSort('odleglosc');
  };

  const highlight = nearestPt && dist && dist.get(nearestPt.id_aed)! < 50000
    ? { id: nearestPt.id_aed, lat: nearestPt.lat, lon: nearestPt.lon, label: `Najbliższe AED · ${distance(dist.get(nearestPt.id_aed))}` } : null;

  const group = <T extends string>(title: string, key: 'dostepnosc' | 'aktualnosc' | 'zrodlo', opts: { v: T; label: string; hint: string }[], cnt?: Record<T, number>) => (
    <fieldset className="facet">
      <legend>{title}</legend>
      {opts.map((o) => {
        const id = `fx-${key}-${o.v}`;
        return (
          <div key={o.v} className="facet__opt">
            <input id={id} type="checkbox" checked={(f[key] as string[]).includes(o.v)} onChange={() => setGroup(key, o.v as never)} />
            <label htmlFor={id}><span className="facet__label">{o.label}</span><span className="facet__hint">{o.hint}</span></label>
            <span className="facet__count" aria-label={`${cnt ? fmt(cnt[o.v]) : '–'} AED`}>{cnt ? fmt(cnt[o.v]) : '–'}</span>
          </div>
        );
      })}
    </fieldset>
  );

  const listTitle = ref ? `Najbliższe AED – ${ref.label}` : f.gmina ? `AED w gminie ${f.gminaNazwa}` : f.q ? `AED: „${f.q}”` : 'AED widoczne na mapie';

  return (
    <div className="e2-page">
      <h1 id="page-title" className="visually-hidden">Znajdź AED</h1>
      <div className="finder-bar" role="search" aria-label="Szukaj AED">
        <div className="finder-bar__search">
          <PlaceSearch key={searchKey} label="Gdzie jesteś?" placeholder="Wpisz adres, ulicę, miejscowość albo gminę" textOption locate
            near={mapView && mapView.zoom >= 11 ? { lat: mapView.center.lat, lon: mapView.center.lng } : null}
            initial={f.q || f.gminaNazwa} onSelect={onPlace} onClear={clearPlace} />
        </div>
        <div className="finder-bar__filters" ref={filtersRef}>
          <button id="filters-btn" type="button" className={`btn btn--secondary filters-btn${active ? ' filters-btn--on' : ''}`}
            aria-expanded={filtersOpen} aria-controls="filters-panel" onClick={() => setFiltersOpen((o) => !o)}>
            <Icon name="filter" />Filtry{active ? <span className="filters-btn__n">{active}</span> : null}
          </button>
          {filtersOpen && (
            <div id="filters-panel" className="filters-panel" role="region" aria-label="Filtry">
              <div className="filters-panel__grid">
                {group<Dostepnosc>('Czy można teraz skorzystać', 'dostepnosc', DOSTEPNOSC, facet?.dostepnosc)}
                {group<Aktualnosc>('Kiedy sprawdzono dane', 'aktualnosc', AKTUALNOSC, facet?.aktualnosc)}
                <div>
                  {group<Zrodlo>('Źródło danych', 'zrodlo', ZRODLO, facet?.zrodlo)}
                  <div className="field">
                    <label htmlFor="f-woj">Województwo</label>
                    <select id="f-woj" value={f.wojewodztwo} onChange={(e) => apply({ ...f, wojewodztwo: e.target.value, gmina: '', gminaNazwa: '' })}>
                      <option value="">cała Polska</option>
                      {dictValues('wojewodztwo').map((w) => <option key={w.wartosc} value={w.wartosc}>{w.wartosc}</option>)}
                    </select>
                  </div>
                  <div className="switch">
                    <input id="f-mob" type="checkbox" checked={f.mobilne} onChange={(e) => apply({ ...f, mobilne: e.target.checked })} />
                    <label htmlFor="f-mob">Pokaż AED w pojazdach (np. OSP)</label>
                  </div>
                </div>
              </div>
              <p className="filters-panel__foot">
                <button type="button" className="btn btn--tertiary" onClick={clearFilters} disabled={!active}>Wyczyść filtry</button>
                <button type="button" className="btn btn--primary" onClick={() => { setFiltersOpen(false); document.getElementById('filters-btn')?.focus(); }}>
                  Pokaż {filtered ? fmt(filtered.length) : ''} AED
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {pts.error && <ErrorBox error={pts.error} onRetry={pts.reload} />}
      {search.error && <ErrorBox error={search.error} onRetry={search.reload} />}
      {pts.loading && !pts.data && <Loading text="Wczytuję wszystkie AED…" />}

      {filtered && (
        <div className="finder">
          <section aria-labelledby="list-title" className="finder__list">
            <div className="finder__list-head">
              <h2 id="list-title">{listTitle}</h2>
              <div className="finder__sort">
                <label htmlFor="sort">Kolejność</label>
                <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {ref && <option value="odleglosc">od najbliższych</option>}
                  <option value="nazwa">nazwa A–Z</option>
                  <option value="aktualizacja">ostatnio sprawdzone</option>
                </select>
              </div>
            </div>
            <p role="status" aria-live="polite" className="finder__count">
              {ref && sort === 'odleglosc' ? `${fmt(filtered.length)} AED od najbliższych.`
                : `${fmt(ordered?.length ?? 0)} AED na tym obszarze mapy${visibleCount !== null && filtered.length !== visibleCount ? ` (w całej Polsce ${fmt(filtered.length)})` : ''}.`}
            </p>
            {itemsErr && <ErrorBox error={itemsErr} />}
            {ordered && ordered.length === 0 && <p>Brak AED {ref ? 'dla wybranych filtrów' : 'w tym miejscu mapy – oddal mapę albo zmień filtry'}.</p>}
            {listItems && listItems.length > 0 && (
              <ol className="aed-list">
                {listItems.map((a, i) => <AedListItem key={a.id_aed} aed={a} rank={ref && sort === 'odleglosc' ? i + 1 : undefined}
                  nearest={!!ref && sort === 'odleglosc' && i === 0} />)}
              </ol>
            )}
            {waiting && <Loading text="Wczytuję listę…" />}
            {ordered && listItems && ordered.length > listItems.length && (
              <p><button type="button" className="btn btn--secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Pokaż więcej ({fmt(ordered.length - listItems.length)} pozostałych)
              </button></p>
            )}
          </section>
          <section aria-labelledby="map-title" className="finder__map">
            <h2 id="map-title" className="visually-hidden">Mapa</h2>
            <MapView items={NO_ITEMS} points={filtered as AedPoint[]} fitKey={f.q ? `q:${f.q}` : f.wojewodztwo || 'PL'} onView={setMapView}
              height={680} goTo={goTo} user={ref?.gps ? { lat: ref.lat, lon: ref.lon } : null} highlight={highlight}
              label="Mapa AED. Kliknij znacznik, aby zobaczyć podgląd. Te same informacje są na liście obok." />
            <ul className="mini-legend" aria-label="Legenda mapy">
              <li><span className="mini-legend__pin" dangerouslySetInnerHTML={{ __html: pinSvg('ok') }} />Otwarte teraz</li>
              <li><span className="mini-legend__pin" dangerouslySetInnerHTML={{ __html: pinSvg('closed') }} />Zamknięte</li>
              <li><span className="mini-legend__pin" dangerouslySetInnerHTML={{ __html: pinSvg('unknown') }} />Godziny nieokreślone</li>
              <li><span className="mini-legend__pin mini-legend__pin--osm" dangerouslySetInnerHTML={{ __html: pinSvg('unknown', true) }} />Do sprawdzenia</li>
              <li><span className="mini-legend__near" aria-hidden="true">♥</span>Najbliższe</li>
              <li><span className="mini-legend__you" aria-hidden="true" />Ty</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
