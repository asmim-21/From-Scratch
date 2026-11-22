import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scaleText } from '../src/lib/scale.ts';

const cases: Array<[text: string, factor: number, expected: string]> = [
  ['1 cup water', 1, '1 cup water'],
  ['1 cup water', 2, '2 cups water'],
  ['1/2 cup water', 2, '1 cup water'],
  ['1/2 cup water', 3, '1 1/2 cups water'],
  ['1 1/2 tsp pav bhaji masala', 2, '3 tsp pav bhaji masala'],
  ['1½ cups water', 2, '3 cups water'],
  ['½ tsp salt', 3, '1 1/2 tsp salt'],
  ['1/3 cup milk', 2, '2/3 cup milk'],
  ['1/4 tsp salt and a pinch of pepper', 6, '1 1/2 tsp salt and a pinch of pepper'],
  ['1–2 tbsp milk', 3, '3–6 tbsp milk'],
  ['2 to 3 cloves garlic', 2, '4 to 6 cloves garlic'],
  ['100 g spaghetti', 4, '400 g spaghetti'],
  ['200g spaghetti', 2, '400g spaghetti'],
  ['200 g flour', 6, '1.2 kg flour'],
  ['1,000 g flour', 2, '2 kg flour'],
  ['500 ml milk', 4, '2 L milk'],
  ['2.5 g yeast', 2, '5 g yeast'],
  ['1 egg', 4, '4 eggs'],
  ['1 egg yolk', 2, '2 egg yolks'],
  [
    '1 frozen banana, sliced (peel it before freezing)',
    2,
    '2 frozen bananas, sliced (peel it before freezing)',
  ],
  ['1 medium potato, peeled and chopped', 3, '3 medium potatoes, peeled and chopped'],
  ['1/2 small onion, chopped', 2, '1 small onion, chopped'],
  ['1/4 capsicum, thinly sliced', 8, '2 capsicums, thinly sliced'],
  ['1 clove garlic, chopped', 2, '2 cloves garlic, chopped'],
  [
    '1 portion hakka or egg-free noodles (about 80 g dried)',
    2,
    '2 portions hakka or egg-free noodles (about 160 g dried)',
  ],
  ['2 medium carrots (about 200 g), peeled', 2, '4 medium carrots (about 400 g), peeled'],
  [
    '1 tbsp beaten egg (beat 1 egg and use about a third)',
    2,
    '2 tbsp beaten egg (beat 2 eggs and use about a third)',
  ],
  ['1 tbsp onion', 2, '2 tbsp onion'],
  [
    '1 bay leaf, 2 cloves, 2 green cardamom pods, 1 small piece cinnamon',
    2,
    '2 bay leaves, 4 cloves, 4 green cardamom pods, 2 small pieces cinnamon',
  ],
  ['2 orange slices, 2 apple slices, a few berries', 2, '4 orange slices, 4 apple slices, a few berries'],
  ['2 slices cheddar, or 1/2 cup grated cheddar', 2, '4 slices cheddar, or 1 cup grated cheddar'],
  ['pinch of saffron soaked in 1 tbsp warm milk', 4, 'pinch of saffron soaked in 4 tbsp warm milk'],
  ['400 g can whole or crushed tomatoes', 2, '2 × 400 g cans whole or crushed tomatoes'],
  ['2 x 400 g cans tomatoes', 2, '4 x 400 g cans tomatoes'],
  ['1 x 400 g can tomatoes', 2, '2 x 400 g cans tomatoes'],
  ['1 tin (400 g) whole tomatoes', 2, '2 tins (400 g) whole tomatoes'],
  ['200 g canned tomatoes (half a 400 g can)', 2, '400 g canned tomatoes (1 × 400 g can)'],
  ['200 g canned tomatoes (half a 400 g can)', 3, '600 g canned tomatoes (1 1/2 × 400 g cans)'],
  ['makes 2 muffins', 3, 'makes 6 muffins'],
  // Not amounts
  ['a 2 cm piece of ginger', 3, 'a 2 cm piece of ginger'],
  ['70% dark chocolate', 2, '70% dark chocolate'],
  ['1 cup 00 flour', 2, '2 cups 00 flour'],
  ['an 8-inch tortilla', 2, 'an 8-inch tortilla'],
  ['a splash of 7up', 2, 'a splash of 7up'],
  ['pinch of salt', 5, 'pinch of salt'],
  // Down again
  ['2 eggs', 1 / 2, '1 egg'],
  ['4 cups stock', 1 / 4, '1 cup stock'],
  ['1 tsp salt', 1 / 6, '0.17 tsp salt'],
];

for (const [text, factor, expected] of cases) {
  test(`${text} × ${factor}`, () => assert.equal(scaleText(text, factor), expected));
}
