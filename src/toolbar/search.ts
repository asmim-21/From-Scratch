import type { Recipe } from '../generated/types';
import { recipes } from '../lib/content';

export interface Filters {
  q: string;
  cuisine: string;
  course: string;
  diet: string;
  difficulty: string;
  maxTime: string;
}

export const NO_FILTERS: Filters = { q: '', cuisine: '', course: '', diet: '', difficulty: '', maxTime: '' };

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Everything searchable about each recipe, prepared once. */
const library = recipes.map((recipe) => ({
  recipe,
  title: plain(recipe.title),
  rest: plain(
    [
      recipe.region ?? '',
      ...recipe.tags,
      ...recipe.sections
        .filter((s) => s.key === 'ingredients')
        .flatMap((s) => s.blocks.map((b) => b.text.map((t) => t.text).join(''))),
    ].join(' \n '),
  ),
}));

export const isFiltering = (f: Filters) => Object.values(f).some((v) => v.trim() !== '');

export function findRecipes(f: Filters): Recipe[] {
  const words = plain(f.q).split(/\s+/).filter(Boolean);
  const hits = library.filter(({ recipe: r, title, rest }) => {
    if (f.cuisine && r.cuisine !== f.cuisine) return false;
    if (f.course && r.course !== f.course) return false;
    if (f.diet && r.diet !== f.diet) return false;
    if (f.difficulty && r.difficulty !== f.difficulty) return false;
    if (f.maxTime && (r.time === null || r.time > Number(f.maxTime))) return false;
    return words.every((w) => title.includes(w) || rest.includes(w));
  });
  // A match in the name comes before a match in the ingredients.
  const inTitle = (t: string) => words.length > 0 && words.every((w) => t.includes(w));
  return hits.sort((a, b) => Number(inTitle(b.title)) - Number(inTitle(a.title))).map((h) => h.recipe);
}

/** The choices to offer: only ones some recipe actually has. */
const choices = (of: (r: Recipe) => string | null, order?: string[]) => {
  const found = [...new Set(recipes.map(of).filter((x): x is string => !!x))];
  return order ? order.filter((o) => found.includes(o)) : found;
};

export const CHOICES = {
  cuisine: choices((r) => r.cuisine),
  course: choices((r) => r.course).sort(),
  diet: choices((r) => r.diet).sort(),
  difficulty: choices((r) => r.difficulty, ['Easy', 'Medium', 'Hard']),
};
