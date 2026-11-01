import { Scene, type WebGLRenderer } from 'three';
import { Sound } from '../audio/Sound';
import { Runner, type RunnerEvents } from '../entities/Runner';
import { FpsMeter } from '../ui/FpsMeter';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { Course } from '../world/course';
import { World } from '../world/World';
import { ChaseCamera } from './ChaseCamera';
import { ROUTE, TRAIN } from './config';
import { GameState } from './GameState';
import { Input } from './Input';
import { Loop } from './Loop';
import { createRenderer } from './renderer';

/** Owns the renderer and wires the course, world, runner, camera, input, UI and sound together. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly input = new Input();
  private readonly camera: ChaseCamera;
  private readonly world: World;
  private readonly course = new Course();
  private readonly runner = new Runner();
  private readonly state = new GameState();
  private readonly sound = new Sound();
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly fps: FpsMeter;
  private readonly loop: Loop;
  private paused = false;
  /** Index of the last carriage coupling passed, for the clickety-clack. */
  private lastJoint = 0;
  /** Milestones already announced this run. */
  private readonly milestones = new Set<string>();

  constructor(container: HTMLElement) {
    this.renderer = createRenderer(container);
    this.world = new World(this.scene);
    this.scene.add(this.runner.root);
    this.camera = new ChaseCamera(window.innerWidth / window.innerHeight);
    this.hud = new Hud(container);
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
    this.lastJoint = 0;
    this.milestones.clear();
    this.hud.clearToast();
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
    this.renderer.render(this.scene, this.camera.camera);
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
      state.advance(dt);
      this.course.update(state.distance);
      const events = this.runner.run(dt, elapsed, this.input.actions(), state.distance, state.speed, this.course);
      this.playSounds(events);
      if (events.crashed) {
        state.crash(events.crashed);
        this.sound.crash(events.crashed);
        this.hud.flashCrash();
      } else if (state.isOver) {
        this.sound.arrive(); // advance() ended the run by reaching the station
      } else {
        this.announceMilestones();
      }
    } else {
      this.runner.idle(dt, elapsed);
    }
    this.camera.update(dt, this.runner.position, state.pace);
    this.world.update(dt, this.camera.camera, state.distance, this.course);
    this.hud.update(state);
  }

  /** Short toasts under the route bar as the run passes its milestones. */
  private announceMilestones(): void {
    const state = this.state;
    const once = (id: string, reached: boolean, text: string): void => {
      if (!reached || this.milestones.has(id)) return;
      this.milestones.add(id);
      this.hud.toast(text);
    };
    once('half', state.progress >= 0.5, `Halfway to ${ROUTE.to}`);
    once('sight', state.remaining <= 250, `${ROUTE.to} in sight!`);
    once('best', state.isNewBest, 'New best run!');
  }

  private playSounds(events: RunnerEvents): void {
    if (events.jumped) this.sound.jump();
    if (events.landed) this.sound.land();
    if (events.slid) this.sound.slide();
    if (events.switched) this.sound.lane();
    // A clack at every carriage coupling the runner passes over.
    const joint = Math.floor(this.state.distance / TRAIN.blockLength);
    if (joint !== this.lastJoint) {
      this.lastJoint = joint;
      this.sound.clack(this.state.pace);
    }
  }

  private readonly onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.setAspect(window.innerWidth / window.innerHeight);
  };
}
