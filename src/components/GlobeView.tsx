import { useEffect, useRef } from 'react';
import {
  geoOrthographic,
  geoPath,
  geoContains,
  geoGraticule10,
  geoDistance,
  type GeoProjection,
} from 'd3-geo';
import { useStore } from '../state/store';
import { codeForMapKey, countryByCode, type ListMode, type Status } from '../data/countries';
import { worldFeatures, featureKey } from '../data/geo';
import { fillForStatus, readMapColors } from './mapColors';
import { labelAnchors, fitLabelSize, labelRect, overlapsAny, type LabelRect } from './mapLabels';
import { Legend } from './Legend';

const MIN_ZOOM = 0.8;
// Deep zoom so microstates (Vatican, San Marino, Liechtenstein…) can be tapped.
const MAX_ZOOM = 200;

export function GlobeView({ onSelect }: { onSelect: (code: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef({
    statuses: {} as Record<string, Status>,
    listMode: 'un' as ListMode,
    showLabels: true,
  });
  const { statuses, listMode, resolvedTheme, showLabels } = useStore();
  storeRef.current = { statuses, listMode, showLabels };

  const viewRef = useRef({ rotation: [0, -15] as [number, number], zoom: 1 });

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let width = 0;
    let height = 0;

    const projection: GeoProjection = geoOrthographic().clipAngle(90);
    const graticule = geoGraticule10();

    // withLabels=false during drag frames — label fitting doubles the per-frame
    // cost, so labels reappear when the interaction settles.
    function render(withLabels = true) {
      const dpr = window.devicePixelRatio || 1;
      const { rotation, zoom } = viewRef.current;
      const { statuses, listMode, showLabels } = storeRef.current;
      const colors = readMapColors();
      projection
        .translate([width / 2, height / 2])
        .scale((Math.min(width, height) / 2 - 10) * zoom)
        .rotate(rotation)
        .clipExtent([
          [0, 0],
          [width, height],
        ]);
      const path = geoPath(projection, ctx);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.fillStyle = colors.ocean;
      ctx.fill();

      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = colors.graticule;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      for (const f of worldFeatures) {
        const code = codeForMapKey(featureKey(f));
        const country = code ? countryByCode.get(code) : undefined;
        const inList = !!country && (listMode === 'travel' || country.un);
        const status = code ? statuses[code] : undefined;
        ctx.beginPath();
        path(f);
        ctx.fillStyle = fillForStatus(status, inList, colors);
        ctx.fill();
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      if (withLabels && showLabels) {
        const center: [number, number] = [-rotation[0], -rotation[1]];
        const radius = (Math.min(width, height) / 2 - 10) * zoom;
        const candidates: { name: string; size: number; x: number; y: number }[] = [];
        for (const a of labelAnchors) {
          const country = countryByCode.get(a.code);
          if (!country || (listMode !== 'travel' && !country.un)) continue;
          // Skip labels on the far side or hugging the limb of the globe.
          if (geoDistance(a.centroid, center) > 1.35) continue;
          const [[x0, y0], [x1, y1]] = path.bounds(a.labelFeature);
          const size = fitLabelSize(a.name, x1 - x0, y1 - y0, 9, 18);
          if (!size) continue;
          const pos = projection(a.centroid);
          if (!pos) continue;
          // The whole label must stay inside the globe disc.
          const halfWidth = (a.name.length * size * 0.6) / 2;
          if (Math.hypot(pos[0] - width / 2, pos[1] - height / 2) + halfWidth > radius - 4) {
            continue;
          }
          candidates.push({ name: a.name, size, x: pos[0], y: pos[1] });
        }
        // Bigger countries win when labels would collide.
        candidates.sort((p, q) => q.size - p.size);
        const placed: LabelRect[] = [];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        for (const c of candidates) {
          const rect = labelRect(c.x, c.y, c.name, c.size);
          if (overlapsAny(rect, placed)) continue;
          placed.push(rect);
          ctx.font = `600 ${c.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          ctx.strokeStyle = colors.labelHalo;
          ctx.lineWidth = c.size / 5;
          ctx.strokeText(c.name, c.x, c.y);
          ctx.fillStyle = colors.label;
          ctx.fillText(c.name, c.x, c.y);
        }
      }

      ctx.beginPath();
      path({ type: 'Sphere' });
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      render();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    // --- pointer interaction: drag to rotate, pinch to zoom, tap to select ---
    const pointers = new Map<number, [number, number]>();
    let moved = 0;
    let pinchDist = 0;

    function localPos(e: PointerEvent): [number, number] {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    function onPointerDown(e: PointerEvent) {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, localPos(e));
      moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) return;
      const pos = localPos(e);
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, pos);

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinchDist > 0) {
          viewRef.current.zoom = clampZoom(viewRef.current.zoom * (dist / pinchDist));
        }
        pinchDist = dist;
        moved += 10;
        render(false);
        return;
      }

      const dx = pos[0] - prev[0];
      const dy = pos[1] - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      const speed = 0.25 / viewRef.current.zoom;
      const [lambda, phi] = viewRef.current.rotation;
      viewRef.current.rotation = [
        lambda + dx * speed,
        Math.max(-90, Math.min(90, phi - dy * speed)),
      ];
      render(false);
    }

    function onPointerUp(e: PointerEvent) {
      const pos = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      pinchDist = 0;
      if (pos && moved < 5) {
        handleTap(pos);
      } else if (pointers.size === 0) {
        render(); // drag/pinch ended — bring the labels back
      }
    }

    function handleTap([x, y]: [number, number]) {
      const coords = projection.invert?.([x, y]);
      if (!coords || Number.isNaN(coords[0])) return;
      // Reject taps outside the visible hemisphere/sphere.
      const center = projection.rotate();
      if (geoDistance(coords, [-center[0], -center[1]]) > Math.PI / 2) return;
      const { listMode } = storeRef.current;
      const inList = (code: string | undefined) => {
        const country = code ? countryByCode.get(code) : undefined;
        return country && (listMode === 'travel' || country.un) ? country : undefined;
      };
      const scale = projection.scale(); // px per radian

      // Countries whose footprint is smaller than a fingertip get snap priority —
      // otherwise Italy would always swallow a tap aimed at Vatican City.
      let snap: { code: string; d: number } | null = null;
      for (const a of labelAnchors) {
        if (!inList(a.code)) continue;
        const projRadius = Math.sqrt(a.areaSr / Math.PI) * scale;
        if (projRadius > 14) continue;
        const d = geoDistance(coords, a.centroid) * scale;
        const tolerance = Math.max(20, projRadius + 10); // fingertip-sized target
        if (d < tolerance && (!snap || d < snap.d)) snap = { code: a.code, d };
      }
      if (snap) {
        onSelect(snap.code);
        return;
      }

      for (const f of worldFeatures) {
        if (!geoContains(f, coords)) continue;
        const code = codeForMapKey(featureKey(f));
        if (inList(code)) onSelect(code!);
        return;
      }

      // Ocean tap near a coastline — take the nearest country within ~12px.
      let best: { code: string; d: number } | null = null;
      for (const a of labelAnchors) {
        if (!inList(a.code)) continue;
        const d = geoDistance(coords, a.centroid) * scale;
        if (d < (best?.d ?? 16)) best = { code: a.code, d };
      }
      if (best) onSelect(best.code);
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      viewRef.current.zoom = clampZoom(viewRef.current.zoom * Math.exp(-e.deltaY * 0.001));
      render();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const api = { render };
    (canvas as unknown as { __api?: typeof api }).__api = api;

    // Debug/e2e hook: jump the view to a rotation + zoom.
    (window as unknown as { __globeView?: object }).__globeView = {
      set(lambda: number, phi: number, zoom: number) {
        viewRef.current.rotation = [lambda, phi];
        viewRef.current.zoom = clampZoom(zoom);
        render();
      },
    };

    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [onSelect]);

  // Re-render the canvas when statuses, list mode or theme change.
  useEffect(() => {
    const canvas = canvasRef.current as unknown as { __api?: { render: () => void } } | null;
    canvas?.__api?.render();
  }, [statuses, listMode, resolvedTheme, showLabels]);

  const zoomBy = (factor: number) => {
    viewRef.current.zoom = clampZoom(viewRef.current.zoom * factor);
    const canvas = canvasRef.current as unknown as { __api?: { render: () => void } } | null;
    canvas?.__api?.render();
  };

  return (
    <div className="view no-scroll">
      <Legend />
      <div className="globe-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />
        <div className="zoom-controls">
          <button onClick={() => zoomBy(1.6)} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">
            −
          </button>
        </div>
        <div className="globe-hint">Drag to rotate · tap a country to mark it</div>
      </div>
    </div>
  );
}

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}
