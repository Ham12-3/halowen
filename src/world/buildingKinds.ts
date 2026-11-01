import { brickFacade, concreteFacade, type Facade, glassFacade, stoneFacade } from './facades';
import type { FacadeLook } from './facadeMaterial';

export type FacadeName = 'stock' | 'red' | 'stone' | 'glass' | 'concrete';
export type RoofName = 'pitched' | 'flat' | 'plant' | 'tower';

/** A type of London building: its facade, roof, and size ranges (width runs along the track). */
export interface Kind {
  facade: FacadeName;
  roof: RoofName;
  width: [number, number];
  height: [number, number];
  depth: [number, number];
  tints: number[];
}

const WARM = [0xffffff, 0xf2ebe2, 0xe8e0d6];
const COOL = [0xffffff, 0xe9edf2, 0xdde4ec];

export const TERRACE: Kind = { facade: 'stock', roof: 'pitched', width: [12, 24], height: [9.6, 12.8], depth: [9, 11], tints: WARM };
export const RED_TERRACE: Kind = { facade: 'red', roof: 'pitched', width: [12, 20], height: [9.6, 12.8], depth: [9, 11], tints: WARM };
export const WAREHOUSE: Kind = { facade: 'stock', roof: 'flat', width: [14, 26], height: [16, 22], depth: [12, 16], tints: WARM };
export const MANSION: Kind = { facade: 'red', roof: 'flat', width: [16, 28], height: [15, 20], depth: [12, 15], tints: WARM };
export const STONE_OFFICE: Kind = { facade: 'stone', roof: 'plant', width: [18, 34], height: [22, 36], depth: [14, 20], tints: WARM };
export const GLASS_OFFICE: Kind = { facade: 'glass', roof: 'plant', width: [18, 30], height: [30, 56], depth: [16, 22], tints: COOL };
export const COUNCIL: Kind = { facade: 'concrete', roof: 'plant', width: [14, 24], height: [24, 44], depth: [12, 16], tints: WARM };
export const GLASS_TOWER: Kind = { facade: 'glass', roof: 'tower', width: [20, 30], height: [70, 140], depth: [20, 28], tints: COOL };
export const CONCRETE_TOWER: Kind = { facade: 'concrete', roof: 'tower', width: [16, 22], height: [55, 85], depth: [16, 20], tints: WARM };

/** One row of buildings along each side of the line: distance from the track, gaps, and what gets built. */
export interface Row {
  offset: number;
  gap: [number, number];
  kinds: Array<[Kind, number]>;
}

/** Brick terraces and warehouses hug the viaduct, offices and estates behind, towers further out. */
export const ROWS: Row[] = [
  { offset: 10, gap: [0, 1.5], kinds: [[TERRACE, 4], [RED_TERRACE, 2], [WAREHOUSE, 2.5], [MANSION, 1], [STONE_OFFICE, 0.4]] },
  { offset: 32, gap: [2, 8], kinds: [[STONE_OFFICE, 3], [GLASS_OFFICE, 3], [COUNCIL, 2], [WAREHOUSE, 1]] },
  { offset: 78, gap: [18, 50], kinds: [[GLASS_TOWER, 3], [CONCRETE_TOWER, 2], [GLASS_OFFICE, 1]] },
];

/** Each facade's textures and how its material looks (cornice, roof, glow). Built once. */
export function createFacades(): Record<FacadeName, { facade: Facade; look: FacadeLook }> {
  const stockTones = ['#9c8a66', '#a8956e', '#8f7d5c', '#b09c74', '#7f6d52', '#6e5f4c', '#a48c62'];
  const redTones = ['#8a3b2a', '#9a4430', '#7a3324', '#a24d36', '#6d2e22', '#8e4a3a'];
  return {
    stock: {
      facade: brickFacade(41, stockTones, '#6f6656', '#cbc2a8'),
      look: { cornice: 0.35, corniceColor: 0xc8bfa5, roofColor: 0x2a2a2c, glow: 1.7, roughness: 0.92 },
    },
    red: {
      facade: brickFacade(43, redTones, '#7a6a5c', '#d8d0bf'),
      look: { cornice: 0.45, corniceColor: 0xd2cab8, roofColor: 0x2a2a2c, glow: 1.7, roughness: 0.92 },
    },
    stone: {
      facade: stoneFacade(47),
      look: { cornice: 0.7, corniceColor: 0xd6d0c0, roofColor: 0x55534e, glow: 1.3, roughness: 0.85 },
    },
    glass: {
      facade: glassFacade(53),
      look: { cornice: 1.4, corniceColor: 0x1a2026, roofColor: 0x2b2f35, glow: 1.3, roughness: 0.5 },
    },
    concrete: {
      facade: concreteFacade(59),
      look: { cornice: 0.45, corniceColor: 0x9a9890, roofColor: 0x4a4a48, glow: 1.6, roughness: 0.9 },
    },
  };
}
