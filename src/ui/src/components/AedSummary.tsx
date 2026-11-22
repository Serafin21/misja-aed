// One AED in a few lines – the same in the list next to the map and in the preview after clicking a pin:
// name · open/closed + when the data was checked · address · how to get there · hours (or "nieokreślone") ·
// access (free / locked cabinet – how to open it / only for authorised people) · "Nawiguj" + details.
import type { AedView } from '../api/types';
import { address, availableNow, distance, floor, aedName } from '../lib/format';
import { dataLabel } from '../lib/dataState';
import { describeHours } from '../lib/hours';
import { APP_LABEL, directionsUrl, preferredMapsApp, type MapsApp } from '../lib/navigation';
import { Link } from '../router';
import { Icon } from './ui';

export function openState(a: AedView): { cls: string; icon: string; text: string } {
  if (a.status_urzadzenia === 'niesprawny' || a.status_urzadzenia === 'w_serwisie') return { cls: 'no', icon: 'x', text: 'Niesprawne' };
  if (a.dostep === 'prywatny') return { cls: 'no', icon: 'lock', text: 'Tylko dla uprawnionych' };
  const v = availableNow(a);
  if (v === true) return { cls: 'ok', icon: 'check', text: 'Otwarte teraz' };
  if (v === false) return { cls: 'no', icon: 'clock', text: 'Teraz zamknięte' };
  return { cls: 'unknown', icon: 'question', text: 'Godziny nieokreślone' };
}

function access(a: AedView): { icon: string; text: string; warn: boolean } {
  if (a.dostep === 'prywatny') return { icon: 'lock', text: `Tylko dla uprawnionych${a.instrukcja_dostepu ? ` – ${a.instrukcja_dostepu}` : ''}`, warn: true };
  if (a.szafka_zamknieta === true) return { icon: 'lock', text: `Szafka zamknięta – ${a.instrukcja_dostepu || 'zapytaj obsługę budynku albo dyspozytora 112'}`, warn: true };
  if (a.szafka_zamknieta === false) return { icon: 'check', text: a.dostep === 'ograniczony' ? 'Bez klucza, dostęp ograniczony (np. w godzinach pracy)' : 'Dostępne bez klucza', warn: false };
  return { icon: 'question', text: 'Nie wiadomo, czy szafka jest zamknięta – sprawdź na miejscu', warn: false };
}

export function AedSummary({ aed, rank, nearest = false, headingLevel = 3, compact = false }: {
  aed: AedView; rank?: number; nearest?: boolean; headingLevel?: 3 | 4; compact?: boolean;
}) {
  const st = openState(aed);
  const d = dataLabel(aed);
  const inside = aed.wewnatrz_budynku === true ? 'w budynku' : aed.wewnatrz_budynku === false ? 'na zewnątrz' : '';
  const how = [aed.opis_lokalizacji, floor(aed.pietro), aed.opis_lokalizacji?.trim().toLowerCase().includes(inside) ? '' : inside].filter(Boolean).join(' · ');
  const hrs = aed.godziny_dostepnosci ? describeHours(aed.godziny_dostepnosci).join('; ') : 'Godziny otwarcia nieokreślone';
  const acc = access(aed);
  const app: MapsApp = preferredMapsApp();
  const other: MapsApp = app === 'apple' ? 'google' : 'apple';
  const H = `h${headingLevel}` as 'h3' | 'h4';
  const lat = aed.szerokosc_geograficzna, lon = aed.dlugosc_geograficzna;
  return (
    <div className={`aed-sum${compact ? ' aed-sum--compact' : ''}`}>
      {nearest && <p className="aed-sum__nearest"><Icon name="pin" />Najbliższe AED</p>}
      <div className="aed-sum__head">
        <H className="aed-sum__title" id={`t-${aed.id_aed}`}>
          {rank !== undefined && <span className="aed-sum__rank">{rank}.</span>}
          <Link to={`/aed/${aed.id_aed}`}>{aedName(aed.nazwa_obiektu)}</Link>
        </H>
        {aed.odleglosc_m !== undefined && <span className="aed-sum__dist"><span className="visually-hidden">Odległość: </span>{distance(aed.odleglosc_m)}</span>}
      </div>
      <p className="aed-sum__status">
        <span className={`badge badge--${st.cls}`}><Icon name={st.icon} />{st.text}</span>
        <span className={`aed-sum__checked aed-sum__checked--${d.state}`} title={d.long}>
          {aed.data_weryfikacji ? `Aktualizacja: ${aed.data_weryfikacji.slice(8, 10)}.${aed.data_weryfikacji.slice(5, 7)}.${aed.data_weryfikacji.slice(0, 4)}` : 'Brak daty aktualizacji'}
        </span>
        {aed.meta?.status_publikacji === 'nieopublikowane_w_dane_gov_pl' && <span className="badge badge--proto" title="Dodane w prototypie aplikacji – nie pochodzi z Wykazu AED w dane.gov.pl"><Icon name="question" />Prototyp – nieopublikowane w dane.gov.pl</span>}
        {aed.meta?.warstwa === 'pomocnicza' && <span className="badge badge--helper" title="Punkt z OpenStreetMap, niepotwierdzony przez właściciela"><Icon name="question" />Do sprawdzenia</span>}
      </p>
      <p className="aed-sum__addr">{address(aed)}</p>
      {how && <p className="aed-sum__how"><span className="aed-sum__label">Jak dojść: </span>{how}</p>}
      <p className="aed-sum__hours"><Icon name="clock" /><span><span className="visually-hidden">Godziny: </span>{hrs}</span></p>
      <p className={`aed-sum__access${acc.warn ? ' aed-sum__access--warn' : ''}`}><Icon name={acc.icon} /><span>{acc.text}</span></p>
      <div className="aed-sum__actions">
        <a className="btn btn--primary btn--small aed-sum__nav" href={directionsUrl(app, lat, lon, aed.nazwa_obiektu)} target="_blank" rel="noopener noreferrer">
          <Icon name="arrow" />Nawiguj<span className="visually-hidden"> do {aedName(aed.nazwa_obiektu)} – {APP_LABEL[app]}, otwiera się w nowym oknie</span>
        </a>
        <Link className="aed-sum__more" to={`/aed/${aed.id_aed}`}>Szczegóły<span className="visually-hidden">: {aedName(aed.nazwa_obiektu)}</span></Link>
        <a className="aed-sum__alt" href={directionsUrl(other, lat, lon, aed.nazwa_obiektu)} target="_blank" rel="noopener noreferrer">
          {APP_LABEL[other]}<span className="visually-hidden"> – nawigacja, otwiera się w nowym oknie</span>
        </a>
      </div>
    </div>
  );
}
