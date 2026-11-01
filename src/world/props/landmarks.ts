import {
  AdditiveBlending,
  type BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from 'three';
import { mergeParts, paint } from './geometry';
import { getGlowTexture } from './glowTexture';
import { STREET_Y } from './obstacles';
import { SITES } from './sites';

const EYE = { ...SITES.eye, radius: 60, hubHeight: 70 };

/** An additive glow sprite, unfogged so it reads from far away. Shared by the landmark builders. */
export function glow(color: number, size: number): Sprite {
  const sprite = new Sprite(
    new SpriteMaterial({ map: getGlowTexture(), color, blending: AdditiveBlending, depthWrite: false, fog: false }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

/** The London Eye: rim, spokes, lit pods and an A-frame. Returns the wheel to spin. */
export function createLondonEye(): { group: Group; wheel: Group } {
  const group = new Group();
  const wheel = new Group();
  const r = EYE.radius;
  const steel = new MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.6, roughness: 0.4 });

  const frame: BufferGeometry[] = [
    new TorusGeometry(r, 0.7, 6, 96),
    new TorusGeometry(r - 5, 0.35, 6, 96),
    new CylinderGeometry(2.2, 2.2, 6, 16).rotateX(Math.PI / 2),
  ];
  const pods: BufferGeometry[] = [];
  const PODS = 32;
  for (let i = 0; i < PODS; i++) {
    const a = (i / PODS) * Math.PI * 2;
    const spoke = new CylinderGeometry(0.12, 0.12, r, 4).translate(0, r / 2, 0).rotateZ(a);
    frame.push(spoke);
    pods.push(new SphereGeometry(1.6, 10, 8).scale(1.5, 1, 1).translate(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2), 0));
  }
  for (const g of [...frame, ...pods]) g.deleteAttribute('uv');
  wheel.add(new Mesh(mergeParts(frame.map((g) => paint(g, 0xffffff))), steel));
  // Pods and rim lights are lit Halloween orange.
  wheel.add(new Mesh(mergeParts(pods.map((g) => paint(g, 0xffffff))), new MeshBasicMaterial({ color: 0xff9440 })));
  wheel.add(new Mesh(new TorusGeometry(r + 0.9, 0.25, 4, 128), new MeshBasicMaterial({ color: 0xc86bff })));
  wheel.position.y = EYE.hubHeight;
  group.add(wheel);

  // A-frame legs from the hub down to the riverbank.
  const legs = [-1, 1].map((side) => {
    const len = Math.hypot(EYE.hubHeight, 28);
    const leg = new CylinderGeometry(1.2, 1.6, len, 8).rotateX(side * Math.atan2(28, EYE.hubHeight));
    leg.translate(0, EYE.hubHeight / 2, side * -14);
    leg.deleteAttribute('uv');
    return paint(leg, 0xffffff);
  });
  group.add(new Mesh(mergeParts(legs), steel));

  group.position.set(EYE.x, STREET_Y, -EYE.at);
  group.rotation.y = 0.55; // turned towards the line so it reads as a wheel, not a stripe
  return { group, wheel };
}
