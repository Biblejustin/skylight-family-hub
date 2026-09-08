'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

interface PageBackgroundContextValue {
  /** The winning module-requested background override */
  overrideBackground: string | null;
  /** Register a background request. First non-null registration wins. */
  register: (moduleId: string, url: string | null) => void;
  /** Unregister a module's background request. */
  unregister: (moduleId: string) => void;
}

const PageBackgroundContext = createContext<PageBackgroundContextValue>({
  overrideBackground: null,
  register: () => {},
  unregister: () => {},
});

export function PageBackgroundProvider({ children }: { children: ReactNode }) {
  const [overrideBackground, setOverride] = useState<string | null>(null);
  // Map of moduleId → requested background URL
  const requestsRef = useRef(new Map<string, string | null>());

  const resolve = useCallback(() => {
    // First non-null entry wins (insertion order = render order)
    let winner: string | null = null;
    for (const url of requestsRef.current.values()) {
      if (url) { winner = url; break; }
    }
    setOverride((prev) => (prev === winner ? prev : winner));
  }, []);

  const register = useCallback((moduleId: string, url: string | null) => {
    requestsRef.current.set(moduleId, url);
    resolve();
  }, [resolve]);

  const unregister = useCallback((moduleId: string) => {
    requestsRef.current.delete(moduleId);
    resolve();
  }, [resolve]);

  return (
    <PageBackgroundContext.Provider value={{ overrideBackground, register, unregister }}>
      {children}
    </PageBackgroundContext.Provider>
  );
}

export function usePageBackground() {
  return useContext(PageBackgroundContext);
}
