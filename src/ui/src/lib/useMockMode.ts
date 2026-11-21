import { useEffect, useState } from 'react';
import { isMockMode, onMockModeChange } from '../api/client';

export function useMockMode(): boolean {
  const [m, setM] = useState(isMockMode());
  useEffect(() => onMockModeChange(setM), []);
  return m;
}
