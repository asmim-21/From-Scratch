import type { MouseEvent } from 'react';
import type { FlipCorner } from 'page-flip';

/**
 * A strip along the outer edge of a page. Click or tap it to turn the page;
 * the curl starts from whichever corner is nearer where you clicked. You can
 * also press and drag from here (or anywhere on the page) to turn it by hand.
 */
export function PageEdge({ side, onTurn }: { side: 'left' | 'right'; onTurn: (corner: FlipCorner) => void }) {
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onTurn(e.clientY - r.top < r.height / 2 ? 'top' : 'bottom');
  };
  return (
    <div
      className={`edge edge--${side}`}
      role="button"
      tabIndex={0}
      aria-label={side === 'right' ? 'Turn the page' : 'Turn back a page'}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTurn('bottom');
        }
      }}
    />
  );
}
