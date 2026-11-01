import { ACESFilmicToneMapping, PCFShadowMap, Scene, WebGLRenderer } from 'three';
import { Candles } from '../entities/Candles';
import { Ghosts } from '../entities/Ghosts';
import { Player } from '../entities/Player';
import { FpsMeter } from '../ui/FpsMeter';
import { Hud } from '../ui/Hud';
import { LockPrompt } from '../ui/LockPrompt';
import { SPAWN } from '../world/layout';
import { World } from '../world/World';
import { CAMERA, RENDER } from './config';
import { GameState } from './GameState';
import { Input } from './Input';
import { Loop } from './Loop';
import { ThirdPersonCamera } from './ThirdPersonCamera';

const IDLE = { x: 0, y: 0 } as const;

/** Owns the renderer and wires world, player, candles, ghosts, camera, input and HUD together. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly input: Input;
  private readonly cameraRig: ThirdPersonCamera;
  private readonly world: World;
  private readonly player: Player;
  private readonly candles: Candles;
  private readonly ghosts = new Ghosts();
  private readonly state = new GameState();
  private readonly hud: Hud;
  private readonly fps: FpsMeter;
  private readonly loop: Loop;

  constructor(container: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.world = new World(this.scene);
    this.player = new Player();
    this.scene.add(this.player.root);
    this.candles = new Candles(this.world);
    this.scene.add(this.candles.group, this.ghosts.group);

    this.cameraRig = new ThirdPersonCamera(window.innerWidth / window.innerHeight);
    this.input = new Input(this.renderer.domElement);
    this.hud = new Hud(container, this.state.maxLives);
    new LockPrompt(container, this.input);
    this.fps = new FpsMeter(container, this.renderer);

    window.addEventListener('resize', this.onResize);
    this.loop = new Loop(this.frame);
    this.restart();
  }

  start(): void {
    // Compile every shader up front so the first frames don't stutter.
    this.renderer.compile(this.scene, this.cameraRig.camera);
    this.loop.start();
  }

  /** Resets the round: fresh candles and ghosts, full lives and timer, player back at the gate. */
  restart(): void {
    this.state.reset();
    this.player.respawn(SPAWN.x, SPAWN.z);
    this.cameraRig.yaw = 0;
    this.cameraRig.pitch = CAMERA.defaultPitch;
    this.candles.spawn(Math.random);
    this.candles.update(0, 0, this.player.position, false);
    this.ghosts.spawn();
    this.ghosts.update(0, 0, this.player.position, false);
    this.hud.hideBanner();
    this.hud.update(this.state);
    this.cameraRig.update(0, this.player.position, this.world.cameraBlockers);
    this.world.update(this.cameraRig.camera);
  }

  private readonly frame = (dt: number, elapsed: number): void => {
    // The game is paused whenever the mouse is released (the overlay is up).
    if (this.input.pointerLocked) this.simulate(dt, elapsed);
    this.renderer.render(this.scene, this.cameraRig.camera);
    this.fps.tick(dt);
    this.input.endFrame();
  };

  /** Advances the game one step. Public so dev tools can drive it without pointer lock. */
  simulate(dt: number, elapsed: number): void {
    const { dx, dy } = this.input.consumeMouseDelta();
    this.cameraRig.rotate(dx, dy);

    if (this.state.status === 'playing') {
      this.player.update(dt, elapsed, this.input.moveAxis(), this.cameraRig.yaw, this.world);
      const gathered = this.candles.update(dt, elapsed, this.player.position, true);
      for (let i = 0; i < gathered; i++) this.state.collect();
      if (gathered > 0) this.hud.pulseSouls();
      this.handleGhosts(dt, elapsed);
      this.state.tick(dt);
      if (this.state.status !== 'playing') this.hud.showRoundEnd(this.state);
    } else {
      this.player.update(dt, elapsed, IDLE, this.cameraRig.yaw, this.world);
      this.candles.update(dt, elapsed, this.player.position, false);
      this.ghosts.update(dt, elapsed, this.player.position, false);
      if (this.input.wasPressed('KeyR')) this.restart();
    }

    this.cameraRig.update(dt, this.player.position, this.world.cameraBlockers);
    this.world.update(this.cameraRig.camera);
    this.hud.update(this.state);
  }

  /** Moves the ghosts; a touch costs a life unless the player is still blinking. */
  private handleGhosts(dt: number, elapsed: number): void {
    const toucher = this.ghosts.update(dt, elapsed, this.player.position, true);
    if (!toucher) return;
    // Any touch sends the ghost fleeing, so it can't sit on the player until the grace period ends.
    this.ghosts.scare(toucher);
    if (!this.player.canBeHurt) return;
    this.player.hurt(toucher.x, toucher.z);
    this.state.loseLife();
    this.hud.flashHurt();
  }

  private readonly onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraRig.setAspect(window.innerWidth / window.innerHeight);
  };
}
