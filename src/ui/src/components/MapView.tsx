// Leaflet (BSD-2) used directly – react-leaflet is excluded (Hippocratic licence).
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { getAed } from '../api/client';
import type { AedPoint, AedView, Pokrycie, StanGminy } from '../api/types';
import { dataLabel } from '../lib/dataState';
import { address, availableNow } from '../lib/format';
import { navigate, toHref } from '../router';
import { dataPinSvg, pinSvg, type PinKind } from './Brand';
import type { MapMode } from './MapMode';

export interface MapViewProps {
  items: AedView[];
  /** CR-TL-2: light whole-Poland layer (GET /aed/punkty); when given, it is drawn instead of `items` and details load on click */
  points?: AedPoint[] | null;
  user?: { lat: number; lon: number } | null;
  /** id of the record to centre on (E3 card) */
  focusId?: string;
  /** click on the map picks a point (E4, E5 form) */
  onPick?: (p: { lat: number; lon: number }) => void;
  picked?: { lat: number; lon: number } | null;
  /** CR-TL-8: location accuracy in metres – drawn as a circle around `user` (or `picked`) */
  accuracy?: number | null;
  label: string;
  height?: number;
  cluster?: boolean;
  /** CR-TL-1: pins by availability (default) or by data freshness */
  mode?: MapMode;
  /** municipality layer (GET /pokrycie), shown in the data mode */
  coverage?: Pokrycie | null;
  /** fit the view to the municipality layer when it appears (E2); E1 keeps the nearest AEDs in view */
  fitCoverage?: boolean;
  /** zoom with the mouse wheel / touchpad (default on) */
  wheelZoom?: boolean;
  /** point layer: refit the view only when this key changes (E2: area filter); default – when the points change */
  fitKey?: string;
  /** called after every move/zoom (and once at start) – E2 list shows what is visible */
  onView?: (v: { bounds: L.LatLngBounds; center: L.LatLng; zoom: number }) => void;
  /** search result: zoom to its area (bbox) or point; a new `key` moves the map again */
  goTo?: GoTo | null;
}

export interface GoTo { key: string; lat: number; lon: number; bbox?: [number, number, number, number] | null; zoom?: number; label?: string }

const POLAND: L.LatLngBoundsExpression = [[49.0, 14.1], [54.9, 24.2]];

function pinKind(a: AedView): PinKind {
  if (a.dostep === 'prywatny') return 'private';
  if (a.status_urzadzenia === 'niesprawny' || a.status_urzadzenia === 'w_serwisie') return 'closed';
  const v = availableNow(a);
  return v === true ? 'ok' : v === false ? 'closed' : 'unknown';
}

function markerIcon(a: AedView, mode: MapMode): L.DivIcon {
  const osm = a.licencja === 'ODbL-1.0';
  return L.divIcon({
    className: 'aed-pin',
    html: mode === 'dane' ? dataPinSvg(dataLabel(a).state, osm) : pinSvg(pinKind(a), osm),
    iconSize: [40, 52],
    iconAnchor: [20, 50],
  });
}

function markerName(a: AedView, mode: MapMode): string {
  if (mode === 'dane') return `${a.nazwa_obiektu}, ${a.miejscowosc} – ${dataLabel(a).long}`;
  const v = availableNow(a);
  const state = a.dostep === 'prywatny' ? 'tylko dla uprawnionych' : v === true ? 'dostępne teraz' : v === false ? 'teraz zamknięte' : 'godziny do sprawdzenia';
  return `${a.nazwa_obiektu}, ${a.miejscowosc} – ${state}${a.szafka_zamknieta ? ', szafka zamknięta' : ''}`;
}

export function MapView({ items, user, focusId, onPick, picked, accuracy, label, height = 420, cluster = true, mode = 'dostepnosc', coverage, fitCoverage = false, points, wheelZoom = true, fitKey: fitKeyProp, onView, goTo }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const extra = useRef<L.LayerGroup | null>(null);
  const covLayer = useRef<L.GeoJSON | null>(null);
  const covAttr = useRef<string | null>(null);
  const fitKey = useRef<string>('');
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const viewRef = useRef(onView);
  viewRef.current = onView;
  // CR-TL-2 point layer: one cluster group and one marker per AED and mode, reused when filters change
  const ptsGroup = useRef<L.LayerGroup | null>(null);
  const ptsCache = useRef<Map<string, L.Marker>>(new Map());
  const goLayer = useRef<L.LayerGroup | null>(null);
  const goKey = useRef('');
  const lastPts = useRef<{ points: AedPoint[] | null; mode: MapMode; fit?: string }>({ points: null, mode });

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { keyboard: true, zoomControl: false, scrollWheelZoom: wheelZoom, wheelPxPerZoomLevel: 90, maxBounds: [[47, 12], [56.5, 26.5]] });
    L.control.zoom({ zoomInTitle: 'Przybliż mapę', zoomOutTitle: 'Oddal mapę' }).addTo(m);
    m.fitBounds(POLAND);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">autorzy OpenStreetMap</a>',
    }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => pickRef.current?.({ lat: +e.latlng.lat.toFixed(6), lon: +e.latlng.lng.toFixed(6) }));
    if (!wheelZoom) {
      m.on('focus', () => m.scrollWheelZoom.enable());
      m.on('blur', () => m.scrollWheelZoom.disable());
    }
    const emit = () => viewRef.current?.({ bounds: m.getBounds(), center: m.getCenter(), zoom: m.getZoom() });
    m.on('moveend', emit);
    extra.current = L.layerGroup().addTo(m);
    map.current = m;
    emit();
    // the container changes width (e.g. "Tylko mapa"): without this Leaflet leaves grey, untiled areas
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => m.invalidateSize({ pan: false })) : null;
    ro?.observe(el.current);
    return () => { ro?.disconnect(); m.remove(); map.current = null; layer.current = null; covLayer.current = null; covAttr.current = null; ptsGroup.current = null; ptsCache.current.clear(); lastPts.current = { points: null, mode: 'dostepnosc' }; fitKey.current = ''; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (points && lastPts.current.points === points && lastPts.current.mode === mode && lastPts.current.fit === fitKeyProp) return;
    lastPts.current = { points: points ?? null, mode, fit: fitKeyProp };
    layer.current?.remove();
    layer.current = null;
    const anyL = L as unknown as { markerClusterGroup?: (o: object) => L.LayerGroup };
    // no chunkedLoading: its timers keep adding markers after the map is removed or the filters change (wrong pins, errors);
    // a bulk addLayers of 18k cached markers takes a fraction of a second
    const newGroup = (): L.LayerGroup => (cluster && anyL.markerClusterGroup
      ? anyL.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40 })
      : L.layerGroup());
    const pts: L.LatLngExpression[] = [];
    if (points) {
      // 18k points: markers are built once per mode and reused when the filters change; details on demand
      if (!ptsGroup.current) ptsGroup.current = newGroup().addTo(m);
      const g = ptsGroup.current;
      g.clearLayers();
      const cache = ptsCache.current;
      const markers = points.map((p) => {
        const k = `${mode}:${p.id_aed}:${p.dostepny_teraz}:${p.stan_danych}`;
        let mk = cache.get(k);
        if (!mk) { mk = pointMarker(p, mode); cache.set(k, mk); }
        return mk;
      });
      (g as unknown as { addLayers?: (l: L.Layer[]) => void }).addLayers?.(markers) ?? markers.forEach((mk) => g.addLayer(mk));
      const key = fitKeyProp !== undefined ? `pts:${fitKeyProp}` : `pts:${points.length}:${points[0]?.id_aed ?? ''}:${points[points.length - 1]?.id_aed ?? ''}`;
      if (key !== fitKey.current && points.length) {
        fitKey.current = key;
        m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as L.LatLngTuple)), { padding: [16, 16], maxZoom: 15 });
      }
      return;
    }
    ptsGroup.current?.remove();
    ptsGroup.current = null;
    const group = newGroup();
    for (const a of items) {
      const ll: L.LatLngExpression = [a.szerokosc_geograficzna, a.dlugosc_geograficzna];
      pts.push(ll);
      const name = markerName(a, mode);
      const mk = L.marker(ll, { icon: markerIcon(a, mode), title: name, alt: name, keyboard: true, riseOnHover: true });
      mk.on('add', () => mk.getElement()?.setAttribute('aria-label', name)); // divIcon ignores `alt`; title alone is unreliable for screen readers
      mk.on('click', () => navigate(`/aed/${a.id_aed}`));
      mk.on('keypress', (e: L.LeafletKeyboardEvent) => { if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') navigate(`/aed/${a.id_aed}`); });
      group.addLayer(mk);
    }
    group.addTo(m);
    layer.current = group;
    if (user) pts.push([user.lat, user.lon]);
    // switching the map mode only repaints the pins – keep the user's zoom; refit only when the data changes
    const key = `${items.map((a) => a.id_aed).join(',')}|${user ? `${user.lat},${user.lon}` : ''}|${focusId ?? ''}`;
    if (key === fitKey.current) return;
    fitKey.current = key;
    const focus = focusId ? items.find((a) => a.id_aed === focusId) : undefined;
    if (focus) m.setView([focus.szerokosc_geograficzna, focus.dlugosc_geograficzna], 17);
    else if (pts.length === 1) m.setView(pts[0], 16);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 17 });
  }, [items, user, focusId, cluster, mode, points, fitKeyProp]);

  useEffect(() => {
    const g = extra.current;
    if (!g) return;
    g.clearLayers();
    const centre = user ?? picked;
    if (centre && accuracy) {
      L.circle([centre.lat, centre.lon], { radius: accuracy, color: '#2f6fe0', weight: 1, fillColor: '#2f6fe0', fillOpacity: 0.12, interactive: false }).addTo(g);
    }
    if (user) L.circleMarker([user.lat, user.lon], { radius: 9, color: '#0F3B2B', weight: 3, fillColor: '#2f6fe0', fillOpacity: 0.9 }).bindTooltip('Twoja lokalizacja').addTo(g);
    if (picked) {
      // draggable when the page lets the user pick a point (E4, E5 manual) – move the pin to the exact spot
      const pm = L.marker([picked.lat, picked.lon], { icon: L.divIcon({ className: 'pick-marker', html: '<span aria-hidden="true"></span>', iconSize: [30, 30], iconAnchor: [15, 28] }), title: 'Wybrane miejsce – możesz przesunąć pinezkę', keyboard: false, draggable: !!pickRef.current }).addTo(g);
      pm.on('dragend', () => { const ll = pm.getLatLng(); pickRef.current?.({ lat: +ll.lat.toFixed(6), lon: +ll.lng.toFixed(6) }); });
      map.current?.setView([picked.lat, picked.lon], Math.max(map.current.getZoom(), 16));
    }
  }, [user, picked, accuracy]);

  // search result: fly to the area or the point and mark it (streets, addresses, localities)
  useEffect(() => {
    const m = map.current;
    if (!m || !goTo || goTo.key === goKey.current) return;
    goKey.current = goTo.key;
    goLayer.current?.remove();
    goLayer.current = L.layerGroup().addTo(m);
    if (goTo.bbox) {
      const [a, b, c, d] = goTo.bbox;
      m.fitBounds([[b, a], [d, c]], { padding: [24, 24], maxZoom: goTo.zoom ?? 17 });
    } else {
      m.setView([goTo.lat, goTo.lon], goTo.zoom ?? 16);
    }
    if (goTo.label) {
      L.circleMarker([goTo.lat, goTo.lon], { radius: 10, color: '#0B2D6B', weight: 3, fillColor: '#ffffff', fillOpacity: 0.9 })
        .bindTooltip(esc(goTo.label), { permanent: true, direction: 'top', offset: [0, -10], className: 'go-label' })
        .addTo(goLayer.current);
    }
  }, [goTo]);

  // CR-TL-1: municipality layer – hatched where there is no AED at all (pattern injected into Leaflet's SVG)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    covLayer.current?.remove();
    covLayer.current = null;
    if (covAttr.current) { m.attributionControl.removeAttribution(covAttr.current); covAttr.current = null; }
    if (mode !== 'dane' || !coverage || !coverage.features.length) return;
    const gj = L.geoJSON(coverage as unknown as Parameters<typeof L.geoJSON>[0], {
      style: (f) => COV_STYLE[(f?.properties as { stan: StanGminy }).stan] ?? COV_STYLE.nieaktualne,
      onEachFeature: (f, lyr) => {
        const p = f.properties as { gmina: string; stan: StanGminy; liczba_aed: number; aktualne: number; nieaktualne: number };
        lyr.bindTooltip(`<strong>${esc(p.gmina)}</strong><br>${COV_TEXT[p.stan]}${p.liczba_aed ? `<br>AED: ${p.liczba_aed} (aktualne ${p.aktualne}, nieaktualne ${p.nieaktualne})` : ''}`, { sticky: true });
      },
    }).addTo(m);
    ensureHatch(m);
    gj.bringToBack();
    covLayer.current = gj;
    const attr = coverage.meta?.atrybucja ?? 'Granice gmin: Państwowy Rejestr Granic – GUGiK';
    m.attributionControl.addAttribution(esc(attr));
    covAttr.current = esc(attr);
    if (fitCoverage) m.fitBounds(gj.getBounds(), { padding: [16, 16] });
  }, [coverage, mode, fitCoverage]);

  return (
    <div className="map" role="region" aria-label={label}>
      <div ref={el} className="map__canvas" style={{ height }} />
    </div>
  );
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const COV_TEXT: Record<StanGminy, string> = {
  brak_danych: 'Brak AED w zbiorze',
  nieaktualne: 'Co najmniej jedno AED z nieaktualnymi danymi',
  aktualne: 'Wszystkie AED mają aktualne dane',
};

// Hatch #D9DDDA on #F2EFE6 with a dashed #6B7570 border (TL concept PDF); other states only a light tint.
const COV_STYLE: Record<StanGminy, L.PathOptions> = {
  brak_danych: { fillColor: 'url(#aed-hatch)', fillOpacity: 0.9, color: '#6B7570', weight: 1.5, dashArray: '5 4', opacity: 1 },
  nieaktualne: { fillColor: '#E2A23B', fillOpacity: 0.14, color: '#B9791A', weight: 1, opacity: 0.6 },
  aktualne: { fillColor: '#1A7A50', fillOpacity: 0.12, color: '#1A7A50', weight: 1, opacity: 0.6 },
};

function ensureHatch(m: L.Map) {
  const svg = m.getPanes().overlayPane.querySelector('svg');
  if (!svg || svg.querySelector('#aed-hatch')) return;
  const ns = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = '<pattern id="aed-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    + '<rect width="10" height="10" fill="#F2EFE6"/><rect width="5" height="10" fill="#D9DDDA"/></pattern>';
  svg.insertBefore(defs, svg.firstChild);
}

// ---------- CR-TL-2: point layer (GET /aed/punkty) ----------
function pointKind(p: AedPoint): PinKind {
  return p.dostepny_teraz === true ? 'ok' : p.dostepny_teraz === false ? 'closed' : 'unknown';
}

function pointName(p: AedPoint, mode: MapMode): string {
  const state = mode === 'dane'
    ? (p.stan_danych === 'aktualne' ? 'dane aktualne' : 'dane nieaktualne')
    : (p.dostepny_teraz === true ? 'dostępne teraz' : p.dostepny_teraz === false ? 'teraz zamknięte' : 'godziny do sprawdzenia');
  return `${p.osm ? 'Do sprawdzenia (OpenStreetMap, niepotwierdzone przez właściciela)' : 'AED'} – ${state}. Naciśnij Enter, aby zobaczyć nazwę i adres.`;
}

function pointMarker(p: AedPoint, mode: MapMode): L.Marker {
  const name = pointName(p, mode);
  const icon = L.divIcon({
    // helper layer "Do sprawdzenia" (OSM) is greyed out – distinct from the common list by colour and description (MODEL_ROL §8)
    className: p.osm ? 'aed-pin aed-pin--pomocnicza' : 'aed-pin',
    html: mode === 'dane' ? dataPinSvg(p.stan_danych, p.osm) : pinSvg(pointKind(p), p.osm),
    iconSize: [40, 52],
    iconAnchor: [20, 50],
    popupAnchor: [0, -46],
  });
  const mk = L.marker([p.lat, p.lon], { icon, title: name, keyboard: true, riseOnHover: true });
  mk.on('add', () => mk.getElement()?.setAttribute('aria-label', name));
  mk.bindPopup('<p class="map-popup__loading">Wczytuję dane AED…</p>', { maxWidth: 280, autoPanPadding: [24, 24] });
  let loaded = false;
  mk.on('popupopen', async (e: L.PopupEvent) => {
    const el = e.popup.getElement();
    const wire = () => {
      const a = el?.querySelector<HTMLAnchorElement>('a[data-aed]');
      if (a) {
        a.addEventListener('click', (ev) => { ev.preventDefault(); navigate(`/aed/${p.id_aed}`); });
        a.focus(); // keyboard users land on the link (WCAG 2.4.3)
      }
    };
    if (loaded) { wire(); return; }
    try {
      const d = await getAed(p.id_aed);
      if (!d) { e.popup.setContent('<p>Nie znaleziono tego AED. Mogło zostać usunięte ze zbioru.</p>'); return; }
      const a = d.aed;
      const dl = dataLabel(a);
      e.popup.setContent(
        `<div class="map-popup"><p class="map-popup__title">${esc(a.nazwa_obiektu || 'AED bez nazwy')}</p>`
        + (a.meta?.warstwa === 'pomocnicza' ? '<p class="map-popup__helper"><strong>Do sprawdzenia</strong> – punkt z OpenStreetMap, niepotwierdzony przez właściciela.</p>' : (a.meta?.dostawca ? `<p class="hint">Dane: ${esc(a.meta.dostawca)}</p>` : ''))
        + `<p>${esc(address(a))}</p>`
        + `<p>${esc(mode === 'dane' ? dl.long : availText(a))}</p>`
        + (a.szafka_zamknieta ? '<p><strong>Szafka zamknięta</strong> – instrukcja na karcie AED.</p>' : '')
        + `<p><a data-aed href="${toHref(`/aed/${encodeURIComponent(p.id_aed)}`)}">Karta AED: dojście, godziny, źródło</a></p></div>`,
      );
      loaded = true;
      wire();
    } catch {
      e.popup.setContent('<p>Nie udało się wczytać danych. Spróbuj ponownie.</p>');
    }
  });
  mk.on('keypress', (e: L.LeafletKeyboardEvent) => { if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') mk.openPopup(); });
  return mk;
}

function availText(a: AedView): string {
  if (a.dostep === 'prywatny') return 'Tylko dla uprawnionych';
  if (a.status_urzadzenia === 'niesprawny' || a.status_urzadzenia === 'w_serwisie') return 'Urządzenie niesprawne lub w serwisie';
  const v = availableNow(a);
  return v === true ? 'Dostępne teraz' : v === false ? 'Teraz zamknięte' : 'Sprawdź godziny na miejscu';
}
