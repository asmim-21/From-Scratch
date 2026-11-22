"""Reads the Markdown and YAML in ``content/`` and checks it, with friendly messages."""

from __future__ import annotations

import difflib
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, get_args

import frontmatter
import yaml
from markdown_it import MarkdownIt
from markdown_it.tree import SyntaxTreeNode
from models import (
    Basic,
    BasicMeta,
    Block,
    Chapter,
    ChapterConfig,
    Course,
    Inline,
    Recipe,
    RecipeMeta,
    Section,
    Site,
    SiteConfig,
    plain,
)
from photos import (
    find_background,
    find_photo,
    make_background,
    make_photo,
    remove_stale,
    unusable_photo,
)
from pydantic import BaseModel, ValidationError


@dataclass
class Problems:
    """Everything that needs telling to the person, gathered before stopping.

    errors    stop the site from building (a missing title, a broken settings file)
    skipped   leave one recipe out, with a reason
    warnings  worth knowing, but nothing is left out
    """

    errors: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class Content:
    site: Site
    chapters: list[Chapter]
    recipes: list[Recipe]
    basics: list[Basic]


def slugify(text: str) -> str:
    """'Crème Brûlée!' -> 'creme-brulee'"""
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    ascii_text = ascii_text.replace("'", "").replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def did_you_mean(value: object, options: list[str]) -> str:
    """The closest valid value, e.g. 'Indain' -> 'Indian', or '' if nothing is close."""
    by_plain = {plain(o): o for o in options}
    close = difflib.get_close_matches(plain(value), list(by_plain), n=1, cutoff=0.6)
    return by_plain[close[0]] if close else ""


# ---------------------------------------------------------------------------
# Friendly messages
# ---------------------------------------------------------------------------


def explain(err: ValidationError, where: str, model: type[BaseModel]) -> list[str]:
    """Turns Pydantic's errors into sentences a person can act on."""
    out = []
    for e in err.errors():
        loc = [str(p) for p in e["loc"]]
        name = ".".join(loc) if loc else "file"
        out.append(f"{where}: {_sentence(e, name, model)}")
    return out


def _sentence(e: Any, name: str, model: type[BaseModel]) -> str:
    kind, value, ctx = e["type"], e.get("input"), e.get("ctx", {})
    if kind == "missing":
        return f"'{name}' is missing. Every one needs a {name}."
    if kind == "extra_forbidden":
        hint = did_you_mean(name, list(model.model_fields))
        tail = f" Did you mean '{hint}'?" if hint else " Remove it, or check the examples."
        return f"'{name}' isn't a setting I know.{tail}"
    if kind == "literal_error":
        options = re.findall(r"'([^']+)'", ctx.get("expected", ""))
        hint = did_you_mean(value, options)
        tail = f" Did you mean '{hint}'?" if hint else ""
        return f"{name} '{value}' isn't one of the choices.{tail} Choose from: " + (
            ", ".join(options) + "."
        )
    if name == "time":
        return f"time should be the total minutes, like 40, but it says '{value}'."
    if name == "serves":
        return f"serves should be a number, like 4 or 4-6, but it says '{value}'."
    if kind.startswith("list"):
        return f"{name} should be a list, like [one, two]."
    if kind == "string_too_short":
        return f"{name} is empty."
    if kind == "string_too_long":
        return f"{name} is too long to fit on the page ({ctx['max_length']} characters at most)."
    if kind == "string_pattern_mismatch":
        return f"{name} '{value}' should be a colour code like \"#c8642c\", in quotes."
    if kind == "string_type":
        return f"{name} should be text, but it says '{value}'."
    if kind == "value_error":
        return f"{name} {ctx.get('error', e['msg'])}"
    return f"{name}: {e['msg']}."


def yaml_problem(err: yaml.YAMLError, where: str, first_line: int) -> str:
    mark = getattr(err, "problem_mark", None)
    line = f" near line {mark.line + first_line}" if mark else ""
    return (
        f"{where}: I couldn't read the settings{line}. Check for a missing quote, "
        'a tab instead of spaces, or a colon inside text that isn\'t in "quotes".'
    )


def _without_blanks(data: dict[str, Any]) -> dict[str, Any]:
    """`serves:` with nothing after it counts as leaving the field out."""
    return {
        str(k): v
        for k, v in data.items()
        if v is not None and not (isinstance(v, str) and not v.strip())
    }


# ---------------------------------------------------------------------------
# Markdown body -> sections
# ---------------------------------------------------------------------------

SECTION_NAMES = {
    "ingredients": "ingredients",
    "ingredient": "ingredients",
    "method": "method",
    "directions": "method",
    "instructions": "method",
    "steps": "method",
    "notes": "notes",
    "note": "notes",
    "my notes": "notes",
    "tips": "notes",
}
SAFE_LINK = re.compile(r"^(https?://|mailto:|#/)")


def _inlines(node: SyntaxTreeNode, style: dict[str, Any] | None = None) -> list[Inline]:
    style = style or {}
    out: list[Inline] = []
    for child in node.children:
        if child.type in ("text", "code_inline"):
            out.append(Inline(text=child.content, **style))
        elif child.type in ("softbreak", "hardbreak"):
            out.append(Inline(text=" ", **style))
        elif child.type == "strong":
            out += _inlines(child, {**style, "bold": True})
        elif child.type == "em":
            out += _inlines(child, {**style, "italic": True})
        elif child.type == "link":
            href = str(child.attrs.get("href", ""))
            out += _inlines(child, {**style, "href": href} if SAFE_LINK.match(href) else style)
        elif child.type != "image" and child.children:
            out += _inlines(child, style)
    return [i for i in out if i.text]


def _list_blocks(node: SyntaxTreeNode, depth: int) -> list[Block]:
    blocks: list[Block] = []
    ordered = node.type == "ordered_list"
    number = int(node.attrs.get("start", 1)) if ordered else 0
    for li in node.children:
        first = True
        for child in li.children:
            if child.type in ("bullet_list", "ordered_list"):
                blocks += _list_blocks(child, min(depth + 1, 3))
            elif child.type == "paragraph":
                kind = "step" if ordered and first else "item" if first else "para"
                blocks.append(
                    Block(
                        kind=kind,
                        text=_inlines(child.children[0]),
                        number=number if kind == "step" else None,
                        depth=depth if first else depth + 1,
                    )
                )
                first = False
        number += 1
    return blocks


def parse_body(text: str, where: str, problems: Problems) -> list[Section]:
    """Splits a Markdown body at its ## headings, and each section into blocks."""
    tree = SyntaxTreeNode(MarkdownIt("commonmark", {"html": False}).parse(text))
    sections: list[Section] = []
    current = Section(key="intro", title="", blocks=[])

    for node in tree.children:
        if node.type == "heading" and node.tag == "h1":
            continue  # the title again; the page already shows it
        if node.type == "heading" and node.tag == "h2":
            sections.append(current)
            title = "".join(i.text for i in _inlines(node.children[0])).strip().rstrip(":")
            key = SECTION_NAMES.get(plain(title))
            aside = re.fullmatch(r"(.+?)\s*\((.+)\)", title)
            extra = ""
            if key is None and aside and plain(aside[1]) in SECTION_NAMES:
                # "## Ingredients (makes 2 muffins)"
                title, extra = aside[1], aside[2]
                key = SECTION_NAMES[plain(title)]
            if key is None:
                hint = did_you_mean(title, ["Ingredients", "Method", "Notes"])
                if hint and _is_typo(title, hint):
                    problems.warnings.append(
                        f"{where}: I read the heading '## {title}' as '## {hint}'."
                    )
                    title, key = hint, SECTION_NAMES[hint.lower()]
            current = Section.model_validate({"key": key or "other", "title": title, "blocks": []})
            if extra:
                current.blocks.append(Block(kind="para", text=[Inline(text=extra)]))
        elif node.type == "heading":
            current.blocks.append(Block(kind="heading", text=_inlines(node.children[0])))
        elif node.type in ("bullet_list", "ordered_list"):
            current.blocks += _list_blocks(node, 0)
        elif node.type == "paragraph":
            current.blocks.append(Block(kind="para", text=_inlines(node.children[0])))
        elif node.type in ("fence", "code_block", "html_block"):
            current.blocks.append(Block(kind="para", text=[Inline(text=node.content.strip())]))
        elif node.type == "blockquote":
            for child in node.children:
                if child.type == "paragraph":
                    text_runs = _inlines(child.children[0], {"italic": True})
                    current.blocks.append(Block(kind="para", text=text_runs))
                elif child.type in ("bullet_list", "ordered_list"):
                    current.blocks += _list_blocks(child, 0)
        elif node.type != "hr":
            problems.warnings.append(f"{where}: I left out something I can't draw ({node.type}).")
    sections.append(current)

    for section in sections:
        section.blocks = [b for b in section.blocks if any(i.text.strip() for i in b.text)]
    return [s for s in sections if s.blocks]


def _is_typo(a: str, b: str) -> bool:
    return difflib.SequenceMatcher(None, plain(a), plain(b)).ratio() >= 0.8


# ---------------------------------------------------------------------------
# Settings files
# ---------------------------------------------------------------------------


def _read_yaml(path: Path, problems: Problems) -> Any:
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        problems.errors.append(f"{path.name}: I couldn't find this file in {path.parent.name}/.")
    except yaml.YAMLError as err:
        problems.errors.append(yaml_problem(err, path.name, 1))
    return None


def load_site(content: Path, public: Path, problems: Problems, *, write: bool) -> Site | None:
    data = _read_yaml(content / "site.yaml", problems)
    if not isinstance(data, dict):
        if data is not None:
            problems.errors.append("site.yaml: this should be a list of 'name: value' lines.")
        return None
    try:
        config = SiteConfig.model_validate(_without_blanks(data))
    except ValidationError as err:
        problems.errors += explain(err, "site.yaml", SiteConfig)
        return None
    background = _background(public, problems, write=write)
    site = Site.model_validate({**config.model_dump(), "background": background})
    cname = public / "CNAME"
    if cname.is_file() and cname.read_text().strip():
        site.url = f"https://{cname.read_text().split()[0]}/"
    return site


def _background(public: Path, problems: Problems, *, write: bool) -> str | None:
    found = find_background(public / "images")
    if not found:
        return None
    if len(found) > 1:
        names = " and ".join(p.name for p in found)
        problems.warnings.append(f"public/images: there's {names}. I used {found[0].name}.")
    try:
        return make_background(found[0], public / "photos", write=write)
    except Exception as err:
        problems.warnings.append(f"public/images: I couldn't open {found[0].name} ({err}).")
        return None


def load_chapters(content: Path, problems: Problems) -> list[Chapter]:
    data = _read_yaml(content / "chapters.yaml", problems)
    if data is None:
        return []
    if not isinstance(data, list):
        problems.errors.append("chapters.yaml: every chapter should start with '- name:'.")
        return []
    chapters: list[Chapter] = []
    for i, entry in enumerate(data, 1):
        named = isinstance(entry, dict) and entry.get("name")
        where = f"chapters.yaml: chapter {i}" + (f" ({entry['name']})" if named else "")
        if not isinstance(entry, dict):
            problems.errors.append(f"{where}: this should start with '- name:'.")
            continue
        try:
            config = ChapterConfig.model_validate(_without_blanks(entry))
        except ValidationError as err:
            problems.errors += explain(err, where, ChapterConfig)
            continue
        if config.tab is None and len(config.name) > 14:
            problems.errors.append(
                f"{where}: this name is too long for a tab. Add a short 'tab' (14 letters at most)."
            )
            continue
        values = config.model_dump()
        values["tab"] = config.tab or config.name
        chapter = Chapter(id=slugify(config.name) or f"chapter-{i}", **values)
        if chapter.id in {c.id for c in chapters} | {"kitchen-basics"}:
            problems.errors.append(f"{where}: there is already a chapter with this name.")
            continue
        chapters.append(chapter)
    return chapters


# ---------------------------------------------------------------------------
# Recipe folders
# ---------------------------------------------------------------------------


def _folders(parent: Path, problems: Problems) -> list[Path]:
    if not parent.is_dir():
        return []
    found = []
    for path in sorted(parent.iterdir()):
        if path.name.startswith(("_", ".")):
            continue
        if path.is_dir():
            found.append(path)
        elif path.suffix.lower() == ".md":
            problems.warnings.append(
                f"{path.name}: this file is on its own in {parent.name}/. Put it in a folder: "
                f"{parent.name}/{slugify(path.stem) or 'my-recipe'}/recipe.md"
            )
    return found


def tidy(text: str) -> str:
    """Drops blank lines, and the ``` fence some AI assistants wrap files in."""
    text = text.replace("\r\n", "\n").strip() + "\n"
    match = re.fullmatch(r"```\w*\n(.*)\n```\n", text, flags=re.S)
    return match[1].strip() + "\n" if match else text


def quote_values(text: str) -> str:
    """title: Dal: the best  ->  title: "Dal: the best" (settings block only)."""
    parts = text.split("---", 2)
    if len(parts) < 3:
        return text

    def quoted(m: re.Match[str]) -> str:
        value = re.sub(r"\s+#.*$", "", m[2]).strip().replace("\\", "\\\\").replace('"', '\\"')
        return f'{m[1]}: "{value}"'

    parts[1] = re.sub(r"^(\w+):[ \t]+([^\s\"'\[{#].*)$", quoted, parts[1], flags=re.M)
    return "---".join(parts)


def _read_folder(
    folder: Path, problems: Problems, known: type[BaseModel]
) -> tuple[dict[str, Any], str] | None:
    """The settings and text from a folder's Markdown file."""
    where = folder.name
    files = [p for p in sorted(folder.glob("*.md")) if not p.name.startswith(("_", "."))]
    path = next((p for p in files if p.name.lower() == "recipe.md"), None)
    if path is None and len(files) == 1:
        path = files[0]
    if path is None:
        problems.skipped.append(f"{where}: I couldn't find a recipe.md in this folder.")
        return None
    try:
        text = tidy(path.read_text(encoding="utf-8-sig"))
        try:
            post = frontmatter.loads(text)
        except yaml.YAMLError:
            # Most often a colon in a title. Put quotes round plain values and try again.
            post = frontmatter.loads(quote_values(text))
    except yaml.YAMLError as err:
        problems.skipped.append(yaml_problem(err, where, 2))
        return None
    except UnicodeDecodeError:
        problems.skipped.append(f"{where}: please save {path.name} as UTF-8 text.")
        return None
    # Forgiving about capitals in field names, too: 'Title:' is 'title:'.
    data = {k.lower(): v for k, v in _without_blanks(post.metadata).items()}
    if not data:
        problems.errors.append(
            f"{where}: the title is missing. {path.name} should start with a line of three "
            "dashes (---), then the settings, then three dashes again."
        )
        return None
    if "title" not in data:
        unknown = [name for name in data if name not in known.model_fields]
        close = did_you_mean("title", unknown)
        tail = f" Did you mean 'title' where it says '{close}'?" if close else ""
        problems.errors.append(f"{where}: the title is missing.{tail}")
        return None
    fields = list(known.model_fields)
    for name in data:
        if name not in fields:
            hint = did_you_mean(name, fields)
            # A near miss is worth pointing out; anything else is harmless.
            if hint and _is_typo(name, hint):
                problems.warnings.append(
                    f"{where}: I ignored '{name}', which isn't a field I know. "
                    f"Did you mean '{hint}'?"
                )
    return data, post.content


def _photo(folder: Path, slug: str, alt: str, public: Path, problems: Problems, *, write: bool):
    source = find_photo(folder)
    if source is None:
        odd = unusable_photo(folder)
        if odd:
            problems.warnings.append(
                f"{folder.name}: browsers can't show {odd.name}. Save it as a .jpg instead."
            )
        return None
    try:
        return make_photo(source, slug, alt, public / "photos", write=write)
    except Exception as err:  # a damaged photo should never stop the book
        problems.warnings.append(f"{folder.name}: I couldn't open the photo {source.name} ({err}).")
        return None


def find_chapter(cuisine: str, chapters: list[Chapter]) -> tuple[Chapter, str | None] | None:
    """Matches a chapter's name, or one of its sub-regions."""
    for chapter in chapters:
        if plain(chapter.name) == plain(cuisine):
            return chapter, None
    for chapter in chapters:
        for region in chapter.regions:
            if plain(region) == plain(cuisine):
                return chapter, region
    return None


def load_recipe(
    folder: Path, chapters: list[Chapter], public: Path, problems: Problems, *, write: bool
) -> Recipe | None:
    read = _read_folder(folder, problems, RecipeMeta)
    if read is None:
        return None
    data, body = read
    where = folder.name
    found = None
    wrong: list[str] = []
    if "cuisine" in data:
        cuisine = str(data["cuisine"])
        found = find_chapter(cuisine, chapters)
        if found is None:
            names = [c.name for c in chapters]
            regions = [r for c in chapters for r in c.regions]
            hint = did_you_mean(cuisine, [*names, *regions])
            tail = f"Did you mean '{hint}'?" if hint else f"Choose from: {', '.join(names)}."
            wrong.append(f"{where}: cuisine '{cuisine}' isn't a chapter. {tail}")
    try:
        meta = RecipeMeta.model_validate(data)
    except ValidationError as err:
        wrong += explain(err, where, RecipeMeta)
    if wrong or found is None:
        problems.skipped += wrong
        return None
    chapter, region = found
    slug = slugify(folder.name)
    return Recipe(
        slug=slug,
        **meta.model_dump(exclude={"cuisine"}),
        cuisine=chapter.name,
        region=region,
        photo=_photo(folder, slug, meta.title, public, problems, write=write),
        sections=parse_body(body, where, problems),
    )


def load_basic(folder: Path, public: Path, problems: Problems, *, write: bool) -> Basic | None:
    read = _read_folder(folder, problems, BasicMeta)
    if read is None:
        return None
    data, body = read
    try:
        meta = BasicMeta.model_validate(data)
    except ValidationError as err:
        problems.skipped += explain(err, folder.name, BasicMeta)
        return None
    slug = slugify(folder.name)
    return Basic(
        slug=slug,
        title=meta.title,
        tags=meta.tags,
        photo=_photo(folder, f"basics-{slug}", meta.title, public, problems, write=write),
        sections=parse_body(body, folder.name, problems),
    )


def _unique(items: list[Any], problems: Problems) -> list[Any]:
    seen: set[str] = set()
    out: list[Any] = []
    for item in items:
        if item is None:
            continue
        if not item.slug or item.slug in seen:
            problems.skipped.append(
                f"{item.title}: another folder already has the web address '{item.slug}'. "
                "Rename one of the folders."
            )
            continue
        seen.add(item.slug)
        out.append(item)
    return out


def load_content(root: Path, problems: Problems, *, write: bool = False) -> Content | None:
    """Reads everything. Returns None if the book can't be built (see problems.errors)."""
    content, public = root / "content", root / "public"
    site = load_site(content, public, problems, write=write)
    chapters = load_chapters(content, problems)
    if problems.errors or site is None:
        return None
    recipes = _unique(
        [
            load_recipe(f, chapters, public, problems, write=write)
            for f in _folders(content / "recipes", problems)
        ],
        problems,
    )
    basics = _unique(
        [
            load_basic(f, public, problems, write=write)
            for f in _folders(content / "basics", problems)
        ],
        problems,
    )
    if problems.errors:
        return None
    if write:
        keep = [site.background] if site.background else []
        for item in (*recipes, *basics):
            if item.photo:
                keep += [item.photo.small, item.photo.large, item.photo.jpg]
        remove_stale(public / "photos", keep)

    courses: list[str | None] = [*get_args(Course), None]
    order = [c.name for c in chapters]
    return Content(
        site=site,
        chapters=chapters,
        recipes=sorted(
            recipes,
            key=lambda r: (order.index(r.cuisine), courses.index(r.course), r.title.lower()),
        ),
        basics=sorted(basics, key=lambda b: b.title.lower()),
    )
