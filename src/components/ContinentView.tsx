import { useMemo, useState } from 'react';
import { geoNaturalEarth1, geoOrthographic, geoPath } from 'd3-geo';
import { useStore } from '../state/store';
import {
  CONTINENTS,
  codeForMapKey,
  sovereignByMapId,
  countryByCode,
  type Continent,
} from '../data/countries';
import { worldFeatures, featureKey } from '../data/geo';
import { fillVarForStatus } from './mapColors';
import { Legend } from './Legend';

const VIEW_W = 800;
const VIEW_H = 620;

// Hand-tuned frames [west, south, east, north]; east may exceed 180 to cross the antimeridian.
const FRAMES: Record<Continent, [number, number, number, number]> = {
  Africa: [-20, -36, 52, 38],
  Asia: [24, -12, 150, 56],
  Europe: [-26, 34, 46, 72],
  'North America': [-170, 6, -50, 84],
  'South America': [-93, -57, -32, 14],
  Oceania: [110, -50, 210, -4],
  Antarctica: [-180, -90, 180, -60],
};

function frameProjection(continent: Continent) {
  if (continent === 'Antarctica') {
    // South-polar hemisphere view.
    return geoOrthographic()
      .rotate([0, 90])
      .clipAngle(90)
      .fitExtent(
        [
          [10, 10],
          [VIEW_W - 10, VIEW_H - 10],
        ],
        { type: 'Sphere' },
      );
  }
  const [west, south, east, north] = FRAMES[continent];
  const centerLon = (west + east) / 2;
  // Sample the frame's edges so fitExtent sees its full extent even across the antimeridian.
  const points: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const lon = west + ((east - west) * i) / 8;
    const normLon = ((lon + 540) % 360) - 180;
    for (const lat of [south, (south + north) / 2, north]) {
      points.push([normLon, lat]);
    }
  }
  return geoNaturalEarth1()
    .rotate([-centerLon, 0])
    .fitExtent(
      [
        [10, 10],
        [VIEW_W - 10, VIEW_H - 10],
      ],
      { type: 'MultiPoint', coordinates: points },
    );
}

export function ContinentView({ onSelect }: { onSelect: (code: string) => void }) {
  const { statuses, listMode } = useStore();
  const [continent, setContinent] = useState<Continent>('Europe');

  const shapes = useMemo(() => {
    const projection = frameProjection(continent);
    const path = geoPath(projection);
    return worldFeatures.map((f) => {
      const key = featureKey(f);
      const code = codeForMapKey(key);
      const country = code ? countryByCode.get(code) : undefined;
      const isTerritory = sovereignByMapId.has(key);
      return {
        key,
        d: path(f) ?? '',
        code,
        name: isTerritory ? `${f.properties.name} (${country?.name})` : (country?.name ?? f.properties.name),
        // Territories paint and select as their sovereign in every frame.
        inContinent: country?.continent === continent || isTerritory,
        inList: !!country && (listMode === 'travel' || country.un),
      };
    });
  }, [continent, listMode]);

  return (
    <div className="view no-scroll">
      <Legend />
      <div className="chips">
        {CONTINENTS.map((c) => (
          <button
            key={c}
            className={c === continent ? 'active' : ''}
            onClick={() => setContinent(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="continent-map">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id="map-frame">
              <rect x="0" y="0" width={VIEW_W} height={VIEW_H} rx="14" />
            </clipPath>
          </defs>
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="var(--ocean)" rx="14" />
          <g clipPath="url(#map-frame)">
            {shapes.map((s) => {
              const active = s.inContinent && s.inList && s.code;
              const status = s.code ? statuses[s.code] : undefined;
              return (
                <path
                  key={s.key}
                  d={s.d}
                  fill={active ? fillVarForStatus(status, true) : 'var(--land-muted)'}
                  stroke="var(--map-border)"
                  strokeWidth={0.7}
                  opacity={active ? 1 : 0.55}
                  style={active ? undefined : { pointerEvents: 'none' }}
                  onClick={active ? () => onSelect(s.code!) : undefined}
                >
                  <title>{s.name}</title>
                </path>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="globe-hint" style={{ position: 'static', paddingTop: 6 }}>
        Tap a country to mark it
      </div>
    </div>
  );
}
