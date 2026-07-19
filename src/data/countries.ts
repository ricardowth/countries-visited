import raw from './countries.json';
import territoriesRaw from './territories.json';

export type Status = 'visited' | 'home' | 'soon';
export type ListMode = 'un' | 'travel';
export type Continent =
  | 'Africa'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Oceania'
  | 'Antarctica';

export interface Country {
  code: string;
  name: string;
  flag: string;
  continent: Continent;
  un: boolean;
  mapId: string | null;
}

export const COUNTRIES = raw as Country[];

export const CONTINENTS: Continent[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
];

export const STATUS_LABEL: Record<Status, string> = {
  visited: 'Visited',
  home: 'Home',
  soon: 'Going soon',
};

export function countriesFor(mode: ListMode): Country[] {
  return mode === 'un' ? COUNTRIES.filter((c) => c.un) : COUNTRIES;
}

export const countryByCode = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Map from Natural Earth feature key to our country code (only countries with geometry). */
export const codeByMapId = new Map(
  COUNTRIES.filter((c) => c.mapId !== null).map((c) => [c.mapId as string, c.code]),
);

/**
 * Dependent territories drawn as separate map features (Greenland, Puerto Rico, …):
 * feature key → sovereign country code. They paint and select as their sovereign.
 */
export const sovereignByMapId = new Map(Object.entries(territoriesRaw as Record<string, string>));

/** Resolve any map feature to a country code, following territories to their sovereign. */
export function codeForMapKey(key: string): string | undefined {
  return codeByMapId.get(key) ?? sovereignByMapId.get(key);
}
