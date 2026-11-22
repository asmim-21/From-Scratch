import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { allChapters, chapterRoute, inkOn } from '../lib/content';
import { useFinder } from './FinderProvider';
import { FilterRow, Results, SearchBox, SoundToggle } from './parts';

/** A small floating button that opens everything as a sheet. */
export function PhoneToolbar({ sound, onSound }: { sound: boolean; onSound: (on: boolean) => void }) {
  const { open, setOpen, filtering, surprise } = useFinder();
  const sheetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [open, setOpen]);

  const close = () => setOpen(false);
  return (
    <>
      <button
        ref={buttonRef}
        className="fab"
        aria-label="Find a recipe"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.500 15.500 5 5" />
        </svg>
      </button>
      {open && (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Find a recipe"
          tabIndex={-1}
          ref={sheetRef}
        >
          <div className="sheet__bar">
            <SearchBox />
            <button className="pill" onClick={close}>
              Close
            </button>
          </div>
          <div className="sheet__actions">
            <button className="pill pill--strong" onClick={surprise}>
              Surprise me
            </button>
            <SoundToggle on={sound} onChange={onSound} />
          </div>
          <FilterRow />
          {filtering ? (
            <Results />
          ) : (
            <nav className="sheet__chapters" aria-label="Chapters">
              {allChapters.map((c) => (
                <Link
                  key={c.id}
                  to={chapterRoute(c.id)}
                  onClick={close}
                  style={{ backgroundColor: c.color, color: inkOn(c.color) }}
                >
                  <span aria-hidden="true">{c.icon}</span> {c.name}
                </Link>
              ))}
              <Link to="/index" onClick={close}>
                Index of all recipes
              </Link>
            </nav>
          )}
        </div>
      )}
    </>
  );
}
