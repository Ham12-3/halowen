import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { createRng } from '../rng';
import { glow } from './landmarks';
import { STREET_Y } from './obstacles';
import { SITES } from './sites';

const H = 306;
/** The occupied floors end here; above is the open spire, clad in glass shards that splay apart. */
const CORE_TOP = 244;
const BASE_R = 31;
const TOP_R = 1.6;
const FLOORS = 72;

/** Radius of the main taper at height y. */
const taper = (y: number): number => BASE_R + (TOP_R - BASE_R) * (y / H);

/**
 * The eight glass shards: four broad faces and four narrow ones between,
 * each a leaning plane with its own top height. Narrow faces sit a little
 * recessed, which opens the fractures that let the lit floors show through.
 */
const FACETS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
  const broad = i % 2 === 0;
  return {
    broad,
    top: broad ? [306, 297, 302, 291][i / 2]! : [258, 270, 252, 279][(i - 1) / 2]!,
    recess: broad ? 0 : 1.4,
    splay: broad ? 2.4 : 1.2,
  };
});

/** Corner angles of the footprint: broad faces span 60 degrees, narrow ones 30. */
const CORNERS = FACETS.reduce<number[]>((acc, f, i) => [...acc, (acc[i] ?? 0) + (f.broad ? Math.PI / 3 : Math.PI / 6)], [0]);

/** Lit floors behind the glass: offices, the hotel and flats in warmer light, the spire's lit lattice on top. */
function shardGlow(): Texture {
  const w = 512;
  const h = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const rng = createRng(306);
  const coreTop = h - (CORE_TOP / H) * h;
  const floorPx = (h - coreTop) / FLOORS;
  for (let f = 0; f < FLOORS; f++) {
    const y = h - (f + 1) * floorPx;
    const warm = f >= 34 && f < 66; // hotel and apartments
    const busy = f >= 68 ? 0.8 : warm ? 0.3 : 0.26;
    for (let x = 0; x < w; x += 8) {
      if (rng() > busy) continue;
      const run = 8 * (1 + Math.floor(rng() * 6));
      ctx.fillStyle = warm ? (rng() < 0.6 ? '#c9a888' : '#e8d2b8') : rng() < 0.85 ? '#a9bcd2' : '#dfe8f4';
      ctx.fillRect(x, y + floorPx * 0.25, run - 1, floorPx * 0.6);
      x += run;
    }
  }
  // The spire's structure, lit from inside.
  ctx.strokeStyle = '#e8f0ff';
  ctx.lineWidth = 2;
  for (let x = -h; x < w + h; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, coreTop);
    ctx.lineTo(x + coreTop * 0.6, 0);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let x = 0; x < w; x += 8) ctx.fillRect(x, 0, 1, h); // mullions
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** One shard: a planar trapezoid up to the core's top, then a kinked shard splaying outwards to its own tip. */
function facetGeometry(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  let u0 = 0;
  FACETS.forEach((f, i) => {
    const a0 = CORNERS[i] ?? 0;
    const a1 = CORNERS[i + 1] ?? 0;
    const span = (a1 - a0) / (Math.PI * 2);
    // Corners sit on the taper's radius at fixed angles, so each section stays planar;
    // recessing moves the whole face towards the axis.
    const ring = (y: number, extra: number): Array<[number, number, number]> =>
      [a0, a1].map((a) => {
        const r = taper(y) + extra - f.recess;
        return [Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number];
      });
    const rows = [
      { y: 0, ring: ring(0, 0) },
      { y: CORE_TOP, ring: ring(CORE_TOP, 0) },
      { y: f.top, ring: ring(f.top, f.splay) },
    ];
    for (let k = 0; k < rows.length - 1; k++) {
      const lo = rows[k]!;
      const hi = rows[k + 1]!;
      if (hi.y <= lo.y) continue;
      const [l0, l1] = lo.ring as [[number, number, number], [number, number, number]];
      const [h0, h1] = hi.ring as [[number, number, number], [number, number, number]];
      // Wound so the face points away from the axis.
      for (const [p, u, v] of [
        [l0, u0, lo.y / H], [h1, u0 + span, hi.y / H], [l1, u0 + span, lo.y / H],
        [l0, u0, lo.y / H], [h0, u0, hi.y / H], [h1, u0 + span, hi.y / H],
      ] as const) {
        positions.push(...p);
        uvs.push(u, v);
      }
    }
    u0 += span;
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * The Shard: eight leaning glass shards that never quite meet, the lit floors
 * showing through the fractures between them, splintering at the top around
 * a glowing open spire.
 */
export function createShard(): Group {
  const group = new Group();
  const lit = shardGlow();
  const glass = new MeshStandardMaterial({
    color: 0x334052,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0xffffff,
    emissiveMap: lit,
    emissiveIntensity: 1.1,
  });
  group.add(new Mesh(facetGeometry(), glass));

  // The core inside, seen through the fractures: dark, with the same lit floors.
  const core = new CylinderGeometry(taper(CORE_TOP) - 2.5, BASE_R - 2.5, CORE_TOP, 8, 1, true).translate(0, CORE_TOP / 2, 0);
  group.add(new Mesh(core, new MeshStandardMaterial({ color: 0x0c1016, emissive: 0xffffff, emissiveMap: lit, emissiveIntensity: 1.2 })));

  // The open spire's lit structure, peeking out between the shards' tips.
  const spire = new CylinderGeometry(0.6, taper(CORE_TOP) - 3, H - 12 - CORE_TOP, 8, 1, true).translate(0, (H - 12 + CORE_TOP) / 2, 0);
  group.add(new Mesh(spire, new MeshBasicMaterial({ color: new Color(1.6, 1.75, 2.1) })));
  const halo = glow(0xcfe0ff, 70);
  halo.position.y = H - 30;
  halo.material.opacity = 0.5;
  group.add(halo);

  group.position.set(SITES.shard.x, STREET_Y, -SITES.shard.at);
  return group;
}
