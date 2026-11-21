import type { AedView } from '../api/types';
import { address, distance, floor, osmDirections } from '../lib/format';
import { describeHours } from '../lib/hours';
import { Link } from '../router';
import { AvailabilityBadge, DataBadge, ExternalLink, Icon, LockedCabinet } from './ui';
import type { MapMode } from './MapMode';

export function AedListItem({ aed, from, rank, mode = 'dostepnosc' }: { aed: AedView; from?: { lat: number; lon: number } | null; rank?: number; mode?: MapMode }) {
  const where = [aed.opis_lokalizacji, floor(aed.pietro), aed.wewnatrz_budynku ? 'wewnątrz budynku' : 'na zewnątrz'].filter(Boolean).join(' · ');
  return (
    <li className="aed-item">
      <article aria-labelledby={`t-${aed.id_aed}`}>
        <div className="aed-item__head">
          <h3 id={`t-${aed.id_aed}`} className="aed-item__title">
            {rank !== undefined && <span className="aed-item__rank">{rank}.</span>}
            <Link to={`/aed/${aed.id_aed}`}>{aed.nazwa_obiektu}</Link>
          </h3>
          {aed.odleglosc_m !== undefined && (
            <p className="aed-item__dist"><Icon name="pin" /><span><span className="visually-hidden">Odległość: </span>{distance(aed.odleglosc_m)}</span></p>
          )}
        </div>
        <div className="aed-item__badges">
          {mode === 'dane' ? <><DataBadge aed={aed} /><AvailabilityBadge aed={aed} /></> : <><AvailabilityBadge aed={aed} /><DataBadge aed={aed} /></>}
          {aed.mobilny && <span className="badge badge--info"><Icon name="car" />Urządzenie w pojeździe</span>}
        </div>
        <p className="aed-item__addr">{address(aed)}</p>
        <p className="aed-item__where">{where}</p>
        <p className="aed-item__hours"><span className="visually-hidden">Godziny: </span>{describeHours(aed.godziny_dostepnosci).join('; ')}</p>
        <LockedCabinet aed={aed} compact />
        <p className="aed-item__actions">
          <Link to={`/aed/${aed.id_aed}`}>Szczegóły i dojście<span className="visually-hidden">: {aed.nazwa_obiektu}</span></Link>
          <ExternalLink href={osmDirections(from ?? null, { lat: aed.szerokosc_geograficzna, lon: aed.dlugosc_geograficzna })}>
            Prowadź pieszo<span className="visually-hidden"> do: {aed.nazwa_obiektu}</span>
          </ExternalLink>
        </p>
      </article>
    </li>
  );
}
