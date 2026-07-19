import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ListMode, Status } from '../data/countries';

const STORAGE_KEY = 'countries-visited:v1';

export type ThemePref = 'auto' | 'light' | 'dark';

export interface PersistedState {
  listMode: ListMode;
  statuses: Record<string, Status>;
  theme: ThemePref;
  showLabels: boolean;
}

interface Store extends PersistedState {
  resolvedTheme: 'light' | 'dark';
  setStatus: (code: string, status: Status | null) => void;
  setListMode: (mode: ListMode) => void;
  setTheme: (theme: ThemePref) => void;
  setShowLabels: (show: boolean) => void;
  replaceState: (state: Pick<PersistedState, 'listMode' | 'statuses'>) => void;
}

const DEFAULT_STATE: PersistedState = {
  listMode: 'un',
  statuses: {},
  theme: 'auto',
  showLabels: true,
};

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      listMode: parsed.listMode === 'travel' ? 'travel' : 'un',
      statuses: typeof parsed.statuses === 'object' && parsed.statuses ? parsed.statuses : {},
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'auto',
      showLabels: parsed.showLabels !== false,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState);
  const [osDark, setOsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  const resolvedTheme: 'light' | 'dark' =
    state.theme === 'auto' ? (osDark ? 'dark' : 'light') : state.theme;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedTheme === 'dark' ? '#0b1220' : '#eef3f9');
  }, [resolvedTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — keep working in memory.
    }
  }, [state]);

  const setStatus = useCallback((code: string, status: Status | null) => {
    setState((prev) => {
      const statuses = { ...prev.statuses };
      if (status === null) {
        delete statuses[code];
      } else {
        statuses[code] = status;
      }
      return { ...prev, statuses };
    });
  }, []);

  const setListMode = useCallback((listMode: ListMode) => {
    setState((prev) => ({ ...prev, listMode }));
  }, []);

  const setTheme = useCallback((theme: ThemePref) => {
    setState((prev) => ({ ...prev, theme }));
  }, []);

  const setShowLabels = useCallback((showLabels: boolean) => {
    setState((prev) => ({ ...prev, showLabels }));
  }, []);

  const replaceState = useCallback((next: Pick<PersistedState, 'listMode' | 'statuses'>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      ...state,
      resolvedTheme,
      setStatus,
      setListMode,
      setTheme,
      setShowLabels,
      replaceState,
    }),
    [state, resolvedTheme, setStatus, setListMode, setTheme, setShowLabels, replaceState],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
