# From Scratch

A personal recipe website that looks like a real recipe book you can flip through, built with React, TypeScript and a small Python content build. Each recipe is one folder in `content/recipes/` holding a `recipe.md` and a photo; the book's words and colours are in `content/site.yaml`. To run it: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && npm install` once, then `npm run dev`. `npm run check` looks for mistakes in recipes, and every push to `main` publishes the site to GitHub Pages.
