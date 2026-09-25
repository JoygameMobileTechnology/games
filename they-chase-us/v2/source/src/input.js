// Single Pointer Events layer for touch and mouse. Scrolling, zoom and context menu are disabled.
export class Input {
  constructor(el) {
    this.el = el;
    this.down = false;
    this.id = -1;
    this.x = 0; this.y = 0;
    this.startX = 0; this.startY = 0;
    this.dx = 0;            // px moved since down
    this.frameDx = 0;       // px moved since last consume
    this.pressTime = 0;
    this.locked = false;    // during card input lock: ignore everything, a release while locked is dropped
    this.pendingDown = false; // a fresh press happened since last consume
    this.pendingUp = false;
    this.upWasFresh = false;
    this.freshPress = false; // true if the current press started while not locked
    this.onDown = null; this.onUp = null; this.onMove = null; this.onTap = null;
    this.width = () => el.clientWidth || window.innerWidth;

    const opts = { passive: false };
    el.addEventListener('pointerdown', (e) => this._down(e), opts);
    window.addEventListener('pointermove', (e) => this._move(e), opts);
    window.addEventListener('pointerup', (e) => this._up(e), opts);
    window.addEventListener('pointercancel', (e) => this._up(e), opts);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, opts);
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener('blur', () => { if (this.down) this._release(); });
  }

  _isUi(e) {
    const t = e.target;
    return t && t.closest && t.closest('.ui-block');
  }

  _down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (this.down) return;
    if (this._isUi(e)) return; // DOM buttons handle themselves
    e.preventDefault();
    this.down = true; this.id = e.pointerId;
    this.x = e.clientX; this.y = e.clientY;
    this.startX = this.x; this.startY = this.y;
    this.dx = 0; this.frameDx = 0; this.pressTime = performance.now();
    this.freshPress = !this.locked;
    this.pendingDown = true;
    if (this.onDown && !this.locked) this.onDown(this);
  }

  _move(e) {
    if (!this.down || e.pointerId !== this.id) return;
    const nx = e.clientX;
    this.frameDx += nx - this.x;
    this.x = nx; this.y = e.clientY;
    this.dx = this.x - this.startX;
    if (this.onMove && !this.locked) this.onMove(this);
  }

  _up(e) {
    if (!this.down || e.pointerId !== this.id) return;
    this._release();
  }

  _release() {
    this.down = false; this.id = -1;
    this.pendingUp = true;
    this.upWasFresh = this.freshPress && !this.locked;
    if (this.onUp) this.onUp(this, this.upWasFresh);
    this.freshPress = false;
  }

  // consume per-frame deltas
  consumeDx() { const d = this.frameDx; this.frameDx = 0; return d; }
  consumeDown() { const d = this.pendingDown; this.pendingDown = false; return d; }
  consumeUp() { const d = this.pendingUp; this.pendingUp = false; return d; }

  lock() { this.locked = true; this.pendingDown = false; this.pendingUp = false; }
  unlock() { this.locked = false; this.freshPress = false; }
  heldSeconds() { return this.down ? (performance.now() - this.pressTime) / 1000 : 0; }
}
