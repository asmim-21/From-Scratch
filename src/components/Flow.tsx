import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Inline } from '../generated/types';
import { usePlan } from '../book/context';
import { scaledText, type FlowItem } from '../book/plan';
import { useServings } from '../lib/servings';
import { useTicks } from '../lib/ticks';

/** Text with its bold, italics and links. */
export function Rich({ text }: { text: Inline[] }) {
  return (
    <>
      {text.map((run, i) => {
        let node = <>{run.text}</>;
        if (run.italic) node = <em>{node}</em>;
        if (run.bold) node = <strong>{node}</strong>;
        if (run.href) {
          const outside = !run.href.startsWith('#');
          node = (
            <a href={run.href} {...(outside ? { target: '_blank', rel: 'noreferrer' } : {})}>
              {node}
            </a>
          );
        }
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/** An ingredient with a box to tick while cooking. */
export function TickItem({ id, text, depth }: { id: string; text: Inline[]; depth: number }) {
  const { isTicked, toggle } = useTicks();
  return (
    <label className="tick" style={{ '--depth': depth } as CSSProperties}>
      <input type="checkbox" checked={isTicked(id)} onChange={() => toggle(id)} />
      <span className="tick__text">
        <Rich text={text} />
      </span>
    </label>
  );
}

function SectionHead({ item }: { item: Extract<FlowItem, { kind: 'section' }> }) {
  const { scale, section } = item;
  const { factor } = useServings(scale);
  return (
    <div className="section-head">
      <h3>{item.title}</h3>
      {scale && section === 'method' && factor !== 1 && (
        // Amounts repeated in the steps aren't changed, so say so.
        <span className="section-head__note">
          {scale.serves ? `written for ${scale.serves}` : 'written for one batch'}
        </span>
      )}
    </div>
  );
}

/** One thing in a page's flow of text. Its height is measured to fill pages. */
export function FlowItemView({ item }: { item: FlowItem }) {
  switch (item.kind) {
    case 'section':
      return <SectionHead item={item} />;
    case 'subhead':
      return <h3 className="subhead">{item.title}</h3>;
    case 'entry':
      return <Entry item={item} />;
    case 'empty':
      return <p className="line line--empty">{item.text}</p>;
    case 'block':
      return <BlockView item={item} />;
  }
}

function BlockView({ item }: { item: Extract<FlowItem, { kind: 'block' }> }) {
  const { block, tickId, continued } = item;
  const { factor } = useServings(item.scale);
  const text = item.scale ? scaledText(block.text, factor) : block.text;
  const depth = { '--depth': block.depth } as CSSProperties;

  if (block.kind === 'heading') {
    return (
      <h4 className="subhead">
        <Rich text={text} />
      </h4>
    );
  }
  if (block.kind === 'step') {
    return (
      <div className="line line--step" style={depth}>
        <span className="line__number">{continued ? '' : `${block.number}.`}</span>
        <span>
          <Rich text={text} />
        </span>
      </div>
    );
  }
  if (block.kind === 'item') {
    if (tickId && !continued) return <TickItem id={tickId} text={text} depth={block.depth} />;
    return (
      <div className="line line--bullet" style={depth}>
        <span className="line__bullet" aria-hidden="true">
          {continued ? '' : '♡'}
        </span>
        <span>
          <Rich text={text} />
        </span>
      </div>
    );
  }
  return (
    <p className="line" style={depth}>
      <Rich text={text} />
    </p>
  );
}

/** A line in the contents, a chapter list or the index, with its page number. */
function Entry({ item }: { item: Extract<FlowItem, { kind: 'entry' }> }) {
  const plan = usePlan();
  const { chapter } = item;
  return (
    <Link to={item.route} className={`entry ${chapter ? 'entry--chapter' : ''}`}>
      {chapter && (
        <span className="entry__icon" style={{ backgroundColor: chapter.color }} aria-hidden="true">
          {chapter.icon}
        </span>
      )}
      <span className="entry__title">{item.title}</span>
      <span className="entry__dots" aria-hidden="true" />
      {item.note && <span className="entry__note">{item.note}</span>}
      <span className="entry__number">{plan?.numberOf(item.route) ?? ''}</span>
    </Link>
  );
}
