import slownik from '../mocks/slownik_danych.json';

export interface FieldDef {
  nazwa_pola: string;
  etykieta: string;
  opis: string;
  typ: string;
  format: string;
  przyklad: string;
  obowiazkowosc: string;
  slownik: string;
  tag_osm: string;
  schema_org: string;
}

export const FIELDS = slownik as FieldDef[];
export const fieldLabel = (name: string) => FIELDS.find((f) => f.nazwa_pola === name)?.etykieta ?? name;

/** CSV template (UTF-8, comma, CRLF, one header row) – fallback when the API endpoint is not available. */
export function templateCsv(): string {
  const head = FIELDS.map((f) => f.nazwa_pola).join(',');
  const example = FIELDS.map((f) => {
    const v = f.przyklad ?? '';
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',');
  return `${head}\r\n${example}\r\n`;
}
