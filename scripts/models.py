"""The shape of the content: what you may write, and what the website receives.

The first half (``*Meta``, ``ChapterConfig``, ``SiteConfig``) describes the YAML a
person writes. The second half describes the JSON the website reads; the matching
TypeScript types in ``src/generated/types.ts`` are produced from these models, so
the two can't drift apart.
"""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal, get_args

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

Course = Literal[
    "Breakfast", "Mains", "Sides", "Snacks", "Soups & Salads", "Desserts", "Baking", "Drinks"
]  # fmt: skip
Diet = Literal["Vegetarian", "Vegan", "Chicken", "Seafood", "Egg"]
Difficulty = Literal["Easy", "Medium", "Hard"]

HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]


# ---------------------------------------------------------------------------
# Forgiving readers: accept what people naturally type
# ---------------------------------------------------------------------------


def plain(value: object) -> str:
    """How two names are compared: 'Soups and  salads' matches 'Soups & Salads'."""
    return re.sub(r"\s+", " ", str(value).lower().replace("&", " and ")).strip()


def any_case(choices: Any) -> BeforeValidator:
    """Matches 'vegetarian', 'VEGETARIAN' and so on to the proper spelling."""
    proper = {plain(c): c for c in get_args(choices)}
    return BeforeValidator(lambda v: proper.get(plain(v), v) if isinstance(v, str) else v)


def _minutes(value: object) -> object:
    """40, '40', '40 minutes', '1 hr 20 min' and '1.5 hours' all work."""
    if not isinstance(value, str):
        return value
    text = value.strip().lower()
    if re.fullmatch(r"\d+", text):
        return int(text)
    match = re.fullmatch(
        r"(?:(\d+(?:\.\d+)?)\s*h(?:ou)?(?:r)?s?)?\s*(?:and\s*)?(?:(\d+)\s*m(?:in(?:ute)?s?)?)?\.?",
        text,
    )
    if match and any(match.groups()):
        return round(float(match[1] or 0) * 60) + int(match[2] or 0)
    return value


def _serves(value: object) -> object:
    """4 -> '4'. Also '4-6' and '4 people'."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        text = re.sub(r"\s*(people|persons?|servings?|serves)\s*", "", value, flags=re.I).strip()
        return re.sub(r"\s*(?:-|–|to)\s*", "–", text)
    return value


def _tags(value: object) -> object:
    """Accepts a list, or words separated by commas."""
    if isinstance(value, str):
        value = value.split(",")
    if isinstance(value, list):
        return [str(t).strip().lstrip("#") for t in value if t is not None and str(t).strip()]
    return value


def _text(value: object) -> object:
    """A title like 7-Up Chicken or 1234 is still text."""
    return str(value) if isinstance(value, int | float) and not isinstance(value, bool) else value


Title = Annotated[str, Field(min_length=1, max_length=90), BeforeValidator(_text)]
Tags = Annotated[list[str], BeforeValidator(_tags)]


class Meta(BaseModel):
    # Unknown fields are noticed (and gently pointed out) by the parser.
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class Strict(BaseModel):
    """For the settings files: unknown fields are errors, so typos never pass silently."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# ---------------------------------------------------------------------------
# What a person writes
# ---------------------------------------------------------------------------


class RecipeMeta(Meta):
    title: Title
    cuisine: str
    course: Annotated[Course | None, any_case(Course)] = None
    diet: Annotated[Diet | None, any_case(Diet)] = None
    serves: Annotated[
        str | None, BeforeValidator(_serves), Field(pattern=r"^[1-9]\d{0,2}(–[1-9]\d{0,2})?$")
    ] = None
    time: Annotated[int | None, BeforeValidator(_minutes), Field(ge=1, le=20_000)] = None
    difficulty: Annotated[Difficulty | None, any_case(Difficulty)] = None
    tags: Tags = []


class BasicMeta(Meta):
    title: Title
    tags: Tags = []


class ChapterConfig(Strict):
    name: Annotated[str, Field(min_length=1, max_length=40)]
    color: HexColor
    icon: Annotated[str, Field(min_length=1, max_length=8)]
    tab: Annotated[str, Field(min_length=1, max_length=14)] | None = None
    blurb: Annotated[str, Field(max_length=90)] | None = None
    regions: list[str] = []


class SiteColors(Strict):
    cover: HexColor = "#b4604c"
    foil: HexColor = "#f6dfae"
    title: HexColor = "#b5452c"
    ink: HexColor = "#3a332e"
    paper: HexColor = "#fdf8ee"


class SiteConfig(Strict):
    title: Annotated[str, Field(min_length=1, max_length=24)]
    subtitle: Annotated[str, Field(max_length=60)] = ""
    author: Annotated[str, Field(max_length=40)] = ""
    dedication: Annotated[str, Field(max_length=400)] = ""
    backCover: Annotated[str, Field(max_length=120)] = ""
    description: Annotated[str, Field(max_length=200)] = ""
    url: str
    colors: SiteColors = SiteColors()

    @field_validator("url")
    @classmethod
    def _full_address(cls, value: str) -> str:
        if not re.match(r"^https?://\S+$", value):
            raise ValueError("should be a full web address starting with https://")
        return value.rstrip("/") + "/"


# ---------------------------------------------------------------------------
# What the website reads
# ---------------------------------------------------------------------------


class Inline(BaseModel):
    """A run of text with one style."""

    text: str
    bold: bool = False
    italic: bool = False
    href: str | None = None


class Block(BaseModel):
    """One line-item on a page: a sub-heading, bullet, numbered step or paragraph."""

    kind: Literal["heading", "item", "step", "para"]
    text: list[Inline]
    number: int | None = None
    depth: int = 0


class Section(BaseModel):
    key: Literal["intro", "ingredients", "method", "notes", "other"]
    title: str
    blocks: list[Block]


class Photo(BaseModel):
    small: str
    large: str
    jpg: str
    alt: str
    width: int
    height: int


class Recipe(BaseModel):
    slug: str
    title: str
    cuisine: str
    region: str | None
    course: Course | None
    diet: Diet | None
    serves: str | None
    time: int | None
    difficulty: Difficulty | None
    tags: list[str]
    photo: Photo | None
    sections: list[Section]


class Basic(BaseModel):
    slug: str
    title: str
    tags: list[str]
    photo: Photo | None
    sections: list[Section]


class Chapter(BaseModel):
    id: str
    name: str
    tab: str
    color: str
    icon: str
    blurb: str | None
    regions: list[str]


class Site(BaseModel):
    title: str
    subtitle: str
    author: str
    dedication: str
    backCover: str
    description: str
    url: str
    colors: SiteColors
    background: str | None
