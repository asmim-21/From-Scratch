import json

import build_content
import new_recipe
import pytest
from conftest import GOOD, REPO
from content_parser import Problems, load_content, parse_body, slugify
from PIL import Image


def load(root, **kw):
    problems = Problems()
    return load_content(root, problems, **kw), problems


def extra(line):
    """Adds a line to the good recipe's settings."""
    return ("cuisine: Indian", f"cuisine: Indian\n{line}")


def soup_of(root):
    content, problems = load(root)
    assert problems == Problems(), problems
    return next(r for r in content.recipes if r.slug == "test-soup")


# --- the real content -------------------------------------------------------


def test_the_real_book_is_valid():
    content, problems = load(REPO)
    assert problems.errors == [] and problems.skipped == []
    assert content.recipes and content.basics and content.chapters


# --- reading ----------------------------------------------------------------


def test_only_title_and_cuisine_are_needed(book):
    soup = soup_of(book)
    assert (soup.title, soup.cuisine, soup.course, soup.time, soup.photo, soup.tags) == (
        "Test Soup", "Indian", None, None, None, [],
    )  # fmt: skip
    assert [s.key for s in soup.sections] == ["ingredients"]


def test_template_is_ignored(book):
    content, _ = load(book)
    assert [r.slug for r in content.recipes] == ["test-soup"]


@pytest.mark.parametrize("cuisine", ["indian", "INDIAN", '"  Indian "'])
def test_case_and_spaces_dont_matter(recipe, cuisine):
    assert soup_of(recipe(("Indian", cuisine))).cuisine == "Indian"


def test_a_sub_region_lands_in_its_chapter(recipe):
    soup = soup_of(recipe(("Indian", "bengali")))
    assert (soup.cuisine, soup.region) == ("Indian", "Bengali")


@pytest.mark.parametrize(
    ("line", "field", "expected"),
    [
        ("diet: VEGETARIAN", "diet", "Vegetarian"),
        ("course: soups and salads", "course", "Soups & Salads"),
        ("Difficulty: easy", "difficulty", "Easy"),
        ("time: 40", "time", 40),
        ("time: 40 minutes", "time", 40),
        ("time: 1 hr 20 min", "time", 80),
        ("time: 1.5 hours", "time", 90),
        ("serves: 4", "serves", "4"),
        ("serves: 4-6 people", "serves", "4–6"),
        ("tags: cosy, one pot", "tags", ["cosy", "one pot"]),
        ("tags: [cosy, 2024]", "tags", ["cosy", "2024"]),
        ("serves:", "serves", None),
        ("source: Mum", "diet", None),
    ],
)
def test_forgiving_fields(recipe, line, field, expected):
    assert getattr(soup_of(recipe(extra(line))), field) == expected


def test_a_colon_in_the_title_is_fine(recipe):
    soup = soup_of(recipe(("Test Soup", 'Soup: the "good" one   # best'), extra("time: 40")))
    assert (soup.title, soup.time) == ('Soup: the "good" one', 40)


def test_ai_code_fences_are_removed(book):
    (book / "content/recipes/test-soup/recipe.md").write_text(f"```markdown\n{GOOD}```\n")
    assert soup_of(book).title == "Test Soup"


def test_any_single_markdown_file_and_folder_name_will_do(book):
    folder = book / "content/recipes/test-soup"
    (folder / "recipe.md").rename(folder / "soup.md")
    folder.rename(book / "content/recipes/Test Soup")
    assert soup_of(book).title == "Test Soup"


def test_recipes_sort_by_chapter_then_course_then_title(recipe):
    recipe(("Test Soup", "Zucchini"), extra("course: Mains"), name="zucchini")
    recipe(("Test Soup", "aloo"), extra("course: Mains"), name="aloo")
    recipe(("Test Soup", "Late"), extra("course: Breakfast"), name="late")
    root = recipe(("Indian", "Italian"), name="pasta")
    content, _ = load(root)
    assert [r.slug for r in content.recipes] == ["late", "aloo", "zucchini", "test-soup", "pasta"]


def test_dozens_of_folders_at_once(recipe):
    for i in range(80):
        root = recipe(("Test Soup", f"Soup {i}"), name=f"soup-{i}")
    content, problems = load(root)
    assert len(content.recipes) == 81
    assert problems == Problems()


def test_body_sections():
    problems = Problems()
    sections = parse_body(
        "# Dal\n\nHello.\n\n## Ingredients:\n### For the dal\n- 1 cup **dal**\n  - rinsed\n\n"
        "## Directions\n1. One\n2. Two\n\n## Tips\nNice.\n\n## Serve with\nRice.\n",
        "dal",
        problems,
    )
    assert [s.key for s in sections] == ["intro", "ingredients", "method", "notes", "other"]
    ingredients = sections[1].blocks
    assert [(b.kind, b.depth) for b in ingredients] == [("heading", 0), ("item", 0), ("item", 1)]
    assert [(i.text, i.bold) for i in ingredients[1].text] == [("1 cup ", False), ("dal", True)]
    assert [b.number for b in sections[2].blocks] == [1, 2]
    assert problems == Problems()


def test_an_aside_in_a_heading():
    sections = parse_body("## Ingredients (makes 2 muffins)\n- 1 egg", "x", Problems())
    assert (sections[0].key, sections[0].title) == ("ingredients", "Ingredients")
    assert sections[0].blocks[0].text[0].text == "makes 2 muffins"


def test_misspelled_heading_is_understood():
    problems = Problems()
    sections = parse_body("## Ingrediants\n- salt", "dal", problems)
    assert sections[0].key == "ingredients"
    assert problems.warnings == ["dal: I read the heading '## Ingrediants' as '## Ingredients'."]


def test_unsafe_links_lose_their_address():
    blocks = parse_body("[a](https://x.org) [b](ftp://x.org)", "x", Problems())[0].blocks
    assert [i.href for i in blocks[0].text if i.text.strip()] == ["https://x.org", None]


# --- mistakes ---------------------------------------------------------------


def test_misspelled_cuisine_is_skipped_with_a_suggestion(recipe):
    recipe(name="good-soup")
    content, problems = load(recipe(("Indian", "Indain"), name="dal-tadka"))
    assert problems.errors == []
    assert problems.skipped == [
        "dal-tadka: cuisine 'Indain' isn't a chapter. Did you mean 'Indian'?"
    ]
    assert "dal-tadka" not in [r.slug for r in content.recipes]
    assert "good-soup" in [r.slug for r in content.recipes]


@pytest.mark.parametrize(
    ("swap", "expected"),
    [
        (extra("diet: Vegitarian"), "Did you mean 'Vegetarian'?"),
        (extra("course: Main"), "Did you mean 'Mains'?"),
        (extra("time: a while"), "total minutes"),
        (extra("serves: lots"), "a number"),
        (("cuisine: Indian\n", ""), "'cuisine' is missing"),
        (("Test Soup", "x" * 95), "too long"),
        (("title: Test Soup", 'title: "Test Soup'), "missing quote"),
    ],
)
def test_mistakes_skip_the_recipe_and_say_why(recipe, swap, expected):
    content, problems = load(recipe(swap))
    assert content.recipes == []
    assert problems.errors == []
    assert len(problems.skipped) == 1
    assert problems.skipped[0].startswith("test-soup: ")
    assert expected in problems.skipped[0]


def test_a_mistyped_field_name_is_pointed_out(recipe):
    content, problems = load(recipe(extra("servs: 4")))
    assert "Did you mean 'serves'?" in problems.warnings[0]
    assert len(content.recipes) == 1


@pytest.mark.parametrize("swap", [("title: Test Soup\n", ""), ("title: Test Soup", "title:")])
def test_a_missing_title_stops_the_build(recipe, swap):
    content, problems = load(recipe(swap))
    assert content is None
    assert problems.errors == ["test-soup: the title is missing."]


def test_a_mistyped_title_is_spotted(recipe):
    _, problems = load(recipe(("title:", "tilte:"), extra("time: 5")))
    assert "where it says 'tilte'" in problems.errors[0]


def test_folder_without_settings_stops_the_build(book):
    (book / "content/recipes/test-soup/recipe.md").write_text("## Ingredients\n- 1 onion\n")
    content, problems = load(book)
    assert content is None
    assert "three dashes" in problems.errors[0]


def test_empty_folder_is_skipped(book):
    (book / "content/recipes/mystery").mkdir()
    content, problems = load(book)
    assert problems.skipped == ["mystery: I couldn't find a recipe.md in this folder."]
    assert len(content.recipes) == 1


def test_same_web_address_twice(recipe):
    _, problems = load(recipe(name="Test Soup"))
    assert "already has the web address 'test-soup'" in problems.skipped[0]


def test_chapter_mistakes_stop_the_build(book):
    (book / "content/chapters.yaml").write_text('- name: Indian\n  colour: "#ffffff"\n  icon: x')
    content, problems = load(book)
    assert content is None
    assert any("Did you mean 'color'?" in e for e in problems.errors)


# --- photos -----------------------------------------------------------------


def add_photo(root, name="IMG_0001.JPG", size=(4000, 3000), mode="RGB", **save):
    path = root / "content/recipes/test-soup" / name
    Image.new(mode, size, "pink").save(path, **save)
    return path


def test_photo_is_found_resized_and_converted(book):
    add_photo(book)
    content, problems = load(book, write=True)
    photo = content.recipes[0].photo
    assert problems == Problems()
    assert (photo.width, photo.height, photo.alt) == (1600, 1200, "Test Soup")
    for path, kind, width in (
        (photo.small, "WEBP", 800),
        (photo.large, "WEBP", 1600),
        (photo.jpg, "JPEG", 1600),
    ):
        with Image.open(book / "public" / path.lstrip("/")) as img:
            assert (img.format, img.width) == (kind, width)
            assert not img.getexif()
    again, _ = load(book, write=True)
    assert again.recipes[0].photo == photo


def test_sideways_phone_photo_is_turned_upright(book):
    exif = Image.Exif()
    exif[0x0112] = 6  # "rotate me 90 degrees"
    add_photo(book, size=(400, 300), exif=exif)
    content, _ = load(book, write=True)
    assert (content.recipes[0].photo.width, content.recipes[0].photo.height) == (300, 400)


def test_see_through_png_works(book):
    add_photo(book, "pic.png", (300, 300), "RGBA")
    content, problems = load(book, write=True)
    assert content.recipes[0].photo and problems == Problems()


def test_old_copies_are_cleared_away(book):
    path = add_photo(book)
    load(book, write=True)
    path.unlink()
    content, _ = load(book, write=True)
    assert content.recipes[0].photo is None
    assert list((book / "public/photos").iterdir()) == []


def test_bad_photos_only_warn(book):
    folder = book / "content/recipes/test-soup"
    (folder / "photo.jpg").write_bytes(b"not a photo")
    content, problems = load(book)
    assert content.recipes[0].photo is None
    assert "couldn't open the photo photo.jpg" in problems.warnings[0]
    (folder / "photo.jpg").rename(folder / "photo.heic")
    _, problems = load(book)
    assert "browsers can't show photo.heic" in problems.warnings[0]


@pytest.mark.parametrize("name", ["table.jpg", "table.png"])
def test_background_in_any_format(book, name):
    (book / "public/images").mkdir(parents=True)
    Image.new("RGB", (3000, 1500), "tan").save(book / "public/images" / name)
    content, problems = load(book, write=True)
    with Image.open(book / "public" / content.site.background.lstrip("/")) as img:
        assert img.size == (2400, 1200)
    assert problems == Problems()


def test_no_background_is_fine(book):
    content, _ = load(book)
    assert content.site.background is None


# --- the command line -------------------------------------------------------


def test_check_writes_nothing(book, capsys):
    add_photo(book)
    assert build_content.main(["--check"], root=book) == 0
    assert "All good" in capsys.readouterr().out
    assert not (book / "src").exists() and not (book / "public").exists()


def test_check_fails_but_build_carries_on(recipe, capsys):
    root = recipe(("Indian", "Indain"), name="dal-tadka")
    assert build_content.main(["--check"], root=root) == 1
    assert "Did you mean 'Indian'?" in capsys.readouterr().err
    assert build_content.main([], root=root) == 0


def test_build_fails_without_a_title(recipe):
    assert build_content.main([], root=recipe(("title: Test Soup\n", ""))) == 1


def test_build_writes_json_and_types(book):
    assert build_content.main([], root=book) == 0
    out = book / "src" / "generated"
    assert json.loads((out / "recipes.json").read_text())[0]["slug"] == "test-soup"
    types = (out / "types.ts").read_text()
    assert "export interface Recipe {" in types
    assert "time: number | null;" in types


def test_link_pages(recipe):
    root = recipe(("Test Soup", "\"Soup </script> & 'Bread'\""), ("1 onion", "1 </script> onion"))
    assert build_content.main(["--stubs", "dist"], root=root) == 0
    page = (root / "dist/recipes/test-soup/index.html").read_text()
    assert '"../../#/recipes/test-soup"' in page
    assert "<title>Soup &lt;/script&gt; &amp;" in page
    assert page.count("</script>") == 2  # only the two real ones
    ld = json.loads(page.split('ld+json">')[1].split("</script>")[0])
    assert ld["@type"] == "Recipe"
    assert ld["recipeIngredient"] == ["1 </script> onion"]
    assert page.count("https://asmim-21.github.io/From-Scratch/images/og.jpg") == 2


def test_link_page_uses_the_photo(book):
    add_photo(book)
    build_content.main(["--stubs", "dist"], root=book)
    page = (book / "dist/recipes/test-soup/index.html").read_text()
    assert "https://asmim-21.github.io/From-Scratch/photos/test-soup-" in page


def test_custom_domain_is_used(book):
    (book / "public").mkdir()
    (book / "public/CNAME").write_text("recipes.example.com\n")
    content, _ = load(book)
    assert content.site.url == "https://recipes.example.com/"


# --- new_recipe.py ----------------------------------------------------------


def test_new_recipe_is_valid_straight_away(book):
    assert new_recipe.main(["Crème", "Brûlée"], root=book) == 0
    content, problems = load(book)
    assert problems == Problems()
    made = next(r for r in content.recipes if r.slug == "creme-brulee")
    assert (made.title, made.course, made.tags) == ("Crème Brûlée", None, [])


def test_new_recipe_never_overwrites(book):
    assert new_recipe.main(["Test Soup"], root=book) == 1
    assert (book / "content/recipes/test-soup/recipe.md").read_text() == GOOD


@pytest.mark.parametrize(
    ("title", "slug"),
    [("Mac & Cheese", "mac-and-cheese"), ("Mum's Dal!", "mums-dal"), ("  ", "")],
)
def test_slugify(title, slug):
    assert slugify(title) == slug
