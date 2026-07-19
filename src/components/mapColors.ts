import type { Status } from '../data/countries';

export interface MapColors {
  visited: string;
  home: string;
  soon: string;
  land: string;
  landMuted: string;
  ocean: string;
  border: string;
  graticule: string;
  label: string;
  labelHalo: string;
}

let cache: { theme: string | undefined; colors: MapColors } | null = null;

/** Resolve the current theme's map colors from CSS variables (canvas can't use var()). */
export function readMapColors(): MapColors {
  const theme = document.documentElement.dataset.theme;
  if (cache && cache.theme === theme) return cache.colors;
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  const colors: MapColors = {
    visited: get('--visited'),
    home: get('--home'),
    soon: get('--soon'),
    land: get('--land'),
    landMuted: get('--land-muted'),
    ocean: get('--ocean'),
    border: get('--map-border'),
    graticule: get('--graticule'),
    label: get('--map-label'),
    labelHalo: get('--map-label-halo'),
  };
  cache = { theme, colors };
  return colors;
}

export function fillForStatus(
  status: Status | undefined,
  inList: boolean,
  colors: MapColors,
): string {
  if (!inList) return colors.landMuted;
  if (status) return colors[status];
  return colors.land;
}

/** Same logic for SVG, as CSS var() references so the theme applies automatically. */
export function fillVarForStatus(status: Status | undefined, inList: boolean): string {
  if (!inList) return 'var(--land-muted)';
  if (status === 'visited') return 'var(--visited)';
  if (status === 'home') return 'var(--home)';
  if (status === 'soon') return 'var(--soon)';
  return 'var(--land)';
}
