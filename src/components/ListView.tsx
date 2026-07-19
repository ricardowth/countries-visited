import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import {
  CONTINENTS,
  countriesFor,
  STATUS_LABEL,
  type Country,
} from '../data/countries';
import { Legend } from './Legend';

export function ListView({ onSelect }: { onSelect: (code: string) => void }) {
  const { listMode, statuses } = useStore();
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const list = countriesFor(listMode);
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
    const groups = new Map<string, Country[]>();
    for (const continent of CONTINENTS) {
      const items = filtered.filter((c) => c.continent === continent);
      if (items.length) groups.set(continent, items);
    }
    return groups;
  }, [listMode, query]);

  return (
    <div className="view">
      <Legend />
      <input
        className="search"
        type="search"
        placeholder="Search countries…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {[...grouped.entries()].map(([continent, items]) => {
        const done = items.filter(
          (c) => statuses[c.code] === 'visited' || statuses[c.code] === 'home',
        ).length;
        return (
          <section key={continent}>
            <div className="continent-header">
              <span>{continent}</span>
              <span>
                {done} / {items.length}
              </span>
            </div>
            {items.map((c) => {
              const status = statuses[c.code];
              return (
                <button key={c.code} className="country-row" onClick={() => onSelect(c.code)}>
                  <span className="flag">{c.flag}</span>
                  <span className="name">{c.name}</span>
                  {status && (
                    <span className={`status-pill ${status}`}>{STATUS_LABEL[status]}</span>
                  )}
                </button>
              );
            })}
          </section>
        );
      })}
      {grouped.size === 0 && <p style={{ color: 'var(--muted)' }}>No countries match.</p>}
    </div>
  );
}
