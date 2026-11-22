# From Scratch — Build Spec

> A personal recipe website that looks like a real, pretty recipe book lying open on a girly kitchen benchtop. Visitors flip through it page by page. Adding a new recipe should take one small text file and nothing else.

Please build this as a complete, deployable project. Read this whole document before starting.

---

## 1. The experience (what it should feel like)

- The whole screen is a **background photo** at `public/images/table.jpg`: a top-down shot of a clean, girly kitchen benchtop (cream marble, blush pink, soft gold, natural light from the top-left) with an empty centre. Use it full-screen (`background-size: cover`) with a subtle dark vignette at the edges so the book stands out. If the file is missing, fall back to a soft cream-marble CSS gradient.
- In the centre sits **one open hardcover recipe book**. It has a visible spine, page thickness on the edges, a soft shadow under it, and a slight curve where the pages meet the spine.
- The user **flips pages** with a realistic page-curl animation. They can:
  - click or tap the right and left page edges
  - drag or swipe a page corner
  - use the ← → arrow keys
- Subtle paper-turn sound on flip. It's **off by default**, with a small mute/unmute toggle.
- The book opens on its **cover** and the cover swings open on the first click.

### Visual references
The pages should look like a pretty, handwritten recipe journal (no illustrations needed, since all decoration is done in CSS/SVG by you):
- cream or off-white paper with a faint texture (lined on some pages, plain on others)
- hand-lettered-style titles in a warm colour (tomato red, terracotta, or burnt orange)
- ingredients and steps in a neat handwriting-style font
- each recipe shows its **photo** styled like a printed photo stuck into the book: a thin white border, a slight random tilt (±2°), a soft shadow, and a washi-tape strip across the top corner
- small decorative details drawn in CSS/SVG: washi-tape strips, a gingham corner, little hearts or sparkles, in a palette of blush pink, cream, soft peach, gold and sage

It should look **charming and polished, not messy**. Keep it clean, generous with white space, and easy to read.

---

## 2. Tech stack

**Frontend: React + TypeScript, built with Vite**
- React 18+ with TypeScript in strict mode
- **StPageFlip** (`page-flip` on npm, or `react-pageflip`) for the page-turn effect. If a different flipbook library is clearly better maintained, use it and explain why.
- CSS Modules (or plain CSS). No heavy UI component library is needed.
- React Router in **`HashRouter`** mode, so deep links like `/#/recipes/dal-tadka` work on GitHub Pages without server rewrites

**Content pipeline: Python 3.11+**
GitHub Pages only serves static files, so Python runs at **build time**, never on the live site:
- `scripts/build_content.py` reads every Markdown file in `content/recipes/` and `content/basics/`, parses the frontmatter and body, **validates it with Pydantic**, and writes `src/generated/recipes.json` (plus `basics.json` and `chapters.json`) for React to import.
- It parses the Markdown body into sections (Ingredients, Method, Notes) so React can render each one in its own place on the page.
- It also generates a small static HTML stub per recipe (`dist/recipes/<slug>/index.html`) carrying that recipe's `<title>`, meta description, Open Graph tags and Recipe JSON-LD, then redirecting to `/#/recipes/<slug>`. That way, shared links show a proper preview card.
- `scripts/new_recipe.py "Dal Tadka"` is a tiny helper that creates `content/recipes/dal-tadka.md` from the template with today's date filled in.
- Dependencies are kept minimal (`python-frontmatter`, `pydantic`, `markdown-it-py` or similar) and listed in `requirements.txt`.
- Generate TypeScript types that match the Pydantic models (`src/generated/types.ts`, produced by the script) so the frontend and the content can't drift apart.

**Hosting: GitHub Pages via GitHub Actions**
- A `.github/workflows/deploy.yml` workflow runs on every push to `main`: set up Python, run `build_content.py`, set up Node, `npm ci`, `npm run build`, deploy `dist/` to GitHub Pages.
- If content validation fails, the workflow fails before deploying, so a broken recipe never goes live.
- Set Vite's `base` correctly for a GitHub Pages project site, and make it easy to switch to a custom domain later (with a `CNAME` file and `base: '/'`).
- Fonts from Google Fonts:
  - Titles: a script or hand-lettered display font (e.g. *Caveat Brush*, *Amatic SC*, or *Playfair Display Italic*). Pick what looks closest to the references.
  - Body: a readable handwriting font (e.g. *Caveat*, *Kalam*, or *Patrick Hand*)
  - UI elements (buttons, filters): a clean serif or sans
- Everything must be **static**: no database and no server.

---

## 3. Adding a recipe: one folder, that's it

**Maintenance must be dead simple.** To add a recipe I create **one folder** in `content/recipes/`, put **one Markdown file and one photo** in it, and push. Nothing else, ever: no other files to edit, no image paths to type, and no separate images folder.

```
content/recipes/
  dal-tadka/
    recipe.md
    photo.jpg        # any image file in the folder works (jpg, jpeg, png, webp)
  masala-chai/
    recipe.md
    photo.png
```

- The **folder name is the URL slug** (`/recipes/dal-tadka`).
- The **photo is found automatically.** The build uses the first image file in the folder, whatever its name, so I never reference it in the Markdown. If a folder has no image, the recipe still renders with a placeholder.
- The Python build copies each photo into the site output, auto-resizes it (Pillow, max ~1600px wide, plus a WebP version) and handles large phone photos without complaint.
- A recipe folder with an obvious problem should not stop the whole site from building, unless the problem is a missing title. Skip it with a clear warning instead.

### `recipe.md` format

Keep the frontmatter **short**. Only `title` and `cuisine` are required, and everything else is optional with sensible defaults:

```markdown
---
title: Dal Tadka
cuisine: Indian          # must match a chapter in content/chapters.yaml
course: Mains            # optional: Breakfast | Mains | Sides | Snacks | Soups & Salads | Desserts | Baking | Drinks
diet: Vegetarian         # optional: Vegetarian | Vegan | Chicken | Seafood | Egg
serves: 4                # optional
time: 40                 # optional, total minutes
difficulty: Easy         # optional: Easy | Medium | Hard
tags: [comfort food, one pot]   # optional
---

## Ingredients
- 1 cup toor dal
- 1 tsp turmeric

## Method
1. Rinse the dal until the water runs clear.
2. ...

## Notes
Optional tips.
```

Rules:
- Validate with **Pydantic models** in `scripts/models.py`. Matching should be **case-insensitive and forgiving** (`indian`, `Indian` and `INDIAN` all work). On a real mistake, print a friendly message naming the folder and field and suggesting the closest valid value (e.g. *"dal-tadka: cuisine 'Indain' isn't a chapter. Did you mean 'Indian'?"*).
- `python scripts/build_content.py --check` validates everything without building.
- `python scripts/new_recipe.py "Dal Tadka"` creates the folder and a pre-filled `recipe.md`. Then I just drop the photo in.
- Include a `content/recipes/_TEMPLATE/recipe.md` that the build ignores.
- The format must be easy to **bulk-generate**: I'll be adding a large batch of recipes at once (Markdown files produced by an AI assistant), so the parser must handle dozens of new folders in one push without any manual steps.

### Chapters config
`content/chapters.yaml` defines the book's chapters, their order, divider colour and an emoji or simple icon. Starting set:

1. **Indian** (with sub-regions: North Indian, South Indian, Bengali, Street Food, Indo-Chinese)
2. **Italian**
3. **Asian** (Chinese, Japanese, Thai, Korean, etc.)
4. **Middle Eastern & Mediterranean**
5. **Mexican & Latin**
6. **Everyday & Western** (breakfasts, sandwiches, salads, simple dinners)
7. **Baking & Desserts**
8. **Drinks** (chai, coffees, smoothies, lattes)

Adding a new chapter = adding one entry to this file.

---

## 4. Book structure (page order)

1. **Front cover**: cloth-textured hardcover in a warm colour (terracotta or deep olive) with the title **From Scratch** foil-stamped or hand-lettered, plus the subtitle *"a kitchen notebook — Asmi"*. Add a small simple SVG motif (e.g. a whisk and a heart).
2. **Inside cover / dedication page**: a short handwritten note: *"I couldn't cook when I started this book. Every page is something I learned."* Make this text easy to edit in one config file.
3. **Contents**: lists every chapter with page numbers. **Each entry is clickable** and flips the book to that chapter.
4. **For each chapter:**
   - a **chapter divider page** with the chapter name in large lettering, a soft colour wash background in the chapter colour, and the number of recipes in it
   - then every recipe in that chapter, sorted by `course` then alphabetically
5. **Kitchen Basics** (a back section): a chapter for skills I've learned rather than dishes, like "How to chop an onion", "How to make perfect rice" or "What is a tadka". These are Markdown files in `content/basics/` using the same one-folder format (`recipe.md` plus an optional photo).
6. **Index**: an alphabetical list of all recipes. Clickable.
7. **Back cover**.

### Recipe page layout
Each recipe takes a **two-page spread**, like the references:
- **Left page:** title, the taped-in photo, and a small info strip (serves · prep · cook · difficulty · diet icon)
- **Right page:** ingredients (with small checkboxes I can tick while cooking; these are visual only and reset on reload), then the numbered method, then "Notes" if present
- **Page numbers** at the bottom corners
- If a recipe's content is too long for one spread, **automatically continue it onto the next spread** rather than cutting it off or shrinking the text. Never let text overflow the page.

### Coloured tabs on the page edge
Like the sticky tabs on a real recipe binder, show **one coloured tab per chapter** sticking out from the right edge of the book. Clicking a tab flips straight to that chapter.

---

## 5. Finding recipes (outside the book)

A small, elegant **toolbar** sits above or below the book (it can look like a ribbon bookmark or a little note card). It has:
- **Search** by recipe name, ingredient or tag
- **Filters**: cuisine, course, diet (Vegetarian / Chicken / etc.), difficulty, max total time
- Results appear as a **fanned stack of recipe cards** on the benchtop (or a simple overlay list on mobile). Clicking one flips the book to that recipe.
- A **"Surprise me"** button that flips to a random recipe
- A **"Cook mode"** button on each recipe that opens a clean, large-text, single-column version of that recipe (no flipbook) that's easy to follow while cooking on a phone or tablet, and keeps the screen awake using the Wake Lock API where supported

Every recipe also needs its **own shareable URL** (`/#/recipes/dal-tadka`, plus the pretty `/recipes/dal-tadka/` stub that redirects to it) that opens the book directly at that spread, so I can send a link to a specific recipe.

---

## 6. Responsive behaviour

- **Desktop / large tablet (landscape):** a two-page spread, background visible.
- **Tablet portrait / mobile:** show **one page at a time** (single-page flip mode), the book filling most of the screen, swipe to turn, toolbar collapsed into a small floating button.
- It must be fully usable on an iPhone.

---

## 7. Quality requirements

- **Accessibility:** everything works with the keyboard, recipe text is real HTML text (not images), images have alt text (use the recipe title if none given), and colour contrast is readable. Respect `prefers-reduced-motion` by fading instead of curling pages.
- **Performance:** lazy-load photos, only mount pages near the current spread, and keep the first load fast even with 100+ recipes.
- **SEO / link previews:** handled by the per-recipe HTML stubs from the Python build (title, description, Open Graph image and **Recipe schema.org JSON-LD**). Also update `document.title` in React as the user flips.
- **Code quality:** ESLint + Prettier for TypeScript, Ruff for Python, and a few `pytest` tests for the content parser and validation errors. Run the linters and tests in CI before deploying.
- Favicon: a tiny whisk or spoon.
- No tracking or cookies.

---

## 8. Starter content

Seed the book so it doesn't look empty:
- 3 sample recipes: **Dal Tadka** (Indian, Vegetarian), **Masala Chai** (Drinks), **Spaghetti Pomodoro** (Italian, Vegetarian)
- 1 Kitchen Basics entry: **How to cook basmati rice**
- No photos in the seed recipes. Show the placeholder, a blank taped-in photo frame with a small "photo coming soon" note.

---

## 9. Documentation

Include a **README.md** written for a beginner, covering:
1. How to run the site locally (step-by-step commands: create a Python venv, `pip install -r requirements.txt`, `npm install`, then a single `npm run dev` that runs the Python content build first and **re-runs it automatically when a Markdown file changes**)
2. **How to add a new recipe**, as a 3-step checklist (run `new_recipe.py` or copy the template, fill it in, commit and push)
3. How to add or change a recipe photo (just drop it in the folder)
4. How to add a new chapter / cuisine
5. How to change the cover text, dedication and colours (all in one `content/site.yaml` file)
6. How GitHub Pages deployment works, including the one-time repo setting (Settings → Pages → Source: GitHub Actions) and how to add a custom domain later

---

## 10. Deliverables checklist

- [ ] React + TypeScript (Vite) frontend, builds with no errors or warnings
- [ ] Python content pipeline (`build_content.py`, `new_recipe.py`, Pydantic models, tests)
- [ ] GitHub Actions workflow that validates, builds and deploys to GitHub Pages
- [ ] Benchtop background and realistic open book
- [ ] Page-flip working on desktop (spread) and mobile (single page)
- [ ] Cover → dedication → contents → chapters → Kitchen Basics → index → back cover
- [ ] Clickable contents, index and chapter tabs
- [ ] Recipe spread layout with taped-in photos and automatic overflow continuation
- [ ] Search, filters, Surprise me and Cook mode
- [ ] Per-recipe shareable URLs
- [ ] Pydantic-validated frontmatter with friendly errors
- [ ] `_TEMPLATE.md`, 3 seed recipes and 1 basics entry
- [ ] Beginner-friendly README
- [ ] Deployment config
