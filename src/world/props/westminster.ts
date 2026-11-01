import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { box, mergeParts, solid } from './geometry';
import { STREET_Y } from './obstacles';
import { SITES } from './sites';

const SANDSTONE = 0xb89a62;
const SLATE = 0x4f545e;
const GOLD = 0xd9b45a;

function floodlit(): MeshStandardMaterial {
  // Westminster is floodlit gold at night.
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: 0x6a4c1e });
}

function canvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A lit clock face showing ten to midnight, of course. */
function clockFace(): CanvasTexture {
  return canvas(256, 256, (ctx) => {
    ctx.fillStyle = '#fff6dc';
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a2116';
    ctx.lineWidth = 10;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillStyle = '#2a2116';
      ctx.fillRect(128 + Math.sin(a) * 100 - 4, 128 - Math.cos(a) * 100 - 10, 8, 20);
    }
    const hand = (angle: number, length: number, width: number): void => {
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.sin(angle) * length, 128 - Math.cos(angle) * length);
      ctx.stroke();
    };
    hand(-Math.PI / 3, 92, 7); // minute hand at :50
    hand(-0.09, 60, 11); // hour hand just before twelve
  });
}

/** The Elizabeth Tower: shaft, lit clock stage, belfry and slate spire. */
export function createBigBen(): Group {
  const group = new Group();
  const shaft = 64;
  const parts: BufferGeometry[] = [
    box(11, shaft, 11, 0, shaft / 2, 0, SANDSTONE),
    box(13, 13, 13, 0, shaft + 6.5, 0, SANDSTONE), // clock stage
    box(11, 9, 11, 0, shaft + 17.5, 0, 0x9c8352), // belfry
    solid(new ConeGeometry(8.4, 22, 4).rotateY(Math.PI / 4).translate(0, shaft + 33, 0), SLATE),
    solid(new ConeGeometry(0.6, 7, 6).translate(0, shaft + 47.5, 0), GOLD),
  ];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    parts.push(solid(new ConeGeometry(0.9, 7, 4).translate(x * 6, shaft + 16.5, z * 6), SANDSTONE));
  }
  group.add(new Mesh(mergeParts(parts), floodlit()));

  // Four glowing clock faces, one on each side of the clock stage.
  const faces = [0, 1, 2, 3].map((i) =>
    new CircleGeometry(4.6, 40).translate(0, 0, 6.56).rotateY((i * Math.PI) / 2).translate(0, shaft + 6.5, 0),
  );
  group.add(new Mesh(mergeParts(faces), new MeshBasicMaterial({ map: clockFace() })));

  group.position.set(SITES.bigBen.x, STREET_Y, -SITES.bigBen.at);
  return group;
}

/** Tall lit Gothic windows in bays, for Parliament's long facade. */
function parliamentFacade(length: number): CanvasTexture {
  const texture = canvas(64, 128, (ctx) => {
    ctx.fillStyle = '#b89a62';
    ctx.fillRect(0, 0, 64, 128);
    for (const y of [10, 70]) {
      ctx.fillStyle = Math.random() < 0.8 ? '#ffd27a' : '#3a2c18';
      ctx.beginPath();
      ctx.moveTo(18, y + 46);
      ctx.lineTo(18, y + 14);
      ctx.quadraticCurveTo(32, y - 4, 46, y + 14);
      ctx.lineTo(46, y + 46);
      ctx.fill();
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(length / 6, 2);
  return texture;
}

/** The Houses of Parliament along the line: a long Gothic range, pinnacles, the Central and Victoria Towers. */
export function createParliament(): Group {
  const group = new Group();
  const { length } = SITES.parliament;
  const height = 24;
  const facade = parliamentFacade(length);
  group.add(
    new Mesh(
      new BoxGeometry(40, height, length).translate(0, height / 2, 0),
      new MeshStandardMaterial({ map: facade, emissive: 0xffffff, emissiveMap: facade, emissiveIntensity: 0.35, roughness: 0.9 }),
    ),
  );

  const parts: BufferGeometry[] = [];
  for (let z = -length / 2 + 3; z < length / 2; z += 7) {
    for (const x of [-19.5, 19.5]) parts.push(solid(new ConeGeometry(0.7, 5, 4).translate(x, height + 2.5, z), SANDSTONE));
  }
  // Central Tower: an octagonal lantern and spire halfway along.
  parts.push(solid(new CylinderGeometry(7, 7.5, 22, 8).translate(0, height + 11, 0), SANDSTONE));
  parts.push(solid(new ConeGeometry(7, 22, 8).translate(0, height + 33, 0), SLATE));
  // Victoria Tower at the far end.
  const vz = -length / 2 + 14;
  parts.push(box(22, 92, 22, 0, 46, vz, SANDSTONE));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    parts.push(solid(new ConeGeometry(1.4, 10, 4).translate(x * 10, 97, vz + z * 10), SANDSTONE));
  }
  group.add(new Mesh(mergeParts(parts), floodlit()));

  group.position.set(SITES.parliament.x, STREET_Y, -(SITES.parliament.at + length / 2));
  return group;
}
