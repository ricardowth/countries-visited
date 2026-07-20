import { useEffect, useMemo, useRef, useState } from 'react';
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
import { anchorByKey, fitLabelSize, labelRect, overlapsAny, type LabelRect } from './mapLabels';
import { Legend } from './Legend';

const FALLBACK_W = 800;
const FALLBACK_H = 620;
const FRAME_PAD = 14;

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

function frameProjection(continent: Continent, w: number, h: number) {
  const extent: [[number, number], [number, number]] = [
    [FRAME_PAD, FRAME_PAD],
    [w - FRAME_PAD, h - FRAME_PAD],
  ];
  if (continent === 'Antarctica') {
    // South-polar hemisphere view.
    return geoOrthographic().rotate([0, 90]).clipAngle(90).fitExtent(extent, { type: 'Sphere' });
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
    .fitExtent(extent, { type: 'MultiPoint', coordinates: points });
}

export function ContinentView({ onSelect }: { onSelect: (code: string) => void }) {
  const { statuses, listMode, showLabels } = useStore();
  const [continent, setContinent] = useState<Continent>('Europe');
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ w: FALLBACK_W, h: FALLBACK_H });

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setMapSize({
        w: Math.round(el.clientWidth) || FALLBACK_W,
        h: Math.round(el.clientHeight) || FALLBACK_H,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The viewBox matches the container 1:1, so viewBox units are on-screen px.
  const { w: viewW, h: viewH } = mapSize;

  const shapes = useMemo(() => {
    const projection = frameProjection(continent, viewW, viewH);
    const path = geoPath(projection);
    return worldFeatures.map((f) => {
      const key = featureKey(f);
      const code = codeForMapKey(key);
      const country = code ? countryByCode.get(code) : undefined;
      const isTerritory = sovereignByMapId.has(key);
      const active =
        (country?.continent === continent || isTerritory) &&
        !!country &&
        (listMode === 'travel' || country.un);

      // Label sized to the country's on-screen footprint; hidden when it
      // would be smaller than ~9px on screen.
      let label: { x: number; y: number; size: number; text: string } | null = null;
      const anchor = active ? anchorByKey.get(key) : undefined;
      if (anchor) {
        const [[x0, y0], [x1, y1]] = path.bounds(anchor.labelFeature);
        const size = fitLabelSize(anchor.name, x1 - x0, y1 - y0, 9, 19);
        if (size) {
          const [cx, cy] = path.centroid(anchor.labelFeature);
          label = { x: cx, y: cy, size, text: anchor.name };
        }
      }

      return {
        key,
        d: path(f) ?? '',
        code,
        name: isTerritory ? `${f.properties.name} (${country?.name})` : (country?.name ?? f.properties.name),
        // Territories paint and select as their sovereign in every frame.
        inContinent: country?.continent === continent || isTerritory,
        inList: !!country && (listMode === 'travel' || country.un),
        label,
      };
    });
  }, [continent, listMode, viewW, viewH]);

  // Drop labels that stick out of the frame or collide; bigger countries win.
  const visibleLabels = useMemo(() => {
    if (!showLabels) return [];
    const withLabels = shapes.filter((s) => s.label !== null);
    withLabels.sort((a, b) => b.label!.size - a.label!.size);
    const placed: LabelRect[] = [];
    const out: { key: string; x: number; y: number; size: number; text: string }[] = [];
    for (const s of withLabels) {
      const { x, y, size, text } = s.label!;
      const rect = labelRect(x, y, text, size);
      if (rect.x0 < 4 || rect.y0 < 4 || rect.x1 > viewW - 4 || rect.y1 > viewH - 4) continue;
      if (overlapsAny(rect, placed)) continue;
      placed.push(rect);
      out.push({ key: s.key, x, y, size, text });
    }
    return out;
  }, [shapes, showLabels, viewW, viewH]);

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
      <div className="continent-map" ref={mapRef}>
        <svg viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <clipPath id="map-frame">
              <rect x="0" y="0" width={viewW} height={viewH} rx="14" />
            </clipPath>
          </defs>
          <rect x="0" y="0" width={viewW} height={viewH} fill="var(--ocean)" rx="14" />
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
            {visibleLabels.map((l) => (
              <text
                key={`label-${l.key}`}
                x={l.x}
                y={l.y}
                fontSize={l.size}
                strokeWidth={l.size / 5}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {l.text}
              </text>
            ))}
          </g>
        </svg>
      </div>
      <div className="globe-hint" style={{ position: 'static', paddingTop: 6 }}>
        Tap a country to mark it
      </div>
    </div>
  );
}
