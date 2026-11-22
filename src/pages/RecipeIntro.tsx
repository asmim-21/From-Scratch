import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Recipe } from '../generated/types';
import { hash, MarginDecor } from '../components/decor';
import { PhotoPrint } from '../components/PhotoPrint';
import { ServingsStepper } from '../components/ServingsStepper';
import { recipeScale } from '../book/plan';
import { minutes, recipeRoute, shareUrl } from '../lib/content';

const GREEN = ['Vegetarian', 'Vegan'];

/** The left-hand page of a recipe: title, photo and the facts. */
export function RecipeIntro({ recipe }: { recipe: Recipe }) {
  const place = [recipe.region ?? recipe.cuisine, recipe.course].filter(
    (x, i, all) => x && all.indexOf(x) === i,
  );
  // Serves sits in the middle, well away from the edges that turn the page.
  const facts = [
    recipe.time && { name: 'time', value: minutes(recipe.time) },
    {
      name: recipe.serves ? 'serves' : 'makes',
      value: <ServingsStepper scale={recipeScale(recipe)} asWritten={recipe.serves} />,
    },
    recipe.difficulty && { name: 'level', value: recipe.difficulty },
  ].filter((f) => !!f);

  return (
    <>
      <MarginDecor seed={hash(recipe.slug)} />
      <p className="intro__eyebrow">{place.join(' · ')}</p>
      <h2 className={`intro__title ${titleSize(recipe.title)}`}>{recipe.title}</h2>
      <PhotoPrint photo={recipe.photo} name={recipe.slug} />
      <dl className="facts">
        {facts.map((f) => (
          <div key={f.name}>
            <dt>{f.name}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
        {recipe.diet && (
          <div>
            <dt>diet</dt>
            <dd>
              <span
                className={`diet-mark ${GREEN.includes(recipe.diet) ? 'diet-mark--green' : ''}`}
                aria-hidden="true"
              />
              {recipe.diet}
            </dd>
          </div>
        )}
      </dl>
      {recipe.tags.length > 0 && <Tags tags={recipe.tags} />}
      <div className="intro__actions">
        <Link className="pill pill--strong" to={`${recipeRoute(recipe.slug)}/cook`}>
          Cook mode
        </Link>
        <CopyLink slug={recipe.slug} />
      </div>
    </>
  );
}

function CopyLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = shareUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };
  return (
    <button className="pill" onClick={() => void copy()} aria-live="polite">
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  );
}

/** Longer titles are written a little smaller so they always fit. */
export const titleSize = (title: string) =>
  title.length > 52
    ? 'intro__title--xs'
    : title.length > 34
      ? 'intro__title--s'
      : title.length > 18
        ? 'intro__title--m'
        : '';

export function Tags({ tags }: { tags: string[] }) {
  return (
    <p className="intro__tags">
      {tags
        .slice(0, 6)
        .map((t) => `#${t.replace(/\s+/g, '')}`)
        .join('  ')}
    </p>
  );
}
