import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { site } from '../lib/content';
import { PhoneToolbar } from '../toolbar/PhoneToolbar';
import { FlipBook } from './FlipBook';
import { ChapterTabs } from './ChapterTabs';
import { useElementSize } from './hooks';
import { pageLabel } from './plan';
import type { ReaderProps } from './RecipeBook';

export function PhoneReader(props: ReaderProps) {
  const { plan, bookRef, page, startPage, reducedMotion, onPageChange, onTurn } = props;
  const { width: designWidth, height: designHeight } = plan.geometry;
  const areaRef = useRef<HTMLDivElement>(null);
  const area = useElementSize(areaRef);

  const scale = Math.min(area.width / designWidth, area.height / designHeight, 1.5);
  const pageWidth = Math.max(150, Math.floor(designWidth * scale));
  const pageHeight = Math.round((pageWidth * designHeight) / designWidth);

  return (
    <div className="phone">
      <header className="phone__bar">
        <Link className="brand brand--small" to="/">
          {site.title}
        </Link>
        <Link className="slip" to="/contents">
          Contents
        </Link>
      </header>

      <div className="phone__area" ref={areaRef}>
        {area.width > 0 && (
          <div className="phone__frame" style={{ width: pageWidth, height: pageHeight }}>
            <ChapterTabs currentId={props.chapterId} />
            <FlipBook
              ref={bookRef}
              plan={plan}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              reducedMotion={reducedMotion}
              startPage={startPage}
              onPageChange={onPageChange}
              onTurnStart={onTurn}
            />
          </div>
        )}
      </div>

      <p className="visually-hidden" aria-live="polite">
        {pageLabel(plan, page)}
      </p>
      <PhoneToolbar sound={props.sound} onSound={props.onSound} />
    </div>
  );
}
