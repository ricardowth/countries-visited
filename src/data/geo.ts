import { feature } from 'topojson-client';
import { geoBounds, geoCentroid, geoDistance } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from './world-50m.json';
import worldLow from './world-110m.json';

export type CountryFeature = Feature<Geometry, { name: string }>;

type WorldTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>;

function featuresOf(topology: WorldTopology): CountryFeature[] {
  return (
    feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>
  ).features;
}

/** Full-detail Natural Earth 1:50m features — static renders and hit-testing. */
export const worldFeatures: CountryFeature[] = featuresOf(world as unknown as WorldTopology);

/** Coarse 1:110m features — cheap frames while the globe is being dragged/zoomed. */
export const worldFeaturesLow: CountryFeature[] = featuresOf(worldLow as unknown as WorldTopology);

/**
 * Stable key for a Natural Earth feature. Most features carry an ISO numeric id;
 * de facto states (Kosovo, Somaliland, N. Cyprus) don't, so we fall back to the name.
 * Must match the `mapId` values produced by scripts/generate-data.mjs.
 */
export function featureKey(f: CountryFeature): string {
  return f.id != null ? String(f.id) : `n:${f.properties.name}`;
}

export interface RenderFeature {
  f: CountryFeature;
  key: string;
  /** Spherical centroid + covering angular radius, for visibility culling. */
  centroid: [number, number];
  angRadius: number;
}

function prepare(features: CountryFeature[]): RenderFeature[] {
  return features.map((f) => {
    const centroid = geoCentroid(f);
    const [[west, south], [east, north]] = geoBounds(f);
    let angRadius = 0;
    for (const corner of [
      [west, south],
      [west, north],
      [east, south],
      [east, north],
    ] as [number, number][]) {
      angRadius = Math.max(angRadius, geoDistance(centroid, corner));
    }
    return { f, key: featureKey(f), centroid, angRadius: angRadius + 0.05 };
  });
}

export const renderFeaturesHigh = prepare(worldFeatures);
export const renderFeaturesLow = prepare(worldFeaturesLow);

export const lowFeatureByKey = new Map(worldFeaturesLow.map((f) => [featureKey(f), f]));
