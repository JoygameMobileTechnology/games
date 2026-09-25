import { useEffect, useLayoutEffect } from 'react';

const supports = (property, value) => typeof CSS !== 'undefined'
  && typeof CSS.supports === 'function' && CSS.supports(property, value);

// Older mobile browsers need an explicit viewport height and board measurement.
// Browsers with native dynamic viewport and container units keep the CSS path.
export function useViewportCompatibility(boardRef, boardReady, ratio) {
  useEffect(() => {
    if (supports('height', '100dvh')) return undefined;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--viewport-height');
    const update = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      root.style.setProperty('--viewport-height', `${height}px`);
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      if (previous) root.style.setProperty('--viewport-height', previous);
      else root.style.removeProperty('--viewport-height');
    };
  }, []);

  useLayoutEffect(() => {
    if (!boardReady || supports('width', '1cqw')) return undefined;
    const space = boardRef.current?.closest('.board-space');
    if (!space || !Number.isFinite(ratio) || ratio <= 0) return undefined;
    const update = () => {
      const { width, height } = space.getBoundingClientRect();
      const fittedWidth = `${Math.max(0, Math.min(width, height * ratio))}px`;
      if (space.style.getPropertyValue('--board-width-fallback') !== fittedWidth) {
        space.style.setProperty('--board-width-fallback', fittedWidth);
      }
    };
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(space);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      space.style.removeProperty('--board-width-fallback');
    };
  }, [boardRef, boardReady, ratio]);
}
