// Leaflet (BSD-2) used directly – react-leaflet is excluded (Hippocratic licence).
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { AedView, Pokrycie, StanGminy } from '../api/types';
import { dataLabel } from '../lib/dataState';
import { availableNow } from '../lib/format';
import { navigate } from '../router';
import { dataPinSvg, pinSvg, type PinKind } from './Brand';
import type { MapMode } from './MapMode';

export interface MapViewProps {
  items: AedView[];
  user?: { lat: number; lon: number } | null;
  /** id of the record to centre on (E3 card) */
  focusId?: string;
  /** click on the map picks a point (E4, E5 form) */
  onPick?: (p: { lat: number; lon: number }) => void;
  picked?: { lat: number; lon: number } | null;
  label: string;
  height?: number;
  cluster?: boolean;
  /** CR-TL-1: pins by availability (default) or by data freshness */
  mode?: MapMode;
  /** municipality layer (GET /pokrycie), shown in the data mode */
  coverage?: Pokrycie | null;
  /** fit the view to the municipality layer when it appears (E2); E1 keeps the nearest AEDs in view */
  fitCoverage?: boolean;
}

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

export function MapView({ items, user, focusId, onPick, picked, label, height = 420, cluster = true, mode = 'dostepnosc', coverage, fitCoverage = false }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const extra = useRef<L.LayerGroup | null>(null);
  const covLayer = useRef<L.GeoJSON | null>(null);
  const covAttr = useRef<string | null>(null);
  const fitKey = useRef<string>('');
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { keyboard: true, zoomControl: false, scrollWheelZoom: false, maxBounds: [[47, 12], [56.5, 26.5]] });
    L.control.zoom({ zoomInTitle: 'Przybliż mapę', zoomOutTitle: 'Oddal mapę' }).addTo(m);
    m.fitBounds(POLAND);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">autorzy OpenStreetMap</a>',
    }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => pickRef.current?.({ lat: +e.latlng.lat.toFixed(6), lon: +e.latlng.lng.toFixed(6) }));
    m.on('focus', () => m.scrollWheelZoom.enable());
    m.on('blur', () => m.scrollWheelZoom.disable());
    extra.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; layer.current = null; covLayer.current = null; covAttr.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    layer.current?.remove();
    const anyL = L as unknown as { markerClusterGroup?: (o: object) => L.LayerGroup };
    const group: L.LayerGroup = cluster && anyL.markerClusterGroup
      ? anyL.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40 })
      : L.layerGroup();
    const pts: L.LatLngExpression[] = [];
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
  }, [items, user, focusId, cluster, mode]);

  useEffect(() => {
    const g = extra.current;
    if (!g) return;
    g.clearLayers();
    if (user) L.circleMarker([user.lat, user.lon], { radius: 9, color: '#0F3B2B', weight: 3, fillColor: '#2f6fe0', fillOpacity: 0.9 }).bindTooltip('Twoja lokalizacja').addTo(g);
    if (picked) {
      L.marker([picked.lat, picked.lon], { icon: L.divIcon({ className: 'pick-marker', html: '<span aria-hidden="true"></span>', iconSize: [30, 30], iconAnchor: [15, 28] }), title: 'Wybrany punkt', alt: 'Wybrany punkt', keyboard: false }).addTo(g);
      map.current?.setView([picked.lat, picked.lon], Math.max(map.current.getZoom(), 16));
    }
  }, [user, picked]);

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
