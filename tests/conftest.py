import shutil
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent

GOOD = """---
title: Test Soup
cuisine: Indian
---

## Ingredients
- 1 onion
"""


@pytest.fixture
def book(tmp_path):
    """A tiny copy of the project with one good recipe."""
    content = tmp_path / "content"
    (content / "basics").mkdir(parents=True)
    for name in ("site.yaml", "chapters.yaml"):
        shutil.copy(REPO / "content" / name, content / name)
    shutil.copytree(REPO / "content/recipes/_TEMPLATE", content / "recipes/_TEMPLATE")
    (content / "recipes/test-soup").mkdir()
    (content / "recipes/test-soup/recipe.md").write_text(GOOD)
    return tmp_path


@pytest.fixture
def recipe(book):
    """Writes a recipe folder, with the given replacements made to the good one."""

    def write(*swaps, name="test-soup"):
        text = GOOD
        for old, new in swaps:
            assert old in text
            text = text.replace(old, new)
        folder = book / "content/recipes" / name
        folder.mkdir(exist_ok=True)
        (folder / "recipe.md").write_text(text)
        return book

    return write
