#!/usr/bin/env python3
"""Starts a new recipe from the template:  python scripts/new_recipe.py "Dal Tadka" """

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from content_parser import slugify

ROOT = Path(__file__).resolve().parent.parent
# Optional fields to leave blank. Their comments stay, since they list the choices.
OPTIONAL = ("course", "diet", "serves", "time", "difficulty", "tags")


def fill_template(template: str, title: str) -> str:
    """Puts in the title and leaves the optional fields blank."""
    quoted = '"' + title.replace("\\", "\\\\").replace('"', '\\"') + '"'
    text = re.sub(r"^title:.*$", lambda _: f"title: {quoted}", template, flags=re.M)
    for name in OPTIONAL:
        text = re.sub(
            rf"^{name}:([^#\n]*)",
            lambda m, name=name: f"{name}:" + " " * max(1, len(m[1])),
            text,
            flags=re.M,
        )
    settings = text.split("\n## ", 1)[0].rstrip()
    settings = re.sub(r"[ \t]+$", "", settings, flags=re.M)
    return settings + "\n\n## Ingredients\n- \n\n## Method\n1. \n\n## Notes\n"


def main(argv: list[str], root: Path = ROOT) -> int:
    title = " ".join(argv).strip()
    slug = slugify(title)
    if not slug:
        print('Tell me the recipe\'s name, like this:\n  python scripts/new_recipe.py "Dal Tadka"')
        return 1
    recipes = root / "content" / "recipes"
    folder = recipes / slug
    if folder.exists():
        print(f"There's already a folder at {folder.relative_to(root)}. I haven't changed it.")
        return 1
    template = (recipes / "_TEMPLATE" / "recipe.md").read_text(encoding="utf-8")
    folder.mkdir(parents=True)
    (folder / "recipe.md").write_text(fill_template(template, title), encoding="utf-8")
    print(f"Created {folder.relative_to(root)}/recipe.md")
    print("Fill it in, then drop a photo into the same folder.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
