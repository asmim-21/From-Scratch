import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { PageFlip, type FlipCorner } from 'page-flip';
import { Page } from '../pages/Page';
import { PageEdge } from './PageEdge';
import { openPages, spreadStart, type Plan } from './plan';

/*
 * The page-turning engine from asmimitra.com, with two additions for a longer
 * book: pages come from a plan instead of a fixed list, and only the pages near
 * the open ones are filled in.
 */

export interface FlipBookHandle {
  next(corner?: FlipCorner): void;
  prev(corner?: FlipCorner): void;
  goTo(page: number): void;
}

interface Props {
  plan: Plan;
  /** On-screen size of one page, in pixels. */
  pageWidth: number;
  pageHeight: number;
  reducedMotion: boolean;
  startPage: number;
  onPageChange: (page: number) => void;
  /** Called when a turn begins, with where it will land. */
  onTurnStart?: (from: number, to: number) => void;
}

// Links and controls on a page: pressing these never grabs the page.
const INTERACTIVE = 'a, button, input, textarea, select, label';
// A finger can still swipe from an ingredient: a tap ticks it, a swipe turns.
const INTERACTIVE_TOUCH = 'a, button, input, textarea, select';

// Controls that get a margin of safety too, so a near miss does nothing.
const KEEP_CLEAR = '[data-keep-clear]';
const CLEARANCE = 18;

/** How many pages either side of the open ones are kept filled in. */
const NEARBY = 4;

/*
 * On desktop, the closed cover sits alone on the right and the back cover alone
 * on the left. To keep every spread two pages wide (so turning back to the
 * cover reveals empty table, not the page you were on), each cover gets an
 * invisible partner: [blank, cover], [2, 3] … [back, blank].
 * "Slots" are the library's pages; "pages" are ours (0 = cover … last = back).
 */
type Slot = { kind: 'page'; page: number } | { kind: 'blank' };

export const FlipBook = forwardRef<FlipBookHandle, Props>(function FlipBook(props, ref) {
  const { plan, pageWidth, pageHeight, reducedMotion } = props;
  const { portrait, width: designWidth, height: designHeight } = plan.geometry;
  const last = plan.last;
  const startPage = spreadStart(plan, props.startPage);
  const scale = pageWidth / designWidth;
  const mountRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const currentRef = useRef(startPage);
  const queuedRef = useRef<number | null>(null);
  /** Pages made stiff for one turn, because the cover is what's really turning. */
  const stiffRef = useRef<number[]>([]);
  const callbacks = useRef(props);
  callbacks.current = props;

  // The pages to keep filled in: around where we are, and where we're heading.
  const [centres, setCentres] = useState<readonly number[]>([startPage]);
  const isNear = (page: number) => centres.some((c) => page >= c - NEARBY && page <= c + 1 + NEARBY);

  const offset = portrait ? 0 : 1; // slot index = page index + offset
  const toSlot = (page: number) => page + offset;
  const toPage = (slot: number) => Math.max(0, Math.min(last, slot - offset));

  const slots: Slot[] = useMemo(() => {
    const pages: Slot[] = plan.pages.map((_, page) => ({ kind: 'page', page }));
    return portrait ? pages : [{ kind: 'blank' }, ...pages, { kind: 'blank' }];
  }, [plan, portrait]);

  // One stable DOM node per page (plus the two blanks). The library moves these
  // around freely; React fills them through portals.
  const pageEls = useMemo(() => {
    const make = (cls: string) => {
      const el = document.createElement('div');
      el.className = cls;
      return el;
    };
    const pages = plan.pages.map(() => make('flip-page'));
    pages[0].dataset.density = 'hard'; // the front cover is board, not paper
    return {
      pages,
      blanks: [make('flip-page flip-page--blank'), make('flip-page flip-page--blank')],
    };
  }, [plan]);

  const setPage = (page: number) => {
    currentRef.current = page;
    setCentres([page]);
    callbacks.current.onPageChange(page);
  };

  const fade = () => {
    mountRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
  };

  /** Where a single turn from `from` lands. */
  const landing = (from: number, forward: boolean) => {
    if (portrait) return Math.max(0, Math.min(last, from + (forward ? 1 : -1)));
    if (forward) return from === 0 ? 1 : Math.min(last, from + 2);
    return from === 1 ? 0 : from === last ? last - 2 : Math.max(0, from - 2);
  };

  // Build the book. Rebuilt when its size or mode changes, keeping the page.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const host = document.createElement('div');
    host.style.width = `${portrait ? pageWidth : pageWidth * 2}px`;
    mount.appendChild(host);

    const items = slots.map((s, i) =>
      s.kind === 'page' ? pageEls.pages[s.page] : pageEls.blanks[i === 0 ? 0 : 1],
    );

    const book = new PageFlip(host, {
      width: pageWidth,
      height: pageHeight,
      size: 'fixed',
      autoSize: true,
      showCover: false,
      usePortrait: portrait,
      startPage: toSlot(currentRef.current),
      flippingTime: 900,
      drawShadow: true,
      maxShadowOpacity: 0.45,
      showPageCorners: !reducedMotion,
      disableFlipByClick: true, // clicks turn pages only at the edges and corners
      useMouseEvents: !reducedMotion,
      mobileScrollSupport: true,
      swipeDistance: 30,
    });
    book.loadFromHTML(items);

    // In one-page mode the library aims "previous" at a spot it doesn't count as
    // a corner, so nothing happens. Aim at the left-hand corner instead.
    const controller = book.getFlipController();
    controller.flipPrev = (corner) => {
      const rect = book.getRender().getRect();
      controller.flip({ x: rect.left + 10, y: corner === 'top' ? 1 : rect.height - 2 });
    };

    /*
     * Closing the book. When the page beside a cover turns, the library
     * uncovers an area that should show what's underneath: normally another
     * page, but next to a cover it's our see-through blank. The library still
     * draws the page you were on full-size beneath it, so it would show through.
     * After each frame, cut the uncovered area out of that page, so the
     * table shows exactly where the sheet has lifted away.
     */
    type LibPage = { getElement(): HTMLElement } | null;
    const render = book.getRender() as unknown as {
      drawFrame(): void;
      leftPage: LibPage;
      rightPage: LibPage;
      bottomPage: LibPage;
    };
    const drawFrame = render.drawFrame.bind(render);
    render.drawFrame = () => {
      drawFrame();
      const under = render.bottomPage?.getElement();
      if (!under || !under.classList.contains('flip-page--blank')) return;
      const page = (under === pageEls.blanks[0] ? render.leftPage : render.rightPage)?.getElement();
      const match = /polygon\((.*)\)/.exec(under.style.clipPath);
      if (!page || !match) return;
      const u = under.getBoundingClientRect();
      const p = page.getBoundingClientRect();
      const hole = match[1].split(',').map((pt) => {
        const [x, y] = pt.trim().split(/\s+/).map(parseFloat);
        return `${x + u.left - p.left}px ${y + u.top - p.top}px`;
      });
      const w = p.width;
      const h = p.height;
      const clip = `polygon(evenodd, 0 0, ${w}px 0, ${w}px ${h}px, 0 ${h}px, 0 0, ${hole.join(', ')}, ${hole[0]}, 0 0)`;
      page.style.clipPath = clip;
      page.style.setProperty('-webkit-clip-path', clip);
    };

    book.on('flip', (e) => setPage(toPage(e.data)));
    book.on('changeState', (e) => {
      if (e.data === 'read') {
        stiffRef.current.forEach((slot) => book.getPage(slot).setDensity('soft'));
        stiffRef.current = [];
        if (queuedRef.current !== null) window.setTimeout(runQueued, 0);
        return;
      }
      if (e.data !== 'flipping') return;
      const calc = book.getFlipController().getCalculation();
      if (!calc) return;
      const from = currentRef.current;
      callbacks.current.onTurnStart?.(from, landing(from, calc.getDirection() === 0));
    });

    // Keep the page from reacting while the pointer is over a link or button:
    // no grabbing it, and no lifting the corner over it (which would swallow
    // the click and turn the page instead). Checked by position, because a
    // lifted corner covers whatever is beneath it.
    const within = (el: Element, x: number, y: number, margin: number) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return false;
      return x >= r.left - margin && x <= r.right + margin && y >= r.top - margin && y <= r.bottom + margin;
    };
    const overInteractive = (x: number, y: number, selector: string) =>
      openPages(plan, currentRef.current).some((i) => {
        const page = pageEls.pages[i];
        return (
          Array.from(page.querySelectorAll(selector)).some((el) => within(el, x, y, 0)) ||
          Array.from(page.querySelectorAll(KEEP_CLEAR)).some((el) => within(el, x, y, CLEARANCE))
        );
      });
    const shieldPress = (e: MouseEvent | TouchEvent) => {
      const touch = 'touches' in e;
      const pt = touch ? e.touches[0] : e;
      if (pt && overInteractive(pt.clientX, pt.clientY, touch ? INTERACTIVE_TOUCH : INTERACTIVE)) {
        e.stopPropagation();
      }
    };
    const shieldHover = (e: MouseEvent) => {
      const state = book.getState();
      if (state !== 'read' && state !== 'fold_corner') return; // mid-drag: leave it
      if (!overInteractive(e.clientX, e.clientY, INTERACTIVE)) return;
      e.stopPropagation();
      // If a corner was already lifting, let it fall back flat.
      if (state === 'fold_corner') {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: -10000, clientY: -10000 }));
      }
    };
    // A click on the page's edge that was really aimed at a control nearby.
    const shieldClick = (e: MouseEvent) => {
      const onEdge = e.target instanceof Element && e.target.closest('.edge');
      if (onEdge && e.detail > 0 && overInteractive(e.clientX, e.clientY, KEEP_CLEAR)) e.stopPropagation();
    };
    mount.addEventListener('click', shieldClick, true);
    mount.addEventListener('mousedown', shieldPress, true);
    mount.addEventListener('touchstart', shieldPress, true);
    window.addEventListener('mousemove', shieldHover, true);

    flipRef.current = book;
    return () => {
      flipRef.current = null;
      mount.removeEventListener('click', shieldClick, true);
      mount.removeEventListener('mousedown', shieldPress, true);
      mount.removeEventListener('touchstart', shieldPress, true);
      window.removeEventListener('mousemove', shieldHover, true);
      book.destroy();
    };
    // The helpers used above only read refs, so they never go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth, pageHeight, portrait, reducedMotion, slots, pageEls]);

  const turn = (forward: boolean, corner: FlipCorner = 'bottom') => {
    const book = flipRef.current;
    if (!book || book.getState() !== 'read') return;
    const from = currentRef.current;
    if (forward ? from === last : from === 0) return;
    if (reducedMotion) {
      const to = landing(from, forward);
      callbacks.current.onTurnStart?.(from, to);
      book.turnToPage(toSlot(to));
      setPage(to);
      fade();
      return;
    }
    if (forward) book.flipNext(corner);
    else book.flipPrev(corner);
  };

  /** Goes to the page asked for last, once any turn in progress has finished. */
  const runQueued = () => {
    const book = flipRef.current;
    const page = queuedRef.current;
    if (!book || page === null || book.getState() === 'flipping') return;
    queuedRef.current = null;
    if (page === currentRef.current) return;
    // Fill in the pages we're about to see before they come into view.
    flushSync(() => setCentres([currentRef.current, page]));
    callbacks.current.onTurnStart?.(currentRef.current, page);
    if (reducedMotion) {
      book.turnToPage(toSlot(page));
      setPage(page);
      fade();
    } else {
      if (currentRef.current === 0 && !portrait && page !== 1) {
        // Jumping in from the closed cover: it should swing open, not peel.
        stiffRef.current = [toSlot(page) - 1, toSlot(page)];
        stiffRef.current.forEach((slot) => book.getPage(slot).setDensity('hard'));
      }
      book.flip(toSlot(page), 'bottom');
    }
  };

  useImperativeHandle(ref, () => ({
    next: (corner) => turn(true, corner),
    prev: (corner) => turn(false, corner),
    goTo: (page) => {
      queuedRef.current = spreadStart(plan, page);
      window.setTimeout(runQueued, 0);
    },
  }));

  // Which side of the spine each page sits on.
  const sideOf = (page: number): 'left' | 'right' | 'single' => {
    if (portrait) return 'single';
    return toSlot(page) % 2 === 0 ? 'left' : 'right';
  };

  const innerStyle = {
    transform: `scale(${scale})`,
    '--pw': `${designWidth}px`,
    '--ph': `${designHeight}px`,
    '--pad-top': `${plan.geometry.padTop}px`,
    '--pad-bottom': `${plan.geometry.padBottom}px`,
    '--pad-outer': `${plan.geometry.padOuter}px`,
    '--pad-inner': `${plan.geometry.padInner}px`,
  } as CSSProperties;

  return (
    <>
      <div
        ref={mountRef}
        className={`flip-book ${portrait ? 'flip-book--portrait' : ''}`}
        style={{ width: portrait ? pageWidth : pageWidth * 2, height: pageHeight }}
      />
      {pageEls.pages.map((el, i) => {
        if (!isNear(i)) return null;
        const side = sideOf(i);
        return createPortal(
          <div className={`flip-page__inner flip-page__inner--${side}`} style={innerStyle}>
            <Page page={plan.pages[i]} number={i + 1} side={side} onOpen={() => turn(true)} />
            {i === 0 && <div className="spine spine--left" />}
            {i === last && <div className="spine spine--right" />}
            {side === 'left' && i !== last && <div className="page-curve page-curve--left" />}
            {side === 'right' && i !== 0 && <div className="page-curve page-curve--right" />}
            {side === 'left' && i !== last && <div className="gutter gutter--left" />}
            {side === 'right' && i !== 0 && <div className="gutter gutter--right" />}
            {(side === 'left' || (side === 'single' && i > 0)) && (
              <PageEdge side="left" onTurn={(c) => turn(false, c)} />
            )}
            {(side === 'right' || (side === 'single' && i < last)) && (
              <PageEdge side="right" onTurn={(c) => turn(true, c)} />
            )}
          </div>,
          el,
          plan.pages[i].key,
        );
      })}
    </>
  );
});
