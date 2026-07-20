import type { ListMode, Status } from '../data/countries';

/**
 * One country in the cloud document: its status (null = tombstone for a
 * deletion) and when it was last changed on any device.
 */
export interface CloudEntry {
  s: Status | null;
  t: number;
}

export type CloudStatuses = Record<string, CloudEntry>;

export interface CloudDoc {
  listMode: ListMode;
  statuses: CloudStatuses;
}

/** Last-write-wins per country: for every code, keep the entry with the newer timestamp. */
export function merge(local: CloudStatuses, remote: CloudStatuses): CloudStatuses {
  const out = { ...remote };
  for (const [code, entry] of Object.entries(local)) {
    if (!out[code] || entry.t > out[code].t) out[code] = entry;
  }
  return out;
}

/** Build the cloud map from the store's statuses + stamps (stamps without a status become tombstones). */
export function toCloud(
  statuses: Record<string, Status>,
  stamps: Record<string, number>,
): CloudStatuses {
  const out: CloudStatuses = {};
  for (const [code, t] of Object.entries(stamps)) {
    out[code] = { s: statuses[code] ?? null, t };
  }
  for (const [code, s] of Object.entries(statuses)) {
    if (!out[code]) out[code] = { s, t: 0 };
  }
  return out;
}

/** Split a cloud map back into the store's shape. Tombstones keep their stamp but no status. */
export function fromCloud(cloud: CloudStatuses): {
  statuses: Record<string, Status>;
  stamps: Record<string, number>;
} {
  const statuses: Record<string, Status> = {};
  const stamps: Record<string, number> = {};
  for (const [code, entry] of Object.entries(cloud)) {
    stamps[code] = entry.t;
    if (entry.s) statuses[code] = entry.s;
  }
  return { statuses, stamps };
}

/** JSON with sorted keys, so equal maps compare equal regardless of insertion order. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const rec = v as Record<string, unknown>;
      return Object.fromEntries(Object.keys(rec).sort().map((k) => [k, rec[k]]));
    }
    return v;
  });
}
