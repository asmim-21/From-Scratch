import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { site } from '../lib/content';
import { useFinder } from './FinderProvider';
import { FilterRow, Results, SearchBox, SoundToggle } from './parts';

/** A note card above the book, with a fan of results that opens below it. */
export function DesktopToolbar({ sound, onSound }: { sound: boolean; onSound: (on: boolean) => void }) {
  const { open, setOpen, filtering, surprise } = useFinder();
  const barRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPress = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!barRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPress);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPress);
    };
  }, [open, setOpen]);

  return (
    <>
      <header className="desk__bar">
        <nav className="toolbar" aria-label="Find a recipe" ref={barRef}>
          <Link className="brand" to="/" onClick={() => setOpen(false)}>
            {site.title}
          </Link>
          <SearchBox />
          <button className="pill" aria-expanded={open} onClick={() => setOpen(!open)}>
            {filtering ? 'Filters •' : 'Filters'}
          </button>
          <button className="pill" onClick={surprise}>
            Surprise me
          </button>
          <Link className="pill" to="/contents" onClick={() => setOpen(false)}>
            Contents
          </Link>
          <SoundToggle on={sound} onChange={onSound} />
        </nav>
      </header>
      {open && (
        <div className="finder">
          <section className="finder__inner" aria-label="Recipes found" ref={panelRef}>
            <FilterRow />
            <Results />
          </section>
        </div>
      )}
    </>
  );
}
