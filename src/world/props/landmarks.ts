import {
  AdditiveBlending,
  type BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import { ROUTE } from '../../game/config';
import { mergeParts, paint } from './geometry';
import { getGlowTexture } from './glowTexture';
import { STREET_Y } from './obstacles';

/** Where the big landmarks stand: `at` is distance along the route, x is the side offset. */
/** Ahead and to the left at the start, inside the camera's view (London Bridge station sits at its foot). */
export const SHARD = { at: 280, x: -62, height: 300 };
export const EYE = { at: 1830, x: -125, radius: 60, hubHeight: 70 };
/** The station mouth, where the run ends. */
export const STATION_AT = ROUTE.length - 10;

/** Ground the skyline must leave free around each landmark (circle centres in world x/z). */
const FOOTPRINTS = [
  { x: SHARD.x, z: -SHARD.at, r: 42 },
  { x: EYE.x, z: -EYE.at, r: 80 },
];

/** True if a building of radius `r` at (x, z) keeps clear of every landmark and the station. */
export function landmarkClear(x: number, z: number, r: number): boolean {
  if (-z > STATION_AT - 30 && -z < STATION_AT + 140 && Math.abs(x) < 46 + r) return false;
  return FOOTPRINTS.every((f) => Math.hypot(x - f.x, z - f.z) > f.r + r);
}

function glow(color: number, size: number): Sprite {
  const sprite = new Sprite(
    new SpriteMaterial({ map: getGlowTexture(), color, blending: AdditiveBlending, depthWrite: false, fog: false }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

/** Bands of lit floors climbing the Shard's glass. */
function shardTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 6) {
    for (let x = 0; x < 64; x += 4) {
      if (Math.random() < 0.28) {
        ctx.fillStyle = Math.random() < 0.8 ? '#cfe2ff' : '#ffc37a';
        ctx.fillRect(x, y, 3, 3);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The Shard: a four-sided glass spike whose top splinters into shards, with a beacon. */
export function createShard(): Group {
  const group = new Group();
  const h = SHARD.height;
  const body = new ConeGeometry(30, h * 0.9, 4, 1, true).rotateY(Math.PI / 4).translate(0, (h * 0.9) / 2, 0);
  const glass = new MeshStandardMaterial({
    color: 0x5c6c88,
    metalness: 0.7,
    roughness: 0.25,
    emissive: 0xffffff,
    emissiveMap: shardTexture(),
    emissiveIntensity: 0.9,
  });
  group.add(new Mesh(body, glass));
  // The splintered crown: four slim shards leaning out from the top.
  const crown: BufferGeometry[] = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const shard = new ConeGeometry(2.2, h * 0.16, 3).rotateZ(0.04).rotateY(a);
    shard.translate(Math.cos(a) * 2.2, h * 0.86 + (i % 2) * 6, Math.sin(a) * 2.2);
    shard.deleteAttribute('uv');
    return paint(shard, 0x7d8ca8);
  });
  group.add(new Mesh(mergeParts(crown), new MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.3 })));
  const beacon = glow(0xff6a2a, 40);
  beacon.position.y = h * 0.97;
  group.add(beacon);
  group.position.set(SHARD.x, STREET_Y, -SHARD.at);
  return group;
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
