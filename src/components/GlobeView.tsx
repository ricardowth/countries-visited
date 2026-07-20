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
import {
  worldFeatures,
  featureKey,
  renderFeaturesHigh,
  renderFeaturesLow,
  type RenderFeature,
} from '../data/geo';
import { fillForStatus, readMapColors } from './mapColors';
import { labelAnchors, fitLabelSize, labelRect, overlapsAny, type LabelRect } from './mapLabels';
import { Legend } from './Legend';

const MIN_ZOOM = 0.8;
// Deep zoom so microstates (Vatican, San Marino, Liechtenstein…) can be tapped.
const MAX_ZOOM = 200;
// Below these zooms the coarse 110m geometry is visually indistinguishable and far
// cheaper; above them, culling prunes so much that full detail is affordable.
// Settle frames switch to full detail earlier than gesture frames do.
const FULL_DETAIL_ZOOM = 4;
const INTERACTIVE_DETAIL_ZOOM = 8;
const SETTLE_MS = 150;

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
    let backing = 0;

    const projection: GeoProjection = geoOrthographic().clipAngle(90);
    const graticule = geoGraticule10();

    function ensureBacking(scale: number) {
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      backing = scale;
    }

    // 'interactive' = per-gesture frame: coarse geometry (unless deep-zoomed),
    // reduced backing resolution, no labels. 'full' = crisp settled frame.
    function draw(mode: 'interactive' | 'full') {
      const dpr = window.devicePixelRatio || 1;
      const full = mode === 'full';
      const { rotation, zoom } = viewRef.current;
      const { statuses, listMode, showLabels } = storeRef.current;
      const colors = readMapColors();
      const detailed = zoom > (full ? FULL_DETAIL_ZOOM : INTERACTIVE_DETAIL_ZOOM);
      const feats: RenderFeature[] = detailed ? renderFeaturesHigh : renderFeaturesLow;

      ensureBacking(full ? dpr : Math.min(dpr, 1.5));
      projection
        .translate([width / 2, height / 2])
        .scale((Math.min(width, height) / 2 - 10) * zoom)
        .rotate(rotation)
        .precision(full ? 0.7 : 1.5)
        .clipExtent([
          [0, 0],
          [width, height],
        ]);
      const path = geoPath(projection, ctx);
      const center: [number, number] = [-rotation[0], -rotation[1]];
      const scalePx = projection.scale();
      // Angular radius of the visible window: nothing beyond it can appear on screen.
      const halfDiag = Math.hypot(width, height) / 2;
      const thetaLimit =
        Math.min(Math.PI / 2, Math.asin(Math.min(1, halfDiag / scalePx))) + 0.05;

      ctx.setTransform(backing, 0, 0, backing, 0, 0);
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

      // Cull invisible features, bucket the rest by fill color, then draw each
      // bucket as one path — far fewer canvas operations than per-feature fills.
      const visible: RenderFeature[] = [];
      const buckets = new Map<string, RenderFeature[]>();
      for (const rf of feats) {
        if (geoDistance(rf.centroid, center) - rf.angRadius > thetaLimit) continue;
        visible.push(rf);
        const code = codeForMapKey(rf.key);
        const country = code ? countryByCode.get(code) : undefined;
        const inList = !!country && (listMode === 'travel' || country.un);
        const fill = fillForStatus(code ? statuses[code] : undefined, inList, colors);
        const bucket = buckets.get(fill);
        if (bucket) {
          bucket.push(rf);
        } else {
          buckets.set(fill, [rf]);
        }
      }
      for (const [fill, bucket] of buckets) {
        ctx.beginPath();
        for (const rf of bucket) path(rf.f);
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.beginPath();
      for (const rf of visible) path(rf.f);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      if (full && showLabels) {
        const radius = (Math.min(width, height) / 2 - 10) * zoom;
        const candidates: { name: string; size: number; x: number; y: number }[] = [];
        for (const a of labelAnchors) {
          const country = countryByCode.get(a.code);
          if (!country || (listMode !== 'travel' && !country.un)) continue;
          // Skip labels on the far side or hugging the limb of the globe.
          if (geoDistance(a.centroid, center) > Math.min(1.35, thetaLimit)) continue;
          // Too small to ever fit a readable name — skip before the costly bounds.
          if (a.estDiamRad * scalePx < 12) continue;
          const [[x0, y0], [x1, y1]] = path.bounds(a.boundsFeature);
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

    // --- frame scheduling: at most one draw per animation frame ---
    let rafId = 0;
    let pendingFull = false;
    let settleTimer = 0;
    let inertiaId = 0;

    function requestDraw(mode: 'interactive' | 'full') {
      if (mode === 'full') pendingFull = true;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const m = pendingFull ? 'full' : 'interactive';
        pendingFull = false;
        draw(m);
      });
    }

    // During a gesture draw cheap frames; a crisp full frame follows once idle.
    function interactionFrame() {
      requestDraw('interactive');
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => requestDraw('full'), SETTLE_MS);
    }

    function cancelInertia() {
      if (inertiaId) {
        cancelAnimationFrame(inertiaId);
        inertiaId = 0;
      }
    }

    function startInertia(vx: number, vy: number) {
      cancelInertia();
      clearTimeout(settleTimer);
      let last = performance.now();
      const step = (t: number) => {
        const dt = Math.min(48, t - last);
        last = t;
        const speed = 0.25 / viewRef.current.zoom;
        const [lambda, phi] = viewRef.current.rotation;
        viewRef.current.rotation = [
          lambda + vx * dt * speed,
          Math.max(-90, Math.min(90, phi - vy * dt * speed)),
        ];
        const decay = Math.exp(-dt / 300);
        vx *= decay;
        vy *= decay;
        draw('interactive');
        if (Math.hypot(vx, vy) < 0.02) {
          inertiaId = 0;
          requestDraw('full');
          return;
        }
        inertiaId = requestAnimationFrame(step);
      };
      inertiaId = requestAnimationFrame(step);
    }

    function resize() {
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      requestDraw('full');
    }

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    // --- pointer interaction: drag to rotate, pinch to zoom, tap to select ---
    const pointers = new Map<number, [number, number]>();
    let moved = 0;
    let pinchDist = 0;
    let velX = 0;
    let velY = 0;
    let lastMoveT = 0;
    // A finger wobbles more than a mouse even for a stationary tap, and
    // pointermove fires often enough that this accumulates fast — too tight
    // a threshold here makes real taps register as drags and get swallowed.
    let tapThreshold = 5;

    function localPos(e: PointerEvent): [number, number] {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    function onPointerDown(e: PointerEvent) {
      cancelInertia();
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, localPos(e));
      moved = 0;
      tapThreshold = e.pointerType === 'touch' ? 16 : 5;
      velX = 0;
      velY = 0;
      lastMoveT = e.timeStamp;
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
        interactionFrame();
        return;
      }

      const dx = pos[0] - prev[0];
      const dy = pos[1] - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      const dt = Math.max(1, e.timeStamp - lastMoveT);
      lastMoveT = e.timeStamp;
      velX = 0.7 * velX + (0.3 * dx) / dt;
      velY = 0.7 * velY + (0.3 * dy) / dt;
      const speed = 0.25 / viewRef.current.zoom;
      const [lambda, phi] = viewRef.current.rotation;
      viewRef.current.rotation = [
        lambda + dx * speed,
        Math.max(-90, Math.min(90, phi - dy * speed)),
      ];
      interactionFrame();
    }

    function onPointerUp(e: PointerEvent) {
      const pos = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      pinchDist = 0;
      if (pos && moved < tapThreshold) {
        handleTap(pos);
      } else if (pointers.size === 0) {
        // Fling if the pointer was still moving when released.
        const stale = e.timeStamp - lastMoveT > 80;
        if (!stale && Math.hypot(velX, velY) > 0.08) {
          startInertia(velX, velY);
        } else {
          requestDraw('full');
        }
      }
    }

    function handleTap([x, y]: [number, number]) {
      const coords = projection.invert?.([x, y]);
      if (!coords || Number.isNaN(coords[0])) return;
      // Reject taps outside the visible hemisphere/sphere.
      const rotation = projection.rotate();
      if (geoDistance(coords, [-rotation[0], -rotation[1]]) > Math.PI / 2) return;
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

      // Ocean tap near a coastline — take the nearest country within ~16px.
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
      interactionFrame();
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const api = { render: () => requestDraw('full') };
    (canvas as unknown as { __api?: typeof api }).__api = api;

    // Debug/e2e hook: jump the view to a rotation + zoom.
    (window as unknown as { __globeView?: object }).__globeView = {
      set(lambda: number, phi: number, zoom: number) {
        cancelInertia();
        viewRef.current.rotation = [lambda, phi];
        viewRef.current.zoom = clampZoom(zoom);
        draw('full');
      },
    };

    return () => {
      observer.disconnect();
      cancelInertia();
      clearTimeout(settleTimer);
      if (rafId) cancelAnimationFrame(rafId);
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
