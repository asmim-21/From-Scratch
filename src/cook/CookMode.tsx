import { useEffect, useRef, useState } from 'react';
import type { Recipe } from '../generated/types';
import { FlowItemView } from '../components/Flow';
import { ServingsStepper } from '../components/ServingsStepper';
import { recipeScale, sectionItems } from '../book/plan';
import { minutes } from '../lib/content';

/** Keeps the screen on while `on`, where the browser supports it. */
function useWakeLock(): boolean {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const ask = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const got = await navigator.wakeLock.request('screen');
        if (!live) {
          void got.release();
          return;
        }
        lock = got;
        setAwake(true);
        got.addEventListener('release', () => live && setAwake(false));
      } catch {
        /* low battery or not allowed: carry on without */
      }
    };
    // Browsers let go of the lock when you switch apps; ask again on return.
    const onVisible = () => void ask();
    void ask();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);
  return awake;
}

/** A big, plain version of a recipe to follow at the stove. */
export function CookMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const awake = useWakeLock();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(1);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);

  const facts = [recipe.time && minutes(recipe.time), recipe.difficulty, recipe.diet].filter(Boolean);

  return (
    <div className="cook" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={recipe.title}>
      <div className="cook__bar">
        <button className="pill" onClick={onClose}>
          ← Back to the book
        </button>
        <div className="cook__sizes">
          <button
            className="pill"
            onClick={() => setSize((s) => Math.max(0.8, s - 0.15))}
            aria-label="Smaller text"
          >
            A−
          </button>
          <button
            className="pill"
            onClick={() => setSize((s) => Math.min(1.9, s + 0.15))}
            aria-label="Bigger text"
          >
            A+
          </button>
        </div>
      </div>
      <article className="cook__recipe" style={{ fontSize: `${size * 22}px` }}>
        <h1>{recipe.title}</h1>
        <p className="cook__facts">{facts.join(' · ')}</p>
        <p className="cook__serves">
          {recipe.serves ? 'Serves' : 'Makes'}
          <ServingsStepper scale={recipeScale(recipe)} asWritten={recipe.serves} />
        </p>
        {sectionItems(recipe.sections, recipe.slug, recipeScale(recipe)).map((item, i) => (
          <FlowItemView key={i} item={item} />
        ))}
        {awake && <p className="cook__awake">Your screen will stay on.</p>}
      </article>
    </div>
  );
}
