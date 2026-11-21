// "Nawiguj": open the device's own maps app, as professional services do – Apple Maps on iPhone, iPad and Mac
// (maps.apple.com opens the Maps app there), Google Maps everywhere else (on Android the link opens the Google Maps app).
// Walking directions, destination = the AED's coordinates (more precise than the address).
export type MapsApp = 'apple' | 'google';

export function preferredMapsApp(): MapsApp {
  if (typeof navigator === 'undefined') return 'google';
  const ua = navigator.userAgent || '';
  const p = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '';
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua) || /^(iPhone|iPad|iPod|Mac)/i.test(p) ? 'apple' : 'google';
}

export function directionsUrl(app: MapsApp, lat: number, lon: number, name?: string): string {
  const dest = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  if (app === 'apple') return `https://maps.apple.com/?daddr=${dest}&dirflg=w${name ? `&q=${encodeURIComponent(name)}` : ''}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
}

export const APP_LABEL: Record<MapsApp, string> = { apple: 'Mapy Apple', google: 'Mapy Google' };
