import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { hash, Washi } from '../components/decor';
import { allChapters, asset, minutes, recipeRoute } from '../lib/content';
import { useFinder } from './FinderProvider';
import { CHOICES, type Filters } from './search';

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const { filters, set, setOpen } = useFinder();
  return (
    <input
      className="search"
      type="search"
      placeholder="Recipe, ingredient or tag"
      aria-label="Search recipes"
      value={filters.q}
      autoFocus={autoFocus}
      onChange={(e) => {
        set({ q: e.target.value });
        if (e.target.value) setOpen(true);
      }}
    />
  );
}

const TIMES = [
  ['15', '15 min or less'],
  ['30', '30 min or less'],
  ['45', '45 min or less'],
  ['60', '1 hour or less'],
  ['120', '2 hours or less'],
] as const;

export function FilterRow() {
  const { filters, set, clear, filtering } = useFinder();
  const pick = (
    name: keyof Filters,
    label: string,
    options: ReadonlyArray<readonly [value: string, text: string]>,
  ) => (
    <label className="filter">
      <span>{label}</span>
      <select value={filters[name]} onChange={(e) => set({ [name]: e.target.value })}>
        <option value="">Any</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const same = (values: string[]) => values.map((v) => [v, v] as const);
  return (
    <div className="filters">
      {pick('cuisine', 'Cuisine', same(CHOICES.cuisine))}
      {pick('course', 'Course', same(CHOICES.course))}
      {pick('diet', 'Diet', same(CHOICES.diet))}
      {pick('difficulty', 'Difficulty', same(CHOICES.difficulty))}
      {pick('maxTime', 'Time', TIMES)}
      <button className="pill" onClick={clear} disabled={!filtering}>
        Clear
      </button>
    </div>
  );
}

/** Matching recipes, as a fan of recipe cards. */
export function Results() {
  const { results, setOpen } = useFinder();
  return (
    <>
      <p className="results__count" role="status">
        {results.length === 0
          ? 'Nothing matches. Try fewer filters.'
          : `${results.length} recipe${results.length === 1 ? '' : 's'}`}
      </p>
      <ul className={`cards ${results.length <= 6 ? 'cards--fan' : ''}`}>
        {results.map((r, i) => {
          const seed = hash(r.slug);
          const spread = i - (results.length - 1) / 2;
          const style = {
            '--turn': `${results.length <= 6 ? spread * 5 : ((seed % 50) - 25) / 10}deg`,
            '--drop': `${results.length <= 6 ? spread * spread * 5 : 0}px`,
          } as CSSProperties;
          const chapter = allChapters.find((c) => c.name === r.cuisine);
          return (
            <li key={r.slug} className="card" style={style}>
              <Link to={recipeRoute(r.slug)} onClick={() => setOpen(false)}>
                <Washi seed={seed} className="card__tape" />
                <span className="card__photo" style={{ backgroundColor: chapter?.color }}>
                  {r.photo ? (
                    <img src={asset(r.photo.small)} alt="" loading="lazy" />
                  ) : (
                    <span aria-hidden="true">{chapter?.icon}</span>
                  )}
                </span>
                <span className="card__title">{r.title}</span>
                <span className="card__note">
                  {[r.region ?? r.cuisine, r.time && minutes(r.time)].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function SoundToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      className="icon-button"
      aria-pressed={on}
      aria-label="Page-turn sound"
      title={on ? 'Sound on' : 'Sound off'}
      onClick={() => onChange(!on)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500Z" fill="currentColor" stroke="none" />
        {on ? (
          <path d="M15.500 9a4.300 4.300 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11" />
        ) : (
          <path d="m16 9.500 5 5m0-5-5 5" />
        )}
      </svg>
    </button>
  );
}
