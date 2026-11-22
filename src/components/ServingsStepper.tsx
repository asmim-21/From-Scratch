import { MAX_SERVINGS, type Scale } from '../lib/scale';
import { useServings } from '../lib/servings';

/** Changes how many people a recipe is for. */
export function ServingsStepper({ scale, asWritten }: { scale: Scale; asWritten?: string | null }) {
  const { count, factor, setCount } = useServings(scale);
  const what = scale.serves ? 'people' : 'batches';
  const label = scale.serves ? (factor === 1 && asWritten) || String(count) : `× ${count}`;
  return (
    <span className="stepper" role="group" aria-label="Servings" data-keep-clear>
      <button onClick={() => setCount(count - 1)} disabled={count <= 1} aria-label={`Fewer ${what}`}>
        −
      </button>
      <output aria-live="polite">{label}</output>
      <button
        onClick={() => setCount(count + 1)}
        disabled={count >= MAX_SERVINGS}
        aria-label={`More ${what}`}
      >
        +
      </button>
    </span>
  );
}
