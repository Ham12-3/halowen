/** Chrome occasionally reports huge movementX spikes right after locking; ignore them. */
const MAX_MOUSE_DELTA = 250;

/** Keys whose default browser action (scrolling, find-next) should be suppressed. */
const CAPTURED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export interface MoveAxis {
  /** -1 = strafe left, 1 = strafe right. */
  x: number;
  /** -1 = backwards, 1 = forwards. */
  y: number;
}

/** Keyboard state plus pointer-locked mouse look. Keys are KeyboardEvent.code values. */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private lockListeners: Array<(locked: boolean) => void> = [];

  constructor(private readonly lockTarget: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.handleLockChange);
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.lockTarget;
  }

  requestPointerLock(): void {
    // Newer browsers return a promise that rejects if the user re-locks too quickly.
    Promise.resolve(this.lockTarget.requestPointerLock()).catch(() => undefined);
  }

  onLockChange(listener: (locked: boolean) => void): void {
    this.lockListeners.push(listener);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  moveAxis(): MoveAxis {
    const axis = (pos: string[], neg: string[]): number =>
      (pos.some((k) => this.down.has(k)) ? 1 : 0) - (neg.some((k) => this.down.has(k)) ? 1 : 0);
    return {
      x: axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
      y: axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    };
  }

  /** Returns mouse movement since the last call and resets it. */
  consumeMouseDelta(): { dx: number; dy: number } {
    const delta = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return delta;
  }

  /** Call once at the end of every frame. */
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

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private readonly handleLockChange = (): void => {
    const locked = this.pointerLocked;
    if (!locked) this.down.clear();
    for (const listener of this.lockListeners) listener(locked);
  };
}
