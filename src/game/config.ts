/** Central tuning values. Tweak here rather than hunting through entity code. */

export const LANES = {
  count: 3,
  /** Distance between lane centres; each lane is one railway track. */
  width: 2.8,
} as const;

export const RUN = {
  startSpeed: 11,
  /** Speed gained per second of running (each stage caps it: ROUTE.stageSpeeds). */
  acceleration: 0.08,
  /** How quickly the runner slides across to a new lane (higher = snappier). */
  laneSharpness: 16,
  jumpVelocity: 9.2,
  gravity: 27,
  /** Pressing slide in mid-air slams you down this fast. */
  slamVelocity: 16,
  /** Seconds a slide lasts. */
  slideTime: 0.7,
  /** Half the runner's width, for clipping obstacles in a neighbouring lane. */
  halfWidth: 0.35,
  /** Head height above the feet, standing and sliding. */
  height: 1.7,
  slideHeight: 0.8,
  /** Dropping this far below the roofs means you have come off the train. */
  fallLimit: 1.2,
} as const;

export const TRAIN = {
  /** Height of the carriage roofs above the rails: the surface you run on. */
  roofHeight: 3.2,
  width: 2.4,
  /** The course is built in blocks; each roofed block holds one carriage. */
  blockLength: 14,
  /** Space between coupled carriages (cosmetic: you run straight over it). */
  coupling: 0.8,
  /** A missing section in the middle of a carriage that you must jump. */
  gapLength: 4.5,
} as const;

/** Obstacle shapes, shared by the collision checks and the models. Heights are above the roof. */
export const OBSTACLE = {
  /** A row of jack-o'-lanterns: jump over it. */
  hurdleHeight: 0.85,
  hurdleHalfWidth: 1.1,
  hurdleHalfDepth: 0.5,
  /** A hanging signal board or road bridge: slide under it (jumping hits it). */
  barBottom: 1.05,
  barTop: 2.8,
  barHalfWidth: 1.25,
  barHalfDepth: 0.2,
  /** How far below the roof you can still be pulled up onto it (forgiving late jumps). */
  stepUp: 0.6,
  /** The runner's half length along the track, for overlap tests. */
  runnerHalfDepth: 0.3,
} as const;

export const COURSE = {
  /** Hazard-free blocks at the start of a run. */
  safeBlocks: 5,
  /** Blocks kept generated ahead of and behind the runner. */
  ahead: 22,
  behind: 3,
  /** Chance per block that a train ends (its lane empties), at the start and at full difficulty. */
  endChance: [0.05, 0.14],
  /** Chance a roofed block carries an obstacle, at the start and at full difficulty. */
  obstacleChance: [0.22, 0.5],
  /** Chance a block gets a road bridge across every lane (slide under it). */
  bridgeChance: [0.04, 0.1],
  /** Distance over which the difficulty ramps up from start to full. */
  rampDistance: 3000,
  /** Hazard-free track before and after each station. */
  stationCalmBefore: 90,
  stationCalmAfter: 40,
} as const;

/**
 * The Midnight Line: stations in order with their distance along the track.
 * Each stretch between stations is a stage; reaching the last one wins.
 */
export const ROUTE = {
  stations: [
    { name: 'London Bridge', at: 0 },
    { name: 'Waterloo', at: 2000 },
    { name: 'Westminster', at: 4200 },
    { name: 'Tower Hill', at: 6600 },
  ],
  /** Top speed (m/s) on each stage: the line gets faster after every station. */
  stageSpeeds: [20, 23, 26],
  /** Where the line crosses the Thames: [from, to] distances. */
  rivers: [
    [3540, 3790],
    [6250, 6470],
  ],
  /** Points for reaching each station after the first. */
  stationBonus: 500,
} as const;

/** Glowing soul wisps to collect along the roofs. */
export const SOUL = {
  /** Points per soul. */
  value: 10,
  /** Chance a block gets a trail of souls. */
  trailChance: 0.5,
  perTrail: 5,
  spacing: 2.3,
  /** Height above the roof of a trail in a clear lane; trails under bars sit low, over hurdles they arc. */
  height: 1.0,
  lowHeight: 0.4,
  /** How close (sideways, beyond the runner's half width) a soul must be to be gathered. */
  reach: 0.5,
  /** A pickup within this many seconds of the last one raises the chime's pitch. */
  streakWindow: 1.2,
} as const;

export const LIVES = {
  count: 3,
  /** Seconds of blinking safety after losing a life (obstacles and ghosts pass through you). */
  invulnerability: 2,
  /** Share of your speed kept after a stumble. */
  stumbleSpeed: 0.7,
} as const;

/** Ghosts floating in the lanes: too tall to jump, too low to slide under. Dodge them. */
export const GHOST = {
  /** No ghosts before this distance, to let the player settle in. */
  firstAt: 350,
  /** Chance per block of a ghost, at the start and at full difficulty. */
  chance: [0.07, 0.22],
  /** Share of ghosts that swoop into a neighbouring lane as you approach. */
  swoopShare: 0.45,
  /** A swoop starts when the runner is this far from the ghost and takes this much of their travel. */
  swoopLead: 34,
  swoopLength: 10,
  hover: 0.3,
  /** Collision box: the sheet spans from `hover` to `hover + height` above the roof. */
  height: 1.6,
  halfWidth: 0.55,
  halfDepth: 0.45,
  /** Points for each ghost the lantern flare banishes. */
  banishValue: 50,
} as const;

/** The lantern flare power-up: grab a floating lantern and it blazes for a while. */
export const FLARE = {
  /** Roughly how far apart lantern pickups are (metres). */
  spacing: 520,
  /** Seconds the flare burns once picked up. */
  duration: 8,
  /** Ghosts up to this far ahead are banished while it burns. */
  reach: 24,
  /** Souls in any lane within this distance fly to you while it burns. */
  magnet: 4,
  /** Height of a lantern pickup above the roof. */
  height: 1.0,
} as const;

export const CAMERA = {
  fov: 62,
  /** The field of view widens towards this at top speed, for a sense of pace. */
  maxFov: 74,
  near: 0.1,
  far: 1500,
  /** Offset behind and above the runner's feet. */
  back: 6.5,
  up: 2.7,
  /** Where the camera looks: this far ahead of and above the runner. */
  lookAhead: 10,
  lookHeight: 1,
  followSharpness: 10,
} as const;

export const ATMOSPHERE = {
  fogColor: 0x1d1b30,
  /** Light enough that London's landmarks loom out of the mist. */
  fogDensity: 0.0085,
  skyZenith: 0x04050f,
  /** Direction the moonlight comes from (normalised in lighting.ts). */
  moonLightDir: { x: -0.4, y: 0.62, z: -0.68 },
  /** The visible moon sits lower than the light so it shows up in frame. */
  moonDiscElevation: 0.22,
} as const;

export const RENDER = {
  maxPixelRatio: 1.5,
} as const;
