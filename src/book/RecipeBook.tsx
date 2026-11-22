import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { CookMode } from '../cook/CookMode';
import { recipeRoute, recipes, site } from '../lib/content';
import { playPageTurn } from '../lib/sound';
import { FinderProvider } from '../toolbar/FinderProvider';
import { PlanContext } from './context';
import { DesktopBook } from './DesktopBook';
import type { FlipBookHandle } from './FlipBook';
import { useArrowKeys, useMediaQuery } from './hooks';
import { createMeasurer, fontsReady } from './measure';
import { PhoneReader } from './PhoneReader';
import { buildPlan, DESKTOP, openPages, PHONE, spreadStart, TABLET, type Geometry, type Plan } from './plan';

export interface ReaderProps {
  plan: Plan;
  bookRef: RefObject<FlipBookHandle>;
  page: number;
  /** The chapter being read, for its tab. */
  chapterId?: string;
  startPage: number;
  reducedMotion: boolean;
  sound: boolean;
  onSound: (on: boolean) => void;
  onPageChange: (page: number) => void;
  onTurn: () => void;
}

function makePlan(geometry: Geometry): Plan {
  const measurer = createMeasurer();
  try {
    return buildPlan(geometry, measurer);
  } finally {
    measurer.dispose();
  }
}

/** The plan for this size of page, worked out once the handwriting has loaded. */
function usePlanFor(geometry: Geometry): Plan | null {
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    let live = true;
    void fontsReady().then((inTime) => {
      if (!live) return;
      setPlan(makePlan(geometry));
      // Slow connection: start with a stand-in font, then lay out again.
      if (!inTime) {
        void fontsReady(60_000).then((arrived) => live && arrived && setPlan(makePlan(geometry)));
      }
    });
    return () => {
      live = false;
    };
  }, [geometry]);
  return plan?.geometry === geometry ? plan : null;
}

/** Picks the two-page book (desktop) or one-page reader (phones, upright tablets). */
export function RecipeBook() {
  const single = useMediaQuery('(max-width: 899px), (orientation: portrait)');
  const narrow = useMediaQuery('(max-width: 599px)');
  const geometry = !single ? DESKTOP : narrow ? PHONE : TABLET;
  const plan = usePlanFor(geometry);
  return (
    <main className="table">
      {plan ? (
        <PlanContext.Provider value={plan}>
          <OpenBook key={`${plan.geometry.width}-${plan.geometry.portrait}`} plan={plan} />
        </PlanContext.Provider>
      ) : (
        <p className="loading">Fetching the book…</p>
      )}
    </main>
  );
}

function OpenBook({ plan }: { plan: Plan }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const bookRef = useRef<FlipBookHandle>(null);

  const cookSlug = matchPath('/recipes/:slug/cook', pathname)?.params.slug;
  const cooking = cookSlug ? recipes.find((r) => r.slug === cookSlug) : undefined;
  const route = cookSlug ? recipeRoute(cookSlug) : pathname.replace(/(.)\/$/, '$1');

  const [startPage] = useState(() => spreadStart(plan, Math.max(0, plan.find(route))));
  const [page, setPage] = useState(startPage);
  const pageRef = useRef(startPage);
  const routeRef = useRef(route);
  routeRef.current = route;
  const [sound, setSound] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const onPageChange = useCallback(
    (p: number) => {
      pageRef.current = p;
      setPage(p);
      // Keep the address in step, so it can always be copied and shared.
      const showing = openPages(plan, p).some((i) => plan.pages[i].route === routeRef.current);
      if (!showing) navigate(plan.pages[p].route, { replace: true });
    },
    [plan, navigate],
  );

  // The address changed (a link, a tab, the back button): turn to that page.
  useEffect(() => {
    const index = plan.find(route);
    if (index < 0) {
      navigate('/', { replace: true });
      return;
    }
    const alreadyOpen = openPages(plan, pageRef.current).some((i) => plan.pages[i].route === route);
    if (!alreadyOpen) bookRef.current?.goTo(index);
  }, [route, plan, navigate]);

  const onTurn = useCallback(() => {
    if (soundRef.current) playPageTurn();
  }, []);

  const next = useCallback(() => bookRef.current?.next(), []);
  const prev = useCallback(() => bookRef.current?.prev(), []);
  useArrowKeys(prev, next, !cooking);

  const title = useMemo(() => {
    const index = plan.find(route);
    return index > 0 ? `${plan.pages[index].title} · ${site.title}` : site.title;
  }, [plan, route]);
  useEffect(() => {
    document.title = title;
  }, [title]);

  const here = Math.min(page, plan.last);
  const reading = openPages(plan, here).find((i) => plan.pages[i].route === route) ?? here;

  const props: ReaderProps = {
    plan,
    bookRef,
    page: here,
    chapterId: plan.pages[reading].chapter?.id,
    startPage,
    reducedMotion,
    sound,
    onSound: setSound,
    onPageChange,
    onTurn,
  };

  return (
    <>
      {/* Behind cook mode the book stays put but can't be focused or read. */}
      <div className="table__book" {...(cooking ? { inert: '' } : {})}>
        <FinderProvider>
          {plan.geometry.portrait ? <PhoneReader {...props} /> : <DesktopBook {...props} />}
        </FinderProvider>
      </div>
      {cooking && (
        <CookMode recipe={cooking} onClose={() => navigate(recipeRoute(cooking.slug), { replace: true })} />
      )}
    </>
  );
}
