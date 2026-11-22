# From Scratch: Spec

> A personal recipe website that looks like a real, pretty recipe book lying on a sunlit kitchen bench. Visitors flip through it page by page. Adding a recipe means adding one folder.

This describes the site as built. The page turning is the engine from asmimitra.com.

---

## 1. The experience

- The whole screen is a **background photo** (`public/images/table.png`): a top-down oak bench with peonies, a latte, strawberries, a gold whisk and a pink cloth, lit from the top-left. Full-screen (`cover`), with a soft dark vignette at the edges.
  - The file can be `table.jpg`, `.jpeg`, `.png` or `.webp`. The build makes a compressed WebP copy (max 2400px wide).
  - With no photo, a soft cream-marble CSS gradient shows instead.
- In the centre is **one hardcover book** with cloth boards, a spine crease, page-edge thickness that shifts as you read, a soft shadow, and shading where pages curve into the spine.
- **Turning pages:**
  - click or tap the left or right page edge
  - drag or swipe a page
  - ← and → keys
- The **front cover is stiff board** and swings open. Click anywhere on it. Every other page, including the back cover, curls like paper.
- Pressing links, buttons or tick boxes never turns the page. On touch screens you can still swipe from an ingredient.
- A soft **page-turn sound**, made in the browser (no audio file). Off by default, with a toggle.
- No page-number boxes or "open the book" buttons around the book. Page numbers are only in the page corners.

### Look
- Cream paper with a faint texture. **Every text page of a recipe or basic is ruled** (ingredients, method, notes). Photo pages, contents, chapter lists and the index are plain.
- Titles in *Caveat Brush*; chapter names and section headings in *Amatic SC*; everything handwritten in *Patrick Hand*; buttons and filters in *Lora*.
- **Photos** are taped-in prints: white border, a steady tilt of up to ±2° per recipe, soft shadow, and a strip of patterned washi tape (blush, sage, peach or gold) across one top corner. The tape never touches the recipe's name.
- Small CSS/SVG decorations: gingham corners, hearts, sparkles, washi behind section headings.
- No illustrations, status stamps or attempts log.

---

## 2. Book structure

1. **Front cover:** terracotta cloth, gold foil frame, title, whisk-and-heart motif, subtitle and author.
2. **Inside cover:** pink gingham with the dedication on a card, held by **blue gingham tape**.
3. **Contents:** chapters, Kitchen Basics and Index, with icons and page numbers. Clickable.
4. **Each chapter:**
   - a divider with the name, icon, blurb, recipe count and a watercolour-style wash in the chapter colour
   - "In this chapter": its recipes, grouped by course, with times and page numbers
   - the recipes, sorted by course, then A to Z
5. **Kitchen Basics:** skills rather than dishes. Shown only if there are any.
6. **Index:** every recipe, A to Z. Clickable.
7. **Back cover**, with a link to the front. If the page count needs it, a gingham endpaper comes before it.

Pages **flow straight on with no blank pages**. A recipe starts on the next page, left or right, so a photo can land on the right with its ingredients overleaf.

### A recipe
- **Photo page:** region (or chapter) and course, title, photo, info strip, up to 6 tags, and **Cook mode** and **Copy link** buttons.
  - With no photo: an empty taped-in frame saying "photo coming soon".
  - Info strip: time · serves · level · diet. Missing facts are left out.
- **Text pages:** ingredients with tick boxes, then the numbered method, then notes directly under the method.
- **Long recipes carry on** to more pages, with "Recipe name, continued" at the top. Text is measured at its real size, so it is never cut off, shrunk or allowed to overflow. Headings stay with what follows, and the method's last step moves along with the notes when they don't fit.
- Ticks are shared with cook mode and reset on reload.

### Changing the servings
- **− and + around the serves number** under the photo, from 1 to 20. In cook mode it's under the title. A recipe with no `serves` scales in batches (× 1, × 2).
- All ingredient amounts update: fractions, ranges, grams to kg, plurals ("1 potato" → "3 potatoes"), cans ("400 g can" → "3 × 400 g cans") and "makes 2 muffins".
- Not changed: sizes, times, percentages, "a pinch", and anything without a number.
- The method isn't scaled. Once the servings change, its heading says "written for 1" (or whatever the recipe serves).
- The choice resets on reload. Pages leave room for the longest version of each line, so scaling never causes overflow.
- The control sits mid-strip with a safe margin, so a near miss doesn't turn the page, and turning a page doesn't change the number.

### Chapter tabs
One coloured tab per chapter (and Basics) on the right edge. The current chapter's tab sticks out further. They move to the left edge when the book is closed on its back cover. On phones they are unlabelled slips of colour.

---

## 3. Finding recipes

- A **note-card toolbar** above the book: home, search, Filters, Surprise me, Contents, sound.
- **Search** by name, ingredient, tag or region. Name matches come first.
- **Filters:** cuisine, course, diet, difficulty and maximum time. Cuisine, course, diet and difficulty list only values some recipe has.
- **Results** are taped recipe cards: a fan for up to 6, a gently tilted grid for more, a list on phones and upright tablets. Choosing one flips to that recipe.
- **Cook mode** (`/#/recipes/<slug>/cook`): large, single-column text with A− / A+, servings and tick boxes. Keeps the screen awake where supported. Esc or the button returns to the book.
- **Addresses:** every recipe, basic and chapter has its own (`/#/recipes/dal-makhani`), kept in step as you flip. The back button works.
- **Copy link** copies the shareable page (`/recipes/<slug>/`), which shows a preview card and then opens the book there.

---

## 4. Screen sizes

- **Landscape, 900px and wider:** a two-page spread with the background around it.
- **Portrait, or narrower than 900px:** one page at a time. Swipe or tap edges; a round search button opens search, filters, Surprise me, sound and chapters as a sheet.
- **Phones (narrower than 600px):** a narrower page, so the writing is bigger on screen.

---

## 5. Adding a recipe

One folder in `content/recipes/` with one Markdown file and one photo. Nothing else to edit.

```
content/recipes/
  dal-makhani/
    recipe.md
    photo.jpg      # any name; jpg, jpeg, png or webp
```

```markdown
---
title: Dal Makhani
cuisine: North Indian    # a chapter in content/chapters.yaml, or one of its regions
course: Mains            # Breakfast | Mains | Sides | Snacks | Soups & Salads | Desserts | Baking | Drinks
diet: Vegetarian         # Vegetarian | Vegan | Chicken | Seafood | Egg
serves: 1                # also 4-6
time: 75                 # total minutes; also "1 hr 15 min"
difficulty: Medium       # Easy | Medium | Hard
tags: [comfort food, creamy]
---

## Ingredients
- 1/4 cup whole black urad dal

## Method
1. Rinse the dal.

## Notes
Optional tips.
```

- Only `title` and `cuisine` are required.
- **A region as the cuisine** (`cuisine: Indo-Chinese`) files the recipe in that region's chapter and shows the region on its page.
- The **folder name** becomes the web address.
- `###` headings group ingredients. "Directions", "Instructions" and "Steps" count as Method; "Tips" and "My notes" as Notes. `## Ingredients (makes 2 muffins)` works.
- **Forgiving:** capitals don't matter, colons in titles are fine, tags can be a comma list, unknown fields are ignored, and code fences around AI-written files are removed. Dozens of folders can be added at once.
- `content/recipes/_TEMPLATE/` is ignored by the build.
- `python scripts/new_recipe.py "Dal Makhani"` makes the folder from the template. It never overwrites one.

### Photos
The first image in the folder is found automatically, turned upright, and saved as WebP (800 and 1600px) and JPEG (for link previews). Location data is not kept in the copies. A missing, broken or `.heic` photo never stops the build.

### Mistakes

| Problem | Result |
|---|---|
| A wrong value, missing cuisine, unreadable settings or no Markdown file | That recipe is **skipped** with a friendly warning and a suggestion. The rest is published. |
| A missing title, or a mistake in `site.yaml` or `chapters.yaml` | The build **stops**. The live site stays as it was. |
| A misspelled heading or field name, or a photo problem | A **warning** only. |

Example: *"dal-tadka: cuisine 'Indain' isn't a chapter. Did you mean 'Indian'?"*

`npm run check` reports everything without building, and fails if anything would be skipped.

### Chapters, basics and wording
- `content/chapters.yaml`: order, name, colour and emoji icon, plus optional tab label, blurb and regions. Adding a chapter means adding one entry. Current chapters: Indian, Italian, Asian, Middle Eastern & Mediterranean, Mexican & Latin, Everyday & Western, Baking & Desserts, Drinks. Empty chapters still appear.
- `content/basics/`: the same folder format. Only `title` is required.
- `content/site.yaml`: title, subtitle, author, dedication, back-cover line, description, web address and colours.

---

## 6. How it's built

**Website:** React 18, TypeScript (strict), Vite, plain CSS, React Router (`HashRouter`), `page-flip`.

- `src/book/` turns pages and pours text into them. `src/pages/`, `src/toolbar/` and `src/cook/` are the pages, search and cook mode. `src/lib/scale.ts` scales amounts.
- A small fix makes "previous page" work in one-page mode, where `page-flip` otherwise ignores it.

**Content build:** Python 3.11+, run at build time only. Pydantic, python-frontmatter, markdown-it-py, PyYAML, Pillow.

- `scripts/build_content.py` checks everything and writes JSON and matching TypeScript types to `src/generated/`, and photos to `public/photos/`. Neither is committed.
- It also writes `dist/recipes/<slug>/index.html`, with title, description, Open Graph tags and Recipe JSON-LD, which redirects into the book.
- `npm run dev` builds the content, then rebuilds when `content/` or `public/images/` changes. Anything that stops the build shows over the page.

**Hosting:** GitHub Pages through `.github/workflows/deploy.yml`.

- Every push and pull request: Ruff, pytest, content build, ESLint, Prettier, scaling tests and site build. Pushes to `main` then deploy.
- Skipped recipes appear as warnings on the workflow.
- The base path comes from the repository name. Adding `public/CNAME` switches it to `/` for a custom domain, which is also set in GitHub's Pages settings.

Everything is static. No server, database, tracking or cookies.

---

## 7. Quality

- **Accessibility:** real text, keyboard controls, visible focus, alt text from the recipe title, page changes announced to screen readers. With reduced motion, pages fade instead of curling, and turn by edge, keys or links rather than swiping.
- **Speed:** only pages near the open ones are kept filled in, photos load lazily, and recipe data is its own file. Tried with a 124-recipe test book.
- **Tests:** pytest for the content build; Node's test runner for scaling amounts.
- The browser tab's title follows the page. The favicon is a whisk.
- The README is one short paragraph.
