/** Keys whose default browser action (scrolling) should be suppressed. */
const CAPTURED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
/** How far a finger must travel (CSS px) to count as a swipe. */
const SWIPE_DISTANCE = 28;

/** The runner's moves this frame; each is true only on the frame its key went down. */
export interface RunInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  slide: boolean;
}

/**
 * Keyboard and touch input. Keys are KeyboardEvent.code values; a swipe registers
 * as a one-frame press of 'SwipeLeft', 'SwipeRight', 'SwipeUp' or 'SwipeDown'.
 * The mouse isn't needed to play.
 */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private touch: { x: number; y: number; id: number; swiped: boolean } | null = null;

  /** `gameArea` is the canvas: swipes that start on it never scroll or zoom the page. */
  constructor(private readonly gameArea: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(...codes: string[]): boolean {
    return codes.some((code) => this.pressed.has(code));
  }

  actions(): RunInput {
    return {
      left: this.wasPressed('KeyA', 'ArrowLeft', 'SwipeLeft'),
      right: this.wasPressed('KeyD', 'ArrowRight', 'SwipeRight'),
      jump: this.wasPressed('KeyW', 'ArrowUp', 'Space', 'SwipeUp'),
      slide: this.wasPressed('KeyS', 'ArrowDown', 'SwipeDown'),
    };
  }

  /** Call once at the end of every frame (or to swallow a key press that was already handled). */
  endFrame(): void {
    this.pressed.clear();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.down.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.down.clear();
  };

  private readonly onTouchStart = (e: TouchEvent): void => {
    const t = e.changedTouches[0];
    if (t) this.touch = { x: t.clientX, y: t.clientY, id: t.identifier, swiped: false };
  };

  /** One swipe per touch, decided as soon as the finger has moved far enough. */
  private readonly onTouchMove = (e: TouchEvent): void => {
    const start = this.touch;
    const t = start && Array.from(e.changedTouches).find((c) => c.identifier === start.id);
    if (!start || !t) return;
    if (e.target === this.gameArea && e.cancelable) e.preventDefault(); // no scrolling or pull-to-refresh
    if (start.swiped) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
    start.swiped = true;
    this.pressed.add(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'SwipeLeft' : 'SwipeRight') : dy < 0 ? 'SwipeUp' : 'SwipeDown');
  };

  private readonly onTouchEnd = (): void => {
    this.touch = null;
  };
}
