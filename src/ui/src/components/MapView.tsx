// Leaflet (BSD-2) used directly – react-leaflet is excluded (Hippocratic licence).
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { AedView } from '../api/types';
import { availableNow } from '../lib/format';
import { navigate } from '../router';
import { pinSvg, type PinKind } from './Brand';

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
}

const POLAND: L.LatLngBoundsExpression = [[49.0, 14.1], [54.9, 24.2]];

function pinKind(a: AedView): PinKind {
  if (a.dostep === 'prywatny') return 'private';
  if (a.status_urzadzenia === 'niesprawny' || a.status_urzadzenia === 'w_serwisie') return 'closed';
  const v = availableNow(a);
  return v === true ? 'ok' : v === false ? 'closed' : 'unknown';
}

function markerIcon(a: AedView): L.DivIcon {
  return L.divIcon({
    className: 'aed-pin',
    html: pinSvg(pinKind(a), a.licencja === 'ODbL-1.0'),
    iconSize: [40, 52],
    iconAnchor: [20, 50],
  });
}

function markerName(a: AedView): string {
  const v = availableNow(a);
  const state = a.dostep === 'prywatny' ? 'tylko dla uprawnionych' : v === true ? 'dostępne teraz' : v === false ? 'teraz zamknięte' : 'godziny do sprawdzenia';
  return `${a.nazwa_obiektu}, ${a.miejscowosc} – ${state}${a.szafka_zamknieta ? ', szafka zamknięta' : ''}`;
}

export function MapView({ items, user, focusId, onPick, picked, label, height = 420, cluster = true }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const extra = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { keyboard: true, zoomControl: true, scrollWheelZoom: false, maxBounds: [[47, 12], [56.5, 26.5]] });
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
    return () => { m.remove(); map.current = null; layer.current = null; };
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
      const name = markerName(a);
      const mk = L.marker(ll, { icon: markerIcon(a), title: name, alt: name, keyboard: true, riseOnHover: true });
      mk.on('click', () => navigate(`/aed/${a.id_aed}`));
      mk.on('keypress', (e: L.LeafletKeyboardEvent) => { if (e.originalEvent.key === 'Enter' || e.originalEvent.key === ' ') navigate(`/aed/${a.id_aed}`); });
      group.addLayer(mk);
    }
    group.addTo(m);
    layer.current = group;
    if (user) pts.push([user.lat, user.lon]);
    const focus = focusId ? items.find((a) => a.id_aed === focusId) : undefined;
    if (focus) m.setView([focus.szerokosc_geograficzna, focus.dlugosc_geograficzna], 17);
    else if (pts.length === 1) m.setView(pts[0], 16);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 17 });
  }, [items, user, focusId, cluster]);

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

  return (
    <div className="map" role="region" aria-label={label}>
      <div ref={el} className="map__canvas" style={{ height }} />
    </div>
  );
}
