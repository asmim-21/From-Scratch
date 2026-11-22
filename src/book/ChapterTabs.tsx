import { Link } from 'react-router-dom';
import { allChapters, chapterRoute, inkOn } from '../lib/content';

/** Sticky tabs along the outer edge of the book, one per chapter. */
export function ChapterTabs({ currentId, flipped = false }: { currentId?: string; flipped?: boolean }) {
  return (
    <nav className={`tabs ${flipped ? 'tabs--left' : ''}`} aria-label="Chapters">
      {allChapters.map((c) => (
        <Link
          key={c.id}
          to={chapterRoute(c.id)}
          className={`tab ${c.id === currentId ? 'tab--current' : ''}`}
          style={{ backgroundColor: c.color, color: inkOn(c.color) }}
          title={c.name}
          aria-label={c.name}
          aria-current={c.id === currentId ? 'true' : undefined}
        >
          <span className="tab__text">{c.tab}</span>
        </Link>
      ))}
    </nav>
  );
}
