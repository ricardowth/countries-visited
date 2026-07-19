import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from './world-50m.json';

export type CountryFeature = Feature<Geometry, { name: string }>;

const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;

export const worldFeatures: CountryFeature[] = (
  feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>
).features;

/**
 * Stable key for a Natural Earth feature. Most features carry an ISO numeric id;
 * de facto states (Kosovo, Somaliland, N. Cyprus) don't, so we fall back to the name.
 * Must match the `mapId` values produced by scripts/generate-data.mjs.
 */
export function featureKey(f: CountryFeature): string {
  return f.id != null ? String(f.id) : `n:${f.properties.name}`;
}
