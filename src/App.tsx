import { useState } from 'react';
import { useStore } from './state/store';
import { countriesFor } from './data/countries';
import { GlobeView } from './components/GlobeView';
import { ContinentView } from './components/ContinentView';
import { ListView } from './components/ListView';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';
import { CountrySheet } from './components/CountrySheet';

type Tab = 'globe' | 'continents' | 'list' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'globe', label: 'Globe', icon: '🌍' },
  { id: 'continents', label: 'Continents', icon: '🗺️' },
  { id: 'list', label: 'List', icon: '📋' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function App() {
  const { listMode, statuses, theme, resolvedTheme, setTheme } = useStore();
  const [tab, setTab] = useState<Tab>('globe');
  const [selected, setSelected] = useState<string | null>(null);

  const list = countriesFor(listMode);
  const visitedCount = list.filter(
    (c) => statuses[c.code] === 'visited' || statuses[c.code] === 'home',
  ).length;

  const cycleTheme = () => {
    setTheme(theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto');
  };
  const themeIcon = theme === 'auto' ? '🌗' : resolvedTheme === 'dark' ? '🌙' : '☀️';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Countries Visited</h1>
        <span className="header-side">
          <span className="list-badge">
            {visitedCount} / {list.length} · {listMode === 'un' ? 'UN 196' : 'Travel list'}
          </span>
          <button
            className="icon-btn"
            onClick={cycleTheme}
            title={`Theme: ${theme} (click to change)`}
            aria-label={`Theme: ${theme}`}
          >
            {themeIcon}
          </button>
        </span>
      </header>

      {tab === 'globe' && <GlobeView onSelect={setSelected} />}
      {tab === 'continents' && <ContinentView onSelect={setSelected} />}
      {tab === 'list' && <ListView onSelect={setSelected} />}
      {tab === 'stats' && <StatsView />}
      {tab === 'settings' && <SettingsView />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {selected && <CountrySheet code={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
