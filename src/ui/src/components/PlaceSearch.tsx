// Place search with suggestions (ARIA combobox): voivodeships, gminy, localities, streets, addresses (GET /miejsca)
// and – optionally – "search this text in AED names". Used on /mapa (zooms the map) and /znajdz (nearest AED).
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { reverseGeocode, searchPlaces } from '../api/client';
import { Icon } from './ui';
import type { Miejsce, TypMiejsca } from '../api/types';

/** `gps` = the device location ("Moja lokalizacja"), put into the search box like any other place */
export type Wybor = (Miejsce & { gps?: boolean }) | { typ: 'tekst'; nazwa: string };

const TYP: Record<TypMiejsca, string> = {
  wojewodztwo: 'Województwo', gmina: 'Gmina', miejscowosc: 'Miejscowość', ulica: 'Ulica', adres: 'Adres',
};

interface Props {
  label: string;
  placeholder?: string;
  hint?: string;
  /** map centre: a street name alone is searched in the gmina there */
  near?: { lat: number; lon: number } | null;
  /** text shown at start (the parent remounts the component with a new `key` to reset it) */
  /** offer "Szukaj „…” w nazwach AED" as the last option */
  textOption?: boolean;
  initial?: string;
  onSelect: (w: Wybor) => void;
  /** show the "Moja lokalizacja" button inside the box: the location becomes the search text (not a separate filter) */
  locate?: boolean;
  /** called when the box is cleared */
  onClear?: () => void;
}

export function PlaceSearch({ label, placeholder, hint, near, textOption = false, initial = '', onSelect, locate = false, onClear }: Props) {
  const id = useId();
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<Miejsce[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [noHits, setNoHits] = useState(false);
  const [geo, setGeo] = useState('');
  const req = useRef(0);
  const pendingEnter = useRef(false); // Enter pressed before the suggestions arrived → take the first one then
  const chooseRef = useRef<(w: Wybor) => void>(() => {});
  const nearRef = useRef(near);
  nearRef.current = near;

  // suggestions while typing (debounced; the newest answer wins)
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setItems([]); setNoHits(false); return; }
    const my = ++req.current;
    const h = setTimeout(() => {
      setBusy(true);
      searchPlaces(t, nearRef.current).then(
        (r) => {
          if (my !== req.current) return;
          setItems(r); setNoHits(!r.length); setBusy(false); setActive(r.length ? 0 : textOption ? 0 : -1);
          if (pendingEnter.current) {
            pendingEnter.current = false;
            const w: Wybor | undefined = r[0] ?? (textOption ? { typ: 'tekst', nazwa: t } : undefined);
            if (w) chooseRef.current(w);
          }
        },
        () => { if (my === req.current) { setItems([]); setBusy(false); pendingEnter.current = false; } },
      );
    }, pendingEnter.current ? 0 : 250);
    return () => clearTimeout(h);
  }, [q, textOption]);

  const options: Wybor[] = [...items, ...(textOption && q.trim().length >= 2 ? [{ typ: 'tekst' as const, nazwa: q.trim() }] : [])];
  const show = open && q.trim().length >= 2 && (options.length > 0 || busy || noHits);

  const choose = (w: Wybor) => {
    pendingEnter.current = false;
    req.current++; // ignore answers still on the way
    setBusy(false);
    setQ(w.nazwa);
    setOpen(false);
    onSelect(w);
  };
  chooseRef.current = choose;

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Escape') { setOpen(false); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const typed = q.trim();
      // suggestions for what is typed are not here yet → wait for them instead of searching AED names
      const stale = busy || (typed.length >= 2 && !items.length && !noHits);
      if (stale && active <= 0) { pendingEnter.current = true; setBusy(true); return; }
      const w = options[active >= 0 ? active : 0];
      if (w) choose(w);
    }
  };

  function useMyLocation() {
    setGeo('');
    if (!('geolocation' in navigator)) { setGeo('Ta przeglądarka nie podaje lokalizacji. Wpisz adres.'); return; }
    setGeo('Ustalam Twoją lokalizację…');
    navigator.geolocation.getCurrentPosition(async (g) => {
      const lat = +g.coords.latitude.toFixed(6), lon = +g.coords.longitude.toFixed(6);
      let name = 'Moja lokalizacja';
      try {
        const a = await reverseGeocode(lat, lon);
        const street = [a.ulica, a.numer_budynku].filter(Boolean).join(' ');
        if (street || a.miejscowosc) name = `Moja lokalizacja: ${[street, a.miejscowosc].filter(Boolean).join(', ')}`;
      } catch { /* the address is only a label – the coordinates are enough */ }
      setGeo('');
      choose({ typ: 'adres', nazwa: name, opis: 'Twoja lokalizacja', lat, lon, bbox: null, gps: true });
    }, (e) => setGeo(e.code === 1 ? 'Brak zgody na lokalizację. Wpisz adres albo miejscowość.' : 'Nie udało się ustalić lokalizacji. Wpisz adres.'),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  const listId = `${id}-list`;
  return (
    <div className="place-search">
      <label htmlFor={`${id}-in`}>{label}</label>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      <div className={`place-search__box${locate ? ' place-search__box--locate' : ''}`}>
        <div className="place-search__field">
        <input
          id={`${id}-in`} type="text" role="combobox" autoComplete="off" spellCheck={false}
          aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={show && active >= 0 ? `${id}-o${active}` : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          value={q} placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
        />
        {q && <button type="button" className="place-search__clear" aria-label="Wyczyść wyszukiwanie" onClick={() => { setQ(''); setItems([]); onClear?.(); }}>×</button>}
        </div>
        {locate && (
          <button type="button" className="place-search__locate" onClick={useMyLocation}>
            <Icon name="locate" /><span>Moja lokalizacja</span>
          </button>
        )}
      </div>
      {locate && <p role="status" className="place-search__geo hint">{geo}</p>}
      {show && (
        <ul id={listId} role="listbox" className="place-search__list" aria-label="Podpowiedzi">
          {busy && !items.length && <li className="place-search__info" role="presentation">Szukam…</li>}
          {noHits && !busy && !textOption && <li className="place-search__info" role="presentation">Nic nie znaleziono. Spróbuj: „Kraków, Floriańska 3”.</li>}
          {options.map((o, i) => (
            <li key={`${o.typ}-${o.nazwa}-${i}`} id={`${id}-o${i}`} role="option" aria-selected={i === active}
              className={`place-search__opt${i === active ? ' is-active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}>
              {o.typ === 'tekst' ? (
                <><span className="place-search__type">Nazwa AED</span><span className="place-search__name">Szukaj „{o.nazwa}” w nazwach i opisach AED</span></>
              ) : (
                <>
                  <span className="place-search__type">{TYP[o.typ]}</span>
                  <span className="place-search__name">{o.nazwa}</span>
                  <span className="place-search__desc">
                    {o.opis}{o.liczba_aed !== undefined ? ` · ${o.liczba_aed.toLocaleString('pl-PL')} AED` : ''}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
