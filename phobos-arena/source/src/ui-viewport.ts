/** Fit menu/dialog UI to the visible browser area without resizing game rendering. */
export function bindUiViewport(root: HTMLElement): () => void {
  const host = window;
  const viewport = host.visualViewport;
  let frame: number | null = null;
  let disposed = false;

  const dimension = (visible: number | undefined, fallback: number): number => {
    const value = Number.isFinite(visible) && visible! > 0 ? visible! : fallback;
    return Number.isFinite(value) && value > 0 ? Math.max(1, value) : 1;
  };
  const offset = (value: number | undefined): number =>
    Number.isFinite(value) ? Math.max(0, value!) : 0;

  const sync = () => {
    frame = null;
    if (disposed) return;
    const width = dimension(viewport?.width, host.innerWidth);
    const height = dimension(viewport?.height, host.innerHeight);
    root.style.setProperty("--ui-width", `${width}px`);
    root.style.setProperty("--ui-height", `${height}px`);
    root.style.setProperty("--ui-left", `${offset(viewport?.offsetLeft)}px`);
    root.style.setProperty("--ui-top", `${offset(viewport?.offsetTop)}px`);
    root.classList.toggle("compact-ui", width <= 1100 && (height <= 520 || width <= 700));
    root.classList.toggle("narrow-ui", width < 560 || (width < 700 && height > width));
  };
  const schedule = () => {
    if (!disposed && frame === null) frame = host.requestAnimationFrame(sync);
  };

  sync();
  host.addEventListener("resize", schedule);
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);

  return () => {
    disposed = true;
    host.removeEventListener("resize", schedule);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    if (frame !== null) host.cancelAnimationFrame(frame);
    frame = null;
  };
}
