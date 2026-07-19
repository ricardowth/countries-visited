import { useMemo } from 'react';
import { useStore } from '../state/store';
import { CONTINENTS, countriesFor } from '../data/countries';

export function StatsView() {
  const { listMode, statuses } = useStore();

  const stats = useMemo(() => {
    const list = countriesFor(listMode);
    const been = (code: string) => statuses[code] === 'visited' || statuses[code] === 'home';
    const visited = list.filter((c) => been(c.code));
    const soon = list.filter((c) => statuses[c.code] === 'soon');
    const home = list.filter((c) => statuses[c.code] === 'home');
    const perContinent = CONTINENTS.map((continent) => {
      const items = list.filter((c) => c.continent === continent);
      const done = items.filter((c) => been(c.code)).length;
      return { continent, done, total: items.length };
    }).filter((c) => c.total > 0);
    return { total: list.length, visited, soon, home, perContinent };
  }, [listMode, statuses]);

  const pct = stats.total ? Math.round((stats.visited.length / stats.total) * 100) : 0;

  return (
    <div className="view">
      <div className="stat-cards">
        <div className="stat-card">
          <div className="big">{stats.visited.length}</div>
          <div className="label">countries visited</div>
        </div>
        <div className="stat-card">
          <div className="big">{pct}%</div>
          <div className="label">of the world ({listMode === 'un' ? 'UN 196' : 'travel list'})</div>
        </div>
        <div className="stat-card">
          <div className="big">{stats.soon.length}</div>
          <div className="label">going soon</div>
        </div>
      </div>

      {stats.home.length > 0 && (
        <p className="home-line">
          🏠 Home: {stats.home.map((c) => `${c.flag} ${c.name}`).join(', ')}
        </p>
      )}

      <div className="progress-list">
        {stats.perContinent.map(({ continent, done, total }) => {
          const p = total ? Math.round((done / total) * 100) : 0;
          return (
            <div className="progress-row" key={continent}>
              <div className="row-head">
                <span>{continent}</span>
                <span className="pct">
                  {done} / {total} · {p}%
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={done}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={`${continent}: ${done} of ${total} countries visited`}
              >
                <div className="progress-fill" style={{ width: `${p}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
