import { Scene, type WebGLRenderer } from 'three';
import { Sound } from '../audio/Sound';
import { Runner } from '../entities/Runner';
import { FpsMeter } from '../ui/FpsMeter';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { Course } from '../world/course';
import { banishGhosts } from '../world/hazards';
import { Particles } from '../world/Particles';
import { World } from '../world/World';
import { ChaseCamera } from './ChaseCamera';
import { FLARE } from './config';
import { checkContacts } from './contacts';
import { type CrashCause, GameState } from './GameState';
import { Input } from './Input';
import { Loop } from './Loop';
import { RenderPipeline } from './postfx';
import { createRenderer } from './renderer';
import { RunFeedback } from './RunFeedback';

/** Owns the renderer and wires the course, world, runner, camera, input, UI and sound together. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly pipeline: RenderPipeline;
  private readonly scene = new Scene();
  private readonly input: Input;
  private readonly camera: ChaseCamera;
  private readonly world: World;
  private readonly course = new Course();
  private readonly runner = new Runner();
  private readonly particles = new Particles();
  private readonly state = new GameState();
  private readonly sound = new Sound();
  private readonly hud: Hud;
  private readonly feedback: RunFeedback;
  private readonly screens: Screens;
  private readonly fps: FpsMeter;
  private readonly loop: Loop;
  private paused = false;

  constructor(container: HTMLElement) {
    this.renderer = createRenderer(container);
    this.pipeline = new RenderPipeline(this.renderer);
    this.input = new Input(this.renderer.domElement);
    this.world = new World(this.scene, this.renderer);
    this.scene.add(this.runner.root, this.particles.points);
    this.camera = new ChaseCamera(window.innerWidth / window.innerHeight);
    this.hud = new Hud(container, () => this.pause());
    this.feedback = new RunFeedback(this.sound, this.hud, this.particles, this.camera);
    this.screens = new Screens(container, {
      onPlay: () => this.play(),
      onRestart: () => this.play(true),
      onToggleSound: () => this.sound.toggleMute(),
    });
    this.fps = new FpsMeter(container, this.renderer);

    // Browsers only let audio start from a user gesture.
    const unlockAudio = (): void => this.sound.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    // Leaving the window or tab pauses a run in progress.
    window.addEventListener('blur', () => this.pause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    window.addEventListener('resize', this.onResize);
    this.loop = new Loop(this.frame);
    this.restart();
  }

  start(): void {
    // Compile every shader up front so the first frames don't stutter.
    this.renderer.compile(this.scene, this.camera.camera);
    this.loop.start();
  }

  /** Back to the platform at London Bridge, with a freshly generated line. */
  restart(): void {
    this.state.reset();
    this.paused = false;
    this.feedback.reset();
    this.course.reset(Math.random);
    this.course.update(0);
    this.runner.reset();
    this.world.reset();
    this.camera.snap();
    this.simulate(0, 0);
  }

  /** Start, resume, or run again: a click on a screen, or Space/Enter. */
  play(restart = false): void {
    if (restart || this.state.isOver) this.restart();
    if (this.state.status === 'ready') {
      this.state.begin();
      this.sound.whistle();
    }
    this.paused = false;
    this.input.endFrame(); // swallow the key that started the run so it doesn't also jump
  }

  /** Pauses a run in progress (Esc, P, or leaving the window). */
  pause(): void {
    if (this.state.status === 'playing') this.paused = true;
  }

  private readonly frame = (dt: number, elapsed: number): void => {
    this.handleMenuKeys();
    if (!this.paused) this.simulate(dt, elapsed);
    this.screens.update(this.state, this.paused, this.sound.isMuted);
    this.hud.setVisible(this.state.status !== 'ready');
    document.body.classList.toggle('running', this.state.status === 'playing' && !this.paused);
    this.pipeline.render(this.scene, this.camera.camera, elapsed, dt);
    this.fps.tick(dt);
    this.input.endFrame();
  };

  /** Pause, mute, and Space/Enter (or R at the end) to start or run again. */
  private handleMenuKeys(): void {
    const input = this.input;
    if (input.wasPressed('KeyM')) this.sound.toggleMute();
    const go = input.wasPressed('Space', 'Enter');
    if (this.state.status === 'playing') {
      if (input.wasPressed('Escape', 'KeyP')) {
        if (this.paused) this.play();
        else this.pause();
      } else if (this.paused && go) {
        this.play();
      }
    } else if (go || (this.state.isOver && input.wasPressed('KeyR'))) {
      this.play();
    }
  }

  /** Advances the game one step. Public so dev tools can drive it. */
  simulate(dt: number, elapsed: number): void {
    const state = this.state;
    if (state.status === 'playing') {
      const station = state.advance(dt);
      this.course.update(state.distance);
      const events = this.runner.run(dt, elapsed, this.input.actions(), state.distance, state.speed, this.course);
      const contacts = checkContacts(this.runner, this.course, state.distance, state.flaring);
      const at = this.runner.position;
      state.collect(contacts.souls);
      if (contacts.lanterns > 0) {
        state.startFlare();
        this.feedback.flare(at);
      }
      if (state.flaring) {
        const banished = banishGhosts(this.course, state.distance, FLARE.reach);
        state.banish(banished.length);
        this.feedback.banished(banished, state.distance);
      }
      // The flare blazes the lantern while it burns.
      this.runner.lantern.flash = state.flaring ? 0.3 + Math.sin(elapsed * 9) * 0.06 : 0;

      const hit = events.fell ? 'fell' : contacts.hit;
      if (state.isOver) this.feedback.arrived(at); // advance() ended the run at the last station
      else if (hit) this.loseLife(hit);
      else this.feedback.step(events, contacts.souls, station, state, this.course, at);
    } else {
      this.runner.idle(dt, elapsed);
    }
    this.particles.update(dt);
    this.camera.update(dt, this.runner.position, state.pace);
    this.world.update(dt, elapsed, this.camera.camera, state.distance, this.course);
    this.hud.update(state);
  }

  /** A hit costs a life (you blink, slow down, and get put back on a roof if you fell); the last one ends the run. */
  private loseLife(cause: CrashCause): void {
    const fell = cause === 'fell';
    if (this.state.loseLife(cause)) {
      this.runner.knockOut(fell);
      this.feedback.crashed(cause, this.runner.position);
      return;
    }
    this.feedback.hurt(cause, this.state.lives, this.runner.position);
    this.runner.recover(fell, this.course, this.state.distance);
  }

  private readonly onResize = (): void => {
    this.pipeline.setSize(window.innerWidth, window.innerHeight);
    this.camera.setAspect(window.innerWidth / window.innerHeight);
  };
}
