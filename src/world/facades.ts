import type { Texture } from 'three';
import { FacadePainter, type Grid, pick } from './facadeCanvas';

/** A finished facade: its tile layout and the colour and glow textures. */
export interface Facade {
  grid: Grid;
  map: Texture;
  glow: Texture;
}

const DARK_GLASS = ['#11161c', '#141a21', '#0f1419', '#171d24'];
const CURTAINS = ['#7a2f22', '#3d4a2a', '#5a3a26', '#2c3550', '#6b5a3a'];
const HOME_LIGHT = ['#ffc475', '#ffb862', '#ffd08a', '#ffcf9a'];
const OFFICE_LIGHT = ['#8e9bab', '#97a2ae', '#8794a6'];
const OFFICE_CEILING = ['#d6e1ee', '#e2e8f0', '#cdd9e8'];

/**
 * What you see through a lit window: a warm room (curtains, a lamp's hot spot,
 * sometimes the blue flicker of a TV) or a cool office (ceiling panels, desks).
 */
function room(p: FacadePainter, bay: number, row: number, x: number, y: number, w: number, h: number, office: boolean): void {
  const rng = p.rng;
  const base = office ? pick(rng, OFFICE_LIGHT) : rng() < 0.08 ? '#7f9ccf' : pick(rng, HOME_LIGHT);
  p.glow(bay, row, x, y, w, h, base);
  if (office) {
    p.glow(bay, row, x, y + h * 0.6, w, h * 0.4, pick(rng, OFFICE_CEILING)); // light falls off away from the ceiling
    for (let cx = x + 0.2; cx < x + w - 0.3; cx += 0.75) p.glow(bay, row, cx, y + h - 0.18, 0.4, 0.08, '#ffffff');
    if (rng() < 0.6) p.glow(bay, row, x, y, w, Math.min(0.75, h * 0.35), '#5c6470'); // desks and screens
    if (rng() < 0.25) p.glow(bay, row, x + rng() * (w - 0.5), y, 0.4, 1.4, '#2a2e36'); // someone working late
    return;
  }
  // Curtains, half drawn, or a blind.
  if (rng() < 0.55) {
    const c = pick(rng, CURTAINS);
    const cw = w * (0.18 + rng() * 0.2);
    p.glow(bay, row, x, y, cw, h, c);
    p.glow(bay, row, x + w - cw, y, cw, h, c);
  } else if (rng() < 0.3) {
    for (let by = y + h - 0.1; by > y + h * 0.4; by -= 0.09) p.glow(bay, row, x, by, w, 0.04, '#a0784a');
  }
  if (rng() < 0.3) p.glow(bay, row, x + w * 0.2, y + h * 0.55, w * 0.3, h * 0.3, '#fff0c8'); // lamp
}

/** Victorian London: stock or red brick, sash windows under stone lintels, shops at street level. */
export function brickFacade(seed: number, tones: string[], mortar: string, stone: string): Facade {
  const grid: Grid = { bays: 8, floors: 8, bay: 3.0, floor: 3.2, ppm: 32 };
  const p = new FacadePainter(grid, seed);
  const rng = p.rng;
  p.bricks(tones, mortar);
  p.weather(0.35);
  for (let row = 1; row < grid.floors; row++) {
    for (let bay = 0; bay < grid.bays; bay++) {
      const x = 1.0;
      const w = 1.0;
      const y = 0.75;
      const h = 1.8;
      p.wall(bay, row, x - 0.12, y + h, w + 0.24, 0.22, stone); // lintel
      p.wall(bay, row, x - 0.08, y - 0.08, w + 0.16, 0.08, stone); // sill
      p.wall(bay, row, x - 0.06, y, w + 0.12, h, '#1b1612'); // reveal
      const lit = rng() < 0.32;
      p.glass(bay, row, x, y, w, h, pick(rng, DARK_GLASS));
      if (lit) room(p, bay, row, x, y, w, h, false);
      // Sash frame: outer frame, meeting rail, glazing bars.
      const frame = '#d9d4c6';
      p.wall(bay, row, x, y, w, 0.06, frame);
      p.wall(bay, row, x, y + h - 0.06, w, 0.06, frame);
      p.wall(bay, row, x, y, 0.06, h, frame);
      p.wall(bay, row, x + w - 0.06, y, 0.06, h, frame);
      p.wall(bay, row, x, y + h / 2 - 0.04, w, 0.08, frame);
      p.wall(bay, row, x + w / 2 - 0.02, y, 0.04, h, frame);
    }
  }
  // Ground floor: a run of shops, two bays each, with fascia signs; shut ones have roller shutters.
  const fascias = ['#1f3b2d', '#4a1a1f', '#15161a', '#1b2440', '#5a4630'];
  for (let bay = 0; bay < grid.bays; bay += 2) {
    const open = rng() < 0.55;
    const width = 2 * grid.bay - 0.5;
    p.wall(bay, 0, 0, 0, 0.25, 3.2, stone); // pilasters
    p.wall(bay, 0, 0.25, 2.55, width, 0.5, pick(rng, fascias));
    if (rng() < 0.6) {
      const sign = pick(rng, ['#ffe7b0', '#ffffff', '#ff9a4a', '#9fd6ff']);
      for (let lx = 0.7; lx < width - 0.6; lx += 0.28) if (rng() < 0.8) p.glow(bay, 0, lx, 2.68, 0.18, 0.24, sign);
    }
    p.wall(bay, 0, 0, 3.05, 2 * grid.bay, 0.15, stone); // string course
    if (open) {
      p.glass(bay, 0, 0.25, 0.35, width, 2.1, '#151a20', pick(rng, ['#fff1d6', '#ffe2b0', '#eef6ff']));
      for (let sy = 0.6; sy < 2.2; sy += 0.45) p.glow(bay, 0, 0.4, sy, width - 0.3, 0.08, '#6a5a48'); // shelves
    } else {
      p.wall(bay, 0, 0.25, 0.1, width, 2.45, '#55575b');
      for (let sy = 0.15; sy < 2.5; sy += 0.09) p.wall(bay, 0, 0.25, sy, width, 0.03, '#3f4144');
    }
  }
  return { grid, ...p.textures() };
}

/** Portland stone: a pale grid of deep-set office windows, whole floors lit late. */
export function stoneFacade(seed: number): Facade {
  const grid: Grid = { bays: 8, floors: 8, bay: 3.0, floor: 3.6, ppm: 24 };
  const p = new FacadePainter(grid, seed);
  const rng = p.rng;
  const ctx = p.paint;
  ctx.fillStyle = '#cdc6b4';
  ctx.fillRect(0, 0, p.width, p.height);
  ctx.fillStyle = '#b4ac98';
  for (let y = 0; y < p.height; y += Math.round(0.6 * grid.ppm)) ctx.fillRect(0, y, p.width, 1);
  p.weather(0.45);
  for (let row = 0; row < grid.floors; row++) {
    const floorLit = rng() < 0.4;
    for (let bay = 0; bay < grid.bays; bay++) {
      const ground = row === 0;
      const [x, y, w, h] = ground ? [0.35, 0.5, 2.3, 2.7] : [0.75, 0.8, 1.5, 1.95];
      if (ground) p.wall(bay, row, 0, 0, grid.bay, 0.5, '#2c2b2d'); // granite plinth
      p.wall(bay, row, x - 0.05, y - 0.06, w + 0.1, h + 0.06, '#8f897b');
      p.glass(bay, row, x, y, w, h, pick(rng, DARK_GLASS));
      if (floorLit ? rng() < 0.85 : rng() < 0.08) room(p, bay, row, x, y, w, h, !ground || rng() < 0.5);
      p.wall(bay, row, x, y + h - 0.16, w, 0.16, '#5f5a50'); // deep reveal shadow
      p.wall(bay, row, x, y, 0.1, h, '#7c7669');
      p.wall(bay, row, x + w / 2 - 0.03, y, 0.06, h, '#3a3530'); // mullion
      p.wall(bay, row, x - 0.1, y - 0.1, w + 0.2, 0.1, '#ddd7c7'); // sill
    }
  }
  return { grid, ...p.textures() };
}

/** A glass curtain wall: dark reflective panes, slab spandrels, floors of office light. */
export function glassFacade(seed: number): Facade {
  const grid: Grid = { bays: 16, floors: 10, bay: 1.5, floor: 3.8, ppm: 20 };
  const p = new FacadePainter(grid, seed);
  const rng = p.rng;
  for (let row = 0; row < grid.floors; row++) {
    // Most floors are dark at night; some are cleaners' or late workers' floors, partly lit in runs.
    const mode = rng();
    const warm = rng() < 0.15;
    const share = mode < 0.18 ? 0.85 : mode < 0.5 ? 0.35 : 0.04;
    let lit = false;
    for (let bay = 0; bay < grid.bays; bay++) {
      if (rng() < 0.3) lit = rng() < share; // lights come in runs of a few bays
      const tone = pick(rng, ['#1d2a33', '#1a2630', '#203039', '#1b2832']);
      p.glass(bay, row, 0, 0, grid.bay, 0.9, '#121a22'); // spandrel
      p.glass(bay, row, 0, 0.9, grid.bay, grid.floor - 0.9, tone);
      if (lit) {
        const dim = rng() < 0.4;
        p.glow(bay, row, 0, 0.9, grid.bay, grid.floor - 1.0, warm ? '#5c4c38' : dim ? '#3c4552' : '#5a6676');
        p.glow(bay, row, 0, grid.floor - 0.7, grid.bay, 0.6, warm ? '#bfa27a' : dim ? '#7c8a9c' : pick(rng, OFFICE_CEILING));
        p.glow(bay, row, 0.35, grid.floor - 0.32, 0.8, 0.08, '#ffffff'); // ceiling panel
        if (rng() < 0.5) p.glow(bay, row, 0.1, 0.9, grid.bay - 0.2, 0.7, '#262b33'); // desks and screens
      }
      p.wall(bay, row, 0, 0, 0.1, grid.floor, '#4d5560'); // mullion
      p.wall(bay, row, 0, 0.86, grid.bay, 0.07, '#434b55'); // transom
    }
  }
  return { grid, ...p.textures() };
}

/** Post-war concrete: balcony slabs, panels and homes with the lights on. */
export function concreteFacade(seed: number): Facade {
  const grid: Grid = { bays: 8, floors: 12, bay: 3.4, floor: 2.9, ppm: 20 };
  const p = new FacadePainter(grid, seed);
  const rng = p.rng;
  const ctx = p.paint;
  ctx.fillStyle = '#8b8982';
  ctx.fillRect(0, 0, p.width, p.height);
  p.weather(0.55);
  const panels = ['#6d6a62', '#7b4b3a', '#4e5a63', '#8c8676'];
  for (let row = 0; row < grid.floors; row++) {
    for (let bay = 0; bay < grid.bays; bay++) {
      p.wall(bay, row, 0, 0, grid.bay, 0.22, '#a5a39b'); // slab edge
      const balcony = bay % 2 === 0;
      p.glass(bay, row, 0.8, 0.9, 1.8, 1.45, pick(rng, DARK_GLASS));
      if (rng() < 0.34) room(p, bay, row, 0.8, 0.9, 1.8, 1.45, false);
      p.wall(bay, row, 0.8 + 0.88, 0.9, 0.05, 1.45, '#cfcfc8'); // window frame
      if (balcony) p.wall(bay, row, 0.2, 0.22, grid.bay - 0.4, 0.95, pick(rng, panels));
    }
  }
  return { grid, ...p.textures() };
}
