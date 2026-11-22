import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { recipeRoute, recipes } from '../lib/content';
import { findRecipes, isFiltering, NO_FILTERS, type Filters } from './search';

interface Finder {
  filters: Filters;
  set: (change: Partial<Filters>) => void;
  clear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  filtering: boolean;
  results: ReturnType<typeof findRecipes>;
  surprise: () => void;
}

const FinderContext = createContext<Finder | null>(null);

export function FinderProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const set = useCallback((change: Partial<Filters>) => setFilters((f) => ({ ...f, ...change })), []);
  const clear = useCallback(() => setFilters(NO_FILTERS), []);

  const surprise = useCallback(() => {
    const others = recipes.filter((r) => recipeRoute(r.slug) !== pathname);
    const pick = others[Math.floor(Math.random() * others.length)];
    setOpen(false);
    if (pick) navigate(recipeRoute(pick.slug));
  }, [navigate, pathname]);

  const value = useMemo(
    () => ({
      filters,
      set,
      clear,
      open,
      setOpen,
      filtering: isFiltering(filters),
      results: findRecipes(filters),
      surprise,
    }),
    [filters, set, clear, open, surprise],
  );
  return <FinderContext.Provider value={value}>{children}</FinderContext.Provider>;
}

export function useFinder(): Finder {
  const finder = useContext(FinderContext);
  if (!finder) throw new Error('useFinder needs a FinderProvider');
  return finder;
}
