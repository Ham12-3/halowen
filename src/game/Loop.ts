/** Longest step we simulate; stops tab-switches from teleporting entities. */
const MAX_DT = 0.05;

export type TickFn = (dt: number, elapsed: number) => void;

/** requestAnimationFrame loop with a clamped delta time. */
export class Loop {
  private rafId = 0;
  private last = 0;
  private elapsed = 0;
  private running = false;

  constructor(private readonly tick: TickFn) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, MAX_DT);
    this.last = now;
    this.elapsed += dt;
    this.tick(dt, this.elapsed);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
