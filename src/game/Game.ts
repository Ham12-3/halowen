import { ACESFilmicToneMapping, PCFShadowMap, Scene, WebGLRenderer } from 'three';
import { Player } from '../entities/Player';
import { FpsMeter } from '../ui/FpsMeter';
import { LockPrompt } from '../ui/LockPrompt';
import { SPAWN } from '../world/layout';
import { World } from '../world/World';
import { RENDER } from './config';
import { Input } from './Input';
import { Loop } from './Loop';
import { ThirdPersonCamera } from './ThirdPersonCamera';

/** Owns the renderer and wires world, player, camera and input together. */
export class Game {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly input: Input;
  private readonly cameraRig: ThirdPersonCamera;
  private readonly world: World;
  private readonly player: Player;
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
    this.player.position.set(SPAWN.x, 0, SPAWN.z);
    this.scene.add(this.player.root);

    this.cameraRig = new ThirdPersonCamera(window.innerWidth / window.innerHeight);
    this.input = new Input(this.renderer.domElement);
    new LockPrompt(container, this.input);
    this.fps = new FpsMeter(container, this.renderer);

    window.addEventListener('resize', this.onResize);
    this.loop = new Loop(this.update);
  }

  start(): void {
    // Compile every shader up front so the first frames don't stutter.
    this.cameraRig.update(0, this.player.position);
    this.renderer.compile(this.scene, this.cameraRig.camera);
    this.loop.start();
  }

  private readonly update = (dt: number, elapsed: number): void => {
    const { dx, dy } = this.input.consumeMouseDelta();
    this.cameraRig.rotate(dx, dy);
    this.player.update(dt, elapsed, this.input.moveAxis(), this.cameraRig.yaw, this.world);
    this.cameraRig.update(dt, this.player.position, this.world.cameraBlockers);
    this.world.update(this.cameraRig.camera);

    this.renderer.render(this.scene, this.cameraRig.camera);
    this.fps.tick(dt);
    this.input.endFrame();
  };

  private readonly onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraRig.setAspect(window.innerWidth / window.innerHeight);
  };
}
