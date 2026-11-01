import {
  AdditiveBlending,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  type Vector3,
} from 'three';
import { FLARE } from '../game/config';
import { getGlowTexture } from '../world/props/glowTexture';
import type { Lantern } from './Lantern';

/** Seconds the shockwave ring takes to sweep out to the flare radius. */
const RING_SECONDS = 0.5;
/** How quickly the lantern's flash fades (per second, exponential). */
const FLASH_DECAY = 4;
/** Seconds the flame gutters after trying to flare with too little oil. */
const SPUTTER_SECONDS = 0.4;
const FLARE_COLOR = 0xffb860;

export type FlareResult = 'fired' | 'empty' | 'cooling';

/**
 * The lantern's oil and its flare. A flare blazes the lantern light and sends
 * a ring of fire across the ground; the caller blows nearby ghosts back.
 * The ring and burst stay in the scene at zero opacity so their shaders are
 * compiled up front.
 */
export class Flare {
  readonly group = new Group();
  fuel: number = FLARE.maxFuel;
  private cooldown = 0;
  private age = Infinity;
  private sputter = 0;
  private readonly ring: Mesh;
  private readonly ringMaterial: MeshBasicMaterial;
  private readonly burst: Sprite;

  constructor() {
    this.ringMaterial = new MeshBasicMaterial({
      color: FLARE_COLOR,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.ring = new Mesh(new RingGeometry(0.86, 1, 64).rotateX(-Math.PI / 2), this.ringMaterial);
    this.burst = new Sprite(
      new SpriteMaterial({
        map: getGlowTexture(),
        color: FLARE_COLOR,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.group.add(this.ring, this.burst);
  }

  reset(): void {
    this.fuel = FLARE.maxFuel;
    this.cooldown = 0;
    this.age = Infinity;
    this.sputter = 0;
  }

  /** Flares at `at` if there is oil and the cooldown has passed; an empty lantern sputters. */
  trigger(at: Vector3): FlareResult {
    if (this.cooldown > 0) return 'cooling';
    if (this.fuel < FLARE.cost) {
      this.sputter = SPUTTER_SECONDS;
      return 'empty';
    }
    this.fuel -= FLARE.cost;
    this.cooldown = FLARE.cooldown;
    this.age = 0;
    this.ring.position.set(at.x, 0.06, at.z);
    this.burst.position.set(at.x, 1, at.z);
    return 'fired';
  }

  refill(): void {
    this.fuel = FLARE.maxFuel;
  }

  /** Burns oil while `burning`, animates the flare, and sets the lantern's power and flash. */
  update(dt: number, burning: boolean, lantern: Lantern): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sputter = Math.max(0, this.sputter - dt);
    if (burning) this.fuel = Math.max(0, this.fuel - FLARE.burnRate * dt);
    this.age += dt;

    const t = Math.min(this.age / RING_SECONDS, 1);
    const ease = 1 - (1 - t) ** 3;
    this.ring.scale.setScalar(0.3 + ease * (FLARE.radius - 0.3));
    this.ringMaterial.opacity = 0.9 * (1 - t);
    this.burst.scale.setScalar(1 + ease * 8);
    this.burst.material.opacity = 1 - t;

    const oil = MathUtils.smoothstep(this.fuel, 0, FLARE.dimBelow);
    const gutter = this.sputter > 0 ? 0.3 + Math.random() * 0.4 : 1;
    lantern.power = (0.45 + 0.55 * oil) * gutter;
    lantern.flash = Math.exp(-this.age * FLASH_DECAY);
  }
}
