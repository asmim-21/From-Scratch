import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/*
 * Which ingredients are ticked off. Kept here, not on the page, so the book and
 * cook mode agree and ticks survive turning the page. Reset on reload.
 */
interface Ticks {
  isTicked: (id: string) => boolean;
  toggle: (id: string) => void;
}

const TicksContext = createContext<Ticks>({ isTicked: () => false, toggle: () => {} });

export function TicksProvider({ children }: { children: ReactNode }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ isTicked: (id: string) => ticked.has(id), toggle }), [ticked, toggle]);
  return <TicksContext.Provider value={value}>{children}</TicksContext.Provider>;
}

export const useTicks = () => useContext(TicksContext);
