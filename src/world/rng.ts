export type Rng = () => number;

/** Small, fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [0, 1]. */
export function valueNoise(x: number, z: number, seed = 0): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/** Three octaves of value noise, still in [0, 1]. */
export function fbm(x: number, z: number, seed = 0): number {
  return (
    valueNoise(x, z, seed) * 0.57 +
    valueNoise(x * 2.03, z * 2.03, seed + 1) * 0.29 +
    valueNoise(x * 4.01, z * 4.01, seed + 2) * 0.14
  );
}
