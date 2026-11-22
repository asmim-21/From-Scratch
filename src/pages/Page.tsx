import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PageModel } from '../book/plan';
import { FlowItemView } from '../components/Flow';
import { CoverMotif, hash, Heart, MarginDecor, Sparkle } from '../components/decor';
import { PhotoPrint } from '../components/PhotoPrint';
import { site } from '../lib/content';
import { RecipeIntro, Tags, titleSize } from './RecipeIntro';

type Side = 'left' | 'right' | 'single';

interface Props {
  page: PageModel;
  /** The printed page number. */
  number: number;
  side: Side;
  /** Clicking anywhere on the closed cover opens the book. */
  onOpen: () => void;
}

/** Renders one page of the book. */
export function Page({ page, number, side, onOpen }: Props) {
  const paper = (className: string, children: ReactNode) => (
    <div className={`page ${className}`}>
      {children}
      <div className={`folio folio--${side}`} aria-hidden="true">
        {number}
      </div>
    </div>
  );

  switch (page.kind) {
    case 'cover':
      return (
        // The page's edge does the same for the keyboard.
        <div className="page cloth cover" onClick={onOpen}>
          <div className="cover__frame" />
          <h1 className="cover__title">{site.title}</h1>
          <CoverMotif />
          <p className="cover__subtitle">{site.subtitle}</p>
          {site.author && <p className="cover__author">{site.author}</p>}
        </div>
      );

    case 'dedication':
      return (
        <div className="page endpaper">
          <div className="dedication">
            <span className="washi washi--blue dedication__tape" aria-hidden="true" />
            <p>{site.dedication}</p>
            <Heart />
          </div>
        </div>
      );

    case 'contents':
      return paper(
        '',
        <>
          {page.first ? <PageHeading>Contents</PageHeading> : <Continued>Contents</Continued>}
          <nav aria-label="Contents">
            {page.items.map((item, i) => (
              <FlowItemView key={i} item={item} />
            ))}
          </nav>
        </>,
      );

    case 'divider': {
      const chapter = page.chapter!;
      return paper(
        'divider',
        <>
          <div className="divider__wash" style={{ backgroundColor: chapter.color }} />
          <span className="divider__icon" aria-hidden="true">
            {chapter.icon}
          </span>
          <h2 className={`divider__name ${chapter.name.length > 14 ? 'divider__name--long' : ''}`}>
            {chapter.name}
          </h2>
          {chapter.blurb && <p className="divider__blurb">{chapter.blurb}</p>}
          <p className="divider__count">{countOf(page.count, chapter.id === 'kitchen-basics')}</p>
        </>,
      );
    }

    case 'list':
      return paper(
        '',
        <>
          {page.first ? <PageHeading>In this chapter</PageHeading> : <Continued>{page.title}</Continued>}
          <nav aria-label={page.title}>
            {page.items.map((item, i) => (
              <FlowItemView key={i} item={item} />
            ))}
          </nav>
        </>,
      );

    case 'recipe':
      return paper('intro', <RecipeIntro recipe={page.recipe} />);

    case 'basic':
      return paper(
        'intro',
        <>
          <MarginDecor seed={hash(page.basic.slug)} />
          <p className="intro__eyebrow">Kitchen Basics</p>
          <h2 className={`intro__title ${titleSize(page.basic.title)}`}>{page.basic.title}</h2>
          <PhotoPrint photo={page.basic.photo} name={page.basic.slug} />
          {page.basic.tags.length > 0 && <Tags tags={page.basic.tags} />}
        </>,
      );

    case 'flow':
      return paper(
        'lined',
        <>
          {!page.first && <Continued>{page.title}</Continued>}
          {page.items.map((item, i) => (
            <FlowItemView key={i} item={item} />
          ))}
        </>,
      );

    case 'index':
      return paper(
        '',
        <>
          {page.first ? <PageHeading>Index</PageHeading> : <Continued>Index</Continued>}
          <nav aria-label="Index" className="columns">
            {page.columns.map((column, c) => (
              <div key={c} className="columns__column">
                {column.map((item, i) => (
                  <FlowItemView key={i} item={item} />
                ))}
              </div>
            ))}
          </nav>
        </>,
      );

    case 'endpaper':
      return <div className="page endpaper" />;

    case 'back':
      return (
        <div className="page cloth cover cover--back">
          <div className="cover__frame" />
          <Sparkle />
          <p className="cover__subtitle">{site.backCover}</p>
          <Link to="/" className="cover__again">
            back to the front
          </Link>
        </div>
      );
  }
}

const countOf = (n: number, basics: boolean) => {
  const thing = basics ? 'skill' : 'recipe';
  if (n === 0) return `no ${thing}s yet`;
  return `${n} ${thing}${n === 1 ? '' : 's'}`;
};

function PageHeading({ children }: { children: ReactNode }) {
  return (
    <header className="page-heading">
      <h2>{children}</h2>
      <Heart />
    </header>
  );
}

function Continued({ children }: { children: ReactNode }) {
  return (
    <header className="continued">
      <span>{children}</span>, continued
    </header>
  );
}
