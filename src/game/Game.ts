import { Scene, type WebGLRenderer } from 'three';
import { Sound, stereoPan } from '../audio/Sound';
import { Candles } from '../entities/Candles';
import { Flare } from '../entities/Flare';
import { Ghosts } from '../entities/Ghosts';
import { Player } from '../entities/Player';
import { Shrines } from '../entities/Shrines';
import { FpsMeter } from '../ui/FpsMeter';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { SPAWN } from '../world/layout';
import { World } from '../world/World';
import { FLARE, GHOST, SHRINE } from './config';
import { GameState } from './GameState';
import { Input } from './Input';
import { Loop } from './Loop';
import { createRenderer } from './renderer';
import { ThirdPersonCamera } from './ThirdPersonCamera';

/** After a click, keep the screens down this long while the browser grants pointer lock. */
const LOCK_GRACE_MS = 500;

/** Owns the renderer and wires world, player, candles, ghosts, shrines, camera, input, UI and sound. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly input: Input;
  private readonly cameraRig: ThirdPersonCamera;
  private readonly world: World;
  private readonly player = new Player();
  private readonly candles: Candles;
  private readonly ghosts = new Ghosts();
  private readonly shrines = new Shrines();
  private readonly flare = new Flare();
  private readonly state = new GameState();
  private readonly sound = new Sound();
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly fps: FpsMeter;
  private readonly loop: Loop;
  private lockRequestedAt = -Infinity;

  constructor(container: HTMLElement) {
    this.renderer = createRenderer(container);
    this.world = new World(this.scene);
    this.candles = new Candles(this.world);
    this.scene.add(this.player.root, this.candles.group, this.ghosts.group, this.shrines.group, this.flare.group);

    this.cameraRig = new ThirdPersonCamera(window.innerWidth / window.innerHeight);
    this.input = new Input(this.renderer.domElement);
    this.hud = new Hud(container, this.state.maxLives);
    this.screens = new Screens(container, {
      onPlay: () => this.requestPlay(this.state.isOver),
      onRestart: () => this.requestPlay(true),
    });
    this.fps = new FpsMeter(container, this.renderer);

    // Browsers only let audio start from a user gesture.
    const unlockAudio = (): void => this.sound.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('resize', this.onResize);
    this.loop = new Loop(this.frame);
    this.restart();
  }

  start(): void {
    // Compile every shader up front so the first frames don't stutter.
    this.renderer.compile(this.scene, this.cameraRig.camera);
    this.loop.start();
  }

  /** Resets everything for a new round, which begins once the mouse is captured. */
  restart(): void {
    this.state.reset();
    this.player.respawn(SPAWN.x, SPAWN.z);
    this.cameraRig.reset();
    this.candles.spawn(Math.random);
    this.candles.update(0, 0, this.player.position, false);
    this.ghosts.spawn();
    this.ghosts.update(0, 0, this.player.position, false);
    this.shrines.reset();
    this.flare.reset();
    this.hud.update(this.state, this.flare.fuel);
    this.cameraRig.update(0, this.player.position, this.world.cameraBlockers);
    this.world.update(this.cameraRig.camera);
  }

  /** Starts the clock. Ghosts that drifted close during the title screen scatter first. */
  beginRound(): void {
    this.state.begin();
    this.ghosts.repel(this.player.position, GHOST.minSpawnDistance, 0, GHOST.retreatTime);
  }

  private readonly frame = (dt: number, elapsed: number): void => {
    const locked = this.input.pointerLocked;
    if (locked && this.state.status === 'ready') this.beginRound();
    // Only a round in progress pauses when the mouse is released; the title and end screens stay alive.
    if (locked || this.state.status !== 'playing') this.simulate(dt, elapsed);
    if (this.input.wasPressed('KeyM')) this.sound.toggleMute();

    const captured = locked || performance.now() - this.lockRequestedAt < LOCK_GRACE_MS;
    this.screens.update(this.state, captured, this.sound.isMuted);
    this.hud.setVisible(this.state.status !== 'ready');
    this.renderer.render(this.scene, this.cameraRig.camera);
    this.fps.tick(dt);
    this.input.endFrame();
  };

  /** Advances the game one step. Public so dev tools can drive it without pointer lock. */
  simulate(dt: number, elapsed: number): void {
    const { dx, dy } = this.input.consumeMouseDelta();
    this.cameraRig.rotate(dx, dy);

    if (this.state.status === 'playing') {
      this.play(dt, elapsed);
    } else {
      this.flare.update(dt, false, this.player.lantern);
      this.player.update(dt, elapsed, 0, this.cameraRig.yaw, this.world);
      this.candles.update(dt, elapsed, this.player.position, false);
      this.ghosts.update(dt, elapsed, this.player.position, false);
      this.shrines.update(dt, elapsed, this.player.position, false);
      const again = this.input.wasPressed('KeyR') || this.input.wasPressed('Mouse0');
      if (this.state.isOver && again) this.requestPlay(true);
    }

    this.cameraRig.update(dt, this.player.position, this.world.cameraBlockers);
    this.world.update(this.cameraRig.camera);
    this.hud.update(this.state, this.flare.fuel);
  }

  /** One step of a round in progress. */
  private play(dt: number, elapsed: number): void {
    if (this.input.wasPressed('Space')) this.fireFlare();
    this.flare.update(dt, true, this.player.lantern);
    // A/D turn the player and camera together; W/S walk along that facing.
    const move = this.input.moveAxis();
    this.cameraRig.turn(move.x, dt);
    this.player.update(dt, elapsed, move.y, this.cameraRig.yaw, this.world);

    const gathered = this.candles.update(dt, elapsed, this.player.position, true);
    for (let i = 0; i < gathered; i++) {
      this.state.collect();
      this.sound.candle(this.state.score);
    }
    if (gathered > 0) this.hud.pulseSouls();

    const wantsOil = this.flare.fuel <= FLARE.maxFuel - SHRINE.minRefill;
    if (this.shrines.update(dt, elapsed, this.player.position, wantsOil)) {
      this.flare.refill();
      this.hud.pulseFuel();
      this.sound.refill();
    }

    this.handleGhosts(dt, elapsed);
    this.state.tick(dt);
    this.sound.clock(this.state.timeLeft, this.state.isWarning);
    if (this.state.isOver) this.sound.roundEnd(this.state.status);
  }

  private fireFlare(): void {
    const result = this.flare.trigger(this.player.position);
    if (result === 'fired') {
      this.ghosts.repel(this.player.position, FLARE.radius, FLARE.push, FLARE.scareTime);
      this.sound.flare();
    } else if (result === 'empty') {
      this.hud.denyFlare();
      this.sound.fizzle();
    }
  }

  /** Moves the ghosts; a touch costs a life unless the player is still blinking. */
  private handleGhosts(dt: number, elapsed: number): void {
    const toucher = this.ghosts.update(dt, elapsed, this.player.position, this.state.status === 'playing');
    const spotter = this.ghosts.spotted[0];
    if (spotter) this.sound.wail(stereoPan(this.player.position, this.cameraRig.yaw, spotter));
    if (!toucher) return;
    // Any touch sends the ghost fleeing, so it can't sit on the player until the grace period ends.
    this.ghosts.scare(toucher);
    if (!this.player.canBeHurt) return;
    this.player.hurt(toucher.x, toucher.z);
    this.state.loseLife();
    this.hud.flashHurt();
    this.sound.hurt();
  }

  /** A click on a screen (or R once a round is over): optionally restart, then capture the mouse. */
  private requestPlay(restart: boolean): void {
    if (restart) this.restart();
    if (this.input.pointerLocked) return;
    this.lockRequestedAt = performance.now();
    this.input.requestPointerLock();
  }

  private readonly onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraRig.setAspect(window.innerWidth / window.innerHeight);
  };
}
