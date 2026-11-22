import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { MAX_SERVINGS, type Scale } from './scale';

/*
 * How many people each recipe is being made for. Shared by the book and cook
 * mode, and reset on reload, like the ticks.
 */
interface Servings {
  chosen: ReadonlyMap<string, number>;
  choose: (slug: string, count: number) => void;
}

const ServingsContext = createContext<Servings>({ chosen: new Map(), choose: () => {} });

export function ServingsProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<ReadonlyMap<string, number>>(new Map());
  const choose = useCallback((slug: string, count: number) => {
    setChosen((prev) => new Map(prev).set(slug, Math.max(1, Math.min(MAX_SERVINGS, count))));
  }, []);
  const value = useMemo(() => ({ chosen, choose }), [chosen, choose]);
  return <ServingsContext.Provider value={value}>{children}</ServingsContext.Provider>;
}

/** How much to make of a recipe, and by how much to multiply its amounts. */
export function useServings(scale: Scale | undefined) {
  const { chosen, choose } = useContext(ServingsContext);
  const base = scale?.serves ?? 1;
  const count = (scale && chosen.get(scale.slug)) ?? base;
  return {
    count,
    factor: count / base,
    setCount: (n: number) => scale && choose(scale.slug, n),
  };
}
