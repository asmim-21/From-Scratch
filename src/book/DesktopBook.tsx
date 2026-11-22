import { useCallback, useRef, useState } from 'react';
import { DesktopToolbar } from '../toolbar/DesktopToolbar';
import { FlipBook } from './FlipBook';
import { ChapterTabs } from './ChapterTabs';
import { useElementSize } from './hooks';
import { pageLabel, spreadStart } from './plan';
import type { ReaderProps } from './RecipeBook';

const MARGIN_X = 72;
const MARGIN_Y = 18;

/** Sideways nudge that keeps a closed book centred on the table. */
const shiftFor = (page: number, last: number) => (page === 0 ? -0.5 : page === last ? 0.5 : 0);

export function DesktopBook(props: ReaderProps) {
  const { plan, bookRef, page, startPage, reducedMotion, onPageChange, onTurn } = props;
  const { width: designWidth, height: designHeight } = plan.geometry;
  // Where the book is heading: updates as a turn starts, so it slides to centre
  // along with the turn, not after it.
  const [target, setTarget] = useState(() => spreadStart(plan, startPage));
  const stageRef = useRef<HTMLDivElement>(null);
  const stage = useElementSize(stageRef);

  // Fit two pages side by side into the space between the top and bottom bars.
  const scale = Math.min(
    (stage.width - MARGIN_X * 2) / (designWidth * 2),
    (stage.height - MARGIN_Y * 2) / designHeight,
    1.3,
  );
  const pageWidth = Math.max(200, Math.floor(designWidth * scale));
  const pageHeight = Math.round((pageWidth * designHeight) / designWidth);

  const changed = useCallback(
    (p: number) => {
      setTarget(p);
      onPageChange(p);
    },
    [onPageChange],
  );
  const turnStarted = useCallback(
    (_from: number, to: number) => {
      setTarget(to);
      onTurn();
    },
    [onTurn],
  );

  const shift = shiftFor(target, plan.last);
  const cover = target === 0 ? 'front' : target === plan.last ? 'back' : 'open';
  // A cover's board only shows beyond the pages once that cover is lying flat.
  const leftBoard = page !== 0 && target !== 0;
  const rightBoard = page !== plan.last && target !== plan.last;
  const progress = target / plan.last;
  const thickness = 3 + Math.min(7, plan.last / 12);
  const motion = reducedMotion ? '' : 'book--animated';

  return (
    <div className="desk">
      <DesktopToolbar sound={props.sound} onSound={props.onSound} />

      <div className="desk__stage" ref={stageRef}>
        {stage.width > 0 && (
          <div
            className={`book ${motion} book--${cover}`}
            style={{
              width: pageWidth * 2,
              height: pageHeight,
              transform: `translateX(${shift * pageWidth}px)`,
              fontSize: pageWidth / designWidth,
            }}
          >
            {(leftBoard || cover === 'back') && <div className="board board--left" />}
            {(rightBoard || cover === 'front') && <div className="board board--right" />}
            <ChapterTabs currentId={props.chapterId} flipped={cover === 'back'} />
            <div className="stack stack--left" style={{ width: thickness * progress }} />
            <div className="stack stack--right" style={{ width: thickness * (1 - progress) }} />
            <FlipBook
              ref={bookRef}
              plan={plan}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              reducedMotion={reducedMotion}
              startPage={startPage}
              onPageChange={changed}
              onTurnStart={turnStarted}
            />
          </div>
        )}
      </div>

      <p className="visually-hidden" aria-live="polite">
        {pageLabel(plan, page)}
      </p>
    </div>
  );
}
