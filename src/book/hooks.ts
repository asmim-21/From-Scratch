import { useEffect, useState, type RefObject } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * The element's size, updated (with a short delay while resizing) whenever it
 * changes. The page-flip book is rebuilt at each new size, so this avoids
 * rebuilding it on every pixel of a window drag.
 */
export function useElementSize(
  ref: RefObject<HTMLElement>,
  delayMs = 150,
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: number | undefined;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((prev) =>
        Math.round(prev.width) === Math.round(r.width) && Math.round(prev.height) === Math.round(r.height)
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    read();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, delayMs);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref, delayMs]);
  return size;
}

const TYPING = 'input:not([type="checkbox"]), textarea, select, [contenteditable="true"]';

/** Left/right arrow keys turn pages, unless the visitor is typing. */
export function useArrowKeys(onPrev: () => void, onNext: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest(TYPING)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') onNext();
      else if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPrev, onNext, enabled]);
}
