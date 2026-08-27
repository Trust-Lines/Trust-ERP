'use client';

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { ComponentType } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
export interface AppTab {
  id: string;         // unique stable id (same as moduleKey for singletons)
  key: string;        // module key e.g. 'projects'
  label: string;
  href: string;       // iframe src
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  color: string;      // icon tint
  iconBg: string;
  pinned?: boolean;   // pinned tabs cannot be closed (Home)
}

interface TabState {
  tabs: AppTab[];
  activeTabId: string;
}

type TabAction =
  | { type: 'OPEN_TAB'; tab: AppTab }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'ACTIVATE_TAB'; id: string };

const HOME_TAB_ID = '__home__';

function reducer(state: TabState, action: TabAction): TabState {
  switch (action.type) {
    case 'OPEN_TAB': {
      const existing = state.tabs.find(t => t.id === action.tab.id);
      if (existing) {
        // Tab already open — just focus it
        return { ...state, activeTabId: existing.id };
      }
      return {
        tabs: [...state.tabs, action.tab],
        activeTabId: action.tab.id,
      };
    }
    case 'CLOSE_TAB': {
      const idx = state.tabs.findIndex(t => t.id === action.id);
      if (idx === -1) return state;
      const tab = state.tabs[idx];
      if (tab.pinned) return state; // cannot close pinned tabs
      const newTabs = state.tabs.filter(t => t.id !== action.id);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.id) {
        // Activate the tab to the left, or right if none
        const prev = newTabs[idx - 1] ?? newTabs[idx] ?? newTabs[0];
        newActiveId = prev?.id ?? HOME_TAB_ID;
      }
      return { tabs: newTabs, activeTabId: newActiveId };
    }
    case 'ACTIVATE_TAB': {
      return { ...state, activeTabId: action.id };
    }
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────
interface TabContextValue {
  tabs: AppTab[];
  activeTabId: string;
  openTab: (tab: Omit<AppTab, 'id'> & { id?: string }) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

const SESSION_KEY = 'tl_open_tabs_v2';

function loadSession(): Partial<TabState> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<TabState>;
  } catch {
    return {};
  }
}

// ── Provider ───────────────────────────────────────────────────────────────
export function TabProvider({
  children,
  homeTab,
}: {
  children: ReactNode;
  homeTab: Omit<AppTab, 'id' | 'pinned'>;
}) {
  const HOME: AppTab = { ...homeTab, id: HOME_TAB_ID, pinned: true };

  // We can't restore icons from JSON (functions aren't serialisable), so we
  // only restore the active tab id from session; open tabs always start fresh.
  const initial: TabState = (() => {
    if (typeof window === 'undefined') {
      return { tabs: [HOME], activeTabId: HOME_TAB_ID };
    }
    const session = loadSession();
    return {
      tabs: [HOME],
      activeTabId: session.activeTabId === HOME_TAB_ID ? HOME_TAB_ID : HOME_TAB_ID,
    };
  })();

  const [state, dispatch] = useReducer(reducer, initial);

  // Persist active tab id to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ activeTabId: state.activeTabId }));
    } catch { }
  }, [state.activeTabId]);

  const openTab = useCallback(
    (tab: Omit<AppTab, 'id'> & { id?: string }) => {
      const id = tab.id ?? tab.key;
      dispatch({ type: 'OPEN_TAB', tab: { ...tab, id } as AppTab });
    },
    [],
  );

  const closeTab = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_TAB', id });
  }, []);

  const activateTab = useCallback((id: string) => {
    dispatch({ type: 'ACTIVATE_TAB', id });
  }, []);

  return (
    <TabContext.Provider value={{ tabs: state.tabs, activeTabId: state.activeTabId, openTab, closeTab, activateTab }}>
      {children}
    </TabContext.Provider>
  );
}

// ── Safe Fallback Context ──────────────────────────────────────────────────
const DEFAULT_TAB_CONTEXT: TabContextValue = {
  tabs: [],
  activeTabId: HOME_TAB_ID,
  openTab: (tab) => {
    if (typeof window !== 'undefined' && tab?.href) {
      window.location.href = tab.href;
    }
  },
  closeTab: () => {},
  activateTab: (id) => {
    if (typeof window !== 'undefined' && id === HOME_TAB_ID) {
      window.location.href = '/home';
    }
  },
};

// ── Hook ───────────────────────────────────────────────────────────────────
export function useTabs(): TabContextValue {
  const ctx = useContext(TabContext);
  return ctx ?? DEFAULT_TAB_CONTEXT;
}

export { HOME_TAB_ID };
