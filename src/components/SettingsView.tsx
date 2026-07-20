import { useRef, type ReactNode } from 'react';
import { useStore, type PersistedState, type ThemePref } from '../state/store';
import { useSync } from '../sync/SyncProvider';
import { COUNTRIES, type ListMode, type Status } from '../data/countries';
import changelog from '../../CHANGELOG.md?raw';

const LIST_OPTIONS: { mode: ListMode; title: string; desc: string }[] = [
  {
    mode: 'un',
    title: 'UN list — 196 countries',
    desc: '193 UN members plus Vatican City, Palestine and Taiwan.',
  },
  {
    mode: 'travel',
    title: 'Travel list — 204 countries',
    desc: 'The UN list plus places that are separate countries from a traveller’s perspective: Kosovo, Transnistria, Somaliland, Northern Cyprus, Abkhazia, South Ossetia, Western Sahara and Antarctica.',
  },
];

const THEME_OPTIONS: { theme: ThemePref; title: string; desc: string }[] = [
  { theme: 'auto', title: '🌗 Automatic', desc: 'Follow your device’s light or dark setting.' },
  { theme: 'light', title: '☀️ Light', desc: 'Bright map on a light background.' },
  { theme: 'dark', title: '🌙 Dark', desc: 'Night mode, easy on the eyes.' },
];

export function SettingsView() {
  const store = useStore();
  const sync = useSync();
  const fileRef = useRef<HTMLInputElement>(null);

  const signIn = () => {
    sync.login().catch(() => {
      alert('Sign-in failed. Check your connection and try again.');
    });
  };

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ listMode: store.listMode, statuses: store.statuses }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'countries-visited-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<PersistedState>;
      const valid = new Set(COUNTRIES.map((c) => c.code));
      const statuses: Record<string, Status> = {};
      for (const [code, status] of Object.entries(parsed.statuses ?? {})) {
        if (valid.has(code) && ['visited', 'home', 'soon'].includes(status)) {
          statuses[code] = status;
        }
      }
      store.replaceState({
        listMode: parsed.listMode === 'travel' ? 'travel' : 'un',
        statuses,
      });
      alert(`Imported ${Object.keys(statuses).length} marked countries.`);
    } catch {
      alert('That file is not a valid backup.');
    }
  };

  const reset = () => {
    if (confirm('Remove all your marked countries? This cannot be undone.')) {
      store.replaceState({ listMode: store.listMode, statuses: {} });
    }
  };

  return (
    <div className="view settings">
      <h2>Country list</h2>
      <div className="option-grid">
        {LIST_OPTIONS.map((o) => (
          <button
            key={o.mode}
            className={`option-card ${store.listMode === o.mode ? 'selected' : ''}`}
            onClick={() => store.setListMode(o.mode)}
          >
            <input
              className="radio"
              type="radio"
              checked={store.listMode === o.mode}
              readOnly
              tabIndex={-1}
            />
            <span>
              <span className="title">{o.title}</span>
              <div className="desc">{o.desc}</div>
            </span>
          </button>
        ))}
      </div>

      <h2>Appearance</h2>
      <div className="option-grid">
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.theme}
            className={`option-card ${store.theme === o.theme ? 'selected' : ''}`}
            onClick={() => store.setTheme(o.theme)}
          >
            <input
              className="radio"
              type="radio"
              checked={store.theme === o.theme}
              readOnly
              tabIndex={-1}
            />
            <span>
              <span className="title">{o.title}</span>
              <div className="desc">{o.desc}</div>
            </span>
          </button>
        ))}
      </div>

      <h2>Map</h2>
      <button
        className={`option-card ${store.showLabels ? 'selected' : ''}`}
        onClick={() => store.setShowLabels(!store.showLabels)}
      >
        <input
          className="radio"
          type="checkbox"
          checked={store.showLabels}
          readOnly
          tabIndex={-1}
        />
        <span>
          <span className="title">Country names on maps</span>
          <div className="desc">
            Show each country’s name on the globe and continent maps, sized to fit. Names too
            small to read stay hidden.
          </div>
        </span>
      </button>

      <h2>Account &amp; sync</h2>
      {sync.user ? (
        <>
          <p className="home-line account-row">
            {sync.user.photoURL && (
              <img className="avatar" src={sync.user.photoURL} alt="" referrerPolicy="no-referrer" />
            )}
            Signed in as <strong>{sync.user.displayName ?? sync.user.email}</strong>. Your
            countries are backed up and sync across devices, even after offline changes.
          </p>
          {sync.syncError && (
            <p className="home-line sync-error">
              ⚠️ Sync isn&apos;t working right now ({sync.syncError}). Your countries stay saved
              on this device, but backup and cross-device sync are paused until this clears.
            </p>
          )}
          <button className="btn" onClick={() => sync.logout()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="home-line">
            Optional: sign in to back up your countries and sync them across devices. The app
            keeps working fully offline either way.
          </p>
          <button className="btn" onClick={signIn}>
            🔐 Sign in with Google
          </button>
        </>
      )}

      <h2>Your data</h2>
      <p className="home-line">
        Everything is stored on this device and works fully offline. Export a backup before
        switching phones.
      </p>
      <button className="btn" onClick={exportData}>
        ⬇️ Export backup
      </button>
      <button className="btn" onClick={() => fileRef.current?.click()}>
        ⬆️ Import backup
      </button>
      <button className="btn danger" onClick={reset}>
        🗑️ Reset all
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importData(file);
          e.target.value = '';
        }}
      />

      <h2>What&apos;s new</h2>
      <div className="changelog">{renderChangelog(changelog)}</div>
    </div>
  );
}

/** Minimal renderer for the Keep a Changelog format — headings and bullet lists only. */
function renderChangelog(md: string): ReactNode[] {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={key++}>
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const line of md.split('\n')) {
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
    } else if (line.startsWith('### ')) {
      flush();
      out.push(<h3 key={key++}>{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      flush();
      out.push(<h3 key={key++}>{line.slice(3).replace(/[[\]]/g, '')}</h3>);
    }
  }
  flush();
  return out;
}
