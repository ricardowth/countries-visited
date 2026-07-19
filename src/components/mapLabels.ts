import { geoArea, geoCentroid } from 'd3-geo';
import type { Position } from 'geojson';
import { worldFeatures, featureKey, type CountryFeature } from '../data/geo';
import { codeForMapKey, countryByCode, sovereignByMapId } from '../data/countries';

export interface LabelAnchor {
  key: string;
  code: string;
  /** The feature's largest polygon — labels anchor here so far-flung parts
   *  (Alaska, French Guiana, Svalbard) don't drag the label into the sea. */
  labelFeature: CountryFeature;
  /** Spherical centroid of labelFeature, for globe visibility tests. */
  centroid: [number, number];
  /** Spherical area of the whole feature (steradians), for tap-target sizing. */
  areaSr: number;
  name: string;
}

function largestPolygonFeature(f: CountryFeature): CountryFeature {
  if (f.geometry.type !== 'MultiPolygon') return f;
  let best: Position[][] | null = null;
  let bestArea = -1;
  for (const coords of f.geometry.coordinates) {
    const area = geoArea({ type: 'Polygon', coordinates: coords });
    if (area > bestArea) {
      bestArea = area;
      best = coords;
    }
  }
  return { ...f, geometry: { type: 'Polygon', coordinates: best! } };
}

export const labelAnchors: LabelAnchor[] = worldFeatures.flatMap((f) => {
  const key = featureKey(f);
  const code = codeForMapKey(key);
  if (!code) return [];
  // Territories keep their own geographic name (Greenland, not Denmark).
  const name = sovereignByMapId.has(key)
    ? f.properties.name
    : (countryByCode.get(code)?.name ?? f.properties.name);
  const labelFeature = largestPolygonFeature(f);
  return [
    { key, code, labelFeature, centroid: geoCentroid(labelFeature), areaSr: geoArea(f), name },
  ];
});

export const anchorByKey = new Map(labelAnchors.map((a) => [a.key, a]));

/**
 * Font size that fits `name` inside a box of w×h, or null when it would be
 * smaller than `min` (too small to read — better no label than clutter).
 * 0.6 ≈ average glyph width per font-size unit for the system UI font.
 */
export function fitLabelSize(
  name: string,
  w: number,
  h: number,
  min: number,
  max: number,
): number | null {
  const size = Math.min(max, h * 0.6, (w * 0.92) / (name.length * 0.6));
  return size >= min ? size : null;
}

export interface LabelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function labelRect(x: number, y: number, name: string, size: number): LabelRect {
  const w = name.length * size * 0.6;
  return { x0: x - w / 2 - 2, y0: y - size / 2 - 2, x1: x + w / 2 + 2, y1: y + size / 2 + 2 };
}

export function overlapsAny(rect: LabelRect, placed: LabelRect[]): boolean {
  return placed.some(
    (r) => r.x0 < rect.x1 && rect.x0 < r.x1 && r.y0 < rect.y1 && rect.y0 < r.y1,
  );
}
