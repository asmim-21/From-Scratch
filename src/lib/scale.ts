/*
 * Scales the amounts in a line of ingredients, written as ordinary text:
 * "1 1/2 cups water" × 2 is "3 cups water". Anything that isn't an amount
 * (a 2 cm piece, 70% chocolate, a 400 g can) is left alone, and so are words
 * like "a pinch", which are for the cook to judge.
 */

const GLYPHS: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const G = `[${Object.keys(GLYPHS).join('')}]`;
// 1 1/2 · 1/2 · 1½ · ½ · 1.5 · 1,000 · 2
const NUM = `(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+\\s*${G}|${G}|\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)`;
const AMOUNT = new RegExp(`(${NUM})(?:(\\s*[–-]\\s*|\\s+to\\s+)(${NUM}))?`, 'g');

const METRIC = /^\s*(kg|g|grams?|ml|l|litres?|liters?)\b/i;
const CONTAINER = '(?:cans?|tins?|packets?|packs?|jars?|bottles?|blocks?|tubs?|cartons?|sachets?)';
const SIZED = new RegExp(`^\\s*-?(?:kg|g|grams?|ml|l)[\\s-]+${CONTAINER}\\b`, 'i');
/** Numbers followed by these are sizes, times or temperatures, not amounts. */
const NOT_AMOUNT =
  /^\s*(?:%|°|cm\b|mm\b|inch(?:es)?\b|in\.|"|″|secs?\b|seconds?\b|mins?\b|minutes?\b|hours?\b|hrs?\b|days?\b|degrees?\b|per\s?cent\b)/i;
const GLUED_UNIT = /^(?:kg|g|ml|l|tsp|tbsp|cups?|oz|lb)\b/i;

function parse(text: string): number {
  const last = text.slice(-1);
  if (last in GLYPHS) return (parseFloat(text) || 0) + GLYPHS[last];
  const mixed = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(text);
  if (mixed) return Number(mixed[1] ?? 0) + Number(mixed[2]) / (Number(mixed[3]) || 1);
  return parseFloat(text.replace(/,/g, ''));
}

const NICE: ReadonlyArray<readonly [number, string]> = [
  [0, ''],
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
  [1, ''],
];

const trim = (n: number, places: number) => String(Number(n.toFixed(places)));

function format(value: number, metric: boolean): string {
  if (metric) return trim(value, value < 10 ? 1 : 0);
  const whole = Math.floor(value);
  const part = value - whole;
  const [near, name] = NICE.reduce((a, b) => (Math.abs(b[0] - part) < Math.abs(a[0] - part) ? b : a));
  if (Math.abs(near - part) > 0.03 || (value > 0 && whole === 0 && near === 0)) return trim(value, 2);
  if (near === 1) return String(whole + 1);
  if (!name) return String(whole);
  return whole ? `${whole} ${name}` : name;
}

// ---------------------------------------------------------------------------
// One egg, two eggs
// ---------------------------------------------------------------------------

/** Things you measure by: "2 slices bread", where the bread stays as it is. */
const PORTIONS =
  'cup slice piece clove can tin packet pack jar bottle block tub carton sachet handful pinch dash splash sprig bunch stick stalk knob cube strip wedge sheet portion strand drop scoop spoon spoonful teaspoon tablespoon litre fillet';
const THINGS =
  'egg yolk onion shallot banana potato tomato carrot capsicum leaf pod lemon lime orange apple mango avocado mushroom zucchini cucumber eggplant chilli pepper breast thigh drumstick tortilla roll bun date fig olive muffin pancake cookie biscuit naan roti sausage prawn berry strawberry peach pear plum beetroot radish turnip parsnip walnut almond cashew pistachio pizza bagel croissant peppercorn';
const IRREGULAR: Record<string, string> = {
  leaf: 'leaves',
  potato: 'potatoes',
  tomato: 'tomatoes',
  mango: 'mangoes',
  chilli: 'chillies',
  berry: 'berries',
  strawberry: 'strawberries',
  radish: 'radishes',
  pinch: 'pinches',
  dash: 'dashes',
  splash: 'splashes',
  bunch: 'bunches',
  peach: 'peaches',
  box: 'boxes',
  sachet: 'sachets',
};
const pluralOf = (word: string) => IRREGULAR[word] ?? `${word}s`;

interface Noun {
  one: string;
  many: string;
  portion: boolean;
}
const NOUNS = new Map<string, Noun>();
for (const [list, portion] of [
  [PORTIONS, true],
  [THINGS, false],
] as const) {
  for (const one of list.split(' ')) {
    const noun = { one, many: pluralOf(one), portion };
    NOUNS.set(one, noun);
    NOUNS.set(noun.many, noun);
  }
}
/** Units that never change, after which the ingredient stays as written. */
const FIXED_UNIT = /^(?:tsp|tbsp|g|kg|ml|l|oz|lb|grams?|litres?)$/i;

/** Makes the words after a number agree with it: "1 small onion" -> "2 small onions". */
function agree(after: string, value: number, before: number): string {
  if (value > 1 === before > 1) return after;
  const segment = /^[^,;()]*?(?=[,;()]|\s(?:of|and|or|plus|with|from|to|in)\s|$)/.exec(after)?.[0] ?? '';
  const words = [...segment.matchAll(/[A-Za-z]+/g)];
  let pick: (typeof words)[number] | null = null;
  for (const word of words.slice(0, 6)) {
    if (FIXED_UNIT.test(word[0]) && !pick) return after;
    const noun = NOUNS.get(word[0].toLowerCase());
    if (!noun) {
      if (pick) break;
      continue;
    }
    pick = word; // "egg yolk", "orange slice": the last of a run is the thing counted
    if (noun.portion) break;
  }
  if (!pick) return after;
  const noun = NOUNS.get(pick[0].toLowerCase())!;
  const word = value > 1 ? noun.many : noun.one;
  const cased = pick[0][0] === pick[0][0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
  return after.slice(0, pick.index) + cased + after.slice(pick.index + pick[0].length);
}

// ---------------------------------------------------------------------------

/** The line with its amounts multiplied. */
export function scaleText(original: string, factor: number): string {
  if (factor === 1) return original;
  // "half a 400 g can" -> "1/2 × 400 g can", so the half can be scaled.
  let text = original.replace(/\bhalf an? (?=\d+\s*(?:kg|g|ml|l)\s)/gi, (m, at: number, all: string) =>
    SIZED.test(all.slice(at + m.length).replace(/^\d+/, '')) ? '1/2 × ' : m,
  );
  const amount = new RegExp(AMOUNT);
  for (let m = amount.exec(text); m; m = amount.exec(text)) {
    const [found, low, joiner, high] = m;
    const head = text.slice(0, m.index);
    const tail = text.slice(m.index + found.length);

    const skip =
      /[\w./-]$/.test(head) || // part of a word or a code
      /^0\d/.test(low) || // 00 flour
      (/^[a-z]/i.test(tail) && !GLUED_UNIT.test(tail)) || // 7up
      /^-(?!\s)(?!\d)/.test(tail) || // 8-inch
      NOT_AMOUNT.test(tail) ||
      // "1 tin (400 g)": the size of the tin
      (METRIC.test(tail) && new RegExp(`${CONTAINER}\\s*\\($`, 'i').test(head));
    if (skip) continue;

    if (SIZED.test(tail)) {
      // "400 g can" -> "2 × 400 g cans"; "2 x 400 g cans" had its 2 scaled already.
      if (/(?:[x×]|\d)\s*$/i.test(head)) continue;
      const sized = `${format(factor, false)} × ${found}`;
      const unit = /^\s*-?[a-z]+/i.exec(tail)![0];
      text = head + sized + unit + agree(tail.slice(unit.length), factor, 1);
      amount.lastIndex = head.length + sized.length;
      continue;
    }

    const metric = METRIC.exec(tail);
    const values = [low, high].filter((v) => v !== undefined).map((v) => parse(v) * factor);
    const top = Math.max(...values);
    // 1200 g reads better as 1.2 kg
    const shift = metric && /^(?:g|ml)$/i.test(metric[1]) && Math.min(...values) >= 1000;
    const shown = values.map((v) => (shift ? trim(v / 1000, 2) : format(v, !!metric))).join(joiner ?? '');
    let rest = tail;
    if (shift)
      rest = tail.replace(
        /^(\s*)(g|ml)/i,
        (_, space: string, unit: string) => space + (/g/i.test(unit) ? 'kg' : 'L'),
      );
    // Look past "× 400 g" to the can being counted.
    const sizedAfter = /^\s*[x×]\s*\d+\s*(?:kg|g|ml|l)\b/i.exec(rest)?.[0] ?? '';
    rest = sizedAfter + agree(rest.slice(sizedAfter.length), top, parse(high ?? low));
    text = head + shown + rest;
    amount.lastIndex = head.length + shown.length;
  }
  return text;
}

// ---------------------------------------------------------------------------

/** How a recipe scales: how many it serves as written. */
export interface Scale {
  slug: string;
  /** People, or null if the recipe doesn't say (then it's scaled by batches). */
  serves: number | null;
}

export const MAX_SERVINGS = 20;

/** "4–6" counts as 4. */
export const servesNumber = (serves: string | null): number | null => (serves ? parseInt(serves, 10) : null);
