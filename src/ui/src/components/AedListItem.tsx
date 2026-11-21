import type { AedView } from '../api/types';
import { AedSummary } from './AedSummary';

export function AedListItem({ aed, rank, nearest = false }: { aed: AedView; rank?: number; nearest?: boolean }) {
  return (
    <li className={`aed-item${nearest ? ' aed-item--nearest' : ''}`}>
      <article aria-labelledby={`t-${aed.id_aed}`}><AedSummary aed={aed} rank={rank} nearest={nearest} /></article>
    </li>
  );
}
