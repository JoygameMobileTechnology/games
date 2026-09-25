import React, { useLayoutEffect, useRef, useState } from 'react';
import './board-surface.css';

function validArtwork(art) {
  return typeof art?.src === 'string' && art.src.length > 0
    && Number.isFinite(art.width) && art.width > 0
    && Number.isFinite(art.height) && art.height > 0;
}

function selectArtwork(variants, width, height) {
  const candidates = Object.entries(variants || {}).filter(([, art]) => validArtwork(art));
  if (!candidates.length) return null;
  const fallback = candidates.find(([name]) => name === 'portrait') || candidates[0];
  const aspect = width > 0 && height > 0 ? width / height : fallback[1].width / fallback[1].height;
  let selected = null;
  let smallestDifference = Infinity;
  for (const [name, art] of candidates) {
    // Log distance treats equally large proportional crops in either axis alike.
    const difference = Math.abs(Math.log(aspect / (art.width / art.height)));
    if (difference < smallestDifference) {
      selected = { name, art };
      smallestDifference = difference;
    }
  }
  return selected;
}

/**
 * One continuous, proportionally scaled image. Choose the closest source aspect
 * from every supplied variant to minimize the centered cover crop.
 */
export function BoardSurface({ variants }) {
  const surfaceRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const updateSize = (width, height) => {
      setSize(previous => previous.width === width && previous.height === height
        ? previous : { width, height });
    };
    const measure = () => {
      const { width, height } = surface.getBoundingClientRect();
      updateSize(width, height);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const selected = selectArtwork(variants, size.width, size.height);

  return <div
    ref={surfaceRef}
    className="table-surface art-frame"
    aria-hidden="true"
    data-surface-variant={selected?.name}
    style={selected ? {
      '--surface-image': `url(${JSON.stringify(new URL(selected.art.src, document.baseURI).href)})`,
    } : undefined}
  />;
}

export default BoardSurface;
