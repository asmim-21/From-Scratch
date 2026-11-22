import type { CSSProperties } from 'react';
import type { Photo } from '../generated/types';
import { asset } from '../lib/content';
import { hash, Washi } from './decor';

/** A photo printed and taped into the book, or an empty frame waiting for one. */
export function PhotoPrint({ photo, name }: { photo: Photo | null; name: string }) {
  const seed = hash(name);
  const tilt = ((seed % 41) - 20) / 10; // −2° to 2°
  // Very tall or very wide photos are cropped a little so they sit nicely.
  const ratio = photo ? Math.min(1.5, Math.max(0.75, photo.width / photo.height)) : 1.28;
  const style = { '--ratio': ratio, '--tilt': `${tilt}deg` } as CSSProperties;
  return (
    <div className="print-area">
      <figure className={`print ${photo ? '' : 'print--empty'}`} style={style}>
        {photo ? (
          <img
            src={asset(photo.small)}
            srcSet={`${asset(photo.small)} 800w, ${asset(photo.large)} 1600w`}
            sizes="(max-width: 599px) 90vw, 560px"
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className="print__blank">
            <span>photo coming soon</span>
          </div>
        )}
        <Washi seed={seed >>> 4} className={seed & 8 ? 'print__tape' : 'print__tape print__tape--left'} />
      </figure>
    </div>
  );
}
