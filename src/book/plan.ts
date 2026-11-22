import type { Basic, Block, Chapter, Inline, Recipe, Section } from '../generated/types';
import {
  allChapters,
  basicRoute,
  basics,
  basicsChapter,
  chapterRoute,
  minutes,
  recipeRoute,
  recipes,
  site,
} from '../lib/content';
import { MAX_SERVINGS, scaleText, servesNumber, type Scale } from '../lib/scale';

/*
 * Works out every page of the book, in order. Text is measured at its real size
 * and poured into pages, so a long recipe carries on overleaf instead of being
 * cut off or shrunk.
 */

// ---------------------------------------------------------------------------
// Page sizes
// ---------------------------------------------------------------------------

/** The design size of one page, in pixels. The book scales this to fit the screen. */
export interface Geometry {
  width: number;
  height: number;
  /** One page at a time instead of two-page spreads. */
  portrait: boolean;
  padTop: number;
  padBottom: number;
  padOuter: number;
  padInner: number;
}

export const DESKTOP: Geometry = {
  width: 520,
  height: 708,
  portrait: false,
  padTop: 44,
  padBottom: 60,
  padOuter: 64,
  padInner: 42,
};
export const TABLET: Geometry = { ...DESKTOP, portrait: true, padOuter: 52, padInner: 52 };
/** A narrower page, so the words stay big enough to read on a phone. */
export const PHONE: Geometry = { ...TABLET, width: 420, height: 650, padOuter: 42, padInner: 42 };

export const textWidth = (g: Geometry) => g.width - g.padOuter - g.padInner;
export const textHeight = (g: Geometry) => g.height - g.padTop - g.padBottom;

/** Heights of the fixed headings at the top of some pages (kept in step with pages.css). */
export const PAGE_HEADING = 104;
export const CONTINUED_HEADING = 52;
export const INDEX_COLUMN_GAP = 26;

// ---------------------------------------------------------------------------
// What goes on the pages
// ---------------------------------------------------------------------------

export type FlowItem =
  | { kind: 'section'; title: string; section?: Section['key']; scale?: Scale }
  | { kind: 'subhead'; title: string }
  | {
      kind: 'block';
      block: Block;
      section: Section['key'];
      tickId?: string;
      continued?: boolean;
      /** Amounts in this line change with the number of people. */
      scale?: Scale;
    }
  | { kind: 'entry'; title: string; note: string; route: string; chapter?: Pick<Chapter, 'color' | 'icon'> }
  | { kind: 'empty'; text: string };

interface PageBase {
  key: string;
  /** The address that opens the book here. */
  route: string;
  /** For the browser tab and screen readers. */
  title: string;
  chapter?: Chapter;
}

export type PageModel = PageBase &
  (
    | { kind: 'cover' | 'dedication' | 'back' }
    | { kind: 'contents' | 'list'; items: FlowItem[]; first: boolean }
    | { kind: 'divider'; count: number }
    | { kind: 'recipe'; recipe: Recipe }
    | { kind: 'basic'; basic: Basic }
    | { kind: 'flow'; items: FlowItem[]; first: boolean }
    | { kind: 'index'; columns: FlowItem[][]; first: boolean }
    | { kind: 'endpaper' }
  );

// Omit<> that keeps the union apart, so `add` still knows each kind's fields.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewPage = DistributiveOmit<PageModel, 'key'>;

export interface Plan {
  geometry: Geometry;
  pages: PageModel[];
  last: number;
  /** The first page with this address, or -1. */
  find: (route: string) => number;
  /** The printed page number for an address, or null before the plan is finished. */
  numberOf: (route: string) => number | null;
}

/** Measures items, in design pixels, in a column of this width. */
export interface Measurer {
  height: (item: FlowItem, width: number) => number;
  /** Measures many at once, which is much quicker than one by one. */
  warm: (items: FlowItem[], width: number) => void;
  /** How wide a line of text would be if it never wrapped. */
  lineWidth: (text: string) => number;
}

// ---------------------------------------------------------------------------
// Pouring text into pages
// ---------------------------------------------------------------------------

const isHeading = (item: FlowItem) =>
  item.kind === 'section' ||
  item.kind === 'subhead' ||
  (item.kind === 'block' && item.block.kind === 'heading');

/** Cuts a run of text in two after a number of words, keeping bold, italics and links. */
function cutWords(text: Inline[], count: number): [Inline[], Inline[]] {
  const before: Inline[] = [];
  const after: Inline[] = [];
  let left = count;
  for (const run of text) {
    const words = run.text.match(/\s*\S+\s*/g) ?? [];
    const a = words.slice(0, left).join('');
    const b = words.slice(left).join('');
    left = Math.max(0, left - words.length);
    if (a) before.push({ ...run, text: a });
    if (b) after.push({ ...run, text: b });
  }
  return [before, after];
}

const countWords = (text: Inline[]) =>
  text.reduce((n, run) => n + (run.text.match(/\s*\S+\s*/g) ?? []).length, 0);

type BlockItem = Extract<FlowItem, { kind: 'block' }>;

/** Splits a paragraph too tall for a whole page at the last word that fits. */
function splitToFit(
  item: BlockItem,
  room: number,
  height: (i: FlowItem) => number,
): [FlowItem, FlowItem] | null {
  const part = (text: Inline[], continued: boolean): BlockItem => ({
    ...item,
    block: { ...item.block, text },
    continued: continued || item.continued,
  });
  let lo = 0;
  let hi = countWords(item.block.text) - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (height(part(cutWords(item.block.text, mid)[0], false)) <= room) lo = mid;
    else hi = mid - 1;
  }
  if (lo < 1) return null;
  const [a, b] = cutWords(item.block.text, lo);
  return [part(a, false), part(b, true)];
}

/** Fills boxes (pages or columns) in order. A heading never sits alone at the bottom. */
export function pour(
  source: FlowItem[],
  height: (item: FlowItem) => number,
  capacity: (box: number) => number,
): FlowItem[][] {
  const boxes: FlowItem[][] = [];
  const queue = [...source];
  let box: FlowItem[] = [];
  let used = 0;
  const close = () => {
    boxes.push(box);
    box = [];
    used = 0;
  };

  while (queue.length) {
    const item = queue[0];
    const room = capacity(boxes.length) - used;
    const h = height(item);

    // A heading needs space for itself and whatever it introduces.
    let need = h;
    for (let i = 0; isHeading(queue[i]) && i + 1 < queue.length; i++) need += height(queue[i + 1]);

    if (need > room && box.length && !box.every(isHeading)) {
      // Notes belong under the method, so its last step comes along with them.
      const before = box[box.length - 1];
      const isNotes = item.kind === 'section' && item.section === 'notes';
      if (isNotes && box.length > 1 && !isHeading(before) && !isHeading(box[box.length - 2])) {
        queue.unshift(box.pop()!);
      }
      close();
      continue;
    }
    if (h > room && item.kind === 'block') {
      const split = splitToFit(item, room, height);
      if (split) {
        box.push(split[0]);
        queue.splice(0, 1, split[1]);
        close();
        continue;
      }
      if (box.length) {
        close();
        continue;
      }
    }
    box.push(item);
    used += h;
    queue.shift();
  }
  if (box.length) close();
  return boxes;
}

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------

export function sectionItems(sections: Section[], owner: string, scale?: Scale): FlowItem[] {
  const items: FlowItem[] = [];
  sections.forEach((section, s) => {
    if (section.title) items.push({ kind: 'section', title: section.title, section: section.key, scale });
    section.blocks.forEach((block, b) => {
      const tickable = block.kind === 'item' && isShoppingList(section);
      items.push({
        kind: 'block',
        block,
        section: section.key,
        tickId: tickable ? `${owner}/${s}.${b}` : undefined,
        scale: section.key === 'ingredients' && scales(block) ? scale : undefined,
      });
    });
  });
  return items;
}

/** Ingredients (or a basic's "What you need") get tick boxes. */
export const isShoppingList = (s: Section) => s.key === 'ingredients' || /^what you need$/i.test(s.title);

/** Ingredients, and sub-headings like "Jamuns (makes 6)". */
const scales = (block: Block) =>
  block.kind !== 'heading' || block.text.some((run) => /\bmakes \d/i.test(run.text));

export const recipeScale = (recipe: Recipe): Scale => ({
  slug: recipe.slug,
  serves: servesNumber(recipe.serves),
});

/** An ingredient's text for a number of people. */
export const scaledText = (text: Inline[], factor: number): Inline[] =>
  factor === 1 ? text : text.map((run) => ({ ...run, text: scaleText(run.text, factor) }));

/**
 * The same line at its longest. Scaling up can make a line wrap, so pages leave
 * room for the widest version and never overflow.
 */
function longest(item: BlockItem, scale: Scale, lineWidth: Measurer['lineWidth']): BlockItem {
  let text = item.block.text;
  let widest = 0;
  for (let count = 1; count <= MAX_SERVINGS; count++) {
    const version = scaledText(item.block.text, count / (scale.serves ?? 1));
    const width = lineWidth(version.map((run) => run.text).join(''));
    if (width > widest) [text, widest] = [version, width];
  }
  return { ...item, scale: undefined, block: { ...item.block, text } };
}

export function recipeNote(recipe: Recipe): string {
  return recipe.time ? minutes(recipe.time) : '';
}

export function buildPlan(geometry: Geometry, measurer: Measurer): Plan {
  const pages: PageModel[] = [];
  const width = textWidth(geometry);
  const full = textHeight(geometry);
  const pourText = (items: FlowItem[], capacity: (box: number) => number, column = width) => {
    const longestOf = new Map<FlowItem, FlowItem>();
    const atLongest = (item: FlowItem): FlowItem => {
      if (item.kind !== 'block' || !item.scale) return item;
      let found = longestOf.get(item);
      if (!found) longestOf.set(item, (found = longest(item, item.scale, measurer.lineWidth)));
      return found;
    };
    measurer.warm(items.map(atLongest), column);
    return pour(items, (item) => measurer.height(atLongest(item), column), capacity);
  };
  const used = new Map<string, number>();

  const add = (page: NewPage) => {
    const n = used.get(page.route) ?? 0;
    used.set(page.route, n + 1);
    pages.push({ ...page, key: n ? `${page.route}#${n + 1}` : page.route } as PageModel);
  };

  add({ kind: 'cover', route: '/', title: site.title });
  add({ kind: 'dedication', route: '/dedication', title: 'Dedication' });

  // Contents
  const toc: FlowItem[] = allChapters.map((chapter) => ({
    kind: 'entry',
    title: chapter.name,
    note: '',
    route: chapterRoute(chapter.id),
    chapter,
  }));
  toc.push({
    kind: 'entry',
    title: 'Index',
    note: '',
    route: '/index',
    chapter: { color: '#e6c988', icon: '🔖' },
  });
  pourText(toc, (i) => full - (i === 0 ? PAGE_HEADING : CONTINUED_HEADING)).forEach((items, i) =>
    add({ kind: 'contents', route: '/contents', title: 'Contents', items, first: i === 0 }),
  );

  const body = (owner: Recipe | Basic, route: string, chapter: Chapter) => {
    const items = sectionItems(
      owner.sections,
      owner.slug,
      'cuisine' in owner ? recipeScale(owner) : undefined,
    );
    // Later pages carry a "continued" line at the top.
    const flows = pourText(items, (i) => full - (i === 0 ? 0 : CONTINUED_HEADING));
    flows.forEach((flow, i) =>
      add({
        kind: 'flow',
        route,
        title: owner.title,
        chapter,
        items: flow,
        first: i === 0,
      }),
    );
  };

  for (const chapter of allChapters) {
    const isBasics = chapter === basicsChapter;
    const own = recipes.filter((r) => r.cuisine === chapter.name);
    const route = chapterRoute(chapter.id);
    add({
      kind: 'divider',
      route,
      title: chapter.name,
      chapter,
      count: isBasics ? basics.length : own.length,
    });

    const list: FlowItem[] = [];
    let course: string | null = null;
    for (const recipe of own) {
      // No point labelling a whole chapter "Drinks" when that's its name.
      if (recipe.course !== course && recipe.course !== chapter.name) {
        list.push({ kind: 'subhead', title: recipe.course ?? 'And more' });
      }
      course = recipe.course;
      list.push({
        kind: 'entry',
        title: recipe.title,
        note: recipeNote(recipe),
        route: recipeRoute(recipe.slug),
      });
    }
    if (isBasics) {
      basics.forEach((b) =>
        list.push({ kind: 'entry', title: b.title, note: '', route: basicRoute(b.slug) }),
      );
    }
    if (!list.length) {
      list.push({ kind: 'empty', text: 'Nothing here yet. The first one is still on the stove.' });
    }
    pourText(list, (i) => full - (i === 0 ? PAGE_HEADING : CONTINUED_HEADING)).forEach((items, i) =>
      add({ kind: 'list', route, title: chapter.name, chapter, items, first: i === 0 }),
    );

    own.forEach((recipe) => {
      const to = recipeRoute(recipe.slug);
      add({ kind: 'recipe', route: to, title: recipe.title, chapter, recipe });
      body(recipe, to, chapter);
    });
    if (isBasics) {
      basics.forEach((basic) => {
        const to = basicRoute(basic.slug);
        add({ kind: 'basic', route: to, title: basic.title, chapter, basic });
        body(basic, to, chapter);
      });
    }
  }

  // Index: every recipe, A to Z
  const index: FlowItem[] = [];
  let letter = '';
  const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title));
  for (const recipe of sorted) {
    const initial = recipe.title[0].normalize('NFD')[0].toUpperCase();
    if (initial !== letter) {
      letter = initial;
      index.push({ kind: 'subhead', title: letter });
    }
    index.push({ kind: 'entry', title: recipe.title, note: '', route: recipeRoute(recipe.slug) });
  }
  if (!index.length) index.push({ kind: 'empty', text: 'No recipes yet.' });
  const perPage = geometry.portrait ? 1 : 2;
  const columnWidth = perPage === 2 ? (width - INDEX_COLUMN_GAP) / 2 : width;
  const columns = pourText(
    index,
    (i) => full - (i < perPage ? PAGE_HEADING : CONTINUED_HEADING),
    columnWidth,
  );
  for (let i = 0; i < columns.length; i += perPage) {
    add({
      kind: 'index',
      route: '/index',
      title: 'Index',
      columns: columns.slice(i, i + perPage),
      first: i === 0,
    });
  }
  // The back cover closes on the left, so it needs an even number of pages before it.
  if (!geometry.portrait && pages.length % 2 === 0) {
    add({ kind: 'endpaper', route: '/index', title: 'Index' });
  }
  add({ kind: 'back', route: '/back', title: 'Back cover' });

  const firstAt = new Map<string, number>();
  pages.forEach((p, i) => {
    if (!firstAt.has(p.route)) firstAt.set(p.route, i);
  });
  const find = (route: string) => firstAt.get(route) ?? -1;
  return {
    geometry,
    pages,
    last: pages.length - 1,
    find,
    numberOf: (route) => (find(route) < 0 ? null : find(route) + 1),
  };
}

/*
 * On desktop pages sit in spreads: the cover alone, then 2–3, 4–5 …, then the
 * back cover alone. Odd page indexes are left-hand pages.
 */
export const spreadStart = (plan: Plan, page: number) =>
  plan.geometry.portrait || page === 0 || page === plan.last || page % 2 === 1 ? page : page - 1;

/** The pages showing when the book is open at `page`. */
export const openPages = (plan: Plan, page: number) =>
  plan.geometry.portrait || page === 0 || page === plan.last ? [page] : [page, page + 1];

export function pageLabel(plan: Plan, page: number): string {
  if (page === 0) return 'Cover';
  if (page === plan.last) return 'Back cover';
  return plan.geometry.portrait ? `Page ${page + 1}` : `Pages ${page + 1}–${page + 2}`;
}
