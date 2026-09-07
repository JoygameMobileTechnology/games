// Keep release sampling and pointer capture ownership separate from game rules.
export function bindAimInput(canvas, callbacks) {
  let drag = null;
  const release = id => {
    try { canvas.releasePointerCapture(id); } catch { /* Capture may already be gone. */ }
  };
  const cancel = () => {
    const previous = drag;
    drag = null;
    if (previous) release(previous.pointerId);
  };
  const sample = (event, gesture) => ({
    ...gesture,
    dx: event.clientX - gesture.startX,
    dy: event.clientY - gesture.startY,
    distance: Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY),
  });

  canvas.addEventListener('pointerdown', event => {
    if (drag || event.button > 0 || !callbacks.canStart(event)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    callbacks.start(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!callbacks.canContinue()) { cancel(); callbacks.cancel(); return; }
    event.preventDefault();
    callbacks.move(event, sample(event, drag));
  });
  canvas.addEventListener('pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    // A short touch gesture may deliver no pointermove. Its final sample still counts.
    const finalSample = sample(event, drag);
    // Clear ownership before release: lostpointercapture must not cancel this shot.
    drag = null;
    release(event.pointerId);
    if (!callbacks.canContinue()) { callbacks.cancel(); return; }
    callbacks.move(event, finalSample);
    callbacks.finish(event, finalSample);
  });
  const interrupted = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    cancel();
    callbacks.cancel();
  };
  canvas.addEventListener('pointercancel', interrupted);
  canvas.addEventListener('lostpointercapture', interrupted);
  return { cancel };
}
