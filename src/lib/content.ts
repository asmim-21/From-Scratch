import basicsJson from '../generated/basics.json';
import chaptersJson from '../generated/chapters.json';
import recipesJson from '../generated/recipes.json';
import siteJson from '../generated/site.json';
import type { Basic, Chapter, Recipe, Site } from '../generated/types';

// Everything here is made by scripts/build_content.py from the content/ folder.
export const recipes = recipesJson as unknown as Recipe[];
export const basics = basicsJson as unknown as Basic[];
export const chapters = chaptersJson as unknown as Chapter[];
export const site: Site = siteJson;

/** The back section of the book, treated like one more chapter. */
export const basicsChapter: Chapter = {
  id: 'kitchen-basics',
  name: 'Kitchen Basics',
  tab: 'Basics',
  color: '#a9b294',
  icon: '🧅',
  blurb: 'skills I learned along the way',
  regions: [],
};

export const recipeRoute = (slug: string) => `/recipes/${slug}`;
export const basicRoute = (slug: string) => `/basics/${slug}`;
export const chapterRoute = (id: string) => (id === basicsChapter.id ? '/basics' : `/chapters/${id}`);

export const allChapters: Chapter[] = basics.length ? [...chapters, basicsChapter] : chapters;

/** Turns "/photos/x.webp" into an address that works wherever the site is hosted. */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');

/** The address to share for a recipe: its link page, which has a preview card. */
export const shareUrl = (slug: string) =>
  new URL(`${import.meta.env.BASE_URL}recipes/${slug}/`, window.location.href).href;

/** 75 -> "1 h 15 min" */
export function minutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h ? `${h} h` : '', m || !h ? `${m} min` : ''].filter(Boolean).join(' ');
}

/** White or near-black, whichever is easier to read on the colour. */
export function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (light + 0.05) >= (light + 0.05) / 0.06 ? '#fffaf0' : '#2b1d12';
}
