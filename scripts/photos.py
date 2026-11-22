"""Finds the photo in a recipe's folder and makes web-sized copies of it."""

from __future__ import annotations

import hashlib
import warnings
from pathlib import Path

from models import Photo
from PIL import Image, ImageOps

PHOTO_TYPES = {".jpg", ".jpeg", ".png", ".webp"}
OTHER_PHOTO_TYPES = {".heic", ".heif", ".tif", ".tiff", ".gif", ".bmp", ".avif"}
LARGE, SMALL, BACKGROUND = 1600, 800, 2400  # pixels wide

# Phone and camera photos can be enormous; these are our own files, so that's fine.
Image.MAX_IMAGE_PIXELS = None


def _visible_files(folder: Path) -> list[Path]:
    return sorted(p for p in folder.iterdir() if p.is_file() and not p.name.startswith((".", "_")))


def find_photo(folder: Path) -> Path | None:
    """The first picture in the folder, whatever it's called."""
    return next((p for p in _visible_files(folder) if p.suffix.lower() in PHOTO_TYPES), None)


def unusable_photo(folder: Path) -> Path | None:
    """A picture in a format browsers can't show, like an iPhone's .heic."""
    return next((p for p in _visible_files(folder) if p.suffix.lower() in OTHER_PHOTO_TYPES), None)


def make_photo(source: Path, name: str, alt: str, out: Path, *, write: bool) -> Photo:
    """Writes two WebP sizes and a JPEG (for link previews), unless already there.

    Copies are named after the photo's contents, so a changed photo is never
    confused with the old one. Location and camera details are left behind.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        digest = hashlib.sha1(source.read_bytes()).hexdigest()[:8]
        base = f"{name}-{digest}"
        paths = [out / (base + suffix) for suffix in (".jpg", "-800.webp", "-1600.webp")]
        if all(p.is_file() for p in paths):  # already made: don't open the big original again
            with Image.open(paths[-1]) as done:
                return _describe(base, alt, done.size)
        with Image.open(source) as opened:
            opened.load()
            # Phones store photos sideways with a note saying which way is up.
            img = ImageOps.exif_transpose(opened)
            if img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info:
                img = img.convert("RGBA")
                white = Image.new("RGBA", img.size, "white")
                img = Image.alpha_composite(white, img)
            img = img.convert("RGB")
    large = _fit(img, LARGE)
    if write:
        out.mkdir(parents=True, exist_ok=True)
        for picture, suffix, options in (
            (large, "-1600.webp", {"quality": 82}),
            (_fit(img, SMALL), "-800.webp", {"quality": 82}),
            (large, ".jpg", {"quality": 84, "optimize": True, "progressive": True}),
        ):
            path = out / (base + suffix)
            if not path.is_file():
                picture.save(path, **options)
    return _describe(base, alt, large.size)


def _describe(base: str, alt: str, size: tuple[int, int]) -> Photo:
    return Photo(
        small=f"/photos/{base}-800.webp",
        large=f"/photos/{base}-1600.webp",
        jpg=f"/photos/{base}.jpg",
        alt=alt,
        width=size[0],
        height=size[1],
    )


def _fit(img: Image.Image, width: int) -> Image.Image:
    if img.width <= width:
        return img
    height = max(1, round(img.height * width / img.width))
    return img.resize((width, height), Image.Resampling.LANCZOS)


def find_background(images: Path) -> list[Path]:
    """The benchtop photo: table.jpg, or the same name in another format."""
    return [
        path
        for ext in (".jpg", ".jpeg", ".png", ".webp")
        if (path := images / f"table{ext}").is_file()
    ]


def make_background(source: Path, out: Path, *, write: bool) -> str:
    """A compressed copy of the benchtop photo, so a huge one doesn't slow the site."""
    name = f"table-{hashlib.sha1(source.read_bytes()).hexdigest()[:8]}.webp"
    if not (out / name).is_file():
        with Image.open(source) as opened:
            img = _fit(ImageOps.exif_transpose(opened).convert("RGB"), BACKGROUND)
        if write:
            out.mkdir(parents=True, exist_ok=True)
            img.save(out / name, quality=84)
    return f"/photos/{name}"


def remove_stale(out: Path, keep: list[str]) -> None:
    """Deletes copies of photos that have been changed or removed."""
    if not out.is_dir():
        return
    wanted = {Path(p).name for p in keep}
    for path in out.iterdir():
        if path.is_file() and path.name not in wanted:
            path.unlink()
