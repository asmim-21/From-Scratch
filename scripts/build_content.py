#!/usr/bin/env python3
"""Turns the Markdown in ``content/`` into the files the website reads.

python scripts/build_content.py               build src/generated/
python scripts/build_content.py --check       only check for mistakes
python scripts/build_content.py --stubs dist  write the shareable link pages
"""

from __future__ import annotations

import argparse
import html
import json
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))

from content_parser import Content, Problems, load_content
from models import Basic, Chapter, Recipe, Section, Site
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# TypeScript types, produced from the Pydantic models
# ---------------------------------------------------------------------------


def ts_type(schema: dict[str, Any]) -> str:
    if "$ref" in schema:
        return str(schema["$ref"]).rsplit("/", 1)[-1]
    if "const" in schema:
        return json.dumps(schema["const"])
    if "enum" in schema:
        return " | ".join(json.dumps(v) for v in schema["enum"])
    if "anyOf" in schema:
        return " | ".join(ts_type(s) for s in schema["anyOf"])
    kind = schema.get("type")
    if kind == "array":
        return f"Array<{ts_type(schema.get('items', {}))}>"
    simple = {
        "string": "string", "integer": "number", "number": "number",
        "boolean": "boolean", "null": "null",
    }  # fmt: skip
    return simple.get(str(kind), "unknown")


def ts_types(models: list[type[BaseModel]]) -> str:
    found: dict[str, dict[str, Any]] = {}
    for model in models:
        schema = model.model_json_schema(mode="serialization", ref_template="#/$defs/{model}")
        found.update(schema.pop("$defs", {}))
        found[model.__name__] = schema
    lines = ["// Made by scripts/build_content.py from scripts/models.py. Don't edit by hand.", ""]
    for name in sorted(found):
        lines.append(f"export interface {name} {{")
        for prop, schema in found[name].get("properties", {}).items():
            lines.append(f"  {prop}: {ts_type(schema)};")
        lines += ["}", ""]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Writing files
# ---------------------------------------------------------------------------


def write_if_changed(path: Path, text: str) -> None:
    """Leaves unchanged files alone, so the dev server doesn't reload for nothing."""
    if path.is_file() and path.read_text(encoding="utf-8") == text:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_generated(content: Content, out: Path) -> None:
    files: dict[str, Any] = {
        "recipes.json": [r.model_dump() for r in content.recipes],
        "basics.json": [b.model_dump() for b in content.basics],
        "chapters.json": [c.model_dump() for c in content.chapters],
        "site.json": content.site.model_dump(),
    }
    for name, data in files.items():
        write_if_changed(out / name, json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    write_if_changed(out / "types.ts", ts_types([Recipe, Basic, Chapter, Site]))


def section_lines(sections: list[Section], key: str) -> list[str]:
    """The items in a section's lists."""
    return [
        "".join(i.text for i in b.text)
        for s in sections
        if s.key == key
        for b in s.blocks
        if b.kind in ("item", "step") or (key == "method" and b.kind == "para")
    ]


def recipe_json_ld(recipe: Recipe, site: Site, url: str, image: str) -> dict[str, Any]:
    data: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": recipe.title,
        "description": describe(recipe),
        "url": url,
        "image": [image],
        "author": {"@type": "Person", "name": site.author} if site.author else None,
        "recipeCuisine": recipe.region or recipe.cuisine,
        "recipeCategory": recipe.course,
        "recipeYield": f"{recipe.serves} servings" if recipe.serves else None,
        "totalTime": f"PT{recipe.time}M" if recipe.time else None,
        "keywords": ", ".join(recipe.tags) or None,
        "recipeIngredient": section_lines(recipe.sections, "ingredients") or None,
        "recipeInstructions": [
            {"@type": "HowToStep", "text": t} for t in section_lines(recipe.sections, "method")
        ]
        or None,
        "suitableForDiet": {
            "Vegetarian": "https://schema.org/VegetarianDiet",
            "Vegan": "https://schema.org/VeganDiet",
        }.get(recipe.diet or ""),
    }
    return {k: v for k, v in data.items() if v is not None}


def describe(recipe: Recipe) -> str:
    """A line for link previews, e.g. 'North Indian · Mains · 45 min · serves 4'."""
    bits = [
        recipe.region or recipe.cuisine,
        recipe.course if recipe.course != recipe.cuisine else None,
        f"{recipe.time} min" if recipe.time else None,
        f"serves {recipe.serves}" if recipe.serves else None,
    ]
    return " · ".join(b for b in bits if b)


def stub_page(recipe: Recipe, site: Site) -> str:
    url = f"{site.url}recipes/{recipe.slug}/"
    picture = recipe.photo.jpg if recipe.photo else "/images/og.jpg"
    image = site.url + picture.lstrip("/")
    title = f"{recipe.title} · {site.title}"
    description = describe(recipe)
    esc = html.escape
    # "</script>" inside a recipe must not end the script early.
    ld = json.dumps(recipe_json_ld(recipe, site, url, image), ensure_ascii=False)
    ld = ld.replace("<", "\\u003c")
    target = f"../../#/recipes/{recipe.slug}"
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(description)}" />
    <link rel="canonical" href="{esc(url)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="{esc(site.title)}" />
    <meta property="og:title" content="{esc(recipe.title)}" />
    <meta property="og:description" content="{esc(description)}" />
    <meta property="og:url" content="{esc(url)}" />
    <meta property="og:image" content="{esc(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">{ld}</script>
    <meta http-equiv="refresh" content="0; url={esc(target)}" />
    <script>location.replace({json.dumps(target)});</script>
  </head>
  <body>
    <p><a href="{esc(target)}">Open {esc(recipe.title)} in the book</a></p>
  </body>
</html>
"""


def write_stubs(content: Content, dist: Path) -> None:
    for recipe in content.recipes:
        path = dist / "recipes" / recipe.slug / "index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(stub_page(recipe, content.site), encoding="utf-8")


# ---------------------------------------------------------------------------


def say(label: str, message: str) -> None:
    print(f"  {label}  {message}", file=sys.stderr)
    if os.environ.get("GITHUB_ACTIONS"):
        # Shows up on the workflow's summary page, so a skipped recipe isn't missed.
        print(f"::warning title=Recipe book::{label}: {message}")


def main(argv: list[str] | None = None, root: Path = ROOT) -> int:
    parser = argparse.ArgumentParser(description="Build the recipe book's content.")
    parser.add_argument("--check", action="store_true", help="check only, don't write files")
    parser.add_argument("--stubs", metavar="DIR", help="write the shareable link pages into DIR")
    args = parser.parse_args(argv)

    problems = Problems()
    content = load_content(root, problems, write=not args.check)

    # The link pages are a second pass over the same content: don't repeat ourselves.
    if not args.stubs:
        for warning in problems.warnings:
            say("note", warning)
        for reason in problems.skipped:
            say("SKIPPED", reason)
    if content is None:
        count = len(problems.errors)
        thing = "thing needs" if count == 1 else "things need"
        print(f"\n{count} {thing} fixing before the book can be built:\n", file=sys.stderr)
        for error in problems.errors:
            print(f"  ✗  {error}", file=sys.stderr)
        print(file=sys.stderr)
        return 1

    summary = f"{len(content.recipes)} recipes, {len(content.basics)} basics, "
    summary += f"{len(content.chapters)} chapters"
    if args.check:
        if problems.skipped:
            print(f"\nChecked {summary}. The skipped ones above won't appear in the book.")
            return 1
        print(f"All good: {summary}.")
        return 0
    if args.stubs:
        write_stubs(content, root / args.stubs)
        print(f"Wrote link pages for {len(content.recipes)} recipes.")
        return 0
    write_generated(content, root / "src" / "generated")
    print(f"Built {summary}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
