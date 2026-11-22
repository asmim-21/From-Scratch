import type { CSSProperties } from 'react';

/* Small decorations, all drawn here: no image files. */

/** A steady pseudo-random number from a name, so each page always looks the same. */
export function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  // Stir well: similar names should look quite different.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

export function Heart({ className = '' }: { className?: string }) {
  return (
    <svg className={`deco ${className}`} viewBox="0 0 24 22" aria-hidden="true">
      <path
        d="M12 20.500C4.500 14.800 1.500 11 1.600 7 1.700 3.600 4.200 1.500 6.900 1.600 9.300 1.700 11 3.200 12 5.200 13.100 3.100 15 1.500 17.400 1.600 20.200 1.700 22.500 4 22.400 7.200 22.300 11.200 19 15 12 20.500Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg className={`deco ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 1C12.700 8 16 11.300 23 12 16 12.700 12.700 16 12 23 11.300 16 8 12.700 1 12 8 11.300 11.300 8 12 1Z"
        fill="currentColor"
      />
    </svg>
  );
}

const WASHI = ['blush', 'sage', 'peach', 'gold'] as const;

export function Washi({ seed, className = '' }: { seed: number; className?: string }) {
  return <span className={`washi washi--${WASHI[seed % WASHI.length]} ${className}`} aria-hidden="true" />;
}

/** A folded-over corner of gingham. */
export function GinghamCorner({ className = '' }: { className?: string }) {
  return <span className={`gingham ${className}`} aria-hidden="true" />;
}

/** The decoration in a page's margin: gingham, hearts or sparkles. */
export function MarginDecor({ seed }: { seed: number }) {
  switch (seed % 3) {
    case 0:
      return <GinghamCorner className="margin-decor" />;
    case 1:
      return (
        <span className="margin-decor margin-decor--hearts" aria-hidden="true">
          <Heart />
          <Heart />
          <Heart />
        </span>
      );
    default:
      return (
        <span className="margin-decor margin-decor--sparkles" aria-hidden="true">
          <Sparkle />
          <Sparkle />
          <Sparkle />
        </span>
      );
  }
}

/** The motif stamped on the cover: a whisk and a heart. */
export function CoverMotif({ style }: { style?: CSSProperties }) {
  return (
    <svg className="cover__motif" viewBox="0 0 120 150" style={style} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <g transform="rotate(24 60 75)">
          <path d="M60 78C30 60 36 10 60 10s30 50 0 68Z" />
          <path d="M60 78C46 60 49 10 60 10s14 50 0 68Z" />
          <path d="M60 12v64" />
          <path d="M55 78h10M55.500 84h9" />
          <path d="M56 89c-1 18-2 30-1 46 .400 6 9.600 6 10 0 1-16 0-28-1-46Z" />
        </g>
        <path
          transform="translate(2 -58)"
          d="M30 128c-9-7-13-12-13-17 .100-4 3-6.600 6.300-6.500 2.900.100 5 1.900 6.200 4.300 1.300-2.500 3.600-4.400 6.500-4.300 3.400.100 6 2.900 5.900 6.700-.100 4.900-4 9.800-11.900 16.800Z"
          fill="currentColor"
          strokeWidth="1.500"
        />
      </g>
    </svg>
  );
}
