import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import { FlowItemView } from '../components/Flow';
import type { FlowItem, Measurer } from './plan';

const FONTS = ['18px "Patrick Hand"', '700 30px "Amatic SC"', '40px "Caveat Brush"', '15px "Lora"'];

/** Waits for the handwriting to arrive (but not forever), so text is measured in it. */
export async function fontsReady(timeoutMs = 3000): Promise<boolean> {
  if (!document.fonts) return true;
  const loading = Promise.all(FONTS.map((f) => document.fonts.load(f))).then(
    () => true,
    () => true,
  );
  return Promise.race([
    loading,
    new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

/** Measures text by laying it out off-screen, exactly as the pages will. */
export function createMeasurer(): Measurer & { dispose: () => void } {
  const host = document.createElement('div');
  host.className = 'measure';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const root = createRoot(host);
  const known = new Map<number, WeakMap<FlowItem, number>>();

  const cacheFor = (width: number) => {
    let cache = known.get(width);
    if (!cache) known.set(width, (cache = new WeakMap()));
    return cache;
  };

  const warm = (items: FlowItem[], width: number) => {
    const cache = cacheFor(width);
    host.style.width = `${width}px`;
    flushSync(() =>
      root.render(
        <MemoryRouter>
          {items.map((item, i) => (
            <div key={i} className="measure__item">
              <FlowItemView item={item} />
            </div>
          ))}
        </MemoryRouter>,
      ),
    );
    const els = host.querySelectorAll('.measure__item');
    items.forEach((item, i) => cache.set(item, els[i].getBoundingClientRect().height));
  };

  const pen = document.createElement('canvas').getContext('2d');

  return {
    warm,
    lineWidth: (text) => {
      if (!pen) return text.length;
      pen.font = '18px "Patrick Hand", cursive';
      return pen.measureText(text).width;
    },
    height: (item, width) => {
      const cache = cacheFor(width);
      if (!cache.has(item)) warm([item], width);
      return cache.get(item)!;
    },
    dispose: () => {
      root.unmount();
      host.remove();
    },
  };
}
