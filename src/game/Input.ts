/** Keys whose default browser action (scrolling) should be suppressed. */
const CAPTURED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** The runner's moves this frame; each is true only on the frame its key went down. */
export interface RunInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  slide: boolean;
}

/** Keyboard state. Keys are KeyboardEvent.code values. The mouse isn't needed to play. */
export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
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
      left: this.wasPressed('KeyA', 'ArrowLeft'),
      right: this.wasPressed('KeyD', 'ArrowRight'),
      jump: this.wasPressed('KeyW', 'ArrowUp', 'Space'),
      slide: this.wasPressed('KeyS', 'ArrowDown'),
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
}
